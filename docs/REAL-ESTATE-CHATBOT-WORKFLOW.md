# Real Estate Chatbot — Complete Workflow Guide

## Overview

Wapnix chatbot real estate leads ko automatically qualify karta hai WhatsApp pe. Jab lead ko message jaata hai aur wo reply karta hai, bot step-by-step conversation chalaata hai — budget, location, property type puchta hai — aur end me qualified lead ka data team ko notify karta hai.

---

## How It Works — Simple Flow

```
CSV Upload (3000+ leads)
        │
        ▼
  Activate Sheet (bot sirf in numbers ko reply karega)
        │
        ▼
  Bulk Send (first message sabko jaata hai)
        │
        ▼
  Lead Replies "Hi" / "1" / anything
        │
        ▼
  Bot Auto-Replies (step by step conversation)
        │
        ▼
  Conversation Complete → Notify Sales Team
```

---

## Step-by-Step Setup

### Step 1: Create Chatbot Flow

Go to **Chatbot & Campaign → Chatbot Builder**

Create a flow with these steps:

```
Step 1 (Welcome)
  Message: "Hi {{name}}! 🏠 ONE Group Real Estate me aapka swagat hai.
            Kya aap property dhundh rahe hain?

            1️⃣ Haan, Property chahiye
            2️⃣ Nahi, abhi nahi"

  Options:
    1 - Haan → Step 2
    2 - Nahi → Step 6 (Thank You)

Step 2 (Budget)
  Message: "Aapka budget kitna hai?

            1️⃣ Under 50 Lakh
            2️⃣ 50 Lakh - 1 Crore
            3️⃣ 1 Crore - 2 Crore
            4️⃣ 2 Crore+"

  Options:
    1 - Under 50L → Step 3
    2 - 50L-1Cr → Step 3
    3 - 1Cr-2Cr → Step 3
    4 - 2Cr+ → Step 3

Step 3 (Location)
  Message: "Kaunsi location pasand hai?

            1️⃣ Jaipur
            2️⃣ Delhi NCR
            3️⃣ Mumbai
            4️⃣ Other City"

  Options:
    1 - Jaipur → Step 4
    2 - Delhi NCR → Step 4
    3 - Mumbai → Step 4
    4 - Other → Step 4

Step 4 (Property Type)
  Message: "Kaunsi property chahiye?

            1️⃣ Flat / Apartment
            2️⃣ Villa / Independent House
            3️⃣ Plot / Land
            4️⃣ Commercial"

  Options:
    1 - Flat → Step 5
    2 - Villa → Step 5
    3 - Plot → Step 5
    4 - Commercial → Step 5

Step 5 (Thank You + Notify)
  Message: "Dhanyavaad {{name}}! 🙏
            Humari team aapko jaldi call karegi.

            Koi aur sawal ho toh yahan puchein."

  Notify: Sales team number (e.g., 919876543210)
  Notify Message: "🔔 New Lead!
    Name: {{name}}
    Phone: {{phone}}
    Flow: {{flow_name}}
    Reply: {{user_message}}"

  Options: (none — conversation ends here)

Step 6 (Not Interested)
  Message: "Koi baat nahi {{name}}!
            Jab bhi zarurat ho, hume message karein. 😊"

  Options: (none — conversation ends here)
```

### Step 2: Prepare CSV File

CSV format:

```csv
phone,name,fullname,email,sourcename,employeename
919876543210,Rahul,Rahul Sharma,rahul@email.com,Facebook,Shivani
918765432109,Priya,Priya Singh,priya@email.com,Google,Ankit
```

**Required column:** `phone`
**Optional columns:** `name`, `fullname`, `email`, `sourcename`, `employeename` (used as `{{variables}}` in messages)

### Step 3: Upload & Activate

1. Go to **Chatbot & Campaign → Bulk** tab
2. Click **+ CSV** → upload your CSV file
3. Select the chatbot flow: "Real Estate Follow-up Bot"
4. Select **Warm-up Day** (Day 1 = 20 messages, Day 2 = 36, etc.)
5. Click **Activate Sheet** → bot now only replies to these numbers
6. Click **Start Flow** → first message goes to all contacts

### Step 4: Bot Handles Conversations

Once the first message is sent:

```
Bot sends: "Hi Rahul! 🏠 ONE Group Real Estate me..."
                    ↓
Lead replies: "1"  (Haan)
                    ↓
Bot sends: "Aapka budget kitna hai? 1️⃣ Under 50L..."
                    ↓
Lead replies: "2"  (50L-1Cr)
                    ↓
Bot sends: "Kaunsi location pasand hai? 1️⃣ Jaipur..."
                    ↓
Lead replies: "1"  (Jaipur)
                    ↓
Bot sends: "Kaunsi property chahiye? 1️⃣ Flat..."
                    ↓
Lead replies: "2"  (Villa)
                    ↓
Bot sends: "Dhanyavaad Rahul! 🙏 Humari team..."
                    ↓
Sales team gets notification on WhatsApp! 🔔
```

---

## How Chatbot Engine Works Internally

### Conversation State Machine

```
                    ┌──────────────────────┐
                    │   No Conversation    │
                    │   (fresh contact)    │
                    └──────────┬───────────┘
                               │ Lead sends any message
                               ▼
                    ┌──────────────────────┐
                    │   Step 1 (Welcome)   │
                    │   Bot sends greeting │
                    └──────────┬───────────┘
                               │ Lead replies "1" or "2"
                               ▼
              ┌────────────────┴────────────────┐
              │                                  │
     "1" (Interested)                   "2" (Not Interested)
              │                                  │
              ▼                                  ▼
    ┌──────────────┐                   ┌──────────────┐
    │  Step 2      │                   │  Step 6      │
    │  (Budget)    │                   │  (Thank You) │
    └──────┬───────┘                   └──────────────┘
           │                              Conversation
           ▼                              COMPLETED ✓
    ┌──────────────┐
    │  Step 3      │
    │  (Location)  │
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │  Step 4      │
    │  (Property)  │
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │  Step 5      │
    │  (Complete)  │──→ Notify Sales Team
    └──────────────┘
      Conversation
      COMPLETED ✓
```

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Flow** | Complete chatbot conversation definition (steps + options) |
| **Step** | One message in the conversation with options for user to reply |
| **Option** | User's reply choice (e.g., "1", "2") that leads to next step |
| **Notify** | Send alert to sales team when lead reaches a specific step |
| **Sheet Filter** | Only reply to phone numbers from uploaded CSV |
| **Conversation Timeout** | 30 minutes — if lead doesn't reply, conversation expires |
| **Completed** | Once conversation ends, bot won't restart with same contact (24hr) |

### Input Matching

Bot accepts these reply formats:

| User Types | Bot Understands |
|-----------|----------------|
| `1` | First option |
| `2` | Second option |
| `yes`, `ha`, `haan` | First option (2-3 option steps) |
| `no`, `nahi`, `nhi` | Second option (2-3 option steps) |
| Full option text | Matches by label |

Invalid reply → Bot says: "Please reply with a valid option: 1, 2, 3"

### Variable Substitution

Messages support `{{variable}}` placeholders:

```
"Hi {{name}}, your budget is {{budget}}"
```

Variables come from:
- **CSV columns** — mapped when uploading sheet
- **Contact data** — phone, name, fullname, email
- **System vars** — `{{phone}}`, `{{flow_name}}`, `{{step_name}}`, `{{user_message}}`

---

## Complete Technical Flow

### 1. Bulk Send (First Message)

```
User clicks "Start Flow"
       │
       ▼
POST /api/chatbot/bulk-send
  { contacts: [...], use_flow: true, flow_id: 5 }
       │
       ▼
For each contact:
  1. Send Step 0 message via Baileys (with anti-ban delays)
  2. initConversation(userId, phone, flowId, stepId="step_1", contactData)
  3. Save to messages table (status: "queued" → "sent")
  4. Add phone to sheet_filter (bot will reply to this number)
```

### 2. Lead Replies

```
WhatsApp message received
       │
       ▼
sessionManager.onMessage(sock, upsert)
       │
       ▼
Check: Is phone in sheet_filter?
  NO → Ignore (don't reply)
  YES ↓
       │
       ▼
processIncomingMessage(userId, phone, text)
       │
       ▼
Check: Active conversation exists?
  NO → Start from Step 0 (send welcome)
  YES ↓
       │
       ▼
Find current step → Match user input to option
       │
       ▼
Option matched?
  NO → "Please reply with valid option: 1, 2, 3"
  YES ↓
       │
       ▼
Go to next step → Send next message
       │
       ▼
Next step has notify?
  YES → Queue notification to sales team number
  NO → Continue
       │
       ▼
Next step has no options?
  YES → Conversation COMPLETED (won't restart for 24hr)
  NO → Wait for next reply
```

### 3. Conversation Storage

```
In-Memory (fast):
  conversations Map: { "userId:phone" → { stepId, flowId, lastActivity, contactData } }
  completedConvos Map: { "userId:phone" → timestamp }
  allowedPhones Map: { userId → Set<phone> }

In Database (persistent):
  conversation_status table: { user_id, phone, flow_id, status, last_step_id }
  chat_logs table: { user_id, phone, direction, message, created_at }
  sheet_filter table: { user_id, phone }
```

---

## Warm-up Plan Integration

When sending to 3000+ leads, use the warm-up plan to avoid ban:

| Day | Messages | Strategy |
|-----|----------|----------|
| Day 1 | 20 leads | Test batch — check delivery, responses |
| Day 2 | 36 leads | Slightly bigger batch |
| Day 3 | 65 leads | Growing confidence |
| Day 4 | 117 leads | Mid warm-up |
| Day 5 | 210 leads | Ramping up |
| Day 6 | 378 leads | Almost there |
| Day 7 | 680 leads | Large batch |
| Day 8+ | All remaining | Full speed (plan limits apply) |

**Total after 7 days:** ~1,506 leads covered
**Remaining 1,494:** Sent on Day 8+ in one batch

### How to use:

1. Upload 3000 contact CSV
2. Select Day 1 on warm-up selector circles
3. Click Start Flow → only 20 messages go out
4. Popup: "Day 1 limit reached! Switch to Day 2?"
5. Next day → click Day 2 → 36 more messages
6. Continue until Day 8+ (unlimited)

---

## Campaign Integration

For multi-step follow-ups (not just chatbot), use **Campaign Builder**:

```
Day 0: Send chatbot flow (auto-qualify leads)
Day 3: Follow-up message to non-responders
Day 7: Special offer to qualified leads
Day 14: Final follow-up
```

### Setup:
1. **Campaign Builder** → Create campaign "Real Estate Pipeline"
2. **Step 1** (Day 0): Type = Chatbot, Flow = "Real Estate Follow-up Bot"
3. **Step 2** (Day 3): Type = Message, Text = "Hi {{name}}, kya aapne property decide ki?"
4. **Enroll contacts** → Upload CSV or use webhook
5. Campaign scheduler runs every 5 min, fires steps based on day_offset

---

## Monitoring & Analytics

### Check Conversation Status

**Conversations page** (Chatbot & Campaign → Conversations tab):
- Active conversations — currently in progress
- Completed — lead finished all steps
- Expired — lead didn't reply within 30 min

### Chat Logs

Every message (incoming + outgoing) is logged in `chat_logs` table:
- Direction: incoming / outgoing
- Timestamp
- Full message text

### Campaign Step Logs

Track which campaign step each contact is on:
- sent / delivered / replied / failed
- Stop keywords detection (e.g., "stop", "not interested")

---

## Troubleshooting

### Bot reply nahi de raha

| Check | Fix |
|-------|-----|
| Sheet activated hai? | Bulk tab → Activate Sheet click karo |
| Active flow set hai? | Chatbot Builder → flow ko "Active" mark karo |
| Phone sheet me hai? | CSV me wo number hona chahiye |
| Conversation complete ho chuki? | 24hr baad reset hoga automatically |
| Timeout ho gaya? | 30 min me reply nahi aaya → expired |

### Wrong step pe ja raha hai

- Flow steps ka `next` field check karo
- Options me correct step ID mapped hona chahiye
- Chatbot Builder → flow edit karo → connections verify karo

### Notify nahi aa raha

- Step me `Notify` section enabled hai?
- Notify phone number sahi format me hai? (e.g., 919876543210)
- WhatsApp connected hai?

### Same contact ko dobara message nahi ja raha

- Completed conversations 24hr ke liye block hote hain
- Server restart karo ya wait karo 24hr
- Ya manually conversation reset karo from Conversations tab
