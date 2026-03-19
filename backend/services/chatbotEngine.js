import db from '../db/database.js';

/**
 * Chatbot Engine - processes incoming WhatsApp messages and auto-replies
 * based on user-defined chatbot flows stored in DB.
 *
 * Conversations are tracked in memory per user+phone pair.
 * Each conversation stores the current step ID.
 */

// Active conversations: Map<`${userId}:${phone}`, { stepId, lastActivity, flowId, contactData }>
const conversations = new Map();

// Completed conversations - won't restart: Map<`${userId}:${phone}`, timestamp>
const completedConvos = new Map();

// Allowed phone numbers per user (from uploaded sheet): Map<userId, Set<normalizedPhone>>
const allowedPhones = new Map();

// Conversation timeout: 30 minutes
const TIMEOUT_MS = 30 * 60 * 1000;

function getConvKey(userId, phone) {
  return `${userId}:${phone}`;
}

function cleanExpired() {
  const now = Date.now();
  for (const [key, conv] of conversations) {
    if (now - conv.lastActivity > TIMEOUT_MS) {
      // Mark as expired in DB (conversation incomplete — no reply)
      const [userId, phone] = key.split(':');
      saveConvStatus(parseInt(userId), phone, conv.flowId, 'expired', conv.stepId);
      console.log(`[chatbot] Conversation expired: user=${userId} phone=${phone} step=${conv.stepId}`);
      conversations.delete(key);
    }
  }
  // Clean completed convos after 24 hours
  for (const [key, ts] of completedConvos) {
    if (now - ts > 24 * 60 * 60 * 1000) {
      completedConvos.delete(key);
    }
  }
}

// Save conversation status to DB
function saveConvStatus(userId, phone, flowId, status, stepId = null) {
  try {
    const existing = db.prepare('SELECT id FROM conversation_status WHERE user_id = ? AND phone = ?').get(userId, phone);
    if (existing) {
      db.prepare('UPDATE conversation_status SET status = ?, last_step_id = ?, flow_id = ?, completed_at = ? WHERE id = ?')
        .run(status, stepId, flowId, status !== 'active' ? new Date().toISOString() : null, existing.id);
    } else {
      db.prepare('INSERT INTO conversation_status (user_id, phone, flow_id, status, last_step_id) VALUES (?, ?, ?, ?, ?)')
        .run(userId, phone, flowId, status, stepId);
    }
  } catch (err) {
    console.error('[chatbot] saveConvStatus error:', err.message);
  }
}

// Run cleanup every 5 minutes — also expire old conversations and trigger daily plan
setInterval(cleanExpired, 5 * 60 * 1000);

/** Replace {{variables}} in message with contact data */
function renderMessage(message, contactData) {
  if (!contactData || !message) return message;
  let result = message;
  for (const [key, val] of Object.entries(contactData)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), String(val || ''));
  }
  return result;
}

/**
 * Get active chatbot flow for a user
 */
function getActiveFlow(userId) {
  const row = db.prepare(
    'SELECT * FROM chatbot_flows WHERE user_id = ? AND is_active = 1 LIMIT 1'
  ).get(userId);
  if (!row) return null;
  return { ...row, steps: JSON.parse(row.steps_json) };
}

/**
 * Set allowed phone numbers for a user (from uploaded sheet).
 * Only these numbers will get chatbot replies.
 * Persists to DB so it survives restarts.
 */
export function setAllowedPhones(userId, phones) {
  if (!phones || phones.length === 0) {
    allowedPhones.delete(userId);
    db.prepare('DELETE FROM sheet_filter WHERE user_id = ?').run(userId);
    console.log(`[chatbot] User ${userId}: phone filter cleared`);
  } else {
    const set = new Set(phones);
    allowedPhones.set(userId, set);
    // Persist to DB
    const del = db.prepare('DELETE FROM sheet_filter WHERE user_id = ?');
    const ins = db.prepare('INSERT OR IGNORE INTO sheet_filter (user_id, phone) VALUES (?, ?)');
    const txn = db.transaction(() => {
      del.run(userId);
      for (const p of set) ins.run(userId, p);
    });
    txn();
    console.log(`[chatbot] User ${userId}: phone filter set to ${set.size} numbers (saved to DB)`);
  }
}

/**
 * Add a single phone to the allowed set (without replacing existing ones).
 * Used by Quick Send when sending with a flow.
 */
export function addAllowedPhone(userId, phone) {
  let set = allowedPhones.get(userId);
  if (!set) {
    set = new Set();
    allowedPhones.set(userId, set);
  }
  set.add(phone);
  db.prepare('INSERT OR IGNORE INTO sheet_filter (user_id, phone) VALUES (?, ?)').run(userId, phone);
  console.log(`[chatbot] User ${userId}: added phone ${phone} to filter (total: ${set.size})`);
}

/**
 * Get current allowed phones for a user
 */
export function getAllowedPhones(userId) {
  const set = allowedPhones.get(userId);
  return set ? Array.from(set) : [];
}

/**
 * Restore phone filters from DB on startup
 */
export function restorePhoneFilters() {
  const rows = db.prepare('SELECT DISTINCT user_id FROM sheet_filter').all();
  for (const { user_id } of rows) {
    const phones = db.prepare('SELECT phone FROM sheet_filter WHERE user_id = ?').all(user_id).map(r => r.phone);
    if (phones.length > 0) {
      allowedPhones.set(user_id, new Set(phones));
      console.log(`[chatbot] Restored phone filter for user ${user_id}: ${phones.length} numbers`);
    }
  }
}

/**
 * Get a specific flow by ID (even if not active)
 */
function getFlowById(userId, flowId) {
  const row = db.prepare(
    'SELECT * FROM chatbot_flows WHERE id = ? AND user_id = ?'
  ).get(flowId, userId);
  if (!row) return null;
  return { ...row, steps: JSON.parse(row.steps_json) };
}

/**
 * Process an incoming message and return a reply (or null)
 */
export function processIncomingMessage(userId, phone, messageText) {
  // If phone filter is active, only reply to allowed numbers
  const allowed = allowedPhones.get(userId);
  if (allowed && allowed.size > 0) {
    // Check both raw phone and normalized variants
    const phoneClean = String(phone).replace(/[^0-9]/g, '');
    const with91 = phoneClean.startsWith('91') ? phoneClean : '91' + phoneClean;
    const without91 = phoneClean.startsWith('91') ? phoneClean.slice(2) : phoneClean;
    if (!allowed.has(phoneClean) && !allowed.has(with91) && !allowed.has(without91)) {
      return null; // Not in active sheet, don't reply
    }
  }

  const text = (messageText || '').trim();
  if (!text) return null;

  const key = getConvKey(userId, phone);
  // If conversation already completed, don't restart
  if (completedConvos.has(key)) {
    return null;
  }

  let conv = conversations.get(key);

  // Try to get the flow: either from existing conversation or the globally active flow
  let flow = null;
  if (conv && conv.flowId) {
    flow = getFlowById(userId, conv.flowId);
  }
  if (!flow) {
    flow = getActiveFlow(userId);
  }
  if (!flow) return null; // No flow found at all

  // If no active conversation or expired, start from beginning
  if (!conv || Date.now() - conv.lastActivity > TIMEOUT_MS) {
    const firstStep = flow.steps[0];
    if (!firstStep) return null;

    conv = { stepId: firstStep.id, flowId: flow.id, lastActivity: Date.now(), contactData: null };
    conversations.set(key, conv);

    // Return first step message
    return renderMessage(firstStep.message, conv.contactData);
  }

  // Find current step (use the flow from the conversation)
  const convFlow = conv.flowId ? (getFlowById(userId, conv.flowId) || flow) : flow;
  const currentStep = convFlow.steps.find((s) => s.id === conv.stepId);
  if (!currentStep) {
    // Invalid state, mark completed
    conversations.delete(key);
    completedConvos.set(key, Date.now());
    return null;
  }

  // If current step has no options, it's a terminal step — conversation is DONE
  if (!currentStep.options || currentStep.options.length === 0) {
    conversations.delete(key);
    completedConvos.set(key, Date.now());
    saveConvStatus(userId, phone, conv.flowId, 'completed', conv.stepId);
    console.log(`[chatbot] Conversation completed: user=${userId} phone=${phone}`);
    return null; // Don't restart, conversation is complete
  }

  // Try to match user input to an option
  const inputLower = text.toLowerCase();
  let matched = null;

  for (let i = 0; i < currentStep.options.length; i++) {
    const opt = currentStep.options[i];
    const label = opt.label.toLowerCase();

    // Match by number (1, 2, 3, etc.)
    const num = String(i + 1);
    if (inputLower === num) { matched = opt; break; }

    // Match by label content
    if (label.includes(inputLower) || inputLower.includes(label.split(' - ')[1]?.toLowerCase() || '___')) {
      matched = opt;
      break;
    }

    // Match "yes"/"no" for 2-option steps
    if (currentStep.options.length === 2 || currentStep.options.length === 3) {
      if (i === 0 && (inputLower === 'yes' || inputLower === 'ha' || inputLower === 'haan')) {
        matched = opt; break;
      }
      if (i === 1 && (inputLower === 'no' || inputLower === 'nahi' || inputLower === 'nhi')) {
        matched = opt; break;
      }
    }
  }

  if (!matched) {
    // Invalid input — show expected options
    const expected = currentStep.options.map((o, i) => `${i + 1}`).join(', ');
    return `Please reply with a valid option: ${expected}`;
  }

  // If no next step, end conversation
  if (!matched.next) {
    conversations.delete(key);
    completedConvos.set(key, Date.now());
    saveConvStatus(userId, phone, conv.flowId, 'completed', conv.stepId);
    return null;
  }

  // Find next step
  const nextStep = convFlow.steps.find((s) => s.id === matched.next);
  if (!nextStep) {
    conversations.delete(key);
    completedConvos.set(key, Date.now());
    saveConvStatus(userId, phone, conv.flowId, 'completed', conv.stepId);
    return null;
  }

  // Update conversation state
  conv.stepId = nextStep.id;
  conv.lastActivity = Date.now();
  conversations.set(key, conv);

  // Check if this step has a notify config
  if (nextStep.notify && nextStep.notify.phone) {
    try {
      const contactName = conv.contactData?.name || conv.contactData?.fullname || '';
      let notifyMsg = (nextStep.notify.message || 'New chatbot notification')
        .replace(/\{\{phone\}\}/gi, phone)
        .replace(/\{\{name\}\}/gi, contactName)
        .replace(/\{\{fullname\}\}/gi, contactName)
        .replace(/\{\{step_name\}\}/gi, nextStep.name || nextStep.id)
        .replace(/\{\{flow_name\}\}/gi, convFlow.name || '')
        .replace(/\{\{user_message\}\}/gi, text);
      // Also replace any other contact data variables
      if (conv.contactData) {
        for (const [k, v] of Object.entries(conv.contactData)) {
          notifyMsg = notifyMsg.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'gi'), String(v || ''));
        }
      }
      // Support multiple comma-separated numbers
      const phones = nextStep.notify.phone.split(',').map(p => p.trim().replace(/[^0-9]/g, '')).filter(p => p.length >= 10);
      for (const notifyPhone of phones) {
        pendingNotifications.push({ userId, phone: notifyPhone, message: notifyMsg });
      }
    } catch (err) {
      console.error('[chatbot] Notify error:', err.message);
    }
  }

  return renderMessage(nextStep.message, conv.contactData);
}

// Pending notifications queue
const pendingNotifications = [];

/**
 * Get and clear pending notifications (called by sessionManager after sending reply)
 */
export function getPendingNotifications() {
  return pendingNotifications.splice(0, pendingNotifications.length);
}

/**
 * Initialize conversation state for a contact (used after bulk-sending first step)
 * So when they reply, engine continues from step 1 instead of re-sending step 0.
 */
export function initConversation(userId, phone, flowId, stepId, contactData = null) {
  const key = getConvKey(userId, phone);
  completedConvos.delete(key); // Allow new flow to start
  conversations.set(key, { stepId, flowId, lastActivity: Date.now(), contactData });
  saveConvStatus(userId, phone, flowId, 'active', stepId);
}

/**
 * Reset a conversation
 */
export function resetConversation(userId, phone) {
  conversations.delete(getConvKey(userId, phone));
}

/**
 * Get all active conversations for a user
 */
export function getActiveConversations(userId) {
  const result = [];
  for (const [key, conv] of conversations) {
    if (key.startsWith(`${userId}:`)) {
      result.push({
        phone: key.split(':')[1],
        stepId: conv.stepId,
        lastActivity: conv.lastActivity,
      });
    }
  }
  return result;
}
