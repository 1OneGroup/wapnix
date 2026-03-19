import { z } from 'zod';
import { getDb } from '../db.js';

export function registerCampaignTools(server, getUserId) {
  server.tool('list_campaigns', 'List all campaigns with stats', {}, async () => {
    const db = getDb();
    const campaigns = db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM campaign_steps WHERE campaign_id = c.id) as step_count,
        (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = c.id) as contact_count,
        (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = c.id AND status = 'active') as active_contacts,
        (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = c.id AND status = 'completed') as completed_contacts
      FROM campaigns c WHERE c.user_id = ? ORDER BY c.updated_at DESC
    `).all(getUserId());

    return { content: [{ type: 'text', text: JSON.stringify(campaigns.map(c => ({
      ...c, stop_keywords: JSON.parse(c.stop_keywords || '[]'),
    })), null, 2) }] };
  });

  server.tool('get_campaign', 'Get campaign details with steps and analytics', {
    id: z.number().describe('Campaign ID'),
  }, async ({ id }) => {
    const db = getDb();
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(id, getUserId());
    if (!campaign) return { content: [{ type: 'text', text: 'Error: Campaign not found' }], isError: true };

    const steps = db.prepare(`SELECT cs.*, cf.name as flow_name FROM campaign_steps cs LEFT JOIN chatbot_flows cf ON cs.flow_id = cf.id WHERE cs.campaign_id = ? ORDER BY cs.step_order`).all(id);
    const contactCounts = {
      total: db.prepare('SELECT COUNT(*) as c FROM campaign_contacts WHERE campaign_id = ?').get(id).c,
      active: db.prepare("SELECT COUNT(*) as c FROM campaign_contacts WHERE campaign_id = ? AND status = 'active'").get(id).c,
      completed: db.prepare("SELECT COUNT(*) as c FROM campaign_contacts WHERE campaign_id = ? AND status = 'completed'").get(id).c,
      stopped: db.prepare("SELECT COUNT(*) as c FROM campaign_contacts WHERE campaign_id = ? AND status = 'stopped'").get(id).c,
    };

    return { content: [{ type: 'text', text: JSON.stringify({
      ...campaign, stop_keywords: JSON.parse(campaign.stop_keywords || '[]'),
      steps, contactCounts
    }, null, 2) }] };
  });

  server.tool('create_campaign', 'Create a new campaign with steps', {
    name: z.string().describe('Campaign name'),
    description: z.string().optional().default(''),
    steps: z.array(z.object({
      step_type: z.enum(['message', 'chatbot']),
      day_offset: z.number().optional().default(0),
      send_time: z.string().optional().default('10:00'),
      message_text: z.string().optional(),
      flow_id: z.number().optional(),
    })).describe('Campaign steps'),
    stop_keywords: z.array(z.string()).optional().default([]),
  }, async ({ name, description, steps, stop_keywords }) => {
    const db = getDb();
    const result = db.prepare('INSERT INTO campaigns (user_id, name, description, stop_keywords) VALUES (?, ?, ?, ?)').run(
      getUserId(), name, description, JSON.stringify(stop_keywords)
    );
    const campaignId = Number(result.lastInsertRowid);

    const insertStep = db.prepare('INSERT INTO campaign_steps (campaign_id, step_order, day_offset, send_time, step_type, message_text, flow_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      insertStep.run(campaignId, i + 1, s.day_offset, s.send_time, s.step_type, s.message_text || null, s.flow_id || null);
    }

    return { content: [{ type: 'text', text: JSON.stringify({ id: campaignId, name, step_count: steps.length }) }] };
  });

  server.tool('update_campaign', 'Update a campaign', {
    id: z.number().describe('Campaign ID'),
    name: z.string().optional(),
    description: z.string().optional(),
    stop_keywords: z.array(z.string()).optional(),
    steps: z.array(z.object({
      step_type: z.enum(['message', 'chatbot']),
      day_offset: z.number().optional().default(0),
      send_time: z.string().optional().default('10:00'),
      message_text: z.string().optional(),
      flow_id: z.number().optional(),
    })).optional(),
  }, async ({ id, name, description, stop_keywords, steps }) => {
    const db = getDb();
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(id, getUserId());
    if (!campaign) return { content: [{ type: 'text', text: 'Error: Campaign not found' }], isError: true };

    db.prepare('UPDATE campaigns SET name = ?, description = ?, stop_keywords = ?, updated_at = ? WHERE id = ?').run(
      name || campaign.name, description ?? campaign.description,
      JSON.stringify(stop_keywords || JSON.parse(campaign.stop_keywords || '[]')),
      new Date().toISOString(), id
    );

    if (steps) {
      db.prepare('DELETE FROM campaign_steps WHERE campaign_id = ?').run(id);
      const insertStep = db.prepare('INSERT INTO campaign_steps (campaign_id, step_order, day_offset, send_time, step_type, message_text, flow_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        insertStep.run(id, i + 1, s.day_offset, s.send_time, s.step_type, s.message_text || null, s.flow_id || null);
      }
    }

    return { content: [{ type: 'text', text: JSON.stringify({ id, updated: true }) }] };
  });

  server.tool('delete_campaign', 'Delete a campaign', {
    id: z.number().describe('Campaign ID'),
  }, async ({ id }) => {
    const db = getDb();
    const result = db.prepare('DELETE FROM campaigns WHERE id = ? AND user_id = ?').run(id, getUserId());
    if (result.changes === 0) return { content: [{ type: 'text', text: 'Error: Campaign not found' }], isError: true };
    return { content: [{ type: 'text', text: JSON.stringify({ deleted: true }) }] };
  });

  server.tool('activate_campaign', 'Activate a campaign to start sending', {
    id: z.number().describe('Campaign ID'),
  }, async ({ id }) => {
    const db = getDb();
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(id, getUserId());
    if (!campaign) return { content: [{ type: 'text', text: 'Error: Campaign not found' }], isError: true };
    const stepCount = db.prepare('SELECT COUNT(*) as c FROM campaign_steps WHERE campaign_id = ?').get(id).c;
    if (stepCount === 0) return { content: [{ type: 'text', text: 'Error: Campaign must have at least one step' }], isError: true };

    db.prepare("UPDATE campaigns SET status = 'active', updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    return { content: [{ type: 'text', text: JSON.stringify({ id, status: 'active' }) }] };
  });

  server.tool('pause_campaign', 'Pause an active campaign', {
    id: z.number().describe('Campaign ID'),
  }, async ({ id }) => {
    const db = getDb();
    const info = db.prepare("UPDATE campaigns SET status = 'paused', updated_at = ? WHERE id = ? AND user_id = ? AND status = 'active'").run(new Date().toISOString(), id, getUserId());
    if (info.changes === 0) return { content: [{ type: 'text', text: 'Error: Campaign not found or not active' }], isError: true };
    return { content: [{ type: 'text', text: JSON.stringify({ id, status: 'paused' }) }] };
  });

  server.tool('resume_campaign', 'Resume a paused campaign', {
    id: z.number().describe('Campaign ID'),
  }, async ({ id }) => {
    const db = getDb();
    const info = db.prepare("UPDATE campaigns SET status = 'active', updated_at = ? WHERE id = ? AND user_id = ? AND status = 'paused'").run(new Date().toISOString(), id, getUserId());
    if (info.changes === 0) return { content: [{ type: 'text', text: 'Error: Campaign not found or not paused' }], isError: true };
    return { content: [{ type: 'text', text: JSON.stringify({ id, status: 'active' }) }] };
  });

  server.tool('enroll_campaign_contacts', 'Enroll contacts into a campaign', {
    campaign_id: z.number().describe('Campaign ID'),
    contacts: z.array(z.object({
      phone: z.string(),
    }).passthrough()).describe('Array of contacts with phone and optional fields'),
  }, async ({ campaign_id, contacts }) => {
    const db = getDb();
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(campaign_id, getUserId());
    if (!campaign) return { content: [{ type: 'text', text: 'Error: Campaign not found' }], isError: true };

    const insert = db.prepare("INSERT OR IGNORE INTO campaign_contacts (campaign_id, phone, contact_data, status) VALUES (?, ?, ?, 'active')");
    let enrolled = 0, skipped = 0;
    for (const c of contacts) {
      const phone = String(c.phone || '').replace(/\D/g, '');
      if (!phone || phone.length < 10) { skipped++; continue; }
      const data = { ...c }; delete data.phone;
      try { const info = insert.run(campaign_id, phone, JSON.stringify(data)); if (info.changes > 0) enrolled++; else skipped++; } catch { skipped++; }
    }

    return { content: [{ type: 'text', text: JSON.stringify({ enrolled, skipped, total: contacts.length }) }] };
  });

  server.tool('list_campaign_contacts', 'List contacts enrolled in a campaign', {
    campaign_id: z.number().describe('Campaign ID'),
    status: z.string().optional().describe('Filter: active, completed, stopped'),
  }, async ({ campaign_id, status }) => {
    const db = getDb();
    let query = 'SELECT * FROM campaign_contacts WHERE campaign_id = ?';
    const params = [campaign_id];
    if (status) { query += ' AND status = ?'; params.push(status); }
    query += ' ORDER BY enrolled_at DESC';
    const contacts = db.prepare(query).all(...params);
    return { content: [{ type: 'text', text: JSON.stringify(contacts.map(c => ({ ...c, contact_data: JSON.parse(c.contact_data || '{}') })), null, 2) }] };
  });

  server.tool('get_campaign_logs', 'Get per-step send logs for a campaign', {
    campaign_id: z.number().describe('Campaign ID'),
  }, async ({ campaign_id }) => {
    const db = getDb();
    const logs = db.prepare(`
      SELECT csl.*, cs.step_order, cs.step_type, cs.day_offset
      FROM campaign_step_logs csl JOIN campaign_steps cs ON csl.step_id = cs.id
      WHERE csl.campaign_id = ? ORDER BY csl.sent_at DESC LIMIT 500
    `).all(campaign_id);
    return { content: [{ type: 'text', text: JSON.stringify(logs, null, 2) }] };
  });
}
