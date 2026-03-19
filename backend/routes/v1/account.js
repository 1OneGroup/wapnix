import { Router } from 'express';
import db from '../../db/database.js';
import sessionManager from '../../services/sessionManager.js';

const router = Router();

// GET /api/v1/me - Account info with plan details and usage
router.get('/me', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const usage = db.prepare('SELECT messages_sent FROM daily_usage WHERE user_id = ? AND date = ?').get(req.user.id, today);
  const session = sessionManager.getSession(req.user.id);

  res.ok({
    id: req.user.id,
    email: req.user.email,
    name: req.user.name,
    plan: req.user.plan_name,
    daily_limit: req.user.daily_limit,
    monthly_limit: req.user.monthly_limit,
    max_contacts: req.user.max_contacts,
    max_templates: req.user.max_templates,
    daily_sent: usage?.messages_sent || 0,
    whatsapp_connected: !!(session && session.isConnected),
    whatsapp_number: session?.whatsappNumber || null,
  });
});

// GET /api/v1/session/status - WhatsApp connection status
router.get('/session/status', (req, res) => {
  const status = sessionManager.getSessionStatus(req.user.id);
  const session = sessionManager.getSession(req.user.id);
  const queue = sessionManager.getQueue(req.user.id);

  res.ok({
    connected: !!(session && session.isConnected),
    whatsapp_number: session?.whatsappNumber || null,
    status: status?.status || 'disconnected',
    queue_stats: queue ? {
      pending: queue.pendingCount || 0,
      processing: queue.processingCount || 0,
    } : null,
  });
});

export default router;
