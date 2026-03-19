import jwt from 'jsonwebtoken';
import config from '../config.js';
import db from '../db/database.js';

/**
 * JWT authentication middleware.
 * Verifies Bearer token, loads user + plan info from DB, attaches to req.user.
 * req.user includes: id, email, name, plan_id, plan_name, daily_limit, monthly_limit,
 *   max_contacts, max_templates, is_approved, is_superadmin, allowed_pages (parsed JSON array)
 */
export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, config.jwtSecret);
    const user = db.prepare(
      'SELECT u.*, p.name as plan_name, p.daily_limit, p.monthly_limit, p.max_contacts, p.max_templates, p.rate_per_minute, p.rate_per_hour FROM users u JOIN plans p ON u.plan_id = p.id WHERE u.id = ? AND u.is_active = 1'
    ).get(payload.userId);

    if (!user) return res.status(401).json({ error: 'User not found or inactive' });

    // Parse allowed_pages from JSON
    user.allowed_pages = JSON.parse(user.allowed_pages || '[]');
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
