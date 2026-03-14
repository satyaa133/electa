import express from 'express';
import dotenv from 'dotenv';
import recommendationsHandler from './api/recommendations.ts';
import askHandler from './api/ask.ts';
import indexHandler from './api/index.ts';

dotenv.config({ path: '.env.local' });

const app = express();
// Enable body parsing for all requests
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Map Vercel handlers directly
app.post('/api/recommendations', (req, res) => recommendationsHandler(req, res));
app.post('/api/ask', (req, res) => askHandler(req, res));

// Mount index.ts (Express app)
app.use('/api', indexHandler);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Custom Dev Server running on http://localhost:${PORT}`);
});
