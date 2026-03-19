import { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import {
  Users, FileText, Send, AlertCircle, TrendingUp, MessageSquare, BarChart3,
  Zap, Star, Rocket, Crown, Infinity, ArrowUpRight,
} from 'lucide-react';
import toast from '../utils/notify.js';

const PLAN_META = {
  free:     { icon: Zap,    color: '#6b7280', label: 'Free' },
  starter:  { icon: Star,   color: '#3b82f6', label: 'Starter' },
  pro:      { icon: Rocket, color: '#8b5cf6', label: 'Pro' },
  business: { icon: Crown,  color: '#f59e0b', label: 'Business' },
};

function formatLimit(val) {
  if (val >= 999999) return 'Unlimited';
  return val?.toLocaleString('en-IN') || '0';
}

export default function Dashboard() {
  const { currentTheme, settings } = useSettings();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const isDark = settings.darkMode;

  useEffect(() => {
    api.get('/dashboard/stats').then((res) => setStats(res.data)).catch(() => toast.error('Failed to load dashboard'));
  }, []);

  if (!stats) return <div className="text-gray-500">Loading...</div>;

  const isSuperAdmin = user?.is_superadmin;
  const plan = stats.plan || 'free';
  const meta = PLAN_META[plan] || PLAN_META.free;
  const PlanIcon = meta.icon;
  const isUnlimited = plan === 'business' || isSuperAdmin;

  const sentTodayLabel = isUnlimited ? `${stats.today_sent}` : `${stats.today_sent} / ${stats.daily_limit}`;
  const totalWeek = stats.daily_stats.reduce((s, d) => s + d.messages_sent, 0);

  const cards = [
    { label: 'Sent Today', value: sentTodayLabel, icon: Send, color: currentTheme.primary, sub: isUnlimited ? 'Unlimited' : `${Math.max(stats.daily_limit - stats.today_sent, 0)} remaining` },
    { label: 'Contacts', value: stats.contacts, icon: Users, color: '#3b82f6', sub: isUnlimited ? 'Unlimited' : `of ${formatLimit(stats.max_contacts)}` },
    { label: 'Templates', value: stats.templates, icon: FileText, color: '#8b5cf6', sub: isUnlimited ? 'Unlimited' : `of ${formatLimit(stats.max_templates)}` },
    { label: 'Failed', value: stats.total_failed, icon: AlertCircle, color: '#ef4444', sub: 'total failed' },
  ];

  const cardBg = isDark ? '#1f2937' : '#ffffff';
  const cardBorder = isDark ? '#374151' : '#e5e7eb';
  const textPrimary = isDark ? '#f3f4f6' : '#111827';
  const textSecondary = isDark ? '#9ca3af' : '#6b7280';
  const textMuted = isDark ? '#6b7280' : '#9ca3af';

  const maxMsg = Math.max(...stats.daily_stats.map(d => d.messages_sent), 1);

  return (
    <div>
      {/* Header with Plan Badge */}
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <h2 className="text-xl md:text-2xl font-bold" style={{ color: textPrimary }}>Dashboard</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: meta.color + '15' }}>
            <PlanIcon size={16} style={{ color: meta.color }} />
            <span className="text-xs font-bold" style={{ color: meta.color }}>{meta.label} Plan</span>
            {isUnlimited && <Infinity size={14} style={{ color: meta.color }} />}
          </div>
          {!isSuperAdmin && plan !== 'business' && (
            <button onClick={() => navigate('/profile')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-white transition-all hover:opacity-90"
              style={{ backgroundColor: currentTheme.primary }}>
              <ArrowUpRight size={14} /> Upgrade
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        {cards.map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="rounded-xl shadow p-3 sm:p-5 border" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm" style={{ color: textSecondary }}>{label}</p>
                <p className="text-lg sm:text-2xl font-bold mt-0.5 sm:mt-1 truncate" style={{ color: textPrimary }}>{value}</p>
                <p className="text-[10px] sm:text-xs mt-0.5" style={{ color: textMuted }}>{sub}</p>
              </div>
              <div className="p-2 sm:p-3 rounded-lg shrink-0" style={{ backgroundColor: color + '15' }}>
                <Icon size={18} className="sm:w-[22px] sm:h-[22px]" style={{ color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Daily usage chart */}
      <div className="rounded-xl shadow p-4 sm:p-6 mb-6 md:mb-8 border" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 size={18} style={{ color: currentTheme.primary }} />
            <h3 className="font-semibold text-sm sm:text-base" style={{ color: textPrimary }}>Last 7 Days</h3>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full font-medium"
            style={{ backgroundColor: currentTheme.light, color: currentTheme.primary }}>
            {totalWeek} messages
          </span>
        </div>
        <div className="flex items-end gap-2 sm:gap-3 h-36 sm:h-44">
          {stats.daily_stats.map((d, i) => {
            const pct = Math.max((d.messages_sent / maxMsg) * 100, 4);
            const dayLabel = new Date(d.date + 'T00:00:00').toLocaleDateString('en', { weekday: 'short' });
            const isToday = i === stats.daily_stats.length - 1;
            return (
              <div key={d.date} className="flex flex-col items-center flex-1 min-w-0 h-full">
                <span className="text-[10px] sm:text-xs font-medium mb-1" style={{ color: d.messages_sent > 0 ? textPrimary : textMuted }}>
                  {d.messages_sent}
                </span>
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full rounded-t-md transition-all duration-300 min-w-[8px]"
                    style={{
                      height: `${pct}%`,
                      backgroundColor: currentTheme.primary,
                      opacity: isToday ? 1 : d.messages_sent > 0 ? 0.6 : 0.15,
                    }}
                  />
                </div>
                <span className="text-[10px] sm:text-xs mt-1.5 truncate w-full text-center font-medium"
                  style={{ color: isToday ? currentTheme.primary : textMuted }}>
                  {isToday ? 'Today' : dayLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent messages */}
      <div className="rounded-xl shadow p-4 sm:p-6 border" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <MessageSquare size={18} style={{ color: currentTheme.primary }} />
          <h3 className="font-semibold text-sm sm:text-base" style={{ color: textPrimary }}>Recent Messages</h3>
        </div>
        {stats.recent_messages.length === 0 ? (
          <p className="text-sm py-8 text-center" style={{ color: textMuted }}>No messages sent yet</p>
        ) : (
          <div className="space-y-1 sm:space-y-2">
            {stats.recent_messages.map((msg, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b last:border-0 gap-2" style={{ borderColor: cardBorder }}>
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-xs sm:text-sm" style={{ color: textPrimary }}>{msg.phone}</span>
                  <p className="text-xs sm:text-sm truncate" style={{ color: textSecondary }}>{msg.body}</p>
                </div>
                <span
                  className="text-[10px] sm:text-xs px-2 py-1 rounded-full shrink-0 font-medium"
                  style={{
                    backgroundColor: msg.status === 'sent' ? currentTheme.light : msg.status === 'failed' ? '#fee2e2' : '#fef3c7',
                    color: msg.status === 'sent' ? currentTheme.primary : msg.status === 'failed' ? '#dc2626' : '#b45309',
                  }}
                >
                  {msg.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
