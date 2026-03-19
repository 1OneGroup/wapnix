import db from '../db/database.js';

/**
 * Middleware that checks daily message limit based on user's plan.
 * Sets req.dailyUsed and req.dailyRemaining.
 * Returns 429 if limit exceeded. Superadmins bypass limits.
 */
export function checkDailyLimit(req, res, next) {
  const user = req.user;

  // Super admin has no message limits
  if (user.is_superadmin) {
    req.dailyUsed = 0;
    req.dailyRemaining = Infinity;
    return next();
  }

  const today = new Date().toISOString().slice(0, 10);

  const usage = db.prepare(
    'SELECT messages_sent FROM daily_usage WHERE user_id = ? AND date = ?'
  ).get(user.id, today);

  const sent = usage?.messages_sent || 0;

  if (sent >= user.daily_limit) {
    return res.status(429).json({
      error: 'Daily message limit reached',
      limit: user.daily_limit,
      used: sent,
      plan: user.plan_name,
    });
  }

  req.dailyUsed = sent;
  req.dailyRemaining = user.daily_limit - sent;
  next();
}

/**
 * Increment the daily message usage counter for a user.
 * Uses INSERT ... ON CONFLICT DO UPDATE for upsert.
 * @param {number} userId
 * @param {number} [count=1] - Number of messages to add
 */
export function incrementDailyUsage(userId, count = 1) {
  const today = new Date().toISOString().slice(0, 10);
  db.prepare(
    'INSERT INTO daily_usage (user_id, date, messages_sent) VALUES (?, ?, ?) ON CONFLICT(user_id, date) DO UPDATE SET messages_sent = messages_sent + ?'
  ).run(userId, today, count, count);
}
