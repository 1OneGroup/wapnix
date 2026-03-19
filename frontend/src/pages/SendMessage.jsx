import { useState, useEffect, useRef } from 'react';
import api from '../api/client.js';
import toast from '../utils/notify.js';
import { useSettings } from '../context/SettingsContext.jsx';
import { Send, Users, Upload, FileSpreadsheet, Trash2, RefreshCw, CheckCircle, XCircle, Clock, GripVertical, Play, X, Pause, ImagePlus } from 'lucide-react';

function normPhone(p) {
  let d = String(p || '').replace(/[^0-9]/g, '');
  if (d.startsWith('0')) d = d.slice(1);
  if (d && !d.startsWith('91')) d = '91' + d;
  return d;
}

// ── Single Message Tab ──
function SingleMessage({ templates }) {
  const { currentTheme } = useSettings();
  const [phone, setPhone] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [message, setMessage] = useState('');
  const [variables, setVariables] = useState({});
  const [templateVars, setTemplateVars] = useState([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [images, setImages] = useState([]); // { url, filename, preview }
  const [uploading, setUploading] = useState(false);
  const imgRef = useRef(null);

  const handleTemplateChange = (id) => {
    setSelectedTemplate(id);
    if (id) {
      const tpl = templates.find((t) => t.id === parseInt(id));
      if (tpl) {
        setMessage(tpl.body);
        const vars = JSON.parse(tpl.variables || '[]');
        setTemplateVars(vars);
        const initial = {};
        vars.forEach((v) => (initial[v] = ''));
        setVariables(initial);
        // Load template media if any
        try {
          const media = JSON.parse(tpl.media || '[]');
          if (media.length > 0) setImages(media.map(m => ({ url: m.url, filename: m.filename, preview: m.url })));
        } catch {}
      }
    } else {
      setTemplateVars([]);
      setVariables({});
    }
  };

  const handleImageUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of files) {
      const form = new FormData();
      form.append('image', file);
      try {
        const res = await api.post('/messages/upload-image', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setImages(prev => [...prev, { url: res.data.url, filename: res.data.filename, preview: res.data.url }]);
      } catch (err) {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    setUploading(false);
    e.target.value = '';
  };

  const removeImage = async (idx) => {
    const img = images[idx];
    try { await api.delete(`/messages/upload-image/${img.filename}`); } catch {}
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSend = async () => {
    if (!phone) return toast.error('Phone number required');
    if (!message) return toast.error('Message required');
    setSending(true);
    setResult(null);
    try {
      const payload = {
        phone,
        message: selectedTemplate ? undefined : message,
        template_id: selectedTemplate || undefined,
        variables: templateVars.length > 0 ? variables : undefined,
      };
      if (images.length > 0) {
        payload.media = images.map(img => ({ url: img.url, filename: img.filename, caption: '' }));
      }
      const res = await api.post('/messages/send', payload);
      setResult(res.data);
      toast.success('Message queued!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Phone input with icon */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Recipient</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">+</span>
          <input
            placeholder="919876543210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full pl-7 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:border-[var(--color-primary-ring)] focus:outline-none text-sm font-mono bg-gray-50/50"
          />
        </div>
      </div>

      {/* Template selector */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Template</label>
        <select
          value={selectedTemplate}
          onChange={(e) => handleTemplateChange(e.target.value)}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:border-[var(--color-primary-ring)] focus:outline-none text-sm bg-gray-50/50"
        >
          <option value="">Write custom message</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Template variables */}
      {templateVars.length > 0 && (
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Variables</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {templateVars.map((v) => (
              <input
                key={v}
                placeholder={`{{${v}}}`}
                value={variables[v] || ''}
                onChange={(e) => setVariables({ ...variables, [v]: e.target.value })}
                className="px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:outline-none text-sm bg-gray-50/50"
              />
            ))}
          </div>
        </div>
      )}

      {/* Message textarea */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Message</label>
        <textarea
          placeholder="Type your message..."
          value={message}
          onChange={(e) => { setMessage(e.target.value); if (selectedTemplate) setSelectedTemplate(''); }}
          rows={4}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:border-[var(--color-primary-ring)] focus:outline-none text-sm bg-gray-50/50 resize-none"
        />
        {message && (
          <p className="text-[11px] text-gray-400 mt-1 text-right">{message.length} characters</p>
        )}
      </div>

      {/* Image upload + previews */}
      <div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => imgRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 text-gray-500 rounded-xl hover:border-[var(--color-primary-medium)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-sm font-medium transition disabled:opacity-50"
          >
            <ImagePlus size={16} />
            {uploading ? 'Uploading...' : 'Attach Images'}
          </button>
          <input ref={imgRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
          {images.length > 0 && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">{images.length} image{images.length > 1 ? 's' : ''}</span>
          )}
        </div>
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2.5 mt-3">
            {images.map((img, idx) => (
              <div key={idx} className="relative group w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 border-gray-200 shadow-sm">
                <img src={img.preview} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(idx)}
                  className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* WhatsApp preview bubble */}
      {message && phone && (
        <div className="bg-[#e5ddd5] rounded-xl p-3 sm:p-4">
          <p className="text-[10px] text-gray-500 mb-2">Preview</p>
          <div className="flex justify-end">
            <div className="bg-[#dcf8c6] rounded-xl rounded-tr-sm px-3 py-2 max-w-[85%] shadow-sm">
              <p className="text-xs sm:text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{message}</p>
              <p className="text-[9px] text-gray-400 text-right mt-1">now</p>
            </div>
          </div>
        </div>
      )}

      {/* Send button */}
      <button
        onClick={handleSend}
        disabled={sending || !message}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 sm:py-3.5 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-[var(--color-primary-medium)] text-sm sm:text-base"
        style={{ background: `linear-gradient(to right, ${currentTheme.primary}, ${currentTheme.dark})` }}
      >
        <Send size={18} />
        {sending ? 'Sending...' : images.length > 0 ? `Send with ${images.length} Image${images.length > 1 ? 's' : ''}` : 'Send Message'}
      </button>

      {/* Result */}
      {result && (
        <div className="flex items-center gap-3 p-4 bg-[var(--color-primary-light)] border border-[var(--color-primary-medium)] rounded-xl">
          <CheckCircle size={20} className="text-[var(--color-primary)] shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-[var(--color-primary-dark)]">Message queued successfully</p>
            <p className="text-[var(--color-primary)] text-xs mt-0.5">To: {result.phone} | ID: {result.id}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Bulk CSV Message Tab ──
function BulkCSVMessage({ templates }) {
  const { currentTheme } = useSettings();
  const saved = useRef(null);
  if (!saved.current) {
    try { saved.current = JSON.parse(localStorage.getItem('send_bulk_sheet') || 'null'); } catch { saved.current = null; }
  }

  const [contacts, setContacts] = useState(saved.current?.contacts || []);
  const [columns, setColumns] = useState(saved.current?.columns || []);
  const [phoneCol, setPhoneCol] = useState(saved.current?.phoneCol || '');
  const [message, setMessage] = useState(saved.current?.message || '');
  const [sending, setSending] = useState(false);
  const [batchId, setBatchId] = useState(saved.current?.batchId || null);
  const [batchStatus, setBatchStatus] = useState(null);
  const [statusMap, setStatusMap] = useState({});
  const [selected, setSelected] = useState(() => new Set((saved.current?.contacts || []).map((_, i) => i)));
  const [dragging, setDragging] = useState(false);
  const [dragRowIdx, setDragRowIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const fileRef = useRef(null);
  const pollRef = useRef(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (contacts.length > 0) {
      const toSave = { contacts: contacts.slice(0, 500), columns, message, batchId, phoneCol };
      try { localStorage.setItem('send_bulk_sheet', JSON.stringify(toSave)); } catch {}
    } else {
      localStorage.removeItem('send_bulk_sheet');
    }
  }, [contacts, columns, message, batchId, phoneCol]);

  useEffect(() => {
    if (batchId) startPolling(batchId);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) { toast.error('CSV must have header + data rows'); return; }
    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    const phoneIdx = headers.findIndex(h => /phone|mobile|number|whatsapp/i.test(h));
    if (phoneIdx === -1) { toast.error('No phone/mobile/number column found'); return; }

    const cols = headers.map(h => h.toLowerCase().replace(/\s+/g, '_'));
    const detectedPhoneCol = cols[phoneIdx];
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
      if (!vals[phoneIdx]) continue;
      const row = {};
      cols.forEach((h, j) => { row[h] = vals[j] || ''; });
      rows.push(row);
    }
    setColumns(cols);
    setPhoneCol(detectedPhoneCol);
    setContacts(rows);
    setSelected(new Set(rows.map((_, i) => i)));
    setBatchId(null);
    setBatchStatus(null);
    setStatusMap({});
    toast.success(`Loaded ${rows.length} contacts`);
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => parseCSV(ev.target.result);
    reader.readAsText(file);
    e.target.value = '';
  }

  function handlePaste(e) {
    const text = e.clipboardData?.getData('text');
    if (text && text.includes(',') && text.includes('\n')) {
      e.preventDefault();
      parseCSV(text);
    }
  }

  function startPolling(bid) {
    if (pollRef.current) clearInterval(pollRef.current);
    const poll = async () => {
      try {
        const res = await api.get(`/messages/bulk-status/${bid}`);
        setBatchStatus(res.data.summary);
        const map = {};
        res.data.messages.forEach(m => { map[m.phone] = m.status; });
        setStatusMap(map);
        if (res.data.summary.queued === 0) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setSending(false);
          setPaused(false);
        }
      } catch {}
    };
    poll();
    pollRef.current = setInterval(poll, 3000);
  }

  function toggleSelect(idx) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === contacts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(contacts.map((_, i) => i)));
    }
  }

  // Get phone value from the mapped column
  function getPhone(c) {
    return c[phoneCol] || c.phone || c.mobile || '';
  }

  // Drag-and-drop row reordering
  function handleRowDragStart(e, idx) {
    setDragRowIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', idx);
  }
  function handleRowDragOver(e, idx) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (idx !== dragOverIdx) setDragOverIdx(idx);
  }
  function handleRowDrop(e, dropIdx) {
    e.preventDefault();
    if (dragRowIdx === null || dragRowIdx === dropIdx) {
      setDragRowIdx(null);
      setDragOverIdx(null);
      return;
    }
    const newContacts = [...contacts];
    const [moved] = newContacts.splice(dragRowIdx, 1);
    newContacts.splice(dropIdx, 0, moved);
    // Rebuild selection to follow moved rows
    const oldArr = [...contacts];
    const newSelected = new Set();
    newContacts.forEach((c, i) => {
      const oldIdx = oldArr.indexOf(c);
      if (selected.has(oldIdx)) newSelected.add(i);
    });
    setContacts(newContacts);
    setSelected(newSelected);
    setDragRowIdx(null);
    setDragOverIdx(null);
  }
  function handleRowDragEnd() {
    setDragRowIdx(null);
    setDragOverIdx(null);
  }

  async function handleStartSending() {
    if (!message.trim()) return toast.error('Enter a message');
    if (!phoneCol) return toast.error('Select phone column');
    const selectedContacts = contacts.filter((_, i) => selected.has(i));
    if (selectedContacts.length === 0) return toast.error('Select contacts first');
    setSending(true);
    setPaused(false);
    try {
      const usedVars = [...new Set([...message.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]))];
      const minContacts = selectedContacts.map(c => {
        const min = { phone: getPhone(c) };
        usedVars.forEach(v => { if (c[v] !== undefined) min[v] = c[v]; });
        if (c.name && !min.name) min.name = c.name;
        if (c.fullname && !min.name) min.name = c.fullname;
        return min;
      });
      const res = await api.post('/messages/send-bulk', { contacts: minContacts, message });
      setBatchId(res.data.batch_id);
      toast.success(`${res.data.queued} messages queued (via bridge)!`);
      startPolling(res.data.batch_id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Send failed');
      setSending(false);
    }
  }

  async function handlePauseSending() {
    try {
      await api.post('/messages/bulk-pause');
      setPaused(true);
      toast('Sending paused');
    } catch { toast.error('Pause failed'); }
  }

  async function handleResumeSending() {
    try {
      await api.post('/messages/bulk-resume');
      setPaused(false);
      toast.success('Sending resumed!');
    } catch { toast.error('Resume failed'); }
  }

  async function handleCancelSending() {
    if (!confirm('Sab queued messages cancel kar dein?')) return;
    try {
      await api.post('/messages/bulk-cancel', { batch_id: batchId });
      setSending(false);
      setPaused(false);
      toast('Queued messages cancelled');
      if (batchId) startPolling(batchId);
    } catch { toast.error('Cancel failed'); }
  }

  function clearAll() {
    setContacts([]); setColumns([]); setBatchId(null); setBatchStatus(null);
    setStatusMap({}); setSending(false); setMessage(''); setSelected(new Set()); setPhoneCol('');
    localStorage.removeItem('send_bulk_sheet');
  }

  const [varOrder, setVarOrder] = useState([]);
  const [dragVarIdx, setDragVarIdx] = useState(null);
  const [dragVarOverIdx, setDragVarOverIdx] = useState(null);
  const msgRef = useRef(null);

  // Keep varOrder in sync with columns changes
  useEffect(() => {
    const avail = columns.filter(c => c !== phoneCol);
    setVarOrder(prev => {
      const kept = prev.filter(v => avail.includes(v));
      const added = avail.filter(v => !kept.includes(v));
      return [...kept, ...added];
    });
  }, [columns, phoneCol]);

  const availableVars = varOrder.length > 0 ? varOrder : columns.filter(c => c !== phoneCol);
  const statusIcon = (st) => {
    if (st === 'sent') return <CheckCircle size={14} className="text-[var(--color-primary)]" />;
    if (st === 'failed') return <XCircle size={14} className="text-red-500" />;
    if (st === 'queued') return <Clock size={14} className="text-yellow-500 animate-pulse" />;
    return <span className="w-3.5 h-3.5 rounded-full bg-gray-200 inline-block" />;
  };

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Upload area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm text-gray-700">
            {contacts.length === 0 ? 'Upload Contacts CSV' : `${contacts.length} contacts loaded`}
          </h3>
          {contacts.length > 0 && <p className="text-xs text-gray-400 truncate">{columns.join(', ')}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          {contacts.length > 0 && (
            <button onClick={clearAll} className="flex items-center gap-1 px-3 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 text-sm">
              <Trash2 size={14} /> Clear
            </button>
          )}
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-3 md:px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-sm font-medium">
            <Upload size={16} /> {contacts.length > 0 ? 'Re-upload' : 'Choose CSV'}
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
      </div>

      {contacts.length === 0 && (
        <div
          onPaste={handlePaste}
          tabIndex={0}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = (ev) => parseCSV(ev.target.result);
              reader.readAsText(file);
            }
          }}
          className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all focus:outline-none ${
            dragging
              ? 'border-indigo-500 bg-indigo-50 scale-[1.01]'
              : 'border-gray-300 hover:border-indigo-400'
          }`}
          onClick={() => fileRef.current?.click()}>
          <Upload size={40} className={`mx-auto mb-3 transition ${dragging ? 'text-indigo-500 animate-bounce' : 'text-gray-300'}`} />
          <p className={`text-sm font-medium ${dragging ? 'text-indigo-600' : 'text-gray-500'}`}>
            {dragging ? 'Drop CSV file here!' : 'Drag & drop CSV file here'}
          </p>
          <p className="text-gray-400 text-xs mt-1">or click to browse, or paste data (Ctrl+V)</p>
          <div className="mt-4 inline-block bg-gray-100 rounded-lg px-4 py-2">
            <p className="text-gray-400 text-xs font-mono">name, phone, city</p>
            <p className="text-gray-400 text-xs font-mono">Rahul, 919876543210, Mumbai</p>
          </div>
        </div>
      )}

      {/* Phone column + Template selector */}
      {contacts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
            <span className="text-xs font-semibold text-blue-800">Phone Column:</span>
            <select value={phoneCol} onChange={e => setPhoneCol(e.target.value)}
              className="text-xs border rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white">
              {columns.map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
            <span className="text-[10px] text-blue-500">Select which column has phone numbers</span>
          </div>
          {templates.length > 0 && (
            <div className="flex items-center gap-3 bg-[var(--color-primary-light)] border border-[var(--color-primary-medium)] rounded-lg px-4 py-2.5">
              <span className="text-xs font-semibold text-[var(--color-primary-dark)]">Template:</span>
              <select
                onChange={(e) => {
                  const tpl = templates.find(t => t.id === parseInt(e.target.value));
                  if (tpl) {
                    setMessage(tpl.body);
                    setSelected(new Set(contacts.map((_, i) => i))); // auto-select all
                    toast.success(`Template loaded: ${tpl.name}`);
                  }
                }}
                className="flex-1 text-xs border rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-[var(--color-primary-ring)] focus:outline-none bg-white"
              >
                <option value="">-- Select template to load message --</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name} - {t.body.slice(0, 50)}...</option>
                ))}
              </select>
            </div>
          )}
          {message && (
            <div className="bg-gray-50 border rounded-lg px-4 py-2.5">
              <p className="text-[10px] text-gray-400 mb-1">Current Message:</p>
              <p className="text-xs text-gray-700 whitespace-pre-wrap line-clamp-2">{message}</p>
            </div>
          )}
        </div>
      )}

      {/* Sheet preview */}
      {contacts.length > 0 && (
        <div className="rounded-xl shadow overflow-hidden border border-gray-200">
          <div className="flex items-center justify-between px-4 py-2.5 bg-indigo-50 border-b">
            <h3 className="font-semibold text-xs flex items-center gap-2 text-indigo-800">
              <FileSpreadsheet size={14} /> {selected.size} / {contacts.length} selected
            </h3>
            <div className="flex gap-2 items-center">
              {batchId && (
                <button onClick={() => startPolling(batchId)} className="text-xs text-indigo-600 flex items-center gap-1">
                  <RefreshCw size={12} /> Refresh
                </button>
              )}
              {sending && (
                <span className="text-xs bg-yellow-500 text-white px-2.5 py-1 rounded-full font-medium flex items-center gap-1 animate-pulse">
                  <RefreshCw size={10} className="animate-spin" /> Sending...
                </span>
              )}
            </div>
          </div>
          <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-100 border-b">
                  <th className="px-1.5 py-2 w-7"></th>
                  <th className="px-3 py-2 text-center w-10">
                    <input type="checkbox" checked={selected.size === contacts.length && contacts.length > 0}
                      onChange={toggleSelectAll} className="accent-indigo-600" />
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-10">#</th>
                  {columns.map(col => (
                    <th key={col} className={`px-3 py-2 text-left text-xs font-semibold whitespace-nowrap ${col === phoneCol ? 'text-blue-600 bg-blue-50' : 'text-gray-500'}`}>
                      {col.toUpperCase()} {col === phoneCol && <span className="text-[9px]">(PHONE)</span>}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-24">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c, i) => {
                  const ph = getPhone(c);
                  const np = normPhone(ph);
                  const st = statusMap[np] || statusMap[ph];
                  const isSelected = selected.has(i);
                  const isDraggedOver = dragOverIdx === i && dragRowIdx !== i;
                  return (
                    <tr key={i}
                      draggable
                      onDragStart={(e) => handleRowDragStart(e, i)}
                      onDragOver={(e) => handleRowDragOver(e, i)}
                      onDrop={(e) => handleRowDrop(e, i)}
                      onDragEnd={handleRowDragEnd}
                      className={`border-b hover:bg-gray-50 transition-all ${
                        dragRowIdx === i ? 'opacity-30' : ''
                      } ${isDraggedOver ? 'border-t-2 border-t-indigo-500' : ''} ${
                        st === 'failed' ? 'bg-red-50' : st === 'sent' ? 'bg-[var(--color-primary-light)]' : isSelected ? '' : 'opacity-40'
                      }`}>
                      <td className="px-1.5 py-1.5 text-center cursor-grab active:cursor-grabbing">
                        <GripVertical size={14} className="text-gray-300 hover:text-gray-500" />
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(i)} className="accent-indigo-600" />
                      </td>
                      <td className="px-3 py-1.5 text-xs text-gray-400">{i + 1}</td>
                      {columns.map(col => (
                        <td key={col} className={`px-3 py-1.5 text-xs whitespace-nowrap max-w-[200px] truncate ${col === phoneCol ? 'font-medium text-blue-700' : ''}`}>{c[col]}</td>
                      ))}
                      <td className="px-3 py-1.5">
                        <span className="flex items-center gap-1 text-xs">{statusIcon(st)} {st || '-'}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Message composer */}
      {contacts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-gray-700">Compose Message</h3>
          </div>

          {/* Template selector */}
          {templates.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-gray-500">Template:</span>
              <select
                onChange={(e) => {
                  const tpl = templates.find(t => t.id === parseInt(e.target.value));
                  if (tpl) setMessage(tpl.body);
                  e.target.value = '';
                }}
                className="flex-1 text-xs border rounded-lg px-3 py-2 focus:ring-1 focus:ring-[var(--color-primary-ring)] focus:outline-none bg-white"
              >
                <option value="">-- Select template to load --</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name} - {t.body.slice(0, 60)}...</option>
                ))}
              </select>
            </div>
          )}

          {/* Variable mapping - drag to reorder or drag into message */}
          {availableVars.length > 0 && (
            <div className="bg-gray-50 border rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-600">Sheet Columns (drag to reorder, click or drag into message):</p>
              <div className="flex flex-wrap gap-2">
                {availableVars.map((v, vi) => {
                  const sample = (contacts.find((_, i) => selected.has(i)) || contacts[0])?.[v] || '';
                  const isUsed = message.includes(`{{${v}}}`);
                  const isDragOver = dragVarOverIdx === vi && dragVarIdx !== vi;
                  return (
                    <div key={v}
                      draggable
                      onDragStart={(e) => {
                        setDragVarIdx(vi);
                        e.dataTransfer.effectAllowed = 'copyMove';
                        e.dataTransfer.setData('text/plain', `{{${v}}}`);
                      }}
                      onDragOver={(e) => { e.preventDefault(); if (vi !== dragVarOverIdx) setDragVarOverIdx(vi); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragVarIdx !== null && dragVarIdx !== vi) {
                          const newOrder = [...availableVars];
                          const [moved] = newOrder.splice(dragVarIdx, 1);
                          newOrder.splice(vi, 0, moved);
                          setVarOrder(newOrder);
                        }
                        setDragVarIdx(null);
                        setDragVarOverIdx(null);
                      }}
                      onDragEnd={() => { setDragVarIdx(null); setDragVarOverIdx(null); }}
                      onClick={() => setMessage(prev => prev + `{{${v}}}`)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border cursor-grab active:cursor-grabbing select-none transition-all ${
                        dragVarIdx === vi ? 'opacity-30 scale-95' : ''
                      } ${isDragOver ? 'ring-2 ring-indigo-400 scale-105' : ''} ${
                        isUsed
                          ? 'bg-[var(--color-primary-light)] border-[var(--color-primary-medium)] text-[var(--color-primary-dark)]'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300 hover:bg-indigo-50'
                      }`}>
                      <GripVertical size={12} className="text-gray-300 shrink-0" />
                      <div className="flex flex-col items-start">
                        <span className="font-mono font-semibold">{`{{${v}}}`}</span>
                        {sample && <span className="text-[10px] text-gray-400 truncate max-w-[120px]">e.g. {sample}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {availableVars.some(v => message.includes(`{{${v}}}`)) && (
                <p className="text-[10px] text-[var(--color-primary)]">Highlighted = used in message. Each contact will get their own data from the sheet.</p>
              )}
            </div>
          )}

          <textarea ref={msgRef} value={message} onChange={(e) => setMessage(e.target.value)} rows={4} disabled={sending}
            placeholder="Type your message... Use {{fullname}}, {{email}} etc. from sheet columns above"
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
            onDrop={(e) => {
              e.preventDefault();
              const varText = e.dataTransfer.getData('text/plain');
              if (varText && varText.startsWith('{{')) {
                const ta = msgRef.current;
                const pos = ta?.selectionStart ?? message.length;
                setMessage(prev => prev.slice(0, pos) + varText + prev.slice(pos));
                setDragVarIdx(null);
                setDragVarOverIdx(null);
              }
            }}
            className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:outline-none font-mono disabled:bg-gray-50" />

          {/* Preview - show first 2 selected contacts */}
          {message && contacts.length > 0 && (() => {
            const previewContacts = contacts.filter((_, i) => selected.has(i)).slice(0, 2);
            if (previewContacts.length === 0) previewContacts.push(contacts[0]);
            return (
              <div className="bg-[#e5ddd5] rounded-lg p-3 space-y-2">
                <p className="text-[10px] text-gray-500">Message preview (per contact):</p>
                {previewContacts.map((c, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-[10px] text-gray-400 mt-1.5 shrink-0">{c.fullname || c.name || getPhone(c)}:</span>
                    <div className="bg-white rounded-lg rounded-tl-none px-3 py-2 max-w-[85%] shadow-sm">
                      <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {message.replace(/\{\{(\w+)\}\}/g, (_, key) => c[key] || `{{${key}}}`)}
                      </p>
                    </div>
                  </div>
                ))}
                {selected.size > 2 && <p className="text-[10px] text-gray-400">...and {selected.size - 2} more</p>}
              </div>
            );
          })()}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t">
            <div className="flex items-center gap-2 md:gap-3 flex-wrap">
              <p className="text-sm text-gray-500">{selected.size} of {contacts.length} selected</p>
              {batchStatus && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="flex items-center gap-1 bg-[var(--color-primary-medium)] text-[var(--color-primary-dark)] px-2 py-0.5 rounded-full font-medium">
                    <CheckCircle size={10} /> {batchStatus.sent}
                  </span>
                  {batchStatus.queued > 0 && (
                    <span className="flex items-center gap-1 bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium animate-pulse">
                      <Clock size={10} /> {batchStatus.queued}
                    </span>
                  )}
                  {batchStatus.failed > 0 && (
                    <span className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                      <XCircle size={10} /> {batchStatus.failed}
                    </span>
                  )}
                </div>
              )}
              {sending && paused && (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">Paused</span>
              )}
            </div>
            <div className="flex gap-2">
              {!sending ? (
                <button onClick={handleStartSending} disabled={!message.trim() || selected.size === 0}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 text-white rounded-xl font-semibold disabled:opacity-50 transition shadow-lg shadow-[var(--color-primary-medium)] text-sm"
                  style={{ background: `linear-gradient(to right, ${currentTheme.primary}, ${currentTheme.dark})` }}>
                  <Send size={16} /> Send to {selected.size}
                </button>
              ) : (
                <>
                  {!paused ? (
                    <button onClick={handlePauseSending}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-yellow-500 text-white rounded-xl font-medium hover:bg-yellow-600 transition text-sm">
                      <Pause size={14} /> Pause
                    </button>
                  ) : (
                    <button onClick={handleResumeSending}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-[var(--color-primary)] text-white rounded-xl font-medium hover:bg-[var(--color-primary-dark)] transition text-sm animate-pulse">
                      <Play size={14} /> Resume
                    </button>
                  )}
                  <button onClick={handleCancelSending}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition text-sm">
                    <X size={14} /> Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Batch status */}
      {batchStatus && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 sm:p-4 text-center">
            <p className="text-xl sm:text-2xl font-bold text-gray-600">{batchStatus.total}</p>
            <p className="text-[10px] sm:text-xs text-gray-400">Total</p>
          </div>
          <div className="bg-[var(--color-primary-light)] border border-[var(--color-primary-medium)] rounded-xl p-3 sm:p-4 text-center">
            <p className="text-xl sm:text-2xl font-bold text-[var(--color-primary)]">{batchStatus.sent}</p>
            <p className="text-[10px] sm:text-xs text-gray-400">Sent</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 sm:p-4 text-center">
            <p className="text-xl sm:text-2xl font-bold text-red-600">{batchStatus.failed}</p>
            <p className="text-[10px] sm:text-xs text-gray-400">Failed</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 sm:p-4 text-center">
            <p className="text-xl sm:text-2xl font-bold text-yellow-600">{batchStatus.queued}</p>
            <p className="text-[10px] sm:text-xs text-gray-400">Queued</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──
export default function SendMessage() {
  const { currentTheme } = useSettings();
  const [mode, setMode] = useState('single');
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    api.get('/templates').then((res) => setTemplates(res.data.templates));
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Send Message</h2>

      {/* Mode tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-4 md:mb-6">
        <button onClick={() => setMode('single')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 rounded-lg font-medium transition text-sm ${mode === 'single' ? 'bg-white text-[var(--color-primary)] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <Send size={16} />
          <span>Single</span>
        </button>
        <button onClick={() => setMode('bulk')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 rounded-lg font-medium transition text-sm ${mode === 'bulk' ? 'bg-white text-[var(--color-primary)] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <Users size={16} />
          <span>Bulk CSV</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 md:p-8">
        {mode === 'single' ? <SingleMessage templates={templates} /> : <BulkCSVMessage templates={templates} />}
      </div>
    </div>
  );
}
