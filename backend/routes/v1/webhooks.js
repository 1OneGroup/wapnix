import { Router } from 'express';
import db from '../../db/database.js';
import crypto from 'crypto';

const router = Router();

// GET /api/v1/webhooks - List registered webhooks
router.get('/', (req, res) => {
  const webhooks = db.prepare('SELECT id, url, events, is_active, created_at FROM webhooks WHERE user_id = ?').all(req.user.id);
  res.ok(webhooks.map(w => ({ ...w, events: JSON.parse(w.events || '["*"]') })));
});

// POST /api/v1/webhooks - Register webhook
router.post('/', (req, res) => {
  const { url, events } = req.body;
  if (!url) return res.fail(400, 'Webhook URL is required');

  const secret = crypto.randomBytes(32).toString('hex');
  const eventsJson = JSON.stringify(events || ['*']);

  const result = db.prepare(
    'INSERT INTO webhooks (user_id, url, events, secret) VALUES (?, ?, ?, ?)'
  ).run(req.user.id, url, eventsJson, secret);

  res.ok({
    id: Number(result.lastInsertRowid),
    url,
    events: events || ['*'],
    secret,
  });
});

// DELETE /api/v1/webhooks/:id - Remove webhook
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM webhooks WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (result.changes === 0) return res.fail(404, 'Webhook not found');
  res.ok({ deleted: true });
});

export default router;
