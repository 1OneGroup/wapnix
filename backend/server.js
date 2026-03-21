import express from 'express';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import config from './config.js';
import db from './db/database.js';
import { authenticate } from './middleware/auth.js';
import sessionManager from './services/sessionManager.js';
import { restorePhoneFilters } from './services/chatbotEngine.js';
import { normalizePhone } from './shared/phoneUtils.js';

// Routes
import authRoutes from './routes/auth.js';
import sessionRoutes from './routes/session.js';
import templateRoutes from './routes/templates.js';
import contactRoutes from './routes/contacts.js';
import messageRoutes from './routes/messages.js';
import dashboardRoutes from './routes/dashboard.js';
import chatbotRoutes from './routes/chatbot.js';
import adminRoutes from './routes/admin.js';
import apikeyRoutes from './routes/apikey.js';
import profileRoutes from './routes/profile.js';
import externalApiRoutes from './routes/externalApi.js';
import externalApiV1Routes from './routes/v1/index.js';
import websiteRoutes from './routes/website.js';
import campaignRoutes from './routes/campaigns.js';
import schedulerRoutes from './routes/schedulers.js';

const app = express();
const httpServer = createServer(app);

// Socket.IO
const io = new SocketIO(httpServer, {
  cors: {
    origin: config.cors.origin,
    methods: ['GET', 'POST'],
  },
});

// Give SessionManager access to Socket.IO
sessionManager.setIO(io);

// Middleware
app.use(cors({ origin: config.cors.origin }));
app.use(express.json({ limit: '50mb' }));

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/session', authenticate, sessionRoutes);
app.use('/api/templates', authenticate, templateRoutes);
app.use('/api/contacts', authenticate, contactRoutes);
app.use('/api/messages', authenticate, messageRoutes);
app.use('/api/dashboard', authenticate, dashboardRoutes);
app.use('/api/chatbot', authenticate, chatbotRoutes);
app.use('/api/admin', authenticate, adminRoutes);
app.use('/api/apikey', authenticate, apikeyRoutes);
app.use('/api/profile', authenticate, profileRoutes);

// Serve uploaded files (avatars etc.)
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Scheduler routes
app.use('/api/schedulers', authenticate, schedulerRoutes);

// Campaign routes - webhook enrollment is public, rest needs auth
app.use('/api/campaigns', (req, res, next) => {
  if (req.path.startsWith('/webhook/')) return next();
  authenticate(req, res, next);
}, campaignRoutes);

// External API - new v1 modular routes (takes precedence)
app.use('/api/v1', externalApiV1Routes);
// Legacy external API (backward compat - will be deprecated)
app.use('/api/v1/legacy', externalApiRoutes);
// Website routes - webhook is public, rest needs auth
app.use('/api/website', (req, res, next) => {
  if (req.path.startsWith('/webhook/')) return next(); // Public webhook
  authenticate(req, res, next); // Auth for everything else
}, websiteRoutes);

// Serve frontend build (for ngrok / production access)
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDist));

// Health check (verifies DB connectivity)
app.get('/api/health', (req, res) => {
  try {
    const dbCheck = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
    res.json({ status: 'ok', uptime: process.uptime(), db: 'connected', users: dbCheck.cnt });
  } catch (err) {
    res.status(503).json({ status: 'error', uptime: process.uptime(), db: 'disconnected', error: err.message });
  }
});

// SPA fallback - serve index.html for non-API routes
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/') || req.path.startsWith('/uploads/') || req.path.startsWith('/socket.io/')) {
    return next();
  }
  const indexFile = path.join(frontendDist, 'index.html');
  res.sendFile(indexFile, (err) => {
    if (err) next();
  });
});

// Socket.IO auth + room join
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    socket.userId = payload.userId;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.userId;
  socket.join(`user:${userId}`);
  console.log(`Socket connected: user ${userId}`);

  // Send current session status on connect
  const status = sessionManager.getSessionStatus(userId);
  socket.emit('session:status', status);

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: user ${userId}`);
  });
});

// Follow-up Plan Scheduler - checks every 5 minutes for plans that need to send
async function runFollowupScheduler() {
  try {
    const now = new Date().toISOString();
    const duePlans = db.prepare(
      "SELECT * FROM followup_plans WHERE status = 'active' AND next_send_at <= ?"
    ).all(now);

    for (const plan of duePlans) {
      console.log(`[followup] Executing plan ${plan.id}: ${plan.plan_label} (send ${plan.sends_done + 1}/${plan.total_sends})`);

      let contacts;
      try { contacts = JSON.parse(plan.contacts_json); }
      catch (e) { console.error(`[followup] Plan ${plan.id}: corrupted contacts_json, skipping:`, e.message); continue; }
      const session = sessionManager.getSession(plan.user_id);
      if (!session || !session.isConnected) {
        // Retry in 30 minutes instead of skipping forever
        const retryAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        db.prepare("UPDATE followup_plans SET next_send_at = ? WHERE id = ?").run(retryAt, plan.id);
        console.log(`[followup] Plan ${plan.id}: WhatsApp not connected, retrying at ${retryAt}`);
        continue;
      }

      const queue = sessionManager.getQueue(plan.user_id);

      for (const contact of contacts) {
        const normalized = normalizePhone(contact.phone);
        if (!normalized || normalized.length < 10) continue;
        const jid = normalized + '@s.whatsapp.net';

        // Render per-contact variables
        let body = plan.message;
        for (const [key, val] of Object.entries(contact)) {
          body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), String(val || ''));
        }

        try {
          await new Promise(resolve => setTimeout(resolve, 15000)); // 15s gap
          if (queue) {
            await queue.enqueue(`user_${plan.user_id}`, session.sock, jid, { text: body });
          } else {
            await session.sock.sendMessage(jid, { text: body });
          }
          console.log(`[followup] Sent to ${normalized} (plan ${plan.id})`);
        } catch (err) {
          console.error(`[followup] Failed ${normalized}:`, err.message);
        }
      }

      // Update plan
      const newSendsDone = plan.sends_done + 1;
      if (newSendsDone >= plan.total_sends) {
        db.prepare("UPDATE followup_plans SET sends_done = ?, status = 'completed' WHERE id = ?")
          .run(newSendsDone, plan.id);
        console.log(`[followup] Plan ${plan.id} completed!`);
      } else {
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + plan.freq_days);
        db.prepare("UPDATE followup_plans SET sends_done = ?, next_send_at = ? WHERE id = ?")
          .run(newSendsDone, nextDate.toISOString(), plan.id);
        console.log(`[followup] Plan ${plan.id}: next send at ${nextDate.toISOString()}`);
      }
    }
  } catch (err) {
    console.error('[followup] Scheduler error:', err.message);
  }
}

// Campaign Scheduler - checks every 5 minutes for campaign steps due to fire
async function runCampaignScheduler() {
  try {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const currentHHMM = now.toISOString().slice(11, 16); // HH:MM in UTC

    // Get all active campaigns
    const activeCampaigns = db.prepare("SELECT * FROM campaigns WHERE status = 'active'").all();

    for (const campaign of activeCampaigns) {
      const steps = db.prepare('SELECT * FROM campaign_steps WHERE campaign_id = ? ORDER BY step_order ASC').all(campaign.id);
      if (steps.length === 0) continue;

      // Get contacts that are active and need their next step
      const activeContacts = db.prepare("SELECT * FROM campaign_contacts WHERE campaign_id = ? AND status = 'active'").all(campaign.id);

      for (const contact of activeContacts) {
        const nextStepOrder = contact.current_step + 1;
        const nextStep = steps.find(s => s.step_order === nextStepOrder);

        if (!nextStep) {
          // All steps completed for this contact
          db.prepare("UPDATE campaign_contacts SET status = 'completed' WHERE id = ?").run(contact.id);
          continue;
        }

        // Check if enough days have passed since enrollment
        const enrolledDate = new Date(contact.enrolled_at);
        const daysSinceEnroll = Math.floor((now - enrolledDate) / (1000 * 60 * 60 * 24));

        if (daysSinceEnroll < nextStep.day_offset) continue; // Not yet time

        // Check send_time: only fire if current time >= step's send_time
        if (currentHHMM < nextStep.send_time) continue;

        // Check if we already fired this step today (prevent double-send)
        const alreadySent = db.prepare(
          "SELECT id FROM campaign_step_logs WHERE campaign_id = ? AND step_id = ? AND phone = ? AND sent_at >= ?"
        ).get(campaign.id, nextStep.id, contact.phone, todayStr);
        if (alreadySent) continue;

        // Fire the step!
        const session = sessionManager.getSession(campaign.user_id);
        if (!session || !session.isConnected) {
          console.log(`[campaign] Campaign ${campaign.id}: WhatsApp not connected for user ${campaign.user_id}, skipping`);
          continue;
        }

        const queue = sessionManager.getQueue(campaign.user_id);
        const jid = contact.phone + '@s.whatsapp.net';
        let contactData;
        try { contactData = JSON.parse(contact.contact_data || '{}'); }
        catch (e) { console.error(`[campaign] Contact ${contact.id}: corrupted contact_data, skipping:`, e.message); continue; }

        try {
          if (nextStep.step_type === 'message') {
            // Send plain message with variable replacement
            let body = nextStep.message_text || '';
            for (const [key, val] of Object.entries(contactData)) {
              body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), String(val || ''));
            }
            body = body.replace(/\{\{phone\}\}/gi, contact.phone);

            await new Promise(resolve => setTimeout(resolve, 5000)); // 5s gap between sends
            if (queue) {
              await queue.enqueue(`user_${campaign.user_id}`, session.sock, jid, { text: body });
            } else {
              await session.sock.sendMessage(jid, { text: body });
            }

            // Log
            db.prepare('INSERT INTO campaign_step_logs (campaign_id, step_id, phone, status, sent_at) VALUES (?, ?, ?, ?, ?)')
              .run(campaign.id, nextStep.id, contact.phone, 'sent', now.toISOString());

            // Also log to chat_logs for conversation tracking
            try {
              db.prepare('INSERT INTO chat_logs (user_id, phone, direction, message, created_at) VALUES (?, ?, ?, ?, ?)')
                .run(campaign.user_id, contact.phone, 'outgoing', body, now.toISOString());
            } catch {}

          } else if (nextStep.step_type === 'chatbot') {
            // Trigger chatbot flow
            const flowRow = db.prepare('SELECT * FROM chatbot_flows WHERE id = ?').get(nextStep.flow_id);
            if (flowRow) {
              let flowSteps;
              try { flowSteps = JSON.parse(flowRow.steps_json); }
              catch (e) { console.error(`[campaign] Flow ${flowRow.id}: corrupted steps_json, skipping:`, e.message); continue; }
              const firstStep = flowSteps[0];
              if (firstStep) {
                let body = firstStep.message;
                for (const [key, val] of Object.entries(contactData)) {
                  body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), String(val || ''));
                }
                body = body.replace(/\{\{phone\}\}/gi, contact.phone);

                await new Promise(resolve => setTimeout(resolve, 5000));
                if (queue) {
                  await queue.enqueue(`user_${campaign.user_id}`, session.sock, jid, { text: body });
                } else {
                  await session.sock.sendMessage(jid, { text: body });
                }

                // Initialize chatbot conversation
                const { addAllowedPhone, initConversation } = await import('./services/chatbotEngine.js');
                addAllowedPhone(campaign.user_id, contact.phone);
                initConversation(campaign.user_id, contact.phone, flowRow.id, firstStep.id, contactData);

                // Log
                db.prepare('INSERT INTO campaign_step_logs (campaign_id, step_id, phone, status, sent_at) VALUES (?, ?, ?, ?, ?)')
                  .run(campaign.id, nextStep.id, contact.phone, 'sent', now.toISOString());

                try {
                  db.prepare('INSERT INTO chat_logs (user_id, phone, direction, message, created_at) VALUES (?, ?, ?, ?, ?)')
                    .run(campaign.user_id, contact.phone, 'outgoing', body, now.toISOString());
                } catch {}
              }
            }
          }

          // Advance contact to next step
          db.prepare('UPDATE campaign_contacts SET current_step = ?, last_step_at = ? WHERE id = ?')
            .run(nextStepOrder, now.toISOString(), contact.id);

          // Check if this was the last step
          if (nextStepOrder >= steps.length) {
            db.prepare("UPDATE campaign_contacts SET status = 'completed' WHERE id = ?").run(contact.id);
          }

          console.log(`[campaign] Campaign "${campaign.name}" step ${nextStepOrder} (${nextStep.step_type}) sent to ${contact.phone}`);
        } catch (err) {
          console.error(`[campaign] Failed to send step ${nextStepOrder} to ${contact.phone}:`, err.message);
          db.prepare('INSERT INTO campaign_step_logs (campaign_id, step_id, phone, status, sent_at) VALUES (?, ?, ?, ?, ?)')
            .run(campaign.id, nextStep.id, contact.phone, 'failed', now.toISOString());
        }
      }

      // Check if all contacts are done
      const remaining = db.prepare("SELECT COUNT(*) as c FROM campaign_contacts WHERE campaign_id = ? AND status = 'active'").get(campaign.id).c;
      if (remaining === 0) {
        const total = db.prepare('SELECT COUNT(*) as c FROM campaign_contacts WHERE campaign_id = ?').get(campaign.id).c;
        if (total > 0) {
          db.prepare("UPDATE campaigns SET status = 'completed', updated_at = ? WHERE id = ?")
            .run(now.toISOString(), campaign.id);
          console.log(`[campaign] Campaign "${campaign.name}" (${campaign.id}) completed - all contacts processed`);
        }
      }
    }
  } catch (err) {
    console.error('[campaign] Scheduler error:', err.message);
  }
}

// Start server
httpServer.listen(config.port, async () => {
  console.log(`WhatsApp Business Plan API running on port ${config.port}`);
  console.log(`Frontend expected at ${config.cors.origin}`);

  // Restore phone filters from DB (before sessions so chatbot is ready)
  restorePhoneFilters();

  // Restore previously active sessions
  await sessionManager.restoreAllSessions();

  // Start follow-up plan scheduler (check every 5 minutes)
  setInterval(runFollowupScheduler, 5 * 60 * 1000);
  // Also run once on startup
  setTimeout(runFollowupScheduler, 10000);

  // Start campaign scheduler (check every 5 minutes)
  setInterval(runCampaignScheduler, 5 * 60 * 1000);
  setTimeout(runCampaignScheduler, 15000);
});
