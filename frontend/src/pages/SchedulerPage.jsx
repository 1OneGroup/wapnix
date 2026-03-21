import { useState, useEffect, useCallback } from 'react';
import { CalendarClock, Plus, ArrowLeft, Trash2, Play, Pause, Settings, List, Users, Eye, BarChart3, FileText, Upload, Search, Edit2, X, Download } from 'lucide-react';
import client from '../api/client.js';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'rules', label: 'Rules', icon: List },
  { id: 'contacts', label: 'Contacts', icon: Users },
  { id: 'upcoming', label: 'Upcoming', icon: Eye },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'logs', label: 'Logs', icon: FileText },
];

const COMMON_TIMEZONES = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo',
  'Europe/London', 'Europe/Berlin', 'Europe/Paris',
  'America/New_York', 'America/Chicago', 'America/Los_Angeles',
  'Australia/Sydney', 'Pacific/Auckland', 'UTC',
];

export default function SchedulerPage() {
  const [schedulers, setSchedulers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [scheduler, setScheduler] = useState(null);
  const [rules, setRules] = useState([]);
  const [csvColumns, setCsvColumns] = useState([]);
  const [stats, setStats] = useState({});
  const [activeTab, setActiveTab] = useState('settings');
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const [createForm, setCreateForm] = useState({ name: '', description: '', send_time: '00:00', timezone: 'Asia/Kolkata', catch_up_past_dates: false });
  const [settingsForm, setSettingsForm] = useState({});

  const loadSchedulers = useCallback(async () => {
    try {
      const { data } = await client.get('/schedulers');
      setSchedulers(data.schedulers);
    } catch (err) {
      toast.error('Failed to load schedulers');
    }
  }, []);

  const loadSchedulerDetail = useCallback(async (id) => {
    try {
      setLoading(true);
      const { data } = await client.get(`/schedulers/${id}`);
      setScheduler(data.scheduler);
      setRules(data.rules);
      setCsvColumns(data.csvColumns);
      setStats(data.stats);
      setSettingsForm({
        name: data.scheduler.name,
        description: data.scheduler.description,
        send_time: data.scheduler.send_time,
        timezone: data.scheduler.timezone,
        catch_up_past_dates: !!data.scheduler.catch_up_past_dates,
      });
    } catch (err) {
      toast.error('Failed to load scheduler');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSchedulers(); }, [loadSchedulers]);
  useEffect(() => { if (selectedId) loadSchedulerDetail(selectedId); }, [selectedId, loadSchedulerDetail]);

  const handleCreate = async () => {
    if (!createForm.name.trim()) return toast.error('Name is required');
    try {
      const { data } = await client.post('/schedulers', createForm);
      toast.success('Scheduler created');
      setShowCreate(false);
      setCreateForm({ name: '', description: '', send_time: '00:00', timezone: 'Asia/Kolkata', catch_up_past_dates: false });
      await loadSchedulers();
      setSelectedId(data.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create');
    }
  };

  const handleUpdateSettings = async () => {
    try {
      await client.put(`/schedulers/${selectedId}`, settingsForm);
      toast.success('Settings saved');
      loadSchedulerDetail(selectedId);
    } catch (err) {
      toast.error('Failed to save');
    }
  };

  const handleActivate = async () => {
    try {
      await client.post(`/schedulers/${selectedId}/activate`);
      toast.success('Scheduler activated');
      loadSchedulerDetail(selectedId);
      loadSchedulers();
    } catch (err) {
      toast.error('Failed to activate');
    }
  };

  const handlePause = async () => {
    try {
      await client.post(`/schedulers/${selectedId}/pause`);
      toast.success('Scheduler paused');
      loadSchedulerDetail(selectedId);
      loadSchedulers();
    } catch (err) {
      toast.error('Failed to pause');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this scheduler and all its data?')) return;
    try {
      await client.delete(`/schedulers/${selectedId}`);
      toast.success('Scheduler deleted');
      setSelectedId(null);
      setScheduler(null);
      loadSchedulers();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const statusColor = (status) => {
    if (status === 'active') return 'text-green-400 bg-green-400/10';
    if (status === 'paused') return 'text-yellow-400 bg-yellow-400/10';
    return 'text-gray-400 bg-gray-400/10';
  };

  // ── Detail View ──
  if (selectedId && scheduler) {
    return (
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => { setSelectedId(null); setScheduler(null); }} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{scheduler.name}</h1>
            {scheduler.description && <p className="text-sm text-[var(--text-secondary)]">{scheduler.description}</p>}
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor(scheduler.status)}`}>
            {scheduler.status}
          </span>
          {scheduler.status === 'draft' || scheduler.status === 'paused' ? (
            <button onClick={handleActivate} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors">
              <Play size={14} /> Activate
            </button>
          ) : (
            <button onClick={handlePause} className="flex items-center gap-1.5 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm transition-colors">
              <Pause size={14} /> Pause
            </button>
          )}
          <button onClick={handleDelete} className="p-2 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors">
            <Trash2 size={18} />
          </button>
        </div>

        <div className="flex gap-0 border-b border-[var(--border-primary)] mb-6 overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}>
              <tab.icon size={16} /> {tab.label}
              {tab.id === 'rules' && <span className="text-xs opacity-60">({rules.length})</span>}
            </button>
          ))}
        </div>

        {activeTab === 'settings' && (
          <div className="max-w-2xl space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input type="text" value={settingsForm.name || ''} onChange={e => setSettingsForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <input type="text" value={settingsForm.description || ''} onChange={e => setSettingsForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Send Time</label>
                <input type="time" value={settingsForm.send_time || '00:00'} onChange={e => setSettingsForm(f => ({ ...f, send_time: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Timezone</label>
                <select value={settingsForm.timezone || 'Asia/Kolkata'} onChange={e => setSettingsForm(f => ({ ...f, timezone: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]">
                  {COMMON_TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={settingsForm.catch_up_past_dates || false}
                  onChange={e => setSettingsForm(f => ({ ...f, catch_up_past_dates: e.target.checked }))}
                  className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-600 peer-focus:ring-2 peer-focus:ring-[var(--accent-primary)] rounded-full peer peer-checked:bg-green-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
              <span className="text-sm">Send catch-up messages for dates already passed this year</span>
            </div>
            <button onClick={handleUpdateSettings} className="px-6 py-2 bg-[var(--accent-primary)] hover:opacity-90 text-white rounded-lg text-sm transition-opacity">
              Save Settings
            </button>
          </div>
        )}

        {activeTab === 'rules' && <RulesTab schedulerId={selectedId} rules={rules} csvColumns={csvColumns} onRefresh={() => loadSchedulerDetail(selectedId)} />}
        {activeTab === 'contacts' && <ContactsTab schedulerId={selectedId} onRefresh={() => loadSchedulerDetail(selectedId)} />}
        {activeTab === 'upcoming' && <UpcomingTab schedulerId={selectedId} />}
        {activeTab === 'analytics' && <AnalyticsTab schedulerId={selectedId} />}
        {activeTab === 'logs' && <LogsTab schedulerId={selectedId} rules={rules} />}
      </div>
    );
  }

  // ── List View ──
  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><CalendarClock size={24} /> Scheduler</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Date-triggered recurring WhatsApp messages</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] hover:opacity-90 text-white rounded-lg text-sm transition-opacity">
          <Plus size={16} /> New Scheduler
        </button>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-primary)] rounded-xl p-6 w-full max-w-md border border-[var(--border-primary)]">
            <h2 className="text-lg font-bold mb-4">New Scheduler</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input type="text" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Employee Birthdays"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input type="text" value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Send Time</label>
                  <input type="time" value={createForm.send_time} onChange={e => setCreateForm(f => ({ ...f, send_time: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Timezone</label>
                  <select value={createForm.timezone} onChange={e => setCreateForm(f => ({ ...f, timezone: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]">
                    {COMMON_TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={createForm.catch_up_past_dates} onChange={e => setCreateForm(f => ({ ...f, catch_up_past_dates: e.target.checked }))} id="catchup" />
                <label htmlFor="catchup" className="text-sm">Send for dates already passed this year</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg bg-[var(--bg-secondary)] text-sm hover:opacity-80">Cancel</button>
              <button onClick={handleCreate} className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-sm hover:opacity-90">Create</button>
            </div>
          </div>
        </div>
      )}

      {schedulers.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-secondary)]">
          <CalendarClock size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium mb-2">No schedulers yet</p>
          <p className="text-sm">Create your first scheduler to send birthday wishes, anniversary greetings, and more.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {schedulers.map(s => (
            <button key={s.id} onClick={() => setSelectedId(s.id)}
              className={`text-left p-4 rounded-xl border transition-all hover:shadow-lg ${
                s.status === 'active' ? 'border-green-500/30' : s.status === 'paused' ? 'border-yellow-500/30' : 'border-[var(--border-primary)]'
              } bg-[var(--bg-secondary)] hover:bg-[var(--bg-secondary)]/80`}>
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-[var(--text-primary)]">{s.name}</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(s.status)}`}>{s.status}</span>
              </div>
              {s.description && <p className="text-xs text-[var(--text-secondary)] mb-3 line-clamp-2">{s.description}</p>}
              <div className="flex gap-4 text-xs text-[var(--text-secondary)]">
                <span>{s.rule_count} rule{s.rule_count !== 1 ? 's' : ''}</span>
                <span>{s.contact_count} contact{s.contact_count !== 1 ? 's' : ''}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Rules Tab ──
function RulesTab({ schedulerId, rules, csvColumns, onRefresh }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState({ name: '', date_column: '', template_id: '' });

  useEffect(() => {
    client.get('/templates').then(({ data }) => setTemplates(data.templates || [])).catch(() => {});
  }, []);

  const handleSave = async (isEdit = false) => {
    if (!form.name || !form.date_column || !form.template_id) return toast.error('All fields are required');
    try {
      if (isEdit) {
        await client.put(`/schedulers/${schedulerId}/rules/${editingId}`, form);
        toast.success('Rule updated');
      } else {
        await client.post(`/schedulers/${schedulerId}/rules`, form);
        toast.success('Rule added');
      }
      setShowAdd(false);
      setEditingId(null);
      setForm({ name: '', date_column: '', template_id: '' });
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const handleDelete = async (ruleId) => {
    if (!confirm('Delete this rule?')) return;
    try {
      await client.delete(`/schedulers/${schedulerId}/rules/${ruleId}`);
      toast.success('Rule deleted');
      onRefresh();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const startEdit = (rule) => {
    setEditingId(rule.id);
    setForm({ name: rule.name, date_column: rule.date_column, template_id: String(rule.template_id) });
    setShowAdd(true);
  };

  const ruleForm = (
    <div className="p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] space-y-3 mb-4">
      <div>
        <label className="block text-sm font-medium mb-1">Rule Name</label>
        <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Birthday Wish"
          className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Date Column (from CSV)</label>
        {csvColumns.length > 0 ? (
          <select value={form.date_column} onChange={e => setForm(f => ({ ...f, date_column: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]">
            <option value="">Select column...</option>
            {csvColumns.map(col => <option key={col} value={col}>{col}</option>)}
          </select>
        ) : (
          <input type="text" value={form.date_column} onChange={e => setForm(f => ({ ...f, date_column: e.target.value }))} placeholder="Column name, e.g. birthday"
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]" />
        )}
        {csvColumns.length === 0 && <p className="text-xs text-yellow-500 mt-1">Upload contacts first to auto-detect columns</p>}
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Template</label>
        <select value={form.template_id} onChange={e => setForm(f => ({ ...f, template_id: e.target.value }))}
          className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]">
          <option value="">Select template...</option>
          {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <button onClick={() => handleSave(!!editingId)} className="px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg text-sm hover:opacity-90">
          {editingId ? 'Update' : 'Add'} Rule
        </button>
        <button onClick={() => { setShowAdd(false); setEditingId(null); setForm({ name: '', date_column: '', template_id: '' }); }}
          className="px-4 py-2 bg-[var(--bg-primary)] rounded-lg text-sm hover:opacity-80">Cancel</button>
      </div>
    </div>
  );

  return (
    <div>
      {!showAdd && (
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] hover:opacity-90 text-white rounded-lg text-sm mb-4 transition-opacity">
          <Plus size={16} /> Add Rule
        </button>
      )}
      {showAdd && ruleForm}

      {rules.length === 0 && !showAdd ? (
        <p className="text-[var(--text-secondary)] text-sm">No rules yet. Add a rule to map a date column to a message template.</p>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => (
            <div key={rule.id} className="p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] flex items-center gap-4">
              <div className="flex-1">
                <h4 className="font-medium">{rule.name}</h4>
                <p className="text-sm text-[var(--text-secondary)]">
                  Column: <span className="text-[var(--accent-primary)]">{rule.date_column}</span> → Template: <span className="text-[var(--accent-primary)]">{rule.template_name || 'Unknown'}</span>
                  {rule.media_type && <span className="ml-2 text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full">{rule.media_type}</span>}
                </p>
              </div>
              <button onClick={() => startEdit(rule)} className="p-2 rounded-lg hover:bg-[var(--bg-primary)] transition-colors">
                <Edit2 size={16} />
              </button>
              <button onClick={() => handleDelete(rule.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Contacts Tab ──
function ContactsTab({ schedulerId, onRefresh }) {
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [csvText, setCsvText] = useState('');
  const [csvParsed, setCsvParsed] = useState(null);
  const [phoneColumn, setPhoneColumn] = useState('');
  const [dateColumns, setDateColumns] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [editContact, setEditContact] = useState(null);
  const [showAddManual, setShowAddManual] = useState(false);
  const [manualForm, setManualForm] = useState({});

  const loadContacts = useCallback(async () => {
    try {
      const { data } = await client.get(`/schedulers/${schedulerId}/contacts`, { params: { page, search, limit: 50 } });
      setContacts(data.contacts);
      setTotal(data.total);
    } catch (err) {
      toast.error('Failed to load contacts');
    }
  }, [schedulerId, page, search]);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  const parseCSV = (text) => {
    const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 2) return null;
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
      return obj;
    });
    return { headers, rows };
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      setCsvText(text);
      const parsed = parseCSV(text);
      setCsvParsed(parsed);
      if (parsed) {
        const phoneCol = parsed.headers.find(h => /phone|mobile|whatsapp|contact/i.test(h));
        if (phoneCol) setPhoneColumn(phoneCol);
      }
    };
    reader.readAsText(file);
  };

  const handlePaste = () => {
    const parsed = parseCSV(csvText);
    setCsvParsed(parsed);
    if (parsed) {
      const phoneCol = parsed.headers.find(h => /phone|mobile|whatsapp|contact/i.test(h));
      if (phoneCol) setPhoneColumn(phoneCol);
    }
  };

  const toggleDateColumn = (col) => {
    setDateColumns(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  };

  const handleUpload = async () => {
    if (!csvParsed || !phoneColumn) return toast.error('Select a phone column');
    setUploading(true);
    setUploadProgress({ total: csvParsed.rows.length, done: 0, imported: 0, updated: 0, skipped: 0 });

    const chunkSize = 100;
    let totalImported = 0, totalUpdated = 0, totalSkipped = 0;

    for (let i = 0; i < csvParsed.rows.length; i += chunkSize) {
      const chunk = csvParsed.rows.slice(i, i + chunkSize);
      try {
        const { data } = await client.post(`/schedulers/${schedulerId}/contacts/upload`, {
          contacts: chunk,
          phone_column: phoneColumn,
          date_columns: dateColumns,
        });
        totalImported += data.imported;
        totalUpdated += data.updated;
        totalSkipped += data.skipped;
        setUploadProgress({ total: csvParsed.rows.length, done: Math.min(i + chunkSize, csvParsed.rows.length), imported: totalImported, updated: totalUpdated, skipped: totalSkipped });
      } catch (err) {
        toast.error(`Upload chunk failed: ${err.response?.data?.error || err.message}`);
      }
    }

    toast.success(`Import complete: ${totalImported} new, ${totalUpdated} updated, ${totalSkipped} skipped`);
    setUploading(false);
    setCsvParsed(null);
    setCsvText('');
    setPhoneColumn('');
    setDateColumns([]);
    loadContacts();
    onRefresh();
  };

  const handleDeleteContact = async (contactId) => {
    try {
      await client.delete(`/schedulers/${schedulerId}/contacts/${contactId}`);
      toast.success('Contact deleted');
      loadContacts();
      onRefresh();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const handleAddManual = async () => {
    try {
      await client.post(`/schedulers/${schedulerId}/contacts`, manualForm);
      toast.success('Contact added');
      setShowAddManual(false);
      setManualForm({});
      loadContacts();
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add');
    }
  };

  const handleUpdateContact = async () => {
    try {
      const { id, ...rest } = editContact;
      await client.put(`/schedulers/${schedulerId}/contacts/${id}`, rest);
      toast.success('Contact updated');
      setEditContact(null);
      loadContacts();
    } catch (err) {
      toast.error('Failed to update');
    }
  };

  return (
    <div>
      {/* Upload Section */}
      <div className="mb-6 p-4 rounded-xl border border-dashed border-[var(--border-primary)] bg-[var(--bg-secondary)]">
        <h3 className="font-medium mb-3 flex items-center gap-2"><Upload size={16} /> Upload CSV</h3>
        <div className="flex gap-3 mb-3">
          <label className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg text-sm cursor-pointer hover:opacity-90">
            <Upload size={14} /> Choose File
            <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
          </label>
          <span className="text-sm text-[var(--text-secondary)] self-center">or paste CSV below</span>
        </div>
        <textarea value={csvText} onChange={e => setCsvText(e.target.value)} placeholder="phone,name,birthday,anniversary&#10;9876543210,John,15/04/1990,22/06/2015"
          rows={4} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] mb-2" />
        {csvText && !csvParsed && (
          <button onClick={handlePaste} className="px-4 py-1.5 bg-[var(--bg-primary)] rounded-lg text-sm hover:opacity-80 mb-3">Parse CSV</button>
        )}

        {csvParsed && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Phone Column *</label>
              <div className="flex gap-2 flex-wrap">
                {csvParsed.headers.map(h => (
                  <button key={h} onClick={() => setPhoneColumn(h)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${phoneColumn === h ? 'bg-[var(--accent-primary)] text-white' : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                    {h}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Date Columns (select all that contain dates)</label>
              <div className="flex gap-2 flex-wrap">
                {csvParsed.headers.filter(h => h !== phoneColumn).map(h => (
                  <button key={h} onClick={() => toggleDateColumn(h)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${dateColumns.includes(h) ? 'bg-green-600 text-white' : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                    {h}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Preview (first 5 rows)</label>
              <div className="overflow-x-auto rounded-lg border border-[var(--border-primary)]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[var(--bg-primary)]">
                      {csvParsed.headers.map(h => (
                        <th key={h} className={`px-3 py-2 text-left font-medium ${h === phoneColumn ? 'text-[var(--accent-primary)]' : dateColumns.includes(h) ? 'text-green-400' : 'text-[var(--text-secondary)]'}`}>
                          {h} {h === phoneColumn && '(phone)'} {dateColumns.includes(h) && '(date)'}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvParsed.rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-t border-[var(--border-primary)]">
                        {csvParsed.headers.map(h => (
                          <td key={h} className="px-3 py-2 text-[var(--text-secondary)]">{row[h]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <button onClick={handleUpload} disabled={uploading || !phoneColumn}
              className="px-6 py-2 bg-[var(--accent-primary)] text-white rounded-lg text-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
              {uploading ? 'Uploading...' : `Import ${csvParsed.rows.length} Contacts`}
            </button>
          </div>
        )}

        {uploadProgress && (
          <div className="mt-3">
            <div className="w-full bg-[var(--bg-primary)] rounded-full h-2 mb-2">
              <div className="bg-[var(--accent-primary)] h-2 rounded-full transition-all" style={{ width: `${(uploadProgress.done / uploadProgress.total) * 100}%` }}></div>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              {uploadProgress.done}/{uploadProgress.total} processed — {uploadProgress.imported} new, {uploadProgress.updated} updated, {uploadProgress.skipped} skipped
            </p>
          </div>
        )}
      </div>

      {/* Contact List */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search contacts..."
              className="pl-9 pr-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]" />
          </div>
          <span className="text-sm text-[var(--text-secondary)]">{total} contacts</span>
        </div>
        <button onClick={() => setShowAddManual(true)} className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-sm hover:opacity-80">
          <Plus size={14} /> Add Contact
        </button>
      </div>

      {showAddManual && (
        <div className="mb-4 p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Phone *</label>
              <input type="text" value={manualForm.phone || ''} onChange={e => setManualForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Name</label>
              <input type="text" value={manualForm.name || ''} onChange={e => setManualForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Birthday (DD/MM)</label>
              <input type="text" value={manualForm.birthday || ''} onChange={e => setManualForm(f => ({ ...f, birthday: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddManual} className="px-4 py-1.5 bg-[var(--accent-primary)] text-white rounded-lg text-sm">Add</button>
            <button onClick={() => { setShowAddManual(false); setManualForm({}); }} className="px-4 py-1.5 bg-[var(--bg-primary)] rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-[var(--border-primary)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--bg-secondary)]">
              <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Phone</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Name</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Data</th>
              <th className="px-4 py-3 text-right font-medium text-[var(--text-secondary)]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map(c => {
              let data = {};
              try { data = JSON.parse(c.contact_data); } catch {}
              return (
                <tr key={c.id} className="border-t border-[var(--border-primary)]">
                  <td className="px-4 py-3 font-mono text-xs">{c.phone}</td>
                  <td className="px-4 py-3">{data.name || data.fullname || data.Name || '—'}</td>
                  <td className="px-4 py-3 text-xs text-[var(--text-secondary)] max-w-xs truncate">
                    {Object.entries(data).filter(([k]) => !['phone', 'name', 'fullname', 'Name'].includes(k)).map(([k, v]) => `${k}: ${v}`).join(', ')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setEditContact({ id: c.id, ...data })} className="p-1.5 rounded hover:bg-[var(--bg-primary)]"><Edit2 size={14} /></button>
                    <button onClick={() => handleDeleteContact(c.id)} className="p-1.5 rounded hover:bg-red-500/10 text-red-400 ml-1"><Trash2 size={14} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {total > 50 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] text-sm disabled:opacity-50">Previous</button>
          <span className="px-3 py-1.5 text-sm text-[var(--text-secondary)]">Page {page} of {Math.ceil(total / 50)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 50)}
            className="px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] text-sm disabled:opacity-50">Next</button>
        </div>
      )}

      {editContact && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-primary)] rounded-xl p-6 w-full max-w-md border border-[var(--border-primary)]">
            <h3 className="font-bold mb-4">Edit Contact</h3>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {Object.entries(editContact).filter(([k]) => k !== 'id').map(([key, val]) => (
                <div key={key}>
                  <label className="block text-xs font-medium mb-1">{key}</label>
                  <input type="text" value={val || ''} onChange={e => setEditContact(c => ({ ...c, [key]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-sm focus:outline-none" />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEditContact(null)} className="px-4 py-2 rounded-lg bg-[var(--bg-secondary)] text-sm">Cancel</button>
              <button onClick={handleUpdateContact} className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-sm">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Upcoming Tab ──
function UpcomingTab({ schedulerId }) {
  const [upcoming, setUpcoming] = useState([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    client.get(`/schedulers/${schedulerId}/analytics/upcoming`, { params: { days } })
      .then(({ data }) => setUpcoming(data.upcoming))
      .catch(() => toast.error('Failed to load upcoming'))
      .finally(() => setLoading(false));
  }, [schedulerId, days]);

  const grouped = upcoming.reduce((acc, item) => {
    if (!acc[item.date]) acc[item.date] = [];
    acc[item.date].push(item);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setDays(7)} className={`px-3 py-1.5 rounded-lg text-sm ${days === 7 ? 'bg-[var(--accent-primary)] text-white' : 'bg-[var(--bg-secondary)]'}`}>Next 7 days</button>
        <button onClick={() => setDays(30)} className={`px-3 py-1.5 rounded-lg text-sm ${days === 30 ? 'bg-[var(--accent-primary)] text-white' : 'bg-[var(--bg-secondary)]'}`}>Next 30 days</button>
      </div>

      {loading ? <p className="text-[var(--text-secondary)] text-sm">Loading...</p> : upcoming.length === 0 ? (
        <p className="text-[var(--text-secondary)] text-sm">No upcoming messages in the next {days} days.</p>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <h4 className="text-sm font-medium mb-2 text-[var(--text-secondary)]">{new Date(date + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</h4>
              <div className="space-y-1">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-[var(--bg-secondary)] text-sm">
                    <span className="text-[var(--accent-primary)] font-medium min-w-[120px]">{item.rule_name}</span>
                    <span className="flex-1">{item.contact_name || '—'}</span>
                    <span className="font-mono text-xs text-[var(--text-secondary)]">{item.phone}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Analytics Tab ──
function AnalyticsTab({ schedulerId }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get(`/schedulers/${schedulerId}/analytics`)
      .then(({ data }) => setAnalytics(data))
      .catch(() => toast.error('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [schedulerId]);

  const handleExport = async () => {
    try {
      const { data } = await client.get(`/schedulers/${schedulerId}/analytics/export`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `scheduler-${schedulerId}-export.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Export failed'); }
  };

  if (loading) return <p className="text-[var(--text-secondary)] text-sm">Loading...</p>;
  if (!analytics) return null;

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Sent', value: analytics.totalSent, color: 'text-green-400' },
          { label: 'This Month', value: analytics.sentThisMonth, color: 'text-blue-400' },
          { label: 'Failed', value: analytics.totalFailed, color: 'text-red-400' },
          { label: 'Success Rate', value: `${analytics.successRate}%`, color: 'text-[var(--accent-primary)]' },
        ].map(card => (
          <div key={card.label} className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-center">
            <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="mb-6">
        <h3 className="font-medium mb-3">Per-Rule Breakdown</h3>
        <div className="overflow-x-auto rounded-lg border border-[var(--border-primary)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--bg-secondary)]">
                <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Rule</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Column</th>
                <th className="px-4 py-3 text-right font-medium text-green-400">Sent</th>
                <th className="px-4 py-3 text-right font-medium text-red-400">Failed</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--text-secondary)]">Rate</th>
              </tr>
            </thead>
            <tbody>
              {analytics.ruleStats.map(rule => (
                <tr key={rule.id} className="border-t border-[var(--border-primary)]">
                  <td className="px-4 py-3 font-medium">{rule.name}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{rule.date_column}</td>
                  <td className="px-4 py-3 text-right text-green-400">{rule.sent}</td>
                  <td className="px-4 py-3 text-right text-red-400">{rule.failed}</td>
                  <td className="px-4 py-3 text-right">{rule.sent + rule.failed > 0 ? Math.round((rule.sent / (rule.sent + rule.failed)) * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {analytics.monthlyTrend.length > 0 && (
        <div className="mb-6">
          <h3 className="font-medium mb-3">Monthly Trend</h3>
          <div className="flex items-end gap-2 h-32">
            {analytics.monthlyTrend.map(m => {
              const maxCount = Math.max(...analytics.monthlyTrend.map(x => x.count), 1);
              const height = Math.max((m.count / maxCount) * 100, 4);
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-[var(--text-secondary)]">{m.count}</span>
                  <div className="w-full bg-[var(--accent-primary)] rounded-t" style={{ height: `${height}%` }}></div>
                  <span className="text-xs text-[var(--text-secondary)]">{m.month.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-sm hover:opacity-80">
        <Download size={14} /> Export CSV
      </button>
    </div>
  );
}

// ── Logs Tab ──
function LogsTab({ schedulerId, rules }) {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRule, setFilterRule] = useState('');

  useEffect(() => {
    client.get(`/schedulers/${schedulerId}/logs`, { params: { page, limit: 50, status: filterStatus, rule_id: filterRule } })
      .then(({ data }) => { setLogs(data.logs); setTotal(data.total); })
      .catch(() => toast.error('Failed to load logs'));
  }, [schedulerId, page, filterStatus, filterRule]);

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-sm focus:outline-none">
          <option value="">All statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </select>
        <select value={filterRule} onChange={e => { setFilterRule(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-sm focus:outline-none">
          <option value="">All rules</option>
          {rules.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <span className="text-sm text-[var(--text-secondary)] self-center">{total} entries</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--border-primary)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--bg-secondary)]">
              <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Date</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Contact</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Phone</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Rule</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Status</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Error</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => {
              let contactName = '';
              try { const d = JSON.parse(log.contact_data); contactName = d.name || d.fullname || d.Name || ''; } catch {}
              return (
                <tr key={log.id} className="border-t border-[var(--border-primary)]">
                  <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{log.sent_at ? new Date(log.sent_at).toLocaleString('en-IN') : '—'}</td>
                  <td className="px-4 py-3">{contactName || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{log.phone}</td>
                  <td className="px-4 py-3">{log.rule_name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${log.status === 'sent' ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-red-400 max-w-xs truncate">{log.error_message || ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {total > 50 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] text-sm disabled:opacity-50">Previous</button>
          <span className="px-3 py-1.5 text-sm text-[var(--text-secondary)]">Page {page} of {Math.ceil(total / 50)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 50)}
            className="px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] text-sm disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}
