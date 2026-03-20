import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Play, Pause, RotateCcw, Save, ChevronDown, ChevronUp, MessageSquare, Bot, Eye, Edit3, X, Upload, Users, Clock, Target, Shield, Megaphone, StopCircle, Hash, Zap, AlertCircle, CheckCircle, XCircle, Copy, FileSpreadsheet } from 'lucide-react';
import toast from '../utils/notify.js';
import api from '../api/client.js';

// ── Campaign List View ──
function CampaignList({ campaigns, onSelect, onNew, loading }) {
  const statusColors = {
    draft: 'bg-gray-100 text-gray-600',
    active: 'bg-green-100 text-green-700',
    paused: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-blue-100 text-blue-700',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Your Campaigns</h3>
        <button onClick={onNew} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition">
          <Plus size={16} /> New Campaign
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading campaigns...</div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center">
          <Megaphone size={48} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No campaigns yet</h3>
          <p className="text-sm text-gray-500 mb-4">Create your first campaign to automate multi-step outreach with messages and chatbots.</p>
          <button onClick={onNew} className="px-4 py-2 text-sm bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition">
            Create Campaign
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map(c => (
            <button key={c.id} onClick={() => onSelect(c.id)} className="bg-white rounded-xl shadow hover:shadow-md transition p-5 text-left group">
              <div className="flex items-start justify-between mb-3">
                <h4 className="font-semibold text-gray-800 group-hover:text-[var(--color-primary-dark)] transition truncate flex-1">{c.name}</h4>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusColors[c.status] || statusColors.draft}`}>{c.status}</span>
              </div>
              {c.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{c.description}</p>}
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1"><Hash size={12} /> {c.step_count} steps</span>
                <span className="flex items-center gap-1"><Users size={12} /> {c.contact_count} contacts</span>
              </div>
              {c.contact_count > 0 && (
                <div className="mt-3 flex gap-2 text-[10px]">
                  <span className="text-green-600">{c.active_contacts} active</span>
                  <span className="text-blue-600">{c.completed_contacts} done</span>
                  <span className="text-red-600">{c.stopped_contacts} stopped</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Campaign Editor (Create / Edit) ──
function CampaignEditor({ campaignId, onBack, onSaved }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState([{ step_type: 'message', day_offset: 0, send_time: '10:00', message_text: '', flow_id: null }]);
  const [stopKeywords, setStopKeywords] = useState([]);
  const [stopChatbotSteps, setStopChatbotSteps] = useState([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [flows, setFlows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!campaignId);

  // Load chatbot flows for dropdown
  useEffect(() => {
    api.get('/chatbot/flows').then(r => setFlows(r.data.flows || [])).catch(() => {});
  }, []);

  // Load existing campaign if editing
  useEffect(() => {
    if (!campaignId) return;
    setLoading(true);
    api.get(`/campaigns/${campaignId}`)
      .then(r => {
        const d = r.data;
        setName(d.name);
        setDescription(d.description || '');
        setSteps(d.steps.map(s => ({
          step_type: s.step_type,
          day_offset: s.day_offset,
          send_time: s.send_time || '10:00',
          message_text: s.message_text || '',
          flow_id: s.flow_id,
        })));
        setStopKeywords(d.stop_keywords || []);
        setStopChatbotSteps(d.stop_chatbot_steps || []);
      })
      .catch(err => toast.error('Failed to load campaign'))
      .finally(() => setLoading(false));
  }, [campaignId]);

  const addStep = () => {
    const lastDay = steps.length > 0 ? steps[steps.length - 1].day_offset : 0;
    setSteps([...steps, { step_type: 'message', day_offset: lastDay + 5, send_time: '10:00', message_text: '', flow_id: null }]);
  };

  const removeStep = (idx) => {
    if (steps.length <= 1) return toast.error('Campaign must have at least one step');
    setSteps(steps.filter((_, i) => i !== idx));
  };

  const updateStep = (idx, field, value) => {
    const updated = [...steps];
    updated[idx] = { ...updated[idx], [field]: value };
    setSteps(updated);
  };

  const addKeyword = () => {
    const kw = newKeyword.trim().toLowerCase();
    if (!kw) return;
    if (stopKeywords.includes(kw)) return toast.error('Keyword already added');
    setStopKeywords([...stopKeywords, kw]);
    setNewKeyword('');
  };

  const removeKeyword = (kw) => {
    setStopKeywords(stopKeywords.filter(k => k !== kw));
  };

  const saveCampaign = async () => {
    if (!name.trim()) return toast.error('Campaign name is required');
    if (steps.length === 0) return toast.error('Add at least one step');

    // Validate steps
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      if (s.step_type === 'message' && !s.message_text.trim()) {
        return toast.error(`Step ${i + 1}: Message text is required`);
      }
      if (s.step_type === 'chatbot' && !s.flow_id) {
        return toast.error(`Step ${i + 1}: Select a chatbot flow`);
      }
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        steps,
        stop_keywords: stopKeywords,
        stop_chatbot_steps: stopChatbotSteps,
      };

      if (campaignId) {
        await api.put(`/campaigns/${campaignId}`, payload);
        toast.success('Campaign updated');
      } else {
        await api.post('/campaigns', payload);
        toast.success('Campaign created');
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save campaign');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-400">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          &larr; Back to campaigns
        </button>
        <button onClick={saveCampaign} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition disabled:opacity-50">
          <Save size={14} /> {saving ? 'Saving...' : 'Save Campaign'}
        </button>
      </div>

      {/* Name & Description */}
      <div className="bg-white rounded-xl shadow p-5 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Campaign Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. New Lead Nurture" className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional notes about this campaign" className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:outline-none" />
          </div>
        </div>
      </div>

      {/* Steps Timeline */}
      <div className="bg-white rounded-xl shadow p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm text-gray-800">Campaign Steps</h3>
          <button onClick={addStep} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition">
            <Plus size={14} /> Add Step
          </button>
        </div>

        <div className="space-y-4">
          {steps.map((step, idx) => (
            <div key={idx} className="relative pl-8 pb-4">
              {/* Timeline line */}
              {idx < steps.length - 1 && (
                <div className="absolute left-[14px] top-8 bottom-0 w-0.5 bg-gray-200" />
              )}
              {/* Timeline dot */}
              <div className={`absolute left-1.5 top-2 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                step.step_type === 'message' ? 'border-blue-400 bg-blue-50 text-blue-600' : 'border-purple-400 bg-purple-50 text-purple-600'
              }`}>
                {idx + 1}
              </div>

              <div className="bg-gray-50 rounded-lg p-4 border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-gray-500">Step {idx + 1}</span>
                    <span className="text-xs text-gray-400">Day {step.day_offset}</span>
                  </div>
                  <button onClick={() => removeStep(idx)} className="text-gray-400 hover:text-red-500 transition" title="Remove step">
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">Day offset</label>
                    <input type="number" min="0" value={step.day_offset} onChange={e => updateStep(idx, 'day_offset', parseInt(e.target.value) || 0)} className="w-full px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">Send time (UTC)</label>
                    <input type="time" value={step.send_time} onChange={e => updateStep(idx, 'send_time', e.target.value)} className="w-full px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">Type</label>
                    <select value={step.step_type} onChange={e => updateStep(idx, 'step_type', e.target.value)} className="w-full px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:outline-none bg-white">
                      <option value="message">Message</option>
                      <option value="chatbot">Chatbot Flow</option>
                    </select>
                  </div>
                </div>

                {step.step_type === 'message' ? (
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">Message text (use {'{{variable}}'} for personalization)</label>
                    <textarea
                      value={step.message_text}
                      onChange={e => updateStep(idx, 'message_text', e.target.value)}
                      rows={3}
                      placeholder="Hi {{fullname}}, just following up on your inquiry..."
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:outline-none resize-none"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">Select chatbot flow</label>
                    <select
                      value={step.flow_id || ''}
                      onChange={e => updateStep(idx, 'flow_id', e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:outline-none bg-white"
                    >
                      <option value="">-- Select a flow --</option>
                      {flows.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stop Conditions */}
      <div className="bg-white rounded-xl shadow p-5 mb-4">
        <h3 className="font-semibold text-sm text-gray-800 mb-3 flex items-center gap-2">
          <Shield size={16} className="text-red-500" /> Stop Conditions
        </h3>
        <p className="text-xs text-gray-500 mb-4">Contacts matching these conditions will be automatically removed from the campaign.</p>

        <div className="mb-4">
          <label className="text-xs font-medium text-gray-600 block mb-2">Stop Keywords</label>
          <p className="text-[10px] text-gray-400 mb-2">If a contact replies with any of these keywords, they will be removed from the campaign.</p>
          <div className="flex gap-2 mb-2">
            <input
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addKeyword()}
              placeholder="e.g. stop, not interested"
              className="flex-1 px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:outline-none"
            />
            <button onClick={addKeyword} className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition">Add</button>
          </div>
          {stopKeywords.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {stopKeywords.map(kw => (
                <span key={kw} className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 text-xs rounded-lg">
                  {kw}
                  <button onClick={() => removeKeyword(kw)} className="hover:text-red-800"><X size={12} /></button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Campaign Dashboard (View active campaign) ──
function CampaignDashboard({ campaignId, onBack, onEdit, onRefresh }) {
  const [campaign, setCampaign] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [contactFilter, setContactFilter] = useState('enrolled');
  const [showEnroll, setShowEnroll] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [enrollProgress, setEnrollProgress] = useState(null); // { percent, enrolled, reactivated, skipped, total, current, chunks }
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [showContacts, setShowContacts] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());

  const loadCampaign = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get(`/campaigns/${campaignId}`),
      api.get(`/campaigns/${campaignId}/contacts`),
    ]).then(([campRes, contRes]) => {
      setCampaign(campRes.data);
      setContacts(contRes.data.contacts || []);
    }).catch(err => {
      toast.error('Failed to load campaign');
    }).finally(() => setLoading(false));
  }, [campaignId]);

  useEffect(() => { loadCampaign(); }, [loadCampaign]);

  const changeStatus = async (action) => {
    setActionLoading(action);
    try {
      await api.post(`/campaigns/${campaignId}/${action}`);
      toast.success(`Campaign ${action === 'activate' ? 'activated' : action === 'pause' ? 'paused' : 'resumed'}`);
      loadCampaign();
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.error || `Failed to ${action}`);
    } finally {
      setActionLoading('');
    }
  };

  const stopContact = async (contactId) => {
    try {
      await api.post(`/campaigns/${campaignId}/contacts/${contactId}/stop`);
      toast.success('Contact stopped');
      loadCampaign();
    } catch {
      toast.error('Failed to stop contact');
    }
  };

  const reactivateContact = async (contactId) => {
    try {
      await api.post(`/campaigns/${campaignId}/contacts/${contactId}/reactivate`);
      toast.success('Contact reactivated');
      loadCampaign();
    } catch {
      toast.error('Failed to reactivate contact');
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return toast.error('Select contacts first');
    if (!confirm(`Delete ${selectedIds.size} contact(s)?`)) return;
    try {
      const res = await api.post(`/campaigns/${campaignId}/contacts/delete`, { contact_ids: [...selectedIds] });
      toast.success(`${res.data.deleted} contact(s) deleted`);
      setSelectedIds(new Set());
      loadCampaign();
    } catch { toast.error('Delete failed'); }
  };

  const deleteAll = async () => {
    if (!confirm(`Delete ALL ${contacts.length} contacts from this campaign?`)) return;
    try {
      const res = await api.post(`/campaigns/${campaignId}/contacts/delete`, { all: true });
      toast.success(`${res.data.deleted} contact(s) deleted`);
      setSelectedIds(new Set());
      loadCampaign();
    } catch { toast.error('Delete failed'); }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filteredEnrolled = (() => {
    let list = showContacts ? contacts.filter(c => c.status === showContacts) : contacts;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c =>
        c.phone.includes(q) ||
        (c.contact_data?.fullname || '').toLowerCase().includes(q) ||
        (c.contact_data?.name || '').toLowerCase().includes(q)
      );
    }
    return list;
  })();

  const enrollContacts = async () => {
    if (!csvText.trim()) return toast.error('Paste CSV data');

    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return toast.error('Need at least a header row and one contact');

    // Parse CSV line respecting quoted fields
    function parseLine(line) {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') { inQuotes = !inQuotes; }
        else if (line[i] === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
        else { current += line[i]; }
      }
      result.push(current.trim());
      return result;
    }

    const headers = parseLine(lines[0]).map(h => h.toLowerCase());
    const phoneIdx = headers.findIndex(h => h === 'phone' || h === 'mobile' || h === 'number' || h === 'phone number');
    if (phoneIdx === -1) return toast.error('CSV must have a phone/mobile column');

    const contactsList = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseLine(lines[i]);
      if (!cols[phoneIdx]) continue;
      const contact = {};
      headers.forEach((h, idx) => {
        if (h === 'phone' || h === 'mobile' || h === 'number' || h === 'phone number') {
          contact.phone = cols[idx];
        } else {
          contact[h] = cols[idx] || '';
        }
      });
      contactsList.push(contact);
    }

    if (contactsList.length === 0) return toast.error('No valid contacts found');

    setEnrolling(true);
    const CHUNK_SIZE = 100;
    const chunks = Math.ceil(contactsList.length / CHUNK_SIZE);
    let totalEnrolled = 0, totalReactivated = 0, totalSkipped = 0;
    setEnrollProgress({ percent: 0, enrolled: 0, reactivated: 0, skipped: 0, total: contactsList.length, current: 0, chunks });

    try {
      for (let i = 0; i < chunks; i++) {
        const chunk = contactsList.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const res = await api.post(`/campaigns/${campaignId}/enroll`, { contacts: chunk });
        totalEnrolled += res.data.enrolled || 0;
        totalReactivated += res.data.reactivated || 0;
        totalSkipped += res.data.skipped || 0;
        const current = Math.min((i + 1) * CHUNK_SIZE, contactsList.length);
        setEnrollProgress({
          percent: Math.round((current / contactsList.length) * 100),
          enrolled: totalEnrolled, reactivated: totalReactivated, skipped: totalSkipped,
          total: contactsList.length, current, chunks,
        });
      }
      const parts = [`${totalEnrolled} enrolled`];
      if (totalReactivated) parts.push(`${totalReactivated} reactivated`);
      if (totalSkipped) parts.push(`${totalSkipped} skipped`);
      toast.success(parts.join(', '));
      setCsvText('');
      setContactFilter('enrolled');
      loadCampaign();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Enrollment failed');
    } finally {
      setEnrolling(false);
      setTimeout(() => setEnrollProgress(null), 3000);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvText(ev.target.result);
      setContactFilter('add');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (loading || !campaign) return <div className="text-center py-12 text-gray-400">Loading campaign...</div>;

  const statusColors = {
    draft: 'bg-gray-100 text-gray-600',
    active: 'bg-green-100 text-green-700',
    paused: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-blue-100 text-blue-700',
  };

  const filteredContacts = contactFilter
    ? contacts.filter(c => c.status === contactFilter)
    : contacts;

  const baseUrl = window.location.origin;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          &larr; Back
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          {campaign.status === 'draft' && (
            <button onClick={() => changeStatus('activate')} disabled={!!actionLoading} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50">
              <Play size={14} /> {actionLoading === 'activate' ? 'Activating...' : 'Activate'}
            </button>
          )}
          {campaign.status === 'active' && (
            <button onClick={() => changeStatus('pause')} disabled={!!actionLoading} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition disabled:opacity-50">
              <Pause size={14} /> Pause
            </button>
          )}
          {campaign.status === 'paused' && (
            <button onClick={() => changeStatus('resume')} disabled={!!actionLoading} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50">
              <RotateCcw size={14} /> Resume
            </button>
          )}
          <button onClick={() => onEdit(campaignId)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition">
            <Edit3 size={14} /> Edit
          </button>
          <button onClick={() => setShowEnroll(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition">
            <Users size={14} /> Enroll Campaign
          </button>
        </div>
      </div>

      {/* Campaign Info Card */}
      <div className="bg-white rounded-xl shadow p-5 mb-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold text-gray-800">{campaign.name}</h3>
            {campaign.description && <p className="text-sm text-gray-500 mt-1">{campaign.description}</p>}
          </div>
          <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-full ${statusColors[campaign.status]}`}>{campaign.status}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-800">{campaign.contactCounts?.total || 0}</p>
            <p className="text-[10px] text-gray-500 uppercase">Total Contacts</p>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-700">{campaign.contactCounts?.active || 0}</p>
            <p className="text-[10px] text-green-600 uppercase">Active</p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-700">{campaign.contactCounts?.completed || 0}</p>
            <p className="text-[10px] text-blue-600 uppercase">Completed</p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <p className="text-2xl font-bold text-red-600">{campaign.contactCounts?.stopped || 0}</p>
            <p className="text-[10px] text-red-500 uppercase">Stopped</p>
          </div>
        </div>
      </div>

      {/* Webhook / API Endpoint */}
      {campaign.webhook_token && (
        <div className="bg-white rounded-xl shadow p-5 mb-4">
          <h4 className="font-semibold text-sm text-gray-800 mb-2 flex items-center gap-2"><Zap size={14} className="text-yellow-500" /> API Enrollment Endpoint</h4>
          <p className="text-[10px] text-gray-400 mb-2">Use this URL to enroll contacts from n8n, external tools, or webhooks. Send POST with JSON body: {`{ "phone": "...", "fullname": "...", ... }`}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-gray-100 px-3 py-2 rounded-lg text-xs text-gray-700 overflow-x-auto">
              {baseUrl}/api/campaigns/webhook/{campaign.webhook_token}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${baseUrl}/api/campaigns/webhook/${campaign.webhook_token}`);
                toast.success('Copied to clipboard');
              }}
              className="px-2 py-2 text-gray-400 hover:text-gray-600 transition"
            >
              <Copy size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Step-by-step Analytics */}
      <div className="bg-white rounded-xl shadow p-5 mb-4">
        <h4 className="font-semibold text-sm text-gray-800 mb-4">Step Analytics</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="pb-2 pr-4">Step</th>
                <th className="pb-2 pr-4">Day</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2 pr-4 text-right">Sent</th>
                <th className="pb-2 pr-4 text-right">Delivered</th>
                <th className="pb-2 pr-4 text-right">Replied</th>
                <th className="pb-2 text-right">Failed</th>
              </tr>
            </thead>
            <tbody>
              {(campaign.steps || []).map((step, idx) => (
                <tr key={step.id} className="border-b last:border-0">
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        step.step_type === 'message' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
                      }`}>{idx + 1}</span>
                      <span className="text-gray-700 text-xs">
                        {step.step_type === 'chatbot' ? (step.flow_name || 'Chatbot') : 'Message'}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 text-gray-500 text-xs">Day {step.day_offset}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      step.step_type === 'message' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                    }`}>
                      {step.step_type === 'message' ? 'MSG' : 'BOT'}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-right text-gray-700">{step.stats?.total_sent || 0}</td>
                  <td className="py-2.5 pr-4 text-right text-green-600">{step.stats?.delivered || 0}</td>
                  <td className="py-2.5 pr-4 text-right text-blue-600">{step.stats?.replied || 0}</td>
                  <td className="py-2.5 text-right text-red-500">{step.stats?.failed || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(!campaign.steps || campaign.steps.length === 0) && (
          <div className="text-center py-6 text-gray-400 text-sm">No steps configured</div>
        )}
      </div>


      {/* Enroll Modal */}
      {showEnroll && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowEnroll(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Enroll Campaign</h3>
              <button onClick={() => setShowEnroll(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            {/* Tabs: Enrolled / Add New */}
            <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1">
              <button onClick={() => setContactFilter('enrolled')} className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition ${contactFilter === 'enrolled' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
                Enrolled ({contacts.length})
              </button>
              <button onClick={() => setContactFilter('add')} className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition ${contactFilter === 'add' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
                + Add New
              </button>
            </div>

            {/* Enrolled Contacts View */}
            {contactFilter === 'enrolled' && (
              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Search + Actions Bar */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <div className="flex-1 min-w-[150px]">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search phone or name..."
                      className="w-full px-3 py-1.5 border rounded-lg text-xs focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:outline-none"
                    />
                  </div>
                  {selectedIds.size > 0 && (
                    <button onClick={deleteSelected} className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition font-medium">
                      <Trash2 size={12} /> Delete ({selectedIds.size})
                    </button>
                  )}
                  {contacts.length > 0 && (
                    <button onClick={deleteAll} className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition font-medium">
                      <Trash2 size={12} /> Delete All
                    </button>
                  )}
                </div>

                {/* Status Filter */}
                <div className="flex gap-2 mb-3 flex-wrap">
                  {['', 'active', 'completed', 'stopped'].map(f => (
                    <button
                      key={f}
                      onClick={() => setShowContacts(f === showContacts ? '' : f)}
                      className={`px-2.5 py-1 text-[10px] rounded-full transition ${(showContacts || '') === f ? 'bg-[var(--color-primary)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {f || 'All'} ({f === '' ? contacts.length : contacts.filter(c => c.status === f).length})
                    </button>
                  ))}
                </div>

                <div className="overflow-auto flex-1">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-white">
                      <tr className="text-left text-gray-500 border-b">
                        <th className="pb-2 pr-2 w-6">
                          <input
                            type="checkbox"
                            checked={filteredEnrolled.length > 0 && filteredEnrolled.every(c => selectedIds.has(c.id))}
                            onChange={e => {
                              if (e.target.checked) setSelectedIds(new Set(filteredEnrolled.map(c => c.id)));
                              else setSelectedIds(new Set());
                            }}
                            className="rounded"
                          />
                        </th>
                        <th className="pb-2 pr-3">Phone</th>
                        <th className="pb-2 pr-3">Name</th>
                        <th className="pb-2 pr-3">Step</th>
                        <th className="pb-2 pr-3">Status</th>
                        <th className="pb-2 pr-3">Enrolled</th>
                        <th className="pb-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEnrolled.map(c => (
                        <tr key={c.id} className={`border-b last:border-0 ${selectedIds.has(c.id) ? 'bg-blue-50' : ''}`}>
                          <td className="py-2 pr-2">
                            <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="rounded" />
                          </td>
                          <td className="py-2 pr-3 text-gray-700 font-mono">{c.phone}</td>
                          <td className="py-2 pr-3 text-gray-600">{c.contact_data?.fullname || c.contact_data?.name || '-'}</td>
                          <td className="py-2 pr-3 text-gray-500">{c.current_step}/{campaign.steps?.length || 0}</td>
                          <td className="py-2 pr-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              c.status === 'active' ? 'bg-green-100 text-green-700' :
                              c.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                              'bg-red-100 text-red-600'
                            }`}>{c.status}</span>
                            {c.stop_reason && <span className="ml-1 text-[10px] text-gray-400">({c.stop_reason})</span>}
                          </td>
                          <td className="py-2 pr-3 text-gray-400">{new Date(c.enrolled_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                          <td className="py-2">
                            {c.status === 'active' && (
                              <button onClick={() => stopContact(c.id)} className="text-red-400 hover:text-red-600 transition" title="Stop">
                                <StopCircle size={14} />
                              </button>
                            )}
                            {c.status === 'stopped' && (
                              <button onClick={() => reactivateContact(c.id)} className="text-green-400 hover:text-green-600 transition" title="Reactivate">
                                <Play size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredEnrolled.length === 0 && (
                    <div className="text-center py-8 text-gray-400 text-xs">
                      {searchQuery ? 'No contacts match your search' : 'No contacts enrolled yet'}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Add New Contacts View */}
            {contactFilter === 'add' && (
              <>
                {/* Progress Bar */}
                {enrollProgress && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-700">
                        {enrollProgress.percent < 100 ? 'Enrolling...' : 'Complete!'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {enrollProgress.current} / {enrollProgress.total}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${enrollProgress.percent >= 100 ? 'bg-green-500' : 'bg-[var(--color-primary)]'}`}
                        style={{ width: `${enrollProgress.percent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-gray-500">{enrollProgress.percent}%</span>
                      <div className="flex gap-3 text-[10px]">
                        <span className="text-green-600">{enrollProgress.enrolled} enrolled</span>
                        {enrollProgress.reactivated > 0 && <span className="text-blue-600">{enrollProgress.reactivated} reactivated</span>}
                        {enrollProgress.skipped > 0 && <span className="text-gray-400">{enrollProgress.skipped} skipped</span>}
                      </div>
                    </div>
                  </div>
                )}

                {!enrolling && (
                  <>
                    <p className="text-xs text-gray-500 mb-3">Paste CSV data or upload a CSV file. Must include a <strong>phone</strong> column. Other columns become contact variables.</p>

                    <div className="mb-3">
                      <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg cursor-pointer hover:bg-gray-200 transition text-sm w-fit">
                        <Upload size={14} /> Upload CSV
                        <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
                      </label>
                    </div>

                    <textarea
                      value={csvText}
                      onChange={e => setCsvText(e.target.value)}
                      rows={8}
                      placeholder={"phone,fullname,email\n919876543210,John Doe,john@example.com\n918765432109,Jane Smith,jane@example.com"}
                      className="w-full px-3 py-2 border rounded-lg text-xs font-mono focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:outline-none resize-none mb-4"
                    />

                    <div className="flex justify-end gap-2">
                      <button onClick={() => setShowEnroll(false)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition">Cancel</button>
                      <button onClick={enrollContacts} disabled={enrolling} className="px-4 py-2 text-sm bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition disabled:opacity-50">
                        Enroll
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Campaign Builder Component ──
export default function CampaignBuilder({ initialCampaignId, onClearInitial }) {
  const [view, setView] = useState(initialCampaignId ? 'dashboard' : 'list');
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(initialCampaignId || null);
  const [editId, setEditId] = useState(null);

  const loadCampaigns = useCallback(() => {
    setLoading(true);
    api.get('/campaigns')
      .then(r => setCampaigns(r.data.campaigns || []))
      .catch(() => toast.error('Failed to load campaigns'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  // Handle initialCampaignId changes from parent (e.g. Bulk section click)
  useEffect(() => {
    if (initialCampaignId) {
      setSelectedId(initialCampaignId);
      setView('dashboard');
      onClearInitial?.();
    }
  }, [initialCampaignId]);

  const handleSelect = (id) => {
    setSelectedId(id);
    setView('dashboard');
  };

  const handleNew = () => {
    setEditId(null);
    setView('editor');
  };

  const handleEdit = (id) => {
    setEditId(id);
    setView('editor');
  };

  const handleSaved = () => {
    loadCampaigns();
    setView('list');
  };

  const handleBack = () => {
    setView('list');
    loadCampaigns();
  };

  if (view === 'editor') {
    return <CampaignEditor campaignId={editId} onBack={handleBack} onSaved={handleSaved} />;
  }

  if (view === 'dashboard' && selectedId) {
    return <CampaignDashboard campaignId={selectedId} onBack={handleBack} onEdit={handleEdit} onRefresh={loadCampaigns} />;
  }

  return <CampaignList campaigns={campaigns} onSelect={handleSelect} onNew={handleNew} loading={loading} />;
}
