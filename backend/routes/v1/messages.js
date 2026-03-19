import { Router } from 'express';
import db from '../../db/database.js';
import { normalizePhone } from '../../shared/phoneUtils.js';
import { renderTemplate } from '../../services/messageService.js';
import { incrementDailyUsage } from '../../middleware/rateLimiter.js';
import { v4 as uuidv4 } from 'uuid';
import sessionManager from '../../services/sessionManager.js';
import { paginate } from '../../middleware/responseWrapper.js';

const router = Router();

// POST /api/v1/messages/send - Send single message
router.post('/send', async (req, res) => {
  try {
    const { phone, message, template_id, variables, media } = req.body;
    if (!phone) return res.fail(400, 'Phone number is required');
    if (!message && !template_id) return res.fail(400, 'Message or template_id is required');

    const userId = req.user.id;
    const normalized = normalizePhone(String(phone));
    if (!normalized) return res.fail(400, 'Invalid phone number');

    // Resolve message body
    let body = message;
    if (template_id) {
      const tpl = db.prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?').get(parseInt(template_id), userId);
      if (!tpl) return res.fail(404, 'Template not found');
      body = renderTemplate(tpl.body, variables || {});
    }
    if (!body) return res.fail(400, 'Message body is empty');

    // Check daily limit
    const today = new Date().toISOString().slice(0, 10);
    const usage = db.prepare('SELECT messages_sent FROM daily_usage WHERE user_id = ? AND date = ?').get(userId, today);
    const sent = usage?.messages_sent || 0;
    if (sent >= req.user.daily_limit) return res.fail(429, 'Daily message limit reached');

    // Check WhatsApp connection
    const session = sessionManager.getSession(userId);
    if (!session || !session.isConnected) {
      return res.fail(400, 'WhatsApp not connected');
    }

    const jid = normalized + '@s.whatsapp.net';

    // Insert into DB
    const dbResult = db.prepare(
      'INSERT INTO messages (user_id, phone, body, template_id, status) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, normalized, body, template_id ? parseInt(template_id) : null, 'queued');
    const msgId = Number(dbResult.lastInsertRowid);

    // Send async
    const queue = sessionManager.getQueue(userId);

    const sendAll = async () => {
      if (media && Array.isArray(media) && media.length > 0) {
        for (let i = 0; i < media.length; i++) {
          const item = media[i];
          if (!item.data) continue;
          const imgBuffer = Buffer.from(item.data, 'base64');
          const caption = i === 0 ? body : (item.caption || '');
          const msgPayload = { image: imgBuffer, caption };
          if (queue) {
            await queue.enqueue(`user_${userId}`, session.sock, jid, msgPayload);
          } else {
            await session.sock.sendMessage(jid, msgPayload);
          }
        }
      } else {
        if (queue) {
          await queue.enqueue(`user_${userId}`, session.sock, jid, { text: body });
        } else {
          await session.sock.sendMessage(jid, { text: body });
        }
      }
    };

    sendAll()
      .then(() => {
        db.prepare('UPDATE messages SET status = ?, sent_at = ? WHERE id = ?')
          .run('sent', new Date().toISOString(), msgId);
        incrementDailyUsage(userId);
      })
      .catch((err) => {
        db.prepare('UPDATE messages SET status = ?, error_message = ? WHERE id = ?')
          .run('failed', err.message, msgId);
      });

    res.ok({ id: msgId, phone: normalized, status: 'queued' });
  } catch (err) {
    res.fail(500, err.message);
  }
});

// POST /api/v1/messages/send-bulk - Send bulk messages
router.post('/send-bulk', async (req, res) => {
  try {
    const { contacts, message, template_id, variables, media } = req.body;
    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return res.fail(400, 'Contacts array is required');
    }
    if (!message && !template_id) return res.fail(400, 'Message or template_id is required');

    const userId = req.user.id;
    const today = new Date().toISOString().slice(0, 10);
    const usage = db.prepare('SELECT messages_sent FROM daily_usage WHERE user_id = ? AND date = ?').get(userId, today);
    const sent = usage?.messages_sent || 0;
    const remaining = req.user.daily_limit - sent;
    if (remaining <= 0) return res.fail(429, 'Daily message limit reached');

    const session = sessionManager.getSession(userId);
    if (!session || !session.isConnected) {
      return res.fail(400, 'WhatsApp not connected');
    }

    // Resolve template body
    let templateBody = message;
    if (template_id) {
      const tpl = db.prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?').get(parseInt(template_id), userId);
      if (!tpl) return res.fail(404, 'Template not found');
      templateBody = tpl.body;
    }

    const batchId = uuidv4();
    const toSend = contacts.slice(0, remaining);
    const skipped = contacts.length - toSend.length;
    const results = [];

    const insertStmt = db.prepare(
      'INSERT INTO messages (user_id, phone, body, batch_id, template_id, status) VALUES (?, ?, ?, ?, ?, ?)'
    );

    for (const contact of toSend) {
      const phone = normalizePhone(String(contact.phone || ''));
      if (!phone || phone.length < 10) {
        results.push({ phone: contact.phone, status: 'failed', error: 'Invalid phone' });
        continue;
      }

      let body = templateBody;
      const mergeVars = { ...variables, ...contact };
      for (const [key, val] of Object.entries(mergeVars)) {
        body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), String(val || ''));
      }

      try {
        const dbResult = insertStmt.run(userId, phone, body, batchId, template_id ? parseInt(template_id) : null, 'queued');
        results.push({ id: Number(dbResult.lastInsertRowid), phone, status: 'queued' });
      } catch (dbErr) {
        results.push({ phone, status: 'failed', error: dbErr.message });
      }
    }

    const queued = results.filter(r => r.status === 'queued');
    const failed = results.filter(r => r.status === 'failed');

    res.ok({ batch_id: batchId, total: contacts.length, queued: queued.length, failed: failed.length, skipped });

    // Async sending with 15s gap
    (async () => {
      for (const r of queued) {
        try {
          const jid = r.phone + '@s.whatsapp.net';
          await new Promise(resolve => setTimeout(resolve, 15000));
          const msg = db.prepare('SELECT body FROM messages WHERE id = ?').get(r.id);
          if (!msg) continue;

          if (media && Array.isArray(media) && media.length > 0) {
            for (let i = 0; i < media.length; i++) {
              const item = media[i];
              if (!item.data) continue;
              const imgBuffer = Buffer.from(item.data, 'base64');
              const caption = i === 0 ? msg.body : (item.caption || '');
              await session.sock.sendMessage(jid, { image: imgBuffer, caption });
            }
          } else {
            await session.sock.sendMessage(jid, { text: msg.body });
          }
          db.prepare('UPDATE messages SET status = ?, sent_at = ? WHERE id = ?')
            .run('sent', new Date().toISOString(), r.id);
          incrementDailyUsage(userId);
        } catch (err) {
          db.prepare('UPDATE messages SET status = ?, error_message = ? WHERE id = ?')
            .run('failed', err.message, r.id);
        }
      }
    })();
  } catch (err) {
    res.fail(500, err.message);
  }
});

// GET /api/v1/messages/:id - Get message status
router.get('/:id', (req, res) => {
  const msg = db.prepare(
    'SELECT id, phone, body, status, error_message, batch_id, template_id, sent_at, created_at FROM messages WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.user.id);
  if (!msg) return res.fail(404, 'Message not found');
  res.ok(msg);
});

// GET /api/v1/messages/batch/:batchId - Get batch status
router.get('/batch/:batchId', (req, res) => {
  const messages = db.prepare(
    'SELECT id, phone, status, error_message, sent_at, created_at FROM messages WHERE batch_id = ? AND user_id = ? ORDER BY created_at ASC'
  ).all(req.params.batchId, req.user.id);

  res.ok({
    batch_id: req.params.batchId,
    total: messages.length,
    sent: messages.filter(m => m.status === 'sent').length,
    failed: messages.filter(m => m.status === 'failed').length,
    queued: messages.filter(m => m.status === 'queued').length,
    messages,
  });
});

// GET /api/v1/messages/history - Message history (paginated)
router.get('/history', (req, res) => {
  const { status, phone, from_date, to_date } = req.query;
  const userId = req.user.id;

  let whereClause = 'WHERE user_id = ?';
  const params = [userId];

  if (status) { whereClause += ' AND status = ?'; params.push(status); }
  if (phone) { whereClause += ' AND phone LIKE ?'; params.push(`%${phone}%`); }
  if (from_date) { whereClause += ' AND created_at >= ?'; params.push(from_date); }
  if (to_date) { whereClause += ' AND created_at <= ?'; params.push(to_date + 'T23:59:59'); }

  const { rows, meta } = paginate(
    db,
    `SELECT COUNT(*) as total FROM messages ${whereClause}`,
    `SELECT id, phone, body, status, error_message, batch_id, sent_at, created_at FROM messages ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    params,
    req.query
  );

  res.ok(rows, meta);
});

export default router;
