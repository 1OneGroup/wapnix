import { useState, useEffect, useCallback } from 'react';
import { CalendarClock, Plus, ArrowLeft, Trash2, Play, Pause, Settings, List, Users, Eye, BarChart3, FileText, Upload, Search, Edit2, X, Download, Hash, Clock } from 'lucide-react';
import api from '../api/client.js';
import toast from '../utils/notify.js';

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

const statusColors = {
  draft: 'bg-gray-100 text-gray-600',
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
};

export default function SchedulerPage() {
  const [schedulers, setSchedulers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [scheduler, setScheduler] = useState(null);
  const [rules, setRules] = useState([]);
  const [csvColumns, setCsvColumns] = useState([]);
  const [stats, setStats] = useState({});
  const [activeTab, setActiveTab] = useState('settings');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const [createForm, setCreateForm] = useState({ name: '', description: '', send_time: '00:00', timezone: 'Asia/Kolkata', catch_up_past_dates: false });
  const [settingsForm, setSettingsForm] = useState({});

  const loadSchedulers = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/schedulers');
      setSchedulers(data.schedulers);
    } catch (err) {
      toast.error('Failed to load schedulers');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSchedulerDetail = useCallback(async (id) => {
    try {
      const { data } = await api.get(`/schedulers/${id}`);
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
    }
  }, []);

  useEffect(() => { loadSchedulers(); }, [loadSchedulers]);
  useEffect(() => { if (selectedId) loadSchedulerDetail(selectedId); }, [selectedId, loadSchedulerDetail]);

  const handleCreate = async () => {
    if (!createForm.name.trim()) return toast.error('Name is required');
    try {
      const { data } = await api.post('/schedulers', createForm);
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
      await api.put(`/schedulers/${selectedId}`, settingsForm);
      toast.success('Settings saved');
      loadSchedulerDetail(selectedId);
    } catch (err) {
      toast.error('Failed to save');
    }
  };

  const handleActivate = async () => {
    try {
      await api.post(`/schedulers/${selectedId}/activate`);
      toast.success('Scheduler activated');
      loadSchedulerDetail(selectedId);
      loadSchedulers();
    } catch { toast.error('Failed to activate'); }
  };

  const handlePause = async () => {
    try {
      await api.post(`/schedulers/${selectedId}/pause`);
      toast.success('Scheduler paused');
      loadSchedulerDetail(selectedId);
      loadSchedulers();
    } catch { toast.error('Failed to pause'); }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this scheduler and all its data?')) return;
    try {
      await api.delete(`/schedulers/${selectedId}`);
      toast.success('Scheduler deleted');
      setSelectedId(null);
      setScheduler(null);
      loadSchedulers();
    } catch { toast.error('Failed to delete'); }
  };

  // ── Detail View ──
  if (selectedId && scheduler) {
    return (
      <div>
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => { setSelectedId(null); setScheduler(null); setActiveTab('settings'); }} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-800">{scheduler.name}</h2>
            {scheduler.description && <p className="text-xs text-gray-500">{scheduler.description}</p>}
          </div>
          <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${statusColors[scheduler.status] || statusColors.draft}`}>
            {scheduler.status}
          </span>
          {scheduler.status === 'draft' || scheduler.status === 'paused' ? (
            <button onClick={handleActivate} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition">
              <Play size={14} /> Activate
            </button>
          ) : (
            <button onClick={handlePause} className="flex items-center gap-1.5 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm transition">
              <Pause size={14} /> Pause
            </button>
          )}
          <button onClick={handleDelete} className="p-2 rounded-lg hover:bg-red-50 text-red-400 transition">
            <Trash2 size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-gray-100 rounded-xl p-1 flex gap-1 mb-5 overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 md:px-5 py-2 md:py-2.5 rounded-lg text-xs md:text-sm font-medium transition whitespace-nowrap ${
                activeTab === tab.id ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              <tab.icon size={14} /> {tab.label}
              {tab.id === 'rules' && <span className="text-[10px] opacity-60">({rules.length})</span>}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-xl shadow p-5">
          {activeTab === 'settings' && (
            <div className="max-w-xl space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input type="text" value={settingsForm.name || ''} onChange={e => setSettingsForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input type="text" value={settingsForm.description || ''} onChange={e => setSettingsForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Send Time</label>
                  <input type="time" value={settingsForm.send_time || '00:00'} onChange={e => setSettingsForm(f => ({ ...f, send_time: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                  <select value={settingsForm.timezone || 'Asia/Kolkata'} onChange={e => setSettingsForm(f => ({ ...f, timezone: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400">
                    {COMMON_TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={settingsForm.catch_up_past_dates || false}
                  onChange={e => setSettingsForm(f => ({ ...f, catch_up_past_dates: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                <span className="text-sm text-gray-700">Send catch-up messages for dates already passed this year</span>
              </label>
              <button onClick={handleUpdateSettings} className="px-5 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white rounded-lg text-sm transition">
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
      </div>
    );
  }

  // ── List View ──
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Your Schedulers</h3>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition">
          <Plus size={16} /> New Scheduler
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">New Scheduler</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input type="text" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Employee Birthdays"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input type="text" value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Send Time</label>
                  <input type="time" value={createForm.send_time} onChange={e => setCreateForm(f => ({ ...f, send_time: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                  <select value={createForm.timezone} onChange={e => setCreateForm(f => ({ ...f, timezone: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    {COMMON_TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={createForm.catch_up_past_dates} onChange={e => setCreateForm(f => ({ ...f, catch_up_past_dates: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600" />
                <span className="text-sm text-gray-600">Send for dates already passed this year</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition">Cancel</button>
              <button onClick={handleCreate} className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm hover:bg-[var(--color-primary-dark)] transition">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Cards */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading schedulers...</div>
      ) : schedulers.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center">
          <CalendarClock size={48} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No schedulers yet</h3>
          <p className="text-sm text-gray-500 mb-4">Create your first scheduler to send birthday wishes, anniversary greetings, and more.</p>
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 text-sm bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition">
            Create Scheduler
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {schedulers.map(s => (
            <button key={s.id} onClick={() => setSelectedId(s.id)} className="bg-white rounded-xl shadow hover:shadow-md transition p-5 text-left group">
              <div className="flex items-start justify-between mb-3">
                <h4 className="font-semibold text-gray-800 group-hover:text-[var(--color-primary-dark)] transition truncate flex-1">{s.name}</h4>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusColors[s.status] || statusColors.draft}`}>{s.status}</span>
              </div>
              {s.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{s.description}</p>}
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1"><Hash size={12} /> {s.rule_count} rules</span>
                <span className="flex items-center gap-1"><Users size={12} /> {s.contact_count} contacts</span>
                <span className="flex items-center gap-1"><Clock size={12} /> {s.send_time}</span>
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
    api.get('/templates').then(({ data }) => setTemplates(data.templates || [])).catch(() => {});
  }, []);

  const handleSave = async (isEdit = false) => {
    if (!form.name || !form.date_column || !form.template_id) return toast.error('All fields are required');
    try {
      if (isEdit) {
        await api.put(`/schedulers/${schedulerId}/rules/${editingId}`, form);
        toast.success('Rule updated');
      } else {
        await api.post(`/schedulers/${schedulerId}/rules`, form);
        toast.success('Rule added');
      }
      setShowAdd(false); setEditingId(null); setForm({ name: '', date_column: '', template_id: '' });
      onRefresh();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const handleDelete = async (ruleId) => {
    if (!confirm('Delete this rule?')) return;
    try { await api.delete(`/schedulers/${schedulerId}/rules/${ruleId}`); toast.success('Rule deleted'); onRefresh(); }
    catch { toast.error('Failed to delete'); }
  };

  const startEdit = (rule) => {
    setEditingId(rule.id);
    setForm({ name: rule.name, date_column: rule.date_column, template_id: String(rule.template_id) });
    setShowAdd(true);
  };

  return (
    <div>
      {!showAdd && (
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition mb-4">
          <Plus size={16} /> Add Rule
        </button>
      )}
      {showAdd && (
        <div className="bg-gray-50 rounded-xl p-4 space-y-3 mb-4 border border-gray-200">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Birthday Wish"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Column (from CSV)</label>
            {csvColumns.length > 0 ? (
              <select value={form.date_column} onChange={e => setForm(f => ({ ...f, date_column: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="">Select column...</option>
                {csvColumns.map(col => <option key={col} value={col}>{col}</option>)}
              </select>
            ) : (
              <input type="text" value={form.date_column} onChange={e => setForm(f => ({ ...f, date_column: e.target.value }))} placeholder="e.g. birthday"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            )}
            {csvColumns.length === 0 && <p className="text-xs text-yellow-600 mt-1">Upload contacts first to auto-detect columns</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
            <select value={form.template_id} onChange={e => setForm(f => ({ ...f, template_id: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
              <option value="">Select template...</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleSave(!!editingId)} className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm hover:bg-[var(--color-primary-dark)] transition">
              {editingId ? 'Update' : 'Add'} Rule
            </button>
            <button onClick={() => { setShowAdd(false); setEditingId(null); setForm({ name: '', date_column: '', template_id: '' }); }}
              className="px-4 py-2 text-gray-600 rounded-lg text-sm hover:bg-gray-100 transition">Cancel</button>
          </div>
        </div>
      )}

      {rules.length === 0 && !showAdd ? (
        <p className="text-gray-400 text-sm">No rules yet. Add a rule to map a date column to a message template.</p>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => (
            <div key={rule.id} className="bg-gray-50 rounded-xl p-4 flex items-center gap-4 border border-gray-200">
              <div className="flex-1">
                <h4 className="font-medium text-gray-800">{rule.name}</h4>
                <p className="text-sm text-gray-500">
                  Column: <span className="text-indigo-600 font-medium">{rule.date_column}</span> → Template: <span className="text-indigo-600 font-medium">{rule.template_name || 'Unknown'}</span>
                  {rule.media_type && <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">{rule.media_type}</span>}
                </p>
              </div>
              <button onClick={() => startEdit(rule)} className="p-2 rounded-lg hover:bg-gray-200 text-gray-500 transition"><Edit2 size={16} /></button>
              <button onClick={() => handleDelete(rule.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-400 transition"><Trash2 size={16} /></button>
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
      const { data } = await api.get(`/schedulers/${schedulerId}/contacts`, { params: { page, search, limit: 50 } });
      setContacts(data.contacts); setTotal(data.total);
    } catch { toast.error('Failed to load contacts'); }
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
      if (parsed) { const pc = parsed.headers.find(h => /phone|mobile|whatsapp|contact/i.test(h)); if (pc) setPhoneColumn(pc); }
    };
    reader.readAsText(file);
  };

  const handlePaste = () => {
    const parsed = parseCSV(csvText);
    setCsvParsed(parsed);
    if (parsed) { const pc = parsed.headers.find(h => /phone|mobile|whatsapp|contact/i.test(h)); if (pc) setPhoneColumn(pc); }
  };

  const toggleDateColumn = (col) => setDateColumns(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);

  const handleUpload = async () => {
    if (!csvParsed || !phoneColumn) return toast.error('Select a phone column');
    setUploading(true);
    setUploadProgress({ total: csvParsed.rows.length, done: 0, imported: 0, updated: 0, skipped: 0 });
    const chunkSize = 100;
    let totalImported = 0, totalUpdated = 0, totalSkipped = 0;
    for (let i = 0; i < csvParsed.rows.length; i += chunkSize) {
      const chunk = csvParsed.rows.slice(i, i + chunkSize);
      try {
        const { data } = await api.post(`/schedulers/${schedulerId}/contacts/upload`, { contacts: chunk, phone_column: phoneColumn, date_columns: dateColumns });
        totalImported += data.imported; totalUpdated += data.updated; totalSkipped += data.skipped;
        setUploadProgress({ total: csvParsed.rows.length, done: Math.min(i + chunkSize, csvParsed.rows.length), imported: totalImported, updated: totalUpdated, skipped: totalSkipped });
      } catch (err) { toast.error(`Upload failed: ${err.response?.data?.error || err.message}`); }
    }
    toast.success(`Import: ${totalImported} new, ${totalUpdated} updated, ${totalSkipped} skipped`);
    setUploading(false); setCsvParsed(null); setCsvText(''); setPhoneColumn(''); setDateColumns([]);
    loadContacts(); onRefresh();
  };

  const handleDeleteContact = async (id) => {
    try { await api.delete(`/schedulers/${schedulerId}/contacts/${id}`); toast.success('Deleted'); loadContacts(); onRefresh(); }
    catch { toast.error('Failed'); }
  };

  const handleAddManual = async () => {
    try { await api.post(`/schedulers/${schedulerId}/contacts`, manualForm); toast.success('Added'); setShowAddManual(false); setManualForm({}); loadContacts(); onRefresh(); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const handleUpdateContact = async () => {
    try { const { id, ...rest } = editContact; await api.put(`/schedulers/${schedulerId}/contacts/${id}`, rest); toast.success('Updated'); setEditContact(null); loadContacts(); }
    catch { toast.error('Failed'); }
  };

  return (
    <div>
      {/* Upload */}
      <div className="mb-5 bg-gray-50 rounded-xl p-4 border-2 border-dashed border-gray-300">
        <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2"><Upload size={16} /> Upload CSV</h4>
        <div className="flex gap-3 mb-3">
          <label className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm cursor-pointer hover:bg-[var(--color-primary-dark)] transition">
            <Upload size={14} /> Choose File
            <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
          </label>
          <span className="text-sm text-gray-400 self-center">or paste CSV below</span>
        </div>
        <textarea value={csvText} onChange={e => setCsvText(e.target.value)} placeholder="phone,name,birthday,anniversary&#10;9876543210,John,15/04/1990,22/06/2015"
          rows={3} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300 mb-2" />
        {csvText && !csvParsed && <button onClick={handlePaste} className="px-4 py-1.5 bg-gray-200 rounded-lg text-sm hover:bg-gray-300 transition mb-3">Parse CSV</button>}

        {csvParsed && (
          <div className="mt-3 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone Column *</label>
              <div className="flex gap-2 flex-wrap">
                {csvParsed.headers.map(h => (
                  <button key={h} onClick={() => setPhoneColumn(h)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${phoneColumn === h ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:border-indigo-400'}`}>
                    {h}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Columns (select all that contain dates)</label>
              <div className="flex gap-2 flex-wrap">
                {csvParsed.headers.filter(h => h !== phoneColumn).map(h => (
                  <button key={h} onClick={() => toggleDateColumn(h)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${dateColumns.includes(h) ? 'bg-green-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:border-green-400'}`}>
                    {h}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Preview (first 5 rows)</label>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-100">
                    {csvParsed.headers.map(h => (
                      <th key={h} className={`px-3 py-2 text-left font-medium ${h === phoneColumn ? 'text-indigo-600' : dateColumns.includes(h) ? 'text-green-600' : 'text-gray-500'}`}>
                        {h} {h === phoneColumn && '(phone)'} {dateColumns.includes(h) && '(date)'}
                      </th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {csvParsed.rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        {csvParsed.headers.map(h => <td key={h} className="px-3 py-2 text-gray-600">{row[h]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <button onClick={handleUpload} disabled={uploading || !phoneColumn}
              className="px-5 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm hover:bg-[var(--color-primary-dark)] disabled:opacity-50 transition">
              {uploading ? 'Uploading...' : `Import ${csvParsed.rows.length} Contacts`}
            </button>
          </div>
        )}
        {uploadProgress && (
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
              <div className="bg-indigo-600 h-2 rounded-full transition-all" style={{ width: `${(uploadProgress.done / uploadProgress.total) * 100}%` }}></div>
            </div>
            <p className="text-xs text-gray-500">{uploadProgress.done}/{uploadProgress.total} — {uploadProgress.imported} new, {uploadProgress.updated} updated, {uploadProgress.skipped} skipped</p>
          </div>
        )}
      </div>

      {/* Contact List */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search..."
              className="pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <span className="text-xs text-gray-400">{total} contacts</span>
        </div>
        <button onClick={() => setShowAddManual(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition">
          <Plus size={14} /> Add
        </button>
      </div>

      {showAddManual && (
        <div className="mb-3 bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Phone *</label>
              <input type="text" value={manualForm.phone || ''} onChange={e => setManualForm(f => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input type="text" value={manualForm.name || ''} onChange={e => setManualForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Birthday</label>
              <input type="text" value={manualForm.birthday || ''} onChange={e => setManualForm(f => ({ ...f, birthday: e.target.value }))} placeholder="DD/MM" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddManual} className="px-4 py-1.5 bg-[var(--color-primary)] text-white rounded-lg text-sm">Add</button>
            <button onClick={() => { setShowAddManual(false); setManualForm({}); }} className="px-4 py-1.5 text-gray-600 rounded-lg text-sm hover:bg-gray-100">Cancel</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50">
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr></thead>
          <tbody>
            {contacts.map(c => {
              let data = {}; try { data = JSON.parse(c.contact_data); } catch {}
              return (
                <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{c.phone}</td>
                  <td className="px-4 py-3 text-gray-800">{data.name || data.fullname || data.Name || '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 max-w-xs truncate">{Object.entries(data).filter(([k]) => !['phone','name','fullname','Name'].includes(k)).map(([k,v]) => `${k}: ${v}`).join(', ')}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setEditContact({ id: c.id, ...data })} className="p-1.5 rounded hover:bg-gray-100"><Edit2 size={14} className="text-gray-400" /></button>
                    <button onClick={() => handleDeleteContact(c.id)} className="p-1.5 rounded hover:bg-red-50 ml-1"><Trash2 size={14} className="text-red-400" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {total > 50 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm disabled:opacity-40">Prev</button>
          <span className="px-3 py-1.5 text-sm text-gray-500">Page {page}/{Math.ceil(total/50)}</span>
          <button onClick={() => setPage(p => p+1)} disabled={page >= Math.ceil(total/50)} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm disabled:opacity-40">Next</button>
        </div>
      )}

      {editContact && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="font-bold text-gray-800 mb-4">Edit Contact</h3>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {Object.entries(editContact).filter(([k]) => k !== 'id').map(([key, val]) => (
                <div key={key}><label className="block text-xs font-medium text-gray-600 mb-1">{key}</label>
                  <input type="text" value={val || ''} onChange={e => setEditContact(c => ({ ...c, [key]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" /></div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEditContact(null)} className="px-4 py-2 text-gray-600 rounded-lg text-sm hover:bg-gray-100">Cancel</button>
              <button onClick={handleUpdateContact} className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm">Save</button>
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
    api.get(`/schedulers/${schedulerId}/analytics/upcoming`, { params: { days } })
      .then(({ data }) => setUpcoming(data.upcoming))
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  }, [schedulerId, days]);

  const grouped = upcoming.reduce((acc, item) => { if (!acc[item.date]) acc[item.date] = []; acc[item.date].push(item); return acc; }, {});

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        {[7, 30].map(d => (
          <button key={d} onClick={() => setDays(d)} className={`px-3 py-1.5 rounded-lg text-sm transition ${days === d ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Next {d} days
          </button>
        ))}
      </div>
      {loading ? <p className="text-gray-400 text-sm">Loading...</p> : upcoming.length === 0 ? (
        <p className="text-gray-400 text-sm">No upcoming messages in the next {days} days.</p>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <h4 className="text-sm font-medium text-gray-500 mb-2">{new Date(date + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</h4>
              <div className="space-y-1">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 text-sm border border-gray-100">
                    <span className="text-indigo-600 font-medium min-w-[120px]">{item.rule_name}</span>
                    <span className="flex-1 text-gray-700">{item.contact_name || '—'}</span>
                    <span className="font-mono text-xs text-gray-400">{item.phone}</span>
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
    api.get(`/schedulers/${schedulerId}/analytics`)
      .then(({ data }) => setAnalytics(data))
      .catch(() => toast.error('Failed'))
      .finally(() => setLoading(false));
  }, [schedulerId]);

  const handleExport = async () => {
    try {
      const { data } = await api.get(`/schedulers/${schedulerId}/analytics/export`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([data]));
      const a = document.createElement('a'); a.href = url; a.download = `scheduler-${schedulerId}-export.csv`; a.click(); URL.revokeObjectURL(url);
    } catch { toast.error('Export failed'); }
  };

  if (loading) return <p className="text-gray-400 text-sm">Loading...</p>;
  if (!analytics) return null;

  const cards = [
    { label: 'Total Sent', value: analytics.totalSent, color: 'text-green-600' },
    { label: 'This Month', value: analytics.sentThisMonth, color: 'text-blue-600' },
    { label: 'Failed', value: analytics.totalFailed, color: 'text-red-500' },
    { label: 'Success Rate', value: `${analytics.successRate}%`, color: 'text-indigo-600' },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {cards.map(c => (
          <div key={c.label} className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
            <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
            <div className="text-xs text-gray-500 mt-1">{c.label}</div>
          </div>
        ))}
      </div>
      <h4 className="font-medium text-gray-700 mb-3">Per-Rule Breakdown</h4>
      <div className="overflow-x-auto rounded-xl border border-gray-200 mb-5">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50">
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rule</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Column</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-green-600 uppercase">Sent</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-red-500 uppercase">Failed</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
          </tr></thead>
          <tbody>
            {analytics.ruleStats.map(r => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="px-4 py-3 font-medium text-gray-800">{r.name}</td>
                <td className="px-4 py-3 text-gray-500">{r.date_column}</td>
                <td className="px-4 py-3 text-right text-green-600">{r.sent}</td>
                <td className="px-4 py-3 text-right text-red-500">{r.failed}</td>
                <td className="px-4 py-3 text-right">{r.sent + r.failed > 0 ? Math.round((r.sent / (r.sent + r.failed)) * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {analytics.monthlyTrend.length > 0 && (
        <div className="mb-5">
          <h4 className="font-medium text-gray-700 mb-3">Monthly Trend</h4>
          <div className="flex items-end gap-2 h-32 bg-gray-50 rounded-xl p-3 border border-gray-100">
            {analytics.monthlyTrend.map(m => {
              const max = Math.max(...analytics.monthlyTrend.map(x => x.count), 1);
              const h = Math.max((m.count / max) * 100, 4);
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-gray-500">{m.count}</span>
                  <div className="w-full bg-indigo-500 rounded-t" style={{ height: `${h}%` }}></div>
                  <span className="text-[10px] text-gray-400">{m.month.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">
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
    api.get(`/schedulers/${schedulerId}/logs`, { params: { page, limit: 50, status: filterStatus, rule_id: filterRule } })
      .then(({ data }) => { setLogs(data.logs); setTotal(data.total); })
      .catch(() => toast.error('Failed'));
  }, [schedulerId, page, filterStatus, filterRule]);

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none">
          <option value="">All statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </select>
        <select value={filterRule} onChange={e => { setFilterRule(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none">
          <option value="">All rules</option>
          {rules.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <span className="text-xs text-gray-400 self-center">{total} entries</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50">
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rule</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Error</th>
          </tr></thead>
          <tbody>
            {logs.map(log => {
              let cn = ''; try { const d = JSON.parse(log.contact_data); cn = d.name || d.fullname || d.Name || ''; } catch {}
              return (
                <tr key={log.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-500">{log.sent_at ? new Date(log.sent_at).toLocaleString('en-IN') : '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{cn || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{log.phone}</td>
                  <td className="px-4 py-3 text-gray-700">{log.rule_name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${log.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{log.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-red-500 max-w-xs truncate">{log.error_message || ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {total > 50 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm disabled:opacity-40">Prev</button>
          <span className="px-3 py-1.5 text-sm text-gray-500">Page {page}/{Math.ceil(total/50)}</span>
          <button onClick={() => setPage(p => p+1)} disabled={page >= Math.ceil(total/50)} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}
