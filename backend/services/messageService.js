import db from '../db/database.js';
import { normalizePhone } from '../shared/phoneUtils.js';
import { incrementDailyUsage } from '../middleware/rateLimiter.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import sessionManager from './sessionManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Replace {{variable}} placeholders in a template body.
 * @param {string} body - Template text with {{var}} placeholders
 * @param {Record<string, string>} variables - Key-value map of replacements
 * @returns {string} Rendered text
 */
export function renderTemplate(body, variables = {}) {
  return body.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match;
  });
}

/**
 * Send a single WhatsApp message. Inserts into DB as 'queued', sends async via Baileys.
 * @param {number} userId
 * @param {object} opts
 * @param {string} opts.phone - Phone number (will be normalized)
 * @param {string} [opts.message] - Message text
 * @param {number} [opts.templateId] - Template ID (resolved from DB)
 * @param {Record<string, string>} [opts.variables] - Template variables
 * @param {Array<{url: string, caption?: string}>} [opts.media] - Media attachments (file paths)
 * @returns {Promise<{id: number, phone: string, status: string}>}
 */
export async function sendSingle(userId, { phone, message, templateId, variables, media, skipUsageIncrement = false }) {
  const normalized = normalizePhone(phone);
  if (!normalized) throw new Error('Invalid phone number');

  let body = message;
  if (templateId) {
    const tpl = db.prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?').get(parseInt(templateId), userId);
    if (!tpl) throw new Error('Template not found');
    body = renderTemplate(tpl.body, variables || {});
  }

  if (!body) throw new Error('Message body is empty');

  const dbResult = db.prepare(
    'INSERT INTO messages (user_id, phone, body, template_id, status) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, normalized, body, templateId ? parseInt(templateId) : null, 'queued');

  const msgId = dbResult.lastInsertRowid;

  // Send via local session (direct WhatsApp connection)
  const session = sessionManager.getSession(userId);
  if (!session || !session.isConnected) {
    db.prepare('UPDATE messages SET status = ?, error_message = ? WHERE id = ?')
      .run('failed', 'WhatsApp not connected', msgId);
    return { id: msgId, phone: normalized, status: 'failed', error: 'WhatsApp not connected' };
  }

  const jid = normalized + '@s.whatsapp.net';
  const queue = sessionManager.getQueue(userId);

  const sendAll = async () => {
    if (media && Array.isArray(media) && media.length > 0) {
      for (let i = 0; i < media.length; i++) {
        const item = media[i];
        const imgPath = path.join(__dirname, '..', item.url);
        if (!fs.existsSync(imgPath)) continue;
        const imgBuffer = fs.readFileSync(imgPath);
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
      if (!skipUsageIncrement) incrementDailyUsage(userId);
    })
    .catch((err) => {
      db.prepare('UPDATE messages SET status = ?, error_message = ? WHERE id = ?')
        .run('failed', err.message, msgId);
    });

  return { id: msgId, phone: normalized, status: 'queued' };
}

/**
 * Send bulk WhatsApp messages to a list of phones or a contact group.
 * @param {number} userId
 * @param {object} opts
 * @param {string[]} [opts.phones] - Array of phone numbers
 * @param {number} [opts.groupId] - Contact group ID (alternative to phones)
 * @param {string} [opts.message] - Message text
 * @param {number} [opts.templateId] - Template ID
 * @param {Record<string, string>} [opts.variables] - Template variables
 * @returns {Promise<{batch_id: string, total: number, queued: number, failed: number, skipped: number}>}
 */
export async function sendBulk(userId, { phones, groupId, message, templateId, variables }) {
  let targetPhones = [];

  if (Array.isArray(phones) && phones.length > 0) {
    targetPhones = phones;
  } else if (groupId) {
    const members = db.prepare(
      'SELECT c.phone FROM contacts c JOIN contact_group_members cgm ON c.id = cgm.contact_id WHERE cgm.group_id = ? AND c.user_id = ?'
    ).all(groupId, userId);
    targetPhones = members.map(m => m.phone);
  }

  if (targetPhones.length === 0) throw new Error('No recipients specified');

  // Check daily remaining
  const today = new Date().toISOString().slice(0, 10);
  const user = db.prepare(
    'SELECT u.*, p.daily_limit FROM users u JOIN plans p ON u.plan_id = p.id WHERE u.id = ?'
  ).get(userId);

  const usage = db.prepare(
    'SELECT messages_sent FROM daily_usage WHERE user_id = ? AND date = ?'
  ).get(userId, today);

  const sent = usage?.messages_sent || 0;
  const remaining = user.daily_limit - sent;
  const toSend = targetPhones.slice(0, remaining);
  const skipped = targetPhones.length - toSend.length;

  const batchId = uuidv4();
  const results = [];

  for (const phone of toSend) {
    try {
      const result = await sendSingle(userId, { phone, message, templateId, variables });
      results.push({ ...result, batch_id: batchId });

      // Tag message with batch_id
      db.prepare('UPDATE messages SET batch_id = ? WHERE id = ?').run(batchId, result.id);
    } catch (err) {
      results.push({ phone, status: 'failed', error: err.message });
    }
  }

  return {
    batch_id: batchId,
    total: targetPhones.length,
    queued: results.filter(r => r.status === 'queued').length,
    failed: results.filter(r => r.status === 'failed').length,
    skipped,
  };
}
