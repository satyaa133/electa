import express from "express";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import axios from "axios";
import { neon } from "@neondatabase/serverless";
import { GoogleGenAI } from "@google/genai";

dotenv.config({ path: '.env.local' });

const sql = (strings: TemplateStringsArray, ...values: any[]) => {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) {
        console.error("❌ Neon Database URL missing.");
        throw new Error("Neon Database URL missing.");
    }
    return neon(url)(strings, ...values);
};

const app = express();

app.use((req, res, next) => {
    if (req.body) {
        next();
    } else {
        express.json({ limit: '50mb' })(req, res, next);
    }
});

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
        try {
            await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS location TEXT DEFAULT ''`;
        } catch (e) { }
        console.log("Database initialized successfully.");
    } catch (error) {
        console.error("Failed to initialize database:", error);
    }
}

if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
    initDB();
} else {
    console.warn("⚠️ skipping initDB: Database URL missing.");
}

// --- API Handlers ---

app.get('/api/location', async (req, res) => {
    const forwarded = req.headers['x-forwarded-for'];
    const clientIp = typeof forwarded === 'string' ? forwarded.split(',')[0] : (req.socket?.remoteAddress || req.ip || '');
    
    console.log(`[Location Service] Client IP identified: ${clientIp}`);

    try {
        // Try ipapi.co
        try {
            const url = clientIp && clientIp !== '::1' && clientIp !== '127.0.0.1' 
                ? `https://ipapi.co/${clientIp}/json/` 
                : 'https://ipapi.co/json/';
                
            const resp = await axios.get(url, { 
                timeout: 5000,
                headers: { 'User-Agent': 'node.js' }
            });
            if (resp.data && resp.data.city) {
                const loc = resp.data.region ? `${resp.data.city}, ${resp.data.region}` : resp.data.city;
                return res.json({ location: loc, source: 'ipapi.co', ip: clientIp });
            }
        } catch (e: any) {
            console.warn(`[Location Service] ipapi.co failed: ${e.message}`);
        }

        // Fallback to ip-api.com
        const url2 = clientIp && clientIp !== '::1' && clientIp !== '127.0.0.1'
            ? `http://ip-api.com/json/${clientIp}`
            : 'http://ip-api.com/json/';

        const resp2 = await axios.get(url2, { timeout: 5000 });
        if (resp2.data && resp2.data.city) {
            const loc = resp2.data.regionName ? `${resp2.data.city}, ${resp2.data.regionName}` : resp2.data.city;
            return res.json({ location: loc, source: 'ip-api.com', ip: clientIp });
        }
        
        res.status(404).json({ error: "Location could not be determined from IP.", ip: clientIp });
    } catch (err: any) {
        console.error("Location fetch failed:", err);
        res.status(500).json({ error: "Failed to fetch location", details: err.message });
    }
});

app.post('/api/recommendations', async (req, res) => {
    try {
        const { mood, category, preferences, history, location, userHour } = req.body || {};
        const apiKey = process.env.GEMINI_API_KEY;
        
        if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY missing" });

        let weather = "Clear";
        let timeOfDay = "Day";
        const hour = (userHour !== undefined && userHour !== null) ? userHour : new Date().getHours();

        if (hour >= 5 && hour < 12) timeOfDay = "Morning";
        else if (hour >= 12 && hour < 17) timeOfDay = "Afternoon";
        else if (hour >= 17 && hour < 21) timeOfDay = "Evening";
        else timeOfDay = "Late Night";

        try {
            const weatherRes = await axios.get(`https://wttr.in/${encodeURIComponent(location || "London")}?format=%C`, { timeout: 3000 });
            weather = weatherRes.data || "Clear";
        } catch (e) { }

        const ai = new GoogleGenAI({ apiKey });
        const prompt = `
            Recommend 12 ${category} based on:
            Mood: ${mood}, Location: ${location || "Unknown"}, Time: ${timeOfDay}, Weather: ${weather}
            Preferences: ${(preferences || []).join(", ")}
            
            RULES:
            - If it's Morning, suggest breakfast/coffee. 
            - If Evening/Night, suggest bars/dinner.
            - If Raining/Stormy, suggest indoor activities.
            - CONCISENESS: Keep titles under 30 chars, descriptions under 100 chars, and each tag under 12 chars.
            
            Format: Raw JSON array of 12 objects with: id, title, description, category, reason, details (rating, year, address, tags[], link).
            NO markdown, NO extra text.
        `;

        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { responseMimeType: "application/json", temperature: 0.7 }
        });

        const text = result.text || "[]";
        let recommendations = JSON.parse(text.match(/\[\s*\{[\s\S]*\}\s*\]/)?.[0] || text);

        if (Array.isArray(recommendations)) {
            recommendations = recommendations.map((r: any, idx: number) => {
                const slug = r.title ? r.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'rec';
                return { ...r, id: `${category}-${slug}-${idx}` }; // idx added for uniqueness within a single response
            });
        }

        res.json({ recommendations: Array.isArray(recommendations) ? recommendations : [], context: { weather, timeOfDay } });
    } catch (err: any) {
        console.error("Rec API error:", err);
        res.status(err.status || 500).json({ error: "Gemini API failure", details: err.message });
    }
});

app.post('/api/ask', async (req, res) => {
    try {
        const { recommendation, question, chatHistory } = req.body || {};
        if (!recommendation || !question) return res.status(400).json({ error: "Missing data" });

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY missing" });

        const ai = new GoogleGenAI({ apiKey });
        const historyContext = (chatHistory || []).map((msg: any) => `${msg.role === 'user' ? 'User' : 'Electa'}: ${msg.content}`).join("\n");

        const context = `
            Context: Recommendation for ${recommendation.title}. 
            Details: ${JSON.stringify(recommendation.details)}
            User Question: ${question}
            Prev History: ${historyContext}
            Answer as Electa, concise and helpful. Add external links ONLY if truly needed.
        `;

        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash", 
            contents: context,
            config: { temperature: 0.7, maxOutputTokens: 1024 }
        });

        res.json({ answer: result.text || "No response", timestamp: new Date().toISOString() });
    } catch (err: any) {
        console.error("Ask API error:", err);
        res.status(err.status || 500).json({ error: "AI Handler failed", details: err.message });
    }
});

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
            bookmarks: [],
            location: ''
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
            bookmarks: JSON.parse(userRecord.bookmarks || '[]'),
            location: userRecord.location || ''
        };

        res.json({ user });
    } catch (err: any) {
        console.error("Login error:", err);
        res.status(500).json({ error: "Detailed internal error" });
    }
});

app.post('/api/user/update', async (req, res) => {
    const { email, bio, profile_photo, preferences, bookmarks, location } = req.body;
    if (!email) {
        return res.status(400).json({ error: "Email is required" });
    }

    try {
        await sql`
      UPDATE users 
      SET bio = ${bio || ''}, 
          profile_photo = ${profile_photo || ''}, 
          preferences = ${JSON.stringify(preferences || { genres: [], dietary: [], interests: [] })}, 
          bookmarks = ${JSON.stringify(bookmarks || [])},
          location = ${location || ''}
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
            bookmarks: JSON.parse(userRecord.bookmarks || '[]'),
            location: userRecord.location || ''
        };

        res.json({ user });
    } catch (err: any) {
        console.error("Update error:", err);
        res.status(500).json({ 
            error: "Detailed internal error during update",
            details: err.message || "Unknown error"
        });
    }
});

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
        return res.send(`<script>window.opener.postMessage({ type: 'OAUTH_CANCELLED' }, "${origin}");window.close();</script>`);
    }

    const redirectUri = origin === '*' ? `${req.protocol}://${req.get('host')}/api/auth/google/callback` : `${origin}/api/auth/google/callback`;

    try {
        const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
            client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, code, grant_type: 'authorization_code', redirect_uri: redirectUri
        });
        const access_token = tokenRes.data.access_token;
        const userRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${access_token}` } });
        const { email, name, picture } = userRes.data;

        let rows = await sql`SELECT * FROM users WHERE email = ${email}`;
        if (rows.length === 0) {
            await sql`INSERT INTO users (email, password, name, bio, profile_photo) VALUES (${email}, 'oauth-user', ${name || 'Google User'}, 'Logged in with Google.', ${picture || ''})`;
            rows = await sql`SELECT * FROM users WHERE email = ${email}`;
        }

        const userRecord = rows[0];
        const user = {
            email: userRecord.email, name: userRecord.name, bio: userRecord.bio, profile_photo: userRecord.profile_photo || '',
            preferences: JSON.parse(userRecord.preferences), bookmarks: JSON.parse(userRecord.bookmarks || '[]'),
            location: userRecord.location || ''
        };
        res.send(`<script>window.opener.postMessage({ type: 'OAUTH_SUCCESS', user: ${JSON.stringify(user)} }, "${origin}");window.close();</script>`);
    } catch (err) {
        console.error("Google OAuth Error", err);
        res.send(`<script>window.opener.postMessage({ type: 'OAUTH_ERROR', error: 'Google Authentication Failed' }, "${origin}");window.close();</script>`);
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
        return res.send(`<script>window.opener.postMessage({ type: 'OAUTH_CANCELLED' }, "${origin}");window.close();</script>`);
    }

    try {
        const tokenRes = await axios.post('https://github.com/login/oauth/access_token', { client_id: GITHUB_CLIENT_ID, client_secret: GITHUB_CLIENT_SECRET, code }, { headers: { Accept: 'application/json' } });
        const access_token = tokenRes.data.access_token;
        const userRes = await axios.get('https://api.github.com/user', { headers: { Authorization: `Bearer ${access_token}` } });
        const emailRes = await axios.get('https://api.github.com/user/emails', { headers: { Authorization: `Bearer ${access_token}` } });
        const primaryEmail = emailRes.data.find((e: any) => e.primary)?.email || emailRes.data[0]?.email;
        const name = userRes.data.name || userRes.data.login || 'GitHub User';
        const avatar = userRes.data.avatar_url || '';

        if (!primaryEmail) throw new Error("No GitHub email found");

        let rows = await sql`SELECT * FROM users WHERE email = ${primaryEmail}`;
        if (rows.length === 0) {
            await sql`INSERT INTO users (email, password, name, bio, profile_photo) VALUES (${primaryEmail}, 'oauth-user', ${name}, 'Logged in with GitHub.', ${avatar})`;
            rows = await sql`SELECT * FROM users WHERE email = ${primaryEmail}`;
        }

        const userRecord = rows[0];
        const user = {
            email: userRecord.email, name: userRecord.name, bio: userRecord.bio, profile_photo: userRecord.profile_photo || '',
            preferences: JSON.parse(userRecord.preferences), bookmarks: JSON.parse(userRecord.bookmarks || '[]'),
            location: userRecord.location || ''
        };
        res.send(`<script>window.opener.postMessage({ type: 'OAUTH_SUCCESS', user: ${JSON.stringify(user)} }, "${origin}");window.close();</script>`);
    } catch (err) {
        console.error("GitHub OAuth Error", err);
        res.send(`<script>window.opener.postMessage({ type: 'OAUTH_ERROR', error: 'GitHub Authentication Failed' }, "${origin}");window.close();</script>`);
    }
});

export default app;
