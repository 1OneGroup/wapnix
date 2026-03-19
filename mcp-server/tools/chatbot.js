import { z } from 'zod';
import { getDb } from '../db.js';

export function registerChatbotTools(server, getUserId) {
  server.tool('list_chatbot_flows', 'List all chatbot flows', {}, async () => {
    const db = getDb();
    const flows = db.prepare('SELECT id, name, description, is_active, created_at, updated_at FROM chatbot_flows WHERE user_id = ? ORDER BY updated_at DESC').all(getUserId());
    return { content: [{ type: 'text', text: JSON.stringify(flows, null, 2) }] };
  });

  server.tool('get_chatbot_flow', 'Get a single chatbot flow with its steps', {
    id: z.number().describe('Flow ID'),
  }, async ({ id }) => {
    const db = getDb();
    const flow = db.prepare('SELECT * FROM chatbot_flows WHERE id = ? AND user_id = ?').get(id, getUserId());
    if (!flow) return { content: [{ type: 'text', text: 'Error: Flow not found' }], isError: true };
    return { content: [{ type: 'text', text: JSON.stringify({ ...flow, steps: JSON.parse(flow.steps_json) }, null, 2) }] };
  });

  server.tool('create_chatbot_flow', 'Create a new chatbot flow with steps', {
    name: z.string().describe('Flow name'),
    description: z.string().optional().default(''),
    steps: z.array(z.any()).describe('Array of flow step objects (each with id, message, options, etc.)'),
  }, async ({ name, description, steps }) => {
    const db = getDb();
    const result = db.prepare('INSERT INTO chatbot_flows (user_id, name, description, steps_json) VALUES (?, ?, ?, ?)').run(getUserId(), name, description, JSON.stringify(steps));
    return { content: [{ type: 'text', text: JSON.stringify({ id: Number(result.lastInsertRowid), name }) }] };
  });

  server.tool('update_chatbot_flow', 'Update a chatbot flow', {
    id: z.number().describe('Flow ID'),
    name: z.string().optional(),
    description: z.string().optional(),
    steps: z.array(z.any()).optional().describe('Updated flow steps'),
  }, async ({ id, name, description, steps }) => {
    const db = getDb();
    const flow = db.prepare('SELECT * FROM chatbot_flows WHERE id = ? AND user_id = ?').get(id, getUserId());
    if (!flow) return { content: [{ type: 'text', text: 'Error: Flow not found' }], isError: true };

    db.prepare('UPDATE chatbot_flows SET name = ?, description = ?, steps_json = ?, updated_at = ? WHERE id = ?').run(
      name || flow.name, description ?? flow.description, steps ? JSON.stringify(steps) : flow.steps_json, new Date().toISOString(), id
    );
    return { content: [{ type: 'text', text: JSON.stringify({ id, updated: true }) }] };
  });

  server.tool('delete_chatbot_flow', 'Delete a chatbot flow', {
    id: z.number().describe('Flow ID'),
  }, async ({ id }) => {
    const db = getDb();
    const result = db.prepare('DELETE FROM chatbot_flows WHERE id = ? AND user_id = ?').run(id, getUserId());
    if (result.changes === 0) return { content: [{ type: 'text', text: 'Error: Flow not found' }], isError: true };
    return { content: [{ type: 'text', text: JSON.stringify({ deleted: true }) }] };
  });

  server.tool('activate_chatbot_flow', 'Set a flow as the active chatbot flow (deactivates others)', {
    id: z.number().describe('Flow ID to activate'),
  }, async ({ id }) => {
    const db = getDb();
    const userId = getUserId();
    const flow = db.prepare('SELECT * FROM chatbot_flows WHERE id = ? AND user_id = ?').get(id, userId);
    if (!flow) return { content: [{ type: 'text', text: 'Error: Flow not found' }], isError: true };

    db.prepare('UPDATE chatbot_flows SET is_active = 0 WHERE user_id = ?').run(userId);
    db.prepare('UPDATE chatbot_flows SET is_active = 1 WHERE id = ?').run(id);
    return { content: [{ type: 'text', text: JSON.stringify({ id, name: flow.name, is_active: true }) }] };
  });

  server.tool('deactivate_chatbot_flows', 'Deactivate all chatbot flows', {}, async () => {
    const db = getDb();
    db.prepare('UPDATE chatbot_flows SET is_active = 0 WHERE user_id = ?').run(getUserId());
    return { content: [{ type: 'text', text: JSON.stringify({ deactivated: true }) }] };
  });

  server.tool('list_conversations', 'List all chatbot conversations grouped by phone', {}, async () => {
    const db = getDb();
    const userId = getUserId();
    const phones = db.prepare(`
      SELECT phone, COUNT(*) as total_messages, MAX(created_at) as last_activity,
        (SELECT message FROM chat_logs c2 WHERE c2.user_id = ? AND c2.phone = c1.phone ORDER BY created_at DESC LIMIT 1) as last_message
      FROM chat_logs c1 WHERE user_id = ? GROUP BY phone ORDER BY last_activity DESC
    `).all(userId, userId);
    return { content: [{ type: 'text', text: JSON.stringify(phones, null, 2) }] };
  });

  server.tool('get_conversation', 'Get messages for a specific phone conversation', {
    phone: z.string().describe('Phone number'),
  }, async ({ phone }) => {
    const db = getDb();
    const messages = db.prepare('SELECT id, direction, message, created_at FROM chat_logs WHERE user_id = ? AND phone = ? ORDER BY created_at ASC LIMIT 500').all(getUserId(), phone);
    return { content: [{ type: 'text', text: JSON.stringify({ phone, message_count: messages.length, messages }, null, 2) }] };
  });

  server.tool('get_conversation_status', 'Get chatbot conversation outcomes (active/completed/expired)', {
    status: z.string().optional().describe('Filter: active, completed, expired'),
  }, async ({ status }) => {
    const db = getDb();
    const userId = getUserId();
    let query = 'SELECT cs.*, cf.name as flow_name FROM conversation_status cs LEFT JOIN chatbot_flows cf ON cs.flow_id = cf.id WHERE cs.user_id = ?';
    const params = [userId];
    if (status) { query += ' AND cs.status = ?'; params.push(status); }
    query += ' ORDER BY cs.completed_at DESC, cs.started_at DESC LIMIT 200';

    const rows = db.prepare(query).all(...params);
    return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
  });
}
