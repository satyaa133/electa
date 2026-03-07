import express from "express";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import axios from "axios";
import { neon } from "@neondatabase/serverless";
import { GoogleGenAI } from "@google/genai";

dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL || '');

const app = express();
app.use(express.json({ limit: '50mb' }));

// Database initialization
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
        bookmarks TEXT DEFAULT '[]'
      )
    `;
        console.log("Database initialized successfully.");
    } catch (error) {
        console.error("Failed to initialize database:", error);
    }
}

// Ensure the DB table exists
initDB();

app.post('/api/auth/signup', async (req, res) => {
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
        await sql`INSERT INTO users (email, password, name) VALUES (${email}, ${hash}, ${name})`;

        const user = {
            email,
            name,
            bio: '',
            profile_photo: '',
            preferences: { genres: [], dietary: [], interests: [] },
            bookmarks: []
        };

        res.json({ user });
    } catch (err: any) {
        console.error("Signup error:", err);
        res.status(500).json({ error: "Detailed internal error" });
    }
});

app.post('/api/auth/login', async (req, res) => {
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

        const user = {
            email: userRecord.email,
            name: userRecord.name,
            bio: userRecord.bio,
            profile_photo: userRecord.profile_photo || '',
            preferences: JSON.parse(userRecord.preferences),
            bookmarks: JSON.parse(userRecord.bookmarks || '[]')
        };

        res.json({ user });
    } catch (err: any) {
        console.error("Login error:", err);
        res.status(500).json({ error: "Detailed internal error" });
    }
});

app.post('/api/user/update', async (req, res) => {
    const { email, bio, profile_photo, preferences, bookmarks } = req.body;
    if (!email) {
        return res.status(400).json({ error: "Email is required" });
    }

    try {
        await sql`
      UPDATE users 
      SET bio = ${bio || ''}, 
          profile_photo = ${profile_photo || ''}, 
          preferences = ${JSON.stringify(preferences || { genres: [], dietary: [], interests: [] })}, 
          bookmarks = ${JSON.stringify(bookmarks || '[]')} 
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
            profile_photo: userRecord.profile_photo || '',
            preferences: JSON.parse(userRecord.preferences),
            bookmarks: JSON.parse(userRecord.bookmarks || '[]')
        };

        res.json({ user });
    } catch (err: any) {
        console.error("Update error:", err);
        res.status(500).json({ error: "Detailed internal error" });
    }
});

// Gemini AI Recommendations Proxy
app.post('/api/recommendations', async (req, res) => {
    const { mood, category, preferences, history, location } = req.body;

    const apiKey = process.env.GEMINI_API_KEY || "";
    if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is missing from server." });
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `
            User Mood: ${mood}
            Category: ${category}
            Preferences: ${(preferences || []).join(", ")}
            Recent History: ${(history || []).join(", ")}
            User Location: ${location || "Unknown"}

            Act as a precise recommendation engine. Recommend exactly 12 items in the ${category} category based on mood: ${mood}.
            
            CRITICAL VARIETY INSTRUCTION:
            Ensure HIGHLY UNIQUE, less obvious, and varied results for every single request. DO NOT just recommend the most popular or mainstream items. Provide a mix of hidden gems, unexpected concepts, and highly specific niche items. Every time a user asks, give them COMPLETELY DIFFERENT results from the ones before.
            Random seed to enforce uniqueness: ${Math.random()}
            
            CRITICAL LOCATION INSTRUCTION: 
            User coordinates: ${location || "major city"}.
            If category='restaurants', recommend ONLY REAL places AT THIS LOCATION. 
            
            CRITICAL IMAGE INSTRUCTION:
            You MUST provide a REAL, WORKING direct image URL for each item in the "imageUrl" field. 
            The image must be the exact official item (e.g. the official movie poster, exact book cover, or photograph).
            - EXTREMELY IMPORTANT FOR PERFORMANCE: You MUST use low-resolution, compressed, or thumbnail size URLs to ensure lightning-fast loading! 
            - For TMDB/IMDB images, use "w500" or "w300" in the path, NEVER "original".
            - For Wikipedia/Wikimedia, use the scaled thumbnail URLs (e.g., upload.wikimedia.org/.../thumb/.../300px-...).
            - DO NOT EVER use massive high-resolution images or placeholder URLs. If you know the item, you know its thumbnail URL.
            - DO NOT EVER use placeholder URLs or random image generators for "imageUrl". If you know the item, you know its image URL.

            Format: Raw JSON array of exactly 12 objects. NO markdown.
            [
            {
                "id": "item1",
                "title": "...",
                "description": "1 sentence max",
                "category": "...",
                "reason": "1 short sentence max",
                "details": {
                "rating": "...",
                "year": "...",
                "address": "...",
                "tags": ["..."],
                "link": "..."
                }
            }
            ]
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { responseMimeType: "application/json" },
        });

        const text = response.text || "";
        if (!text) return res.json({ recommendations: [] });

        let rawRecs = [];
        try {
            const match = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
            if (match) {
                rawRecs = JSON.parse(match[0]);
            } else {
                return res.json({ recommendations: [] });
            }
        } catch (e) {
            return res.json({ recommendations: [] });
        }

        const enrichedRecs = rawRecs.map((rec: any) => {
            let finalImageUrl = rec.details?.imageUrl || rec.imageUrl;
            if (!finalImageUrl || finalImageUrl.includes("example.com") || finalImageUrl.includes("placeholder")) {
                finalImageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(rec.title + ' ' + rec.category + ' official photo')}`;
            }
            return { ...rec, imageUrl: finalImageUrl };
        });

        res.json({ recommendations: enrichedRecs });

    } catch (error: any) {
        console.error("Gemini API error:", error);
        if (error.status === 429) {
            return res.status(429).json({ error: "RATE_LIMIT" });
        }
        res.status(500).json({ error: "Failed to generate recommendations" });
    }
});

// OAuth Endpoints
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

app.get('/api/auth/google/url', (req, res) => {
    const origin = req.query.origin as string || '*';
    const redirectUri = origin === '*' ? `${req.protocol}://${req.get('host')}/api/auth/google/callback` : `${origin}/api/auth/google/callback`;
    const state = Buffer.from(JSON.stringify({ origin })).toString('base64');

    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=email profile&state=${state}`;

    res.json({ url });
});

app.get('/api/auth/google/callback', async (req, res) => {
    const code = req.query.code as string;
    const error = req.query.error as string;
    const state = req.query.state as string;

    let origin = '*';
    try { if (state) origin = JSON.parse(Buffer.from(state, 'base64').toString('utf8')).origin; } catch (e) { }

    if (error) {
        return res.send(`
      <script>
        window.opener.postMessage({ type: 'OAUTH_CANCELLED' }, "${origin}");
        window.close();
      </script>
    `);
    }

    const redirectUri = origin === '*' ? `${req.protocol}://${req.get('host')}/api/auth/google/callback` : `${origin}/api/auth/google/callback`;

    try {
        const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri
        });

        const access_token = tokenRes.data.access_token;
        const userRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${access_token}` }
        });

        const { email, name, picture } = userRes.data;

        let rows = await sql`SELECT * FROM users WHERE email = ${email}`;
        if (rows.length === 0) {
            await sql`INSERT INTO users (email, password, name, bio, profile_photo) VALUES (${email}, 'oauth-user', ${name || 'Google User'}, 'Logged in with Google.', ${picture || ''})`;
            const newRows = await sql`SELECT * FROM users WHERE email = ${email}`;
            rows = newRows as any[];
        }

        const userRecord = rows[0];
        const user = {
            email: userRecord.email,
            name: userRecord.name,
            bio: userRecord.bio,
            profile_photo: userRecord.profile_photo || '',
            preferences: JSON.parse(userRecord.preferences),
            bookmarks: JSON.parse(userRecord.bookmarks || '[]')
        };

        res.send(`
      <script>
        window.opener.postMessage({ type: 'OAUTH_SUCCESS', user: ${JSON.stringify(user)} }, "${origin}");
        window.close();
      </script>
    `);
    } catch (err) {
        console.error("Google OAuth Error", err);
        res.send(`
      <script>
        window.opener.postMessage({ type: 'OAUTH_ERROR', error: 'Google Authentication Failed' }, "${origin}");
        window.close();
      </script>
    `);
    }
});

app.get('/api/auth/github/url', (req, res) => {
    const origin = req.query.origin as string || '*';
    const state = Buffer.from(JSON.stringify({ origin })).toString('base64');

    const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=user:email&state=${state}`;

    res.json({ url });
});

app.get('/api/auth/github/callback', async (req, res) => {
    const code = req.query.code as string;
    const error = req.query.error as string;
    const state = req.query.state as string;

    let origin = '*';
    try { if (state) origin = JSON.parse(Buffer.from(state, 'base64').toString('utf8')).origin; } catch (e) { }

    if (error) {
        return res.send(`
      <script>
        window.opener.postMessage({ type: 'OAUTH_CANCELLED' }, "${origin}");
        window.close();
      </script>
    `);
    }

    try {
        const tokenRes = await axios.post('https://github.com/login/oauth/access_token', {
            client_id: GITHUB_CLIENT_ID,
            client_secret: GITHUB_CLIENT_SECRET,
            code
        }, { headers: { Accept: 'application/json' } });

        const access_token = tokenRes.data.access_token;

        const userRes = await axios.get('https://api.github.com/user', {
            headers: { Authorization: `Bearer ${access_token}` }
        });

        const emailRes = await axios.get('https://api.github.com/user/emails', {
            headers: { Authorization: `Bearer ${access_token}` }
        });

        const primaryEmail = emailRes.data.find((e: any) => e.primary)?.email || emailRes.data[0]?.email;
        const name = userRes.data.name || userRes.data.login || 'GitHub User';
        const avatar = userRes.data.avatar_url || '';

        if (!primaryEmail) throw new Error("No GitHub email found");

        let rows = await sql`SELECT * FROM users WHERE email = ${primaryEmail}`;
        if (rows.length === 0) {
            await sql`INSERT INTO users (email, password, name, bio, profile_photo) VALUES (${primaryEmail}, 'oauth-user', ${name}, 'Logged in with GitHub.', ${avatar})`;
            const newRows = await sql`SELECT * FROM users WHERE email = ${primaryEmail}`;
            rows = newRows as any[];
        }

        const userRecord = rows[0];
        const user = {
            email: userRecord.email,
            name: userRecord.name,
            bio: userRecord.bio,
            profile_photo: userRecord.profile_photo || '',
            preferences: JSON.parse(userRecord.preferences),
            bookmarks: JSON.parse(userRecord.bookmarks || '[]')
        };

        res.send(`
      <script>
        window.opener.postMessage({ type: 'OAUTH_SUCCESS', user: ${JSON.stringify(user)} }, "${origin}");
        window.close();
      </script>
    `);
    } catch (err) {
        console.error("GitHub OAuth Error", err);
        res.send(`
      <script>
        window.opener.postMessage({ type: 'OAUTH_ERROR', error: 'GitHub Authentication Failed' }, "${origin}");
        window.close();
      </script>
    `);
    }
});

// Vercel serverless functions require the app to be exported
export default app;
