import { z } from 'zod';
import { getDb } from '../db.js';
import { apiRequest } from '../lib/http-client.js';

export function registerMessageTools(server, getUserId) {
  server.tool('send_message', 'Send a single WhatsApp message (requires Wapnix server running)', {
    phone: z.string().describe('Phone number to send to'),
    message: z.string().optional().describe('Message text'),
    template_id: z.number().optional().describe('Template ID to use instead of message'),
    variables: z.record(z.string()).optional().describe('Variables for template substitution'),
  }, async (params) => {
    try {
      const result = await apiRequest('POST', '/api/v1/messages/send', params);
      return { content: [{ type: 'text', text: JSON.stringify(result.data || result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  });

  server.tool('send_bulk_messages', 'Send bulk WhatsApp messages (requires Wapnix server running)', {
    contacts: z.array(z.object({
      phone: z.string(),
      name: z.string().optional(),
    }).passthrough()).describe('Array of contacts with phone and optional fields'),
    message: z.string().optional().describe('Message text with {{variable}} placeholders'),
    template_id: z.number().optional().describe('Template ID to use'),
    variables: z.record(z.string()).optional(),
  }, async (params) => {
    try {
      const result = await apiRequest('POST', '/api/v1/messages/send-bulk', params);
      return { content: [{ type: 'text', text: JSON.stringify(result.data || result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  });

  server.tool('get_message_status', 'Get status of a sent message', {
    id: z.number().describe('Message ID'),
  }, async ({ id }) => {
    const db = getDb();
    const msg = db.prepare(
      'SELECT id, phone, body, status, error_message, batch_id, sent_at, created_at FROM messages WHERE id = ? AND user_id = ?'
    ).get(id, getUserId());
    if (!msg) return { content: [{ type: 'text', text: 'Error: Message not found' }], isError: true };
    return { content: [{ type: 'text', text: JSON.stringify(msg, null, 2) }] };
  });

  server.tool('get_batch_status', 'Get status of a bulk send batch', {
    batch_id: z.string().describe('Batch ID'),
  }, async ({ batch_id }) => {
    const db = getDb();
    const messages = db.prepare(
      'SELECT id, phone, status, error_message, sent_at FROM messages WHERE batch_id = ? AND user_id = ? ORDER BY created_at ASC'
    ).all(batch_id, getUserId());

    return { content: [{ type: 'text', text: JSON.stringify({
      batch_id,
      total: messages.length,
      sent: messages.filter(m => m.status === 'sent').length,
      failed: messages.filter(m => m.status === 'failed').length,
      queued: messages.filter(m => m.status === 'queued').length,
      messages,
    }, null, 2) }] };
  });

  server.tool('message_history', 'Query message history with filters', {
    status: z.string().optional().describe('Filter by status: queued, sent, failed, cancelled'),
    phone: z.string().optional().describe('Filter by phone number (partial match)'),
    from_date: z.string().optional().describe('Start date (YYYY-MM-DD)'),
    to_date: z.string().optional().describe('End date (YYYY-MM-DD)'),
    limit: z.number().optional().default(50),
  }, async ({ status, phone, from_date, to_date, limit }) => {
    const db = getDb();
    const userId = getUserId();
    let where = 'WHERE user_id = ?';
    const params = [userId];

    if (status) { where += ' AND status = ?'; params.push(status); }
    if (phone) { where += ' AND phone LIKE ?'; params.push(`%${phone}%`); }
    if (from_date) { where += ' AND created_at >= ?'; params.push(from_date); }
    if (to_date) { where += ' AND created_at <= ?'; params.push(to_date + 'T23:59:59'); }

    const messages = db.prepare(
      `SELECT id, phone, body, status, error_message, batch_id, sent_at, created_at FROM messages ${where} ORDER BY created_at DESC LIMIT ?`
    ).all(...params, limit);

    return { content: [{ type: 'text', text: JSON.stringify({ count: messages.length, messages }, null, 2) }] };
  });
}
