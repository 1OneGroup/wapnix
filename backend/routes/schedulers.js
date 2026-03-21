import { Router } from 'express';
import db from '../db/database.js';
import { normalizePhone } from '../shared/phoneUtils.js';
import { buildDateCache, parseDateToMMDD } from '../shared/dateParser.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

// Multer for rule media uploads
const upload = multer({
  dest: path.join(__dirname, '..', 'uploads', 'scheduler'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ── Scheduler CRUD ──

// List all schedulers for user
router.get('/', (req, res) => {
  const schedulers = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM scheduler_rules WHERE scheduler_id = s.id) as rule_count,
      (SELECT COUNT(*) FROM scheduler_contacts WHERE scheduler_id = s.id) as contact_count
    FROM schedulers s
    WHERE s.user_id = ?
    ORDER BY s.updated_at DESC
  `).all(req.user.id);
  res.json({ schedulers });
});

// Get single scheduler with rules, stats
router.get('/:id', (req, res) => {
  const scheduler = db.prepare('SELECT * FROM schedulers WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!scheduler) return res.status(404).json({ error: 'Scheduler not found' });

  const rules = db.prepare(`
    SELECT sr.*, t.name as template_name, t.body as template_body
    FROM scheduler_rules sr
    LEFT JOIN templates t ON sr.template_id = t.id
    WHERE sr.scheduler_id = ?
    ORDER BY sr.created_at ASC
  `).all(scheduler.id);

  const contactCount = db.prepare('SELECT COUNT(*) as c FROM scheduler_contacts WHERE scheduler_id = ?').get(scheduler.id).c;

  const totalSent = db.prepare("SELECT COUNT(*) as c FROM scheduler_logs WHERE scheduler_id = ? AND status = 'sent'").get(scheduler.id).c;
  const totalFailed = db.prepare("SELECT COUNT(*) as c FROM scheduler_logs WHERE scheduler_id = ? AND status = 'failed'").get(scheduler.id).c;

  // Detect available date columns from first contact's data
  let csvColumns = [];
  const firstContact = db.prepare('SELECT contact_data FROM scheduler_contacts WHERE scheduler_id = ? LIMIT 1').get(scheduler.id);
  if (firstContact) {
    try { csvColumns = Object.keys(JSON.parse(firstContact.contact_data)); } catch {}
  }

  res.json({
    scheduler,
    rules,
    contactCount,
    stats: { totalSent, totalFailed, successRate: totalSent + totalFailed > 0 ? Math.round((totalSent / (totalSent + totalFailed)) * 100) : 0 },
    csvColumns,
  });
});

// Create scheduler
router.post('/', (req, res) => {
  const { name, description, send_time, timezone, catch_up_past_dates } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const result = db.prepare(
    'INSERT INTO schedulers (user_id, name, description, send_time, timezone, catch_up_past_dates) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, name, description || '', send_time || '00:00', timezone || 'Asia/Kolkata', catch_up_past_dates ? 1 : 0);

  res.json({ id: result.lastInsertRowid, message: 'Scheduler created' });
});

// Update scheduler
router.put('/:id', (req, res) => {
  const scheduler = db.prepare('SELECT * FROM schedulers WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!scheduler) return res.status(404).json({ error: 'Scheduler not found' });

  const { name, description, send_time, timezone, catch_up_past_dates } = req.body;
  db.prepare(
    'UPDATE schedulers SET name = ?, description = ?, send_time = ?, timezone = ?, catch_up_past_dates = ?, updated_at = ? WHERE id = ?'
  ).run(
    name || scheduler.name,
    description !== undefined ? description : scheduler.description,
    send_time || scheduler.send_time,
    timezone || scheduler.timezone,
    catch_up_past_dates !== undefined ? (catch_up_past_dates ? 1 : 0) : scheduler.catch_up_past_dates,
    new Date().toISOString(),
    scheduler.id
  );

  res.json({ message: 'Scheduler updated' });
});

// Delete scheduler (cascade deletes rules, contacts, logs)
router.delete('/:id', (req, res) => {
  const scheduler = db.prepare('SELECT * FROM schedulers WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!scheduler) return res.status(404).json({ error: 'Scheduler not found' });
  db.prepare('DELETE FROM schedulers WHERE id = ?').run(scheduler.id);
  res.json({ message: 'Scheduler deleted' });
});

// Activate scheduler
router.post('/:id/activate', (req, res) => {
  const scheduler = db.prepare('SELECT * FROM schedulers WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!scheduler) return res.status(404).json({ error: 'Scheduler not found' });
  db.prepare("UPDATE schedulers SET status = 'active', updated_at = ? WHERE id = ?").run(new Date().toISOString(), scheduler.id);
  res.json({ message: 'Scheduler activated' });
});

// Pause scheduler
router.post('/:id/pause', (req, res) => {
  const scheduler = db.prepare('SELECT * FROM schedulers WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!scheduler) return res.status(404).json({ error: 'Scheduler not found' });
  db.prepare("UPDATE schedulers SET status = 'paused', updated_at = ? WHERE id = ?").run(new Date().toISOString(), scheduler.id);
  res.json({ message: 'Scheduler paused' });
});

// ── Rules ──

// Add rule
router.post('/:id/rules', upload.single('media'), (req, res) => {
  const scheduler = db.prepare('SELECT * FROM schedulers WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!scheduler) return res.status(404).json({ error: 'Scheduler not found' });

  const { name, date_column, template_id } = req.body;
  if (!name || !date_column || !template_id) return res.status(400).json({ error: 'name, date_column, and template_id are required' });

  // Verify template exists and belongs to user
  const template = db.prepare('SELECT id FROM templates WHERE id = ? AND user_id = ?').get(parseInt(template_id), req.user.id);
  if (!template) return res.status(404).json({ error: 'Template not found' });

  let media_path = null;
  let media_type = null;
  if (req.file) {
    media_path = 'uploads/scheduler/' + req.file.filename;
    const ext = path.extname(req.file.originalname).toLowerCase();
    media_type = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext) ? 'image' : 'document';
  }

  const result = db.prepare(
    'INSERT INTO scheduler_rules (scheduler_id, name, date_column, template_id, media_path, media_type) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(scheduler.id, name, date_column, parseInt(template_id), media_path, media_type);

  res.json({ id: result.lastInsertRowid, message: 'Rule added' });
});

// Update rule
router.put('/:id/rules/:ruleId', upload.single('media'), (req, res) => {
  const scheduler = db.prepare('SELECT * FROM schedulers WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!scheduler) return res.status(404).json({ error: 'Scheduler not found' });

  const rule = db.prepare('SELECT * FROM scheduler_rules WHERE id = ? AND scheduler_id = ?').get(req.params.ruleId, scheduler.id);
  if (!rule) return res.status(404).json({ error: 'Rule not found' });

  const { name, date_column, template_id } = req.body;

  let media_path = rule.media_path;
  let media_type = rule.media_type;
  if (req.file) {
    media_path = 'uploads/scheduler/' + req.file.filename;
    const ext = path.extname(req.file.originalname).toLowerCase();
    media_type = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext) ? 'image' : 'document';
  }

  db.prepare(
    'UPDATE scheduler_rules SET name = ?, date_column = ?, template_id = ?, media_path = ?, media_type = ? WHERE id = ?'
  ).run(name || rule.name, date_column || rule.date_column, template_id ? parseInt(template_id) : rule.template_id, media_path, media_type, rule.id);

  res.json({ message: 'Rule updated' });
});

// Delete rule
router.delete('/:id/rules/:ruleId', (req, res) => {
  const scheduler = db.prepare('SELECT * FROM schedulers WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!scheduler) return res.status(404).json({ error: 'Scheduler not found' });
  const rule = db.prepare('SELECT * FROM scheduler_rules WHERE id = ? AND scheduler_id = ?').get(req.params.ruleId, scheduler.id);
  if (!rule) return res.status(404).json({ error: 'Rule not found' });
  db.prepare('DELETE FROM scheduler_rules WHERE id = ?').run(rule.id);
  res.json({ message: 'Rule deleted' });
});

// ── Contacts ──

// Upload CSV contacts (chunked)
router.post('/:id/contacts/upload', (req, res) => {
  const scheduler = db.prepare('SELECT * FROM schedulers WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!scheduler) return res.status(404).json({ error: 'Scheduler not found' });

  const { contacts, phone_column, date_columns } = req.body;
  if (!Array.isArray(contacts) || !phone_column) return res.status(400).json({ error: 'contacts array and phone_column required' });

  const dateColArr = Array.isArray(date_columns) ? date_columns : [];
  let imported = 0, updated = 0, skipped = 0;
  const errors = [];

  const insertStmt = db.prepare(
    'INSERT INTO scheduler_contacts (scheduler_id, phone, contact_data, date_cache) VALUES (?, ?, ?, ?)'
  );
  const updateStmt = db.prepare(
    'UPDATE scheduler_contacts SET contact_data = ?, date_cache = ?, created_at = ? WHERE scheduler_id = ? AND phone = ?'
  );
  const checkStmt = db.prepare('SELECT id FROM scheduler_contacts WHERE scheduler_id = ? AND phone = ?');

  const transaction = db.transaction(() => {
    for (let i = 0; i < contacts.length; i++) {
      const row = contacts[i];
      const rawPhone = row[phone_column];
      if (!rawPhone) { errors.push({ row: i + 1, error: 'Missing phone number' }); skipped++; continue; }

      const phone = normalizePhone(String(rawPhone));
      if (!phone) { errors.push({ row: i + 1, error: `Invalid phone: ${rawPhone}` }); skipped++; continue; }

      const contactData = JSON.stringify(row);
      const dateCache = JSON.stringify(buildDateCache(row, dateColArr));

      const existing = checkStmt.get(scheduler.id, phone);
      if (existing) {
        updateStmt.run(contactData, dateCache, new Date().toISOString(), scheduler.id, phone);
        updated++;
      } else {
        insertStmt.run(scheduler.id, phone, contactData, dateCache);
        imported++;
      }
    }
  });

  transaction();
  res.json({ imported, updated, skipped, errors: errors.slice(0, 20), total: contacts.length });
});

// List contacts
router.get('/:id/contacts', (req, res) => {
  const scheduler = db.prepare('SELECT * FROM schedulers WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!scheduler) return res.status(404).json({ error: 'Scheduler not found' });

  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = (page - 1) * limit;
  const search = req.query.search || '';

  let contacts, total;
  if (search) {
    contacts = db.prepare(
      'SELECT * FROM scheduler_contacts WHERE scheduler_id = ? AND (phone LIKE ? OR contact_data LIKE ?) ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(scheduler.id, `%${search}%`, `%${search}%`, limit, offset);
    total = db.prepare(
      'SELECT COUNT(*) as c FROM scheduler_contacts WHERE scheduler_id = ? AND (phone LIKE ? OR contact_data LIKE ?)'
    ).get(scheduler.id, `%${search}%`, `%${search}%`).c;
  } else {
    contacts = db.prepare('SELECT * FROM scheduler_contacts WHERE scheduler_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(scheduler.id, limit, offset);
    total = db.prepare('SELECT COUNT(*) as c FROM scheduler_contacts WHERE scheduler_id = ?').get(scheduler.id).c;
  }

  res.json({ contacts, total, page, limit });
});

// Add single contact
router.post('/:id/contacts', (req, res) => {
  const scheduler = db.prepare('SELECT * FROM schedulers WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!scheduler) return res.status(404).json({ error: 'Scheduler not found' });

  const { phone: rawPhone, ...rest } = req.body;
  if (!rawPhone) return res.status(400).json({ error: 'Phone is required' });

  const phone = normalizePhone(String(rawPhone));
  if (!phone) return res.status(400).json({ error: 'Invalid phone number' });

  // Get date columns from existing rules
  const rules = db.prepare('SELECT date_column FROM scheduler_rules WHERE scheduler_id = ?').all(scheduler.id);
  const dateColumns = rules.map(r => r.date_column);

  const contactData = { phone: rawPhone, ...rest };
  const dateCache = buildDateCache(contactData, dateColumns);

  try {
    const result = db.prepare(
      'INSERT INTO scheduler_contacts (scheduler_id, phone, contact_data, date_cache) VALUES (?, ?, ?, ?)'
    ).run(scheduler.id, phone, JSON.stringify(contactData), JSON.stringify(dateCache));
    res.json({ id: result.lastInsertRowid, message: 'Contact added' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Contact with this phone already exists' });
    throw err;
  }
});

// Update contact
router.put('/:id/contacts/:contactId', (req, res) => {
  const scheduler = db.prepare('SELECT * FROM schedulers WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!scheduler) return res.status(404).json({ error: 'Scheduler not found' });

  const contact = db.prepare('SELECT * FROM scheduler_contacts WHERE id = ? AND scheduler_id = ?').get(req.params.contactId, scheduler.id);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  const { phone: rawPhone, ...rest } = req.body;
  const phone = rawPhone ? normalizePhone(String(rawPhone)) : contact.phone;
  if (rawPhone && !phone) return res.status(400).json({ error: 'Invalid phone number' });

  const rules = db.prepare('SELECT date_column FROM scheduler_rules WHERE scheduler_id = ?').all(scheduler.id);
  const dateColumns = rules.map(r => r.date_column);

  const contactData = { ...JSON.parse(contact.contact_data), ...rest };
  if (rawPhone) contactData.phone = rawPhone;
  const dateCache = buildDateCache(contactData, dateColumns);

  db.prepare('UPDATE scheduler_contacts SET phone = ?, contact_data = ?, date_cache = ? WHERE id = ?')
    .run(phone, JSON.stringify(contactData), JSON.stringify(dateCache), contact.id);

  res.json({ message: 'Contact updated' });
});

// Delete contact
router.delete('/:id/contacts/:contactId', (req, res) => {
  const scheduler = db.prepare('SELECT * FROM schedulers WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!scheduler) return res.status(404).json({ error: 'Scheduler not found' });
  const contact = db.prepare('SELECT * FROM scheduler_contacts WHERE id = ? AND scheduler_id = ?').get(req.params.contactId, scheduler.id);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });
  db.prepare('DELETE FROM scheduler_contacts WHERE id = ?').run(contact.id);
  res.json({ message: 'Contact deleted' });
});

// ── Analytics & Logs ──

// Analytics dashboard
router.get('/:id/analytics', (req, res) => {
  const scheduler = db.prepare('SELECT * FROM schedulers WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!scheduler) return res.status(404).json({ error: 'Scheduler not found' });

  const currentYear = new Date().getFullYear();
  const totalSent = db.prepare("SELECT COUNT(*) as c FROM scheduler_logs WHERE scheduler_id = ? AND status = 'sent'").get(scheduler.id).c;
  const totalFailed = db.prepare("SELECT COUNT(*) as c FROM scheduler_logs WHERE scheduler_id = ? AND status = 'failed'").get(scheduler.id).c;
  const sentThisMonth = db.prepare(
    "SELECT COUNT(*) as c FROM scheduler_logs WHERE scheduler_id = ? AND status = 'sent' AND sent_at >= ?"
  ).get(scheduler.id, new Date(currentYear, new Date().getMonth(), 1).toISOString()).c;

  // Per-rule breakdown
  const ruleStats = db.prepare(`
    SELECT sr.id, sr.name, sr.date_column,
      (SELECT COUNT(*) FROM scheduler_logs WHERE rule_id = sr.id AND status = 'sent') as sent,
      (SELECT COUNT(*) FROM scheduler_logs WHERE rule_id = sr.id AND status = 'failed') as failed
    FROM scheduler_rules sr
    WHERE sr.scheduler_id = ?
  `).all(scheduler.id);

  // Monthly trend (last 12 months)
  const monthlyTrend = db.prepare(`
    SELECT strftime('%Y-%m', sent_at) as month, COUNT(*) as count
    FROM scheduler_logs
    WHERE scheduler_id = ? AND status = 'sent' AND sent_at >= ?
    GROUP BY strftime('%Y-%m', sent_at)
    ORDER BY month ASC
  `).all(scheduler.id, new Date(currentYear - 1, new Date().getMonth(), 1).toISOString());

  res.json({
    totalSent,
    totalFailed,
    sentThisMonth,
    successRate: totalSent + totalFailed > 0 ? Math.round((totalSent / (totalSent + totalFailed)) * 100) : 0,
    ruleStats,
    monthlyTrend,
  });
});

// Upcoming messages
router.get('/:id/analytics/upcoming', (req, res) => {
  const scheduler = db.prepare('SELECT * FROM schedulers WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!scheduler) return res.status(404).json({ error: 'Scheduler not found' });

  const days = parseInt(req.query.days) || 7;
  const rules = db.prepare('SELECT * FROM scheduler_rules WHERE scheduler_id = ?').all(scheduler.id);
  const contacts = db.prepare('SELECT * FROM scheduler_contacts WHERE scheduler_id = ?').all(scheduler.id);
  const currentYear = new Date().getFullYear();

  const upcoming = [];
  const now = new Date();

  for (let d = 0; d < days; d++) {
    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() + d);
    const checkMMDD = (checkDate.getMonth() + 1).toString().padStart(2, '0') + '-' + checkDate.getDate().toString().padStart(2, '0');
    const dateLabel = checkDate.toISOString().slice(0, 10);

    for (const rule of rules) {
      for (const contact of contacts) {
        let dateCache;
        try { dateCache = JSON.parse(contact.date_cache); } catch { continue; }
        if (dateCache[rule.date_column] === checkMMDD) {
          const alreadySent = db.prepare(
            'SELECT id FROM scheduler_logs WHERE rule_id = ? AND contact_id = ? AND year = ?'
          ).get(rule.id, contact.id, currentYear);
          if (alreadySent) continue;

          let contactData;
          try { contactData = JSON.parse(contact.contact_data); } catch { contactData = {}; }
          upcoming.push({
            date: dateLabel,
            rule_name: rule.name,
            contact_name: contactData.name || contactData.fullname || contactData.Name || '',
            phone: contact.phone,
          });
        }
      }
    }
  }

  upcoming.sort((a, b) => a.date.localeCompare(b.date));
  res.json({ upcoming, days });
});

// Export analytics as CSV
router.get('/:id/analytics/export', (req, res) => {
  const scheduler = db.prepare('SELECT * FROM schedulers WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!scheduler) return res.status(404).json({ error: 'Scheduler not found' });

  const logs = db.prepare(`
    SELECT sl.sent_at, sl.phone, sl.status, sl.error_message, sl.year,
      sr.name as rule_name, sr.date_column
    FROM scheduler_logs sl
    JOIN scheduler_rules sr ON sl.rule_id = sr.id
    WHERE sl.scheduler_id = ?
    ORDER BY sl.sent_at DESC
  `).all(scheduler.id);

  let csv = 'Date,Phone,Rule,Status,Error,Year\n';
  for (const log of logs) {
    csv += `"${log.sent_at}","${log.phone}","${log.rule_name}","${log.status}","${log.error_message || ''}","${log.year}"\n`;
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=scheduler-${scheduler.id}-export.csv`);
  res.send(csv);
});

// Logs with pagination
router.get('/:id/logs', (req, res) => {
  const scheduler = db.prepare('SELECT * FROM schedulers WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!scheduler) return res.status(404).json({ error: 'Scheduler not found' });

  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = (page - 1) * limit;
  const status = req.query.status || '';
  const rule_id = req.query.rule_id || '';

  let whereClause = 'sl.scheduler_id = ?';
  const params = [scheduler.id];
  if (status) { whereClause += ' AND sl.status = ?'; params.push(status); }
  if (rule_id) { whereClause += ' AND sl.rule_id = ?'; params.push(parseInt(rule_id)); }

  const logs = db.prepare(`
    SELECT sl.*, sr.name as rule_name,
      sc.contact_data
    FROM scheduler_logs sl
    JOIN scheduler_rules sr ON sl.rule_id = sr.id
    JOIN scheduler_contacts sc ON sl.contact_id = sc.id
    WHERE ${whereClause}
    ORDER BY sl.sent_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const total = db.prepare(`SELECT COUNT(*) as c FROM scheduler_logs sl WHERE ${whereClause}`).all(...params)[0].c;

  res.json({ logs, total, page, limit });
});

export default router;
