import toast from 'react-hot-toast';

// Global reference to addNotification (set by NotificationProvider)
let _addNotification = null;
let _isMuted = false;

export function setNotificationHandler(fn) {
  _addNotification = fn;
}

export function setMuted(muted) {
  _isMuted = muted;
}

const notify = {
  success(msg) {
    if (!_isMuted) toast.success(msg);
    _addNotification?.('success', msg);
  },
  error(msg) {
    // Always show errors even when muted
    toast.error(msg);
    _addNotification?.('error', msg);
  },
  info(msg) {
    if (!_isMuted) toast(msg);
    _addNotification?.('info', msg);
  },
};

export default notify;
