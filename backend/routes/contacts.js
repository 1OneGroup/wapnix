import { Router } from 'express';
import db from '../db/database.js';
import { normalizePhone } from '../shared/phoneUtils.js';

const router = Router();

// List contacts
router.get('/', (req, res) => {
  const { group_id, search, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  let query = 'SELECT c.* FROM contacts c';
  const params = [req.user.id];

  if (group_id) {
    query += ' JOIN contact_group_members cgm ON c.id = cgm.contact_id WHERE c.user_id = ? AND cgm.group_id = ?';
    params.push(group_id);
  } else {
    query += ' WHERE c.user_id = ?';
  }

  if (search) {
    query += ' AND (c.name LIKE ? OR c.phone LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  const total = db.prepare(query.replace('SELECT c.*', 'SELECT COUNT(*) as cnt')).get(...params).cnt;
  const contacts = db.prepare(query + ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?').all(...params, parseInt(limit), parseInt(offset));

  res.json({ contacts, total, page: parseInt(page), limit: parseInt(limit) });
});

// Add single contact
router.post('/', (req, res) => {
  const { phone, name, email, notes, groups } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone is required' });

  const count = db.prepare('SELECT COUNT(*) as cnt FROM contacts WHERE user_id = ?').get(req.user.id).cnt;
  if (count >= req.user.max_contacts) {
    return res.status(403).json({ error: `Contact limit (${req.user.max_contacts}) reached. Upgrade plan.` });
  }

  const normalized = normalizePhone(phone);
  if (!normalized) return res.status(400).json({ error: 'Invalid phone number' });

  try {
    const result = db.prepare(
      'INSERT INTO contacts (user_id, phone, name, email, notes) VALUES (?, ?, ?, ?, ?)'
    ).run(req.user.id, normalized, name || '', email || '', notes || '');

    const contactId = result.lastInsertRowid;

    if (Array.isArray(groups)) {
      const addToGroup = db.prepare('INSERT OR IGNORE INTO contact_group_members (contact_id, group_id) VALUES (?, ?)');
      for (const gId of groups) addToGroup.run(contactId, gId);
    }

    res.status(201).json({ id: contactId, phone: normalized, name, email });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Contact already exists' });
    res.status(500).json({ error: err.message });
  }
});

// Bulk import
router.post('/import', (req, res) => {
  const { contacts: importList } = req.body;
  if (!Array.isArray(importList)) return res.status(400).json({ error: 'contacts array required' });

  const currentCount = db.prepare('SELECT COUNT(*) as cnt FROM contacts WHERE user_id = ?').get(req.user.id).cnt;
  const remaining = req.user.max_contacts - currentCount;

  const insert = db.prepare(
    'INSERT OR IGNORE INTO contacts (user_id, phone, name, email, notes) VALUES (?, ?, ?, ?, ?)'
  );

  let added = 0;
  let skipped = 0;

  const txn = db.transaction(() => {
    for (const c of importList) {
      if (added >= remaining) { skipped++; continue; }
      const phone = normalizePhone(c.phone || c.number || c.mobile || '');
      if (!phone) { skipped++; continue; }
      const result = insert.run(req.user.id, phone, c.name || '', c.email || '', c.notes || '');
      if (result.changes > 0) added++; else skipped++;
    }
  });

  txn();
  res.json({ added, skipped, total: currentCount + added });
});

// Update contact
router.put('/:id', (req, res) => {
  const { name, email, notes } = req.body;
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  db.prepare('UPDATE contacts SET name = ?, email = ?, notes = ? WHERE id = ?').run(
    name ?? contact.name, email ?? contact.email, notes ?? contact.notes, contact.id
  );
  res.json({ success: true });
});

// Delete contact
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM contacts WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Contact not found' });
  res.json({ success: true });
});

// ── Groups ──

router.get('/groups', (req, res) => {
  const groups = db.prepare(
    'SELECT g.*, (SELECT COUNT(*) FROM contact_group_members WHERE group_id = g.id) as member_count FROM contact_groups g WHERE g.user_id = ?'
  ).all(req.user.id);
  res.json({ groups });
});

router.post('/groups', (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Group name required' });

  try {
    const result = db.prepare('INSERT INTO contact_groups (user_id, name, color) VALUES (?, ?, ?)').run(
      req.user.id, name, color || '#6366f1'
    );
    res.status(201).json({ id: result.lastInsertRowid, name, color: color || '#6366f1' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Group name already exists' });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/groups/:id', (req, res) => {
  const result = db.prepare('DELETE FROM contact_groups WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Group not found' });
  res.json({ success: true });
});

export default router;
