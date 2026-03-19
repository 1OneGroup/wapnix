import { Router } from 'express';
import db from '../db/database.js';
import { normalizePhone } from '../shared/phoneUtils.js';
import sessionManager from '../services/sessionManager.js';
import { incrementDailyUsage } from '../middleware/rateLimiter.js';
import { initConversation, addAllowedPhone } from '../services/chatbotEngine.js';
import nodemailer from 'nodemailer';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const emailUploadsDir = path.join(__dirname, '..', 'uploads', 'email-attachments');
if (!fs.existsSync(emailUploadsDir)) fs.mkdirSync(emailUploadsDir, { recursive: true });

const emailUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, emailUploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const router = Router();

// ── Public Webhook (no auth needed) ──
// Website forms POST here to submit leads
router.post('/webhook/:apiKey', (req, res) => {
  try {
    const { apiKey } = req.params;
    const user = db.prepare('SELECT id FROM users WHERE api_key = ?').get(apiKey);
    if (!user) return res.status(401).json({ error: 'Invalid API key' });

    const { name, email, phone, message, page_url, source, ...extra } = req.body;
    if (!phone && !email) return res.status(400).json({ error: 'Phone or email required' });

    db.prepare(
      'INSERT INTO website_leads (user_id, source, page_url, name, email, phone, message, extra_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(user.id, source || 'website', page_url || '', name || '', email || '', phone || '', message || '', JSON.stringify(extra || {}));

    // Check auto-send settings
    const autoSend = db.prepare('SELECT * FROM website_auto_send WHERE user_id = ?').get(user.id);
    if (autoSend && autoSend.mode !== 'off' && phone) {
      const normalized = normalizePhone(String(phone));
      if (normalized && normalized.length >= 10) {
        const session = sessionManager.getSession(user.id);
        if (session && session.isConnected) {
          const jid = normalized + '@s.whatsapp.net';
          // Auto greeting based on IST time
          const istHour = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getHours();
          const greeting = istHour >= 5 && istHour < 12 ? 'Good Morning' : istHour >= 12 && istHour < 17 ? 'Good Afternoon' : 'Good Evening';

          const leadData = { name: name || '', phone: phone || '', email: email || '', source: source || '', page_url: page_url || '', message: message || '', greeting, ...extra };

          if (autoSend.mode === 'message' && autoSend.message_template) {
            // Send direct message
            let body = autoSend.message_template;
            for (const [k, v] of Object.entries(leadData)) {
              body = body.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'gi'), String(v || ''));
            }

            // Send attachments first
            (async () => {
              try {
                const msgFiles = JSON.parse(autoSend.msg_attachments || '[]');
                for (const f of msgFiles) {
                  const filePath = path.join(__dirname, '..', f.url.startsWith('/') ? f.url.slice(1) : f.url);
                  if (fs.existsSync(filePath)) {
                    const fileBuffer = fs.readFileSync(filePath);
                    const ext = (f.name || '').toLowerCase();
                    if (ext.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                      await session.sock.sendMessage(jid, { image: fileBuffer, caption: '' });
                    } else {
                      await session.sock.sendMessage(jid, { document: fileBuffer, fileName: f.name, mimetype: 'application/octet-stream' });
                    }
                    await new Promise(r => setTimeout(r, 2000));
                  }
                }
              } catch (err) { console.error('[webhook-auto] Attachment error:', err.message); }
            })().then(() => {
              // Then send text message
              return session.sock.sendMessage(jid, { text: body });
            }).then(() => {
              incrementDailyUsage(user.id);
              db.prepare('UPDATE website_leads SET status = ?, whatsapp_sent = 1 WHERE user_id = ? AND phone = ? ORDER BY id DESC LIMIT 1').run('contacted', user.id, phone);
              console.log(`[webhook-auto] Message sent to ${normalized}`);
            }).catch(err => console.error(`[webhook-auto] Failed:`, err.message));

          } else if (autoSend.mode === 'chatbot' && autoSend.flow_id) {
            // Start chatbot flow
            const flowRow = db.prepare('SELECT * FROM chatbot_flows WHERE id = ? AND user_id = ?').get(autoSend.flow_id, user.id);
            if (flowRow) {
              const flow = { ...flowRow, steps: JSON.parse(flowRow.steps_json) };
              const firstStep = flow.steps[0];
              if (firstStep) {
                let varMap = {};
                try { varMap = JSON.parse(autoSend.var_mapping || '{}'); } catch {}
                // Build contact data with mapping
                const contactData = { ...leadData };
                for (const [flowVar, val] of Object.entries(varMap)) {
                  contactData[flowVar] = val;
                }
                // Replace variables in first message
                let body = firstStep.message;
                for (const [k, v] of Object.entries(contactData)) {
                  body = body.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'gi'), String(v || ''));
                }
                session.sock.sendMessage(jid, { text: body }).then(() => {
                  incrementDailyUsage(user.id);
                  addAllowedPhone(user.id, normalized);
                  initConversation(user.id, normalized, flow.id, firstStep.id, contactData);
                  db.prepare('UPDATE website_leads SET status = ?, whatsapp_sent = 1 WHERE user_id = ? AND phone = ? ORDER BY id DESC LIMIT 1').run('contacted', user.id, phone);
                  console.log(`[webhook-auto] Chatbot started for ${normalized} (flow: ${flow.name})`);
                }).catch(err => console.error(`[webhook-auto] Chatbot failed:`, err.message));
              }
            }
          }
        }
      }
    }

    // Auto-email if enabled
    if (autoSend && autoSend.email_enabled && email) {
      const emailCfg = db.prepare('SELECT * FROM email_settings WHERE user_id = ?').get(user.id);
      if (emailCfg && emailCfg.smtp_host) {
        try {
          const istHr2 = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getHours();
          const greet2 = istHr2 >= 5 && istHr2 < 12 ? 'Good Morning' : istHr2 >= 12 && istHr2 < 17 ? 'Good Afternoon' : 'Good Evening';
          const leadVars = { name: name || '', phone: phone || '', email: email || '', source: source || '', greeting: greet2, message: message || '' };

          let subj = autoSend.email_subject || 'Thank you for your interest';
          let body = autoSend.email_body || `Dear {{name}},\n\nThank you for reaching out. Our team will get back to you shortly.`;
          for (const [k, v] of Object.entries(leadVars)) {
            subj = subj.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'gi'), String(v || ''));
            body = body.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'gi'), String(v || ''));
          }

          const bodyLines = body.split('\n');
          let bodyHtml = '';
          for (const line of bodyLines) {
            if (line.trim() === '') bodyHtml += '<br>';
            else bodyHtml += `<p style="margin:0 0 8px;color:#333;font-size:15px;line-height:1.7;">${line}</p>`;
          }

          const htmlEmail = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;"><div style="max-width:600px;margin:0 auto;background:#fff;"><div style="background:#fff;padding:24px 24px 16px;border-bottom:3px solid #C42025;text-align:center;"><h1 style="margin:0;font-size:28px;"><span style="color:#C42025;font-weight:800;">ONE</span> <span style="color:#4D4D4D;font-weight:600;">GROUP</span></h1><p style="margin:4px 0 0;font-size:10px;color:#999;letter-spacing:3px;text-transform:uppercase;">The One You Can Trust</p></div><div style="padding:32px 24px;">${bodyHtml}</div><div style="padding:0 24px 24px;text-align:center;"><a href="https://onegroupdevelopers.com" style="display:inline-block;background:#C42025;color:#fff;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:14px;font-weight:600;">Visit Our Website</a></div><div style="background:#f8f8f8;padding:20px 24px;border-top:1px solid #eee;text-align:center;"><p style="margin:0 0 4px;font-size:13px;color:#666;"><strong style="color:#C42025;">ONE</strong> <strong style="color:#4D4D4D;">GROUP</strong> Developers</p><p style="margin:0 0 4px;font-size:12px;color:#999;">+91 88752 21116 | +91 977 977 1130</p><p style="margin:0;font-size:12px;color:#999;">onegroupdevelopers.com</p></div></div></body></html>`;

          const transporter = nodemailer.createTransport({
            host: emailCfg.smtp_host, port: emailCfg.smtp_port,
            secure: emailCfg.smtp_port === 465,
            auth: { user: emailCfg.smtp_user, pass: emailCfg.smtp_pass },
          });
          // Build attachments from saved files
          let autoAttachments = [];
          try {
            const savedFiles = JSON.parse(autoSend.email_attachments || '[]');
            for (const f of savedFiles) {
              const filePath = path.join(__dirname, '..', f.url.startsWith('/') ? f.url.slice(1) : f.url);
              if (fs.existsSync(filePath)) {
                autoAttachments.push({ filename: f.name, path: filePath });
              }
            }
          } catch {}

          transporter.sendMail({
            from: `"${emailCfg.from_name || 'ONE Group'}" <${emailCfg.from_email || emailCfg.smtp_user}>`,
            to: email, subject: subj, text: body, html: htmlEmail, attachments: autoAttachments,
          }).then(() => console.log(`[webhook-auto] Email sent to ${email} with ${autoAttachments.length} attachments`))
            .catch(err => console.error(`[webhook-auto] Email failed:`, err.message));
        } catch (err) { console.error('[webhook-auto] Email error:', err.message); }
      }
    }

    res.json({ success: true, message: 'Lead received' });
  } catch (err) {
    console.error('[webhook] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Authenticated Routes ──

// Get all leads
router.get('/leads', (req, res) => {
  const userId = req.user.id;
  const { status, page, limit: lim } = req.query;
  const limit = parseInt(lim) || 50;
  const offset = ((parseInt(page) || 1) - 1) * limit;

  let query = 'SELECT * FROM website_leads WHERE user_id = ?';
  const params = [userId];
  if (status && status !== 'all') {
    query += ' AND status = ?';
    params.push(status);
  }
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const leads = db.prepare(query).all(...params);
  const total = db.prepare('SELECT COUNT(*) as c FROM website_leads WHERE user_id = ?').get(userId).c;
  const counts = {
    new: db.prepare('SELECT COUNT(*) as c FROM website_leads WHERE user_id = ? AND status = ?').get(userId, 'new').c,
    contacted: db.prepare('SELECT COUNT(*) as c FROM website_leads WHERE user_id = ? AND status = ?').get(userId, 'contacted').c,
    converted: db.prepare('SELECT COUNT(*) as c FROM website_leads WHERE user_id = ? AND status = ?').get(userId, 'converted').c,
    ignored: db.prepare('SELECT COUNT(*) as c FROM website_leads WHERE user_id = ? AND status = ?').get(userId, 'ignored').c,
  };

  res.json({ leads, total, counts });
});

// Update lead status
router.put('/leads/:id/status', (req, res) => {
  const { status } = req.body;
  if (!['new', 'contacted', 'converted', 'ignored'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  db.prepare('UPDATE website_leads SET status = ? WHERE id = ? AND user_id = ?').run(status, req.params.id, req.user.id);
  res.json({ success: true });
});

// Delete lead
router.delete('/leads/:id', (req, res) => {
  db.prepare('DELETE FROM website_leads WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// Send WhatsApp to lead
router.post('/leads/:id/send', async (req, res) => {
  const userId = req.user.id;
  const lead = db.prepare('SELECT * FROM website_leads WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  const phone = normalizePhone(String(lead.phone || ''));
  if (!phone || phone.length < 10) return res.status(400).json({ error: 'Invalid phone number' });

  const session = sessionManager.getSession(userId);
  if (!session || !session.isConnected) return res.status(400).json({ error: 'WhatsApp not connected' });

  try {
    const istH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getHours();
    const greet = istH >= 5 && istH < 12 ? 'Good Morning' : istH >= 12 && istH < 17 ? 'Good Afternoon' : 'Good Evening';

    let body = message
      .replace(/\{\{name\}\}/gi, lead.name || '')
      .replace(/\{\{email\}\}/gi, lead.email || '')
      .replace(/\{\{phone\}\}/gi, lead.phone || '')
      .replace(/\{\{message\}\}/gi, lead.message || '')
      .replace(/\{\{source\}\}/gi, lead.source || '')
      .replace(/\{\{page_url\}\}/gi, lead.page_url || '')
      .replace(/\{\{greeting\}\}/gi, greet);

    const jid = phone + '@s.whatsapp.net';
    await session.sock.sendMessage(jid, { text: body });
    incrementDailyUsage(userId);

    db.prepare('UPDATE website_leads SET status = ?, whatsapp_sent = whatsapp_sent + 1 WHERE id = ?').run('contacted', lead.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk send to all new leads
router.post('/leads/bulk-send', async (req, res) => {
  const userId = req.user.id;
  const { message, status_filter } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  const filter = status_filter || 'new';
  const leads = db.prepare('SELECT * FROM website_leads WHERE user_id = ? AND status = ? AND phone != ""').all(userId, filter);
  if (leads.length === 0) return res.status(400).json({ error: 'No leads found' });

  const session = sessionManager.getSession(userId);
  if (!session || !session.isConnected) return res.status(400).json({ error: 'WhatsApp not connected' });

  const istHr = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getHours();
  const bulkGreet = istHr >= 5 && istHr < 12 ? 'Good Morning' : istHr >= 12 && istHr < 17 ? 'Good Afternoon' : 'Good Evening';

  let sent = 0, failed = 0;
  for (const lead of leads) {
    const phone = normalizePhone(String(lead.phone || ''));
    if (!phone || phone.length < 10) { failed++; continue; }

    let body = message
      .replace(/\{\{name\}\}/gi, lead.name || '')
      .replace(/\{\{email\}\}/gi, lead.email || '')
      .replace(/\{\{phone\}\}/gi, lead.phone || '')
      .replace(/\{\{message\}\}/gi, lead.message || '')
      .replace(/\{\{source\}\}/gi, lead.source || '')
      .replace(/\{\{page_url\}\}/gi, lead.page_url || '')
      .replace(/\{\{greeting\}\}/gi, bulkGreet);

    try {
      await new Promise(r => setTimeout(r, 15000));
      const jid = phone + '@s.whatsapp.net';
      await session.sock.sendMessage(jid, { text: body });
      incrementDailyUsage(userId);
      db.prepare('UPDATE website_leads SET status = ?, whatsapp_sent = whatsapp_sent + 1 WHERE id = ?').run('contacted', lead.id);
      sent++;
    } catch { failed++; }
  }

  res.json({ success: true, sent, failed, total: leads.length });
});

// Get webhook URL info
router.get('/webhook-info', (req, res) => {
  const user = db.prepare('SELECT api_key FROM users WHERE id = ?').get(req.user.id);
  res.json({
    api_key: user?.api_key || null,
    webhook_url: user?.api_key ? `/api/website/webhook/${user.api_key}` : null,
  });
});

// ── Auto-Send Settings ──

// Get auto-send settings
router.get('/auto-send', (req, res) => {
  const settings = db.prepare('SELECT * FROM website_auto_send WHERE user_id = ?').get(req.user.id);
  res.json(settings || { mode: 'off', message_template: '', flow_id: null, var_mapping: '{}' });
});

// Update auto-send settings
router.put('/auto-send', (req, res) => {
  const { mode, message_template, flow_id, var_mapping, email_enabled, email_subject, email_body, email_attachments, msg_attachments } = req.body;
  const existing = db.prepare('SELECT id FROM website_auto_send WHERE user_id = ?').get(req.user.id);
  if (existing) {
    db.prepare('UPDATE website_auto_send SET mode = ?, message_template = ?, flow_id = ?, var_mapping = ?, email_enabled = ?, email_subject = ?, email_body = ?, email_attachments = ?, msg_attachments = ? WHERE user_id = ?')
      .run(mode || 'off', message_template || '', flow_id || null, var_mapping || '{}', email_enabled ? 1 : 0, email_subject || '', email_body || '', email_attachments || '[]', msg_attachments || '[]', req.user.id);
  } else {
    db.prepare('INSERT INTO website_auto_send (user_id, mode, message_template, flow_id, var_mapping, email_enabled, email_subject, email_body, email_attachments, msg_attachments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(req.user.id, mode || 'off', message_template || '', flow_id || null, var_mapping || '{}', email_enabled ? 1 : 0, email_subject || '', email_body || '', email_attachments || '[]', msg_attachments || '[]');
  }
  res.json({ success: true });
});

// ── Email Settings ──

router.get('/email-settings', (req, res) => {
  const settings = db.prepare('SELECT * FROM email_settings WHERE user_id = ?').get(req.user.id);
  if (settings) { settings.smtp_pass = settings.smtp_pass ? '****' : ''; }
  res.json(settings || { smtp_host: '', smtp_port: 587, smtp_user: '', smtp_pass: '', from_name: '', from_email: '', enabled: 0 });
});

router.put('/email-settings', (req, res) => {
  const { smtp_host, smtp_port, smtp_user, smtp_pass, from_name, from_email, enabled } = req.body;
  const existing = db.prepare('SELECT id, smtp_pass FROM email_settings WHERE user_id = ?').get(req.user.id);
  const pass = smtp_pass === '****' ? existing?.smtp_pass || '' : smtp_pass || '';
  if (existing) {
    db.prepare('UPDATE email_settings SET smtp_host=?, smtp_port=?, smtp_user=?, smtp_pass=?, from_name=?, from_email=?, enabled=? WHERE user_id=?')
      .run(smtp_host, smtp_port || 587, smtp_user, pass, from_name, from_email, enabled ? 1 : 0, req.user.id);
  } else {
    db.prepare('INSERT INTO email_settings (user_id, smtp_host, smtp_port, smtp_user, smtp_pass, from_name, from_email, enabled) VALUES (?,?,?,?,?,?,?,?)')
      .run(req.user.id, smtp_host, smtp_port || 587, smtp_user, pass, from_name, from_email, enabled ? 1 : 0);
  }
  res.json({ success: true });
});

// Send email to a lead (with optional attachments)
router.post('/leads/:id/email', emailUpload.array('attachments', 5), async (req, res) => {
  const lead = db.prepare('SELECT * FROM website_leads WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (!lead.email) return res.status(400).json({ error: 'Lead has no email' });

  const { subject, body } = req.body;
  if (!subject || !body) return res.status(400).json({ error: 'Subject and body required' });

  const settings = db.prepare('SELECT * FROM email_settings WHERE user_id = ?').get(req.user.id);
  if (!settings || !settings.smtp_host) return res.status(400).json({ error: 'Email not configured. Go to Setup → Email Settings.' });

  try {
    const istH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getHours();
    const greet = istH >= 5 && istH < 12 ? 'Good Morning' : istH >= 12 && istH < 17 ? 'Good Afternoon' : 'Good Evening';

    let finalBody = body
      .replace(/\{\{name\}\}/gi, lead.name || '')
      .replace(/\{\{email\}\}/gi, lead.email || '')
      .replace(/\{\{phone\}\}/gi, lead.phone || '')
      .replace(/\{\{source\}\}/gi, lead.source || '')
      .replace(/\{\{message\}\}/gi, lead.message || '')
      .replace(/\{\{greeting\}\}/gi, greet);

    let finalSubject = subject
      .replace(/\{\{name\}\}/gi, lead.name || '')
      .replace(/\{\{greeting\}\}/gi, greet);

    const transporter = nodemailer.createTransport({
      host: settings.smtp_host,
      port: settings.smtp_port,
      secure: settings.smtp_port === 465,
      auth: { user: settings.smtp_user, pass: settings.smtp_pass },
    });

    // Build professional HTML email
    const bodyLines = finalBody.split('\n');
    let bodyHtml = '';
    for (const line of bodyLines) {
      if (line.trim() === '') bodyHtml += '<br>';
      else bodyHtml += `<p style="margin:0 0 8px 0;color:#333;font-size:15px;line-height:1.7;">${line}</p>`;
    }

    const htmlEmail = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;">
  <!-- Header -->
  <div style="background:#ffffff;padding:24px 24px 16px;border-bottom:3px solid #C42025;text-align:center;">
    <h1 style="margin:0;font-size:28px;letter-spacing:1px;">
      <span style="color:#C42025;font-weight:800;">ONE</span>
      <span style="color:#4D4D4D;font-weight:600;">GROUP</span>
    </h1>
    <p style="margin:4px 0 0;font-size:10px;color:#999;letter-spacing:3px;text-transform:uppercase;">The One You Can Trust</p>
  </div>

  <!-- Body -->
  <div style="padding:32px 24px;">
    ${bodyHtml}
  </div>

  <!-- CTA Button -->
  <div style="padding:0 24px 24px;text-align:center;">
    <a href="https://onegroupdevelopers.com" style="display:inline-block;background:#C42025;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:14px;font-weight:600;letter-spacing:0.5px;">Visit Our Website</a>
  </div>

  <!-- Footer -->
  <div style="background:#f8f8f8;padding:20px 24px;border-top:1px solid #eee;text-align:center;">
    <p style="margin:0 0 4px;font-size:13px;color:#666;"><strong style="color:#C42025;">ONE</strong> <strong style="color:#4D4D4D;">GROUP</strong> Developers</p>
    <p style="margin:0 0 4px;font-size:12px;color:#999;">+91 88752 21116 | +91 977 977 1130</p>
    <p style="margin:0 0 8px;font-size:12px;color:#999;">onegroupdevelopers.com</p>
    <div style="border-top:1px solid #eee;padding-top:12px;margin-top:8px;">
      <p style="margin:0;font-size:10px;color:#bbb;">This email was sent to ${lead.email}. If you received this in error, please ignore.</p>
    </div>
  </div>
</div>
</body>
</html>`;

    // Build attachments from uploaded files
    const attachments = (req.files || []).map(f => ({
      filename: f.originalname,
      path: f.path,
    }));

    await transporter.sendMail({
      from: `"${settings.from_name || 'Wapnix'}" <${settings.from_email || settings.smtp_user}>`,
      to: lead.email,
      subject: finalSubject,
      text: finalBody,
      html: htmlEmail,
      attachments,
    });

    // Clean up uploaded files
    for (const f of (req.files || [])) {
      try { fs.unlinkSync(f.path); } catch {}
    }

    db.prepare('UPDATE website_leads SET status = ? WHERE id = ?').run('contacted', lead.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[email] Send failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
