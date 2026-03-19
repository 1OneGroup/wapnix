import { Router } from 'express';
import db from '../../db/database.js';
import { paginate } from '../../middleware/responseWrapper.js';

const router = Router();

// GET /api/v1/leads - List website leads (paginated)
router.get('/', (req, res) => {
  const userId = req.user.id;
  const { status } = req.query;

  let whereClause = 'WHERE user_id = ?';
  const params = [userId];
  if (status && status !== 'all') {
    whereClause += ' AND status = ?';
    params.push(status);
  }

  const { rows, meta } = paginate(
    db,
    `SELECT COUNT(*) as total FROM website_leads ${whereClause}`,
    `SELECT * FROM website_leads ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    params,
    req.query
  );

  const counts = {
    new: db.prepare('SELECT COUNT(*) as c FROM website_leads WHERE user_id = ? AND status = ?').get(userId, 'new').c,
    contacted: db.prepare('SELECT COUNT(*) as c FROM website_leads WHERE user_id = ? AND status = ?').get(userId, 'contacted').c,
    converted: db.prepare('SELECT COUNT(*) as c FROM website_leads WHERE user_id = ? AND status = ?').get(userId, 'converted').c,
    ignored: db.prepare('SELECT COUNT(*) as c FROM website_leads WHERE user_id = ? AND status = ?').get(userId, 'ignored').c,
  };

  res.ok({ leads: rows, counts }, meta);
});

// GET /api/v1/leads/:id - Get single lead
router.get('/:id', (req, res) => {
  const lead = db.prepare('SELECT * FROM website_leads WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!lead) return res.fail(404, 'Lead not found');
  res.ok({ ...lead, extra_data: JSON.parse(lead.extra_data || '{}') });
});

// PUT /api/v1/leads/:id/status - Update lead status
router.put('/:id/status', (req, res) => {
  const { status } = req.body;
  if (!['new', 'contacted', 'converted', 'ignored'].includes(status)) {
    return res.fail(400, 'Invalid status. Must be: new, contacted, converted, or ignored');
  }
  const info = db.prepare('UPDATE website_leads SET status = ? WHERE id = ? AND user_id = ?').run(status, req.params.id, req.user.id);
  if (info.changes === 0) return res.fail(404, 'Lead not found');
  res.ok({ id: parseInt(req.params.id), status });
});

// DELETE /api/v1/leads/:id - Delete lead
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM website_leads WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (result.changes === 0) return res.fail(404, 'Lead not found');
  res.ok({ deleted: true });
});

// GET /api/v1/leads/auto-send - Get auto-send settings
router.get('/auto-send', (req, res) => {
  const settings = db.prepare('SELECT * FROM website_auto_send WHERE user_id = ?').get(req.user.id);
  res.ok(settings || { mode: 'off', message_template: '', flow_id: null, var_mapping: '{}' });
});

// PUT /api/v1/leads/auto-send - Update auto-send settings
router.put('/auto-send', (req, res) => {
  const { mode, message_template, flow_id, var_mapping, email_enabled, email_subject, email_body } = req.body;
  const existing = db.prepare('SELECT id FROM website_auto_send WHERE user_id = ?').get(req.user.id);
  if (existing) {
    db.prepare('UPDATE website_auto_send SET mode = ?, message_template = ?, flow_id = ?, var_mapping = ?, email_enabled = ?, email_subject = ?, email_body = ? WHERE user_id = ?')
      .run(mode || 'off', message_template || '', flow_id || null, var_mapping || '{}', email_enabled ? 1 : 0, email_subject || '', email_body || '', req.user.id);
  } else {
    db.prepare('INSERT INTO website_auto_send (user_id, mode, message_template, flow_id, var_mapping, email_enabled, email_subject, email_body) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(req.user.id, mode || 'off', message_template || '', flow_id || null, var_mapping || '{}', email_enabled ? 1 : 0, email_subject || '', email_body || '');
  }
  res.ok({ updated: true });
});

export default router;
