import db from '../db/database.js';
import crypto from 'crypto';

/**
 * Fire outbound webhooks for a user event.
 * @param {number} userId - The user ID
 * @param {string} event - Event name (e.g. 'message.sent', 'lead.received')
 * @param {object} payload - Event payload data
 */
export async function fireWebhook(userId, event, payload) {
  try {
    const webhooks = db.prepare(
      'SELECT * FROM webhooks WHERE user_id = ? AND is_active = 1'
    ).all(userId);

    for (const webhook of webhooks) {
      const events = JSON.parse(webhook.events || '["*"]');
      if (!events.includes('*') && !events.includes(event)) continue;

      const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload });
      const signature = crypto.createHmac('sha256', webhook.secret).update(body).digest('hex');

      // Fire and forget with retries
      deliverWebhook(webhook.url, body, signature, 0).catch(err => {
        console.error(`[webhook] Failed delivery to ${webhook.url}: ${err.message}`);
      });
    }
  } catch (err) {
    console.error(`[webhook] Error firing ${event}:`, err.message);
  }
}

async function deliverWebhook(url, body, signature, attempt) {
  const maxAttempts = 3;
  const delays = [0, 5000, 30000]; // immediate, 5s, 30s

  if (attempt > 0) {
    await new Promise(r => setTimeout(r, delays[attempt] || 30000));
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Wapnix-Signature': `sha256=${signature}`,
        'X-Wapnix-Event': JSON.parse(body).event,
      },
      body,
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok && attempt < maxAttempts - 1) {
      return deliverWebhook(url, body, signature, attempt + 1);
    }
  } catch (err) {
    if (attempt < maxAttempts - 1) {
      return deliverWebhook(url, body, signature, attempt + 1);
    }
    throw err;
  }
}

/**
 * Supported webhook events:
 * - message.sent       - A message was successfully sent
 * - message.failed     - A message failed to send
 * - message.received   - An incoming message was received (via chatbot)
 * - campaign.step_completed - A campaign step was sent to a contact
 * - campaign.completed  - All contacts in a campaign are done
 * - lead.received      - A new website lead was submitted
 * - chatbot.conversation_completed - A chatbot flow completed for a contact
 */
