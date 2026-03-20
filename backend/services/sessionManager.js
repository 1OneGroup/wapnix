import path from 'path';
import fs from 'fs';
import { ConnectionManager } from '../shared/connectionManager.js';
import { MessageQueue } from '../shared/messageQueue.js';
import config from '../config.js';
import db from '../db/database.js';
import { processIncomingMessage, getPendingNotifications } from './chatbotEngine.js';
import { extractPhoneFromMessage } from '../shared/phoneUtils.js';

/**
 * Manages per-user WhatsApp sessions via Baileys.
 * Each user gets their own ConnectionManager (Baileys socket) and MessageQueue (rate limiter).
 * Sessions are stored in `backend/data/auth_sessions/user_X/`.
 *
 * Key methods:
 * - startSession(userId, opts) - Initiate WhatsApp connection (QR or pairing code)
 * - stopSession(userId) - Disconnect WhatsApp
 * - getSession(userId) - Get ConnectionManager { sock, isConnected, whatsappNumber }
 * - getQueue(userId) - Get MessageQueue for rate-limited sending
 * - getSessionStatus(userId) - Get { status, whatsappNumber } for Socket.IO
 * - restoreAllSessions() - Restore previously connected sessions on server start
 *
 * Emits Socket.IO events: session:status, session:qr, session:pairing-code
 */
class SessionManager {
  constructor() {
    /** @type {Map<number, ConnectionManager>} userId -> ConnectionManager */
    this.sessions = new Map();
    /** @type {Map<number, MessageQueue>} userId -> MessageQueue */
    this.queues = new Map();
    /** @type {import('socket.io').Server|null} */
    this.io = null;
  }

  /** @param {import('socket.io').Server} io */
  setIO(io) {
    this.io = io;
  }

  _emitToUser(userId, event, data) {
    if (this.io) {
      this.io.to(`user:${userId}`).emit(event, data);
    }
  }

  _updateSessionDB(userId, status, number) {
    const now = new Date().toISOString();
    if (status === 'connected') {
      db.prepare(
        'UPDATE sessions SET status = ?, whatsapp_number = ?, connected_at = ? WHERE user_id = ?'
      ).run(status, number || null, now, userId);
    } else {
      db.prepare(
        'UPDATE sessions SET status = ?, disconnected_at = ? WHERE user_id = ?'
      ).run(status, now, userId);
    }
  }

  async startSession(userId, { pairingPhone } = {}) {
    // If already connected, return status. If connecting/stuck, force restart.
    if (this.sessions.has(userId)) {
      const existing = this.sessions.get(userId);
      if (existing.isConnected) {
        return existing.getStatus();
      }
      // Force stop stuck/connecting session so we get a fresh QR
      await existing.disconnect();
      this.sessions.delete(userId);
      this.queues.delete(userId);
    }

    // Get user plan for rate limits
    const user = db.prepare(
      'SELECT u.*, p.rate_per_minute, p.rate_per_hour FROM users u JOIN plans p ON u.plan_id = p.id WHERE u.id = ?'
    ).get(userId);

    if (!user) throw new Error('User not found');

    const session = db.prepare('SELECT * FROM sessions WHERE user_id = ?').get(userId);
    if (!session) throw new Error('Session record not found');

    const authFolder = path.join(config.authSessionsDir, session.auth_folder);
    if (!fs.existsSync(authFolder)) fs.mkdirSync(authFolder, { recursive: true });

    // Create per-user rate-limited queue with safe anti-ban delays
    const queue = new MessageQueue({
      defaultDelayMs: 15000,  // 15 sec minimum gap between messages (human-like)
      maxPerMinute: Math.min(user.rate_per_minute, 4),  // max 4/min (every ~15s)
      maxPerHour: Math.min(user.rate_per_hour, 120),     // max 120/hr
    });
    this.queues.set(userId, queue);

    const conn = new ConnectionManager({
      name: `user_${userId}`,
      authFolder,
      messageQueue: queue,
      onQR: (qr) => {
        this._emitToUser(userId, 'qr', qr);
        this._updateSessionDB(userId, 'connecting', null);
      },
      onPairingCode: (code) => {
        this._emitToUser(userId, 'pairing-code', code);
        this._updateSessionDB(userId, 'connecting', null);
      },
      onStatusChange: (status, info) => {
        this._emitToUser(userId, 'session:status', { status, ...info });
        this._updateSessionDB(userId, status, info?.number);
      },
      onMessage: async (sock, upsert) => {
        // Handle incoming messages for chatbot auto-reply
        console.log(`[user_${userId}] onMessage called: type=${upsert.type}, messages=${upsert.messages?.length || 0}`);

        // Accept both 'notify' and 'append' types
        if (upsert.type !== 'notify' && upsert.type !== 'append') return;

        for (const msg of upsert.messages) {
          const remoteJid = msg.key.remoteJid || '';
          const fromMe = msg.key.fromMe;

          // Log every message for debugging
          console.log(`[user_${userId}] MSG: fromMe=${fromMe} jid=${remoteJid} hasMessage=${!!msg.message}`);

          if (fromMe) continue; // Skip our own messages
          if (!remoteJid || remoteJid.includes('@g.us')) continue; // Skip groups

          // Use robust phone extraction that handles LID, participant fields, etc.
          let phone = extractPhoneFromMessage(msg);
          // Fallback: extract from JID directly
          if (!phone) {
            phone = remoteJid.replace(/@(s\.whatsapp\.net|lid)$/, '');
          }

          const text = msg.message?.conversation
            || msg.message?.extendedTextMessage?.text
            || msg.message?.buttonsResponseMessage?.selectedButtonId
            || msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId
            || '';

          console.log(`[user_${userId}] Incoming from ${phone} (jid: ${remoteJid}): "${text.substring(0, 80)}"`);

          if (!text.trim()) continue;

          try {
            // Log incoming message
            try {
              db.prepare('INSERT INTO chat_logs (user_id, phone, direction, message) VALUES (?, ?, ?, ?)').run(userId, phone, 'incoming', text);
            } catch {}

            // Check campaign stop conditions
            try {
              const textLower = text.toLowerCase().trim();
              const campaignContacts = db.prepare(`
                SELECT cc.id, cc.campaign_id FROM campaign_contacts cc
                JOIN campaigns c ON cc.campaign_id = c.id
                WHERE c.user_id = ? AND cc.phone LIKE ? AND cc.status = 'active'
              `).all(userId, `%${phone.slice(-10)}%`);

              for (const cc of campaignContacts) {
                const campaign = db.prepare('SELECT stop_keywords FROM campaigns WHERE id = ?').get(cc.campaign_id);
                if (campaign) {
                  const stopKw = JSON.parse(campaign.stop_keywords || '[]');
                  if (stopKw.some(kw => textLower.includes(kw.toLowerCase()))) {
                    db.prepare("UPDATE campaign_contacts SET status = 'stopped', stop_reason = 'keyword' WHERE id = ?").run(cc.id);
                    console.log(`[campaign] Contact ${phone} stopped from campaign ${cc.campaign_id} (keyword match: "${textLower}")`);
                  }
                }
              }

              // Also mark campaign step logs as 'replied' when contact replies
              db.prepare(`
                UPDATE campaign_step_logs SET status = 'replied', replied_at = ?
                WHERE phone LIKE ? AND status = 'sent'
                AND campaign_id IN (SELECT id FROM campaigns WHERE user_id = ?)
              `).run(new Date().toISOString(), `%${phone.slice(-10)}%`, userId);
            } catch (campErr) {
              // Non-critical, don't break chatbot flow
              console.error('[campaign] Stop check error:', campErr.message);
            }

            const reply = processIncomingMessage(userId, phone, text);
            if (reply) {
              // Use original remoteJid to reply — don't construct a new JID
              await sock.sendMessage(remoteJid, { text: reply });
              // Log bot reply
              try {
                db.prepare('INSERT INTO chat_logs (user_id, phone, direction, message) VALUES (?, ?, ?, ?)').run(userId, phone, 'outgoing', reply);
              } catch {}
              console.log(`[user_${userId}] Chatbot replied to ${phone}: "${reply.substring(0, 80)}"`);
            } else {
              console.log(`[user_${userId}] No chatbot reply for ${phone}`);
            }

            // Send any pending notifications
            const notifications = getPendingNotifications();
            for (const notif of notifications) {
              try {
                const notifJid = notif.phone + '@s.whatsapp.net';
                await sock.sendMessage(notifJid, { text: notif.message });
                console.log(`[user_${userId}] Notification sent to ${notif.phone}`);
              } catch (notifErr) {
                console.error(`[user_${userId}] Notification failed to ${notif.phone}:`, notifErr.message);
              }
            }
          } catch (err) {
            console.error(`[user_${userId}] Chatbot error:`, err.message);
          }
        }
      },
    });

    if (pairingPhone) {
      conn.pairingPhone = pairingPhone;
    }
    this.sessions.set(userId, conn);
    await conn.connect();

    return conn.getStatus();
  }

  async stopSession(userId) {
    const conn = this.sessions.get(userId);
    if (!conn) return;
    await conn.disconnect();
    this.sessions.delete(userId);
    this.queues.delete(userId);
    this._updateSessionDB(userId, 'disconnected', null);
  }

  async logoutSession(userId) {
    const conn = this.sessions.get(userId);
    if (conn) {
      await conn.logout();
      this.sessions.delete(userId);
      this.queues.delete(userId);
    }
    this._updateSessionDB(userId, 'disconnected', null);
    db.prepare('UPDATE sessions SET whatsapp_number = NULL WHERE user_id = ?').run(userId);
  }

  getSession(userId) {
    return this.sessions.get(userId) || null;
  }

  getQueue(userId) {
    return this.queues.get(userId) || null;
  }

  getSessionStatus(userId) {
    const conn = this.sessions.get(userId);
    if (conn) return conn.getStatus();

    const session = db.prepare('SELECT status, whatsapp_number FROM sessions WHERE user_id = ?').get(userId);
    return {
      connected: false,
      number: session?.whatsapp_number || null,
      status: session?.status || 'disconnected',
    };
  }

  async restoreAllSessions() {
    const activeSessions = db.prepare(
      "SELECT user_id FROM sessions WHERE status IN ('connected', 'connecting')"
    ).all();

    for (const { user_id } of activeSessions) {
      try {
        console.log(`Restoring session for user ${user_id}...`);
        await this.startSession(user_id);
      } catch (err) {
        console.error(`Failed to restore session for user ${user_id}:`, err.message);
      }
    }

    if (activeSessions.length > 0) {
      console.log(`Restored ${activeSessions.length} session(s).`);
    }
  }
}

// Singleton
export default new SessionManager();
