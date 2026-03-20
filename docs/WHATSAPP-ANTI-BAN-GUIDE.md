# WhatsApp Anti-Ban Guide — Wapnix

## WhatsApp Number Ban Kyun Hota Hai?

WhatsApp ke automated systems detect karte hain ki koi number **bot** hai ya **real human**. Agar bot detect hota hai toh number **temporarily** ya **permanently ban** ho jata hai.

### Ban Hone Ke Main Reasons

| Reason | Kya hota hai | Example |
|--------|-------------|---------|
| **Bahut fast messaging** | 1-2 sec me 100 messages | Bulk send bina delay ke |
| **Same message copy-paste** | Identical text sabko | "Hi {{name}}" bhi same lagta hai agar gap nahi |
| **Naye number se zyada messages** | Fresh number pe 500+ msg Day 1 | Abhi QR scan kiya, abhi 1000 bhej diye |
| **Unusual hours** | Raat 2 baje 500 messages | Normal human raat ko nahi bhejta |
| **Too many unknown contacts** | Jinhe aapka number saved nahi | Mass messaging to strangers |
| **Reports/Blocks** | Receivers ne "Report Spam" kiya | Unwanted messages bhejne pe |
| **Robotic pattern** | Har message exactly 15 sec baad | Human kabhi exactly same gap nahi rakhta |

---

## Wapnix Anti-Ban System Kaise Kaam Karta Hai

Wapnix me **4-layer anti-ban protection** hai:

```
Layer 1: Human-like Delays (Gaussian Jitter)
Layer 2: Typing Simulation (composing presence)
Layer 3: 7-Day Warm-up (gradual daily limits)
Layer 4: Health Monitor (risk score + auto-pause)
```

### Files Involved

| File | Kya karta hai |
|------|--------------|
| `backend/shared/antiBan.js` | Core anti-ban logic (delays, warm-up, health, typing) |
| `backend/shared/connectionManager.js` | Baileys socket wrapper — anti-ban yahan integrate hai |
| `backend/shared/messageQueue.js` | Rate-limited queue with human jitter |
| `backend/services/sessionManager.js` | Per-user queue config (delays, limits) |

---

## Layer 1: Human-like Delays (Gaussian Jitter)

### Problem
Agar har message exactly **15 sec** baad jaaye toh WhatsApp detect karega — "ye bot hai, human itna accurate nahi hota."

### Solution
**Gaussian (bell curve) random delay** use hota hai. Matlab har delay thoda alag:

```
Base delay: 15 sec
Jitter: ±3 sec

Real delays: 13.2s, 16.8s, 14.1s, 17.5s, 12.9s, 15.6s...
```

### Code (`antiBan.js`)
```javascript
// Box-Muller transform — gaussian random number
function gaussianRandom(mean, stdDev) {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(0, mean + z * stdDev);
}

export function humanDelay(baseMs = 2000, jitterMs = 1000) {
  return Math.round(gaussianRandom(baseMs, jitterMs));
}
```

### Current Settings (`sessionManager.js`)
```javascript
const queue = new MessageQueue({
  defaultDelayMs: 15000,  // 15 sec minimum gap
  maxPerMinute: 4,         // max 4 messages per minute
  maxPerHour: 120,         // max 120 messages per hour
});
```

### Adjust Kaise Karein
`backend/services/sessionManager.js` me ye values change karo:

| Setting | Safe Value | Aggressive (risky) | Conservative (safest) |
|---------|-----------|-------------------|---------------------|
| `defaultDelayMs` | 15000 (15s) | 8000 (8s) | 25000 (25s) |
| `maxPerMinute` | 4 | 6 | 2 |
| `maxPerHour` | 120 | 200 | 60 |

**Recommendation:** 3000+ contacts ke liye **conservative** use karo.

---

## Layer 2: Typing Simulation

### Problem
Real human message bhejne se pehle type karta hai. Bot directly send karta hai — koi typing indicator nahi.

### Solution
Har text message se pehle **"typing..."** indicator dikhta hai receiver ko (3-6 sec), phir message jaata hai.

### Flow
```
1. sock.sendPresenceUpdate('composing', jid)   → "typing..." dikhta hai
2. Wait 3-6 sec (random)                       → human jaisa lag raha hai
3. sock.sendPresenceUpdate('paused', jid)       → typing band
4. sock.sendMessage(jid, content)               → actual message send
```

### Code (`connectionManager.js`)
```javascript
// Anti-ban: simulate typing before text messages (3-6 sec like a real person)
if (content.text || content.conversation) {
  await simulateTyping(this.sock, jid, humanDelay(4000, 1500));
}
```

### Adjust Kaise Karein
`connectionManager.js` me `humanDelay(4000, 1500)` change karo:
- `humanDelay(4000, 1500)` → 2.5 to 5.5 sec (default, recommended)
- `humanDelay(6000, 2000)` → 4 to 8 sec (safer)
- `humanDelay(2000, 500)` → 1.5 to 2.5 sec (risky)

---

## Layer 3: 7-Day Warm-up

### Problem
Naya WhatsApp number connect kiya aur turant 1000 messages bhej diye → **instant ban**.

WhatsApp expects naye numbers se dheere-dheere messaging badhegi, jaise real business me hota hai.

### Solution
**7-day warm-up period** — daily message limit gradually badhta hai:

| Day | Daily Limit | Total Capacity |
|-----|------------|---------------|
| Day 1 | 20 messages | 20 |
| Day 2 | 36 messages | 56 |
| Day 3 | 65 messages | 121 |
| Day 4 | 117 messages | 238 |
| Day 5 | 210 messages | 448 |
| Day 6 | 378 messages | 826 |
| Day 7 | 680 messages | 1,506 |
| Day 8+ | **Unlimited** | Plan limit applies |

### Formula
```javascript
dailyLimit = 20 × 1.8^(day - 1)
```

### State Persistence
Warm-up state **disk pe save** hota hai:
```
backend/data/auth_sessions/warmup_user_1.json
```

```json
{
  "startDate": "2026-03-21T10:00:00.000Z",
  "sentToday": 15,
  "lastSendDate": "2026-03-21"
}
```

Server restart pe state restore hota hai — warm-up reset nahi hota.

### Warm-up Reset Kab Hota Hai
- **Naya QR scan** karne pe (auth folder delete hone pe)
- **Manually** warmup JSON file delete karne pe

### Adjust Kaise Karein
`antiBan.js` me `WarmUpManager.getDailyLimit()`:
```javascript
// Slower warm-up (10 days, start with 10)
return Math.round(10 * Math.pow(1.5, day - 1));

// Faster warm-up (5 days, start with 50)
return Math.round(50 * Math.pow(2.0, day - 1));
```

---

## Layer 4: Health Monitor

### Problem
Agar WhatsApp server baar-baar disconnect kar raha hai ya messages fail ho rahe hain — ye signs hain ki ban hone wala hai. Agar bhejte rahe toh ban pakka.

### Solution
**Risk score (0-100)** track hota hai har event pe:

| Event | Score Impact |
|-------|-------------|
| Failed message send | +10 per failure (max 40) |
| Disconnection | +15 per disconnect (max 45) |
| High send velocity (>200/hr) | +15 |
| Successful send | -0.5 (decay) |

### Risk Levels

| Score | Level | Kya hota hai |
|-------|-------|-------------|
| 0-29 | **Low** | Normal operation, sab theek hai |
| 30-59 | **Medium** | Warning — reduce speed recommended |
| 60-84 | **High** | **Auto-pause** — sending ruk jaata hai |
| 85-100 | **Critical** | **Auto-pause** — immediate stop |

### Auto-Pause Behavior
Jab risk **high** ya **critical** hota hai:
- Naye messages **reject** ho jaate hain with error
- Log me warning aata hai: `Anti-ban: HIGH RISK (score: 65). Pausing sends.`
- User ko error dikhta hai: `"Sending paused due to high risk score. Try again later."`

### Recovery
Risk score **automatically decay** karta hai:
- Har successful send pe `-0.5` score
- Server restart pe health reset hota hai

### Check Anti-Ban Status
Session status API se check kar sakte ho:
```
GET /api/session/status
```

Response me `antiBan` object aata hai:
```json
{
  "status": "connected",
  "antiBan": {
    "warmUp": {
      "day": 3,
      "dailyLimit": 65,
      "sentToday": 42,
      "warmUpComplete": false
    },
    "health": {
      "score": 15,
      "level": "low",
      "failedSends": 1,
      "disconnects": 0,
      "totalSends": 42,
      "paused": false
    }
  }
}
```

---

## Complete Message Flow

Jab ek message send hota hai, ye sab steps hote hain:

```
User clicks "Send" / Bulk send triggers
         │
         ▼
   ┌─ Health Check ─┐
   │ Risk score     │──── HIGH/CRITICAL → ❌ Message rejected
   │ < 60?          │
   └────────────────┘
         │ OK
         ▼
   ┌─ Warm-up Check ─┐
   │ Daily limit     │──── LIMIT REACHED → ❌ "Try tomorrow"
   │ not reached?    │
   └─────────────────┘
         │ OK
         ▼
   ┌─ Typing Simulation ─┐
   │ "composing..." sent  │
   │ Wait 3-6 sec random  │
   │ "paused" sent        │
   └──────────────────────┘
         │
         ▼
   ┌─ Message Queue ─┐
   │ Rate limit check │──── PER-MIN/HR LIMIT → Wait until window clears
   │ (4/min, 120/hr)  │
   └──────────────────┘
         │ OK
         ▼
   ┌─ Human Delay ─────┐
   │ Wait 12-18 sec     │
   │ (15s ± 3s jitter)  │
   └────────────────────┘
         │
         ▼
   ┌─ Baileys Send ─┐
   │ sock.sendMessage│──── SUCCESS → health.recordSuccess() + warmUp.recordSend()
   │                 │──── FAIL → health.recordFailure() + retry (max 2)
   └─────────────────┘
```

**Total time per message: ~19-25 seconds** (typing + delay + jitter)

---

## Best Practices

### Do's
- **Warm-up pura karo** — Naye number pe 7 din dheere-dheere bhejo
- **Business hours me bhejo** — 8 AM to 9 PM IST
- **Message vary karo** — Same text sabko mat bhejo, `{{name}}` variables use karo
- **Contacts save karwao** — Receivers ko bolo aapka number save karein (saved contacts se ban risk kam)
- **Health monitor dekho** — Risk score regularly check karo
- **Breaks lo** — 100 messages ke baad 15-30 min ka break do

### Don'ts
- **Warm-up skip mat karo** — Day 1 pe 500 messages = ban
- **Raat ko mat bhejo** — 10 PM to 8 AM avoid karo
- **Same message sabko mat bhejo** — Copy-paste = spam detection
- **Failed messages ignore mat karo** — Failures badhein toh ruko
- **Multiple devices mat use karo** — Ek number ek device pe
- **Report hone pe ignore mat karo** — Agar 5+ reports aaye toh sending band karo

### Bulk Sending Tips (3000+ contacts)
1. **Warm-up pehle karo** — 7 din pehle number connect karo, dheere-dheere bhejo
2. **Batches me bhejo** — 500 contacts per batch, batches ke beech 1 hour gap
3. **Conservative settings use karo** — `defaultDelayMs: 25000`, `maxPerMinute: 2`
4. **Health monitor dekho** — Score 30+ jaaye toh break lo
5. **Multiple numbers use karo** — 3000 contacts = 3 numbers x 1000 each (safest)
6. **Personalize karo** — `{{name}}`, `{{company}}` variables use karo

---

## Troubleshooting

### "Sending paused due to high risk score"
- **Kya hua:** Health score 60+ ho gaya
- **Fix:** 1-2 ghante wait karo, server restart karo (health reset hoga)
- **Prevention:** Slower sending speed use karo

### "Daily warm-up limit reached"
- **Kya hua:** Aaj ke din ki warm-up limit khatam
- **Fix:** Kal phir bhejo — limit automatically badh jaayegi
- **Check:** `warmup_user_X.json` file dekho current day/limit

### Number ban ho gaya
- **Immediate:** Naya number register karo, QR scan karo
- **Warm-up se shuru karo** — Day 1 se phir se
- **Review karo** — Kya messages spam the? Kya too fast bheje?
- **WhatsApp appeal:** Business account pe appeal kar sakte ho

### Messages bahut slow ja rahe hain
- **Expected behavior:** Anti-ban ke saath 19-25 sec per message normal hai
- **3000 contacts = ~16-20 hours** (conservative settings ke saath)
- **Speed chahiye?** Multiple WhatsApp numbers use karo parallel me

---

## Configuration Quick Reference

### Safe (Default) — Recommended
```javascript
// sessionManager.js
defaultDelayMs: 15000    // 15 sec gap
maxPerMinute: 4          // 4 msg/min
maxPerHour: 120          // 120 msg/hr

// connectionManager.js — typing simulation
humanDelay(4000, 1500)   // 2.5-5.5 sec typing

// antiBan.js — warm-up
day1Limit: 20
growthFactor: 1.8
warmUpDays: 7
```

### Aggressive (Risky) — Sirf purane trusted numbers ke liye
```javascript
defaultDelayMs: 8000     // 8 sec gap
maxPerMinute: 6          // 6 msg/min
maxPerHour: 200          // 200 msg/hr
humanDelay(2000, 500)    // 1.5-2.5 sec typing
```

### Conservative (Safest) — Naye numbers / 3000+ contacts ke liye
```javascript
defaultDelayMs: 25000    // 25 sec gap
maxPerMinute: 2          // 2 msg/min
maxPerHour: 60           // 60 msg/hr
humanDelay(6000, 2000)   // 4-8 sec typing
```

---

## Time Estimates

| Contacts | Safe (default) | Conservative | Aggressive |
|----------|---------------|-------------|-----------|
| 100 | ~30 min | ~50 min | ~15 min |
| 500 | ~2.5 hrs | ~4 hrs | ~1.5 hrs |
| 1000 | ~5 hrs | ~8 hrs | ~3 hrs |
| 3000 | ~15 hrs | ~24 hrs | ~8 hrs |
| 5000 | ~25 hrs | ~40 hrs | ~14 hrs |

**Note:** Ye approximate time hai. Actual time warm-up limits, health pauses, aur rate limiting pe depend karega.
