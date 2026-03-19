import { z } from 'zod';
import { getDb } from '../db.js';

export function registerAdminTools(server, getUserId) {
  // Check superadmin before each tool
  function checkAdmin() {
    const db = getDb();
    const user = db.prepare('SELECT is_superadmin FROM users WHERE id = ?').get(getUserId());
    return user?.is_superadmin === 1;
  }

  server.tool('admin_list_users', 'List all users with plan info (superadmin only)', {}, async () => {
    if (!checkAdmin()) return { content: [{ type: 'text', text: 'Error: Superadmin access required' }], isError: true };
    const db = getDb();
    const users = db.prepare(`
      SELECT u.id, u.email, u.name, u.is_approved, u.is_active, u.is_superadmin, u.created_at,
             p.name as plan_name, p.daily_limit,
             s.status as whatsapp_status, s.whatsapp_number
      FROM users u
      JOIN plans p ON u.plan_id = p.id
      LEFT JOIN sessions s ON u.id = s.user_id
      ORDER BY u.created_at DESC
    `).all();
    return { content: [{ type: 'text', text: JSON.stringify(users, null, 2) }] };
  });

  server.tool('admin_approve_user', 'Approve a user registration (superadmin only)', {
    user_id: z.number().describe('User ID to approve'),
  }, async ({ user_id }) => {
    if (!checkAdmin()) return { content: [{ type: 'text', text: 'Error: Superadmin access required' }], isError: true };
    const db = getDb();
    db.prepare('UPDATE users SET is_approved = 1 WHERE id = ?').run(user_id);
    return { content: [{ type: 'text', text: JSON.stringify({ user_id, approved: true }) }] };
  });

  server.tool('admin_update_user_plan', 'Change a user\'s plan (superadmin only)', {
    user_id: z.number().describe('User ID'),
    plan_name: z.enum(['free', 'starter', 'pro', 'business']).describe('Plan name'),
  }, async ({ user_id, plan_name }) => {
    if (!checkAdmin()) return { content: [{ type: 'text', text: 'Error: Superadmin access required' }], isError: true };
    const db = getDb();
    const plan = db.prepare('SELECT id FROM plans WHERE name = ?').get(plan_name);
    if (!plan) return { content: [{ type: 'text', text: 'Error: Plan not found' }], isError: true };
    db.prepare('UPDATE users SET plan_id = ? WHERE id = ?').run(plan.id, user_id);
    return { content: [{ type: 'text', text: JSON.stringify({ user_id, plan: plan_name }) }] };
  });

  server.tool('admin_toggle_user_active', 'Enable or disable a user account (superadmin only)', {
    user_id: z.number().describe('User ID'),
    is_active: z.boolean().describe('true to enable, false to disable'),
  }, async ({ user_id, is_active }) => {
    if (!checkAdmin()) return { content: [{ type: 'text', text: 'Error: Superadmin access required' }], isError: true };
    const db = getDb();
    db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(is_active ? 1 : 0, user_id);
    return { content: [{ type: 'text', text: JSON.stringify({ user_id, is_active }) }] };
  });

  server.tool('admin_update_user_pages', 'Set allowed pages for a user (superadmin only)', {
    user_id: z.number().describe('User ID'),
    pages: z.array(z.string()).describe('Array of allowed page keys (dashboard, device, templates, contacts, send, chatbot, api, campaigns, website, settings, profile)'),
  }, async ({ user_id, pages }) => {
    if (!checkAdmin()) return { content: [{ type: 'text', text: 'Error: Superadmin access required' }], isError: true };
    const db = getDb();
    db.prepare('UPDATE users SET allowed_pages = ? WHERE id = ?').run(JSON.stringify(pages), user_id);
    return { content: [{ type: 'text', text: JSON.stringify({ user_id, pages }) }] };
  });

  server.tool('admin_get_stats', 'Get platform-wide admin statistics (superadmin only)', {}, async () => {
    if (!checkAdmin()) return { content: [{ type: 'text', text: 'Error: Superadmin access required' }], isError: true };
    const db = getDb();
    const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const approvedUsers = db.prepare('SELECT COUNT(*) as c FROM users WHERE is_approved = 1').get().c;
    const pendingUsers = db.prepare('SELECT COUNT(*) as c FROM users WHERE is_approved = 0').get().c;
    const today = new Date().toISOString().slice(0, 10);
    const todayMessages = db.prepare('SELECT SUM(messages_sent) as total FROM daily_usage WHERE date = ?').get(today)?.total || 0;
    const connectedSessions = db.prepare("SELECT COUNT(*) as c FROM sessions WHERE status = 'connected'").get().c;

    return { content: [{ type: 'text', text: JSON.stringify({
      total_users: totalUsers, approved: approvedUsers, pending: pendingUsers,
      today_messages: todayMessages, connected_sessions: connectedSessions,
    }, null, 2) }] };
  });
}
