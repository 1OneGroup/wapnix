import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import config from '../config.js';
import db from '../db/database.js';

const router = Router();

// Middleware: only superadmins
function requireSuperAdmin(req, res, next) {
  if (!req.user.is_superadmin) {
    return res.status(403).json({ error: 'Superadmin access required' });
  }
  next();
}

router.use(requireSuperAdmin);

// All available pages
const ALL_PAGES = ['dashboard', 'device', 'templates', 'website', 'send', 'chatbot', 'scheduler', 'api'];

// List all users
router.get('/users', (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.email, u.name, u.is_active, u.is_approved, u.is_superadmin, u.allowed_pages, u.plan_id, u.created_at,
           u.api_key, u.token_name,
           p.name as plan_name, p.daily_limit, p.monthly_limit, p.max_contacts, p.max_templates, p.max_chatbots, p.monthly_price, p.yearly_price,
           s.status as session_status, s.whatsapp_number
    FROM users u
    JOIN plans p ON u.plan_id = p.id
    LEFT JOIN sessions s ON s.user_id = u.id
    ORDER BY u.created_at DESC
  `).all();

  users.forEach(u => {
    u.allowed_pages = JSON.parse(u.allowed_pages || '[]');
    // Mask API key for listing - show only prefix
    u.has_api_key = !!u.api_key;
    u.api_key_preview = u.api_key ? u.api_key.slice(0, 12) + '...' + u.api_key.slice(-4) : null;
    delete u.api_key; // never send full key in list
  });

  res.json({ users, allPages: ALL_PAGES });
});

// Approve user
router.post('/users/:id/approve', (req, res) => {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Give all pages by default on approval
  db.prepare('UPDATE users SET is_approved = 1, allowed_pages = ? WHERE id = ?')
    .run(JSON.stringify(ALL_PAGES), user.id);

  res.json({ success: true });
});

// Reject / unapprove user
router.post('/users/:id/reject', (req, res) => {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.prepare('UPDATE users SET is_approved = 0 WHERE id = ?').run(user.id);
  res.json({ success: true });
});

// Toggle active/inactive
router.post('/users/:id/toggle-active', (req, res) => {
  const user = db.prepare('SELECT id, is_active FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(user.is_active ? 0 : 1, user.id);
  res.json({ success: true, is_active: !user.is_active });
});

// Update allowed pages for a user
router.put('/users/:id/pages', (req, res) => {
  const { pages } = req.body;
  if (!Array.isArray(pages)) return res.status(400).json({ error: 'pages array required' });

  const valid = pages.filter(p => ALL_PAGES.includes(p));
  db.prepare('UPDATE users SET allowed_pages = ? WHERE id = ?')
    .run(JSON.stringify(valid), req.params.id);

  res.json({ success: true, allowed_pages: valid });
});

// Update user plan
router.put('/users/:id/plan', (req, res) => {
  const { plan_id } = req.body;
  const plan = db.prepare('SELECT id FROM plans WHERE id = ?').get(plan_id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });

  db.prepare('UPDATE users SET plan_id = ? WHERE id = ?').run(plan_id, req.params.id);
  res.json({ success: true });
});

// Get all plans
router.get('/plans', (req, res) => {
  const plans = db.prepare('SELECT * FROM plans').all();
  res.json({ plans });
});

// Dashboard stats
router.get('/stats', (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
  const pendingApproval = db.prepare('SELECT COUNT(*) as cnt FROM users WHERE is_approved = 0').get().cnt;
  const activeUsers = db.prepare('SELECT COUNT(*) as cnt FROM users WHERE is_active = 1 AND is_approved = 1').get().cnt;
  const connectedSessions = db.prepare("SELECT COUNT(*) as cnt FROM sessions WHERE status = 'connected'").get().cnt;
  const today = new Date().toISOString().slice(0, 10);
  const todayMessages = db.prepare('SELECT COALESCE(SUM(messages_sent), 0) as cnt FROM daily_usage WHERE date = ?').get(today).cnt;
  const totalMessages = db.prepare('SELECT COALESCE(SUM(messages_sent), 0) as cnt FROM daily_usage').get().cnt;
  const totalContacts = db.prepare('SELECT COUNT(*) as cnt FROM contacts').get().cnt;
  const totalTemplates = db.prepare('SELECT COUNT(*) as cnt FROM templates').get().cnt;

  // Messages last 7 days trend
  const dailyTrend = db.prepare(`
    SELECT date, SUM(messages_sent) as count
    FROM daily_usage
    WHERE date >= date('now', '-6 days')
    GROUP BY date
    ORDER BY date ASC
  `).all();

  // Per-user message stats (top users)
  const userStats = db.prepare(`
    SELECT u.id, u.name, u.email, COALESCE(SUM(d.messages_sent), 0) as total_messages,
           COALESCE(t.cnt, 0) as today_messages,
           p.name as plan_name, p.daily_limit,
           s.status as session_status
    FROM users u
    LEFT JOIN daily_usage d ON d.user_id = u.id
    LEFT JOIN (SELECT user_id, messages_sent as cnt FROM daily_usage WHERE date = ?) t ON t.user_id = u.id
    LEFT JOIN plans p ON u.plan_id = p.id
    LEFT JOIN sessions s ON s.user_id = u.id
    GROUP BY u.id
    ORDER BY total_messages DESC
  `).all(today);

  // Plan distribution
  const planDistribution = db.prepare(`
    SELECT p.name, COUNT(u.id) as count
    FROM plans p
    LEFT JOIN users u ON u.plan_id = p.id
    GROUP BY p.id
    ORDER BY count DESC
  `).all();

  // Message status breakdown
  const messageStatus = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM messages
    GROUP BY status
  `).all();

  // Recent registrations (last 30 days)
  const recentRegistrations = db.prepare(`
    SELECT date(created_at) as date, COUNT(*) as count
    FROM users
    WHERE created_at >= datetime('now', '-30 days')
    GROUP BY date(created_at)
    ORDER BY date ASC
  `).all();

  res.json({
    totalUsers, pendingApproval, activeUsers, connectedSessions,
    todayMessages, totalMessages, totalContacts, totalTemplates,
    dailyTrend, userStats, planDistribution, messageStatus, recentRegistrations
  });
});

// Generate API key for a user
router.post('/users/:id/api-key/generate', (req, res) => {
  const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const key = 'wapnix_' + crypto.randomBytes(32).toString('hex');
  const tokenName = 'admin-generated';
  db.prepare('UPDATE users SET api_key = ?, token_name = ? WHERE id = ?').run(key, tokenName, user.id);

  res.json({ success: true, api_key: key });
});

// Reset password for a user (returns new password in plain text)
router.post('/users/:id/reset-password', async (req, res) => {
  const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { password } = req.body;
  const newPassword = password || crypto.randomBytes(4).toString('hex'); // 8 char random if not provided
  const hash = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);

  res.json({ success: true, password: newPassword });
});

// Login as any user (superadmin impersonation)
router.post('/users/:id/login-as', (req, res) => {
  const user = db.prepare('SELECT id, email, name, is_active FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!user.is_active) return res.status(400).json({ error: 'User is deactivated' });

  const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
  res.json({ token, userId: user.id, name: user.name, email: user.email });
});

// Revoke API key for a user
router.post('/users/:id/api-key/revoke', (req, res) => {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.prepare('UPDATE users SET api_key = NULL, token_name = NULL WHERE id = ?').run(user.id);
  res.json({ success: true });
});

export default router;
