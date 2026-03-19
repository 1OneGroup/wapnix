import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const SettingsContext = createContext(null);

const THEMES = [
  { id: 'green', label: 'Default Green', primary: '#16a34a', light: '#f0fdf4', medium: '#bbf7d0', dark: '#15803d', ring: '#22c55e' },
  { id: 'blue', label: 'Ocean Blue', primary: '#2563eb', light: '#eff6ff', medium: '#bfdbfe', dark: '#1d4ed8', ring: '#3b82f6' },
  { id: 'purple', label: 'Royal Purple', primary: '#9333ea', light: '#faf5ff', medium: '#e9d5ff', dark: '#7e22ce', ring: '#a855f7' },
  { id: 'rose', label: 'Rose Pink', primary: '#e11d48', light: '#fff1f2', medium: '#fecdd3', dark: '#be123c', ring: '#f43f5e' },
  { id: 'orange', label: 'Sunset Orange', primary: '#ea580c', light: '#fff7ed', medium: '#fed7aa', dark: '#c2410c', ring: '#f97316' },
  { id: 'teal', label: 'Teal', primary: '#0d9488', light: '#f0fdfa', medium: '#99f6e4', dark: '#0f766e', ring: '#14b8a6' },
  { id: 'indigo', label: 'Indigo', primary: '#4f46e5', light: '#eef2ff', medium: '#c7d2fe', dark: '#4338ca', ring: '#6366f1' },
  { id: 'amber', label: 'Amber Gold', primary: '#d97706', light: '#fffbeb', medium: '#fde68a', dark: '#b45309', ring: '#f59e0b' },
];

const defaults = { theme: 'green', darkMode: false, notifMuted: false };

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('app_settings'));
    return { ...defaults, ...saved };
  } catch { return { ...defaults }; }
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('app_settings', JSON.stringify(settings));
  }, [settings]);

  // Apply dark mode class
  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.darkMode);
  }, [settings.darkMode]);

  // Apply theme CSS variables
  useEffect(() => {
    const theme = THEMES.find(t => t.id === settings.theme) || THEMES[0];
    const root = document.documentElement;
    root.style.setProperty('--color-primary', theme.primary);
    root.style.setProperty('--color-primary-light', theme.light);
    root.style.setProperty('--color-primary-medium', theme.medium);
    root.style.setProperty('--color-primary-dark', theme.dark);
    root.style.setProperty('--color-primary-ring', theme.ring);
  }, [settings.theme]);

  const updateSetting = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const currentTheme = THEMES.find(t => t.id === settings.theme) || THEMES[0];

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, currentTheme, themes: THEMES }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
