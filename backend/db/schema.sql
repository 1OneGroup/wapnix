CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  daily_limit INTEGER NOT NULL DEFAULT 50,
  monthly_limit INTEGER NOT NULL DEFAULT 1000,
  max_contacts INTEGER NOT NULL DEFAULT 200,
  max_templates INTEGER NOT NULL DEFAULT 10,
  max_chatbots INTEGER NOT NULL DEFAULT 1,
  rate_per_minute INTEGER NOT NULL DEFAULT 10,
  rate_per_hour INTEGER NOT NULL DEFAULT 200,
  monthly_price INTEGER NOT NULL DEFAULT 0,
  yearly_price INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  plan_id INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (plan_id) REFERENCES plans(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  whatsapp_number TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected',
  auth_folder TEXT NOT NULL,
  connected_at TEXT,
  disconnected_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  variables TEXT DEFAULT '[]',
  category TEXT DEFAULT 'general',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS contact_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  phone TEXT NOT NULL,
  name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, phone)
);

CREATE TABLE IF NOT EXISTS contact_group_members (
  contact_id INTEGER NOT NULL,
  group_id INTEGER NOT NULL,
  PRIMARY KEY (contact_id, group_id),
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES contact_groups(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  contact_id INTEGER,
  phone TEXT NOT NULL,
  template_id INTEGER,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  error_message TEXT,
  batch_id TEXT,
  sent_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS daily_usage (
  user_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  messages_sent INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chatbot_flows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  steps_json TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sheet_filter (
  user_id INTEGER NOT NULL,
  phone TEXT NOT NULL,
  PRIMARY KEY (user_id, phone),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Super admin & approval columns (added via ALTER for existing DBs)
-- is_approved: 0 = pending, 1 = approved
-- is_superadmin: 1 = super admin
-- allowed_pages: JSON array of page keys user can access

CREATE TABLE IF NOT EXISTS followup_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  batch_id TEXT NOT NULL,
  plan_type TEXT NOT NULL,
  plan_label TEXT NOT NULL,
  total_days INTEGER NOT NULL,
  freq_days INTEGER NOT NULL,
  total_sends INTEGER NOT NULL,
  sends_done INTEGER NOT NULL DEFAULT 1,
  next_send_at TEXT,
  contacts_json TEXT NOT NULL DEFAULT '[]',
  message TEXT,
  flow_id INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── Campaigns ──

CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',  -- draft, active, paused, completed
  stop_keywords TEXT DEFAULT '[]',       -- JSON array of keywords e.g. ["stop","not interested"]
  stop_chatbot_steps TEXT DEFAULT '[]',  -- JSON array of {flow_id, step_id} that trigger exit
  webhook_token TEXT,                    -- unique token for API enrollment endpoint
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS campaign_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  step_order INTEGER NOT NULL,           -- 1, 2, 3...
  day_offset INTEGER NOT NULL DEFAULT 0, -- days after enrollment
  send_time TEXT DEFAULT '10:00',        -- preferred HH:MM (24h)
  step_type TEXT NOT NULL,               -- 'message' or 'chatbot'
  message_text TEXT,                     -- for message type: text with {{var}} placeholders
  flow_id INTEGER,                       -- for chatbot type: reference to chatbot_flows.id
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (flow_id) REFERENCES chatbot_flows(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS campaign_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  phone TEXT NOT NULL,
  contact_data TEXT DEFAULT '{}',        -- JSON: {fullname, email, mobile, ...custom fields}
  current_step INTEGER NOT NULL DEFAULT 0,  -- which step_order they are on (0 = not started)
  status TEXT NOT NULL DEFAULT 'active', -- active, completed, stopped
  stop_reason TEXT,                      -- keyword, chatbot_outcome, manual, or null
  enrolled_at TEXT DEFAULT (datetime('now')),
  last_step_at TEXT,                     -- when last step was fired
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  UNIQUE(campaign_id, phone)
);

-- Track per-step analytics
CREATE TABLE IF NOT EXISTS campaign_step_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  step_id INTEGER NOT NULL,              -- campaign_steps.id
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',   -- sent, delivered, replied, failed
  sent_at TEXT DEFAULT (datetime('now')),
  replied_at TEXT,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (step_id) REFERENCES campaign_steps(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_followup_plans_status ON followup_plans(status, next_send_at);
CREATE INDEX IF NOT EXISTS idx_chatbot_flows_user ON chatbot_flows(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_messages_user_date ON messages(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_batch ON messages(batch_id);
CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_usage_user_date ON daily_usage(user_id, date);
CREATE INDEX IF NOT EXISTS idx_campaigns_user ON campaigns(user_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_steps_campaign ON campaign_steps(campaign_id, step_order);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_status ON campaign_contacts(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_due ON campaign_contacts(status, current_step);
CREATE INDEX IF NOT EXISTS idx_campaign_step_logs ON campaign_step_logs(campaign_id, step_id);

-- Scheduler: date-triggered recurring messages (birthdays, anniversaries)
CREATE TABLE IF NOT EXISTS schedulers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  send_time TEXT NOT NULL DEFAULT '00:00',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  catch_up_past_dates INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  last_catchup_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_schedulers_user ON schedulers(user_id, status);

CREATE TABLE IF NOT EXISTS scheduler_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scheduler_id INTEGER NOT NULL REFERENCES schedulers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date_column TEXT NOT NULL,
  template_id INTEGER NOT NULL REFERENCES templates(id),
  media_path TEXT,
  media_type TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_scheduler_rules_scheduler ON scheduler_rules(scheduler_id);

CREATE TABLE IF NOT EXISTS scheduler_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scheduler_id INTEGER NOT NULL REFERENCES schedulers(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  contact_data TEXT NOT NULL DEFAULT '{}',
  date_cache TEXT NOT NULL DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(scheduler_id, phone)
);
CREATE INDEX IF NOT EXISTS idx_scheduler_contacts_scheduler ON scheduler_contacts(scheduler_id);

CREATE TABLE IF NOT EXISTS scheduler_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scheduler_id INTEGER NOT NULL REFERENCES schedulers(id) ON DELETE CASCADE,
  rule_id INTEGER NOT NULL REFERENCES scheduler_rules(id) ON DELETE CASCADE,
  contact_id INTEGER NOT NULL REFERENCES scheduler_contacts(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  year INTEGER NOT NULL,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(rule_id, contact_id, year)
);
CREATE INDEX IF NOT EXISTS idx_scheduler_logs_scheduler ON scheduler_logs(scheduler_id, year);
CREATE INDEX IF NOT EXISTS idx_scheduler_logs_rule ON scheduler_logs(rule_id, year);
