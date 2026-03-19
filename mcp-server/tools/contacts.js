import { z } from 'zod';
import { getDb } from '../db.js';
import { normalizePhone } from '../lib/phone-utils.js';

export function registerContactTools(server, getUserId) {
  server.tool('list_contacts', 'List contacts with optional search and group filter', {
    search: z.string().optional().describe('Search by name, phone, or email'),
    group_id: z.number().optional().describe('Filter by contact group ID'),
    page: z.number().optional().default(1),
    limit: z.number().optional().default(50),
  }, async (params) => {
    const db = getDb();
    const userId = getUserId();
    const { search, group_id, page, limit } = params;
    const offset = (page - 1) * limit;

    let fromClause = 'FROM contacts c';
    let whereClause = 'WHERE c.user_id = ?';
    const queryParams = [userId];

    if (group_id) {
      fromClause += ' JOIN contact_group_members cgm ON c.id = cgm.contact_id';
      whereClause += ' AND cgm.group_id = ?';
      queryParams.push(group_id);
    }
    if (search) {
      whereClause += ' AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)';
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const total = db.prepare(`SELECT COUNT(*) as total ${fromClause} ${whereClause}`).get(...queryParams).total;
    const contacts = db.prepare(`SELECT c.* ${fromClause} ${whereClause} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`).all(...queryParams, limit, offset);

    return { content: [{ type: 'text', text: JSON.stringify({ contacts, total, page, limit }, null, 2) }] };
  });

  server.tool('add_contact', 'Add a single contact', {
    phone: z.string().describe('Phone number'),
    name: z.string().optional().default(''),
    email: z.string().optional().default(''),
    notes: z.string().optional().default(''),
  }, async ({ phone, name, email, notes }) => {
    const db = getDb();
    const userId = getUserId();
    const normalized = normalizePhone(phone);
    if (!normalized) return { content: [{ type: 'text', text: 'Error: Invalid phone number' }], isError: true };

    try {
      const result = db.prepare('INSERT INTO contacts (user_id, phone, name, email, notes) VALUES (?, ?, ?, ?, ?)').run(userId, normalized, name, email, notes);
      return { content: [{ type: 'text', text: JSON.stringify({ id: Number(result.lastInsertRowid), phone: normalized, name, email }) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message.includes('UNIQUE') ? 'Contact already exists' : err.message}` }], isError: true };
    }
  });

  server.tool('update_contact', 'Update a contact by ID', {
    id: z.number().describe('Contact ID'),
    name: z.string().optional(),
    email: z.string().optional(),
    notes: z.string().optional(),
  }, async ({ id, name, email, notes }) => {
    const db = getDb();
    const userId = getUserId();
    const contact = db.prepare('SELECT * FROM contacts WHERE id = ? AND user_id = ?').get(id, userId);
    if (!contact) return { content: [{ type: 'text', text: 'Error: Contact not found' }], isError: true };

    db.prepare('UPDATE contacts SET name = ?, email = ?, notes = ? WHERE id = ?').run(
      name ?? contact.name, email ?? contact.email, notes ?? contact.notes, id
    );
    return { content: [{ type: 'text', text: JSON.stringify({ id, updated: true }) }] };
  });

  server.tool('delete_contact', 'Delete a contact by ID', {
    id: z.number().describe('Contact ID'),
  }, async ({ id }) => {
    const db = getDb();
    const result = db.prepare('DELETE FROM contacts WHERE id = ? AND user_id = ?').run(id, getUserId());
    if (result.changes === 0) return { content: [{ type: 'text', text: 'Error: Contact not found' }], isError: true };
    return { content: [{ type: 'text', text: JSON.stringify({ deleted: true }) }] };
  });

  server.tool('import_contacts', 'Bulk import contacts from an array', {
    contacts: z.array(z.object({
      phone: z.string(),
      name: z.string().optional().default(''),
      email: z.string().optional().default(''),
      notes: z.string().optional().default(''),
    })).describe('Array of contacts to import'),
  }, async ({ contacts }) => {
    const db = getDb();
    const userId = getUserId();
    const insert = db.prepare('INSERT OR IGNORE INTO contacts (user_id, phone, name, email, notes) VALUES (?, ?, ?, ?, ?)');
    let added = 0, skipped = 0;

    const txn = db.transaction(() => {
      for (const c of contacts) {
        const phone = normalizePhone(c.phone);
        if (!phone) { skipped++; continue; }
        const result = insert.run(userId, phone, c.name, c.email, c.notes);
        if (result.changes > 0) added++; else skipped++;
      }
    });
    txn();

    return { content: [{ type: 'text', text: JSON.stringify({ added, skipped }) }] };
  });

  server.tool('list_contact_groups', 'List all contact groups with member counts', {}, async () => {
    const db = getDb();
    const groups = db.prepare(
      'SELECT g.*, (SELECT COUNT(*) FROM contact_group_members WHERE group_id = g.id) as member_count FROM contact_groups g WHERE g.user_id = ?'
    ).all(getUserId());
    return { content: [{ type: 'text', text: JSON.stringify(groups, null, 2) }] };
  });

  server.tool('create_contact_group', 'Create a new contact group', {
    name: z.string().describe('Group name'),
    color: z.string().optional().default('#6366f1'),
  }, async ({ name, color }) => {
    const db = getDb();
    try {
      const result = db.prepare('INSERT INTO contact_groups (user_id, name, color) VALUES (?, ?, ?)').run(getUserId(), name, color);
      return { content: [{ type: 'text', text: JSON.stringify({ id: Number(result.lastInsertRowid), name, color }) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message.includes('UNIQUE') ? 'Group name already exists' : err.message}` }], isError: true };
    }
  });

  server.tool('delete_contact_group', 'Delete a contact group', {
    id: z.number().describe('Group ID'),
  }, async ({ id }) => {
    const db = getDb();
    const result = db.prepare('DELETE FROM contact_groups WHERE id = ? AND user_id = ?').run(id, getUserId());
    if (result.changes === 0) return { content: [{ type: 'text', text: 'Error: Group not found' }], isError: true };
    return { content: [{ type: 'text', text: JSON.stringify({ deleted: true }) }] };
  });
}
