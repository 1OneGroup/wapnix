/**
 * Normalize Indian phone numbers to 91XXXXXXXXXX format.
 */
export function normalizePhone(input) {
  let cleaned = String(input || '').replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
  // 10 digits = Indian mobile, always add 91
  if (cleaned.length === 10) cleaned = '91' + cleaned;
  // 11 digits starting with 0 already stripped above
  // If not starting with 91 and not 12 digits, add 91
  if (cleaned.length > 0 && !cleaned.startsWith('91')) cleaned = '91' + cleaned;
  return cleaned;
}

/**
 * Strict normalizer used for lead/contact identity resolution.
 * Accepts:
 * - 10 digits: XXXXXXXXXX -> 91XXXXXXXXXX
 * - 11 digits: 0XXXXXXXXXX -> 91XXXXXXXXXX
 * - 12 digits: 91XXXXXXXXXX
 * Returns empty string when value doesn't look like a real mobile.
 */
export function normalizeLeadPhone(input) {
  const digits = String(input || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return '';
}

export function extractPhoneFromJid(jid) {
  const idPart = String(jid || '').split('@')[0];
  return normalizeLeadPhone(idPart);
}

function collectStringValues(value, out, depth = 0) {
  if (depth > 8 || value == null) return;
  if (typeof value === 'string') {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStringValues(item, out, depth + 1);
    return;
  }
  if (typeof value === 'object') {
    for (const v of Object.values(value)) collectStringValues(v, out, depth + 1);
  }
}

export function extractPhoneFromMessage(msg) {
  const key = msg?.key || {};
  const candidates = [
    key.remoteJid,
    key.participant,
    key.participantPn,
    key.participantLid,
    key.senderPn,
    key.senderLid,
    msg?.participant,
    msg?.participantPn,
    msg?.participantLid,
  ];

  for (const candidate of candidates) {
    const phone = extractPhoneFromJid(candidate);
    if (phone) return phone;
  }

  // Deep fallback: scan any nested string values for phone-like identifiers.
  const values = [];
  collectStringValues(msg, values);

  for (const value of values) {
    const phoneFromJid = extractPhoneFromJid(value);
    if (phoneFromJid) return phoneFromJid;
  }

  for (const value of values) {
    const phone = normalizeLeadPhone(value);
    if (phone) return phone;
  }

  return '';
}

export function toJid(phone) {
  return `${phone}@s.whatsapp.net`;
}
