import Database from 'better-sqlite3';
import config from './config.js';

let db;

export function getDb() {
  if (!db) {
    db = new Database(config.dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

/**
 * Resolve the user ID from config (env vars).
 * Priority: WAPNIX_USER_ID > WAPNIX_API_KEY > WAPNIX_USER_EMAIL
 */
export function resolveUserId() {
  const database = getDb();

  if (config.userId > 0) return config.userId;

  if (config.apiKey) {
    const user = database.prepare('SELECT id FROM users WHERE api_key = ?').get(config.apiKey);
    if (user) return user.id;
  }

  if (config.userEmail) {
    const user = database.prepare('SELECT id FROM users WHERE email = ?').get(config.userEmail);
    if (user) return user.id;
  }

  // Fallback to first superadmin
  const admin = database.prepare('SELECT id FROM users WHERE is_superadmin = 1 LIMIT 1').get();
  if (admin) return admin.id;

  // Fallback to first user
  const first = database.prepare('SELECT id FROM users ORDER BY id LIMIT 1').get();
  return first?.id || 1;
}
