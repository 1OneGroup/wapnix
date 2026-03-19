import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket.js';
import api from '../api/client.js';
import toast from '../utils/notify.js';
import { Smartphone, Wifi, WifiOff, QrCode, Phone, Mail, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react';

export default function DeviceLink() {
  const { socket } = useSocket();
  const [status, setStatus] = useState({ status: 'loading' });
  const [qr, setQr] = useState(null);
  const [pairingCode, setPairingCode] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [mode, setMode] = useState('qr'); // 'qr' or 'phone'
  const [phoneNumber, setPhoneNumber] = useState('');
  const [emailCfg, setEmailCfg] = useState({ smtp_host: '', smtp_port: 587, smtp_user: '', smtp_pass: '', from_name: '', from_email: '', enabled: 0 });
  const [emailConnected, setEmailConnected] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);

  useEffect(() => {
    api.get('/session/status').then((res) => setStatus(res.data));
    api.get('/website/email-settings').then(res => {
      setEmailCfg(res.data);
      setEmailConnected(!!res.data.smtp_host && res.data.smtp_host !== '');
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('qr', (qrData) => {
      setQr(qrData);
      setConnecting(false);
    });

    socket.on('pairing-code', (code) => {
      setPairingCode(code);
      setConnecting(false);
    });

    socket.on('session:status', (data) => {
      setStatus(data);
      if (data.status === 'connected') {
        setQr(null);
        setPairingCode(null);
        toast.success('WhatsApp connected!');
      }
    });

    return () => {
      socket.off('qr');
      socket.off('pairing-code');
      socket.off('session:status');
    };
  }, [socket]);

  const handleConnect = async () => {
    if (mode === 'phone') {
      const cleaned = phoneNumber.replace(/[\s\-\+]/g, '');
      if (!cleaned || cleaned.length < 11) {
        toast.error('Country code + number chahiye (e.g. 91 + 9876543210 = 919876543210)');
        return;
      }
      if (cleaned.length === 10) {
        toast.error('Country code missing! India ke liye 91 lagao pehle (e.g. 91' + cleaned + ')');
        return;
      }
    }
    setConnecting(true);
    setQr(null);
    setPairingCode(null);
    try {
      const body = mode === 'phone' ? { phone: phoneNumber } : {};
      await api.post('/session/connect', body);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to connect');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.post('/session/disconnect');
      setStatus({ status: 'disconnected' });
      toast.success('Disconnected');
    } catch (err) {
      toast.error('Failed to disconnect');
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/session/logout');
      setStatus({ status: 'disconnected', number: null });
      toast.success('Logged out from WhatsApp');
    } catch (err) {
      toast.error('Failed to logout');
    }
  };

  const isConnected = status.status === 'connected' || status.connected;

  return (
    <div>
      <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Device Link</h2>

      <div className="bg-white rounded-xl shadow p-5 md:p-8 max-w-lg mx-auto text-center">
        {/* Status indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {isConnected ? (
            <>
              <Wifi className="text-[var(--color-primary)]" size={24} />
              <span className="text-[var(--color-primary)] font-semibold">Connected</span>
              {status.number && (
                <span className="text-gray-500 text-sm ml-2">({status.number})</span>
              )}
            </>
          ) : (
            <>
              <WifiOff className="text-gray-400" size={24} />
              <span className="text-gray-500 font-medium">
                {status.status === 'connecting' ? 'Connecting...' : 'Disconnected'}
              </span>
            </>
          )}
        </div>

        {/* Mode Toggle - only show when not connected */}
        {!isConnected && !connecting && !qr && !pairingCode && (
          <div className="flex justify-center mb-6">
            <div className="inline-flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setMode('qr')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${
                  mode === 'qr'
                    ? 'bg-white text-[var(--color-primary-dark)] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <QrCode size={16} />
                QR Code
              </button>
              <button
                onClick={() => setMode('phone')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${
                  mode === 'phone'
                    ? 'bg-white text-[var(--color-primary-dark)] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Phone size={16} />
                Phone Number
              </button>
            </div>
          </div>
        )}

        {/* QR Code display */}
        {qr && (
          <div className="mb-6">
            <div className="inline-block p-4 bg-white border-2 border-gray-200 rounded-xl">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qr)}`}
                alt="QR Code"
                className="w-48 h-48 sm:w-64 sm:h-64"
              />
            </div>
            <p className="text-sm text-gray-500 mt-3">
              Open WhatsApp &gt; Linked Devices &gt; Link a Device &gt; Scan this QR
            </p>
          </div>
        )}

        {/* Pairing Code display */}
        {pairingCode && (
          <div className="mb-6">
            <div className="inline-block px-8 py-6 bg-[var(--color-primary-light)] border-2 border-[var(--color-primary-medium)] rounded-xl">
              <p className="text-sm text-gray-500 mb-2">Enter this code in WhatsApp</p>
              <p className="text-4xl font-bold tracking-[0.3em] text-[var(--color-primary-dark)] font-mono">
                {pairingCode}
              </p>
            </div>
            <div className="mt-4 text-sm text-gray-500 space-y-1">
              <p>1. Open WhatsApp on your phone</p>
              <p>2. Go to <strong>Settings &gt; Linked Devices</strong></p>
              <p>3. Tap <strong>Link a Device</strong></p>
              <p>4. Tap <strong>"Link with phone number instead"</strong></p>
              <p>5. Enter the code shown above</p>
            </div>
          </div>
        )}

        {/* Phone number input for phone mode */}
        {mode === 'phone' && !isConnected && !connecting && !pairingCode && (
          <div className="mb-6">
            <Phone size={60} className="mx-auto text-gray-300 mb-4" />
            <div className="max-w-xs mx-auto">
              <label className="block text-sm text-gray-600 mb-2 text-left">
                WhatsApp Number (Country Code + Number)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-lg text-gray-400 font-mono">+</span>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="919876543210"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-center text-lg tracking-wide focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:border-[var(--color-primary-ring)] outline-none font-mono"
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                India: <strong>91</strong> + number (e.g. <strong>91</strong>9876543210)
              </p>
            </div>
          </div>
        )}

        {/* QR mode placeholder */}
        {mode === 'qr' && !qr && !isConnected && !connecting && (
          <div className="mb-6">
            <QrCode size={80} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 text-sm">Click Connect to generate a QR code</p>
          </div>
        )}

        {connecting && !qr && !pairingCode && (
          <div className="mb-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)] mx-auto mb-4" />
            <p className="text-gray-500">
              {mode === 'phone' ? 'Generating pairing code...' : 'Generating QR code...'}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          {!isConnected ? (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="px-6 py-2.5 bg-[var(--color-primary)] text-white rounded-lg font-medium hover:bg-[var(--color-primary-dark)] disabled:opacity-50 transition"
            >
              {connecting ? 'Connecting...' : 'Connect'}
            </button>
          ) : (
            <>
              <button
                onClick={handleDisconnect}
                className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition"
              >
                Disconnect
              </button>
              <button
                onClick={handleLogout}
                className="px-6 py-2.5 bg-red-100 text-red-600 rounded-lg font-medium hover:bg-red-200 transition"
              >
                Logout Device
              </button>
            </>
          )}
        </div>
      </div>
      {/* Email / Gmail Link Section */}
      <div className="bg-white rounded-xl shadow p-5 md:p-8 max-w-lg mx-auto mt-6">
        <div className="flex items-center justify-center gap-2 mb-6">
          {emailConnected ? (
            <>
              <CheckCircle className="text-blue-500" size={24} />
              <span className="text-blue-600 font-semibold">Email Connected</span>
              <span className="text-gray-500 text-sm ml-2">({emailCfg.smtp_user})</span>
            </>
          ) : (
            <>
              <Mail className="text-gray-400" size={24} />
              <span className="text-gray-500 font-medium">Email Not Configured</span>
            </>
          )}
        </div>

        <div className="space-y-3 text-left max-w-sm mx-auto">
          {!emailConnected && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-xs font-bold text-blue-700 mb-1">How to get App Password:</p>
              <ol className="text-[10px] text-blue-600 space-y-0.5 list-decimal ml-3">
                <li>Go to <b>myaccount.google.com/security</b></li>
                <li>Enable <b>2-Step Verification</b></li>
                <li>Search <b>"App Passwords"</b> → Generate one</li>
                <li>Copy the 16-digit password below</li>
              </ol>
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500 block mb-0.5">Email Address</label>
            <input value={emailCfg.smtp_user} onChange={e => setEmailCfg(p => ({ ...p, smtp_user: e.target.value, from_email: e.target.value }))}
              placeholder="you@gmail.com or sales@yourdomain.com" className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-0.5">App Password</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} value={emailCfg.smtp_pass} onChange={e => setEmailCfg(p => ({ ...p, smtp_pass: e.target.value }))}
                placeholder="xxxx xxxx xxxx xxxx" className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none pr-10 font-mono" />
              <button onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex gap-2 justify-center pt-2">
            <button onClick={async () => {
              setSavingEmail(true);
              try {
                const email = emailCfg.smtp_user;
                const host = email.includes('@gmail.com') || email.includes('@') ? 'smtp.gmail.com' : 'smtp.gmail.com';
                await api.put('/website/email-settings', { smtp_host: host, smtp_port: 587, smtp_user: email, smtp_pass: emailCfg.smtp_pass, from_name: email.split('@')[0], from_email: email, enabled: 1 });
                setEmailConnected(true);
                setEmailCfg(p => ({ ...p, smtp_host: host, from_email: email, from_name: email.split('@')[0] }));
                toast.success('Email connected!');
              } catch { toast.error('Failed to connect'); }
              finally { setSavingEmail(false); }
            }} disabled={savingEmail || !emailCfg.smtp_user || !emailCfg.smtp_pass}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-2">
              <Mail size={16} /> {savingEmail ? 'Connecting...' : emailConnected ? 'Update' : 'Connect Email'}
            </button>
            {emailConnected && (
              <button onClick={async () => {
                try {
                  await api.put('/website/email-settings', { smtp_host: '', smtp_port: 587, smtp_user: '', smtp_pass: '', from_name: '', from_email: '', enabled: 0 });
                  setEmailConnected(false);
                  setEmailCfg({ smtp_host: '', smtp_port: 587, smtp_user: '', smtp_pass: '', from_name: '', from_email: '', enabled: 0 });
                  toast.success('Email disconnected');
                } catch { toast.error('Failed'); }
              }} className="px-6 py-2.5 bg-red-100 text-red-600 rounded-lg font-medium hover:bg-red-200 transition">
                Disconnect
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
