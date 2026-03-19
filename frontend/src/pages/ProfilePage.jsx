import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import api from '../api/client.js';
import toast from '../utils/notify.js';
import {
  User, Mail, Phone, Building2, FileText, Calendar, Shield, Crown,
  Camera, Pencil, Save, X, Lock, Eye, EyeOff, MessageSquare, Users,
  Layout, Wifi, WifiOff, Trash2, LogOut, Zap, Star, Rocket, Infinity,
  ArrowUpRight, Check, ArrowRight,
} from 'lucide-react';

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

export default function ProfilePage() {
  const { currentTheme } = useSettings();
  const { user: authUser, refreshUser, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', company: '', bio: '' });
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [showPwSection, setShowPwSection] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [plans, setPlans] = useState([]);
  const [upgrading, setUpgrading] = useState(false);

  async function fetchProfile() {
    try {
      const res = await api.get('/profile');
      setProfile(res.data);
      setForm({ name: res.data.name || '', phone: res.data.phone || '', company: res.data.company || '', bio: res.data.bio || '' });
    } catch { toast.error('Failed to load profile'); }
  }

  async function fetchPlans() {
    try {
      const res = await api.get('/profile/plans');
      setPlans(res.data.plans);
    } catch { toast.error('Failed to load plans'); }
  }

  useEffect(() => { fetchProfile(); }, []);

  async function saveProfile() {
    try {
      await api.put('/profile', form);
      toast.success('Profile updated');
      setEditing(false);
      fetchProfile();
      refreshUser();
    } catch { toast.error('Failed to update profile'); }
  }

  async function changePassword() {
    if (pwForm.new_password !== pwForm.confirm) return toast.error('Passwords do not match');
    if (pwForm.new_password.length < 6) return toast.error('Password must be at least 6 characters');
    try {
      await api.put('/profile/password', { current_password: pwForm.current_password, new_password: pwForm.new_password });
      toast.success('Password changed successfully');
      setPwForm({ current_password: '', new_password: '', confirm: '' });
      setShowPwSection(false);
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to change password'); }
  }

  async function uploadImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    setUploading(true);
    try {
      await api.post('/profile/image', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Profile image updated');
      fetchProfile();
      refreshUser();
    } catch { toast.error('Failed to upload image'); }
    finally { setUploading(false); }
  }

  async function deleteImage() {
    if (!confirm('Remove profile image?')) return;
    try {
      await api.delete('/profile/image');
      toast.success('Profile image removed');
      fetchProfile();
      refreshUser();
    } catch { toast.error('Failed to remove image'); }
  }

  async function upgradePlan(planId) {
    setUpgrading(true);
    try {
      const res = await api.post('/profile/upgrade', { plan_id: planId });
      toast.success(res.data.message || 'Plan upgraded!');
      setShowUpgrade(false);
      fetchProfile();
      refreshUser();
    } catch (err) { toast.error(err.response?.data?.error || 'Upgrade failed'); }
    finally { setUpgrading(false); }
  }

  function openUpgrade() {
    fetchPlans();
    setShowUpgrade(true);
  }

  if (!profile) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]" /></div>;

  const memberSince = profile.created_at ? new Date(profile.created_at + 'Z').toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
  const initials = (profile.name || profile.email || '?').slice(0, 2).toUpperCase();
  const pm = PLAN_META[profile.plan_name] || PLAN_META.free;
  const PIcon = pm.icon;
  const isUn = profile.plan_name === 'business' || profile.is_superadmin;

  return (
    <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
      <h1 className="text-xl md:text-2xl font-bold text-gray-800">My Profile</h1>

      {/* Profile Header Card */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="h-32 relative" style={{ background: `linear-gradient(to right, ${currentTheme.primary}, ${currentTheme.dark})` }}>
          <div className="absolute top-4 right-4">
            {profile.is_superadmin ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/20 backdrop-blur text-white text-xs font-semibold rounded-full">
                <Crown size={14} /> Super Admin
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/20 backdrop-blur text-white text-xs font-semibold rounded-full">
                <PIcon size={14} /> {pm.label} Plan
              </span>
            )}
          </div>
        </div>

        <div className="px-4 md:px-6 pb-4 md:pb-6 -mt-16 relative">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            <div className="relative group">
              {profile.profile_image ? (
                <img src={profile.profile_image} alt="Profile" className="w-28 h-28 rounded-xl border-4 border-white shadow-lg object-cover" />
              ) : (
                <div className="w-28 h-28 rounded-xl border-4 border-white shadow-lg bg-[var(--color-primary-light)] flex items-center justify-center">
                  <span className="text-3xl font-bold text-[var(--color-primary)]">{initials}</span>
                </div>
              )}
              <div className="absolute inset-0 rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                <button onClick={() => fileRef.current?.click()} className="p-2 bg-white rounded-full text-gray-700 hover:bg-gray-100" title="Upload photo">
                  <Camera size={16} />
                </button>
                {profile.profile_image && (
                  <button onClick={deleteImage} className="p-2 bg-white rounded-full text-red-500 hover:bg-red-50" title="Remove photo">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadImage} className="hidden" />
              {uploading && <div className="absolute inset-0 rounded-xl bg-white/70 flex items-center justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--color-primary)]" /></div>}
            </div>

            <div className="flex-1 pt-2">
              <h2 className="text-xl font-bold text-gray-800">{profile.name || 'No name set'}</h2>
              <p className="text-sm text-gray-500 flex items-center gap-1"><Mail size={14} /> {profile.email}</p>
              {profile.company && <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5"><Building2 size={14} /> {profile.company}</p>}
            </div>

            <button
              onClick={() => setEditing(!editing)}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${editing ? 'bg-gray-200 text-gray-700' : 'text-white hover:bg-[var(--color-primary-dark)]'}`}
              style={!editing ? { backgroundColor: currentTheme.primary } : undefined}
            >
              {editing ? <><X size={16} /> Cancel</> : <><Pencil size={16} /> Edit Profile</>}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {editing ? (
            <div className="bg-white rounded-xl shadow p-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">Edit Profile</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Full Name</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:outline-none" placeholder="Your full name" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Phone Number</label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:outline-none" placeholder="+91 98765 43210" />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-600 mb-1">Company / Organization</label>
                  <div className="relative">
                    <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:outline-none" placeholder="Your company name" />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-600 mb-1">Bio</label>
                  <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} rows={3} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:outline-none resize-none" placeholder="Tell us about yourself..." />
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={saveProfile} className="px-6 py-2 text-white rounded-lg hover:bg-[var(--color-primary-dark)] flex items-center gap-2 text-sm font-medium" style={{ backgroundColor: currentTheme.primary }}>
                  <Save size={16} /> Save Changes
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Personal Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                <InfoRow icon={User} label="Full Name" value={profile.name || '—'} />
                <InfoRow icon={Mail} label="Email" value={profile.email} />
                <InfoRow icon={Phone} label="Phone" value={profile.phone || '—'} />
                <InfoRow icon={Building2} label="Company" value={profile.company || '—'} />
                <InfoRow icon={Calendar} label="Member Since" value={memberSince} />
                <InfoRow icon={profile.whatsapp_status === 'connected' ? Wifi : WifiOff} label="WhatsApp" value={profile.whatsapp_number ? `${profile.whatsapp_number} (${profile.whatsapp_status})` : profile.whatsapp_status} />
              </div>
              {profile.bio && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-1"><FileText size={14} /> Bio</p>
                  <p className="text-sm text-gray-700">{profile.bio}</p>
                </div>
              )}
            </div>
          )}

          {/* Change Password */}
          <div className="bg-white rounded-xl shadow p-6">
            <button onClick={() => setShowPwSection(!showPwSection)} className="flex items-center gap-2 text-sm font-semibold text-gray-800 hover:text-[var(--color-primary)] transition">
              <Lock size={18} /> Change Password
            </button>
            {showPwSection && (
              <div className="mt-4 space-y-3">
                <div className="relative">
                  <input type={showCurrent ? 'text' : 'password'} value={pwForm.current_password} onChange={e => setPwForm({ ...pwForm, current_password: e.target.value })} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:outline-none pr-10" placeholder="Current password" />
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
                <div className="relative">
                  <input type={showNew ? 'text' : 'password'} value={pwForm.new_password} onChange={e => setPwForm({ ...pwForm, new_password: e.target.value })} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:outline-none pr-10" placeholder="New password (min 6 chars)" />
                  <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showNew ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
                <input type="password" value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:outline-none" placeholder="Confirm new password" />
                <button onClick={changePassword} className="px-5 py-2 text-white rounded-lg hover:bg-[var(--color-primary-dark)] text-sm font-medium" style={{ backgroundColor: currentTheme.primary }}>Update Password</button>
              </div>
            )}
          </div>
        </div>

        {/* Right column - Stats & Plan */}
        <div className="space-y-6">
          {/* Plan Card */}
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-800">Current Plan</h3>
              {!profile.is_superadmin && profile.plan_name !== 'business' && (
                <button onClick={openUpgrade}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors hover:opacity-90 text-white"
                  style={{ backgroundColor: currentTheme.primary }}>
                  <ArrowUpRight size={14} /> Upgrade
                </button>
              )}
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold mb-4"
              style={{ backgroundColor: pm.color + '15', color: pm.color }}>
              <PIcon size={16} /> {pm.label}
              {isUn && <Infinity size={14} />}
            </div>

            {profile.monthly_price > 0 && (
              <p className="text-xs text-gray-400 mb-3">₹{profile.monthly_price.toLocaleString('en-IN')}/month</p>
            )}

            <div className="space-y-3 text-sm">
              <PlanRow label="Daily Limit"
                value={isUn ? `${profile.messages_today} sent` : `${profile.messages_today} / ${profile.daily_limit}`}
                pct={isUn ? 0 : (profile.daily_limit ? (profile.messages_today / profile.daily_limit) * 100 : 0)}
                unlimited={isUn} />
              <PlanRow label="Monthly Limit" value={formatLimit(profile.monthly_limit)} unlimited={isUn} />
              <PlanRow label="Max Contacts" value={formatLimit(profile.max_contacts)} unlimited={isUn} />
              <PlanRow label="Max Templates" value={formatLimit(profile.max_templates)} unlimited={isUn} />
            </div>
          </div>

          {/* Usage Stats */}
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Usage Stats</h3>
            <div className="space-y-3">
              <StatRow icon={MessageSquare} label="Total Messages" value={profile.total_messages} color="text-[var(--color-primary)]" />
              <StatRow icon={Users} label="Total Contacts" value={profile.total_contacts} color="text-blue-600" />
              <StatRow icon={Layout} label="Total Templates" value={profile.total_templates} color="text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Logout button - mobile only */}
      <div className="md:hidden">
        <button onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white rounded-xl shadow text-red-600 font-medium text-sm hover:bg-red-50 transition">
          <LogOut size={18} /> Logout
        </button>
      </div>

      {/* ========== UPGRADE MODAL ========== */}
      {showUpgrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowUpgrade(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Upgrade Your Plan</h2>
                <p className="text-xs text-gray-500">Choose a plan that fits your business needs</p>
              </div>
              <button onClick={() => setShowUpgrade(false)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400">
                <X size={20} />
              </button>
            </div>

            {/* Plan Cards */}
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {plans.map(plan => {
                  const meta = PLAN_META[plan.name] || PLAN_META.free;
                  const PIco = meta.icon;
                  const isCurrent = plan.id === profile.plan_id;
                  const isUpgrade = plan.monthly_price > (profile.monthly_price || 0);
                  const isDowngrade = plan.monthly_price < (profile.monthly_price || 0);
                  const planIsUnlimited = plan.daily_limit >= 999999;

                  return (
                    <div key={plan.id}
                      className={`rounded-xl border-2 p-5 flex flex-col transition-all ${isCurrent ? 'ring-2 ring-offset-2' : 'hover:shadow-lg'}`}
                      style={{
                        borderColor: isCurrent ? meta.color : '#e5e7eb',
                        ringColor: isCurrent ? meta.color : undefined,
                      }}>
                      {/* Plan Header */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: meta.color + '15' }}>
                          <PIco size={20} style={{ color: meta.color }} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-base text-gray-900">{meta.label}</h3>
                            {isCurrent && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold text-white" style={{ backgroundColor: meta.color }}>
                                Current
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">
                            {plan.monthly_price > 0 ? `₹${plan.monthly_price.toLocaleString('en-IN')}/mo` : 'Free forever'}
                          </p>
                        </div>
                      </div>

                      {/* Price */}
                      {plan.monthly_price > 0 && (
                        <div className="mb-3">
                          <div className="flex items-baseline gap-1">
                            <span className="text-sm text-gray-400">₹</span>
                            <span className="text-3xl font-extrabold text-gray-900">{plan.monthly_price.toLocaleString('en-IN')}</span>
                            <span className="text-xs text-gray-400">/month</span>
                          </div>
                          {plan.yearly_price > 0 && (
                            <p className="text-[10px] text-green-600 mt-0.5">
                              Save ₹{((plan.monthly_price * 12) - plan.yearly_price).toLocaleString('en-IN')}/yr with yearly
                            </p>
                          )}
                        </div>
                      )}

                      {/* Features */}
                      <div className="space-y-2 flex-1 mb-4">
                        {[
                          { label: 'Messages/day', value: formatLimit(plan.daily_limit) },
                          { label: 'Contacts', value: formatLimit(plan.max_contacts) },
                          { label: 'Templates', value: formatLimit(plan.max_templates) },
                          { label: 'Chatbot Flows', value: plan.max_chatbots === -1 ? 'Unlimited' : plan.max_chatbots },
                          { label: 'API Access', value: plan.name !== 'free' },
                        ].map(f => (
                          <div key={f.label} className="flex items-center gap-2">
                            <Check size={14} style={{ color: meta.color }} />
                            <span className="text-xs text-gray-600">
                              <span className="font-medium">{typeof f.value === 'boolean' ? (f.value ? 'Yes' : 'No') : f.value}</span> {f.label}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Action Button */}
                      {isCurrent ? (
                        <div className="py-2.5 text-center text-sm font-medium rounded-xl border-2" style={{ borderColor: meta.color, color: meta.color }}>
                          Current Plan
                        </div>
                      ) : (
                        <button
                          onClick={() => upgradePlan(plan.id)}
                          disabled={upgrading}
                          className="py-2.5 text-center text-sm font-semibold rounded-xl text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
                          style={{ backgroundColor: isUpgrade ? meta.color : '#6b7280' }}>
                          {upgrading ? 'Processing...' : isUpgrade ? (
                            <><ArrowUpRight size={16} /> Upgrade to {meta.label}</>
                          ) : (
                            <><ArrowRight size={16} /> Switch to {meta.label}</>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bottom note */}
              <div className="mt-4 text-center">
                <p className="text-[11px] text-gray-400">
                  Plan changes take effect immediately. Contact admin for billing queries.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={16} className="text-gray-500" />
      </div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-gray-800">{value}</p>
      </div>
    </div>
  );
}

function PlanRow({ label, value, pct, unlimited }) {
  return (
    <div>
      <div className="flex justify-between text-gray-600 mb-1">
        <span>{label}</span>
        <span className="font-medium text-gray-800 flex items-center gap-1">
          {value === 'Unlimited' ? (
            <><Infinity size={14} className="text-amber-500" /> <span className="text-amber-600">Unlimited</span></>
          ) : value}
        </span>
      </div>
      {pct !== undefined && !unlimited && (
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div className={`h-1.5 rounded-full transition-all ${pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-yellow-500' : 'bg-[var(--color-primary)]'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      )}
    </div>
  );
}

function StatRow({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-gray-600">
        <Icon size={16} className={color} />
        <span>{label}</span>
      </div>
      <span className="font-bold text-gray-800">{value}</span>
    </div>
  );
}
