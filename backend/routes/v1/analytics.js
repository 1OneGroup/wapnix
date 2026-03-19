import { Router } from 'express';
import db from '../../db/database.js';

const router = Router();

// GET /api/v1/analytics/dashboard - Dashboard stats
router.get('/dashboard', (req, res) => {
  const userId = req.user.id;
  const today = new Date().toISOString().slice(0, 10);

  const contacts = db.prepare('SELECT COUNT(*) as cnt FROM contacts WHERE user_id = ?').get(userId).cnt;
  const templates = db.prepare('SELECT COUNT(*) as cnt FROM templates WHERE user_id = ?').get(userId).cnt;
  const groups = db.prepare('SELECT COUNT(*) as cnt FROM contact_groups WHERE user_id = ?').get(userId).cnt;

  const todayUsage = db.prepare('SELECT messages_sent FROM daily_usage WHERE user_id = ? AND date = ?').get(userId, today);
  const totalSent = db.prepare("SELECT COUNT(*) as cnt FROM messages WHERE user_id = ? AND status = 'sent'").get(userId).cnt;
  const totalFailed = db.prepare("SELECT COUNT(*) as cnt FROM messages WHERE user_id = ? AND status = 'failed'").get(userId).cnt;

  // 7-day trend
  const dailyStatsRaw = db.prepare(
    "SELECT date, messages_sent FROM daily_usage WHERE user_id = ? AND date >= date(?, '-6 days') ORDER BY date"
  ).all(userId, today);
  const dailyMap = Object.fromEntries(dailyStatsRaw.map(d => [d.date, d.messages_sent]));
  const daily_stats = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    daily_stats.push({ date: ds, messages_sent: dailyMap[ds] || 0 });
  }

  // Campaign stats
  const activeCampaigns = db.prepare("SELECT COUNT(*) as cnt FROM campaigns WHERE user_id = ? AND status = 'active'").get(userId).cnt;
  const activeFlows = db.prepare("SELECT COUNT(*) as cnt FROM chatbot_flows WHERE user_id = ? AND is_active = 1").get(userId).cnt;
  const newLeads = db.prepare("SELECT COUNT(*) as cnt FROM website_leads WHERE user_id = ? AND status = 'new'").get(userId).cnt;

  res.ok({
    contacts,
    templates,
    groups,
    today_sent: todayUsage?.messages_sent || 0,
    daily_limit: req.user.daily_limit,
    max_contacts: req.user.max_contacts,
    max_templates: req.user.max_templates,
    total_sent: totalSent,
    total_failed: totalFailed,
    daily_stats,
    active_campaigns: activeCampaigns,
    active_chatbot_flows: activeFlows,
    new_leads: newLeads,
    plan: req.user.plan_name,
  });
});

// GET /api/v1/analytics/usage - Daily usage for date range
router.get('/usage', (req, res) => {
  const userId = req.user.id;
  const { from_date, to_date } = req.query;
  const today = new Date().toISOString().slice(0, 10);
  const from = from_date || today;
  const to = to_date || today;

  const usage = db.prepare(
    'SELECT date, messages_sent FROM daily_usage WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date'
  ).all(userId, from, to);

  const totalSent = usage.reduce((sum, d) => sum + d.messages_sent, 0);

  res.ok({ usage, total_sent: totalSent, from_date: from, to_date: to });
});

// GET /api/v1/analytics/campaigns/:id - Campaign analytics
router.get('/campaigns/:id', (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!campaign) return res.fail(404, 'Campaign not found');

  const steps = db.prepare('SELECT * FROM campaign_steps WHERE campaign_id = ? ORDER BY step_order').all(campaign.id);

  const stepAnalytics = steps.map(step => {
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status IN ('sent','delivered','replied') THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'replied' THEN 1 ELSE 0 END) as replied,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM campaign_step_logs WHERE campaign_id = ? AND step_id = ?
    `).get(campaign.id, step.id);
    return { step_order: step.step_order, step_type: step.step_type, day_offset: step.day_offset, ...stats };
  });

  const contactStats = {
    total: db.prepare('SELECT COUNT(*) as c FROM campaign_contacts WHERE campaign_id = ?').get(campaign.id).c,
    active: db.prepare("SELECT COUNT(*) as c FROM campaign_contacts WHERE campaign_id = ? AND status = 'active'").get(campaign.id).c,
    completed: db.prepare("SELECT COUNT(*) as c FROM campaign_contacts WHERE campaign_id = ? AND status = 'completed'").get(campaign.id).c,
    stopped: db.prepare("SELECT COUNT(*) as c FROM campaign_contacts WHERE campaign_id = ? AND status = 'stopped'").get(campaign.id).c,
  };

  res.ok({
    campaign: { id: campaign.id, name: campaign.name, status: campaign.status },
    steps: stepAnalytics,
    contacts: contactStats,
  });
});

export default router;
