import express from "express";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import axios from "axios";
import { neon } from "@neondatabase/serverless";

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
