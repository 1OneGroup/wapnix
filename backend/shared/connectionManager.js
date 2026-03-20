import makeWASocket, { useMultiFileAuthState, DisconnectReason, Browsers } from '@whiskeysockets/baileys';
import path from 'path';
import pino from 'pino';
import { WarmUpManager, HealthMonitor, humanDelay, simulateTyping } from './antiBan.js';

/**
 * Reusable Baileys connection manager with callback support for multi-tenant SaaS.
 * Each instance manages one WhatsApp session with its own socket, auth, and reconnect logic.
 *
 * Callbacks:
 *   onQR(qrString)              - Called when QR code is available for scanning
 *   onStatusChange(status, info) - Called on connection state changes
 *   onMessage(sock, upsert)     - Called on incoming messages
 */
export class ConnectionManager {
  constructor({ name, authFolder, onMessage, messageQueue, onQR, onStatusChange, onPairingCode }) {
    this.name = name;
    this.authFolder = authFolder;
    this.onMessage = onMessage;
    this.messageQueue = messageQueue;
    this.onQR = onQR;
    this.onStatusChange = onStatusChange;
    this.onPairingCode = onPairingCode;

    this.sock = null;
    this.reconnectTimer = null;
    this.keepAliveTimer = null;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.isConnected = false;
    this.whatsappNumber = null;
    this.pairingPhone = null; // phone number for pairing code mode
    this.conflictCount = 0; // track consecutive 440 conflicts
    this.logger = pino({ level: 'silent' });

    // Anti-ban: warm-up manager + health monitor
    const warmUpFile = path.join(authFolder, '..', `warmup_${name}.json`);
    this.warmUp = new WarmUpManager(warmUpFile);
    this.health = new HealthMonitor(name);
  }

  _getDisconnectCode(lastDisconnect) {
    return (
      lastDisconnect?.error?.output?.statusCode ??
      lastDisconnect?.error?.data?.statusCode ??
      lastDisconnect?.error?.statusCode ??
      null
    );
  }

  _scheduleReconnect(delayMs, reason) {
    if (this.reconnectTimer) {
      console.log(`[${this.name}] Reconnect already scheduled. Skip (${reason}).`);
      return;
    }
    this.reconnectAttempts += 1;
    console.log(`[${this.name}] Reconnect #${this.reconnectAttempts} in ${delayMs / 1000}s (${reason}).`);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      await this.connect();
    }, delayMs);
  }

  _startKeepAlive() {
    this._stopKeepAlive();
    this.keepAliveTimer = setInterval(async () => {
      if (!this.sock || !this.isConnected) return;
      try {
        await this.sock.sendPresenceUpdate('available');
      } catch (err) {
        console.log(`[${this.name}] Keep-alive failed: ${err.message}. Triggering reconnect...`);
        this.isConnected = false;
        this._stopKeepAlive();
        this._scheduleReconnect(5000, 'keep-alive failed');
        this.onStatusChange?.('disconnected', { reason: 'keep-alive failed' });
      }
    }, 5 * 60 * 1000);
  }

  _stopKeepAlive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  async connect() {
    if (this.isConnecting) return;
    this.isConnecting = true;

    this._stopKeepAlive();
    this.onStatusChange?.('connecting', {});

    // Clean up existing socket
    if (this.sock) {
      try {
        this.sock.ev.removeAllListeners();
        this.sock.ws?.close();
      } catch (_) {
        // best effort cleanup
      }
      this.sock = null;
    }

    // For pairing code mode on FIRST attempt only, clean auth folder
    if (this.pairingPhone && !this._pairingCodeSent) {
      const fs = await import('fs');
      const path = await import('path');
      const authPath = path.default.resolve(this.authFolder);
      if (fs.default.existsSync(authPath)) {
        fs.default.rmSync(authPath, { recursive: true, force: true });
        fs.default.mkdirSync(authPath, { recursive: true });
        console.log(`[${this.name}] Cleaned auth folder for fresh pairing`);
      }
    }

    // Use pairing browser if we started with pairing (even on reconnect)
    const usePairingBrowser = !!this.pairingPhone;

    try {
      const { state, saveCreds } = await useMultiFileAuthState(this.authFolder);

      const rawSock = makeWASocket({
        auth: state,
        logger: this.logger,
        printQRInTerminal: false,
        // Pairing code requires Chrome/Firefox/Safari browser identity
        browser: usePairingBrowser ? Browsers.ubuntu('Chrome') : ['WhatsApp Business Plan', 'Chrome', '1.0.0'],
        markOnlineOnConnect: true,
        syncFullHistory: false,
        getMessage: async () => ({ conversation: '' }),
      });

      // Wrap with anti-ban protection (rate limiting, warm-up, health monitoring)
      this.sock = wrapSocket(rawSock, {
        rateLimiter: {
          maxPerMinute: 8,
          maxPerHour: 200,
          maxPerDay: 1500,
          minDelayMs: 1500,
          maxDelayMs: 5000,
        },
        warmUp: {
          warmUpDays: 7,
          day1Limit: 20,
          growthFactor: 1.8,
        },
        health: {
          autoPauseAt: 'high',
          onRiskChange: (status) => {
            console.log(`[${this.name}] Anti-ban risk: ${status.level} (score: ${status.score})`);
          },
        },
        logging: false,
      });

      // If pairing code mode and code not yet sent, request it
      if (this.pairingPhone && !this._pairingCodeSent && !state.creds.registered) {
        this._pairingCodeSent = true; // Mark so reconnects don't re-request
        // Small delay to let socket initialize
        setTimeout(async () => {
          try {
            const code = await this.sock.requestPairingCode(this.pairingPhone);
            console.log(`[${this.name}] Pairing code for ${this.pairingPhone}: ${code}`);
            this.onPairingCode?.(code);
          } catch (err) {
            console.error(`[${this.name}] Pairing code request failed:`, err.message);
            this.onStatusChange?.('failed', { reason: 'Pairing code request failed: ' + err.message });
          }
        }, 3000);
      }

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && !this.pairingPhone) {
          // Only emit QR if not in pairing code mode
          this._latestQR = qr;
          this.onQR?.(qr);
        }

        if (connection === 'close') {
          this.isConnected = false;
          this._stopKeepAlive();
          this.health.recordDisconnect();
          const statusCode = this._getDisconnectCode(lastDisconnect);
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;
          const isConflict = statusCode === 440;

          console.log(`[${this.name}] Connection closed (status: ${statusCode ?? 'unknown'}).`);

          if (isLoggedOut || statusCode === 401) {
            console.log(`[${this.name}] Session expired/logged out (${statusCode}). Clearing auth and requiring fresh QR.`);
            this.onStatusChange?.('logged_out', {});
            return;
          }

          if (isConflict) {
            this.conflictCount++;
            if (this.conflictCount >= 3) {
              console.log(`[${this.name}] Session conflict (440) persists after ${this.conflictCount} attempts. Stopping. User must re-link device.`);
              this.onStatusChange?.('failed', { reason: 'Session conflict — another device is using this WhatsApp. Please re-link from Device Link page.' });
              return;
            }
            this.onStatusChange?.('disconnected', { reason: 'conflict' });
            this._scheduleReconnect(30000, 'session conflict 440');
            return;
          }

          this.onStatusChange?.('disconnected', { reason: `status=${statusCode}` });
          // Stop retrying after 5 attempts if we never connected
          if (this.reconnectAttempts >= 5 && !this.whatsappNumber) {
            console.log(`[${this.name}] Max reconnect attempts reached without ever connecting. Giving up.`);
            this.onStatusChange?.('failed', { reason: 'Max reconnect attempts reached. Try again.' });
            return;
          }
          const delayMs = Math.min(10000 + this.reconnectAttempts * 5000, 60000);
          this._scheduleReconnect(delayMs, `status=${statusCode ?? 'unknown'}`);
        } else if (connection === 'open') {
          this.isConnected = true;
          this._latestQR = null;
          this.reconnectAttempts = 0;
          this.conflictCount = 0;
          this.whatsappNumber = this.sock.user?.id?.split(':')[0] || null;
          console.log(`[${this.name}] Connected to WhatsApp! Number: ${this.whatsappNumber}`);
          this.onStatusChange?.('connected', { number: this.whatsappNumber });
          this._startKeepAlive();
        }
      });

      this.sock.ev.process(async (events) => {
        const eventKeys = Object.keys(events);
        // Log all event types for debugging (except noisy ones)
        const interesting = eventKeys.filter(k => !k.startsWith('presence') && k !== 'creds.update');
        if (interesting.length > 0) {
          console.log(`[${this.name}] Events: ${interesting.join(', ')}`);
        }

        if (events['messages.upsert'] && this.onMessage) {
          const upsert = events['messages.upsert'];
          console.log(`[${this.name}] messages.upsert type=${upsert.type} count=${upsert.messages?.length || 0}`);
          try {
            await this.onMessage(this.sock, upsert);
          } catch (err) {
            console.error(`[${this.name}] Message handler error:`, err.message);
          }
        }
      });
    } finally {
      this.isConnecting = false;
    }
  }

  async disconnect() {
    this._stopKeepAlive();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.sock) {
      try {
        this.sock.ev.removeAllListeners();
        this.sock.ws?.close();
      } catch (_) {}
      this.sock = null;
    }
    this.isConnected = false;
    this.isConnecting = false;
    this.onStatusChange?.('disconnected', { reason: 'manual' });
  }

  async sendMessage(jid, content) {
    if (!this.sock || !this.isConnected) {
      this._scheduleReconnect(2000, 'send requested while disconnected');
      throw new Error(`[${this.name}] WhatsApp not connected.`);
    }

    // Anti-ban: check health risk
    if (this.health.shouldPause()) {
      console.log(`[${this.name}] Anti-ban: HIGH RISK (score: ${this.health.getScore()}). Pausing sends.`);
      throw new Error(`[${this.name}] Sending paused due to high risk score. Try again later.`);
    }

    // Anti-ban: warm-up daily limit check
    if (!this.warmUp.canSend()) {
      const ws = this.warmUp.getStatus();
      console.log(`[${this.name}] Anti-ban: Warm-up day ${ws.day} limit reached (${ws.sentToday}/${ws.dailyLimit}).`);
      throw new Error(`[${this.name}] Daily warm-up limit reached (${ws.sentToday}/${ws.dailyLimit}). Try tomorrow.`);
    }

    // Anti-ban: simulate typing before text messages
    if (content.text || content.conversation) {
      await simulateTyping(this.sock, jid, humanDelay(1200, 500));
    }

    try {
      let result;
      if (this.messageQueue) {
        result = await this.messageQueue.enqueue(this.name, this.sock, jid, content);
      } else {
        result = await this.sock.sendMessage(jid, content);
      }
      this.warmUp.recordSend();
      this.health.recordSuccess();
      return result;
    } catch (err) {
      this.health.recordFailure();
      throw err;
    }
  }

  async logout() {
    try {
      if (this.sock) {
        await this.sock.logout().catch(() => {});
        this.sock.ev.removeAllListeners();
        this.sock.ws?.close();
        this.sock = null;
      }
    } catch (_) {}
    this.isConnected = false;
    this.isConnecting = false;
    this._stopKeepAlive();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const fs = await import('fs');
    const path = await import('path');
    const authPath = path.default.resolve(this.authFolder);
    if (fs.default.existsSync(authPath)) {
      fs.default.rmSync(authPath, { recursive: true, force: true });
    }
    this.onStatusChange?.('logged_out', {});
  }

  getLatestQR() {
    return this._latestQR || null;
  }

  getStatus() {
    return {
      name: this.name,
      connected: this.isConnected,
      number: this.whatsappNumber,
      antiBan: {
        warmUp: this.warmUp.getStatus(),
        health: this.health.getStatus(),
      },
    };
  }
}
