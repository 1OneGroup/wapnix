import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

router.get('/stats', (req, res) => {
  const userId = req.user.id;
  const today = new Date().toISOString().slice(0, 10);

  const contacts = db.prepare('SELECT COUNT(*) as cnt FROM contacts WHERE user_id = ?').get(userId).cnt;
  const templates = db.prepare('SELECT COUNT(*) as cnt FROM templates WHERE user_id = ?').get(userId).cnt;
  const groups = db.prepare('SELECT COUNT(*) as cnt FROM contact_groups WHERE user_id = ?').get(userId).cnt;

  const todayUsage = db.prepare(
    'SELECT messages_sent FROM daily_usage WHERE user_id = ? AND date = ?'
  ).get(userId, today);

  const totalSent = db.prepare(
    "SELECT COUNT(*) as cnt FROM messages WHERE user_id = ? AND status = 'sent'"
  ).get(userId).cnt;

  const totalFailed = db.prepare(
    "SELECT COUNT(*) as cnt FROM messages WHERE user_id = ? AND status = 'failed'"
  ).get(userId).cnt;

  // Last 7 days usage - fill all 7 days with 0 for missing dates
  const dailyStatsRaw = db.prepare(
    'SELECT date, messages_sent FROM daily_usage WHERE user_id = ? AND date >= date(?, \'-6 days\') ORDER BY date'
  ).all(userId, today);
  const dailyMap = Object.fromEntries(dailyStatsRaw.map(d => [d.date, d.messages_sent]));
  const dailyStats = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    dailyStats.push({ date: ds, messages_sent: dailyMap[ds] || 0 });
  }

  // Recent messages
  const recentMessages = db.prepare(
    'SELECT phone, body, status, sent_at, created_at FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 10'
  ).all(userId);

  res.json({
    contacts,
    templates,
    groups,
    today_sent: todayUsage?.messages_sent || 0,
    daily_limit: req.user.daily_limit,
    max_contacts: req.user.max_contacts,
    max_templates: req.user.max_templates,
    total_sent: totalSent,
    total_failed: totalFailed,
    daily_stats: dailyStats,
    recent_messages: recentMessages,
    plan: req.user.plan_name,
  });
});

export default router;
