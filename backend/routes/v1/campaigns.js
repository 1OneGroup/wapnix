import { Router } from 'express';
import db from '../../db/database.js';
import { v4 as uuidv4 } from 'uuid';
import { paginate } from '../../middleware/responseWrapper.js';

const router = Router();

// GET /api/v1/campaigns - List all campaigns
router.get('/', (req, res) => {
  const campaigns = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM campaign_steps WHERE campaign_id = c.id) as step_count,
      (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = c.id) as contact_count,
      (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = c.id AND status = 'active') as active_contacts,
      (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = c.id AND status = 'completed') as completed_contacts,
      (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = c.id AND status = 'stopped') as stopped_contacts
    FROM campaigns c
    WHERE c.user_id = ?
    ORDER BY c.updated_at DESC
  `).all(req.user.id);

  res.ok(campaigns.map(c => ({
    ...c,
    stop_keywords: JSON.parse(c.stop_keywords || '[]'),
    stop_chatbot_steps: JSON.parse(c.stop_chatbot_steps || '[]'),
  })));
});

// GET /api/v1/campaigns/:id - Get campaign with steps and stats
router.get('/:id', (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!campaign) return res.fail(404, 'Campaign not found');

  const steps = db.prepare(`
    SELECT cs.*, cf.name as flow_name
    FROM campaign_steps cs
    LEFT JOIN chatbot_flows cf ON cs.flow_id = cf.id
    WHERE cs.campaign_id = ?
    ORDER BY cs.step_order ASC
  `).all(campaign.id);

  const stepStats = steps.map(step => {
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_sent,
        SUM(CASE WHEN status IN ('sent','delivered','replied') THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'replied' THEN 1 ELSE 0 END) as replied,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM campaign_step_logs
      WHERE campaign_id = ? AND step_id = ?
    `).get(campaign.id, step.id);
    return { ...step, stats };
  });

  const contactCounts = {
    total: db.prepare('SELECT COUNT(*) as c FROM campaign_contacts WHERE campaign_id = ?').get(campaign.id).c,
    active: db.prepare("SELECT COUNT(*) as c FROM campaign_contacts WHERE campaign_id = ? AND status = 'active'").get(campaign.id).c,
    completed: db.prepare("SELECT COUNT(*) as c FROM campaign_contacts WHERE campaign_id = ? AND status = 'completed'").get(campaign.id).c,
    stopped: db.prepare("SELECT COUNT(*) as c FROM campaign_contacts WHERE campaign_id = ? AND status = 'stopped'").get(campaign.id).c,
  };

  res.ok({
    ...campaign,
    stop_keywords: JSON.parse(campaign.stop_keywords || '[]'),
    stop_chatbot_steps: JSON.parse(campaign.stop_chatbot_steps || '[]'),
    steps: stepStats,
    contactCounts,
  });
});

// POST /api/v1/campaigns - Create campaign
router.post('/', (req, res) => {
  const { name, description, steps, stop_keywords, stop_chatbot_steps } = req.body;
  if (!name) return res.fail(400, 'Campaign name is required');
  if (!steps || !Array.isArray(steps) || steps.length === 0) {
    return res.fail(400, 'At least one step is required');
  }

  const webhookToken = uuidv4();

  const result = db.prepare(`
    INSERT INTO campaigns (user_id, name, description, stop_keywords, stop_chatbot_steps, webhook_token)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    req.user.id, name, description || '',
    JSON.stringify(stop_keywords || []),
    JSON.stringify(stop_chatbot_steps || []),
    webhookToken
  );

  const campaignId = Number(result.lastInsertRowid);

  const insertStep = db.prepare(`
    INSERT INTO campaign_steps (campaign_id, step_order, day_offset, send_time, step_type, message_text, flow_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    insertStep.run(campaignId, i + 1, s.day_offset || 0, s.send_time || '10:00', s.step_type, s.message_text || null, s.flow_id || null);
  }

  res.ok({ id: campaignId, webhook_token: webhookToken });
});

// PUT /api/v1/campaigns/:id - Update campaign
router.put('/:id', (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!campaign) return res.fail(404, 'Campaign not found');

  const { name, description, steps, stop_keywords, stop_chatbot_steps } = req.body;

  db.prepare(`
    UPDATE campaigns SET name = ?, description = ?, stop_keywords = ?, stop_chatbot_steps = ?, updated_at = ?
    WHERE id = ?
  `).run(
    name || campaign.name,
    description ?? campaign.description,
    JSON.stringify(stop_keywords || JSON.parse(campaign.stop_keywords || '[]')),
    JSON.stringify(stop_chatbot_steps || JSON.parse(campaign.stop_chatbot_steps || '[]')),
    new Date().toISOString(),
    campaign.id
  );

  if (steps && Array.isArray(steps)) {
    db.prepare('DELETE FROM campaign_steps WHERE campaign_id = ?').run(campaign.id);
    const insertStep = db.prepare(`
      INSERT INTO campaign_steps (campaign_id, step_order, day_offset, send_time, step_type, message_text, flow_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      insertStep.run(campaign.id, i + 1, s.day_offset || 0, s.send_time || '10:00', s.step_type, s.message_text || null, s.flow_id || null);
    }
  }

  res.ok({ id: campaign.id, name: name || campaign.name });
});

// DELETE /api/v1/campaigns/:id - Delete campaign
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM campaigns WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (result.changes === 0) return res.fail(404, 'Campaign not found');
  res.ok({ deleted: true });
});

// POST /api/v1/campaigns/:id/activate - Activate campaign
router.post('/:id/activate', (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!campaign) return res.fail(404, 'Campaign not found');

  const stepCount = db.prepare('SELECT COUNT(*) as c FROM campaign_steps WHERE campaign_id = ?').get(campaign.id).c;
  if (stepCount === 0) return res.fail(400, 'Campaign must have at least one step');

  db.prepare("UPDATE campaigns SET status = 'active', updated_at = ? WHERE id = ?")
    .run(new Date().toISOString(), campaign.id);

  res.ok({ id: campaign.id, status: 'active' });
});

// POST /api/v1/campaigns/:id/pause - Pause campaign
router.post('/:id/pause', (req, res) => {
  const info = db.prepare("UPDATE campaigns SET status = 'paused', updated_at = ? WHERE id = ? AND user_id = ? AND status = 'active'")
    .run(new Date().toISOString(), req.params.id, req.user.id);
  if (info.changes === 0) return res.fail(404, 'Campaign not found or not active');
  res.ok({ id: parseInt(req.params.id), status: 'paused' });
});

// POST /api/v1/campaigns/:id/resume - Resume campaign
router.post('/:id/resume', (req, res) => {
  const info = db.prepare("UPDATE campaigns SET status = 'active', updated_at = ? WHERE id = ? AND user_id = ? AND status = 'paused'")
    .run(new Date().toISOString(), req.params.id, req.user.id);
  if (info.changes === 0) return res.fail(404, 'Campaign not found or not paused');
  res.ok({ id: parseInt(req.params.id), status: 'active' });
});

// POST /api/v1/campaigns/:id/enroll - Enroll contacts
router.post('/:id/enroll', (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!campaign) return res.fail(404, 'Campaign not found');

  const { contacts } = req.body;
  if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
    return res.fail(400, 'Contacts array required');
  }

  const insertContact = db.prepare(`
    INSERT OR IGNORE INTO campaign_contacts (campaign_id, phone, contact_data, status)
    VALUES (?, ?, ?, 'active')
  `);

  let enrolled = 0, skipped = 0;
  for (const c of contacts) {
    const phone = String(c.phone || '').replace(/\D/g, '');
    if (!phone || phone.length < 10) { skipped++; continue; }
    const data = { ...c };
    delete data.phone;
    try {
      const info = insertContact.run(campaign.id, phone, JSON.stringify(data));
      if (info.changes > 0) enrolled++; else skipped++;
    } catch { skipped++; }
  }

  res.ok({ enrolled, skipped, total: contacts.length });
});

// GET /api/v1/campaigns/:id/contacts - List enrolled contacts
router.get('/:id/contacts', (req, res) => {
  const campaign = db.prepare('SELECT id FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!campaign) return res.fail(404, 'Campaign not found');

  const { status } = req.query;
  let query = 'SELECT * FROM campaign_contacts WHERE campaign_id = ?';
  const params = [campaign.id];
  if (status) { query += ' AND status = ?'; params.push(status); }
  query += ' ORDER BY enrolled_at DESC';

  const contacts = db.prepare(query).all(...params);
  res.ok(contacts.map(c => ({ ...c, contact_data: JSON.parse(c.contact_data || '{}') })));
});

// POST /api/v1/campaigns/:id/contacts/:contactId/stop - Stop a contact
router.post('/:id/contacts/:contactId/stop', (req, res) => {
  const campaign = db.prepare('SELECT id FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!campaign) return res.fail(404, 'Campaign not found');

  db.prepare("UPDATE campaign_contacts SET status = 'stopped', stop_reason = 'manual' WHERE id = ? AND campaign_id = ?")
    .run(req.params.contactId, campaign.id);

  res.ok({ stopped: true });
});

// GET /api/v1/campaigns/:id/logs - Campaign step logs
router.get('/:id/logs', (req, res) => {
  const campaign = db.prepare('SELECT id FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!campaign) return res.fail(404, 'Campaign not found');

  const logs = db.prepare(`
    SELECT csl.*, cs.step_order, cs.step_type, cs.day_offset
    FROM campaign_step_logs csl
    JOIN campaign_steps cs ON csl.step_id = cs.id
    WHERE csl.campaign_id = ?
    ORDER BY csl.sent_at DESC
    LIMIT 500
  `).all(campaign.id);

  res.ok(logs);
});

export default router;
