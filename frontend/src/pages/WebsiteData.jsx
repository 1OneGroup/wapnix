import { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext.jsx';
import api from '../api/client.js';
import toast from '../utils/notify.js';
import {
  Globe, Send, Trash2, RefreshCw, Filter, Copy, CheckCircle, Clock,
  Star, XCircle, MessageSquare, Users, ChevronDown, ChevronUp, X, Code, Bot, Mail, Settings,
} from 'lucide-react';

const STATUS_META = {
  new:       { label: 'New',       color: '#3b82f6', bg: 'bg-blue-100',   text: 'text-blue-700',   icon: Star },
  contacted: { label: 'Contacted', color: '#8b5cf6', bg: 'bg-purple-100', text: 'text-purple-700', icon: MessageSquare },
  converted: { label: 'Converted', color: '#22c55e', bg: 'bg-green-100',  text: 'text-green-700',  icon: CheckCircle },
  ignored:   { label: 'Ignored',   color: '#6b7280', bg: 'bg-gray-100',   text: 'text-gray-500',   icon: XCircle },
};

export default function WebsiteData() {
  const { currentTheme } = useSettings();
  const [leads, setLeads] = useState([]);
  const [counts, setCounts] = useState({ new: 0, contacted: 0, converted: 0, ignored: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [webhookInfo, setWebhookInfo] = useState(null);
  const [showSetup, setShowSetup] = useState(false);
  const [sendModal, setSendModal] = useState(null); // lead object or null
  const [sendMsg, setSendMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [bulkModal, setBulkModal] = useState(false);
  const [bulkMsg, setBulkMsg] = useState('');
  const [bulkSending, setBulkSending] = useState(false);
  const [chatbotModal, setChatbotModal] = useState(null); // lead object
  const [flows, setFlows] = useState([]);
  const [selectedFlowId, setSelectedFlowId] = useState('');
  const [chatbotSending, setChatbotSending] = useState(false);
  const [sendMode, setSendMode] = useState('message'); // 'message' | 'chatbot'
  const [flowVars, setFlowVars] = useState([]); // variables from selected flow
  const [varMapping, setVarMapping] = useState({}); // flowVar -> value
  const [savedMappings, setSavedMappings] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wapnix_var_mappings') || '{}'); } catch { return {}; }
  });
  const [autoSend, setAutoSend] = useState({ mode: 'off', message_template: '', flow_id: null, var_mapping: '{}' });
  const [autoFlows, setAutoFlows] = useState([]);
  const [autoMsg, setAutoMsg] = useState('');
  const [autoFlowId, setAutoFlowId] = useState('');
  const [savingAuto, setSavingAuto] = useState(false);
  const [autoEmailOn, setAutoEmailOn] = useState(false);
  const [autoEmailSubject, setAutoEmailSubject] = useState('');
  const [autoEmailBody, setAutoEmailBody] = useState('');
  const [autoEmailFiles, setAutoEmailFiles] = useState([]); // { name, url, filename }
  const [uploadingAutoFile, setUploadingAutoFile] = useState(false);
  const [autoMsgFiles, setAutoMsgFiles] = useState([]);
  const [uploadingMsgFile, setUploadingMsgFile] = useState(false);
  const [emailModal, setEmailModal] = useState(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailFiles, setEmailFiles] = useState([]);
  const [showEmailSetup, setShowEmailSetup] = useState(false);
  const [emailSettings, setEmailSettings] = useState({ smtp_host: '', smtp_port: 587, smtp_user: '', smtp_pass: '', from_name: '', from_email: '', enabled: 0 });
  const [savingEmail, setSavingEmail] = useState(false);

  useEffect(() => { fetchLeads(); fetchWebhook(); fetchFlows(); fetchAutoSend(); fetchEmailSettings(); }, []);

  async function fetchEmailSettings() {
    try { const res = await api.get('/website/email-settings'); setEmailSettings(res.data); } catch {}
  }

  async function saveEmailSettings() {
    setSavingEmail(true);
    try {
      await api.put('/website/email-settings', emailSettings);
      toast.success('Email settings saved!');
    } catch { toast.error('Failed to save'); }
    finally { setSavingEmail(false); }
  }

  function openEmailModal(lead) {
    setEmailModal(lead);
    setEmailFiles([]);
    setEmailSubject(`Thank you for your interest - ONE Group Developers`);
    setEmailBody(`Dear {{name}},\n\nThank you for showing interest in ONE Group Developers. We truly appreciate you taking the time to reach out to us.\n\nOur team has received your inquiry and a dedicated representative will connect with you shortly to assist you further.\n\nFor immediate assistance, feel free to contact us:\nPhone: +91 88752 21116 | +91 977 977 1130\nWebsite: onegroupdevelopers.com\n\nWe look forward to helping you find your dream property.\n\nWarm regards,\nTeam ONE Group Developers`);
  }

  async function sendEmail() {
    if (!emailModal) return;
    setEmailSending(true);
    try {
      const formData = new FormData();
      formData.append('subject', emailSubject);
      formData.append('body', emailBody);
      for (const file of emailFiles) {
        formData.append('attachments', file);
      }
      await api.post(`/website/leads/${emailModal.id}/email`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Email sent!');
      setEmailModal(null);
      setEmailFiles([]);
      fetchLeads();
    } catch (err) { toast.error(err.response?.data?.error || 'Email failed'); }
    finally { setEmailSending(false); }
  }

  async function fetchAutoSend() {
    try {
      const res = await api.get('/website/auto-send');
      setAutoSend(res.data);
      setAutoMsg(res.data.message_template || '');
      setAutoFlowId(res.data.flow_id ? String(res.data.flow_id) : '');
      setAutoEmailOn(!!res.data.email_enabled);
      setAutoEmailSubject(res.data.email_subject || 'Thank you for your interest - ONE Group Developers');
      setAutoEmailBody(res.data.email_body || 'Dear {{name}},\n\nThank you for showing interest in ONE Group Developers. Our team will connect with you shortly.\n\nFor immediate assistance:\nPhone: +91 88752 21116 | +91 977 977 1130\n\nWarm regards,\nTeam ONE Group Developers');
      try { setAutoEmailFiles(JSON.parse(res.data.email_attachments || '[]')); } catch { setAutoEmailFiles([]); }
      try { setAutoMsgFiles(JSON.parse(res.data.msg_attachments || '[]')); } catch { setAutoMsgFiles([]); }
    } catch {}
  }

  async function saveAutoSend(mode, emailToggle) {
    setSavingAuto(true);
    const emailOn = emailToggle !== undefined ? emailToggle : autoEmailOn;
    try {
      await api.put('/website/auto-send', {
        mode: mode !== undefined ? mode : autoSend.mode,
        message_template: autoMsg,
        flow_id: autoFlowId ? parseInt(autoFlowId) : null,
        var_mapping: JSON.stringify(savedMappings[autoFlowId] || {}),
        email_enabled: emailOn,
        email_subject: autoEmailSubject,
        email_body: autoEmailBody,
        email_attachments: JSON.stringify(autoEmailFiles),
        msg_attachments: JSON.stringify(autoMsgFiles),
      });
      if (mode !== undefined) setAutoSend(prev => ({ ...prev, mode }));
      if (emailToggle !== undefined) setAutoEmailOn(emailToggle);
      toast.success('Settings saved!');
    } catch { toast.error('Failed to save'); }
    finally { setSavingAuto(false); }
  }

  async function fetchFlows() {
    try {
      const res = await api.get('/chatbot/flows');
      setFlows(res.data.flows || []);
    } catch {}
  }

  async function fetchLeads(status) {
    setLoading(true);
    try {
      const f = status || filter;
      const res = await api.get(`/website/leads?status=${f}`);
      setLeads(res.data.leads || []);
      setCounts(res.data.counts || {});
    } catch { toast.error('Failed to load leads'); }
    finally { setLoading(false); }
  }

  async function fetchWebhook() {
    try {
      const res = await api.get('/website/webhook-info');
      setWebhookInfo(res.data);
    } catch {}
  }

  function changeFilter(f) {
    setFilter(f);
    fetchLeads(f);
  }

  async function updateStatus(id, status) {
    try {
      await api.put(`/website/leads/${id}/status`, { status });
      fetchLeads();
    } catch { toast.error('Update failed'); }
  }

  async function deleteLead(id) {
    if (!confirm('Delete this lead?')) return;
    try {
      await api.delete(`/website/leads/${id}`);
      setLeads(prev => prev.filter(l => l.id !== id));
      toast.success('Lead deleted');
    } catch { toast.error('Delete failed'); }
  }

  async function sendWhatsApp() {
    if (!sendModal || !sendMsg) return;
    setSending(true);
    try {
      await api.post(`/website/leads/${sendModal.id}/send`, { message: sendMsg });
      toast.success('Message sent!');
      setSendModal(null);
      setSendMsg('');
      fetchLeads();
    } catch (err) { toast.error(err.response?.data?.error || 'Send failed'); }
    finally { setSending(false); }
  }

  async function bulkSend() {
    if (!bulkMsg) return;
    setBulkSending(true);
    try {
      const res = await api.post('/website/leads/bulk-send', { message: bulkMsg, status_filter: 'new' });
      toast.success(`Sent: ${res.data.sent}, Failed: ${res.data.failed}`);
      setBulkModal(false);
      setBulkMsg('');
      fetchLeads();
    } catch (err) { toast.error(err.response?.data?.error || 'Bulk send failed'); }
    finally { setBulkSending(false); }
  }

  async function sendChatbot() {
    if (!chatbotModal || !selectedFlowId) return toast.error('Select a chatbot flow');
    const phone = chatbotModal.phone;
    if (!phone) return toast.error('No phone number');
    setChatbotSending(true);
    try {
      const flowRes = await api.get(`/chatbot/flows/${selectedFlowId}`);
      const flow = flowRes.data;
      const firstMsg = flow.steps?.[0]?.message || '';
      if (!firstMsg) return toast.error('Flow has no first message');

      // Parse extra_data if available
      let extra = {};
      try { extra = JSON.parse(chatbotModal.extra_data || '{}'); } catch {}

      // Use varMapping from the UI
      const varMap = { ...varMapping };
      // Also add defaults for unmapped
      if (!varMap.name) varMap.name = chatbotModal.name || '';
      if (!varMap.phone) varMap.phone = phone;
      if (!varMap.email) varMap.email = chatbotModal.email || '';

      // Replace ALL variables in first message
      let body = firstMsg;
      for (const [key, val] of Object.entries(varMap)) {
        body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), String(val || ''));
      }

      // Send with contact data so subsequent steps also get variables
      await api.post('/chatbot/quick-send', {
        phone,
        message: body,
        flow_id: parseInt(selectedFlowId),
        contact_data: varMap,
      });
      toast.success('Chatbot started! Bot will auto-reply to responses.');
      setChatbotModal(null);
      setSelectedFlowId('');
      fetchLeads();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to start chatbot'); }
    finally { setChatbotSending(false); }
  }

  function openSendModal(lead) {
    setSendModal(lead);
    setSendMode('message');
    setSendMsg(`Hi ${lead.name || ''}! Thanks for your inquiry. How can we help you?`);
  }

  function openChatbotModal(lead) {
    setChatbotModal(lead);
    setSendMode('chatbot');
    setSelectedFlowId('');
    setFlowVars([]);
    setVarMapping({});
  }

  async function handleFlowSelect(flowId) {
    setSelectedFlowId(flowId);
    if (!flowId) { setFlowVars([]); setVarMapping({}); return; }
    try {
      const res = await api.get(`/chatbot/flows/${flowId}`);
      const flow = res.data;
      // Extract all variables from all steps
      const vars = new Set();
      for (const step of (flow.steps || [])) {
        const matches = (step.message || '').matchAll(/\{\{(\w+)\}\}/g);
        for (const m of matches) vars.add(m[1]);
      }
      const varList = [...vars];
      setFlowVars(varList);
      // Auto-map matching fields
      const lead = chatbotModal;
      const leadFields = { name: lead?.name, fullname: lead?.name, phone: lead?.phone, email: lead?.email, company: lead?.source, source: lead?.source, page_url: lead?.page_url, message: lead?.message };
      // Load saved permanent mappings first, then auto-map remaining
      const saved = savedMappings[flowId] || {};
      const autoMap = { ...saved };
      for (const v of varList) {
        if (!autoMap[v] && leadFields[v.toLowerCase()] !== undefined) autoMap[v] = leadFields[v.toLowerCase()];
      }
      setVarMapping(autoMap);
    } catch {}
  }

  const leadFieldOptions = chatbotModal ? [
    { key: 'name', label: 'Name', value: chatbotModal.name },
    { key: 'phone', label: 'Phone', value: chatbotModal.phone },
    { key: 'email', label: 'Email', value: chatbotModal.email },
    { key: 'source', label: 'Source', value: chatbotModal.source },
    { key: 'message', label: 'Message', value: chatbotModal.message },
    { key: 'page_url', label: 'Page URL', value: chatbotModal.page_url },
  ] : [];

  function copyText(text) {
    navigator.clipboard.writeText(text);
    toast.success('Copied!');
  }

  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts.includes('T') ? ts : ts + 'Z');
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }

  const total = counts.new + counts.contacted + counts.converted + counts.ignored;
  const baseUrl = window.location.origin;

  return (
    <div className="max-w-6xl mx-auto space-y-4 px-2 md:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-lg md:text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Users size={20} style={{ color: currentTheme.primary }} /> Contacts
          </h1>
          <p className="text-[10px] md:text-xs text-gray-400 mt-0.5">Manage your contacts and leads</p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setShowEmailSetup(!showEmailSetup)}
            className="px-3 py-2 text-xs font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 flex items-center gap-1">
            <Mail size={14} /> Email
          </button>
          <button onClick={() => setShowSetup(!showSetup)}
            className="px-3 py-2 text-xs font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 flex items-center gap-1">
            <Code size={14} /> Webhook
          </button>
          <button onClick={() => setBulkModal(true)}
            className="px-3 py-2 text-xs font-medium text-white rounded-lg hover:opacity-90 flex items-center gap-1"
            style={{ backgroundColor: currentTheme.primary }}>
            <Send size={14} /> Bulk Send
          </button>
          <button onClick={() => fetchLeads()} className="px-3 py-2 text-xs font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 flex items-center gap-1">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Setup / Integration Guide */}
      {showSetup && (
        <div className="bg-white rounded-xl shadow p-4 border-l-4 border-indigo-500">
          <h3 className="font-bold text-sm text-gray-800 mb-2 flex items-center gap-2">
            <Code size={16} className="text-indigo-500" /> Integration Setup
          </h3>
          {webhookInfo?.api_key ? (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-gray-400 block mb-0.5">Webhook URL (POST)</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-gray-50 px-3 py-2 rounded-lg text-xs font-mono border break-all">
                    {baseUrl}/api/website/webhook/{webhookInfo.api_key}
                  </code>
                  <button onClick={() => copyText(`${baseUrl}/api/website/webhook/${webhookInfo.api_key}`)}
                    className="p-2 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 shrink-0">
                    <Copy size={14} />
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-0.5">Sample HTML Form</label>
                <pre className="bg-gray-900 text-green-400 p-3 rounded-lg text-[10px] overflow-x-auto whitespace-pre">{`<form action="${baseUrl}/api/website/webhook/${webhookInfo.api_key}" method="POST">
  <input name="name" placeholder="Name" required>
  <input name="email" placeholder="Email">
  <input name="phone" placeholder="Phone" required>
  <input name="message" placeholder="Message">
  <input name="page_url" type="hidden" value="https://yoursite.com/contact">
  <input name="source" type="hidden" value="Contact Page">
  <button type="submit">Submit</button>
</form>`}</pre>
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-0.5">JSON API (fetch/axios)</label>
                <pre className="bg-gray-900 text-green-400 p-3 rounded-lg text-[10px] overflow-x-auto whitespace-pre">{`fetch("${baseUrl}/api/website/webhook/${webhookInfo.api_key}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "John",
    phone: "919876543210",
    email: "john@example.com",
    message: "Interested in your service",
    page_url: "https://yoursite.com/pricing",
    source: "Pricing Page"
  })
})`}</pre>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Go to <b>API Access</b> page and generate an API key first.</p>
          )}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2 md:gap-3">
        {[
          { key: 'all', label: 'All Leads', count: total, color: currentTheme.primary, Icon: Users },
          { key: 'new', label: 'New', count: counts.new, color: '#3b82f6', Icon: Star },
          { key: 'contacted', label: 'Contacted', count: counts.contacted, color: '#8b5cf6', Icon: MessageSquare },
          { key: 'converted', label: 'Converted', count: counts.converted, color: '#22c55e', Icon: CheckCircle },
          { key: 'ignored', label: 'Ignored', count: counts.ignored, color: '#6b7280', Icon: XCircle },
        ].map(s => (
          <button key={s.key} onClick={() => changeFilter(s.key)}
            className={`p-3 rounded-xl border-2 transition-all text-left ${filter === s.key ? 'shadow-md' : 'bg-white hover:shadow'}`}
            style={{ borderColor: filter === s.key ? s.color : '#e5e7eb', backgroundColor: filter === s.key ? s.color + '10' : 'white' }}>
            <div className="flex items-center gap-2">
              <s.Icon size={16} style={{ color: s.color }} />
              <span className="text-lg font-bold text-gray-800">{s.count}</span>
            </div>
            <p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Auto-Send Controls */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-700">Auto-Send on New Lead</h3>
          {autoSend.mode !== 'off' && (
            <button onClick={() => saveAutoSend('off')} className="text-[10px] text-red-500 hover:text-red-700 font-bold">Turn Off</button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Send Message Toggle */}
          <div className={`rounded-xl border-2 p-3 transition-all ${autoSend.mode === 'message' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Send size={16} className={autoSend.mode === 'message' ? 'text-green-600' : 'text-gray-400'} />
                <span className="text-sm font-semibold text-gray-800">Send Message</span>
              </div>
              <button onClick={() => saveAutoSend(autoSend.mode === 'message' ? 'off' : 'message')}
                className={`w-11 h-6 rounded-full transition-all relative ${autoSend.mode === 'message' ? 'bg-green-500' : 'bg-gray-300'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-all ${autoSend.mode === 'message' ? 'left-5.5' : 'left-0.5'}`}
                  style={{ left: autoSend.mode === 'message' ? '22px' : '2px' }} />
              </button>
            </div>
            <textarea value={autoMsg} onChange={e => setAutoMsg(e.target.value)}
              rows={2} placeholder="Hi {{name}}! Thanks for reaching out..."
              className="w-full px-2 py-1.5 border rounded-lg text-xs focus:ring-1 focus:ring-green-300 focus:outline-none" />
            <p className="text-[9px] text-gray-400 mt-1">Variables: {'{{name}} {{phone}} {{email}} {{source}} {{message}} {{greeting}}'}</p>

            {/* Auto-msg attachments */}
            <div className="mt-1.5">
              <label className="flex items-center justify-center gap-1 px-2 py-1.5 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-green-400 hover:bg-green-50 transition">
                <Send size={10} className="text-gray-400" />
                <span className="text-[10px] text-gray-500">{uploadingMsgFile ? 'Uploading...' : 'Add Image / PDF / Doc'}</span>
                <input type="file" accept="image/*,.pdf,.doc,.docx" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploadingMsgFile(true);
                  const form = new FormData();
                  form.append('image', file);
                  try {
                    const res = await api.post('/messages/upload-image', form, { headers: { 'Content-Type': 'multipart/form-data' } });
                    setAutoMsgFiles(prev => [...prev, { name: file.name, url: res.data.url, filename: res.data.filename }]);
                  } catch { toast.error('Upload failed'); }
                  finally { setUploadingMsgFile(false); e.target.value = ''; }
                }} className="hidden" disabled={uploadingMsgFile} />
              </label>
              {autoMsgFiles.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {autoMsgFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between bg-white px-2 py-1 rounded border text-[10px]">
                      <span className="truncate flex-1 text-gray-600">{f.name}</span>
                      <button onClick={() => setAutoMsgFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 ml-1"><X size={10} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {autoSend.mode === 'message' && (
              <button onClick={() => saveAutoSend('message')} className="mt-2 text-[10px] bg-green-600 text-white px-3 py-1 rounded font-bold hover:bg-green-700">
                Save Message
              </button>
            )}
          </div>

          {/* Chatbot Toggle */}
          <div className={`rounded-xl border-2 p-3 transition-all ${autoSend.mode === 'chatbot' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Bot size={16} className={autoSend.mode === 'chatbot' ? 'text-indigo-600' : 'text-gray-400'} />
                <span className="text-sm font-semibold text-gray-800">Chatbot Flow</span>
              </div>
              <button onClick={() => saveAutoSend(autoSend.mode === 'chatbot' ? 'off' : 'chatbot')}
                className={`w-11 h-6 rounded-full transition-all relative ${autoSend.mode === 'chatbot' ? 'bg-indigo-500' : 'bg-gray-300'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-all`}
                  style={{ left: autoSend.mode === 'chatbot' ? '22px' : '2px' }} />
              </button>
            </div>
            <select value={autoFlowId} onChange={e => setAutoFlowId(e.target.value)}
              className="w-full px-2 py-1.5 border rounded-lg text-xs focus:ring-1 focus:ring-indigo-300 focus:outline-none">
              <option value="">-- Select Flow --</option>
              {flows.map(f => (
                <option key={f.id} value={f.id}>{f.name} {f.is_active ? '(Active)' : ''}</option>
              ))}
            </select>
            <p className="text-[9px] text-gray-400 mt-1">Bot will auto-start with this flow for every new lead</p>
            {autoSend.mode === 'chatbot' && (
              <button onClick={() => saveAutoSend('chatbot')} className="mt-2 text-[10px] bg-indigo-600 text-white px-3 py-1 rounded font-bold hover:bg-indigo-700">
                Save Flow
              </button>
            )}
          </div>

          {/* Auto Email Toggle */}
          <div className={`rounded-xl border-2 p-3 transition-all ${autoEmailOn ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Mail size={16} className={autoEmailOn ? 'text-blue-600' : 'text-gray-400'} />
                <span className="text-sm font-semibold text-gray-800">Auto Email</span>
              </div>
              <button onClick={() => saveAutoSend(undefined, !autoEmailOn)}
                className={`w-11 h-6 rounded-full transition-all relative ${autoEmailOn ? 'bg-blue-500' : 'bg-gray-300'}`}>
                <div className="w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-all"
                  style={{ left: autoEmailOn ? '22px' : '2px' }} />
              </button>
            </div>
            <input value={autoEmailSubject} onChange={e => setAutoEmailSubject(e.target.value)}
              placeholder="Email subject..." className="w-full px-2 py-1.5 border rounded-lg text-xs focus:ring-1 focus:ring-blue-300 focus:outline-none mb-1.5" />
            <textarea value={autoEmailBody} onChange={e => setAutoEmailBody(e.target.value)}
              rows={2} placeholder="Dear {{name}},..." className="w-full px-2 py-1.5 border rounded-lg text-xs focus:ring-1 focus:ring-blue-300 focus:outline-none" />
            <p className="text-[9px] text-gray-400 mt-1">{'{{greeting}} {{name}} {{email}} {{phone}} {{source}}'}</p>

            {/* Auto-email attachments */}
            <div className="mt-1.5">
              <label className="flex items-center justify-center gap-1 px-2 py-1.5 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition">
                <Mail size={10} className="text-gray-400" />
                <span className="text-[10px] text-gray-500">{uploadingAutoFile ? 'Uploading...' : 'Add Image / PDF / Doc'}</span>
                <input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploadingAutoFile(true);
                  const form = new FormData();
                  form.append('image', file);
                  try {
                    const res = await api.post('/messages/upload-image', form, { headers: { 'Content-Type': 'multipart/form-data' } });
                    setAutoEmailFiles(prev => [...prev, { name: file.name, url: res.data.url, filename: res.data.filename }]);
                  } catch { toast.error('Upload failed'); }
                  finally { setUploadingAutoFile(false); e.target.value = ''; }
                }} className="hidden" disabled={uploadingAutoFile} />
              </label>
              {autoEmailFiles.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {autoEmailFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between bg-white px-2 py-1 rounded border text-[10px]">
                      <span className="truncate flex-1 text-gray-600">{f.name}</span>
                      <button onClick={() => setAutoEmailFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 ml-1"><X size={10} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {autoEmailOn && (
              <button onClick={() => saveAutoSend(undefined, true)} className="mt-2 text-[10px] bg-blue-600 text-white px-3 py-1 rounded font-bold hover:bg-blue-700">
                Save Email
              </button>
            )}
          </div>
        </div>
        {(autoSend.mode !== 'off' || autoEmailOn) && (
          <div className="mt-3 space-y-1.5">
            {autoSend.mode !== 'off' && (
              <div className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 ${autoSend.mode === 'message' ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700'}`}>
                <CheckCircle size={14} />
                {autoSend.mode === 'message' ? 'Auto WhatsApp message is ON' : 'Auto chatbot is ON'}
              </div>
            )}
            {autoEmailOn && (
              <div className="px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 bg-blue-100 text-blue-700">
                <CheckCircle size={14} /> Auto email is ON — every new lead will receive an email automatically
              </div>
            )}
          </div>
        )}
      </div>

      {/* Leads - Desktop Table / Mobile Cards */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">#</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Phone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Source</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Message</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-8 text-gray-400">Loading...</td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-gray-400">
                  <Users size={32} className="mx-auto mb-2 opacity-30" />
                  <p>No leads yet</p>
                  <p className="text-[10px] mt-1">Click "Webhook" to integrate your website forms</p>
                </td></tr>
              ) : leads.map((lead, i) => {
                const sm = STATUS_META[lead.status] || STATUS_META.new;
                return (
                  <tr key={lead.id} className="border-b hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-xs text-gray-400">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{lead.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{lead.phone || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{lead.email || '—'}</td>
                    <td className="px-4 py-3"><span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{lead.source || 'website'}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[150px] truncate">{lead.message || '—'}</td>
                    <td className="px-4 py-3">
                      <select value={lead.status} onChange={e => updateStatus(lead.id, e.target.value)}
                        className={`text-[10px] px-2 py-1 rounded-full font-bold border-0 ${sm.bg} ${sm.text} focus:outline-none cursor-pointer`}>
                        <option value="new">New</option><option value="contacted">Contacted</option><option value="converted">Converted</option><option value="ignored">Ignored</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-[10px] text-gray-400 whitespace-nowrap">{formatTime(lead.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {lead.phone && (<><button onClick={() => openSendModal(lead)} className="p-1.5 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition" title="Send Message"><Send size={12} /></button><button onClick={() => openChatbotModal(lead)} className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 transition" title="Start Chatbot"><Bot size={12} /></button></>)}
                        {lead.email && (<button onClick={() => openEmailModal(lead)} className="p-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition" title="Send Email"><Mail size={12} /></button>)}
                        <button onClick={() => deleteLead(lead.id)} className="p-1.5 bg-red-50 text-red-400 rounded-lg hover:bg-red-100 transition" title="Delete"><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden">
          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : leads.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Users size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No leads yet</p>
            </div>
          ) : leads.map((lead) => {
            const sm = STATUS_META[lead.status] || STATUS_META.new;
            return (
              <div key={lead.id} className="border-b p-3">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-bold text-gray-800">{lead.name || '—'}</p>
                    <p className="text-[10px] text-gray-400 font-mono">{lead.phone || '—'}</p>
                    {lead.email && <p className="text-[10px] text-gray-400">{lead.email}</p>}
                  </div>
                  <select value={lead.status} onChange={e => updateStatus(lead.id, e.target.value)}
                    className={`text-[10px] px-2 py-1 rounded-full font-bold border-0 ${sm.bg} ${sm.text} focus:outline-none`}>
                    <option value="new">New</option><option value="contacted">Contacted</option><option value="converted">Converted</option><option value="ignored">Ignored</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full">{lead.source || 'website'}</span>
                    <span className="text-[9px] text-gray-300">{formatTime(lead.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {lead.phone && (<><button onClick={() => openSendModal(lead)} className="p-1.5 bg-green-100 text-green-600 rounded-lg"><Send size={12} /></button><button onClick={() => openChatbotModal(lead)} className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg"><Bot size={12} /></button></>)}
                    {lead.email && (<button onClick={() => openEmailModal(lead)} className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><Mail size={12} /></button>)}
                    <button onClick={() => deleteLead(lead.id)} className="p-1.5 bg-red-50 text-red-400 rounded-lg"><Trash2 size={12} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Send WhatsApp Modal */}
      {sendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSendModal(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">Send WhatsApp</h3>
              <button onClick={() => setSendModal(null)} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm font-medium">{sendModal.name || 'Unknown'}</p>
                <p className="text-xs text-gray-400">{sendModal.phone}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Message <span className="text-indigo-400">{'{{name}} {{phone}} {{email}} {{message}} {{source}}'}</span>
                </label>
                <textarea value={sendMsg} onChange={e => setSendMsg(e.target.value)}
                  rows={4} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-300 focus:outline-none" />
              </div>
              <button onClick={sendWhatsApp} disabled={sending}
                className="w-full py-2.5 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: currentTheme.primary }}>
                <Send size={14} /> {sending ? 'Sending...' : 'Send WhatsApp'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Send Modal */}
      {bulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setBulkModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">Bulk Send to New Leads ({counts.new})</h3>
              <button onClick={() => setBulkModal(false)} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Message <span className="text-indigo-400">{'{{name}} {{phone}} {{email}} {{source}}'}</span>
                </label>
                <textarea value={bulkMsg} onChange={e => setBulkMsg(e.target.value)}
                  rows={4} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-300 focus:outline-none"
                  placeholder="Hi {{name}}! Thanks for reaching out..." />
              </div>
              <button onClick={bulkSend} disabled={bulkSending || counts.new === 0}
                className="w-full py-2.5 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: currentTheme.primary }}>
                <Send size={14} /> {bulkSending ? 'Sending...' : `Send to ${counts.new} New Leads`}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Chatbot Modal */}
      {chatbotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setChatbotModal(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2"><Bot size={18} className="text-indigo-500" /> Start Chatbot</h3>
              <button onClick={() => setChatbotModal(null)} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm font-medium">{chatbotModal.name || 'Unknown'}</p>
                <p className="text-xs text-gray-400">{chatbotModal.phone} {chatbotModal.email ? `| ${chatbotModal.email}` : ''}</p>
                {chatbotModal.source && <p className="text-[10px] text-indigo-500 mt-1">Source: {chatbotModal.source}</p>}
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Select Chatbot Flow</label>
                <select value={selectedFlowId} onChange={e => handleFlowSelect(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-300 focus:outline-none">
                  <option value="">-- Select Flow --</option>
                  {flows.map(f => (
                    <option key={f.id} value={f.id}>{f.name} {f.is_active ? '(Active)' : ''}</option>
                  ))}
                </select>
              </div>

              {/* Lead Data Tags - draggable */}
              {selectedFlowId && (
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">Lead Data (drag to map)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {leadFieldOptions.filter(f => f.value).map(f => (
                      <span key={f.key}
                        draggable
                        onDragStart={e => { e.dataTransfer.setData('text/plain', f.key + '::' + f.value); e.dataTransfer.effectAllowed = 'copy'; }}
                        className="bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded text-[10px] font-mono cursor-grab active:cursor-grabbing select-none flex items-center gap-1">
                        <span className="font-bold">{f.label}:</span> <span className="text-green-500 max-w-[100px] truncate">{f.value}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Variable Mapping */}
              {selectedFlowId && flowVars.length > 0 && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] text-indigo-600 font-bold">Variable Mapping</p>
                    <button onClick={() => {
                      const updated = { ...savedMappings, [selectedFlowId]: { ...varMapping } };
                      setSavedMappings(updated);
                      localStorage.setItem('wapnix_var_mappings', JSON.stringify(updated));
                      toast.success('Mapping saved permanently!');
                    }} className="text-[10px] bg-indigo-600 text-white px-2 py-1 rounded font-bold hover:bg-indigo-700 flex items-center gap-1">
                      <CheckCircle size={10} /> Save as Default
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {flowVars.map(fv => {
                      const isSaved = savedMappings[selectedFlowId]?.[fv];
                      return (
                        <div key={fv} className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-indigo-500 w-28 shrink-0 truncate">{`{{${fv}}}`}</span>
                          <input
                            value={varMapping[fv] || ''}
                            onChange={e => setVarMapping(prev => ({ ...prev, [fv]: e.target.value }))}
                            placeholder="Type value or drag from above"
                            className={`flex-1 px-2 py-1.5 rounded-lg border text-xs focus:ring-1 focus:ring-indigo-300 focus:outline-none ${
                              varMapping[fv] ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white border-gray-200'
                            }`}
                            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-indigo-400'); }}
                            onDragLeave={e => { e.currentTarget.classList.remove('ring-2', 'ring-indigo-400'); }}
                            onDrop={e => {
                              e.preventDefault();
                              e.currentTarget.classList.remove('ring-2', 'ring-indigo-400');
                              const data = e.dataTransfer.getData('text/plain');
                              const [key, val] = data.split('::');
                              if (val) setVarMapping(prev => ({ ...prev, [fv]: val }));
                            }}
                          />
                          {/* Dropdown */}
                          <select value="" onChange={e => {
                            if (e.target.value) setVarMapping(prev => ({ ...prev, [fv]: e.target.value }));
                          }} className="w-20 px-1 py-1.5 text-[10px] border rounded bg-white focus:outline-none">
                            <option value="">Lead ▾</option>
                            {leadFieldOptions.filter(f => f.value).map(f => (
                              <option key={f.key} value={f.value}>{f.label}</option>
                            ))}
                          </select>
                          {isSaved && <span className="text-[8px] text-indigo-400" title="Saved default">📌</span>}
                        </div>
                      );
                    })}
                  </div>
                  {savedMappings[selectedFlowId] && (
                    <p className="text-[9px] text-green-600 mt-2 flex items-center gap-1">
                      <CheckCircle size={10} /> Default mapping saved — applies to all leads
                    </p>
                  )}
                </div>
              )}

              {selectedFlowId && flowVars.length === 0 && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                  <p className="text-xs text-indigo-600 font-medium">Bot will send the first message and auto-reply to user responses based on the flow steps.</p>
                </div>
              )}
              <button onClick={sendChatbot} disabled={chatbotSending || !selectedFlowId}
                className="w-full py-2.5 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50 bg-indigo-600 hover:bg-indigo-700">
                <Bot size={14} /> {chatbotSending ? 'Starting...' : 'Start Chatbot Flow'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Setup Panel */}
      {showEmailSetup && (
        <div className="bg-white rounded-xl shadow p-4 border-l-4 border-blue-500">
          <h3 className="font-bold text-sm text-gray-800 mb-3 flex items-center gap-2">
            <Mail size={16} className="text-blue-500" /> Email Settings (SMTP)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-gray-400 block mb-0.5">SMTP Host</label>
              <input value={emailSettings.smtp_host} onChange={e => setEmailSettings(p => ({ ...p, smtp_host: e.target.value }))}
                placeholder="smtp.gmail.com" className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-0.5">SMTP Port</label>
              <input type="number" value={emailSettings.smtp_port} onChange={e => setEmailSettings(p => ({ ...p, smtp_port: parseInt(e.target.value) || 587 }))}
                placeholder="587" className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-0.5">SMTP Username (Email)</label>
              <input value={emailSettings.smtp_user} onChange={e => setEmailSettings(p => ({ ...p, smtp_user: e.target.value }))}
                placeholder="you@gmail.com" className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-0.5">SMTP Password / App Password</label>
              <input type="password" value={emailSettings.smtp_pass} onChange={e => setEmailSettings(p => ({ ...p, smtp_pass: e.target.value }))}
                placeholder="App password" className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-0.5">From Name</label>
              <input value={emailSettings.from_name} onChange={e => setEmailSettings(p => ({ ...p, from_name: e.target.value }))}
                placeholder="ONE Group Developers" className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-0.5">From Email</label>
              <input value={emailSettings.from_email} onChange={e => setEmailSettings(p => ({ ...p, from_email: e.target.value }))}
                placeholder="info@onegroup.com" className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-300" />
            </div>
          </div>
          <div className="flex items-center justify-between mt-3">
            <p className="text-[9px] text-gray-400">Gmail: Use App Password (not regular password). Enable 2FA first.</p>
            <button onClick={saveEmailSettings} disabled={savingEmail}
              className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50">
              {savingEmail ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}

      {/* Email Send Modal */}
      {emailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setEmailModal(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2"><Mail size={18} className="text-blue-500" /> Send Email</h3>
              <button onClick={() => setEmailModal(null)} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm font-medium">{emailModal.name || 'Unknown'}</p>
                <p className="text-xs text-gray-400">{emailModal.email}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Subject</label>
                <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none"
                  placeholder="Thank you for your inquiry" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Body <span className="text-blue-400">{'{{greeting}} {{name}} {{email}} {{phone}} {{source}}'}</span>
                </label>
                <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)}
                  rows={6} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none" />
              </div>
              {/* Attachments */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Attachments (Images, PDF, Documents)</label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition">
                    <Mail size={14} className="text-gray-400" />
                    <span className="text-xs text-gray-500">{emailFiles.length > 0 ? `${emailFiles.length} file(s) selected` : 'Click to add files'}</span>
                    <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={e => setEmailFiles(prev => [...prev, ...Array.from(e.target.files || [])])} className="hidden" />
                  </label>
                </div>
                {emailFiles.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {emailFiles.map((f, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 px-2 py-1 rounded text-xs">
                        <span className="truncate flex-1 text-gray-600">{f.name} <span className="text-gray-400">({(f.size / 1024).toFixed(0)} KB)</span></span>
                        <button onClick={() => setEmailFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 ml-2"><X size={12} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={sendEmail} disabled={emailSending}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-blue-700">
                <Mail size={14} /> {emailSending ? 'Sending...' : `Send Email${emailFiles.length > 0 ? ` (${emailFiles.length} attachment${emailFiles.length > 1 ? 's' : ''})` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
