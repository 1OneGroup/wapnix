import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import db from '../db/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', 'uploads', 'avatars');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `user_${req.user.id}_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error('Only JPG, PNG, and WebP images are allowed'));
  },
});

const router = Router();

// Get all plans (for upgrade page)
router.get('/plans', (req, res) => {
  const plans = db.prepare('SELECT * FROM plans ORDER BY monthly_price ASC').all();
  const currentUser = db.prepare('SELECT plan_id FROM users WHERE id = ?').get(req.user.id);
  res.json({ plans, current_plan_id: currentUser?.plan_id });
});

// Upgrade plan
router.post('/upgrade', (req, res) => {
  const { plan_id } = req.body;
  if (!plan_id) return res.status(400).json({ error: 'plan_id required' });

  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(plan_id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });

  const currentUser = db.prepare('SELECT plan_id FROM users WHERE id = ?').get(req.user.id);
  const currentPlan = db.prepare('SELECT * FROM plans WHERE id = ?').get(currentUser.plan_id);

  if (plan.id === currentUser.plan_id) {
    return res.status(400).json({ error: 'You are already on this plan' });
  }

  db.prepare('UPDATE users SET plan_id = ? WHERE id = ?').run(plan_id, req.user.id);
  res.json({ success: true, plan_name: plan.name, message: `Plan upgraded to ${plan.name}!` });
});

// Get profile
router.get('/', (req, res) => {
  const user = db.prepare(
    `SELECT u.id, u.email, u.name, u.phone, u.company, u.bio, u.profile_image, u.created_at,
            u.is_superadmin, u.is_approved, u.plan_id,
            p.name as plan_name, p.daily_limit, p.monthly_limit, p.max_contacts, p.max_templates, p.monthly_price
     FROM users u JOIN plans p ON u.plan_id = p.id WHERE u.id = ?`
  ).get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Get usage stats
  const today = new Date().toISOString().split('T')[0];
  const usage = db.prepare('SELECT messages_sent FROM daily_usage WHERE user_id = ? AND date = ?').get(req.user.id, today);
  const totalMessages = db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE user_id = ?').get(req.user.id);
  const totalContacts = db.prepare('SELECT COUNT(*) as cnt FROM contacts WHERE user_id = ?').get(req.user.id);
  const totalTemplates = db.prepare('SELECT COUNT(*) as cnt FROM templates WHERE user_id = ?').get(req.user.id);
  const session = db.prepare('SELECT whatsapp_number, status FROM sessions WHERE user_id = ?').get(req.user.id);

  res.json({
    ...user,
    messages_today: usage?.messages_sent || 0,
    total_messages: totalMessages.cnt,
    total_contacts: totalContacts.cnt,
    total_templates: totalTemplates.cnt,
    whatsapp_number: session?.whatsapp_number || null,
    whatsapp_status: session?.status || 'disconnected',
  });
});

// Update profile
router.put('/', (req, res) => {
  const { name, phone, company, bio } = req.body;
  db.prepare(
    'UPDATE users SET name = ?, phone = ?, company = ?, bio = ? WHERE id = ?'
  ).run(name || '', phone || '', company || '', bio || '', req.user.id);
  res.json({ success: true });
});

// Change password
router.put('/password', async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) return res.status(400).json({ error: 'Both passwords required' });
  if (new_password.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });

  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  const valid = await bcrypt.compare(current_password, user.password_hash);
  if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

  const hash = await bcrypt.hash(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ success: true });
});

// Upload profile image
router.post('/image', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

  // Delete old image if exists
  const user = db.prepare('SELECT profile_image FROM users WHERE id = ?').get(req.user.id);
  if (user?.profile_image) {
    const oldPath = path.join(uploadsDir, path.basename(user.profile_image));
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  const imageUrl = `/uploads/avatars/${req.file.filename}`;
  db.prepare('UPDATE users SET profile_image = ? WHERE id = ?').run(imageUrl, req.user.id);
  res.json({ success: true, profile_image: imageUrl });
});

// Delete profile image
router.delete('/image', (req, res) => {
  const user = db.prepare('SELECT profile_image FROM users WHERE id = ?').get(req.user.id);
  if (user?.profile_image) {
    const oldPath = path.join(uploadsDir, path.basename(user.profile_image));
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  db.prepare('UPDATE users SET profile_image = NULL WHERE id = ?').run(req.user.id);
  res.json({ success: true });
});

export default router;
