import { Router } from 'express';
import db from '../../db/database.js';
import { getActiveConversations, resetConversation } from '../../services/chatbotEngine.js';
import { paginate } from '../../middleware/responseWrapper.js';

const router = Router();

// GET /api/v1/chatbot/flows - List all chatbot flows
router.get('/flows', (req, res) => {
  const flows = db.prepare(
    'SELECT id, name, description, is_active, created_at, updated_at FROM chatbot_flows WHERE user_id = ? ORDER BY updated_at DESC'
  ).all(req.user.id);
  res.ok(flows);
});

// GET /api/v1/chatbot/flows/:id - Get single flow with steps
router.get('/flows/:id', (req, res) => {
  const flow = db.prepare('SELECT * FROM chatbot_flows WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!flow) return res.fail(404, 'Flow not found');
  res.ok({ ...flow, steps: JSON.parse(flow.steps_json) });
});

// POST /api/v1/chatbot/flows - Create flow
router.post('/flows', (req, res) => {
  const { name, description, steps } = req.body;
  if (!name || !steps) return res.fail(400, 'Name and steps are required');

  const result = db.prepare(
    'INSERT INTO chatbot_flows (user_id, name, description, steps_json) VALUES (?, ?, ?, ?)'
  ).run(req.user.id, name, description || '', JSON.stringify(steps));

  res.ok({ id: Number(result.lastInsertRowid), name });
});

// PUT /api/v1/chatbot/flows/:id - Update flow
router.put('/flows/:id', (req, res) => {
  const { name, description, steps } = req.body;
  const flow = db.prepare('SELECT * FROM chatbot_flows WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!flow) return res.fail(404, 'Flow not found');

  db.prepare(
    'UPDATE chatbot_flows SET name = ?, description = ?, steps_json = ?, updated_at = ? WHERE id = ?'
  ).run(
    name || flow.name,
    description ?? flow.description,
    steps ? JSON.stringify(steps) : flow.steps_json,
    new Date().toISOString(),
    flow.id
  );

  res.ok({ id: flow.id, name: name || flow.name });
});

// DELETE /api/v1/chatbot/flows/:id - Delete flow
router.delete('/flows/:id', (req, res) => {
  const result = db.prepare('DELETE FROM chatbot_flows WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (result.changes === 0) return res.fail(404, 'Flow not found');
  res.ok({ deleted: true });
});

// POST /api/v1/chatbot/flows/:id/activate - Activate flow
router.post('/flows/:id/activate', (req, res) => {
  const flow = db.prepare('SELECT * FROM chatbot_flows WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!flow) return res.fail(404, 'Flow not found');

  db.prepare('UPDATE chatbot_flows SET is_active = 0 WHERE user_id = ?').run(req.user.id);
  db.prepare('UPDATE chatbot_flows SET is_active = 1 WHERE id = ?').run(flow.id);

  res.ok({ id: flow.id, name: flow.name, is_active: true });
});

// POST /api/v1/chatbot/flows/deactivate - Deactivate all flows
router.post('/flows/deactivate', (req, res) => {
  db.prepare('UPDATE chatbot_flows SET is_active = 0 WHERE user_id = ?').run(req.user.id);
  res.ok({ deactivated: true });
});

// GET /api/v1/chatbot/conversations - List conversations (from chat_logs)
router.get('/conversations', (req, res) => {
  const userId = req.user.id;
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

  res.ok(phones);
});

// GET /api/v1/chatbot/conversations/:phone - Get messages for a phone
router.get('/conversations/:phone', (req, res) => {
  const userId = req.user.id;
  const phone = req.params.phone;
  const messages = db.prepare(
    'SELECT id, direction, message, created_at FROM chat_logs WHERE user_id = ? AND phone = ? ORDER BY created_at ASC LIMIT 500'
  ).all(userId, phone);

  const contact = db.prepare('SELECT name FROM contacts WHERE user_id = ? AND phone LIKE ? LIMIT 1').get(userId, `%${phone.slice(-10)}%`);

  res.ok({ phone, name: contact?.name || null, messages });
});

// POST /api/v1/chatbot/conversations/:phone/reset - Reset conversation
router.post('/conversations/:phone/reset', (req, res) => {
  resetConversation(req.user.id, req.params.phone);
  res.ok({ reset: true, phone: req.params.phone });
});

// GET /api/v1/chatbot/conversations/active - Active in-memory conversations
router.get('/conversations/active', (req, res) => {
  const convs = getActiveConversations(req.user.id);
  res.ok(convs);
});

// GET /api/v1/chatbot/conversation-status - Conversation outcomes
router.get('/conversation-status', (req, res) => {
  const userId = req.user.id;
  const { status } = req.query;

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
  query += ' ORDER BY cs.completed_at DESC, cs.started_at DESC LIMIT 200';

  const rows = db.prepare(query).all(...params);

  const counts = {
    active: db.prepare('SELECT COUNT(*) as c FROM conversation_status WHERE user_id = ? AND status = ?').get(userId, 'active').c,
    completed: db.prepare('SELECT COUNT(*) as c FROM conversation_status WHERE user_id = ? AND status = ?').get(userId, 'completed').c,
    expired: db.prepare('SELECT COUNT(*) as c FROM conversation_status WHERE user_id = ? AND status = ?').get(userId, 'expired').c,
  };

  res.ok({ contacts: rows, counts });
});

export default router;
