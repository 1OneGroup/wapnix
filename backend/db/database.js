import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensure data directory exists
const dataDir = path.dirname(config.dbPath);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(config.dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run schema
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

// Migrations: add columns if missing
function addColumnIfMissing(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`Migration: added ${table}.${column}`);
  }
}
addColumnIfMissing('users', 'is_approved', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('users', 'is_superadmin', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('users', 'allowed_pages', "TEXT NOT NULL DEFAULT '[]'");
addColumnIfMissing('users', 'api_key', 'TEXT');
addColumnIfMissing('users', 'token_name', 'TEXT');
addColumnIfMissing('users', 'phone', 'TEXT');
addColumnIfMissing('users', 'company', 'TEXT');
addColumnIfMissing('users', 'bio', 'TEXT');
addColumnIfMissing('users', 'profile_image', 'TEXT');

// Migration: add new plan columns if missing
addColumnIfMissing('plans', 'max_chatbots', 'INTEGER NOT NULL DEFAULT 1');
addColumnIfMissing('plans', 'monthly_price', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('plans', 'yearly_price', 'INTEGER NOT NULL DEFAULT 0');

// Migration: create chat_logs table for bot conversations
db.exec(`CREATE TABLE IF NOT EXISTS chat_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  phone TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('incoming','outgoing')),
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_chat_logs_user_phone ON chat_logs(user_id, phone, created_at)`);

// Migration: create conversation_status table to track bot conversation outcomes
db.exec(`CREATE TABLE IF NOT EXISTS conversation_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  phone TEXT NOT NULL,
  flow_id INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','expired')),
  last_step_id TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, phone)
)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_conv_status_user ON conversation_status(user_id, status)`);

// Migration: create website_leads table for incoming website form data
db.exec(`CREATE TABLE IF NOT EXISTS website_leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  source TEXT DEFAULT 'website',
  page_url TEXT,
  name TEXT,
  email TEXT,
  phone TEXT,
  message TEXT,
  extra_data TEXT DEFAULT '{}',
  status TEXT DEFAULT 'new' CHECK(status IN ('new','contacted','converted','ignored')),
  whatsapp_sent INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_website_leads_user ON website_leads(user_id, status, created_at)`);

// Migration: create website_auto_send settings table
db.exec(`CREATE TABLE IF NOT EXISTS website_auto_send (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  mode TEXT DEFAULT 'off' CHECK(mode IN ('off','message','chatbot')),
  message_template TEXT DEFAULT '',
  flow_id INTEGER,
  var_mapping TEXT DEFAULT '{}',
  FOREIGN KEY (user_id) REFERENCES users(id)
)`);

addColumnIfMissing('website_auto_send', 'email_enabled', 'INTEGER DEFAULT 0');
addColumnIfMissing('website_auto_send', 'email_subject', "TEXT DEFAULT ''");
addColumnIfMissing('website_auto_send', 'email_body', "TEXT DEFAULT ''");
addColumnIfMissing('website_auto_send', 'email_attachments', "TEXT DEFAULT '[]'");
addColumnIfMissing('website_auto_send', 'msg_attachments', "TEXT DEFAULT '[]'");

// Migration: create email_settings table
db.exec(`CREATE TABLE IF NOT EXISTS email_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  smtp_host TEXT DEFAULT '',
  smtp_port INTEGER DEFAULT 587,
  smtp_user TEXT DEFAULT '',
  smtp_pass TEXT DEFAULT '',
  from_name TEXT DEFAULT '',
  from_email TEXT DEFAULT '',
  enabled INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id)
)`);

// Seed default plans if empty
const planCount = db.prepare('SELECT COUNT(*) as cnt FROM plans').get().cnt;
if (planCount === 0) {
  const insertPlan = db.prepare(
    'INSERT INTO plans (name, daily_limit, monthly_limit, max_contacts, max_templates, max_chatbots, rate_per_minute, rate_per_hour, monthly_price, yearly_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  insertPlan.run('free',     100,    3000,    200,    10,  1,  10, 200,  0,     0);
  insertPlan.run('starter',  500,    15000,   2000,   50,  5,  20, 500,  999,   9590);
  insertPlan.run('pro',      2000,   60000,   10000,  200, -1, 30, 1000, 2499,  23990);
  insertPlan.run('business', 999999, 9999999, 999999, 999999, -1, 60, 3000, 4999, 47990);
  console.log('Seeded default plans: free, starter, pro, business');
}

// Sync plan limits to match pricing page
db.prepare("UPDATE plans SET daily_limit=100,  monthly_limit=3000,    max_contacts=200,    max_templates=10,     max_chatbots=1,  monthly_price=0,    yearly_price=0     WHERE name='free'").run();
db.prepare("UPDATE plans SET daily_limit=500,  monthly_limit=15000,   max_contacts=2000,   max_templates=50,     max_chatbots=5,  monthly_price=999,  yearly_price=9590  WHERE name='starter'").run();
db.prepare("UPDATE plans SET daily_limit=2000, monthly_limit=60000,   max_contacts=10000,  max_templates=200,    max_chatbots=-1, monthly_price=2499, yearly_price=23990 WHERE name='pro'").run();

// Ensure business plan exists
const bizPlan = db.prepare("SELECT id FROM plans WHERE name = 'business'").get();
if (!bizPlan) {
  db.prepare("INSERT INTO plans (name, daily_limit, monthly_limit, max_contacts, max_templates, max_chatbots, rate_per_minute, rate_per_hour, monthly_price, yearly_price) VALUES ('business', 999999, 9999999, 999999, 999999, -1, 60, 3000, 4999, 47990)").run();
  console.log('Added business plan');
} else {
  db.prepare("UPDATE plans SET daily_limit=999999, monthly_limit=9999999, max_contacts=999999, max_templates=999999, max_chatbots=-1, monthly_price=4999, yearly_price=47990 WHERE name='business'").run();
}

// Migration: add 'api' to allowed_pages for users who don't have it yet
const usersWithoutApi = db.prepare("SELECT id, allowed_pages FROM users WHERE allowed_pages NOT LIKE '%api%'").all();
for (const u of usersWithoutApi) {
  const pages = JSON.parse(u.allowed_pages || '[]');
  pages.push('api');
  db.prepare('UPDATE users SET allowed_pages = ? WHERE id = ?').run(JSON.stringify(pages), u.id);
}

// Migration: create webhooks table for outbound webhook delivery
db.exec(`CREATE TABLE IF NOT EXISTS webhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  events TEXT NOT NULL DEFAULT '["*"]',
  secret TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)`);

// Ensure at least one superadmin exists (also auto-approve superadmin email if found)
const superadminCount = db.prepare('SELECT COUNT(*) as cnt FROM users WHERE is_superadmin = 1').get().cnt;
if (superadminCount === 0) {
  const allPages = JSON.stringify(['dashboard','device','templates','contacts','send','chatbot','api','website']);
  // Approve all existing users and give them all pages
  db.prepare('UPDATE users SET is_approved = 1, allowed_pages = ?').run(allPages);
  // Make avinash superadmin, fallback to first user
  const admin = db.prepare("SELECT id FROM users WHERE email = 'avinashsingh36948@gmail.com'").get()
    || db.prepare('SELECT id FROM users ORDER BY id ASC LIMIT 1').get();
  if (admin) {
    db.prepare('UPDATE users SET is_superadmin = 1, is_approved = 1 WHERE id = ?').run(admin.id);
    console.log(`Made user ${admin.id} superadmin`);
  }
} else {
  // Always ensure the superadmin email is approved if it exists
  db.prepare("UPDATE users SET is_approved = 1, is_superadmin = 1 WHERE email = 'avinashsingh36948@gmail.com' AND is_superadmin = 0").run();
}

export default db;
