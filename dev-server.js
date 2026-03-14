import express from 'express';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';
import recommendationsHandler from './api/recommendations.js';
import askHandler from './api/ask.js';
import indexHandler from './api/index.js';

dotenv.config({ path: '.env.local' });

const app = express();
app.use(express.json({ limit: '50mb' }));

// Middleware to mock Vercel response helper if needed
const vercelCompat = (handler) => (req, res) => {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.setHeader = (name, value) => {
    res.set(name, value);
    return res;
  };
  return handler(req, res);
};

app.post('/api/recommendations', vercelCompat(recommendationsHandler));
app.post('/api/ask', vercelCompat(askHandler));

// For index.ts which is already an express app
app.use('/api/auth', (req, res, next) => {
  req.url = '/auth' + req.url;
  indexHandler(req, res, next);
});
app.use('/api/user', (req, res, next) => {
  req.url = '/user' + req.url;
  indexHandler(req, res, next);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Custom Dev Server running on http://localhost:${PORT}`);
});
