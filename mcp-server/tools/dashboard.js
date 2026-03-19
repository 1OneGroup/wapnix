import { z } from 'zod';
import { getDb } from '../db.js';

export function registerDashboardTools(server, getUserId) {
  server.tool('get_dashboard_stats', 'Get dashboard stats: contacts, templates, usage, 7-day trend, campaigns', {}, async () => {
    const db = getDb();
    const userId = getUserId();
    const today = new Date().toISOString().slice(0, 10);

    const contacts = db.prepare('SELECT COUNT(*) as cnt FROM contacts WHERE user_id = ?').get(userId).cnt;
    const templates = db.prepare('SELECT COUNT(*) as cnt FROM templates WHERE user_id = ?').get(userId).cnt;
    const groups = db.prepare('SELECT COUNT(*) as cnt FROM contact_groups WHERE user_id = ?').get(userId).cnt;
    const todayUsage = db.prepare('SELECT messages_sent FROM daily_usage WHERE user_id = ? AND date = ?').get(userId, today);
    const totalSent = db.prepare("SELECT COUNT(*) as cnt FROM messages WHERE user_id = ? AND status = 'sent'").get(userId).cnt;
    const totalFailed = db.prepare("SELECT COUNT(*) as cnt FROM messages WHERE user_id = ? AND status = 'failed'").get(userId).cnt;

    // 7-day trend
    const dailyRaw = db.prepare("SELECT date, messages_sent FROM daily_usage WHERE user_id = ? AND date >= date(?, '-6 days') ORDER BY date").all(userId, today);
    const dailyMap = Object.fromEntries(dailyRaw.map(d => [d.date, d.messages_sent]));
    const daily_stats = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      daily_stats.push({ date: ds, messages_sent: dailyMap[ds] || 0 });
    }

    const activeCampaigns = db.prepare("SELECT COUNT(*) as cnt FROM campaigns WHERE user_id = ? AND status = 'active'").get(userId).cnt;
    const activeFlows = db.prepare("SELECT COUNT(*) as cnt FROM chatbot_flows WHERE user_id = ? AND is_active = 1").get(userId).cnt;
    const newLeads = db.prepare("SELECT COUNT(*) as cnt FROM website_leads WHERE user_id = ? AND status = 'new'").get(userId).cnt;

    // Plan info
    const user = db.prepare('SELECT u.*, p.name as plan_name, p.daily_limit, p.max_contacts, p.max_templates FROM users u JOIN plans p ON u.plan_id = p.id WHERE u.id = ?').get(userId);

    return { content: [{ type: 'text', text: JSON.stringify({
      contacts, templates, groups,
      today_sent: todayUsage?.messages_sent || 0,
      daily_limit: user?.daily_limit || 0,
      max_contacts: user?.max_contacts || 0,
      max_templates: user?.max_templates || 0,
      total_sent: totalSent, total_failed: totalFailed,
      daily_stats,
      active_campaigns: activeCampaigns,
      active_chatbot_flows: activeFlows,
      new_leads: newLeads,
      plan: user?.plan_name || 'unknown',
    }, null, 2) }] };
  });

  server.tool('get_daily_usage', 'Get message usage for a date range', {
    from_date: z.string().optional().describe('Start date YYYY-MM-DD'),
    to_date: z.string().optional().describe('End date YYYY-MM-DD'),
  }, async ({ from_date, to_date }) => {
    const db = getDb();
    const userId = getUserId();
    const today = new Date().toISOString().slice(0, 10);
    const from = from_date || today;
    const to = to_date || today;

    const usage = db.prepare('SELECT date, messages_sent FROM daily_usage WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date').all(userId, from, to);
    const totalSent = usage.reduce((s, d) => s + d.messages_sent, 0);

    return { content: [{ type: 'text', text: JSON.stringify({ usage, total_sent: totalSent, from_date: from, to_date: to }, null, 2) }] };
  });
}
