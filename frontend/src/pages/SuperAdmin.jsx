import { useState, useEffect, useMemo } from 'react';
import { useSettings } from '../context/SettingsContext.jsx';
import api from '../api/client.js';
import toast from '../utils/notify.js';
import {
  Users, Shield, CheckCircle, XCircle, Send, X,
  UserCheck, UserX, ToggleLeft, ToggleRight, RefreshCw,
  Key, Copy, Trash2, LogIn, Lock, Eye, EyeOff,
  BarChart3, TrendingUp, MessageSquare, Contact,
  FileText, Activity, ChevronDown, ChevronUp, Search,
  Smartphone, Zap, Crown, Star, Rocket, Infinity,
  IndianRupee,
} from 'lucide-react';

const PAGE_LABELS = {
  dashboard: 'Dashboard',
  device: 'Device Link',
  templates: 'Templates',
  website: 'Contacts',
  send: 'Send Message',
  chatbot: 'Chatbot Builder',
  api: 'API Access',
};

const PLAN_META = {
  free:     { icon: Zap,    color: '#6b7280', label: 'Free' },
  starter:  { icon: Star,   color: '#3b82f6', label: 'Starter' },
  pro:      { icon: Rocket, color: '#8b5cf6', label: 'Pro' },
  business: { icon: Crown,  color: '#f59e0b', label: 'Business' },
};

function formatLimit(val) {
  if (val === -1 || val >= 999999) return 'Unlimited';
  return val?.toLocaleString('en-IN') || '0';
}

export default function SuperAdmin() {
  const { currentTheme, settings } = useSettings();
  const [users, setUsers] = useState([]);
  const [allPages, setAllPages] = useState([]);
  const [plans, setPlans] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [showMsgPanel, setShowMsgPanel] = useState(false);
  const [msgText, setMsgText] = useState('');
  const [msgSending, setMsgSending] = useState(false);
  const [passwords, setPasswords] = useState({});
  const [showPwd, setShowPwd] = useState({});
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedUser, setExpandedUser] = useState(null);

  const isDark = settings.darkMode;

  async function fetchData() {
    setLoading(true);
    try {
      const [usersRes, plansRes, statsRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/plans'),
        api.get('/admin/stats'),
      ]);
      setUsers(usersRes.data.users);
      setAllPages(usersRes.data.allPages);
      setPlans(plansRes.data.plans);
      setStats(statsRes.data);
    } catch (err) {
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  async function approveUser(id) {
    try { await api.post(`/admin/users/${id}/approve`); toast.success('User approved'); fetchData(); }
    catch { toast.error('Failed'); }
  }
  async function rejectUser(id) {
    try { await api.post(`/admin/users/${id}/reject`); toast.success('User approval revoked'); fetchData(); }
    catch { toast.error('Failed'); }
  }
  async function toggleActive(id) {
    try { await api.post(`/admin/users/${id}/toggle-active`); toast.success('Updated'); fetchData(); }
    catch { toast.error('Failed'); }
  }
  async function updatePages(id, pages) {
    try { await api.put(`/admin/users/${id}/pages`, { pages }); toast.success('Pages updated'); fetchData(); }
    catch { toast.error('Failed'); }
  }
  async function updatePlan(id, planId) {
    try { await api.put(`/admin/users/${id}/plan`, { plan_id: planId }); toast.success('Plan updated'); fetchData(); }
    catch { toast.error('Failed'); }
  }
  async function generateApiKey(id) {
    try {
      const res = await api.post(`/admin/users/${id}/api-key/generate`);
      navigator.clipboard.writeText(res.data.api_key);
      toast.success('API Key generated & copied!');
      fetchData();
    } catch { toast.error('Failed to generate API key'); }
  }
  async function revokeApiKey(id) {
    if (!confirm('Revoke this user\'s API key?')) return;
    try { await api.post(`/admin/users/${id}/api-key/revoke`); toast.success('API Key revoked'); fetchData(); }
    catch { toast.error('Failed to revoke'); }
  }
  async function resetPassword(id) {
    const custom = prompt('New password enter karo (blank = auto-generate):');
    if (custom === null) return;
    try {
      const payload = custom.trim() ? { password: custom.trim() } : {};
      const res = await api.post(`/admin/users/${id}/reset-password`, payload);
      setPasswords(prev => ({ ...prev, [id]: res.data.password }));
      setShowPwd(prev => ({ ...prev, [id]: true }));
      navigator.clipboard.writeText(res.data.password);
      toast.success(`Password reset! Copied: ${res.data.password}`);
    } catch (err) { toast.error(err.response?.data?.error || 'Reset failed'); }
  }
  async function loginAsUser(id) {
    try {
      const res = await api.post(`/admin/users/${id}/login-as`);
      localStorage.setItem('token', res.data.token);
      toast.success(`Logged in as ${res.data.name || res.data.email}`);
      window.location.href = '/';
    } catch (err) { toast.error(err.response?.data?.error || 'Login failed'); }
  }
  function togglePage(user, page) {
    const current = user.allowed_pages || [];
    const updated = current.includes(page) ? current.filter(p => p !== page) : [...current, page];
    updatePages(user.id, updated);
  }
  function toggleSelect(id) {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }
  function toggleSelectAll() {
    const withPhone = users.filter(u => u.whatsapp_number);
    selected.size === withPhone.length ? setSelected(new Set()) : setSelected(new Set(withPhone.map(u => u.id)));
  }

  const selectedUsers = users.filter(u => selected.has(u.id) && u.whatsapp_number);

  async function sendToSelected() {
    if (!msgText.trim()) return toast.error('Message likhein');
    if (selectedUsers.length === 0) return toast.error('No users with WhatsApp selected');
    setMsgSending(true);
    try {
      const contacts = selectedUsers.map(u => ({ phone: u.whatsapp_number, name: u.name || u.email }));
      const res = await api.post('/chatbot/bulk-send', { contacts, message: msgText });
      toast.success(`${res.data.queued} messages queued!`);
      setShowMsgPanel(false); setMsgText(''); setSelected(new Set());
    } catch (err) { toast.error(err.response?.data?.error || 'Send failed'); }
    finally { setMsgSending(false); }
  }

  const filteredUsers = useMemo(() => {
    if (!searchTerm) return users;
    const q = searchTerm.toLowerCase();
    return users.filter(u => (u.name || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.whatsapp_number || '').includes(q) || (u.plan_name || '').toLowerCase().includes(q));
  }, [users, searchTerm]);

  const pendingUsers = users.filter(u => !u.is_approved && !u.is_superadmin);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <RefreshCw className="animate-spin" size={32} style={{ color: currentTheme.primary }} />
      <p className="text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Loading admin panel...</p>
    </div>
  );

  const cardBg = isDark ? '#1f2937' : '#ffffff';
  const cardBorder = isDark ? '#374151' : '#e5e7eb';
  const textPrimary = isDark ? '#f3f4f6' : '#111827';
  const textSecondary = isDark ? '#9ca3af' : '#6b7280';
  const textMuted = isDark ? '#6b7280' : '#9ca3af';
  const inputBg = isDark ? '#374151' : '#f9fafb';

  // Fill missing dates for 7-day trend
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const found = stats?.dailyTrend?.find(t => t.date === ds);
    last7.push({ date: ds, count: found?.count || 0, label: d.toLocaleDateString('en', { weekday: 'short' }) });
  }
  const maxDailyMsg = Math.max(...last7.map(d => d.count), 1);

  // Revenue calculation
  const monthlyRevenue = users.reduce((sum, u) => sum + (u.monthly_price || 0), 0);

  return (
    <div className="space-y-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl" style={{ backgroundColor: currentTheme.light }}>
            <Shield size={24} style={{ color: currentTheme.primary }} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold" style={{ color: textPrimary }}>Super Admin</h1>
            <p className="text-xs" style={{ color: textSecondary }}>System overview & user management</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: cardBorder }}>
            {[
              { id: 'overview', icon: BarChart3, label: 'Overview' },
              { id: 'users', icon: Users, label: 'Users' },
              { id: 'plans', icon: Crown, label: 'Plans' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: activeTab === tab.id ? currentTheme.primary : 'transparent',
                  color: activeTab === tab.id ? '#ffffff' : textSecondary,
                }}
              >
                <tab.icon size={14} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
          <button onClick={fetchData} className="p-2 rounded-lg border transition-colors hover:opacity-80"
            style={{ borderColor: cardBorder, color: textSecondary }}>
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Pending Approvals Alert */}
      {pendingUsers.length > 0 && (
        <div className="rounded-xl p-4 border-l-4" style={{ backgroundColor: isDark ? '#422006' : '#fefce8', borderLeftColor: '#eab308' }}>
          <div className="flex items-center gap-2 mb-2">
            <UserX size={16} style={{ color: '#ca8a04' }} />
            <h3 className="font-semibold text-sm" style={{ color: isDark ? '#fde047' : '#854d0e' }}>
              {pendingUsers.length} Pending Approval{pendingUsers.length > 1 ? 's' : ''}
            </h3>
          </div>
          <div className="space-y-2">
            {pendingUsers.map(u => (
              <div key={u.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg px-3 py-2"
                style={{ backgroundColor: isDark ? '#1f2937' : '#ffffff' }}>
                <div>
                  <p className="font-medium text-sm" style={{ color: textPrimary }}>{u.name || u.email}</p>
                  <p className="text-xs" style={{ color: textMuted }}>{u.email} - {new Date(u.created_at).toLocaleDateString()}</p>
                </div>
                <button onClick={() => approveUser(u.id)}
                  className="flex items-center gap-1 px-3 py-1.5 text-white rounded-lg text-xs font-medium transition-colors"
                  style={{ backgroundColor: currentTheme.primary }}>
                  <CheckCircle size={14} /> Approve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========== OVERVIEW TAB ========== */}
      {activeTab === 'overview' && stats && (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Users', value: stats.totalUsers, icon: Users, color: '#3b82f6' },
              { label: 'Active Users', value: stats.activeUsers, icon: UserCheck, color: '#10b981' },
              { label: 'Connected', value: stats.connectedSessions, icon: Smartphone, color: '#8b5cf6' },
              { label: 'Pending', value: stats.pendingApproval, icon: UserX, color: '#f59e0b' },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-4 border" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: s.color + '15' }}>
                    <s.icon size={18} style={{ color: s.color }} />
                  </div>
                </div>
                <p className="text-2xl font-bold" style={{ color: textPrimary }}>{s.value}</p>
                <p className="text-xs mt-0.5" style={{ color: textMuted }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Message Stats + Revenue Row */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="rounded-xl p-4 border" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare size={16} style={{ color: currentTheme.primary }} />
                <span className="text-xs font-medium" style={{ color: textSecondary }}>Today</span>
              </div>
              <p className="text-3xl font-bold" style={{ color: currentTheme.primary }}>{stats.todayMessages}</p>
              <p className="text-[10px]" style={{ color: textMuted }}>messages sent</p>
            </div>
            <div className="rounded-xl p-4 border" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={16} style={{ color: '#8b5cf6' }} />
                <span className="text-xs font-medium" style={{ color: textSecondary }}>All Time</span>
              </div>
              <p className="text-3xl font-bold" style={{ color: textPrimary }}>{stats.totalMessages?.toLocaleString()}</p>
              <p className="text-[10px]" style={{ color: textMuted }}>total messages</p>
            </div>
            <div className="rounded-xl p-4 border" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
              <div className="flex items-center gap-2 mb-1">
                <Contact size={16} style={{ color: '#10b981' }} />
                <span className="text-xs font-medium" style={{ color: textSecondary }}>Contacts</span>
              </div>
              <p className="text-3xl font-bold" style={{ color: textPrimary }}>{stats.totalContacts}</p>
              <p className="text-[10px]" style={{ color: textMuted }}>across all users</p>
            </div>
            <div className="rounded-xl p-4 border" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
              <div className="flex items-center gap-2 mb-1">
                <IndianRupee size={16} style={{ color: '#f59e0b' }} />
                <span className="text-xs font-medium" style={{ color: textSecondary }}>Monthly Revenue</span>
              </div>
              <p className="text-3xl font-bold" style={{ color: '#f59e0b' }}>₹{monthlyRevenue.toLocaleString('en-IN')}</p>
              <p className="text-[10px]" style={{ color: textMuted }}>from paid plans</p>
            </div>
          </div>

          {/* 7-Day Message Trend */}
          <div className="rounded-xl p-5 border" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 size={18} style={{ color: currentTheme.primary }} />
                <h3 className="font-semibold text-sm" style={{ color: textPrimary }}>Message Trend (Last 7 Days)</h3>
              </div>
              <span className="text-xs px-2 py-1 rounded-full font-medium"
                style={{ backgroundColor: currentTheme.light, color: currentTheme.primary }}>
                {last7.reduce((s, d) => s + d.count, 0)} total
              </span>
            </div>
            <div className="flex items-end gap-2 h-32">
              {last7.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-medium" style={{ color: textSecondary }}>{d.count}</span>
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className="w-full rounded-t-md transition-all duration-500"
                      style={{
                        height: `${Math.max((d.count / maxDailyMsg) * 100, 4)}%`,
                        backgroundColor: currentTheme.primary,
                        opacity: i === 6 ? 1 : 0.5 + (i / 12),
                      }}
                    />
                  </div>
                  <span className="text-[10px]" style={{ color: textMuted }}>{d.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Row: Plan Distribution + Message Status + Top Users */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Plan Distribution */}
            <div className="rounded-xl p-5 border" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: textPrimary }}>
                <Zap size={16} style={{ color: '#f59e0b' }} /> Plan Distribution
              </h3>
              <div className="space-y-3">
                {(stats.planDistribution || []).map(p => {
                  const meta = PLAN_META[p.name] || { color: '#6b7280', label: p.name };
                  const pct = stats.totalUsers > 0 ? (p.count / stats.totalUsers) * 100 : 0;
                  return (
                    <div key={p.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
                          <span className="text-xs font-medium" style={{ color: textPrimary }}>{meta.label}</span>
                        </div>
                        <span className="text-xs font-bold" style={{ color: textMuted }}>{p.count} user{p.count !== 1 ? 's' : ''} ({Math.round(pct)}%)</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: isDark ? '#374151' : '#e5e7eb' }}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: meta.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Message Status */}
            <div className="rounded-xl p-5 border" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: textPrimary }}>
                <Activity size={16} style={{ color: '#10b981' }} /> Message Status
              </h3>
              <div className="space-y-2">
                {(stats.messageStatus || []).map(s => {
                  const statusColors = { sent: '#10b981', delivered: '#3b82f6', failed: '#ef4444', queued: '#f59e0b', pending: '#8b5cf6', cancelled: '#6b7280' };
                  const color = statusColors[s.status] || '#6b7280';
                  return (
                    <div key={s.status} className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-xs font-medium capitalize" style={{ color: textPrimary }}>{s.status}</span>
                      </div>
                      <span className="text-sm font-bold" style={{ color: textPrimary }}>{s.count.toLocaleString()}</span>
                    </div>
                  );
                })}
                {(!stats.messageStatus || stats.messageStatus.length === 0) && (
                  <p className="text-xs text-center py-4" style={{ color: textMuted }}>No messages yet</p>
                )}
              </div>
            </div>

            {/* Top Users by Messages */}
            <div className="rounded-xl p-5 border" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: textPrimary }}>
                <Crown size={16} style={{ color: '#f59e0b' }} /> Top Users
              </h3>
              <div className="space-y-2">
                {(stats.userStats || []).slice(0, 5).map((u, i) => {
                  const meta = PLAN_META[u.plan_name] || PLAN_META.free;
                  return (
                    <div key={u.id} className="flex items-center gap-3 py-1.5">
                      <span className="text-xs font-bold w-5 text-center" style={{ color: i < 3 ? '#f59e0b' : textMuted }}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: textPrimary }}>{u.name || u.email}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: meta.color + '15', color: meta.color }}>
                          {meta.label}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold" style={{ color: currentTheme.primary }}>{u.total_messages}</p>
                        <p className="text-[10px]" style={{ color: textMuted }}>messages</p>
                      </div>
                    </div>
                  );
                })}
                {(!stats.userStats || stats.userStats.length === 0) && (
                  <p className="text-xs text-center py-4" style={{ color: textMuted }}>No user data</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ========== PLANS TAB ========== */}
      {activeTab === 'plans' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map(plan => {
            const meta = PLAN_META[plan.name] || { icon: Zap, color: '#6b7280', label: plan.name };
            const PlanIcon = meta.icon;
            const userCount = users.filter(u => u.plan_id === plan.id).length;
            const isUnlimited = plan.daily_limit >= 999999;
            return (
              <div key={plan.id} className="rounded-xl border p-5 flex flex-col" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
                {/* Plan header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: meta.color + '15' }}>
                    <PlanIcon size={22} style={{ color: meta.color }} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg" style={{ color: textPrimary }}>{meta.label}</h3>
                    {plan.monthly_price > 0 ? (
                      <p className="text-xs" style={{ color: textMuted }}>₹{plan.monthly_price.toLocaleString('en-IN')}/mo</p>
                    ) : (
                      <p className="text-xs" style={{ color: textMuted }}>Free forever</p>
                    )}
                  </div>
                </div>

                {/* Users on this plan */}
                <div className="rounded-lg p-3 mb-4" style={{ backgroundColor: meta.color + '10' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium" style={{ color: meta.color }}>Active Users</span>
                    <span className="text-xl font-bold" style={{ color: meta.color }}>{userCount}</span>
                  </div>
                </div>

                {/* Limits */}
                <div className="space-y-2.5 flex-1">
                  {[
                    { label: 'Daily Messages', value: formatLimit(plan.daily_limit) },
                    { label: 'Monthly Messages', value: formatLimit(plan.monthly_limit) },
                    { label: 'Contacts', value: formatLimit(plan.max_contacts) },
                    { label: 'Templates', value: formatLimit(plan.max_templates) },
                    { label: 'Chatbot Flows', value: plan.max_chatbots === -1 ? 'Unlimited' : plan.max_chatbots },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: textSecondary }}>{item.label}</span>
                      <span className="text-xs font-bold flex items-center gap-1" style={{ color: textPrimary }}>
                        {item.value === 'Unlimited' ? (
                          <><Infinity size={14} style={{ color: meta.color }} /> <span style={{ color: meta.color }}>Unlimited</span></>
                        ) : item.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Pricing summary */}
                {plan.monthly_price > 0 && (
                  <div className="mt-4 pt-3 border-t" style={{ borderColor: cardBorder }}>
                    <div className="flex justify-between text-xs" style={{ color: textMuted }}>
                      <span>Monthly</span>
                      <span className="font-medium" style={{ color: textPrimary }}>₹{plan.monthly_price.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-xs mt-1" style={{ color: textMuted }}>
                      <span>Yearly</span>
                      <span className="font-medium" style={{ color: textPrimary }}>₹{plan.yearly_price.toLocaleString('en-IN')}</span>
                    </div>
                    {plan.yearly_price > 0 && (
                      <div className="flex justify-between text-xs mt-1">
                        <span style={{ color: '#10b981' }}>You save</span>
                        <span className="font-bold" style={{ color: '#10b981' }}>₹{((plan.monthly_price * 12) - plan.yearly_price).toLocaleString('en-IN')}/yr</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ========== USERS TAB ========== */}
      {activeTab === 'users' && (
        <>
          {/* Search & Actions Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: textMuted }} />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search by name, email, phone, or plan..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm focus:ring-2 focus:outline-none transition-colors"
                style={{
                  backgroundColor: inputBg,
                  borderColor: cardBorder,
                  color: textPrimary,
                  '--tw-ring-color': currentTheme.ring,
                }}
              />
            </div>
            {selected.size > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: currentTheme.primary }}>
                <span>{selected.size} selected</span>
                <button onClick={() => setShowMsgPanel(true)} disabled={selectedUsers.length === 0}
                  className="px-3 py-1 bg-white/20 rounded-lg text-xs hover:bg-white/30 disabled:opacity-50 flex items-center gap-1">
                  <Send size={12} /> Send
                </button>
                <button onClick={() => setSelected(new Set())} className="p-1 hover:bg-white/20 rounded">
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Message Panel */}
          {showMsgPanel && (
            <div className="rounded-xl shadow-lg border p-5 space-y-3" style={{ backgroundColor: cardBg, borderColor: currentTheme.primary + '40' }}>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm" style={{ color: textPrimary }}>
                  Send WhatsApp to {selectedUsers.length} user{selectedUsers.length > 1 ? 's' : ''}
                </h3>
                <button onClick={() => setShowMsgPanel(false)} className="p-1 rounded hover:opacity-70" style={{ color: textMuted }}>
                  <X size={16} />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedUsers.map(u => (
                  <span key={u.id} className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: currentTheme.light, color: currentTheme.primary }}>
                    {u.name || u.email} ({u.whatsapp_number})
                  </span>
                ))}
              </div>
              <div className="text-xs" style={{ color: textMuted }}>
                Variables: <button onClick={() => setMsgText(p => p + '{{name}}')}
                  className="px-1.5 py-0.5 rounded font-mono ml-1"
                  style={{ backgroundColor: currentTheme.light, color: currentTheme.primary }}>{`{{name}}`}</button>
              </div>
              <textarea value={msgText} onChange={e => setMsgText(e.target.value)} rows={4} disabled={msgSending}
                placeholder="Type your message..."
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:outline-none disabled:opacity-50"
                style={{ borderColor: cardBorder, backgroundColor: inputBg, color: textPrimary, '--tw-ring-color': currentTheme.ring }} />
              {msgText && selectedUsers[0] && (
                <div className="rounded-lg p-3" style={{ backgroundColor: '#e5ddd5' }}>
                  <p className="text-[10px] text-gray-500 mb-1">Preview ({selectedUsers[0].name || selectedUsers[0].email}):</p>
                  <div className="bg-white rounded-lg rounded-tl-none px-3 py-2 max-w-[90%] shadow-sm">
                    <p className="text-xs text-gray-700 whitespace-pre-wrap">{msgText.replace(/\{\{name\}\}/g, selectedUsers[0].name || selectedUsers[0].email)}</p>
                  </div>
                </div>
              )}
              <div className="flex justify-end">
                <button onClick={sendToSelected} disabled={msgSending || !msgText.trim()}
                  className="flex items-center gap-2 px-5 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                  style={{ backgroundColor: currentTheme.primary }}>
                  <Send size={14} /> {msgSending ? 'Sending...' : `Send to ${selectedUsers.length}`}
                </button>
              </div>
            </div>
          )}

          {/* User Cards */}
          <div className="space-y-3">
            {/* Select All */}
            <div className="flex items-center gap-3 px-4 py-2">
              <input type="checkbox"
                checked={selected.size > 0 && selected.size === users.filter(u => u.whatsapp_number).length}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded" style={{ accentColor: currentTheme.primary }} />
              <span className="text-xs font-medium" style={{ color: textSecondary }}>
                Select all ({users.filter(u => u.whatsapp_number).length} with WhatsApp)
              </span>
            </div>

            {filteredUsers.map(u => {
              const isExpanded = expandedUser === u.id;
              const userStat = stats?.userStats?.find(s => s.id === u.id);
              const meta = PLAN_META[u.plan_name] || PLAN_META.free;
              const PlanIcon = meta.icon;
              const isUnlimited = u.plan_name === 'business' || u.is_superadmin;

              return (
                <div key={u.id} className="rounded-xl border overflow-hidden transition-shadow hover:shadow-md"
                  style={{ backgroundColor: cardBg, borderColor: selected.has(u.id) ? currentTheme.primary : cardBorder }}>
                  {/* Main Row */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    {/* Checkbox */}
                    <div className="shrink-0">
                      {u.whatsapp_number ? (
                        <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleSelect(u.id)}
                          className="w-4 h-4 rounded" style={{ accentColor: currentTheme.primary }} />
                      ) : <div className="w-4" />}
                    </div>

                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                      style={{ backgroundColor: u.is_superadmin ? '#8b5cf6' : meta.color }}>
                      {(u.name || u.email)[0].toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold truncate" style={{ color: textPrimary }}>
                          {u.name || u.email}
                        </p>
                        {u.is_superadmin && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700 shrink-0">
                            Super Admin
                          </span>
                        )}
                        {!u.is_superadmin && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
                            style={{ backgroundColor: meta.color + '15', color: meta.color }}>
                            <PlanIcon size={10} className="inline mr-0.5" style={{ verticalAlign: '-1px' }} />
                            {meta.label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs truncate" style={{ color: textMuted }}>{u.email}</p>
                    </div>

                    {/* Quick Stats */}
                    <div className="hidden sm:flex items-center gap-4">
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{
                            backgroundColor: u.is_approved ? currentTheme.light : (isDark ? '#422006' : '#fef3c7'),
                            color: u.is_approved ? currentTheme.primary : '#b45309',
                          }}>
                          {u.is_approved ? <><CheckCircle size={10} /> Approved</> : <><XCircle size={10} /> Pending</>}
                        </span>
                        {u.session_status === 'connected' && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: '#d1fae5', color: '#065f46' }}>
                            <Smartphone size={10} /> WA Connected
                          </span>
                        )}
                      </div>

                      {/* Messages */}
                      <div className="text-center px-3">
                        <p className="text-lg font-bold" style={{ color: currentTheme.primary }}>{userStat?.total_messages || 0}</p>
                        <p className="text-[10px]" style={{ color: textMuted }}>messages</p>
                      </div>
                    </div>

                    {/* Expand Button */}
                    <button onClick={() => setExpandedUser(isExpanded ? null : u.id)}
                      className="p-2 rounded-lg transition-colors shrink-0"
                      style={{ color: textSecondary }}>
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>

                  {/* Mobile Quick Stats */}
                  <div className="sm:hidden flex items-center gap-3 px-4 pb-2">
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: u.is_approved ? currentTheme.light : (isDark ? '#422006' : '#fef3c7'),
                        color: u.is_approved ? currentTheme.primary : '#b45309',
                      }}>
                      {u.is_approved ? 'Approved' : 'Pending'}
                    </span>
                    {u.session_status === 'connected' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#d1fae5', color: '#065f46' }}>
                        WA
                      </span>
                    )}
                    <span className="text-xs font-bold ml-auto" style={{ color: currentTheme.primary }}>{userStat?.total_messages || 0} msgs</span>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t px-4 py-4 space-y-4" style={{ borderColor: cardBorder }}>
                      {/* Plan & Limits Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        <div className="rounded-lg p-3 border" style={{ borderColor: cardBorder, backgroundColor: inputBg }}>
                          <p className="text-[10px] font-medium mb-1" style={{ color: textMuted }}>Plan</p>
                          {!u.is_superadmin ? (
                            <select value={u.plan_id} onChange={e => updatePlan(u.id, parseInt(e.target.value))}
                              className="text-sm font-bold border-none bg-transparent focus:outline-none w-full"
                              style={{ color: meta.color }}>
                              {plans.map(p => {
                                const pm = PLAN_META[p.name] || PLAN_META.free;
                                return <option key={p.id} value={p.id}>{pm.label} {p.monthly_price > 0 ? `(₹${p.monthly_price})` : ''}</option>;
                              })}
                            </select>
                          ) : (
                            <p className="text-sm font-bold text-purple-600">Unlimited</p>
                          )}
                        </div>
                        <div className="rounded-lg p-3 border" style={{ borderColor: cardBorder, backgroundColor: inputBg }}>
                          <p className="text-[10px] font-medium mb-1" style={{ color: textMuted }}>Today's Usage</p>
                          <p className="text-sm font-bold" style={{ color: textPrimary }}>
                            {userStat?.today_messages || 0}
                            {!isUnlimited && <span style={{ color: textMuted }}> / {u.daily_limit}</span>}
                          </p>
                          {isUnlimited && <span className="text-[10px] font-medium" style={{ color: meta.color }}>No limit</span>}
                        </div>
                        <div className="rounded-lg p-3 border" style={{ borderColor: cardBorder, backgroundColor: inputBg }}>
                          <p className="text-[10px] font-medium mb-1" style={{ color: textMuted }}>Daily Limit</p>
                          <p className="text-sm font-bold" style={{ color: isUnlimited ? meta.color : textPrimary }}>
                            {isUnlimited ? 'Unlimited' : formatLimit(u.daily_limit)}
                          </p>
                        </div>
                        <div className="rounded-lg p-3 border" style={{ borderColor: cardBorder, backgroundColor: inputBg }}>
                          <p className="text-[10px] font-medium mb-1" style={{ color: textMuted }}>Contacts</p>
                          <p className="text-sm font-bold" style={{ color: isUnlimited ? meta.color : textPrimary }}>
                            {formatLimit(u.max_contacts)}
                          </p>
                        </div>
                        <div className="rounded-lg p-3 border" style={{ borderColor: cardBorder, backgroundColor: inputBg }}>
                          <p className="text-[10px] font-medium mb-1" style={{ color: textMuted }}>Templates</p>
                          <p className="text-sm font-bold" style={{ color: isUnlimited ? meta.color : textPrimary }}>
                            {formatLimit(u.max_templates)}
                          </p>
                        </div>
                        <div className="rounded-lg p-3 border" style={{ borderColor: cardBorder, backgroundColor: inputBg }}>
                          <p className="text-[10px] font-medium mb-1" style={{ color: textMuted }}>WhatsApp</p>
                          <p className="text-sm font-medium" style={{ color: u.session_status === 'connected' ? '#10b981' : textPrimary }}>
                            {u.whatsapp_number || 'Not linked'}
                          </p>
                        </div>
                      </div>

                      {/* Registered */}
                      <div className="text-xs" style={{ color: textMuted }}>
                        Registered: {new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {u.monthly_price > 0 && <span className="ml-3">Revenue: <span className="font-bold" style={{ color: '#f59e0b' }}>₹{u.monthly_price.toLocaleString('en-IN')}/mo</span></span>}
                      </div>

                      {/* Password Section */}
                      <div className="rounded-lg p-3 border" style={{ borderColor: cardBorder, backgroundColor: inputBg }}>
                        <p className="text-[10px] font-medium mb-2" style={{ color: textMuted }}>Password Management</p>
                        {passwords[u.id] ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono px-2 py-1 rounded" style={{ backgroundColor: isDark ? '#374151' : '#e5e7eb', color: textPrimary }}>
                              {showPwd[u.id] ? passwords[u.id] : '••••••••'}
                            </span>
                            <button onClick={() => setShowPwd(prev => ({ ...prev, [u.id]: !prev[u.id] }))}
                              className="p-1 rounded hover:opacity-70" style={{ color: textMuted }}>
                              {showPwd[u.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                            <button onClick={() => { navigator.clipboard.writeText(passwords[u.id]); toast.success('Copied!'); }}
                              className="p-1 rounded hover:opacity-70" style={{ color: textMuted }}>
                              <Copy size={14} />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => resetPassword(u.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                            style={{ borderColor: cardBorder, color: textSecondary }}>
                            <Lock size={12} /> Reset Password
                          </button>
                        )}
                      </div>

                      {/* API Key */}
                      {!u.is_superadmin && (
                        <div className="rounded-lg p-3 border" style={{ borderColor: cardBorder, backgroundColor: inputBg }}>
                          <p className="text-[10px] font-medium mb-2" style={{ color: textMuted }}>API Access</p>
                          {u.plan_name === 'free' ? (
                            <span className="text-xs" style={{ color: textMuted }}>Upgrade plan to enable API</span>
                          ) : u.has_api_key ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] px-2 py-1 rounded-full font-medium flex items-center gap-1"
                                style={{ backgroundColor: currentTheme.light, color: currentTheme.primary }}>
                                <Key size={10} /> Active
                              </span>
                              <span className="text-[10px] font-mono" style={{ color: textMuted }}>{u.api_key_preview}</span>
                              <button onClick={() => { navigator.clipboard.writeText(u.api_key_preview || ''); toast.success('Preview copied'); }}
                                className="p-1 rounded hover:opacity-70" style={{ color: textMuted }}><Copy size={12} /></button>
                              <button onClick={() => revokeApiKey(u.id)}
                                className="p-1 rounded text-red-500 hover:text-red-700"><Trash2 size={12} /></button>
                            </div>
                          ) : (
                            <button onClick={() => generateApiKey(u.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                              style={{ backgroundColor: currentTheme.light, color: currentTheme.primary }}>
                              <Key size={12} /> Generate API Key
                            </button>
                          )}
                        </div>
                      )}

                      {/* Pages */}
                      {!u.is_superadmin && (
                        <div className="rounded-lg p-3 border" style={{ borderColor: cardBorder, backgroundColor: inputBg }}>
                          <p className="text-[10px] font-medium mb-2" style={{ color: textMuted }}>Allowed Pages</p>
                          <div className="flex flex-wrap gap-1.5">
                            {allPages.map(page => {
                              const has = (u.allowed_pages || []).includes(page);
                              return (
                                <button key={page} onClick={() => togglePage(u, page)}
                                  className="text-[11px] px-2.5 py-1 rounded-lg font-medium border transition-all"
                                  style={{
                                    backgroundColor: has ? currentTheme.light : 'transparent',
                                    color: has ? currentTheme.primary : textMuted,
                                    borderColor: has ? currentTheme.primary + '40' : cardBorder,
                                  }}>
                                  {PAGE_LABELS[page] || page}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2">
                        {!u.is_superadmin && (
                          <>
                            {u.is_approved ? (
                              <button onClick={() => rejectUser(u.id)}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                                style={{ backgroundColor: isDark ? '#422006' : '#fef3c7', color: '#b45309' }}>
                                <UserX size={14} /> Revoke Approval
                              </button>
                            ) : (
                              <button onClick={() => approveUser(u.id)}
                                className="flex items-center gap-1.5 px-3 py-2 text-white rounded-lg text-xs font-medium transition-colors"
                                style={{ backgroundColor: currentTheme.primary }}>
                                <UserCheck size={14} /> Approve
                              </button>
                            )}
                            <button onClick={() => toggleActive(u.id)}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                              style={{
                                backgroundColor: u.is_active ? (isDark ? '#7f1d1d' : '#fee2e2') : currentTheme.light,
                                color: u.is_active ? '#dc2626' : currentTheme.primary,
                              }}>
                              {u.is_active ? <><ToggleRight size={14} /> Deactivate</> : <><ToggleLeft size={14} /> Activate</>}
                            </button>
                          </>
                        )}
                        <button onClick={() => loginAsUser(u.id)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                          style={{ backgroundColor: isDark ? '#1e1b4b' : '#e0e7ff', color: '#4f46e5' }}>
                          <LogIn size={14} /> Login As
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {filteredUsers.length === 0 && (
              <div className="text-center py-12 rounded-xl border" style={{ borderColor: cardBorder, backgroundColor: cardBg }}>
                <Users size={32} style={{ color: textMuted }} className="mx-auto mb-2" />
                <p className="text-sm" style={{ color: textMuted }}>No users found</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
