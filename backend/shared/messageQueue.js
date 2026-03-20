import { humanDelay } from './antiBan.js';

/**
 * Per-connection, per-recipient message queue with smart rate limiting.
 *
 * - Single sends (e.g. n8n /send) execute instantly if no recent send to same JID.
 * - Consecutive sends to the same recipient are spaced by defaultDelayMs + human jitter.
 * - Global rate limits: max messages per minute and per hour.
 * - Failed sends are retried with exponential backoff.
 *
 * Config options:
 *   defaultDelayMs  - min gap between messages to same recipient (default 1500)
 *   maxPerMinute    - max messages per minute across all recipients (default 12)
 *   maxPerHour      - max messages per hour across all recipients (default 250)
 *   maxRetries      - retry attempts on failure (default 2)
 */
export class MessageQueue {
  constructor({
    defaultDelayMs = 1500,
    maxPerMinute = 12,
    maxPerHour = 250,
    maxRetries = 2,
  } = {}) {
    this.defaultDelayMs = defaultDelayMs;
    this.maxPerMinute = maxPerMinute;
    this.maxPerHour = maxPerHour;
    this.maxRetries = maxRetries;

    // Map<"connName:jid", timestamp> - tracks last send time per recipient per connection
    this.lastSendTimes = new Map();

    // Map<"connName:jid", Promise> - chains sequential sends per recipient
    this.chains = new Map();

    // Global send timestamps for rate limiting
    this.sendTimestamps = [];

    this.stats = { enqueued: 0, sent: 0, failed: 0, rateLimited: 0 };
  }

  _cleanTimestamps() {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    this.sendTimestamps = this.sendTimestamps.filter((t) => t > oneHourAgo);
  }

  _getMinuteCount() {
    const oneMinAgo = Date.now() - 60 * 1000;
    return this.sendTimestamps.filter((t) => t > oneMinAgo).length;
  }

  _getHourCount() {
    this._cleanTimestamps();
    return this.sendTimestamps.length;
  }

  async _waitForRateLimit() {
    while (true) {
      const perMin = this._getMinuteCount();
      const perHour = this._getHourCount();

      if (perMin < this.maxPerMinute && perHour < this.maxPerHour) {
        return; // good to send
      }

      this.stats.rateLimited++;

      if (perHour >= this.maxPerHour) {
        // Wait until oldest hour timestamp expires
        const oldest = this.sendTimestamps[0];
        const waitMs = oldest + 60 * 60 * 1000 - Date.now() + 100;
        console.log(`[Queue] Hour limit (${this.maxPerHour}) reached. Waiting ${Math.ceil(waitMs / 1000)}s...`);
        await this._delay(Math.max(waitMs, 1000));
      } else {
        // Wait until minute window clears
        const oneMinAgo = Date.now() - 60 * 1000;
        const minuteStamps = this.sendTimestamps.filter((t) => t > oneMinAgo);
        const oldest = minuteStamps[0];
        const waitMs = oldest + 60 * 1000 - Date.now() + 100;
        console.log(`[Queue] Minute limit (${this.maxPerMinute}) reached. Waiting ${Math.ceil(waitMs / 1000)}s...`);
        await this._delay(Math.max(waitMs, 1000));
      }
    }
  }

  async enqueue(connectionName, sock, jid, content) {
    this.stats.enqueued++;
    const key = `${connectionName}:${jid}`;

    const prevChain = this.chains.get(key) || Promise.resolve();

    const sendPromise = prevChain.then(async () => {
      // Wait for global rate limit
      await this._waitForRateLimit();

      // Smart delay: only wait if recent send to same recipient
      const now = Date.now();
      const lastSend = this.lastSendTimes.get(key) || 0;
      const elapsed = now - lastSend;

      if (elapsed < this.defaultDelayMs && lastSend > 0) {
        // Add human-like jitter to avoid robotic send patterns (±3 sec random variation)
        const jitter = humanDelay(this.defaultDelayMs - elapsed, 3000);
        await this._delay(jitter);
      }

      // Send with retry
      let lastErr;
      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        try {
          await sock.sendMessage(jid, content);
          this.stats.sent++;
          this.lastSendTimes.set(key, Date.now());
          this.sendTimestamps.push(Date.now());
          return;
        } catch (err) {
          lastErr = err;
          if (attempt < this.maxRetries) {
            const backoff = 2000 * (attempt + 1);
            console.log(`[Queue] Retry ${attempt + 1}/${this.maxRetries} for ${jid} on ${connectionName} in ${backoff}ms`);
            await this._delay(backoff);
          }
        }
      }

      this.stats.failed++;
      throw lastErr;
    });

    // Store chain (swallow errors on chain to prevent blocking next message)
    this.chains.set(key, sendPromise.catch(() => {}));

    // Return actual promise so callers can await/catch
    return sendPromise;
  }

  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getStats() {
    return {
      ...this.stats,
      currentPerMinute: this._getMinuteCount(),
      currentPerHour: this._getHourCount(),
      limits: {
        maxPerMinute: this.maxPerMinute,
        maxPerHour: this.maxPerHour,
        delayMs: this.defaultDelayMs,
      },
    };
  }
}
