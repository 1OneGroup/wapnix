import { Router } from 'express';
import sessionManager from '../services/sessionManager.js';

const router = Router();

router.post('/connect', async (req, res) => {
  try {
    const { phone } = req.body || {};
    const opts = {};
    if (phone) {
      // Clean phone number: remove +, spaces, dashes
      opts.pairingPhone = phone.replace(/[\s\-\+]/g, '');
    }
    const status = await sessionManager.startSession(req.user.id, opts);
    res.json({ success: true, mode: phone ? 'pairing-code' : 'qr', ...status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/disconnect', async (req, res) => {
  try {
    await sessionManager.stopSession(req.user.id);
    res.json({ success: true, status: 'disconnected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/logout', async (req, res) => {
  try {
    await sessionManager.logoutSession(req.user.id);
    res.json({ success: true, status: 'logged_out' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/status', (req, res) => {
  const status = sessionManager.getSessionStatus(req.user.id);
  const queue = sessionManager.getQueue(req.user.id);
  res.json({
    ...status,
    queue: queue ? queue.getStats() : null,
  });
});

export default router;
