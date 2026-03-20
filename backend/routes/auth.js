import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config.js';
import db from '../db/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

const defaultTemplates = [
  { name: 'Welcome Message', body: "Hi {{name}}, welcome to our service! We're glad to have you on board. Feel free to reach out if you need any help.", category: 'greeting' },
  { name: 'Order Confirmation', body: 'Hi {{name}}, your order #{{order_id}} has been confirmed! Total: ₹{{amount}}. Expected delivery: {{date}}. Thank you for shopping with us!', category: 'notification' },
  { name: 'Payment Reminder', body: 'Hi {{name}}, this is a friendly reminder that your payment of ₹{{amount}} is due on {{date}}. Please make the payment at your earliest convenience.', category: 'notification' },
  { name: 'Appointment Reminder', body: 'Hi {{name}}, just a reminder about your appointment on {{date}} at {{time}}. Please confirm your attendance by replying YES.', category: 'notification' },
  { name: 'Thank You', body: 'Hi {{name}}, thank you for your purchase! We appreciate your business and hope you enjoy your {{product}}. See you again soon!', category: 'greeting' },
  { name: 'Shipping Update', body: 'Hi {{name}}, your order #{{order_id}} has been shipped! Tracking ID: {{tracking_id}}. Expected delivery: {{date}}.', category: 'notification' },
  { name: 'Feedback Request', body: 'Hi {{name}}, we hope you enjoyed our service! Could you take a moment to share your feedback? Your opinion matters to us. Rate us: {{link}}', category: 'marketing' },
  { name: 'Discount Offer', body: 'Hi {{name}}, great news! Use code {{code}} to get {{discount}}% off on your next purchase. Valid till {{date}}. Shop now!', category: 'marketing' },
  { name: 'New Product Launch', body: 'Hi {{name}}, exciting news! We just launched {{product}}. Be among the first to check it out. Visit: {{link}}', category: 'marketing' },
  { name: 'Event Invitation', body: "Hi {{name}}, you're invited to {{event}} on {{date}} at {{venue}}. RSVP by replying YES. We'd love to see you there!", category: 'marketing' },
  { name: 'Birthday Wish', body: "Happy Birthday {{name}}! Wishing you a wonderful year ahead. Here's a special {{discount}}% discount as our gift! Use code: {{code}}", category: 'greeting' },
  { name: 'Subscription Renewal', body: 'Hi {{name}}, your {{plan}} subscription expires on {{date}}. Renew now to continue enjoying uninterrupted service. Renew: {{link}}', category: 'notification' },
  { name: 'OTP Verification', body: 'Your verification code is {{otp}}. Valid for {{minutes}} minutes. Do not share this code with anyone.', category: 'notification' },
  { name: 'Account Activation', body: 'Hi {{name}}, your account has been activated successfully! You can now login and start using our services. Login: {{link}}', category: 'notification' },
  { name: 'Service Downtime', body: 'Hi {{name}}, we will be performing scheduled maintenance on {{date}} from {{start_time}} to {{end_time}}. Services may be temporarily unavailable.', category: 'notification' },
  { name: 'Follow-up Message', body: "Hi {{name}}, hope you're doing well! Just checking in regarding {{topic}}. Would love to hear back from you. Let me know a good time to connect.", category: 'general' },
  { name: 'Invoice Sent', body: 'Hi {{name}}, invoice #{{invoice_id}} for ₹{{amount}} has been generated. Due date: {{date}}. Download: {{link}}', category: 'notification' },
  { name: 'Delivery Completed', body: 'Hi {{name}}, your order #{{order_id}} has been delivered successfully! If you have any issues, please contact our support team.', category: 'notification' },
  { name: 'Referral Program', body: 'Hi {{name}}, share the love! Refer a friend and both of you get ₹{{reward}}. Your referral code: {{code}}. Share now!', category: 'marketing' },
  { name: 'Holiday Greeting', body: 'Hi {{name}}, wishing you a very Happy {{festival}}! May this season bring you joy and prosperity. Warm regards from our team!', category: 'greeting' },
];

function extractVars(body) {
  return [...new Set([...body.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))];
}

function seedDefaultTemplates(userId) {
  const insert = db.prepare('INSERT OR IGNORE INTO templates (user_id, name, body, variables, category) VALUES (?, ?, ?, ?, ?)');
  for (const tpl of defaultTemplates) {
    insert.run(userId, tpl.name, tpl.body, JSON.stringify(extractVars(tpl.body)), tpl.category);
  }
}

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const allPages = JSON.stringify(['dashboard', 'device', 'templates', 'contacts', 'send', 'chatbot', 'api', 'website']);

    // Auto-approve if: superadmin email OR first user in the system
    const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
    const isSuperadminEmail = email.toLowerCase() === 'avinashsingh36948@gmail.com';
    const isFirstUser = userCount === 0;
    const autoApprove = isSuperadminEmail || isFirstUser;

    const result = db.prepare(
      'INSERT INTO users (email, password_hash, name, plan_id, is_approved, is_superadmin, allowed_pages) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(email.toLowerCase(), passwordHash, name || '', isFirstUser ? 4 : 1, autoApprove ? 1 : 0, autoApprove ? 1 : 0, allPages);

    const userId = result.lastInsertRowid;

    // Create session record
    db.prepare(
      'INSERT INTO sessions (user_id, auth_folder) VALUES (?, ?)'
    ).run(userId, `user_${userId}`);

    // Seed default templates for new user
    seedDefaultTemplates(userId);

    const msg = autoApprove
      ? 'Registration successful. You can login now.'
      : 'Registration successful. Please wait for admin approval.';
    res.status(201).json({ message: msg, userId });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if user is approved (superadmins always approved)
    if (!user.is_approved && !user.is_superadmin) {
      return res.status(403).json({ error: 'Your account is pending approval. Please wait for admin to approve your account.' });
    }

    const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

    res.json({ token, userId: user.id });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authenticate, (req, res) => {
  const { password_hash, ...user } = req.user;
  res.json({ user });
});

export default router;
