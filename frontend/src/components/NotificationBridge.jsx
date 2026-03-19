import { useEffect } from 'react';
import { useNotifications } from '../context/NotificationContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { setNotificationHandler, setMuted } from '../utils/notify.js';

export default function NotificationBridge() {
  const { addNotification } = useNotifications();
  const { settings } = useSettings();

  useEffect(() => {
    setNotificationHandler(addNotification);
  }, [addNotification]);

  useEffect(() => {
    setMuted(settings.notifMuted);
  }, [settings.notifMuted]);

  return null;
}
