import { useState, useEffect } from 'react';
import api from '../api/client.js';
import toast from '../utils/notify.js';
import { Plus, Trash2, Upload, X, Users, Smartphone } from 'lucide-react';

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState({ phone: '', name: '', email: '', notes: '' });
  const [importText, setImportText] = useState('');
  const [newGroup, setNewGroup] = useState('');

  const loadContacts = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (groupFilter) params.set('group_id', groupFilter);
    api.get(`/contacts?${params}`).then((res) => {
      setContacts(res.data.contacts);
      setTotal(res.data.total);
    });
  };

  const loadGroups = () => api.get('/contacts/groups').then((res) => setGroups(res.data.groups));

  useEffect(() => { loadContacts(); loadGroups(); }, []);
  useEffect(() => { loadContacts(); }, [search, groupFilter]);

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await api.post('/contacts', form);
      toast.success('Contact added');
      setForm({ phone: '', name: '', email: '', notes: '' });
      setShowAdd(false);
      loadContacts();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this contact?')) return;
    await api.delete(`/contacts/${id}`);
    toast.success('Deleted');
    loadContacts();
  };

  const handleImport = async () => {
    // Parse CSV-like text: each line is phone,name,email
    const lines = importText.trim().split('\n').filter(Boolean);
    const importList = lines.map((line) => {
      const [phone, name, email] = line.split(',').map((s) => s.trim());
      return { phone, name: name || '', email: email || '' };
    });

    try {
      const res = await api.post('/contacts/import', { contacts: importList });
      toast.success(`Added ${res.data.added}, skipped ${res.data.skipped}`);
      setImportText('');
      setShowImport(false);
      loadContacts();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Import failed');
    }
  };

  const handleAddGroup = async () => {
    if (!newGroup.trim()) return;
    try {
      await api.post('/contacts/groups', { name: newGroup });
      toast.success('Group created');
      setNewGroup('');
      loadGroups();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const handleDeleteGroup = async (id) => {
    if (!confirm('Delete this group?')) return;
    await api.delete(`/contacts/groups/${id}`);
    toast.success('Group deleted');
    loadGroups();
    if (groupFilter === String(id)) setGroupFilter('');
  };

  // ── Import from Phone Contacts (Contact Picker API + VCF fallback) ──
  const handlePhoneContacts = async () => {
    // Check if Contact Picker API is available (Android Chrome)
    if ('contacts' in navigator && 'ContactsManager' in window) {
      try {
        const props = ['name', 'tel', 'email'];
        const opts = { multiple: true };
        const picked = await navigator.contacts.select(props, opts);
        if (!picked || picked.length === 0) return;

        const importList = picked.map((c) => ({
          phone: c.tel?.[0] || '',
          name: c.name?.[0] || '',
          email: c.email?.[0] || '',
        })).filter((c) => c.phone);

        if (importList.length === 0) {
          toast.error('No phone numbers found in selected contacts');
          return;
        }

        const res = await api.post('/contacts/import', { contacts: importList });
        toast.success(`Added ${res.data.added}, skipped ${res.data.skipped} (from ${picked.length} contacts)`);
        loadContacts();
      } catch (err) {
        if (err.name !== 'TypeError') {
          toast.error('Contact access cancelled or failed');
        }
      }
    } else {
      // Fallback: VCF file upload for iOS / desktop
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.vcf,.vcard';
      input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        const importList = parseVCF(text);
        if (importList.length === 0) {
          toast.error('No contacts found in file. Export as .vcf from your phone contacts.');
          return;
        }
        try {
          const res = await api.post('/contacts/import', { contacts: importList });
          toast.success(`Added ${res.data.added}, skipped ${res.data.skipped} (from ${importList.length} contacts)`);
          loadContacts();
        } catch (err) {
          toast.error(err.response?.data?.error || 'Import failed');
        }
      };
      input.click();
    }
  };

  // Parse VCF/vCard file content into contacts array
  const parseVCF = (text) => {
    const contacts = [];
    const cards = text.split('BEGIN:VCARD').filter((s) => s.trim());
    for (const card of cards) {
      const lines = card.split('\n').map((l) => l.trim());
      let name = '';
      let phone = '';
      let email = '';
      for (const line of lines) {
        if (line.startsWith('FN:') || line.startsWith('FN;')) {
          name = line.split(':').slice(1).join(':').trim();
        } else if ((line.startsWith('TEL') || line.startsWith('tel')) && line.includes(':')) {
          phone = line.split(':').slice(1).join(':').replace(/[\s\-\(\)]/g, '').trim();
        } else if ((line.startsWith('EMAIL') || line.startsWith('email')) && line.includes(':')) {
          email = line.split(':').slice(1).join(':').trim();
        }
      }
      if (phone) contacts.push({ phone, name, email });
    }
    return contacts;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 md:mb-6">
        <h2 className="text-xl md:text-2xl font-bold">Contacts ({total})</h2>
        <div className="flex gap-2">
          <button
            onClick={handlePhoneContacts}
            className="flex items-center gap-1.5 px-3 md:px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm"
            title="Import from phone contacts"
          >
            <Smartphone size={16} />
            <span className="hidden sm:inline">Phone</span>
          </button>
          <button
            onClick={() => { setShowImport(!showImport); setShowAdd(false); }}
            className="flex items-center gap-1.5 px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
          >
            {showImport ? <X size={16} /> : <Upload size={16} />}
            <span className="hidden sm:inline">{showImport ? 'Cancel' : 'Import'}</span>
          </button>
          <button
            onClick={() => { setShowAdd(!showAdd); setShowImport(false); }}
            className="flex items-center gap-1.5 px-3 md:px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition text-sm"
          >
            {showAdd ? <X size={16} /> : <Plus size={16} />}
            <span className="hidden sm:inline">{showAdd ? 'Cancel' : 'Add'}</span>
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white rounded-xl shadow p-4 md:p-6 mb-4 md:mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          <input placeholder="Phone *" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:outline-none" />
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:outline-none" />
          <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:outline-none" />
          <input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:outline-none" />
          <button type="submit" className="sm:col-span-2 px-6 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition">Add</button>
        </form>
      )}

      {/* Import */}
      {showImport && (
        <div className="bg-white rounded-xl shadow p-6 mb-6 space-y-3">
          <p className="text-sm text-gray-500">Paste contacts, one per line: <code>phone, name, email</code></p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={6}
            placeholder={"919876543210, John Doe, john@email.com\n918877665544, Jane"}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:outline-none font-mono text-sm"
          />
          <button onClick={handleImport} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Import</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:outline-none"
        />
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:outline-none"
        >
          <option value="">All Groups</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name} ({g.member_count})</option>
          ))}
        </select>
      </div>

      {/* Groups management */}
      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Users size={16} className="text-gray-500" />
          <span className="font-semibold text-sm">Groups</span>
        </div>
        <div className="flex gap-2 flex-wrap mb-3">
          {groups.map((g) => (
            <span key={g.id} className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm">
              {g.name} ({g.member_count})
              <button onClick={() => handleDeleteGroup(g.id)} className="text-red-400 hover:text-red-600">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            placeholder="New group name"
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
            className="flex-1 px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:outline-none"
          />
          <button onClick={handleAddGroup} className="px-4 py-1.5 bg-[var(--color-primary)] text-white rounded-lg text-sm hover:bg-[var(--color-primary-dark)] transition">Add</button>
        </div>
      </div>

      {/* Contact list */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Phone</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 && (
              <tr><td colSpan={4} className="text-center py-8 text-gray-400">No contacts</td></tr>
            )}
            {contacts.map((c) => (
              <tr key={c.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 font-mono">{c.phone}</td>
                <td className="px-4 py-3">{c.name}</td>
                <td className="px-4 py-3 text-gray-500">{c.email}</td>
                <td className="px-4 py-3">
                  <button onClick={() => handleDelete(c.id)} className="p-1 hover:bg-red-50 rounded">
                    <Trash2 size={14} className="text-red-500" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
