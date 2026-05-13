import app from './api/index.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`API Server running on http://localhost:${PORT}`);
});
