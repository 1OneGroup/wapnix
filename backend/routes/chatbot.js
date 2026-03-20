import { Router } from 'express';
import db from '../db/database.js';
import { getActiveConversations, resetConversation, setAllowedPhones, getAllowedPhones, initConversation, addAllowedPhone } from '../services/chatbotEngine.js';
import { normalizePhone } from '../shared/phoneUtils.js';
import { incrementDailyUsage } from '../middleware/rateLimiter.js';
import { v4 as uuidv4 } from 'uuid';
import sessionManager from '../services/sessionManager.js';

const router = Router();

// Track active batch sending loops per user so they can be paused/cancelled
// Map<userId, { paused: boolean, cancelled: boolean }>
const batchControl = new Map();

// List all chatbot flows
router.get('/flows', (req, res) => {
  const flows = db.prepare('SELECT id, name, description, is_active, created_at, updated_at FROM chatbot_flows WHERE user_id = ? ORDER BY updated_at DESC').all(req.user.id);
  res.json({ flows });
});

// Get single flow with steps
router.get('/flows/:id', (req, res) => {
  const flow = db.prepare('SELECT * FROM chatbot_flows WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!flow) return res.status(404).json({ error: 'Flow not found' });
  res.json({ ...flow, steps: JSON.parse(flow.steps_json) });
});

// Create flow
router.post('/flows', (req, res) => {
  const { name, description, steps } = req.body;
  if (!name || !steps) return res.status(400).json({ error: 'Name and steps are required' });

  const result = db.prepare(
    'INSERT INTO chatbot_flows (user_id, name, description, steps_json) VALUES (?, ?, ?, ?)'
  ).run(req.user.id, name, description || '', JSON.stringify(steps));

  res.status(201).json({ id: result.lastInsertRowid, name });
});

// Update flow
router.put('/flows/:id', (req, res) => {
  const { name, description, steps } = req.body;
  const flow = db.prepare('SELECT * FROM chatbot_flows WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!flow) return res.status(404).json({ error: 'Flow not found' });

  db.prepare(
    'UPDATE chatbot_flows SET name = ?, description = ?, steps_json = ?, updated_at = ? WHERE id = ?'
  ).run(name || flow.name, description ?? flow.description, steps ? JSON.stringify(steps) : flow.steps_json, new Date().toISOString(), flow.id);

  res.json({ success: true });
});

// Delete flow
router.delete('/flows/:id', (req, res) => {
  const result = db.prepare('DELETE FROM chatbot_flows WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Flow not found' });
  res.json({ success: true });
});

// Activate a flow (deactivate all others first)
router.post('/flows/:id/activate', (req, res) => {
  const flow = db.prepare('SELECT * FROM chatbot_flows WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!flow) return res.status(404).json({ error: 'Flow not found' });

  db.prepare('UPDATE chatbot_flows SET is_active = 0 WHERE user_id = ?').run(req.user.id);
  db.prepare('UPDATE chatbot_flows SET is_active = 1 WHERE id = ?').run(flow.id);

  res.json({ success: true, message: `"${flow.name}" is now active` });
});

// Deactivate all flows
router.post('/flows/deactivate', (req, res) => {
  db.prepare('UPDATE chatbot_flows SET is_active = 0 WHERE user_id = ?').run(req.user.id);
  res.json({ success: true });
});

// Get active conversations (in-memory engine state)
router.get('/conversations/active', (req, res) => {
  const convs = getActiveConversations(req.user.id);
  res.json({ conversations: convs });
});

// Reset a conversation
router.post('/conversations/reset', (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone required' });
  resetConversation(req.user.id, phone);
  res.json({ success: true });
});

// ── Bulk Message Module ──

// Set allowed phone numbers for chatbot (from uploaded sheet)
router.post('/sheet-activate', (req, res) => {
  const { phones } = req.body; // array of phone strings
  if (!phones || !Array.isArray(phones)) {
    return res.status(400).json({ error: 'phones array required' });
  }
  // Normalize all phones
  const normalized = phones.map(p => normalizePhone(String(p))).filter(p => p && p.length >= 10);
  setAllowedPhones(req.user.id, normalized);
  res.json({ success: true, count: normalized.length });
});

// Clear phone filter (deactivate sheet - bot replies to nobody or all)
router.post('/sheet-deactivate', (req, res) => {
  setAllowedPhones(req.user.id, []);
  res.json({ success: true });
});

// Get current allowed phones
router.get('/sheet-phones', (req, res) => {
  res.json({ phones: getAllowedPhones(req.user.id) });
});

// Get active flow info (for bulk messages integration)
router.get('/active-flow', (req, res) => {
  const flow = db.prepare('SELECT id, name, description, steps_json FROM chatbot_flows WHERE user_id = ? AND is_active = 1 LIMIT 1').get(req.user.id);
  if (!flow) return res.json({ flow: null });
  const steps = JSON.parse(flow.steps_json);
  res.json({ flow: { id: flow.id, name: flow.name, description: flow.description, firstMessage: steps[0]?.message || '', stepCount: steps.length } });
});

// Quick send - single user with optional flow
router.post('/quick-send', async (req, res) => {
  try {
    const { phone, message, flow_id, media, contact_data } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number is required' });

    const userId = req.user.id;
    const normalized = normalizePhone(String(phone));
    if (!normalized) return res.status(400).json({ error: 'Invalid phone number' });

    // Check WhatsApp connection
    const session = sessionManager.getSession(userId);
    if (!session || !session.isConnected) {
      return res.status(400).json({ error: 'WhatsApp not connected. Please connect from Settings.' });
    }

    // Get the flow if specified
    let flow = null;
    let firstStep = null;
    let finalMessage = message;

    if (flow_id) {
      const flowRow = db.prepare('SELECT * FROM chatbot_flows WHERE id = ? AND user_id = ?').get(parseInt(flow_id), userId);
      if (!flowRow) return res.status(404).json({ error: 'Flow not found' });
      flow = { ...flowRow, steps: JSON.parse(flowRow.steps_json) };
      firstStep = flow.steps[0];
      if (!firstStep) return res.status(400).json({ error: 'Flow has no steps' });
      // Use frontend's pre-replaced message if provided, otherwise use flow template
      if (!message) finalMessage = firstStep.message;
    }

    if (!finalMessage) return res.status(400).json({ error: 'Message is required' });

    // Check daily limit
    const today = new Date().toISOString().slice(0, 10);
    const user = db.prepare('SELECT u.*, p.daily_limit FROM users u JOIN plans p ON u.plan_id = p.id WHERE u.id = ?').get(userId);
    const usage = db.prepare('SELECT messages_sent FROM daily_usage WHERE user_id = ? AND date = ?').get(userId, today);
    const sent = usage?.messages_sent || 0;
    if (sent >= user.daily_limit) return res.status(429).json({ error: 'Daily message limit reached' });

    // Insert message into DB
    const dbResult = db.prepare(
      'INSERT INTO messages (user_id, phone, body, status) VALUES (?, ?, ?, ?)'
    ).run(userId, normalized, finalMessage, 'queued');
    const msgId = dbResult.lastInsertRowid;

    // Send response immediately
    res.json({ success: true, id: Number(msgId), phone: normalized, status: 'queued' });

    // Async: send directly via local Baileys socket (no ngrok roundtrip)
    const jid = normalized + '@s.whatsapp.net';
    const queue = sessionManager.getQueue(userId);

    const sendDirect = async () => {
      // Send images if provided
      if (media && Array.isArray(media) && media.length > 0) {
        const fs = await import('fs');
        const path = await import('path');
        const { fileURLToPath } = await import('url');
        const __dirname = path.default.dirname(fileURLToPath(import.meta.url));
        for (let i = 0; i < media.length; i++) {
          const item = media[i];
          const imgPath = path.default.join(__dirname, '..', item.url);
          if (!fs.default.existsSync(imgPath)) continue;
          const buffer = fs.default.readFileSync(imgPath);
          const caption = i === 0 ? finalMessage : (item.caption || '');
          const msgPayload = { image: buffer, caption };
          if (queue) {
            await queue.enqueue(`user_${userId}`, session.sock, jid, msgPayload);
          } else {
            await session.sock.sendMessage(jid, msgPayload);
          }
        }
      } else {
        // Text only
        if (queue) {
          await queue.enqueue(`user_${userId}`, session.sock, jid, { text: finalMessage });
        } else {
          await session.sock.sendMessage(jid, { text: finalMessage });
        }
      }
    };

    sendDirect()
      .then(() => {
        const sentAt = new Date().toISOString();
        db.prepare('UPDATE messages SET status = ?, sent_at = ? WHERE id = ?')
          .run('sent', sentAt, msgId);
        incrementDailyUsage(userId);

        // If flow mode: add phone to filter + init conversation
        if (flow && firstStep) {
          // Log chatbot first message
          try {
            db.prepare('INSERT INTO chat_logs (user_id, phone, direction, message, created_at) VALUES (?, ?, ?, ?, ?)').run(userId, normalized, 'outgoing', finalMessage, sentAt);
          } catch {}
          addAllowedPhone(userId, normalized);
          initConversation(userId, normalized, flow.id, firstStep.id, contact_data || null);
          console.log(`[quick-send] Flow "${flow.name}" initialized for ${normalized}`);
        }

        console.log(`[quick-send] Sent to ${normalized}${flow ? ' (flow: ' + flow.name + ')' : ''}`);
      })
      .catch((err) => {
        db.prepare('UPDATE messages SET status = ?, error_message = ? WHERE id = ?')
          .run('failed', err.message, msgId);
        console.error(`[quick-send] Failed ${normalized}:`, err.message);
      });

  } catch (err) {
    console.error('[quick-send] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Send bulk messages from CSV data (supports flow mode)
router.post('/bulk-send', async (req, res) => {
  try {
    const { contacts, message, use_flow, flow_id, plan, media } = req.body;
    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'Contacts array is required' });
    }

    // In flow mode, get the flow's first step message
    let activeFlow = null;
    let firstStep = null;
    let finalMessage = message;

    if (use_flow) {
      let flowRow;
      if (flow_id) {
        // Use specific flow by ID (from flow selector)
        flowRow = db.prepare('SELECT * FROM chatbot_flows WHERE id = ? AND user_id = ?').get(parseInt(flow_id), req.user.id);
      } else {
        // Fallback to active flow
        flowRow = db.prepare('SELECT * FROM chatbot_flows WHERE user_id = ? AND is_active = 1 LIMIT 1').get(req.user.id);
      }
      if (!flowRow) return res.status(400).json({ error: 'Chatbot flow not found' });
      activeFlow = { ...flowRow, steps: JSON.parse(flowRow.steps_json) };
      firstStep = activeFlow.steps[0];
      if (!firstStep) return res.status(400).json({ error: 'Chatbot flow has no steps' });
      finalMessage = firstStep.message;
    }

    if (!finalMessage) return res.status(400).json({ error: 'Message is required' });

    console.log(`[bulk-send] User ${req.user.id}: ${contacts.length} contacts, msg length: ${finalMessage.length}${use_flow ? ' (FLOW MODE)' : ''}`);

    const userId = req.user.id;
    const today = new Date().toISOString().slice(0, 10);
    const user = db.prepare(
      'SELECT u.*, p.daily_limit FROM users u JOIN plans p ON u.plan_id = p.id WHERE u.id = ?'
    ).get(userId);

    const usage = db.prepare(
      'SELECT messages_sent FROM daily_usage WHERE user_id = ? AND date = ?'
    ).get(userId, today);

    const sent = usage?.messages_sent || 0;
    const isSuperAdmin = !!user.is_superadmin;
    const remaining = isSuperAdmin ? Infinity : (user.daily_limit - sent);

    if (remaining <= 0) {
      return res.status(429).json({ error: 'Daily message limit reached' });
    }

    const batchId = uuidv4();
    const results = [];
    const toSend = isSuperAdmin ? contacts : contacts.slice(0, remaining);
    const skipped = contacts.length - toSend.length;

    // Insert all messages into DB first
    const insertStmt = db.prepare(
      'INSERT INTO messages (user_id, phone, body, batch_id, status) VALUES (?, ?, ?, ?, ?)'
    );

    for (const contact of toSend) {
      const phone = normalizePhone(String(contact.phone || ''));
      if (!phone || phone.length < 10) {
        results.push({ phone: contact.phone, name: contact.name || '', status: 'failed', error: 'Invalid phone' });
        continue;
      }

      // Render per-contact variables
      let body = finalMessage;
      for (const [key, val] of Object.entries(contact)) {
        body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), String(val || ''));
      }

      try {
        const info = insertStmt.run(userId, phone, body, batchId, 'queued');
        const msgId = info.lastInsertRowid;
        results.push({ id: msgId, phone, name: contact.name || '', status: 'queued' });
      } catch (dbErr) {
        console.error(`[bulk-send] DB insert error for ${phone}:`, dbErr.message);
        results.push({ phone, name: contact.name || '', status: 'failed', error: dbErr.message });
      }
    }

    const queued = results.filter(r => r.status === 'queued');
    const failed = results.filter(r => r.status === 'failed');

    console.log(`[bulk-send] Batch ${batchId}: ${queued.length} queued, ${failed.length} failed, ${skipped} skipped`);

    // Save follow-up plan if provided
    if (plan && plan.type && plan.totalSends > 1) {
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + plan.freq);
      db.prepare(
        'INSERT INTO followup_plans (user_id, batch_id, plan_type, plan_label, total_days, freq_days, total_sends, sends_done, next_send_at, contacts_json, message, flow_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        userId, batchId, plan.type, plan.label, plan.days, plan.freq,
        plan.totalSends, 1, nextDate.toISOString(),
        JSON.stringify(contacts), finalMessage,
        activeFlow ? activeFlow.id : null, 'active'
      );
      console.log(`[bulk-send] Follow-up plan saved: ${plan.label}, ${plan.totalSends} sends, next: ${nextDate.toISOString()}`);
    }

    // Send response immediately, then send messages async
    res.json({ success: true, batch_id: batchId, total: contacts.length, queued: queued.length, failed: failed.length, skipped, plan: plan ? { label: plan.label, totalSends: plan.totalSends, nextSend: plan.totalSends > 1 ? new Date(Date.now() + plan.freq * 86400000).toISOString() : null } : null });

    // Init batch control for this user
    batchControl.set(userId, { paused: false, cancelled: false });

    // Async sending via local Baileys session with pause/cancel support
    (async () => {
      try {
      const session = sessionManager.getSession(userId);
      const queue = sessionManager.getQueue(userId);

      if (!session || !session.isConnected) {
        db.prepare("UPDATE messages SET status = 'failed', error_message = 'WhatsApp not connected' WHERE batch_id = ? AND status = 'queued'").run(batchId);
        console.log(`[bulk-send] Batch ${batchId} failed: WhatsApp not connected`);
        return;
      }

      for (const r of queued) {
        const ctrl = batchControl.get(userId);

        // Check if cancelled
        if (ctrl?.cancelled) {
          db.prepare("UPDATE messages SET status = 'cancelled', error_message = 'Cancelled by user' WHERE batch_id = ? AND status = 'queued'")
            .run(batchId);
          console.log(`[bulk-send] Batch ${batchId} cancelled by user.`);
          break;
        }

        // Check if paused - wait in loop
        while (ctrl && ctrl.paused && !ctrl.cancelled) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        // Re-check cancel after unpause
        if (ctrl?.cancelled) {
          db.prepare("UPDATE messages SET status = 'cancelled', error_message = 'Cancelled by user' WHERE batch_id = ? AND status = 'queued'")
            .run(batchId);
          console.log(`[bulk-send] Batch ${batchId} cancelled after pause.`);
          break;
        }

        try {
          await new Promise(resolve => setTimeout(resolve, 15000));
          const msg = db.prepare('SELECT body FROM messages WHERE id = ?').get(r.id);
          if (!msg) continue;

          const jid = r.phone + '@s.whatsapp.net';

          // Send images first if any
          if (media && Array.isArray(media) && media.length > 0) {
            const path = await import('path');
            const fs = await import('fs');
            const __dirname = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
            for (const m of media) {
              const imgPath = path.join(__dirname, '..', m.url.startsWith('/') ? m.url.slice(1) : m.url);
              if (fs.existsSync(imgPath)) {
                const imgBuffer = fs.readFileSync(imgPath);
                await session.sock.sendMessage(jid, { image: imgBuffer, caption: m.caption || '' });
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
            }
          }

          if (queue) {
            await queue.enqueue(`user_${userId}`, session.sock, jid, { text: msg.body });
          } else {
            await session.sock.sendMessage(jid, { text: msg.body });
          }

          const sentAt = new Date().toISOString();
          db.prepare('UPDATE messages SET status = ?, sent_at = ? WHERE id = ?')
            .run('sent', sentAt, r.id);
          incrementDailyUsage(userId);

          if (use_flow && activeFlow && firstStep) {
            // Log chatbot first message to chat_logs
            try {
              db.prepare('INSERT INTO chat_logs (user_id, phone, direction, message, created_at) VALUES (?, ?, ?, ?, ?)').run(userId, r.phone, 'outgoing', msg.body, sentAt);
            } catch {}
            // Find original contact data for variable replacement in subsequent steps
            const contactData = toSend.find(c => normalizePhone(String(c.phone || '')) === r.phone) || {};
            initConversation(userId, r.phone, activeFlow.id, firstStep.id, contactData);
          }
          console.log(`[bulk-send] Sent to ${r.phone}${use_flow ? ' (flow initialized)' : ''}`);
        } catch (err) {
          console.error(`[bulk-send] Failed ${r.phone}:`, err.message);
          db.prepare('UPDATE messages SET status = ?, error_message = ? WHERE id = ?')
            .run('failed', err.message, r.id);
        }
      }
      console.log(`[bulk-send] Batch ${batchId} complete.`);
      } finally {
        batchControl.delete(userId);
      }
    })();
  } catch (err) {
    console.error('[bulk-send] Unexpected error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get batch status (for polling)
router.get('/bulk-status/:batchId', (req, res) => {
  const messages = db.prepare(
    'SELECT id, phone, body, status, error_message, sent_at, created_at FROM messages WHERE batch_id = ? AND user_id = ? ORDER BY created_at ASC'
  ).all(req.params.batchId, req.user.id);

  const summary = {
    total: messages.length,
    queued: messages.filter(m => m.status === 'queued').length,
    sent: messages.filter(m => m.status === 'sent').length,
    failed: messages.filter(m => m.status === 'failed').length,
  };

  res.json({ messages, summary });
});

// Pause sending
router.post('/bulk-pause', (req, res) => {
  const ctrl = batchControl.get(req.user.id);
  if (!ctrl) return res.json({ success: false, message: 'No active batch' });
  ctrl.paused = true;
  console.log(`[bulk-send] User ${req.user.id}: PAUSED`);
  res.json({ success: true, status: 'paused' });
});

// Resume sending
router.post('/bulk-resume', (req, res) => {
  const ctrl = batchControl.get(req.user.id);
  if (!ctrl) return res.json({ success: false, message: 'No active batch' });
  ctrl.paused = false;
  console.log(`[bulk-send] User ${req.user.id}: RESUMED`);
  res.json({ success: true, status: 'resumed' });
});

// Cancel all queued messages
router.post('/bulk-cancel', (req, res) => {
  const ctrl = batchControl.get(req.user.id);
  if (ctrl) {
    ctrl.cancelled = true;
    ctrl.paused = false; // unblock if paused
  }
  // Also cancel any queued messages in DB for this user's latest batch
  const { batch_id } = req.body;
  if (batch_id) {
    const info = db.prepare("UPDATE messages SET status = 'cancelled', error_message = 'Cancelled by user' WHERE batch_id = ? AND user_id = ? AND status = 'queued'")
      .run(batch_id, req.user.id);
    console.log(`[bulk-send] User ${req.user.id}: CANCELLED ${info.changes} queued messages`);
    res.json({ success: true, cancelled: info.changes });
  } else {
    res.json({ success: true, cancelled: 0 });
  }
});

// Get batch control status
router.get('/bulk-control', (req, res) => {
  const ctrl = batchControl.get(req.user.id);
  res.json({ active: !!ctrl, paused: ctrl?.paused || false });
});

// Get active follow-up plans
router.get('/followup-plans', (req, res) => {
  const plans = db.prepare(
    "SELECT id, plan_type, plan_label, total_days, freq_days, total_sends, sends_done, next_send_at, status, created_at FROM followup_plans WHERE user_id = ? ORDER BY created_at DESC LIMIT 20"
  ).all(req.user.id);
  res.json({ plans });
});

// Cancel a follow-up plan
router.post('/followup-plans/:id/cancel', (req, res) => {
  const info = db.prepare(
    "UPDATE followup_plans SET status = 'cancelled' WHERE id = ? AND user_id = ? AND status = 'active'"
  ).run(req.params.id, req.user.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Plan not found or already completed' });
  res.json({ success: true });
});

// ── Chat Logs / Conversations ──

// Get all conversations (grouped by phone)
router.get('/conversations', (req, res) => {
  const userId = req.user.id;
  // Get unique phones with their latest message and total count
  const phones = db.prepare(`
    SELECT phone,
           COUNT(*) as total_messages,
           MAX(created_at) as last_activity,
           (SELECT message FROM chat_logs c2 WHERE c2.user_id = ? AND c2.phone = c1.phone ORDER BY created_at DESC LIMIT 1) as last_message,
           (SELECT direction FROM chat_logs c3 WHERE c3.user_id = ? AND c3.phone = c1.phone ORDER BY created_at DESC LIMIT 1) as last_direction
    FROM chat_logs c1
    WHERE user_id = ?
    GROUP BY phone
    ORDER BY last_activity DESC
  `).all(userId, userId, userId);

  res.json({ conversations: phones });
});

// Get messages for a specific phone
router.get('/conversations/:phone', (req, res) => {
  const userId = req.user.id;
  const phone = req.params.phone;
  const messages = db.prepare(
    'SELECT id, direction, message, created_at FROM chat_logs WHERE user_id = ? AND phone = ? ORDER BY created_at ASC LIMIT 500'
  ).all(userId, phone);

  // Try to get contact name from contacts table
  const contact = db.prepare('SELECT name FROM contacts WHERE user_id = ? AND phone LIKE ? LIMIT 1').get(userId, `%${phone.slice(-10)}%`);

  res.json({ phone, name: contact?.name || null, messages });
});

// Delete conversation for a phone
router.delete('/conversations/:phone', (req, res) => {
  db.prepare('DELETE FROM chat_logs WHERE user_id = ? AND phone = ?').run(req.user.id, req.params.phone);
  res.json({ success: true });
});

// ── Conversation Status (Completed / Expired / Active) ──

// Get conversation statuses
router.get('/conversation-status', (req, res) => {
  const userId = req.user.id;
  const { status } = req.query; // 'completed', 'expired', 'active', or empty for all

  let query = `
    SELECT cs.*, cf.name as flow_name
    FROM conversation_status cs
    LEFT JOIN chatbot_flows cf ON cs.flow_id = cf.id
    WHERE cs.user_id = ?
  `;
  const params = [userId];

  if (status) {
    query += ' AND cs.status = ?';
    params.push(status);
  }
  query += ' ORDER BY cs.completed_at DESC, cs.started_at DESC';

  const rows = db.prepare(query).all(...params);

  // Get contact names
  const result = rows.map(r => {
    const contact = db.prepare('SELECT name FROM contacts WHERE user_id = ? AND phone LIKE ? LIMIT 1').get(userId, `%${r.phone.slice(-10)}%`);
    return { ...r, contact_name: contact?.name || null };
  });

  const counts = {
    active: db.prepare('SELECT COUNT(*) as c FROM conversation_status WHERE user_id = ? AND status = ?').get(userId, 'active').c,
    completed: db.prepare('SELECT COUNT(*) as c FROM conversation_status WHERE user_id = ? AND status = ?').get(userId, 'completed').c,
    expired: db.prepare('SELECT COUNT(*) as c FROM conversation_status WHERE user_id = ? AND status = ?').get(userId, 'expired').c,
  };

  res.json({ contacts: result, counts });
});

export default router;
