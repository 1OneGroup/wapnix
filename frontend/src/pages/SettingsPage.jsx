import { useState } from 'react';
import { useSettings } from '../context/SettingsContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api/client.js';
import toast from '../utils/notify.js';
import {
  Palette, Bell, BellOff, Moon, Sun, Lock, Eye, EyeOff,
  Check, ChevronRight, Smartphone,
} from 'lucide-react';

export default function SettingsPage() {
  const { settings, updateSetting, themes, currentTheme } = useSettings();
  const { user } = useAuth();

  // Password form
  const [showPw, setShowPw] = useState(false);
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  async function changePassword() {
    if (pwForm.new_password !== pwForm.confirm) return toast.error('Passwords do not match');
    if (pwForm.new_password.length < 6) return toast.error('Password must be at least 6 characters');
    try {
      await api.put('/profile/password', { current_password: pwForm.current_password, new_password: pwForm.new_password });
      toast.success('Password changed successfully');
      setPwForm({ current_password: '', new_password: '', confirm: '' });
      setShowPw(false);
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to change password'); }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 md:space-y-6">
      <h1 className="text-xl md:text-2xl font-bold" style={{ color: settings.darkMode ? '#f3f4f6' : '#1f2937' }}>Settings</h1>

      {/* Appearance Section */}
      <div className="settings-card rounded-xl shadow p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg" style={{ backgroundColor: currentTheme.light }}>
            <Palette size={20} style={{ color: currentTheme.primary }} />
          </div>
          <div>
            <h3 className="font-semibold settings-text">Appearance</h3>
            <p className="text-xs settings-subtext">Customize how the app looks</p>
          </div>
        </div>

        {/* Dark / Light Mode Toggle */}
        <div className="flex items-center justify-between py-3 border-b settings-border">
          <div className="flex items-center gap-3">
            {settings.darkMode ? <Moon size={18} className="text-yellow-400" /> : <Sun size={18} className="text-amber-500" />}
            <div>
              <p className="text-sm font-medium settings-text">Dark Mode</p>
              <p className="text-xs settings-subtext">{settings.darkMode ? 'Dark theme active' : 'Light theme active'}</p>
            </div>
          </div>
          <button
            onClick={() => updateSetting('darkMode', !settings.darkMode)}
            className="relative w-12 h-7 rounded-full transition-colors duration-300"
            style={{ backgroundColor: settings.darkMode ? currentTheme.primary : '#d1d5db' }}
          >
            <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300 ${settings.darkMode ? 'translate-x-5 right-0.5' : 'left-0.5'}`} />
          </button>
        </div>

        {/* Theme Selection */}
        <div className="pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Smartphone size={16} className="settings-subtext" />
            <p className="text-sm font-medium settings-text">Color Theme</p>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {themes.map((theme) => (
              <button
                key={theme.id}
                onClick={() => updateSetting('theme', theme.id)}
                className={`relative flex flex-col items-center gap-1.5 p-2.5 sm:p-3 rounded-xl border-2 transition-all ${
                  settings.theme === theme.id
                    ? 'border-current shadow-md scale-[1.02]'
                    : 'border-transparent hover:border-gray-200 settings-card-hover'
                }`}
                style={settings.theme === theme.id ? { borderColor: theme.primary, backgroundColor: theme.light } : {}}
              >
                <div className="relative">
                  <div
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full shadow-inner"
                    style={{ backgroundColor: theme.primary }}
                  />
                  {settings.theme === theme.id && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Check size={16} className="text-white" strokeWidth={3} />
                    </div>
                  )}
                </div>
                <span className="text-[10px] sm:text-xs font-medium settings-text text-center leading-tight">{theme.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notifications Section */}
      <div className="settings-card rounded-xl shadow p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg" style={{ backgroundColor: currentTheme.light }}>
            <Bell size={20} style={{ color: currentTheme.primary }} />
          </div>
          <div>
            <h3 className="font-semibold settings-text">Notifications</h3>
            <p className="text-xs settings-subtext">Manage notification preferences</p>
          </div>
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            {settings.notifMuted ? <BellOff size={18} className="text-gray-400" /> : <Bell size={18} style={{ color: currentTheme.primary }} />}
            <div>
              <p className="text-sm font-medium settings-text">Toast Notifications</p>
              <p className="text-xs settings-subtext">{settings.notifMuted ? 'Notifications are muted' : 'Show toast pop-ups for actions'}</p>
            </div>
          </div>
          <button
            onClick={() => updateSetting('notifMuted', !settings.notifMuted)}
            className={`relative w-12 h-7 rounded-full transition-colors duration-300`}
            style={{ backgroundColor: settings.notifMuted ? '#d1d5db' : currentTheme.primary }}
          >
            <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300 ${!settings.notifMuted ? 'translate-x-5 right-0.5' : 'left-0.5'}`} />
          </button>
        </div>
      </div>

      {/* Security Section */}
      <div className="settings-card rounded-xl shadow p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg" style={{ backgroundColor: currentTheme.light }}>
            <Lock size={20} style={{ color: currentTheme.primary }} />
          </div>
          <div>
            <h3 className="font-semibold settings-text">Security</h3>
            <p className="text-xs settings-subtext">Manage your account security</p>
          </div>
        </div>

        <button
          onClick={() => setShowPw(!showPw)}
          className="flex items-center justify-between w-full py-3 group"
        >
          <div className="flex items-center gap-3">
            <Lock size={18} className="settings-subtext" />
            <div className="text-left">
              <p className="text-sm font-medium settings-text">Change Password</p>
              <p className="text-xs settings-subtext">Update your account password</p>
            </div>
          </div>
          <ChevronRight size={18} className={`settings-subtext transition-transform ${showPw ? 'rotate-90' : ''}`} />
        </button>

        {showPw && (
          <div className="mt-3 space-y-3 pl-9">
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={pwForm.current_password}
                onChange={e => setPwForm({ ...pwForm, current_password: e.target.value })}
                className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:outline-none settings-input text-sm"
                style={{ '--tw-ring-color': currentTheme.ring }}
                placeholder="Current password"
              />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={pwForm.new_password}
                onChange={e => setPwForm({ ...pwForm, new_password: e.target.value })}
                className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:outline-none settings-input text-sm"
                style={{ '--tw-ring-color': currentTheme.ring }}
                placeholder="New password (min 6 chars)"
              />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <input
              type="password"
              value={pwForm.confirm}
              onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })}
              className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:outline-none settings-input text-sm"
              style={{ '--tw-ring-color': currentTheme.ring }}
              placeholder="Confirm new password"
            />
            <button
              onClick={changePassword}
              className="px-5 py-2.5 text-white rounded-lg text-sm font-medium transition-colors"
              style={{ backgroundColor: currentTheme.primary }}
            >
              Update Password
            </button>
          </div>
        )}
      </div>

      {/* Account info */}
      <div className="settings-card rounded-xl shadow p-4 sm:p-6">
        <p className="text-xs settings-subtext text-center">
          Signed in as <span className="font-medium settings-text">{user?.email}</span>
        </p>
      </div>
    </div>
  );
}
