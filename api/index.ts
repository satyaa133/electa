import express from "express";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import bcrypt from "bcryptjs";
import axios from "axios";
import { neon } from "@neondatabase/serverless";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { OriginValidator } from "./middleware/originValidator";

const originConfig = {
  allowedOrigins: [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://yourdomain.com",
  ],
  defaultOrigin: "http://localhost:5173",
};
const originValidator = new OriginValidator(originConfig);

import { createApiKeyManager } from "./config/apiKeyManager";

const sql = (strings: TemplateStringsArray, ...values: any[]) => {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    console.error("❌ Neon Database URL missing.");
    throw new Error("Neon Database URL missing.");
  }
  return neon(url)(strings, ...values);
};

// --- API Key Management (Stateful Rotation) ---
let keyManager: any;
try {
  keyManager = createApiKeyManager();
} catch (error) {
  console.error("Failed to initialize API Key Manager:", error);
}

async function generateContentWithRetry(
  genFunc: (apiKey: string) => Promise<any>,
  maxRetries = 3,
) {
  let lastError: any = null;
  const totalPossible = Math.max(maxRetries, keyManager?.getTotalKeys() || 1);

  for (let i = 0; i < totalPossible; i++) {
    const apiKey = keyManager.getNextKey();
    if (!apiKey) throw new Error("No API keys available");

    try {
      const result = await genFunc(apiKey);
      await result.response;
      return result;
    } catch (err: any) {
      lastError = err;
      const status = err.status || err.response?.status;
      const errMsg = err.message?.toLowerCase() || "";

      const isRetriable =
        status === 429 ||
        status === 503 ||
        errMsg.includes("429") ||
        errMsg.includes("503") ||
        errMsg.includes("quota") ||
        errMsg.includes("overloaded") ||
        errMsg.includes("demand");

      if (isRetriable) {
        if (status === 429 || errMsg.includes("quota")) {
          keyManager.markAsExhausted(apiKey);
        }
        console.warn(
          `[Retry] Attempt ${i + 1} failed (${status || "error"}). Switching keys...`,
        );
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

import cookieParser from "cookie-parser";
import { SessionManager } from "./auth/sessionManager";
import {
  createAuthMiddleware,
  AuthenticatedRequest,
} from "./middleware/authMiddleware";
import { setupSecurityHeaders } from "./middleware/securityHeaders";
import { setupCORS } from "./middleware/cors";
import {
  apiLimiter,
  authLimiter,
  geminiLimiter,
} from "./middleware/rateLimiter";
import {
  signupValidators,
  loginValidators,
  userUpdateValidators,
  handleValidationErrors,
} from "./middleware/validators";
import { logger } from "./config/logger";
import {
  csrfProtection,
  csrfTokenHandler,
  csrfErrorHandler,
} from "./middleware/csrf";

const sessionManager = new SessionManager(
  process.env.JWT_ACCESS_SECRET || "dev-access-secret",
  process.env.JWT_REFRESH_SECRET || "dev-refresh-secret",
);
const requireAuth = createAuthMiddleware(sessionManager);

const app = express();
app.set("trust proxy", 1); // Trust proxy for rate limiting behind load balancers
setupSecurityHeaders(app);
setupCORS(app);
app.use(cookieParser());

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

app.use("/api/", apiLimiter);

app.use(express.json({ limit: "50mb" }));

async function initDB() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        bio TEXT DEFAULT '',
        preferences TEXT DEFAULT '{"genres":[],"dietary":[],"interests":[]}',
        profile_photo TEXT DEFAULT '',
        bookmarks TEXT DEFAULT '[]',
        location TEXT DEFAULT ''
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS recommendations_cache (
        id SERIAL PRIMARY KEY,
        cache_key TEXT UNIQUE NOT NULL,
        data TEXT NOT NULL,
        context TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    logger.info("Database initialized successfully.");
  } catch (error: any) {
    logger.error("Failed to initialize database", { error: error.message });
  }
}

if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
  initDB();
} else {
  logger.warn("⚠️ skipping initDB: Database URL missing.");
}

// --- CSRF Token Endpoint ---
app.get("/api/csrf-token", csrfProtection, csrfTokenHandler);

// --- API Handlers ---

app.get("/api/location", async (req, res) => {
  const forwarded = req.headers["x-forwarded-for"];
  const clientIp =
    typeof forwarded === "string"
      ? forwarded.split(",")[0]
      : req.socket?.remoteAddress || req.ip || "";

  try {
    // Try ipapi.co
    try {
      const url =
        clientIp && clientIp !== "::1" && clientIp !== "127.0.0.1"
          ? `https://ipapi.co/${clientIp}/json/`
          : "https://ipapi.co/json/";

      const resp = await axios.get(url, {
        timeout: 5000,
        headers: { "User-Agent": "node.js" },
      });
      if (resp.data && resp.data.city) {
        const loc = resp.data.region
          ? `${resp.data.city}, ${resp.data.region}`
          : resp.data.city;
        return res.json({ location: loc, source: "ipapi.co", ip: clientIp });
      }
    } catch (e: any) {}

    // Fallback to ip-api.com
    const url2 =
      clientIp && clientIp !== "::1" && clientIp !== "127.0.0.1"
        ? `http://ip-api.com/json/${clientIp}`
        : "http://ip-api.com/json/";

    const resp2 = await axios.get(url2, { timeout: 5000 });
    if (resp2.data && resp2.data.city) {
      const loc = resp2.data.regionName
        ? `${resp2.data.city}, ${resp2.data.regionName}`
        : resp2.data.city;
      return res.json({ location: loc, source: "ip-api.com", ip: clientIp });
    }

    res
      .status(404)
      .json({
        error: "Location could not be determined from IP.",
        ip: clientIp,
      });
  } catch (err: any) {
    logger.error("Location fetch failed", { error: err.message });
    res.status(500).json({ error: "Failed to fetch location" });
  }
});

app.post("/api/recommendations", geminiLimiter, async (req, res) => {
  try {
    const {
      mood,
      category,
      preferences,
      history,
      location,
      userHour,
      subCategory,
      refresh,
    } = req.body || {};

    // Filter preferences for current category context
    const genreWords = [
      "action",
      "comedy",
      "drama",
      "sci-fi",
      "horror",
      "romance",
      "thriller",
      "mystery",
    ];
    const foodWords = [
      "pasta",
      "pizza",
      "sushi",
      "burger",
      "vegan",
      "steak",
      "coffee",
      "breakfast",
      "lunch",
      "dinner",
    ];
    const bookWords = [
      "fiction",
      "novel",
      "biography",
      "history",
      "fantasy",
      "poem",
    ];

    let filteredPrefs = preferences || [];
    if (category === "movies")
      filteredPrefs = filteredPrefs.filter((p: string) =>
        genreWords.some((w) => p.toLowerCase().includes(w)),
      );
    if (category === "restaurants" || category === "food")
      filteredPrefs = filteredPrefs.filter((p: string) =>
        foodWords.some((w) => p.toLowerCase().includes(w)),
      );
    if (category === "books")
      filteredPrefs = filteredPrefs.filter((p: string) =>
        bookWords.some((w) => p.toLowerCase().includes(w)),
      );

    let weather = "Clear";
    let timeOfDay = "Day";
    const hour =
      userHour !== undefined && userHour !== null
        ? userHour
        : new Date().getHours();

    if (hour >= 5 && hour < 12) timeOfDay = "Morning";
    else if (hour >= 12 && hour < 17) timeOfDay = "Afternoon";
    else if (hour >= 17 && hour < 21) timeOfDay = "Evening";
    else timeOfDay = "Late Night";

    try {
      const weatherRes = await axios.get(
        `https://wttr.in/${encodeURIComponent(location || "London")}?format=%C`,
        { timeout: 3000 },
      );
      weather = weatherRes.data || "Clear";
    } catch (e) {}

    // --- Cache Check ---
    const cacheKey =
      `rec:${category}:${subCategory || "all"}:${mood}:${location || "global"}`.toLowerCase();

    if (!refresh) {
      try {
        const cached = await sql`
                    SELECT data, context, created_at 
                    FROM recommendations_cache 
                    WHERE cache_key = ${cacheKey} 
                    AND created_at > NOW() - INTERVAL '24 hours'
                    LIMIT 1
            `;
        if (cached.length > 0) {
          const createdAt = new Date(cached[0].created_at);
          const ageMs = Date.now() - createdAt.getTime();
          const ageHours = ageMs / (1000 * 60 * 60);

          // Probabilistic bypass for freshness
          let shouldBypass = false;
          const rand = Math.random();
          if (ageHours > 1 && ageHours < 6 && rand < 0.2) shouldBypass = true;
          else if (ageHours >= 6 && rand < 0.5) shouldBypass = true;

          if (!shouldBypass) {
            console.log(
              `[Cache Hit] Serving recommendations for: ${cacheKey} (${Math.round(ageHours * 10) / 10}h old)`,
            );
            return res.json({
              recommendations: JSON.parse(cached[0].data),
              context: JSON.parse(
                cached[0].context || '{"weather":"Clear","timeOfDay":"Day"}',
              ),
              cached: true,
            });
          } else {
            console.log(
              `[Cache Probabilistic Bypass] Refreshing data (${Math.round(ageHours * 10) / 10}h old) for: ${cacheKey}`,
            );
          }
        }
      } catch (err) {
        console.error("[Cache Error] Check failed:", err);
      }
    } else {
      console.log(`[Cache Manual Bypass] Force refresh for: ${cacheKey}`);
    }
    // --- End Cache Check ---

    let targetType = "items";
    let specialRules = "";

    if (category === "movies" || category === "movie") {
      targetType = "Movies";
      specialRules =
        "- Suggest popular or critically acclaimed films.\n- Include 'year' and 'rating' in details.";
    } else if (category === "music") {
      targetType = "Albums/Artists";
      specialRules =
        "- Suggest specific albums or artists.\n- Include 'year' and 'genres' in details.";
    } else if (category === "books" || category === "book") {
      targetType = "Books";
      specialRules =
        "- Suggest specific book titles and authors.\n- Include 'year' and 'rating' in details.";
    } else if (
      category === "restaurants" ||
      category === "food" ||
      category === "restaurant"
    ) {
      targetType = subCategory
        ? `${subCategory} Restaurants`
        : "Restaurants (Physical Venues)";
      specialRules = `- The 'title' MUST be the name of a PHYSICAL ESTABLISHMENT.\n- If it's Morning, suggest breakfast/coffee spots.\n- If Evening/Night, suggest bars/dinner venues.\n- If Raining/Stormy, suggest indoor dining.\n${subCategory === "lunch" || subCategory === "dinner" ? "- IMPORTANT: Suggest ONLY established restaurants. NO small cafes, bistros, or coffee shops." : ""}`;
    } else if (category === "games" || category === "game") {
      targetType = "Video Games";
      specialRules =
        "- Suggest modern or classic video games.\n- Include 'platform' and 'rating' in details.";
    }

    const prompt = `
            Recommend 12 ${targetType} based on:
            Mood: ${mood}, Location: ${location || "Unknown City"}, Time: ${timeOfDay}, Weather: ${weather}
            Preferences: ${(filteredPrefs || []).join(", ")}
            
            RULES:
            ${specialRules}
            - CRITICAL: Every single recommendation MUST be a ${targetType}. 
            - DO NOT suggest Restaurants if the category is Movies, Music, Books, or Games.
            - DO NOT suggest Movies if the category is Restaurants, Music, Books, or Games.
            - Format: Raw JSON array of 12 objects with: id, title, description, category (set to '${category}'), reason, details (rating, year, address, tags[], link).
            - NO markdown, NO extra text.
        `;
    let systemInstruction = "You are Electa, a precise recommendation engine.";
    if (category === "movies") {
      systemInstruction =
        "You are Electa's Movie Expert. Suggest ONLY films. NEVER suggest restaurants, books, or music. Include year and rating.";
    } else if (category === "restaurants" || category === "food") {
      systemInstruction =
        "You are Electa's Food Guide. Suggest ONLY physical restaurants and venues. NEVER suggest movies or music.";
    } else if (category === "music") {
      systemInstruction =
        "You are Electa's Music Guru. Suggest ONLY albums or artists. NEVER suggest restaurants or movies.";
    }

    const result = await generateContentWithRetry(async (key) => {
      const genAI = new GoogleGenerativeAI(key);
      const modelInstance = genAI.getGenerativeModel({
        model: "gemini-flash-latest",
        systemInstruction: systemInstruction,
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.7,
        },
      });
      return await modelInstance.generateContent(prompt);
    });

    const response = await result.response;
    const text = response.text();
    let recommendations = JSON.parse(
      text.match(/\[\s*\{[\s\S]*\}\s*\]/)?.[0] || text,
    );

    if (Array.isArray(recommendations)) {
      recommendations = recommendations.map((r: any, idx: number) => {
        const slug = r.title
          ? r.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")
          : "rec";
        return { ...r, id: `${category}-${slug}-${idx}` }; // idx added for uniqueness within a single response
      });
    }

    // --- Cache Store ---
    try {
      await sql`
                INSERT INTO recommendations_cache (cache_key, data, context)
                VALUES (${cacheKey}, ${JSON.stringify(recommendations)}, ${JSON.stringify({ weather, timeOfDay })})
                ON CONFLICT (cache_key) 
                DO UPDATE SET 
                    data = EXCLUDED.data, 
                    context = EXCLUDED.context, 
                    created_at = CURRENT_TIMESTAMP
            `;
      console.log(`[Cache Store] Recommendations saved for: ${cacheKey}`);
    } catch (err) {
      console.error("[Cache Error] Store failed:", err);
    }
    // --- End Cache Store ---

    res.json({
      recommendations: Array.isArray(recommendations) ? recommendations : [],
      context: { weather, timeOfDay },
    });
  } catch (err: any) {
    logger.error("Rec API error", { error: err.message });
    res.status(err.status || 500).json({ error: "Gemini API failure" });
  }
});

app.post("/api/ask", geminiLimiter, async (req, res) => {
  try {
    const { recommendation, question, chatHistory } = req.body || {};
    if (!recommendation || !question)
      return res.status(400).json({ error: "Missing data" });

    const result = await generateContentWithRetry(async (key) => {
      const genAI = new GoogleGenerativeAI(key);
      const modelInstance = genAI.getGenerativeModel({
        model: "gemini-flash-latest",
      });
      const historyContext = (chatHistory || [])
        .map(
          (msg: any) =>
            `${msg.role === "user" ? "User" : "Electa"}: ${msg.content}`,
        )
        .join("\n");

      const context = `
                Context: Recommendation for ${recommendation.title}. 
                Details: ${JSON.stringify(recommendation.details)}
                User Question: ${question}
                Prev History: ${historyContext}
                Answer as Electa, concise and helpful. Add external links ONLY if truly needed.
            `;
      return await modelInstance.generateContent(context);
    });
    const response = await result.response;
    const text = response.text();

    res.json({
      answer: text || "No response",
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error("Ask API error", { error: err.message });
    res.status(err.status || 500).json({ error: "AI Handler failed" });
  }
});

app.post(
  "/api/auth/signup",
  authLimiter,
  signupValidators,
  handleValidationErrors,
  async (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: "All fields are required" });
    }

    try {
      const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
      if (existing.length > 0) {
        return res.status(400).json({ error: "User already exists" });
      }

      const hash = await bcrypt.hash(password, 10);
      const newUsers =
        await sql`INSERT INTO users (email, password, name) VALUES (${email}, ${hash}, ${name}) RETURNING id`;
      const newUserId = newUsers[0].id;

      const tokens = sessionManager.createSessionTokens(newUserId, email);
      res.cookie("accessToken", tokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 15 * 60 * 1000,
        path: "/",
      });

      const user = {
        email,
        name,
        bio: "",
        profile_photo: "",
        preferences: { genres: [], dietary: [], interests: [] },
        bookmarks: [],
        location: "",
      };

      res.json({ user });
    } catch (err: any) {
      logger.error("Signup error", { error: err.message });
      res
        .status(500)
        .json({ error: "An internal error occurred during signup" });
    }
  },
);

app.post(
  "/api/auth/login",
  authLimiter,
  loginValidators,
  handleValidationErrors,
  async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    try {
      const rows = await sql`SELECT * FROM users WHERE email = ${email}`;
      if (rows.length === 0) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const userRecord = rows[0];
      const match = await bcrypt.compare(password, userRecord.password);
      if (!match) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const tokens = sessionManager.createSessionTokens(
        userRecord.id,
        userRecord.email,
      );
      res.cookie("accessToken", tokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 15 * 60 * 1000,
        path: "/",
      });

      const user = {
        email: userRecord.email,
        name: userRecord.name,
        bio: userRecord.bio,
        profile_photo: userRecord.profile_photo || "",
        preferences: JSON.parse(userRecord.preferences),
        bookmarks: JSON.parse(userRecord.bookmarks || "[]"),
        location: userRecord.location || "",
      };

      res.json({ user });
    } catch (err: any) {
      logger.error("Login error", { error: err.message });
      res
        .status(500)
        .json({ error: "An internal error occurred during login" });
    }
  },
);

app.post(
  "/api/user/update",
  requireAuth,
  csrfProtection,
  userUpdateValidators,
  handleValidationErrors,
  async (req: any, res: any) => {
    const { email, bio, profile_photo, preferences, bookmarks, location } =
      req.body;
    if (req.user?.email !== email) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    try {
      await sql`
      UPDATE users 
      SET bio = ${bio || ""}, 
          profile_photo = ${profile_photo || ""}, 
          preferences = ${JSON.stringify(preferences || { genres: [], dietary: [], interests: [] })}, 
          bookmarks = ${JSON.stringify(bookmarks || [])},
          location = ${location || ""}
      WHERE email = ${email}
    `;

      const rows = await sql`SELECT * FROM users WHERE email = ${email}`;
      if (rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const userRecord = rows[0];
      const user = {
        email: userRecord.email,
        name: userRecord.name,
        bio: userRecord.bio,
        profile_photo: userRecord.profile_photo || "",
        preferences: JSON.parse(userRecord.preferences),
        bookmarks: JSON.parse(userRecord.bookmarks || "[]"),
        location: userRecord.location || "",
      };

      res.json({ user });
    } catch (err: any) {
      logger.error("Update error", { error: err.message });
      res
        .status(500)
        .json({ error: "An internal error occurred during update" });
    }
  },
);

// OAuth credentials will be read inside handlers

app.get("/api/auth/google/url", (req, res) => {
  const origin = (req.query.origin as string) || "*";
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();

  if (!clientId) {
    logger.error("[Auth] GOOGLE_CLIENT_ID is missing in environment");
    return res
      .status(500)
      .json({ error: "Google Client ID not configured on server" });
  }

  const redirectUri =
    origin === "*"
      ? `${req.protocol}://${req.get("host")}/api/auth/google/callback`
      : `${origin.replace(/\/$/, "")}/api/auth/google/callback`;
  const state = Buffer.from(JSON.stringify({ origin })).toString("base64");
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=email profile&state=${state}`;

  res.json({ url });
});

app.get("/api/auth/google/callback", async (req, res) => {
  const code = req.query.code as string;
  const error = req.query.error as string;
  const state = req.query.state as string;
  let origin = originConfig.defaultOrigin;
  try {
    if (state)
      origin = originValidator.sanitize(
        JSON.parse(Buffer.from(state, "base64").toString("utf8")).origin,
      );
  } catch (e) {}

  if (error) {
    return res.send(
      `<script>window.opener.postMessage({ type: 'OAUTH_CANCELLED' }, "${origin}");window.close();</script>`,
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  const redirectUri =
    origin === "*"
      ? `${req.protocol}://${req.get("host")}/api/auth/google/callback`
      : `${origin.replace(/\/$/, "")}/api/auth/google/callback`;

  try {
    const tokenRes = await axios.post(
      "https://oauth2.googleapis.com/token",
      {
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      },
      {
        headers: { "User-Agent": "node.js" },
      },
    );
    const access_token = tokenRes.data.access_token;
    if (!access_token) throw new Error("No access token received from Google");

    const userRes = await axios.get(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "User-Agent": "node.js",
        },
      },
    );
    const { email, name, picture } = userRes.data;

    if (!email) throw new Error("No email received from Google");

    let rows = await sql`SELECT * FROM users WHERE email = ${email}`;
    if (rows.length === 0) {
      await sql`INSERT INTO users (email, password, name, bio, profile_photo) VALUES (${email}, 'oauth-user', ${name || "Google User"}, 'Logged in with Google.', ${picture || ""})`;
      rows = await sql`SELECT * FROM users WHERE email = ${email}`;
    }

    const userRecord = rows[0];
    const user = {
      email: userRecord.email,
      name: userRecord.name,
      bio: userRecord.bio,
      profile_photo: userRecord.profile_photo || "",
      preferences: JSON.parse(userRecord.preferences),
      bookmarks: JSON.parse(userRecord.bookmarks || "[]"),
      location: userRecord.location || "",
    };
    const safeUser = JSON.stringify(user).replace(/</g, "\\u003c");
    res.send(
      `<script>window.opener.postMessage({ type: 'OAUTH_SUCCESS', user: ${safeUser} }, "${origin}");window.close();</script>`,
    );
  } catch (err: any) {
    logger.error("Google OAuth Error", {
      error: err.response?.data || err.message,
    });
    res.send(
      `<script>window.opener.postMessage({ type: 'OAUTH_ERROR', error: "Google Authentication Failed" }, "${origin}");window.close();</script>`,
    );
  }
});

app.get("/api/auth/github/url", (req, res) => {
  const origin = (req.query.origin as string) || "*";
  const clientId = process.env.GITHUB_CLIENT_ID?.trim();

  if (!clientId) {
    logger.error("[Auth] GITHUB_CLIENT_ID is missing in environment");
    return res
      .status(500)
      .json({ error: "GitHub Client ID not configured on server" });
  }

  const redirectUri =
    origin === "*"
      ? `${req.protocol}://${req.get("host")}/api/auth/github/callback`
      : `${origin.replace(/\/$/, "")}/api/auth/github/callback`;
  const state = Buffer.from(JSON.stringify({ origin })).toString("base64");
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email&state=${state}`;

  res.json({ url });
});

app.get("/api/auth/github/callback", async (req, res) => {
  const code = req.query.code as string;
  const error = req.query.error as string;
  const state = req.query.state as string;
  let origin = originConfig.defaultOrigin;
  try {
    if (state)
      origin = originValidator.sanitize(
        JSON.parse(Buffer.from(state, "base64").toString("utf8")).origin,
      );
  } catch (e) {}

  if (error) {
    return res.send(
      `<script>window.opener.postMessage({ type: 'OAUTH_CANCELLED' }, "${origin}");window.close();</script>`,
    );
  }

  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();

  try {
    const tokenRes = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: clientId,
        client_secret: clientSecret,
        code,
      },
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "node.js",
        },
      },
    );

    const access_token = tokenRes.data.access_token;
    if (!access_token) {
      throw new Error(
        tokenRes.data.error_description ||
          tokenRes.data.error ||
          "No access token received from GitHub",
      );
    }

    const userRes = await axios.get("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${access_token}`,
        "User-Agent": "node.js",
      },
    });
    const emailRes = await axios.get("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${access_token}`,
        "User-Agent": "node.js",
      },
    });

    const primaryEmail =
      emailRes.data.find((e: any) => e.primary)?.email ||
      emailRes.data[0]?.email;
    const name = userRes.data.name || userRes.data.login || "GitHub User";
    const avatar = userRes.data.avatar_url || "";

    if (!primaryEmail)
      throw new Error("No GitHub email found associated with this account");

    let rows = await sql`SELECT * FROM users WHERE email = ${primaryEmail}`;
    if (rows.length === 0) {
      await sql`INSERT INTO users (email, password, name, bio, profile_photo) VALUES (${primaryEmail}, 'oauth-user', ${name}, 'Logged in with GitHub.', ${avatar})`;
      rows = await sql`SELECT * FROM users WHERE email = ${primaryEmail}`;
    }

    const userRecord = rows[0];
    const user = {
      email: userRecord.email,
      name: userRecord.name,
      bio: userRecord.bio,
      profile_photo: userRecord.profile_photo || "",
      preferences: JSON.parse(userRecord.preferences),
      bookmarks: JSON.parse(userRecord.bookmarks || "[]"),
      location: userRecord.location || "",
    };
    const safeUser = JSON.stringify(user).replace(/</g, "\\u003c");
    res.send(
      `<script>window.opener.postMessage({ type: 'OAUTH_SUCCESS', user: ${safeUser} }, "${origin}");window.close();</script>`,
    );
  } catch (err: any) {
    logger.error("GitHub OAuth Error", {
      error: err.response?.data || err.message,
    });
    res.send(
      `<script>window.opener.postMessage({ type: 'OAUTH_ERROR', error: "GitHub Authentication Failed" }, "${origin}");window.close();</script>`,
    );
  }
});

// Error handling middleware including CSRF
app.use(csrfErrorHandler);
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    logger.error("Unhandled server error", {
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: "Internal server error" });
  },
);

export default app;
