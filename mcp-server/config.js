import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = {
  dbPath: process.env.WAPNIX_DB_PATH || path.join(__dirname, '..', 'backend', 'data', 'app.db'),
  apiKey: process.env.WAPNIX_API_KEY || '',
  userId: parseInt(process.env.WAPNIX_USER_ID || '0'),
  userEmail: process.env.WAPNIX_USER_EMAIL || '',
  serverUrl: process.env.WAPNIX_SERVER_URL || 'http://localhost:4000',
};

export default config;
