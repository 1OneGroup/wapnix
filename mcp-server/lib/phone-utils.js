/**
 * Normalize Indian phone numbers to 91XXXXXXXXXX format.
 * Copied from backend/shared/phoneUtils.js for MCP server use.
 */
export function normalizePhone(input) {
  let cleaned = String(input || '').replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
  if (cleaned.length === 10) cleaned = '91' + cleaned;
  if (cleaned.length > 0 && !cleaned.startsWith('91')) cleaned = '91' + cleaned;
  return cleaned;
}
