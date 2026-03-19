import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';
import {
  LayoutDashboard,
  Smartphone,
  FileText,
  Users,
  Send,
  Bot,
  Key,
  LogOut,
  Shield,
  Menu,
  X,
  Bell,
  CheckCircle2,
  XCircle,
  Info,
  Trash2,
  ChevronRight,
  Settings,
  Globe,
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { to: '/device', label: 'Device Link', icon: Smartphone, key: 'device' },
  { to: '/templates', label: 'Templates', icon: FileText, key: 'templates' },
  { to: '/website-data', label: 'Contacts', icon: Users, key: 'website' },
  { to: '/send', label: 'Send Message', icon: Send, key: 'send' },
  { to: '/chatbot', label: 'Chatbot & Campaign', icon: Bot, key: 'chatbot' },
  { to: '/api', label: 'API Access', icon: Key, key: 'api' },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { currentTheme } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const { notifications, unreadCount, markAllRead, clearAll } = useNotifications();

  // Close sidebar & notif panel on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
    setNotifOpen(false);
  }, [location.pathname]);

  // Close notif panel on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    if (notifOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [notifOpen]);

  const handleBellClick = () => {
    setNotifOpen(!notifOpen);
    if (!notifOpen) markAllRead();
  };

  const formatTime = (date) => {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const allowedPages = user?.allowed_pages || [];
  const isSuperAdmin = !!user?.is_superadmin;

  const visibleNav = isSuperAdmin
    ? navItems
    : navItems.filter(item => allowedPages.includes(item.key));

  // Bottom tab bar items for mobile
  const bottomTabs = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, key: 'dashboard' },
    { to: '/send', label: 'Send', icon: Send, key: 'send' },
    { to: '/chatbot', label: 'Chatbot', icon: Bot, key: 'chatbot' },
    { to: '/device', label: 'Device', icon: Smartphone, key: 'device' },
  ];

  const visibleTabs = isSuperAdmin
    ? bottomTabs
    : bottomTabs.filter(item => allowedPages.includes(item.key));

  const initials = (user?.name || user?.email || '?').slice(0, 2).toUpperCase();

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 md:w-64 bg-white shadow-2xl md:shadow-lg flex flex-col
        transform transition-transform duration-300 ease-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0 md:z-auto
      `}>
        {/* Profile header with gradient */}
        <div className="relative overflow-hidden">
          {/* Gradient background - mobile only */}
          <div className="md:hidden absolute inset-0" style={{ background: `linear-gradient(135deg, ${currentTheme.primary}, ${currentTheme.dark})` }} />
          {/* Desktop simple header */}
          <div className="hidden md:block border-b p-6">
            <h1 className="text-xl font-bold text-[var(--color-primary)]">Wapnix</h1>
            <button onClick={() => { navigate('/profile'); setSidebarOpen(false); }} className="mt-3 flex items-center gap-3 w-full text-left hover:bg-gray-50 rounded-lg p-2 -mx-2 transition">
              {user?.profile_image ? (
                <img src={user.profile_image} alt="" className="w-9 h-9 rounded-full object-cover" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center">
                  <span className="text-xs font-bold text-[var(--color-primary)]">{initials}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{user?.name || user?.email}</p>
                <span className="inline-block px-2 py-0.5 text-xs bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] rounded-full">
                  {user?.plan_name} plan
                </span>
              </div>
            </button>
          </div>

          {/* Mobile profile header */}
          <div className="md:hidden relative z-10 px-5 pt-12 pb-6">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 text-white hover:bg-white/30 transition"
            >
              <X size={18} />
            </button>
            <button onClick={() => { navigate('/profile'); setSidebarOpen(false); }} className="flex items-center gap-4 w-full text-left">
              {user?.profile_image ? (
                <img src={user.profile_image} alt="" className="w-14 h-14 rounded-2xl object-cover border-2 border-white/30 shadow-lg" />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center border-2 border-white/30 shadow-lg">
                  <span className="text-lg font-bold text-white">{initials}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-white truncate">{user?.name || user?.email}</p>
                <p className="text-xs text-white/70 truncate mt-0.5">{user?.email}</p>
                <span className="inline-flex items-center gap-1 mt-1.5 px-2.5 py-0.5 text-[10px] font-semibold bg-white/20 backdrop-blur text-white rounded-full uppercase tracking-wide">
                  {user?.plan_name} plan
                </span>
              </div>
              <ChevronRight size={16} className="text-white/50 shrink-0" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 md:p-4 space-y-0.5 overflow-y-auto">
          <p className="px-4 pb-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest md:hidden">Menu</p>
          {visibleNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 md:py-2.5 rounded-xl md:rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] shadow-sm md:shadow-none'
                    : 'text-gray-600 hover:bg-gray-50 active:bg-gray-100'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`p-1.5 rounded-lg md:p-0 md:rounded-none ${isActive ? 'bg-[var(--color-primary-medium)] md:bg-transparent' : 'bg-gray-100 md:bg-transparent'}`}>
                    <Icon size={18} className={isActive ? 'text-[var(--color-primary)]' : 'text-gray-500 md:text-current'} />
                  </div>
                  <span className="flex-1">{label}</span>
                  {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] md:hidden" />}
                </>
              )}
            </NavLink>
          ))}

          {isSuperAdmin && (
            <>
              <div className="my-2 border-t border-gray-100 md:hidden" />
              <p className="px-4 pb-2 pt-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest md:hidden">Admin</p>
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 md:py-2.5 rounded-xl md:rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-purple-50 text-purple-700 shadow-sm shadow-purple-100 md:shadow-none'
                      : 'text-purple-600 hover:bg-purple-50 active:bg-purple-100'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={`p-1.5 rounded-lg md:p-0 md:rounded-none ${isActive ? 'bg-purple-100 md:bg-transparent' : 'bg-purple-50 md:bg-transparent'}`}>
                      <Shield size={18} />
                    </div>
                    <span className="flex-1">Super Admin</span>
                    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-purple-500 md:hidden" />}
                  </>
                )}
              </NavLink>
            </>
          )}
        </nav>

        {/* Footer actions */}
        <div className="p-3 md:p-4 border-t border-gray-100">
          {/* Settings link - mobile only */}
          <button
            onClick={() => { navigate('/settings'); setSidebarOpen(false); }}
            className="md:hidden flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 w-full transition mb-1"
          >
            <div className="p-1.5 rounded-lg bg-gray-100">
              <Settings size={18} className="text-gray-500" />
            </div>
            <span className="flex-1">Settings</span>
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-3 md:py-2.5 rounded-xl md:rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 w-full transition"
          >
            <div className="p-1.5 rounded-lg bg-red-50 md:p-0 md:rounded-none md:bg-transparent">
              <LogOut size={18} />
            </div>
            Logout
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white shadow-sm border-b">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <Menu size={22} />
          </button>
          <h1 className="text-lg font-bold text-[var(--color-primary)]">Wapnix</h1>
          <div className="flex items-center gap-1">
            <button onClick={handleBellClick} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 relative">
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <button onClick={() => navigate('/profile')} className="p-1">
              {user?.profile_image ? (
                <img src={user.profile_image} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center">
                  <span className="text-xs font-bold text-[var(--color-primary)]">{initials}</span>
                </div>
              )}
            </button>
          </div>
        </header>

        {/* Desktop notification bell - top right */}
        <div className="hidden md:flex items-center justify-end px-8 py-3 bg-white border-b">
          <div className="relative" ref={notifRef}>
            <button onClick={handleBellClick} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 relative">
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Desktop notification dropdown */}
            {notifOpen && (
              <div className="absolute right-0 top-12 w-96 bg-white rounded-xl shadow-2xl border z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                  <h3 className="font-semibold text-sm text-gray-800">Notifications</h3>
                  {notifications.length > 0 && (
                    <button onClick={clearAll} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1">
                      <Trash2 size={12} /> Clear all
                    </button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="py-12 text-center text-gray-400 text-sm">No notifications yet</div>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className={`flex items-start gap-3 px-4 py-3 border-b last:border-0 ${!n.read ? 'hover:bg-gray-50' : 'hover:bg-gray-50'}`} style={!n.read ? { backgroundColor: 'color-mix(in srgb, var(--color-primary-light) 50%, transparent)' } : undefined}>
                        <div className="mt-0.5">
                          {n.type === 'success' ? <CheckCircle2 size={16} className="text-green-500" /> : n.type === 'error' ? <XCircle size={16} className="text-red-500" /> : <Info size={16} className="text-blue-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700">{n.message}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">{formatTime(n.time)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile notification panel */}
        {notifOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-white flex flex-col" ref={notifRef}>
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
              <h3 className="font-semibold text-gray-800">Notifications</h3>
              <div className="flex items-center gap-3">
                {notifications.length > 0 && (
                  <button onClick={clearAll} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1">
                    <Trash2 size={12} /> Clear
                  </button>
                )}
                <button onClick={() => setNotifOpen(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-20 text-center text-gray-400">
                  <Bell size={40} className="mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">No notifications yet</p>
                  <p className="text-xs mt-1">Actions will appear here</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className={`flex items-start gap-3 px-4 py-3 border-b`} style={!n.read ? { backgroundColor: 'color-mix(in srgb, var(--color-primary-light) 50%, transparent)' } : undefined}>
                    <div className="mt-0.5">
                      {n.type === 'success' ? <CheckCircle2 size={16} className="text-green-500" /> : n.type === 'error' ? <XCircle size={16} className="text-red-500" /> : <Info size={16} className="text-blue-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700">{n.message}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{formatTime(n.time)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-8 md:pb-8">{children}</main>
      </div>

      {/* WhatsApp-style bottom navigation - mobile only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex justify-around items-center h-16 shadow-[0_-2px_10px_rgba(0,0,0,0.08)]">
        {visibleTabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors ${
                isActive
                  ? 'text-[var(--color-primary)]'
                  : 'text-gray-500'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                <span className={`text-[10px] ${isActive ? 'font-semibold' : 'font-medium'}`}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
