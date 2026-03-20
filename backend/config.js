import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  port: parseInt(process.env.PORT || '4000'),
  jwtSecret: process.env.JWT_SECRET || 'whatsapp-business-plan-secret-key-change-in-production',
  jwtExpiresIn: '7d',
  dbPath: path.join(__dirname, 'data', 'app.db'),
  authSessionsDir: path.join(__dirname, 'data', 'auth_sessions'),
  cors: {
    origin: process.env.CORS_ORIGIN || [
      'http://localhost:5173',
      'http://192.168.31.239:5173',
      /\.ngrok-free\.app$/,
      /\.ngrok\.io$/,
    ],
  },
};
