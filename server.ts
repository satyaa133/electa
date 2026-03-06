import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import bcrypt from "bcrypt";
import fs from "fs";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB
const dbFile = path.join(__dirname, "database.db");
const db = new Database(dbFile);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    bio TEXT DEFAULT '',
    preferences TEXT DEFAULT '{"genres":[],"dietary":[],"interests":[]}'
  )
`);

// Defensive schema additions for new features
try {
  db.exec(`ALTER TABLE users ADD COLUMN profile_photo TEXT DEFAULT '';`);
} catch (err: any) {
  // Column likely already exists
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN bookmarks TEXT DEFAULT '[]';`);
} catch (err: any) {
  // Column likely already exists
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- Auth APIs ---

  app.post('/api/auth/signup', async (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: "All fields are required" });
    }

    try {
      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existing) {
        return res.status(400).json({ error: "User already exists" });
      }

      const hash = await bcrypt.hash(password, 10);
      const stmt = db.prepare('INSERT INTO users (email, password, name) VALUES (?, ?, ?)');
      stmt.run(email, hash, name);

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
      res.status(500).json({ error: "Detailed internal error" });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    try {
      const userRecord: any = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (!userRecord) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

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
      res.status(500).json({ error: "Detailed internal error" });
    }
  });

  app.post('/api/user/update', (req, res) => {
    const { email, bio, profile_photo, preferences, bookmarks } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    try {
      const stmt = db.prepare('UPDATE users SET bio = ?, profile_photo = ?, preferences = ?, bookmarks = ? WHERE email = ?');
      stmt.run(
        bio || '',
        profile_photo || '',
        JSON.stringify(preferences || { genres: [], dietary: [], interests: [] }),
        JSON.stringify(bookmarks || []),
        email
      );

      const userRecord: any = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (!userRecord) {
        return res.status(404).json({ error: "User not found" });
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
      res.status(500).json({ error: "Detailed internal error" });
    }
  });

  // --- Real OAuth APIs ---
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
  const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

  app.get('/api/auth/google/url', (req, res) => {
    const origin = req.query.origin as string || '*';
    const redirectUri = origin === '*' ? `${req.protocol}://${req.get('host')}/api/auth/google/callback` : `${origin}/api/auth/google/callback`;
    const state = Buffer.from(JSON.stringify({ origin })).toString('base64');

    const url = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${GOOGLE_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent('email profile')}` +
      `&state=${state}`;

    res.json({ url });
  });

  app.get('/api/auth/google/callback', async (req, res) => {
    const code = req.query.code as string;
    const state = req.query.state as string;

    let origin = '*';
    try { if (state) origin = JSON.parse(Buffer.from(state, 'base64').toString('utf8')).origin; } catch (e) { }

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

      const { email, name } = userRes.data;

      let userRecord: any = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (!userRecord) {
        const stmt = db.prepare('INSERT INTO users (email, password, name, bio, profile_photo) VALUES (?, ?, ?, ?, ?)');
        stmt.run(email, 'oauth-user', name || 'Google User', 'Logged in with Google.', userRes.data.picture || '');
        userRecord = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      }

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

    const url = `https://github.com/login/oauth/authorize?` +
      `client_id=${GITHUB_CLIENT_ID}` +
      `&scope=user:email` +
      `&state=${state}`;

    res.json({ url });
  });

  app.get('/api/auth/github/callback', async (req, res) => {
    const code = req.query.code as string;
    const state = req.query.state as string;

    let origin = '*';
    try { if (state) origin = JSON.parse(Buffer.from(state, 'base64').toString('utf8')).origin; } catch (e) { }

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

      if (!primaryEmail) throw new Error("No GitHub email found");

      let userRecord: any = db.prepare('SELECT * FROM users WHERE email = ?').get(primaryEmail);
      if (!userRecord) {
        const stmt = db.prepare('INSERT INTO users (email, password, name, bio, profile_photo) VALUES (?, ?, ?, ?, ?)');
        stmt.run(primaryEmail, 'oauth-user', name, 'Logged in with GitHub.', userRes.data.avatar_url || '');
        userRecord = db.prepare('SELECT * FROM users WHERE email = ?').get(primaryEmail);
      }

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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting Vite in middleware mode...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving static production build...");
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
