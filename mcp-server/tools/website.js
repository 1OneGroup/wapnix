import { z } from 'zod';
import { getDb } from '../db.js';

export function registerWebsiteTools(server, getUserId) {
  server.tool('list_website_leads', 'List website leads with optional status filter', {
    status: z.string().optional().describe('Filter: new, contacted, converted, ignored'),
    limit: z.number().optional().default(50),
  }, async ({ status, limit }) => {
    const db = getDb();
    const userId = getUserId();

    let where = 'WHERE user_id = ?';
    const params = [userId];
    if (status) { where += ' AND status = ?'; params.push(status); }

    const leads = db.prepare(`SELECT * FROM website_leads ${where} ORDER BY created_at DESC LIMIT ?`).all(...params, limit);
    const counts = {
      new: db.prepare("SELECT COUNT(*) as c FROM website_leads WHERE user_id = ? AND status = 'new'").get(userId).c,
      contacted: db.prepare("SELECT COUNT(*) as c FROM website_leads WHERE user_id = ? AND status = 'contacted'").get(userId).c,
      converted: db.prepare("SELECT COUNT(*) as c FROM website_leads WHERE user_id = ? AND status = 'converted'").get(userId).c,
      ignored: db.prepare("SELECT COUNT(*) as c FROM website_leads WHERE user_id = ? AND status = 'ignored'").get(userId).c,
    };

    return { content: [{ type: 'text', text: JSON.stringify({ leads, counts }, null, 2) }] };
  });

  server.tool('update_lead_status', 'Update a website lead status', {
    id: z.number().describe('Lead ID'),
    status: z.enum(['new', 'contacted', 'converted', 'ignored']).describe('New status'),
  }, async ({ id, status }) => {
    const db = getDb();
    const info = db.prepare('UPDATE website_leads SET status = ? WHERE id = ? AND user_id = ?').run(status, id, getUserId());
    if (info.changes === 0) return { content: [{ type: 'text', text: 'Error: Lead not found' }], isError: true };
    return { content: [{ type: 'text', text: JSON.stringify({ id, status }) }] };
  });

  server.tool('delete_lead', 'Delete a website lead', {
    id: z.number().describe('Lead ID'),
  }, async ({ id }) => {
    const db = getDb();
    const result = db.prepare('DELETE FROM website_leads WHERE id = ? AND user_id = ?').run(id, getUserId());
    if (result.changes === 0) return { content: [{ type: 'text', text: 'Error: Lead not found' }], isError: true };
    return { content: [{ type: 'text', text: JSON.stringify({ deleted: true }) }] };
  });

  server.tool('get_auto_send_settings', 'Get website auto-send configuration', {}, async () => {
    const db = getDb();
    const settings = db.prepare('SELECT * FROM website_auto_send WHERE user_id = ?').get(getUserId());
    return { content: [{ type: 'text', text: JSON.stringify(settings || { mode: 'off', message_template: '', flow_id: null }, null, 2) }] };
  });

  server.tool('update_auto_send_settings', 'Update website auto-send mode and template', {
    mode: z.enum(['off', 'message', 'chatbot']).describe('Auto-send mode'),
    message_template: z.string().optional().default(''),
    flow_id: z.number().optional().describe('Chatbot flow ID for chatbot mode'),
  }, async ({ mode, message_template, flow_id }) => {
    const db = getDb();
    const userId = getUserId();
    const existing = db.prepare('SELECT id FROM website_auto_send WHERE user_id = ?').get(userId);
    if (existing) {
      db.prepare('UPDATE website_auto_send SET mode = ?, message_template = ?, flow_id = ? WHERE user_id = ?').run(mode, message_template, flow_id || null, userId);
    } else {
      db.prepare('INSERT INTO website_auto_send (user_id, mode, message_template, flow_id) VALUES (?, ?, ?, ?)').run(userId, mode, message_template, flow_id || null);
    }
    return { content: [{ type: 'text', text: JSON.stringify({ updated: true, mode }) }] };
  });
}
