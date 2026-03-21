import db from '../db/database.js';

/**
 * API key authentication middleware for external API (/api/v1/*).
 * Reads key from X-API-Key header or ?api_key query param.
 * Loads user + plan info from DB, attaches to req.user.
 * req.user includes: id, email, plan_name, daily_limit, monthly_limit,
 *   max_contacts, max_templates, rate_per_minute, rate_per_hour, is_approved, is_superadmin
 */
export function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;

  if (!apiKey) {
    return res.status(401).json({ error: 'API key required. Pass via X-API-Key header or api_key query param.' });
  }

  // First check if key exists (without is_active filter for better error messages)
  const keyCheck = db.prepare('SELECT id, is_active, is_approved, is_superadmin FROM users WHERE api_key = ?').get(apiKey);

  if (!keyCheck) {
    return res.status(401).json({ error: 'Invalid API key. Generate a new key from API Access page.' });
  }

  if (!keyCheck.is_active) {
    return res.status(403).json({ error: 'Account is deactivated. Contact admin.' });
  }

  if (!keyCheck.is_approved && !keyCheck.is_superadmin) {
    return res.status(403).json({ error: 'Account not approved. Contact admin.' });
  }

  const user = db.prepare(
    'SELECT u.*, p.name as plan_name, p.daily_limit, p.monthly_limit, p.max_contacts, p.max_templates, p.rate_per_minute, p.rate_per_hour FROM users u JOIN plans p ON u.plan_id = p.id WHERE u.id = ?'
  ).get(keyCheck.id);

  if (!user) {
    return res.status(500).json({ error: 'User plan configuration error. Contact admin.' });
  }

  req.user = user;
  next();
}
