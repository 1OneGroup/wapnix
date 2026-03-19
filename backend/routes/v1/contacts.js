import { Router } from 'express';
import db from '../../db/database.js';
import { normalizePhone } from '../../shared/phoneUtils.js';
import { paginate } from '../../middleware/responseWrapper.js';

const router = Router();

// GET /api/v1/contacts - List contacts (paginated, searchable)
router.get('/', (req, res) => {
  const { group_id, search } = req.query;
  const userId = req.user.id;

  let whereClause = 'WHERE c.user_id = ?';
  let fromClause = 'FROM contacts c';
  const params = [userId];

  if (group_id) {
    fromClause += ' JOIN contact_group_members cgm ON c.id = cgm.contact_id';
    whereClause += ' AND cgm.group_id = ?';
    params.push(parseInt(group_id));
  }

  if (search) {
    whereClause += ' AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const { rows, meta } = paginate(
    db,
    `SELECT COUNT(*) as total ${fromClause} ${whereClause}`,
    `SELECT c.* ${fromClause} ${whereClause} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
    params,
    req.query
  );

  res.ok(rows, meta);
});

// GET /api/v1/contacts/:id - Get single contact
router.get('/:id', (req, res) => {
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!contact) return res.fail(404, 'Contact not found');

  // Get groups
  const groups = db.prepare(
    'SELECT g.id, g.name, g.color FROM contact_groups g JOIN contact_group_members cgm ON g.id = cgm.group_id WHERE cgm.contact_id = ?'
  ).all(contact.id);

  res.ok({ ...contact, groups });
});

// POST /api/v1/contacts - Create single contact
router.post('/', (req, res) => {
  const { phone, name, email, notes, groups } = req.body;
  if (!phone) return res.fail(400, 'Phone is required');

  const count = db.prepare('SELECT COUNT(*) as cnt FROM contacts WHERE user_id = ?').get(req.user.id).cnt;
  if (count >= req.user.max_contacts) {
    return res.fail(403, `Contact limit (${req.user.max_contacts}) reached. Upgrade plan.`);
  }

  const normalized = normalizePhone(String(phone));
  if (!normalized) return res.fail(400, 'Invalid phone number');

  try {
    const result = db.prepare(
      'INSERT INTO contacts (user_id, phone, name, email, notes) VALUES (?, ?, ?, ?, ?)'
    ).run(req.user.id, normalized, name || '', email || '', notes || '');

    const contactId = Number(result.lastInsertRowid);

    if (Array.isArray(groups)) {
      const addToGroup = db.prepare('INSERT OR IGNORE INTO contact_group_members (contact_id, group_id) VALUES (?, ?)');
      for (const gId of groups) addToGroup.run(contactId, gId);
    }

    res.ok({ id: contactId, phone: normalized, name: name || '', email: email || '' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.fail(409, 'Contact with this phone already exists');
    res.fail(500, err.message);
  }
});

// PUT /api/v1/contacts/:id - Update contact
router.put('/:id', (req, res) => {
  const { name, email, notes } = req.body;
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!contact) return res.fail(404, 'Contact not found');

  db.prepare('UPDATE contacts SET name = ?, email = ?, notes = ? WHERE id = ?').run(
    name ?? contact.name, email ?? contact.email, notes ?? contact.notes, contact.id
  );
  res.ok({ id: contact.id, phone: contact.phone, name: name ?? contact.name });
});

// DELETE /api/v1/contacts/:id - Delete contact
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM contacts WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (result.changes === 0) return res.fail(404, 'Contact not found');
  res.ok({ deleted: true });
});

// POST /api/v1/contacts/import - Bulk import contacts
router.post('/import', (req, res) => {
  const { contacts: importList } = req.body;
  if (!Array.isArray(importList)) return res.fail(400, 'contacts array required');

  const currentCount = db.prepare('SELECT COUNT(*) as cnt FROM contacts WHERE user_id = ?').get(req.user.id).cnt;
  const remaining = req.user.max_contacts - currentCount;

  const insert = db.prepare('INSERT OR IGNORE INTO contacts (user_id, phone, name, email, notes) VALUES (?, ?, ?, ?, ?)');
  let added = 0, skipped = 0;

  const txn = db.transaction(() => {
    for (const c of importList) {
      if (added >= remaining) { skipped++; continue; }
      const phone = normalizePhone(String(c.phone || c.number || c.mobile || ''));
      if (!phone) { skipped++; continue; }
      const result = insert.run(req.user.id, phone, c.name || '', c.email || '', c.notes || '');
      if (result.changes > 0) added++; else skipped++;
    }
  });

  txn();
  res.ok({ added, skipped, total: currentCount + added });
});

// GET /api/v1/contacts/groups - List contact groups
router.get('/groups', (req, res) => {
  const groups = db.prepare(
    'SELECT g.*, (SELECT COUNT(*) FROM contact_group_members WHERE group_id = g.id) as member_count FROM contact_groups g WHERE g.user_id = ?'
  ).all(req.user.id);
  res.ok(groups);
});

// POST /api/v1/contacts/groups - Create group
router.post('/groups', (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.fail(400, 'Group name required');

  try {
    const result = db.prepare('INSERT INTO contact_groups (user_id, name, color) VALUES (?, ?, ?)').run(
      req.user.id, name, color || '#6366f1'
    );
    res.ok({ id: Number(result.lastInsertRowid), name, color: color || '#6366f1' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.fail(409, 'Group name already exists');
    res.fail(500, err.message);
  }
});

// DELETE /api/v1/contacts/groups/:id - Delete group
router.delete('/groups/:id', (req, res) => {
  const result = db.prepare('DELETE FROM contact_groups WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (result.changes === 0) return res.fail(404, 'Group not found');
  res.ok({ deleted: true });
});

export default router;
