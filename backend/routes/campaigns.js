import { Router } from 'express';
import db from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ── Campaign CRUD ──

// List all campaigns for user
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

  res.json({ campaigns });
});

// Get single campaign with steps and stats
router.get('/:id', (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const steps = db.prepare(`
    SELECT cs.*, cf.name as flow_name
    FROM campaign_steps cs
    LEFT JOIN chatbot_flows cf ON cs.flow_id = cf.id
    WHERE cs.campaign_id = ?
    ORDER BY cs.step_order ASC
  `).all(campaign.id);

  // Per-step analytics
  const stepStats = steps.map(step => {
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_sent,
        SUM(CASE WHEN status = 'sent' OR status = 'delivered' OR status = 'replied' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'replied' THEN 1 ELSE 0 END) as replied,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM campaign_step_logs
      WHERE campaign_id = ? AND step_id = ?
    `).get(campaign.id, step.id);
    return { ...step, stats };
  });

  const contactCounts = {
    total: db.prepare('SELECT COUNT(*) as c FROM campaign_contacts WHERE campaign_id = ?').get(campaign.id).c,
    active: db.prepare('SELECT COUNT(*) as c FROM campaign_contacts WHERE campaign_id = ? AND status = ?').get(campaign.id, 'active').c,
    completed: db.prepare('SELECT COUNT(*) as c FROM campaign_contacts WHERE campaign_id = ? AND status = ?').get(campaign.id, 'completed').c,
    stopped: db.prepare('SELECT COUNT(*) as c FROM campaign_contacts WHERE campaign_id = ? AND status = ?').get(campaign.id, 'stopped').c,
  };

  res.json({
    ...campaign,
    stop_keywords: JSON.parse(campaign.stop_keywords || '[]'),
    stop_chatbot_steps: JSON.parse(campaign.stop_chatbot_steps || '[]'),
    steps: stepStats,
    contactCounts,
  });
});

// Create campaign
router.post('/', (req, res) => {
  const { name, description, steps, stop_keywords, stop_chatbot_steps } = req.body;
  if (!name) return res.status(400).json({ error: 'Campaign name is required' });
  if (!steps || !Array.isArray(steps) || steps.length === 0) {
    return res.status(400).json({ error: 'At least one step is required' });
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

  const campaignId = result.lastInsertRowid;

  // Insert steps
  const insertStep = db.prepare(`
    INSERT INTO campaign_steps (campaign_id, step_order, day_offset, send_time, step_type, message_text, flow_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    insertStep.run(
      campaignId, i + 1, s.day_offset || 0, s.send_time || '10:00',
      s.step_type, s.message_text || null, s.flow_id || null
    );
  }

  res.status(201).json({ id: Number(campaignId), webhook_token: webhookToken });
});

// Update campaign
router.put('/:id', (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

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

  // Replace steps if provided
  if (steps && Array.isArray(steps)) {
    db.prepare('DELETE FROM campaign_steps WHERE campaign_id = ?').run(campaign.id);
    const insertStep = db.prepare(`
      INSERT INTO campaign_steps (campaign_id, step_order, day_offset, send_time, step_type, message_text, flow_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      insertStep.run(
        campaign.id, i + 1, s.day_offset || 0, s.send_time || '10:00',
        s.step_type, s.message_text || null, s.flow_id || null
      );
    }
  }

  res.json({ success: true });
});

// Delete campaign
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM campaigns WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Campaign not found' });
  res.json({ success: true });
});

// ── Campaign Status Changes ──

// Activate campaign
router.post('/:id/activate', (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const stepCount = db.prepare('SELECT COUNT(*) as c FROM campaign_steps WHERE campaign_id = ?').get(campaign.id).c;
  if (stepCount === 0) return res.status(400).json({ error: 'Campaign must have at least one step' });

  db.prepare("UPDATE campaigns SET status = 'active', updated_at = ? WHERE id = ?")
    .run(new Date().toISOString(), campaign.id);

  res.json({ success: true, status: 'active' });
});

// Pause campaign
router.post('/:id/pause', (req, res) => {
  const info = db.prepare("UPDATE campaigns SET status = 'paused', updated_at = ? WHERE id = ? AND user_id = ? AND status = 'active'")
    .run(new Date().toISOString(), req.params.id, req.user.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Campaign not found or not active' });
  res.json({ success: true, status: 'paused' });
});

// Resume campaign
router.post('/:id/resume', (req, res) => {
  const info = db.prepare("UPDATE campaigns SET status = 'active', updated_at = ? WHERE id = ? AND user_id = ? AND status = 'paused'")
    .run(new Date().toISOString(), req.params.id, req.user.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Campaign not found or not paused' });
  res.json({ success: true, status: 'active' });
});

// ── Contact Enrollment ──

// Enroll contacts via CSV/manual (array of contacts)
router.post('/:id/enroll', (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const { contacts } = req.body;
  if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
    return res.status(400).json({ error: 'Contacts array required' });
  }

  const insertContact = db.prepare(`
    INSERT OR IGNORE INTO campaign_contacts (campaign_id, phone, contact_data, status)
    VALUES (?, ?, ?, 'active')
  `);

  let enrolled = 0;
  let skipped = 0;
  for (const c of contacts) {
    const phone = String(c.phone || '').replace(/\D/g, '');
    if (!phone || phone.length < 10) { skipped++; continue; }
    const data = { ...c };
    delete data.phone;
    try {
      const info = insertContact.run(campaign.id, phone, JSON.stringify(data));
      if (info.changes > 0) enrolled++;
      else skipped++;
    } catch {
      skipped++;
    }
  }

  res.json({ success: true, enrolled, skipped, total: contacts.length });
});

// Webhook enrollment (for n8n / external tools)
router.post('/webhook/:token', (req, res) => {
  const campaign = db.prepare("SELECT * FROM campaigns WHERE webhook_token = ? AND status IN ('active', 'draft')").get(req.params.token);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found or inactive' });

  const { phone, ...rest } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone field is required' });

  const normalized = String(phone).replace(/\D/g, '');
  if (normalized.length < 10) return res.status(400).json({ error: 'Invalid phone number' });

  try {
    db.prepare(`
      INSERT OR IGNORE INTO campaign_contacts (campaign_id, phone, contact_data, status)
      VALUES (?, ?, ?, 'active')
    `).run(campaign.id, normalized, JSON.stringify(rest));
    res.json({ success: true, phone: normalized, campaign_id: campaign.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Contact Management ──

// List contacts in a campaign
router.get('/:id/contacts', (req, res) => {
  const campaign = db.prepare('SELECT id FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const { status } = req.query;
  let query = 'SELECT * FROM campaign_contacts WHERE campaign_id = ?';
  const params = [campaign.id];
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  query += ' ORDER BY enrolled_at DESC';

  const contacts = db.prepare(query).all(...params);
  res.json({
    contacts: contacts.map(c => ({
      ...c,
      contact_data: JSON.parse(c.contact_data || '{}'),
    })),
  });
});

// Remove a contact from campaign (manual stop)
router.post('/:id/contacts/:contactId/stop', (req, res) => {
  const campaign = db.prepare('SELECT id FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  db.prepare("UPDATE campaign_contacts SET status = 'stopped', stop_reason = 'manual' WHERE id = ? AND campaign_id = ?")
    .run(req.params.contactId, campaign.id);

  res.json({ success: true });
});

// ── Per-step logs (analytics) ──

router.get('/:id/logs', (req, res) => {
  const campaign = db.prepare('SELECT id FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const logs = db.prepare(`
    SELECT csl.*, cs.step_order, cs.step_type, cs.day_offset
    FROM campaign_step_logs csl
    JOIN campaign_steps cs ON csl.step_id = cs.id
    WHERE csl.campaign_id = ?
    ORDER BY csl.sent_at DESC
    LIMIT 500
  `).all(campaign.id);

  res.json({ logs });
});

export default router;
