import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("database.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    name TEXT,
    bio TEXT,
    preferences TEXT
  )
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Auth Routes
  app.post("/api/auth/signup", (req, res) => {
    const { email, password, name } = req.body;
    try {
      const stmt = db.prepare("INSERT INTO users (email, password, name, bio, preferences) VALUES (?, ?, ?, ?, ?)");
      const info = stmt.run(email, password, name, "New user exploring Electa.", JSON.stringify({ genres: [], dietary: [], interests: [] }));
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
      res.json({ user: { ...user, preferences: JSON.parse(user.preferences as string) } });
    } catch (err) {
      res.status(400).json({ error: "Email already exists" });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ? AND password = ?").get(email, password) as any;
    if (user) {
      res.json({ user: { ...user, preferences: JSON.parse(user.preferences as string) } });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  // OAuth URL generation
  app.get("/api/auth/google/url", (req, res) => {
    const origin = req.query.origin as string;
    const redirectUri = `${origin}/api/auth/google/callback`;
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "select_account",
      state: origin // Pass origin in state
    });
    res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
  });

  app.get("/api/auth/github/url", (req, res) => {
    const origin = req.query.origin as string;
    const redirectUri = `${origin}/api/auth/github/callback`;
    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID || "",
      redirect_uri: redirectUri,
      scope: "user:email",
      prompt: "select_account",
      state: origin // Pass origin in state
    });
    res.json({ url: `https://github.com/login/oauth/authorize?${params.toString()}` });
  });

  // OAuth Callbacks
  app.get("/api/auth/google/callback", async (req, res) => {
    const { code, state } = req.query;
    const origin = (state as string) || `${req.protocol}://${req.get('host')}`;
    const redirectUri = `${origin}/api/auth/google/callback`;

    if (!code) {
      return res.send(`<html><body><script>window.opener.postMessage({ type: 'OAUTH_ERROR', error: 'No authorization code received' }, '*'); window.close();</script></body></html>`);
    }

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.send(`<html><body><script>window.opener.postMessage({ type: 'OAUTH_ERROR', error: 'Google OAuth keys not configured in environment' }, '*'); window.close();</script></body></html>`);
    }

    try {
      const tokenRes = await axios.post("https://oauth2.googleapis.com/token", {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      });

      const { access_token } = tokenRes.data;
      const userRes = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${access_token}` }
      });

      const { email, name, sub } = userRes.data;
      let user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;

      if (!user) {
        const stmt = db.prepare("INSERT INTO users (email, password, name, bio, preferences) VALUES (?, ?, ?, ?, ?)");
        const info = stmt.run(email, `oauth-${sub}`, name || email.split('@')[0], "New user exploring Electa.", JSON.stringify({ genres: [], dietary: [], interests: [] }));
        user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
      }

      const userData = { ...user, preferences: JSON.parse(user.preferences as string) };
      res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ type: 'OAUTH_SUCCESS', user: ${JSON.stringify(userData)} }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    } catch (err) {
      console.error("Google OAuth error:", err);
      res.send(`<html><body><script>window.opener.postMessage({ type: 'OAUTH_ERROR', error: 'Google authentication failed' }, '*'); window.close();</script></body></html>`);
    }
  });

  app.get("/api/auth/github/callback", async (req, res) => {
    const { code, state } = req.query;
    const origin = (state as string) || `${req.protocol}://${req.get('host')}`;

    if (!code) {
      return res.send(`<html><body><script>window.opener.postMessage({ type: 'OAUTH_ERROR', error: 'No authorization code received' }, '*'); window.close();</script></body></html>`);
    }

    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
      return res.send(`<html><body><script>window.opener.postMessage({ type: 'OAUTH_ERROR', error: 'GitHub OAuth keys not configured in environment' }, '*'); window.close();</script></body></html>`);
    }

    try {
      const tokenRes = await axios.post("https://github.com/login/oauth/access_token", {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code
      }, {
        headers: { Accept: "application/json" }
      });

      const { access_token } = tokenRes.data;
      const userRes = await axios.get("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${access_token}` }
      });

      const emailsRes = await axios.get("https://api.github.com/user/emails", {
        headers: { Authorization: `Bearer ${access_token}` }
      });

      const primaryEmail = emailsRes.data.find((e: any) => e.primary).email;
      const { name, id } = userRes.data;

      let user = db.prepare("SELECT * FROM users WHERE email = ?").get(primaryEmail) as any;

      if (!user) {
        const stmt = db.prepare("INSERT INTO users (email, password, name, bio, preferences) VALUES (?, ?, ?, ?, ?)");
        const info = stmt.run(primaryEmail, `oauth-${id}`, name || primaryEmail.split('@')[0], "New user exploring Electa.", JSON.stringify({ genres: [], dietary: [], interests: [] }));
        user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
      }

      const userData = { ...user, preferences: JSON.parse(user.preferences as string) };
      res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ type: 'OAUTH_SUCCESS', user: ${JSON.stringify(userData)} }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    } catch (err) {
      console.error("GitHub OAuth error:", err);
      res.send(`<html><body><script>window.opener.postMessage({ type: 'OAUTH_ERROR', error: 'GitHub authentication failed' }, '*'); window.close();</script></body></html>`);
    }
  });

  app.post("/api/user/update", (req, res) => {
    const { email, bio, preferences } = req.body;
    try {
      const stmt = db.prepare("UPDATE users SET bio = ?, preferences = ? WHERE email = ?");
      stmt.run(bio, JSON.stringify(preferences), email);
      const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
      res.json({ user: { ...user, preferences: JSON.parse(user.preferences as string) } });
    } catch (err) {
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
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
