import { Router } from 'express';
import crypto from 'crypto';
import db from '../db/database.js';

const router = Router();

// Try to get ngrok public URL
async function getNgrokUrl() {
  try {
    const resp = await fetch('http://127.0.0.1:4040/api/tunnels');
    const data = await resp.json();
    const https = data.tunnels?.find(t => t.public_url?.startsWith('https'));
    return https?.public_url || data.tunnels?.[0]?.public_url || null;
  } catch {
    return null;
  }
}

// Get current token (masked) + public URL
router.get('/', async (req, res) => {
  const user = db.prepare('SELECT api_key, token_name FROM users WHERE id = ?').get(req.user.id);
  const publicUrl = await getNgrokUrl();
  if (!user?.api_key) return res.json({ api_key: null, token_name: null, public_url: publicUrl });
  const key = user.api_key;
  const masked = key.slice(0, 12) + '...' + key.slice(-6);
  res.json({ api_key: masked, token_name: user.token_name || '', created: true, public_url: publicUrl });
});

// Generate new access token
router.post('/generate', (req, res) => {
  // Block free plan users
  const plan = db.prepare('SELECT p.name FROM plans p JOIN users u ON u.plan_id = p.id WHERE u.id = ?').get(req.user.id);
  if (plan?.name === 'free') return res.status(403).json({ error: 'API access is not available on the Free plan. Please upgrade to Starter or Pro.' });

  const { token_name } = req.body;
  if (!token_name || !token_name.trim()) return res.status(400).json({ error: 'Token name is required' });
  const key = 'wapnix_' + crypto.randomBytes(32).toString('hex');
  db.prepare('UPDATE users SET api_key = ?, token_name = ? WHERE id = ?').run(key, token_name.trim(), req.user.id);
  res.json({ api_key: key, token_name: token_name.trim() });
});

// Reveal full token
router.get('/reveal', (req, res) => {
  const user = db.prepare('SELECT api_key FROM users WHERE id = ?').get(req.user.id);
  if (!user?.api_key) return res.status(404).json({ error: 'No API key found' });
  res.json({ api_key: user.api_key });
});

// Revoke token
router.delete('/', (req, res) => {
  db.prepare('UPDATE users SET api_key = NULL, token_name = NULL WHERE id = ?').run(req.user.id);
  res.json({ success: true });
});

export default router;
