import { Router } from 'express';
import db from '../db/database.js';
import { checkDailyLimit, incrementDailyUsage } from '../middleware/rateLimiter.js';
import { sendSingle, sendBulk } from '../services/messageService.js';
import { normalizePhone } from '../shared/phoneUtils.js';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import sessionManager from '../services/sessionManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Image upload setup for message attachments
const msgUploadsDir = path.join(__dirname, '..', 'uploads', 'messages');
if (!fs.existsSync(msgUploadsDir)) fs.mkdirSync(msgUploadsDir, { recursive: true });

const msgStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, msgUploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `msg_${req.user.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}${ext}`);
  },
});
const msgUpload = multer({
  storage: msgStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  },
});

const router = Router();

// Track active batch sending loops per user
const batchControl = new Map();

// Upload images for message attachments
router.post('/upload-image', msgUpload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  const url = `/uploads/messages/${req.file.filename}`;
  res.json({ success: true, url, filename: req.file.filename });
});

// Delete uploaded message image
router.delete('/upload-image/:filename', (req, res) => {
  const filePath = path.join(msgUploadsDir, req.params.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.json({ success: true });
});

// Send single message
router.post('/send', checkDailyLimit, async (req, res) => {
  const { phone, message, template_id, variables, media } = req.body;

  if (!phone) return res.status(400).json({ error: 'Phone number is required' });
  if (!message && !template_id) return res.status(400).json({ error: 'Message or template_id is required' });

  try {
    const result = await sendSingle(req.user.id, {
      phone,
      message,
      templateId: template_id,
      variables,
      media,
    });
    res.json({ success: true, ...result, daily_remaining: req.dailyRemaining - 1 });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Send bulk messages via local Baileys connection (CSV contacts)
router.post('/send-bulk', async (req, res) => {
  try {
    const { contacts, message } = req.body;
    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'Contacts array required' });
    }
    if (!message) return res.status(400).json({ error: 'Message required' });

    const userId = req.user.id;
    const today = new Date().toISOString().slice(0, 10);
    const user = db.prepare('SELECT u.*, p.daily_limit FROM users u JOIN plans p ON u.plan_id = p.id WHERE u.id = ?').get(userId);
    const usage = db.prepare('SELECT messages_sent FROM daily_usage WHERE user_id = ? AND date = ?').get(userId, today);
    const sent = usage?.messages_sent || 0;
    const remaining = user.is_superadmin ? Infinity : (user.daily_limit - sent);
    if (remaining <= 0) return res.status(429).json({ error: 'Daily limit reached' });

    const batchId = uuidv4();
    const results = [];
    const isSuperAdmin = !!user.is_superadmin;
    const toSend = isSuperAdmin ? contacts : contacts.slice(0, remaining);
    const skipped = contacts.length - toSend.length;

    const insertStmt = db.prepare('INSERT INTO messages (user_id, phone, body, batch_id, status) VALUES (?, ?, ?, ?, ?)');

    for (const contact of toSend) {
      const phone = normalizePhone(String(contact.phone || ''));
      if (!phone || phone.length < 10) {
        results.push({ phone: contact.phone, status: 'failed', error: 'Invalid phone' });
        continue;
      }
      let body = message;
      for (const [key, val] of Object.entries(contact)) {
        body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), String(val || ''));
      }
      try {
        const info = insertStmt.run(userId, phone, body, batchId, 'queued');
        results.push({ id: info.lastInsertRowid, phone, status: 'queued' });
      } catch (dbErr) {
        results.push({ phone, status: 'failed', error: dbErr.message });
      }
    }

    const queued = results.filter(r => r.status === 'queued');
    const failed = results.filter(r => r.status === 'failed');
    res.json({ success: true, batch_id: batchId, total: contacts.length, queued: queued.length, failed: failed.length, skipped });

    // Init batch control
    batchControl.set(userId, { paused: false, cancelled: false });

    // Async send via local Baileys session with pause/cancel
    (async () => {
      const session = sessionManager.getSession(userId);
      const queue = sessionManager.getQueue(userId);

      if (!session || !session.isConnected) {
        db.prepare("UPDATE messages SET status = 'failed', error_message = 'WhatsApp not connected' WHERE batch_id = ? AND status = 'queued'").run(batchId);
        batchControl.delete(userId);
        console.log(`[bulk-send] Batch ${batchId} failed: WhatsApp not connected`);
        return;
      }

      for (const r of queued) {
        const ctrl = batchControl.get(userId);
        if (ctrl?.cancelled) {
          db.prepare("UPDATE messages SET status = 'cancelled', error_message = 'Cancelled by user' WHERE batch_id = ? AND status = 'queued'").run(batchId);
          break;
        }
        while (ctrl && ctrl.paused && !ctrl.cancelled) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        if (ctrl?.cancelled) {
          db.prepare("UPDATE messages SET status = 'cancelled', error_message = 'Cancelled by user' WHERE batch_id = ? AND status = 'queued'").run(batchId);
          break;
        }

        try {
          await new Promise(resolve => setTimeout(resolve, 15000)); // 15s gap
          const msg = db.prepare('SELECT body FROM messages WHERE id = ?').get(r.id);
          if (!msg) continue;

          const jid = r.phone + '@s.whatsapp.net';
          if (queue) {
            await queue.enqueue(`user_${userId}`, session.sock, jid, { text: msg.body });
          } else {
            await session.sock.sendMessage(jid, { text: msg.body });
          }

          db.prepare('UPDATE messages SET status = ?, sent_at = ? WHERE id = ?').run('sent', new Date().toISOString(), r.id);
          incrementDailyUsage(userId);
          console.log(`[bulk-send] Sent to ${r.phone}`);
        } catch (err) {
          console.error(`[bulk-send] Failed ${r.phone}:`, err.message);
          db.prepare('UPDATE messages SET status = ?, error_message = ? WHERE id = ?').run('failed', err.message, r.id);
        }
      }
      batchControl.delete(userId);
      console.log(`[bulk-send] Batch ${batchId} complete.`);
    })();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pause bulk send
router.post('/bulk-pause', (req, res) => {
  const ctrl = batchControl.get(req.user.id);
  if (!ctrl) return res.json({ success: false, message: 'No active batch' });
  ctrl.paused = true;
  res.json({ success: true, status: 'paused' });
});

// Resume bulk send
router.post('/bulk-resume', (req, res) => {
  const ctrl = batchControl.get(req.user.id);
  if (!ctrl) return res.json({ success: false, message: 'No active batch' });
  ctrl.paused = false;
  res.json({ success: true, status: 'resumed' });
});

// Cancel bulk send
router.post('/bulk-cancel', (req, res) => {
  const ctrl = batchControl.get(req.user.id);
  if (ctrl) { ctrl.cancelled = true; ctrl.paused = false; }
  const { batch_id } = req.body;
  if (batch_id) {
    const info = db.prepare("UPDATE messages SET status = 'cancelled', error_message = 'Cancelled by user' WHERE batch_id = ? AND user_id = ? AND status = 'queued'")
      .run(batch_id, req.user.id);
    res.json({ success: true, cancelled: info.changes });
  } else {
    res.json({ success: true, cancelled: 0 });
  }
});

// Get batch status
router.get('/bulk-status/:batchId', (req, res) => {
  const messages = db.prepare('SELECT id, phone, body, status, error_message, sent_at, created_at FROM messages WHERE batch_id = ? AND user_id = ? ORDER BY created_at ASC')
    .all(req.params.batchId, req.user.id);
  const summary = {
    total: messages.length,
    queued: messages.filter(m => m.status === 'queued').length,
    sent: messages.filter(m => m.status === 'sent').length,
    failed: messages.filter(m => m.status === 'failed').length,
    cancelled: messages.filter(m => m.status === 'cancelled').length,
  };
  res.json({ messages, summary });
});

// Message history
router.get('/history', (req, res) => {
  const { status, batch_id, phone, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  let query = 'SELECT * FROM messages WHERE user_id = ?';
  const params = [req.user.id];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (batch_id) {
    query += ' AND batch_id = ?';
    params.push(batch_id);
  }
  if (phone) {
    query += ' AND phone LIKE ?';
    params.push(`%${phone}%`);
  }

  const total = db.prepare(query.replace('SELECT *', 'SELECT COUNT(*) as cnt')).get(...params).cnt;
  const messages = db.prepare(query + ' ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .all(...params, parseInt(limit), parseInt(offset));

  res.json({ messages, total, page: parseInt(page), limit: parseInt(limit) });
});

export default router;
