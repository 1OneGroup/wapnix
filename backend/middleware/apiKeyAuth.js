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

  const user = db.prepare(
    'SELECT u.*, p.name as plan_name, p.daily_limit, p.monthly_limit, p.max_contacts, p.max_templates, p.rate_per_minute, p.rate_per_hour FROM users u JOIN plans p ON u.plan_id = p.id WHERE u.api_key = ? AND u.is_active = 1'
  ).get(apiKey);

  if (!user) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  if (!user.is_approved && !user.is_superadmin) {
    return res.status(403).json({ error: 'Account not approved' });
  }

  req.user = user;
  next();
}
