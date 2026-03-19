# Wapnix - WhatsApp Business Automation Platform

## Overview
Multi-tenant WhatsApp automation SaaS. Users connect their WhatsApp via QR/pairing code (Baileys library), then manage contacts, send messages (single/bulk), build chatbot flows, run multi-step campaigns, capture website leads, and auto-respond via WhatsApp or email.

## Tech Stack
- **Backend**: Node.js + Express (ES modules), SQLite3 (better-sqlite3, WAL mode), Socket.IO
- **Frontend**: React 18 + Vite + Tailwind CSS
- **WhatsApp**: @whiskeysockets/baileys (headless WhatsApp Web)
- **Deployment**: PM2 on Hostinger VPS (port 4000), Nginx reverse proxy

## Quick Start
```bash
# Backend
cd backend && npm install && node server.js   # port 4000

# Frontend (dev)
cd frontend && npm install && npm run dev      # port 5173

# Frontend (build for production)
cd frontend && npm run build                   # outputs to frontend/dist/
```

No .env file needed for dev. Config defaults in `backend/config.js`.
SQLite DB auto-creates at `backend/data/app.db` on first run.
Schema auto-runs from `backend/db/schema.sql` + migrations in `backend/db/database.js`.

## Architecture

### Authentication
- **Internal API** (`/api/*`): JWT Bearer token, 7-day expiry. Middleware: `backend/middleware/auth.js`
- **External API** (`/api/v1/*`): API key via `X-API-Key` header or `?api_key=`. Middleware: `backend/middleware/apiKeyAuth.js`
- **Public endpoints**: `/api/auth/*`, `/api/campaigns/webhook/:token`, `/api/website/webhook/:apiKey`
- Both auth middlewares attach full user object (with plan info) to `req.user`

### Request Flow
```
Client -> Express -> auth middleware -> route handler -> db (better-sqlite3, sync) -> JSON response
                                                      -> sessionManager (Baileys) -> WhatsApp
                                                      -> Socket.IO (real-time status updates)
```

### Key Services (`backend/services/`)
- **sessionManager.js**: Per-user Baileys WhatsApp sessions. Manages QR, pairing codes, connection lifecycle. Methods: `getSession(userId)`, `getQueue(userId)`, `getSessionStatus(userId)`, `restoreAllSessions()`. Emits Socket.IO events.
- **chatbotEngine.js**: In-memory conversation state machine. Tracks active conversations per user+phone. Processes incoming messages against flow steps. Key functions: `initConversation()`, `resetConversation()`, `setAllowedPhones()`, `addAllowedPhone()`, `restorePhoneFilters()`.
- **messageService.js**: `sendSingle()` and `sendBulk()` — wraps Baileys send with DB logging, daily usage tracking. `renderTemplate(body, vars)` replaces `{{variable}}` placeholders.

### Schedulers (in `server.js`)
- **Follow-up Plan Scheduler**: Every 5 min. Checks `followup_plans` for due sends.
- **Campaign Scheduler**: Every 5 min. Fires campaign steps based on `day_offset` and `send_time` (UTC).

## Database Schema

SQLite with WAL mode. Schema: `backend/db/schema.sql`. Migrations: `backend/db/database.js`.

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `plans` | Subscription tiers (free/starter/pro/business) | daily_limit, monthly_limit, max_contacts, max_templates |
| `users` | User accounts | email, password_hash, plan_id, is_approved, is_superadmin, api_key, allowed_pages (JSON) |
| `sessions` | WhatsApp connection metadata | user_id (UNIQUE), whatsapp_number, status, auth_folder |
| `contacts` | User's contact list | phone, name, email, notes. UNIQUE(user_id, phone) |
| `contact_groups` | Contact grouping | name, color. UNIQUE(user_id, name) |
| `contact_group_members` | M2M: contacts <-> groups | contact_id, group_id |
| `templates` | Message templates with `{{var}}` placeholders | name, body, variables (JSON), category |
| `messages` | Message log | phone, body, status (queued/sent/failed/cancelled), batch_id, sent_at |
| `daily_usage` | Per-user daily counters | user_id + date (PK), messages_sent |
| `chatbot_flows` | Chatbot definitions | name, steps_json (JSON string), is_active |
| `chat_logs` | Chatbot message history | phone, direction (incoming/outgoing), message |
| `conversation_status` | Bot conversation outcomes | phone, flow_id, status (active/completed/expired) |
| `campaigns` | Multi-step drip campaigns | name, status (draft/active/paused/completed), stop_keywords (JSON) |
| `campaign_steps` | Steps within campaigns | step_order, day_offset, send_time, step_type (message/chatbot) |
| `campaign_contacts` | Contacts enrolled in campaigns | phone, contact_data (JSON), current_step, status |
| `campaign_step_logs` | Per-step send analytics | step_id, phone, status (sent/delivered/replied/failed) |
| `followup_plans` | Scheduled recurring message plans | plan_label, total_sends, sends_done, next_send_at, contacts_json |
| `website_leads` | Incoming website form submissions | name, email, phone, status (new/contacted/converted/ignored) |
| `website_auto_send` | Auto-response config for leads | mode (off/message/chatbot), message_template, flow_id |
| `email_settings` | SMTP config per user | smtp_host, smtp_port, smtp_user, smtp_pass |
| `sheet_filter` | Phone allowlist for chatbot targeting | user_id + phone (PK) |

## File Structure

```
backend/
  server.js              # Express app, Socket.IO, schedulers (follow-up + campaign)
  config.js              # Port (4000), JWT secret, DB path, CORS origins
  db/
    database.js          # DB init, WAL mode, migrations (addColumnIfMissing), seed plans
    schema.sql           # Core table definitions + indexes
  middleware/
    auth.js              # JWT auth -> req.user (with plan info)
    apiKeyAuth.js        # API key auth -> req.user (with plan info)
    rateLimiter.js       # checkDailyLimit middleware, incrementDailyUsage()
  routes/
    auth.js              # POST /register, /login, /logout
    session.js           # POST /connect, /disconnect; GET /status
    contacts.js          # Contacts CRUD + groups + CSV import
    templates.js         # Templates CRUD + image upload
    messages.js          # Send single/bulk + history + batch control
    chatbot.js           # Flow CRUD + bulk-send + conversations + sheet filter
    campaigns.js         # Campaign CRUD + enrollment + webhook + step logs
    dashboard.js         # Stats: sent today, contacts, templates, 7-day trend
    website.js           # Lead webhook + CRUD + auto-send config + email
    admin.js             # Superadmin: user list, approve, reject, plan change
    apikey.js            # Generate/revoke API keys
    externalApi.js       # External API v1: send, send-bulk, status, batch, templates, /me
    profile.js           # User profile CRUD + avatar upload
  services/
    sessionManager.js    # Baileys session lifecycle (Map of ConnectionManager instances)
    chatbotEngine.js     # Conversation state machine (in-memory Map)
    messageService.js    # sendSingle(), sendBulk(), renderTemplate()
  shared/
    phoneUtils.js        # normalizePhone(), normalizeLeadPhone(), extractPhoneFromMessage(), toJid()
    messageQueue.js      # Rate-limited queue: minDelay, maxPerMinute, maxPerHour
    mimeTypes.js         # MIME type mappings for file uploads
    connectionManager.js # Baileys wrapper: socket lifecycle, QR, reconnection, keep-alive
  uploads/               # User uploaded files (avatars, template images, email attachments)
  data/                  # SQLite database (app.db) + Baileys auth sessions per user

frontend/
  src/
    main.jsx             # React app entry
    App.jsx              # Route definitions, auth guards
    api/client.js        # Axios HTTP client (baseURL from env or localhost:4000)
    hooks/useSocket.js   # Socket.IO hook for real-time status
    context/
      AuthContext.jsx    # Login/register/logout state
      SettingsContext.jsx # Theme & settings
      NotificationContext.jsx
    pages/               # Dashboard, DeviceLink, SendMessage, Templates, Contacts,
                         # ChatbotBuilder, CampaignBuilder, WebsiteData, ApiPage,
                         # ProfilePage, SettingsPage, SuperAdmin, PricingPage, Login, Terms
    components/
      Layout.jsx         # Sidebar + navbar layout
```

## Conventions

### Phone Numbers
Always normalized to `91XXXXXXXXXX` format via `normalizePhone()` in `shared/phoneUtils.js`.
- 10 digits -> prepend `91`
- Strips all non-digits, leading `0`
- `normalizeLeadPhone()` is stricter (rejects non-10/11/12 digit inputs)
- WhatsApp JID format: `91XXXXXXXXXX@s.whatsapp.net`

### Variable Substitution
Templates and messages use `{{variable_name}}` syntax. Use `renderTemplate(body, vars)` from `messageService.js`:
```js
body.replace(/\{\{(\w+)\}\}/g, (match, key) => variables[key] ?? match);
```

### Message Sending Pipeline
1. Insert into `messages` table with status `queued`
2. Return response to client immediately
3. Send async via Baileys (15s gap between bulk messages to avoid WhatsApp rate limits)
4. Update status to `sent` or `failed`
5. Increment `daily_usage` via `incrementDailyUsage(userId)`

### Response Format
Internal API responses are inconsistent. External API (`/api/v1/*`) should use:
```json
{ "success": true, "data": {...}, "error": null, "meta": { "page": 1, "limit": 50, "total": 100 } }
```

## Common Tasks

### Add a new internal route
1. Create `backend/routes/newFeature.js` with `import { Router } from 'express'`
2. Export default Router
3. Mount in `server.js`: `app.use('/api/new-feature', authenticate, newFeatureRoutes)`

### Add a new database table
1. Add `CREATE TABLE IF NOT EXISTS` to `backend/db/schema.sql`
2. For existing DBs, add `CREATE TABLE IF NOT EXISTS` in `backend/db/database.js` (runs on startup)
3. For new columns on existing tables: use `addColumnIfMissing(table, column, definition)` in `database.js`

### Add a new external API endpoint
1. Add route to `backend/routes/externalApi.js` (uses `authenticateApiKey` middleware automatically)
2. Access user via `req.user` (includes plan info)

## Known Gotchas
- `better-sqlite3` is **synchronous**. All DB calls block the event loop. Keep queries fast.
- Baileys auth sessions stored in `backend/data/auth_sessions/user_X/`. Deleting forces QR re-scan.
- `chatbot_flows.steps_json` stores entire flow as JSON string (not separate table, unlike campaigns which use `campaign_steps`)
- Campaign scheduler uses **UTC** for `send_time` comparison. Website lead greetings use **IST**.
- In-memory state (chatbot conversations, batch controls) is **lost on restart**.
- The `media` field in external API `/send` expects base64 data; internal routes expect file paths. These are inconsistent.
- `batchControl` Map is duplicated independently in `routes/messages.js` and `routes/chatbot.js`.
- Always wrap phone numbers with `String()` before calling string methods — Google Sheets and other sources may return numbers.

## Superadmin
- Email: `avinashsingh36948@gmail.com`
- Controls: user approval, plan assignment, allowed pages
- Auto-set on first run if no superadmin exists
