import { Router } from 'express';
import db from '../db/database.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', 'uploads', 'templates');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `tpl_${req.user.id}_${Date.now()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) cb(null, true);
  else cb(new Error('Only images allowed'));
}});

const router = Router();

function extractVariables(body) {
  return [...new Set([...body.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))];
}

router.get('/', (req, res) => {
  const templates = db.prepare('SELECT * FROM templates WHERE user_id = ? ORDER BY updated_at DESC').all(req.user.id);
  res.json({ templates });
});

// Upload carousel images
router.post('/upload-image', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  const url = `/uploads/templates/${req.file.filename}`;
  res.json({ success: true, url, filename: req.file.filename });
});

// Delete uploaded image
router.delete('/upload-image/:filename', (req, res) => {
  const filePath = path.join(uploadsDir, req.params.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.json({ success: true });
});

router.post('/', (req, res) => {
  const { name, body, category, media } = req.body;
  if (!name || !body) return res.status(400).json({ error: 'Name and body are required' });

  const count = db.prepare('SELECT COUNT(*) as cnt FROM templates WHERE user_id = ?').get(req.user.id).cnt;
  if (count >= req.user.max_templates) {
    return res.status(403).json({ error: `Template limit (${req.user.max_templates}) reached. Upgrade plan.` });
  }

  const variables = JSON.stringify(extractVariables(body));
  const mediaJson = JSON.stringify(media || []);
  try {
    const result = db.prepare(
      'INSERT INTO templates (user_id, name, body, variables, category, media) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(req.user.id, name, body, variables, category || 'general', mediaJson);
    res.status(201).json({ id: result.lastInsertRowid, name, body, variables: JSON.parse(variables), category: category || 'general', media: media || [] });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Template name already exists' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  const { name, body, category, media } = req.body;
  const template = db.prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!template) return res.status(404).json({ error: 'Template not found' });

  const newBody = body || template.body;
  const variables = JSON.stringify(extractVariables(newBody));
  const mediaJson = media !== undefined ? JSON.stringify(media) : template.media;
  const now = new Date().toISOString();

  db.prepare(
    'UPDATE templates SET name = ?, body = ?, variables = ?, category = ?, media = ?, updated_at = ? WHERE id = ?'
  ).run(name || template.name, newBody, variables, category || template.category, mediaJson, now, template.id);

  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM templates WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Template not found' });
  res.json({ success: true });
});

export default router;
