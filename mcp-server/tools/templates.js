import { z } from 'zod';
import { getDb } from '../db.js';

export function registerTemplateTools(server, getUserId) {
  server.tool('list_templates', 'List all message templates', {}, async () => {
    const db = getDb();
    const templates = db.prepare('SELECT id, name, body, variables, category, created_at, updated_at FROM templates WHERE user_id = ? ORDER BY updated_at DESC').all(getUserId());
    return { content: [{ type: 'text', text: JSON.stringify(templates.map(t => ({ ...t, variables: JSON.parse(t.variables || '[]') })), null, 2) }] };
  });

  server.tool('get_template', 'Get a single template by ID', {
    id: z.number().describe('Template ID'),
  }, async ({ id }) => {
    const db = getDb();
    const tpl = db.prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?').get(id, getUserId());
    if (!tpl) return { content: [{ type: 'text', text: 'Error: Template not found' }], isError: true };
    return { content: [{ type: 'text', text: JSON.stringify({ ...tpl, variables: JSON.parse(tpl.variables || '[]') }, null, 2) }] };
  });

  server.tool('create_template', 'Create a new message template', {
    name: z.string().describe('Template name'),
    body: z.string().describe('Template body. Use {{variable}} for placeholders'),
    category: z.string().optional().default('general'),
  }, async ({ name, body, category }) => {
    const db = getDb();
    const variables = JSON.stringify([...new Set([...body.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]))]);
    try {
      const result = db.prepare('INSERT INTO templates (user_id, name, body, variables, category) VALUES (?, ?, ?, ?, ?)').run(getUserId(), name, body, variables, category);
      return { content: [{ type: 'text', text: JSON.stringify({ id: Number(result.lastInsertRowid), name, body, variables: JSON.parse(variables) }) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message.includes('UNIQUE') ? 'Template name already exists' : err.message}` }], isError: true };
    }
  });

  server.tool('update_template', 'Update a template', {
    id: z.number().describe('Template ID'),
    name: z.string().optional(),
    body: z.string().optional(),
    category: z.string().optional(),
  }, async ({ id, name, body, category }) => {
    const db = getDb();
    const tpl = db.prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?').get(id, getUserId());
    if (!tpl) return { content: [{ type: 'text', text: 'Error: Template not found' }], isError: true };

    const newBody = body || tpl.body;
    const variables = JSON.stringify([...new Set([...newBody.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]))]);
    db.prepare('UPDATE templates SET name = ?, body = ?, variables = ?, category = ?, updated_at = ? WHERE id = ?')
      .run(name || tpl.name, newBody, variables, category || tpl.category, new Date().toISOString(), id);
    return { content: [{ type: 'text', text: JSON.stringify({ id, updated: true }) }] };
  });

  server.tool('delete_template', 'Delete a template', {
    id: z.number().describe('Template ID'),
  }, async ({ id }) => {
    const db = getDb();
    const result = db.prepare('DELETE FROM templates WHERE id = ? AND user_id = ?').run(id, getUserId());
    if (result.changes === 0) return { content: [{ type: 'text', text: 'Error: Template not found' }], isError: true };
    return { content: [{ type: 'text', text: JSON.stringify({ deleted: true }) }] };
  });
}
