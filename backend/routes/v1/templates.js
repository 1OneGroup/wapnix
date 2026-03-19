import { Router } from 'express';
import db from '../../db/database.js';

const router = Router();

function extractVariables(body) {
  return [...new Set([...body.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]))];
}

// GET /api/v1/templates - List all templates
router.get('/', (req, res) => {
  const templates = db.prepare('SELECT id, name, body, variables, category, created_at, updated_at FROM templates WHERE user_id = ? ORDER BY updated_at DESC').all(req.user.id);
  res.ok(templates.map(t => ({ ...t, variables: JSON.parse(t.variables || '[]') })));
});

// GET /api/v1/templates/:id - Get single template
router.get('/:id', (req, res) => {
  const tpl = db.prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!tpl) return res.fail(404, 'Template not found');
  res.ok({ ...tpl, variables: JSON.parse(tpl.variables || '[]') });
});

// POST /api/v1/templates - Create template
router.post('/', (req, res) => {
  const { name, body, category } = req.body;
  if (!name || !body) return res.fail(400, 'Name and body are required');

  const count = db.prepare('SELECT COUNT(*) as cnt FROM templates WHERE user_id = ?').get(req.user.id).cnt;
  if (count >= req.user.max_templates) {
    return res.fail(403, `Template limit (${req.user.max_templates}) reached. Upgrade plan.`);
  }

  const variables = JSON.stringify(extractVariables(body));
  try {
    const result = db.prepare(
      'INSERT INTO templates (user_id, name, body, variables, category) VALUES (?, ?, ?, ?, ?)'
    ).run(req.user.id, name, body, variables, category || 'general');
    res.ok({ id: Number(result.lastInsertRowid), name, body, variables: JSON.parse(variables), category: category || 'general' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.fail(409, 'Template name already exists');
    res.fail(500, err.message);
  }
});

// PUT /api/v1/templates/:id - Update template
router.put('/:id', (req, res) => {
  const { name, body, category } = req.body;
  const tpl = db.prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!tpl) return res.fail(404, 'Template not found');

  const newBody = body || tpl.body;
  const variables = JSON.stringify(extractVariables(newBody));
  const now = new Date().toISOString();

  db.prepare(
    'UPDATE templates SET name = ?, body = ?, variables = ?, category = ?, updated_at = ? WHERE id = ?'
  ).run(name || tpl.name, newBody, variables, category || tpl.category, now, tpl.id);

  res.ok({ id: tpl.id, name: name || tpl.name, body: newBody, variables: JSON.parse(variables) });
});

// DELETE /api/v1/templates/:id - Delete template
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM templates WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (result.changes === 0) return res.fail(404, 'Template not found');
  res.ok({ deleted: true });
});

export default router;
