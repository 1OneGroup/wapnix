/**
 * Anti-ban protection for WhatsApp messaging via Baileys.
 *
 * Features:
 *   - Human-like random delays (gaussian jitter) between messages
 *   - Typing simulation (composing presence) before sending
 *   - 7-day warm-up for new/fresh numbers (gradual daily limit increase)
 *   - Health monitoring with risk score (0-100)
 *   - Auto-pause when risk is high
 *   - Active hours enforcement (no sends outside business hours)
 */

import fs from 'fs';
import path from 'path';

// ── Gaussian random (Box-Muller) ──
function gaussianRandom(mean, stdDev) {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(0, mean + z * stdDev);
}

// ── Human-like delay ──
export function humanDelay(baseMs = 2000, jitterMs = 1000) {
  return Math.round(gaussianRandom(baseMs, jitterMs));
}

// ── Warm-up Manager ──
export class WarmUpManager {
  constructor(stateFile) {
    this.stateFile = stateFile;
    this.state = this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.stateFile)) {
        return JSON.parse(fs.readFileSync(this.stateFile, 'utf-8'));
      }
    } catch {}
    return { startDate: new Date().toISOString(), sentToday: 0, lastSendDate: '' };
  }

  _save() {
    try {
      fs.mkdirSync(path.dirname(this.stateFile), { recursive: true });
      fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2));
    } catch {}
  }

  getDayNumber() {
    const start = new Date(this.state.startDate);
    const now = new Date();
    return Math.floor((now - start) / (24 * 60 * 60 * 1000)) + 1;
  }

  getDailyLimit() {
    const day = this.getDayNumber();
    if (day >= 8) return Infinity; // warm-up complete
    // Day 1=20, Day 2=36, Day 3=65, Day 4=117, Day 5=210, Day 6=378, Day 7=680
    return Math.round(20 * Math.pow(1.8, day - 1));
  }

  canSend() {
    const today = new Date().toISOString().slice(0, 10);
    if (this.state.lastSendDate !== today) {
      this.state.sentToday = 0;
      this.state.lastSendDate = today;
    }
    return this.state.sentToday < this.getDailyLimit();
  }

  recordSend() {
    const today = new Date().toISOString().slice(0, 10);
    if (this.state.lastSendDate !== today) {
      this.state.sentToday = 0;
      this.state.lastSendDate = today;
    }
    this.state.sentToday++;
    this._save();
  }

  getStatus() {
    return {
      day: this.getDayNumber(),
      dailyLimit: this.getDailyLimit(),
      sentToday: this.state.sentToday,
      warmUpComplete: this.getDayNumber() >= 8,
    };
  }
}

// ── Health Monitor ──
export class HealthMonitor {
  constructor(name) {
    this.name = name;
    this.failedSends = 0;
    this.disconnects = 0;
    this.totalSends = 0;
    this.paused = false;
    this.lastReset = Date.now();
  }

  recordSuccess() {
    this.totalSends++;
    // Decay failures on success
    if (this.failedSends > 0) this.failedSends = Math.max(0, this.failedSends - 0.5);
  }

  recordFailure() {
    this.failedSends++;
    this.totalSends++;
  }

  recordDisconnect() {
    this.disconnects++;
  }

  getScore() {
    // Risk score 0-100
    let score = 0;
    score += Math.min(this.failedSends * 10, 40); // failed sends up to 40
    score += Math.min(this.disconnects * 15, 45);  // disconnects up to 45
    // High send velocity penalty
    const elapsed = (Date.now() - this.lastReset) / (60 * 60 * 1000); // hours
    if (elapsed > 0 && this.totalSends / elapsed > 200) score += 15;
    return Math.min(100, Math.round(score));
  }

  getLevel() {
    const score = this.getScore();
    if (score >= 85) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 30) return 'medium';
    return 'low';
  }

  shouldPause() {
    return this.getLevel() === 'critical' || this.getLevel() === 'high';
  }

  reset() {
    this.failedSends = 0;
    this.disconnects = 0;
    this.totalSends = 0;
    this.paused = false;
    this.lastReset = Date.now();
  }

  getStatus() {
    return {
      score: this.getScore(),
      level: this.getLevel(),
      failedSends: this.failedSends,
      disconnects: this.disconnects,
      totalSends: this.totalSends,
      paused: this.paused,
    };
  }
}

// ── Typing Simulation ──
export async function simulateTyping(sock, jid, durationMs = 1500) {
  try {
    await sock.sendPresenceUpdate('composing', jid);
    await new Promise(r => setTimeout(r, durationMs));
    await sock.sendPresenceUpdate('paused', jid);
  } catch {
    // ignore presence errors
  }
}

// ── Active Hours Check (IST) ──
export function isActiveHours() {
  const now = new Date();
  // Convert to IST (UTC+5:30)
  const istHour = (now.getUTCHours() + 5 + (now.getUTCMinutes() + 30 >= 60 ? 1 : 0)) % 24;
  // Active between 8 AM and 9 PM IST
  return istHour >= 8 && istHour < 21;
}
