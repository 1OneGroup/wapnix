/**
 * Parse a date string into MM-DD format for scheduler date matching.
 * Supports multiple formats with DD/MM (Indian/European) convention for ambiguous dates.
 * @param {string} dateStr - Date string in various formats
 * @returns {string|null} - "MM-DD" format or null if unparseable
 */
export function parseDateToMMDD(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const s = String(dateStr).trim();
  if (!s) return null;

  const monthNames = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };

  let month, day;

  // ISO: YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    month = parseInt(iso[2]);
    day = parseInt(iso[3]);
    return formatMMDD(month, day);
  }

  // DD-MMM or DD MMM (e.g., "15-Apr", "15 Apr")
  const dayMonth = s.match(/^(\d{1,2})[\s-]([a-zA-Z]{3,})$/);
  if (dayMonth) {
    day = parseInt(dayMonth[1]);
    const m = monthNames[dayMonth[2].slice(0, 3).toLowerCase()];
    if (m) return formatMMDD(parseInt(m), day);
  }

  // MMM DD (e.g., "Apr 15")
  const monthDay = s.match(/^([a-zA-Z]{3,})[\s-](\d{1,2})$/);
  if (monthDay) {
    day = parseInt(monthDay[2]);
    const m = monthNames[monthDay[1].slice(0, 3).toLowerCase()];
    if (m) return formatMMDD(parseInt(m), day);
  }

  // DD/MM/YYYY or DD-MM-YYYY (Indian standard: first=day, second=month)
  const dmySlash = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmySlash) {
    day = parseInt(dmySlash[1]);
    month = parseInt(dmySlash[2]);
    return formatMMDD(month, day);
  }

  // DD/MM or DD-MM (without year)
  const dm = s.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (dm) {
    day = parseInt(dm[1]);
    month = parseInt(dm[2]);
    return formatMMDD(month, day);
  }

  return null;
}

function formatMMDD(month, day) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

/**
 * Build date_cache JSON from contact_data for specified date columns.
 * @param {object} contactData - Parsed CSV row as key-value object
 * @param {string[]} dateColumns - Column names to parse as dates
 * @returns {object} - { columnName: "MM-DD" | null }
 */
export function buildDateCache(contactData, dateColumns) {
  const cache = {};
  for (const col of dateColumns) {
    const val = contactData[col];
    cache[col] = val ? parseDateToMMDD(String(val)) : null;
  }
  return cache;
}
