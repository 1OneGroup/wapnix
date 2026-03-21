import { useState, useEffect } from 'react';
import api from '../api/client.js';
import toast from '../utils/notify.js';
import { Key, Copy, RefreshCw, Trash2, Eye, EyeOff, Send, Users, FileText, User, Activity, Shield, Zap } from 'lucide-react';

export default function ApiPage() {
  const [token, setToken] = useState(null);
  const [fullToken, setFullToken] = useState(null);
  const [tokenName, setTokenName] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('send');
  const [publicUrl, setPublicUrl] = useState('');

  useEffect(() => {
    api.get('/apikey').then(res => {
      setToken(res.data.api_key);
      setTokenName(res.data.token_name || '');
      if (res.data.public_url) setPublicUrl(res.data.public_url);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const generateToken = async () => {
    const name = tokenName.trim() || 'default';
    setTokenName(name);
    setGenerating(true);
    try {
      const res = await api.post('/apikey/generate', { token_name: name });
      setFullToken(res.data.api_key);
      setToken(res.data.api_key);
      setShowToken(true);
      toast.success('Access Token created! Copy it now.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate');
    } finally {
      setGenerating(false);
    }
  };

  const revokeToken = async () => {
    if (!confirm('Revoke this Access Token? All integrations (n8n, apps) using this token will stop working immediately.')) return;
    try {
      await api.delete('/apikey');
      setToken(null);
      setFullToken(null);
      setShowToken(false);
      setTokenName('');
      toast.success('Access Token revoked');
    } catch {
      toast.error('Failed to revoke');
    }
  };

  const fallbackCopy = (text) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch {}
    document.body.removeChild(ta);
  };

  const copyToClipboard = (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => toast.success('Copied!')).catch(() => { fallbackCopy(text); toast.success('Copied!'); });
    } else {
      fallbackCopy(text);
      toast.success('Copied!');
    }
  };

  const copyToken = () => {
    const t = fullToken || token;
    if (t) copyToClipboard(t);
  };

  const copyText = (text) => {
    copyToClipboard(text);
  };

  const localUrl = window.location.origin.replace(':5173', ':4000') + '/api/v1';
  const baseUrl = publicUrl ? publicUrl + '/api/v1' : localUrl;

  const endpoints = {
    send: {
      title: 'Send Message',
      icon: Send,
      method: 'POST',
      path: '/send',
      desc: 'Send a WhatsApp message to a single phone number.',
      body: `{
  "phone": "919876543210",
  "message": "Hello {{name}}, your order is ready!"
}`,
      bodyAlt: `// Or use a saved template:
{
  "phone": "919876543210",
  "template_id": 1,
  "variables": { "name": "Rahul" }
}`,
      response: `{
  "success": true,
  "id": 42,
  "phone": "919876543210",
  "status": "queued"
}`,
    },
    bulk: {
      title: 'Bulk Send',
      icon: Users,
      method: 'POST',
      path: '/send-bulk',
      desc: 'Send personalized messages to multiple contacts with per-contact variables.',
      body: `{
  "message": "Hi {{name}}, reminder for {{city}} event!",
  "contacts": [
    { "phone": "919876543210", "name": "Rahul", "city": "Mumbai" },
    { "phone": "918765432109", "name": "Priya", "city": "Delhi" }
  ]
}`,
      bodyAlt: null,
      response: `{
  "success": true,
  "batch_id": "abc-123-def",
  "total": 2, "queued": 2, "failed": 0, "skipped": 0
}`,
    },
    status: {
      title: 'Status',
      icon: Activity,
      method: 'GET',
      path: '/status/:id',
      desc: 'Check delivery status of a message.',
      body: null,
      bodyAlt: null,
      response: `{
  "id": 42, "phone": "919876543210",
  "status": "sent", "sent_at": "2026-03-14T10:30:00Z"
}`,
    },
    batch: {
      title: 'Batch Status',
      icon: Users,
      method: 'GET',
      path: '/batch/:batchId',
      desc: 'Check status of all messages in a bulk batch.',
      body: null,
      bodyAlt: null,
      response: `{
  "batch_id": "abc-123-def",
  "total": 2, "sent": 1, "queued": 1, "failed": 0,
  "messages": [...]
}`,
    },
    templates: {
      title: 'Templates',
      icon: FileText,
      method: 'GET',
      path: '/templates',
      desc: 'Get all saved message templates.',
      body: null,
      bodyAlt: null,
      response: `{
  "templates": [
    { "id": 1, "name": "Welcome", "body": "Hi {{name}}!" }
  ]
}`,
    },
    me: {
      title: 'Account',
      icon: User,
      method: 'GET',
      path: '/me',
      desc: 'Account info, plan limits & WhatsApp connection status.',
      body: null,
      bodyAlt: null,
      response: `{
  "email": "you@example.com",
  "plan": "free",
  "daily_limit": 50,
  "daily_sent": 12,
  "whatsapp_connected": true
}`,
    },
  };

  const ep = endpoints[activeTab];

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;

  return (
    <div>
      <h2 className="text-xl md:text-2xl font-bold mb-1">API Access</h2>
      <p className="text-xs md:text-sm text-gray-400 mb-4 md:mb-6">Connect n8n, Make, Zapier, or any app via HTTP Request</p>

      {/* Access Token Section */}
      <div className="bg-white rounded-xl shadow p-4 md:p-6 mb-4 md:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
              <Shield size={20} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Access Token</h3>
              <p className="text-xs text-gray-400 hidden sm:block">Your secret key for API access - like SSH key for WhatsApp API</p>
            </div>
          </div>
          {token && (
            <div className="flex gap-2">
              <button onClick={revokeToken} className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm">
                <Trash2 size={14} /> Revoke
              </button>
              <button onClick={() => { setToken(null); setFullToken(null); setTokenName(''); }} disabled={generating}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 text-sm">
                <RefreshCw size={14} /> Regen
              </button>
            </div>
          )}
        </div>

        {!token ? (
          <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 p-6">
            <div className="max-w-md mx-auto space-y-4">
              <div className="text-center">
                <Key size={36} className="mx-auto text-gray-300 mb-2" />
                <p className="text-gray-500 text-sm">{fullToken === null ? 'Create an Access Token to use the API' : 'Create a new Access Token'}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Token Name</label>
                <input
                  value={tokenName}
                  onChange={e => setTokenName(e.target.value)}
                  placeholder="e.g. n8n-production, my-crm, test-app"
                  className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <p className="text-[10px] text-gray-400 mt-1">Give it a name so you remember where it's used</p>
              </div>
              <button onClick={generateToken} disabled={generating}
                className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition flex items-center justify-center gap-2">
                <Key size={16} /> {generating ? 'Generating...' : 'Generate Access Token'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {tokenName && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500">Name:</span>
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{tokenName}</span>
              </div>
            )}
            <div className="bg-gray-900 rounded-lg p-4 flex items-center gap-3">
              <code className="flex-1 text-sm text-[var(--color-primary)] font-mono break-all">
                {showToken && fullToken ? fullToken : token}
              </code>
              <button onClick={async () => {
                if (showToken) { setShowToken(false); return; }
                if (fullToken) { setShowToken(true); return; }
                try {
                  const res = await api.get('/apikey/reveal');
                  setFullToken(res.data.api_key);
                  setShowToken(true);
                } catch { toast.error('Failed to reveal token'); }
              }} className="text-gray-400 hover:text-white transition p-1.5" title={showToken ? 'Hide' : 'Show'}>
                {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button onClick={copyToken} className="text-gray-400 hover:text-white transition p-1.5" title="Copy">
                <Copy size={16} />
              </button>
            </div>
            {fullToken && (
              <p className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded flex items-center gap-1.5">
                <Eye size={12} /> Copy now! Full token is only visible once after creation.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Quick Setup for n8n */}
      {token && (
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4 md:p-6 mb-4 md:mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={18} className="text-orange-600" />
            <h3 className="font-semibold text-orange-800">Quick Setup - n8n HTTP Request</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-4 space-y-2.5 border">
              <p className="text-xs font-bold text-gray-700">1. HTTP Request Node Settings</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Method</span>
                  <span className="font-mono bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] px-1.5 py-0.5 rounded">POST</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">URL</span>
                  <button onClick={() => copyText(`${baseUrl}/send`)} className="font-mono text-indigo-600 hover:underline flex items-center gap-1">
                    {baseUrl}/send <Copy size={10} />
                  </button>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 space-y-2.5 border">
              <p className="text-xs font-bold text-gray-700">2. Authentication</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Auth Type</span>
                  <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">Generic Credential → Header Auth</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Header Name</span>
                  <button onClick={() => copyText('X-API-Key')} className="font-mono text-indigo-600 hover:underline flex items-center gap-1">
                    X-API-Key <Copy size={10} />
                  </button>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Header Value</span>
                  <button onClick={copyToken} className="font-mono text-indigo-600 hover:underline flex items-center gap-1">
                    your_token <Copy size={10} />
                  </button>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 space-y-2.5 border md:col-span-2">
              <p className="text-xs font-bold text-gray-700">3. Body (JSON)</p>
              <div className="bg-gray-900 rounded p-3 relative group">
                <button onClick={() => copyText(`{ "phone": "{{$json.phone}}", "message": "Hi {{$json.name}}! Your message here." }`)}
                  className="absolute top-1.5 right-1.5 text-gray-500 hover:text-white p-1 opacity-0 group-hover:opacity-100 transition">
                  <Copy size={12} />
                </button>
                <pre className="text-[var(--color-primary)] text-xs font-mono">{`{
  "phone": "{{$json.phone}}",
  "message": "Hi {{$json.name}}! Your message here."
}`}</pre>
              </div>
              <p className="text-[10px] text-orange-600">Use n8n expressions like {`{{$json.phone}}`} to map data from previous nodes (Google Sheets, etc.)</p>
            </div>
          </div>
        </div>
      )}

      {/* Authentication Methods */}
      <div className="bg-white rounded-xl shadow p-4 md:p-6 mb-4 md:mb-6">
        <h3 className="font-semibold text-gray-800 mb-3">Authentication Methods</h3>
        <p className="text-sm text-gray-500 mb-3">Pass your Access Token in any HTTP request using:</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-gray-900 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-400">Header (recommended)</p>
              <button onClick={() => copyText('X-API-Key')} className="text-gray-500 hover:text-white p-1"><Copy size={11} /></button>
            </div>
            <code className="text-sm text-[var(--color-primary)] font-mono">X-API-Key: your_access_token</code>
          </div>
          <div className="bg-gray-900 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-400">Query parameter</p>
              <button onClick={() => copyText(`${baseUrl}/send?api_key=YOUR_TOKEN`)} className="text-gray-500 hover:text-white p-1"><Copy size={11} /></button>
            </div>
            <code className="text-sm text-[var(--color-primary)] font-mono text-[11px]">?api_key=your_access_token</code>
          </div>
        </div>
      </div>

      {/* API Endpoints */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="px-4 md:px-6 pt-4 md:pt-5 pb-0">
          <h3 className="font-semibold text-gray-800 mb-3">API Endpoints</h3>
        </div>
        <div className="flex border-b overflow-x-auto px-2 scrollbar-none">
          {Object.entries(endpoints).map(([key, val]) => {
            const Icon = val.icon;
            return (
              <button key={key} onClick={() => setActiveTab(key)}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition ${
                  activeTab === key
                    ? 'border-indigo-600 text-indigo-600 bg-indigo-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}>
                <Icon size={13} /> {val.title}
              </button>
            );
          })}
        </div>

        <div className="p-4 md:p-6 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                ep.method === 'POST' ? 'bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]' : 'bg-blue-100 text-blue-700'
              }`}>{ep.method}</span>
              <code className="text-sm font-mono text-gray-700">{baseUrl}{ep.path}</code>
              <button onClick={() => copyText(`${baseUrl}${ep.path}`)} className="text-gray-300 hover:text-gray-600 p-0.5"><Copy size={12} /></button>
            </div>
            <p className="text-sm text-gray-500">{ep.desc}</p>
          </div>

          {ep.body && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1.5">Request Body</p>
              <div className="bg-gray-900 rounded-lg p-4 relative group">
                <button onClick={() => copyText(ep.body)} className="absolute top-2 right-2 text-gray-500 hover:text-white p-1 opacity-0 group-hover:opacity-100 transition">
                  <Copy size={12} />
                </button>
                <pre className="text-[var(--color-primary)] text-xs font-mono overflow-x-auto">{ep.body}</pre>
              </div>
              {ep.bodyAlt && (
                <pre className="bg-gray-800 text-gray-400 rounded-b-lg p-3 text-xs font-mono overflow-x-auto -mt-1 border-t border-gray-700">{ep.bodyAlt}</pre>
              )}
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-gray-600 mb-1.5">Response</p>
            <pre className="bg-gray-900 text-blue-400 rounded-lg p-4 text-xs font-mono overflow-x-auto">{ep.response}</pre>
          </div>

          {/* cURL */}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-1.5">cURL</p>
            <div className="bg-gray-900 rounded-lg p-4 relative group">
              <button onClick={() => {
                const curl = ep.method === 'POST'
                  ? `curl -X POST ${baseUrl}${ep.path} -H "X-API-Key: YOUR_TOKEN" -H "Content-Type: application/json" -d '{"phone":"919876543210","message":"Hello!"}'`
                  : `curl ${baseUrl}${ep.path.replace(':id', '42').replace(':batchId', 'abc-123')} -H "X-API-Key: YOUR_TOKEN"`;
                copyText(curl);
              }} className="absolute top-2 right-2 text-gray-500 hover:text-white p-1 opacity-0 group-hover:opacity-100 transition">
                <Copy size={12} />
              </button>
              <pre className="text-yellow-400 text-xs font-mono overflow-x-auto whitespace-pre-wrap">{
                ep.method === 'POST'
                  ? `curl -X POST ${baseUrl}${ep.path} \\\n  -H "X-API-Key: YOUR_TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d '{"phone":"919876543210","message":"Hello!"}'`
                  : `curl ${baseUrl}${ep.path.replace(':id', '42').replace(':batchId', 'abc-123')} \\\n  -H "X-API-Key: YOUR_TOKEN"`
              }</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
