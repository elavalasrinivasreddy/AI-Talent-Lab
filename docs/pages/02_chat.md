# Page Design: Chat Window (JD Generation)
> **Version 2.1 — Finalized**
> Primary work interface. Recruiters create JDs through structured AI conversation.
> This is the core product differentiator. Every stage has specific UI behavior documented here.

---

## 1. Overview

| Aspect | Detail |
|---|---|
| Route | `/chat` (new) · `/chat/:sessionId` (existing) |
| Auth | Required (JWT) |
| Layout | Sidebar + full-width chat (no page padding — edge to edge) |
| Entry Points | "New Hire" sidebar button · Click session in sidebar list |
| Exit | "Save & Find Candidates" → Position Setup Modal → `/positions/:id` |

---

## 2. Page Layout

```
┌────────────────────────────────────────────────────────────────────┐
│  CHAT TOPBAR (sticky, 56px)                                        │
│  [✏️ Senior Python Developer]  [● Gathering Requirements]          │
│                                [Discard]  [Save & Find Candidates]  │
├────────────────────────────────────────────────────────────────────┤
│  MESSAGE AREA (scrollable, flex-grow)                              │
│                                                                    │
│  ┌── AI ─────────────────────────────────────────────────────┐    │
│  │  🤖  Hi! I'm your AI hiring assistant. What role are you  │    │
│  │      looking to fill today? You can also upload an        │    │
│  │      existing JD if you'd like me to start from that.     │    │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│          ┌── User ─────────────────────────────────────────┐      │
│          │  Senior Python Developer, 5+ yrs, FastAPI, AWS  │      │
│          └─────────────────────────────────────────────────┘      │
│                                                                    │
│  ┌── AI ─────────────────────────────────────────────────────┐    │
│  │  🤖  Got it! Two quick questions:                          │    │
│  │      - Work arrangement: remote / hybrid / onsite?        │    │
│  │      - Experience range: 5–8 years or more specific?      │    │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  ┌── INTERNAL CHECK CARD (interactive) ──────────────────────┐    │
│  │  📊 Internal Skills Check  ...                            │    │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│  MESSAGE INPUT (sticky bottom, 72px)                               │
│  [📎]  Type your message or upload a reference JD...       [➤]    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 3. Chat Top Bar

```
[✏️ Senior Python Developer]     [● Gathering Requirements ▾]     [Discard]  [Save & Find Candidates]
```

**Title:** Contenteditable div. Auto-set from first role name extracted by AI. Click to edit inline.

**Stage indicator pill — colors by stage:**
| Stage | Label | Color |
|---|---|---|
| `intake` | Gathering Requirements | Blue |
| `internal_check` | Internal Skills Check | Purple |
| `market_research` | Market Research | Cyan |
| `jd_variants` | Choose JD Style | Amber |
| `final_jd` | Generating JD | Green |
| `bias_check` | Bias Check | Green |
| `complete` | Complete | Gray |

**Discard:** Only visible for unsaved sessions. Confirmation dialog before deleting.

**"Save & Find Candidates":** Disabled (grayed) until `stage = complete`. Enabled once final JD exists. Clicking opens Position Setup Modal.

---

## 4. Workflow Stages

### Stage 1 — Intake

AI asks 2–3 questions per turn maximum. Never dumps all questions at once.

**Minimum required before proceeding:**
- Role title
- Experience range (min/max years)
- Key required skills (at least 3)
- Location / work type

**File upload:** Paperclip icon opens PDF/DOCX picker. System extracts requirements from existing JD, summarizes, asks recruiter to confirm.

**Stage summary + confirmation before proceeding:**
```
🤖 Here's what I've gathered:

Role: Senior Python Developer
Experience: 5–8 years
Skills: Python, FastAPI, PostgreSQL, AWS, Docker
Work type: Hybrid · Bangalore
Employment: Full-time

Does this look right, or anything to adjust?
```

User confirms → moves to Stage 2.

---

### Stage 2 — Internal Check Card

AI message:
```
🤖 Let me check what skills your organization has used in similar past roles...
```

Then card appears:

```
┌── 📊 Internal Skills Check ──────────────────────────────────────┐
│                                                                   │
│  Found these skills in past Engineering dept JDs                 │
│  that aren't in your current requirements:                        │
│                                                                   │
│  [✅ Redis]       ← used in Sr Backend Dev (2024)                │
│  [✅ Docker]      ← used in Backend Engineer (2024)              │
│  [☐  MongoDB]     ← used in Full Stack Dev (2023)               │
│  [☐  Kafka]       ← used in Platform Engineer (2024)            │
│                                                                   │
│  [Accept Selected (2)]    [Accept All (4)]    [Skip →]           │
└───────────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Chips default to checked. User can uncheck any.
- Each chip shows which past role + year it came from.
- "Accept Selected" → adds checked skills to requirements
- "Skip" → proceeds without changes
- After action: card collapses to read-only summary line: `"Added: Redis, Docker ✅"`
- If no ChromaDB data: `"No similar past roles found. Moving to market research..."`

---

### Stage 3 — Market Research Card

AI message:
```
🤖 Now checking what top companies are asking for in similar roles...
```

```
┌── 🌐 Market Research ─────────────────────────────────────────────┐
│                                                                    │
│  Analyzed: Google · Flipkart · Razorpay  (from Competitor Intel)  │
│                                                                    │
│  Skills they emphasize that aren't in your current JD:           │
│                                                                    │
│  [✅ GraphQL]    ← Flipkart, Razorpay (2 of 3)                   │
│  [✅ gRPC]       ← Google, Flipkart (2 of 3)                     │
│  [☐  Terraform]  ← Razorpay (1 of 3)                            │
│  [☐  K8s]        ← Google (1 of 3)                              │
│                                                                    │
│  [Accept Selected (2)]    [Accept All (4)]    [Skip →]            │
└────────────────────────────────────────────────────────────────────┘
```

**Same behavior as Internal Check.** If no competitors configured:
```
🤖 No competitors configured. Add them in Settings → Competitor Intel to 
   enable market benchmarking. Moving ahead without this step...
```

---

### Stage 4 — JD Variants Card

AI message:
```
🤖 Based on everything we've gathered, here are 3 JD styles. 
   Read through them and pick the one that fits — you can edit 
   any before selecting.
```

```
┌── 📋 Choose Your JD Style ──────────────────────────────────────────┐
│                                                                      │
│ ┌── Skill-Focused ───┐  ┌── Outcome-Focused ─┐  ┌── Hybrid ────┐   │
│ │                    │  │                    │  │              │   │
│ │ Leads with tech    │  │ Leads with what    │  │ Balanced mix │   │
│ │ stack and          │  │ candidate will     │  │ of skills +  │   │
│ │ requirements       │  │ achieve/deliver    │  │ outcomes     │   │
│ │                    │  │                    │  │              │   │
│ │ Skills listed: 12  │  │ Skills listed: 8   │  │ Listed: 10   │   │
│ │ Tone: Technical    │  │ Tone: Inspiring    │  │ Tone: Modern │   │
│ │                    │  │                    │  │              │   │
│ │ [Preview ▾]        │  │ [Preview ▾]        │  │ [Preview ▾]  │   │
│ │ [✏️ Edit]          │  │ [✏️ Edit]          │  │ [✏️ Edit]    │   │
│ │ [Select This →]    │  │ [Select This →]    │  │ [Select →]   │   │
│ └────────────────────┘  └────────────────────┘  └──────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

**Preview ▾** expands full JD inline. **✏️ Edit** turns content to textarea. **Select This** triggers final generation. User can also type `"I'll go with the hybrid one"` — system maps intent.

After selection: card collapses to `"Selected: Hybrid variant ✅"`

---

### Stage 5 — Final JD + Bias Check

Final JD streams into FinalJDCard token by token:

```
┌── 📄 Your Job Description ──────────────────────────────────── [Edit ✏️] ─┐
│                                                                            │
│  # Senior Python Developer                                                 │
│                                                                            │
│  ## About TechCorp                                                         │
│  {org.about_us from settings — auto-inserted}                              │
│                                                                            │
│  ## Role Overview                                                          │
│  We are seeking an experienced Python developer to build...                │
│  (streaming token by token ▌)                                              │
│                                                                            │
│  ─────────────────────────────────────────────────────────────            │
│  [✏️ Edit]   [📋 Copy]   [📥 Download PDF]   [📥 Download .md]            │
│                                                                            │
│  [💾 Save & Find Candidates]  ← PRIMARY CTA (enabled after streaming done) │
└────────────────────────────────────────────────────────────────────────────┘
```

Bias Check card appears automatically below:

```
┌── 🔍 Bias Check ──────────────────────────────────────────────────┐
│  Found 2 potentially problematic phrases:                         │
│                                                                   │
│  "rockstar developer" → Try: "exceptional developer"    [Fix]    │
│  "must work in fast-paced environment" →                         │
│   Try: "comfortable with iterative delivery"            [Fix]    │
│                                                                   │
│  [Apply All Fixes]                               [Dismiss]       │
└───────────────────────────────────────────────────────────────────┘
```

**Edit mode:** Click Edit → textarea with raw markdown → "Done" → re-renders.
**Refine via chat:** User can type "Make it more senior-focused" → AI rewrites + re-streams.

---

## 5. Position Setup Modal

Triggered when user clicks "Save & Find Candidates":

```
┌── Almost Done! Set Up This Position ──────────────────────────┐
│                                                                │
│  Number of Openings          [  1  ]  (– / +)                 │
│                                                                │
│  Candidate Search Frequency                                    │
│  ( ) Manual only                                               │
│  (●) Daily        ← default                                   │
│  ( ) Every 2 days                                              │
│  ( ) Weekly                                                    │
│                                                                │
│  Minimum Match Score (ATS Threshold)                           │
│  [80% ▼]   (60% / 70% / 75% / 80% / 85% / 90%)               │
│                                                                │
│  Priority                                                      │
│  [Normal ▼]   (Urgent / High / Normal / Low)                  │
│                                                                │
│  Department                                                    │
│  [Engineering ▼]   (pre-filled from user's dept)              │
│                                                                │
│                  [Cancel]    [Save & Start Search]            │
└────────────────────────────────────────────────────────────────┘
```

**On confirm:**
1. Save position with settings
2. Save final JD linked to position
3. Trigger `tasks/candidate_pipeline.py` background task
4. Navigate to `/positions/:id`
5. Toast: "Position created! Candidate search running in background."

---

## 6. Message Bubbles

**User:** Right-aligned, accent color background, white text, max-width 70%.

**AI:** Left-aligned, `var(--bg-secondary)`, markdown rendering, streaming cursor `▌` while generating.

**System/cards:** Full-width interactive cards embedded in message flow.

---

## 7. Message Input

```
[📎]  Type your message or upload a reference JD...        [➤]
```

- **📎:** Opens file picker (PDF/DOCX only, max 10MB)
- **Textarea:** Auto-resizes to 5 lines max, then scrolls. Enter = send, Shift+Enter = newline.
- **Disabled states:**
  - While streaming: "AI is thinking..."
  - After position saved: "Position saved. Manage it in the dashboard."

---

## 8. Sidebar Sessions

```
ACTIVE SESSIONS
● Senior Python Developer    ← current (highlighted)
● ML Engineer
○ Product Designer (Draft)   ← gray = incomplete/draft
```

Solid dot = position saved. Gray dot = still in progress. Right-click → rename / delete.

---

## 9. API Calls

| Action | Endpoint | Method |
|---|---|---|
| Send message (streaming) | `POST /api/v1/chat/stream` | POST + SSE |
| Load session | `GET /api/v1/chat/sessions/:id` | GET |
| List sessions | `GET /api/v1/chat/sessions` | GET |
| Upload reference JD | `POST /api/v1/chat/sessions/:id/upload` | POST |
| Delete session | `DELETE /api/v1/chat/sessions/:id` | DELETE |
| Rename session | `PATCH /api/v1/chat/sessions/:id/title` | PATCH |
| Save position | `POST /api/v1/chat/sessions/:id/save-position` | POST |

---

## 10. Edge Cases & Error Recovery

### Stage-by-Stage Failure Behavior

Each stage in the pipeline has a defined failure mode — either a **hard stop** (cannot continue) or a **soft skip** (optional, proceed without it). Full technical implementation is in `BACKEND_PLAN.md § 14`.

| Stage | Failure Type | What the User Sees |
|---|---|---|
| **Intake** | Hard stop | "I had trouble processing that. Could you rephrase?" — stays at intake, user retries by typing again. Max 3 failures → "Please start a new session." |
| **Internal Check** | Soft skip | Muted system message: "No past role data found. Moving to market research..." — auto-advances, no user action |
| **Market Research** | Soft skip | "Market research unavailable right now. Continuing with what we have." — auto-advances. If no competitors configured: link to Settings shown. |
| **JD Variants** | Hard stop + retry | Auto-retries once silently. If retry fails → "Trouble generating variants. [Retry]" button appears. Session preserved. |
| **Final JD** | Hard stop + retry | Auto-retries once silently. If stream is interrupted mid-generation → partial JD shown with "[Regenerate JD]" button. |
| **Bias Check** | Soft skip | Silently skipped. No bias card shown. Save button stays enabled. |
| **Position Save** | Hard stop | Modal stays open, toast: "Failed to save. Please try again." Data not lost. |

### Network & Connection Failures

| Scenario | Behavior |
|---|---|
| SSE drops mid-stream | Yellow reconnection banner at top of chat. "Retry" button on last message. Session state preserved — no data lost. |
| LLM timeout (>60s) | Error on current message. "Try again" button. Input re-enabled. |
| Browser refresh mid-chat | Session fully restored from server (graph_state persisted after each stage). Streaming does not auto-resume — user sends a message to continue. |
| Server restart during session | Session recovered from DB on next request. Same behavior as browser refresh. |

### Input & Upload Failures

| Scenario | Behavior |
|---|---|
| Unreadable PDF upload | "Could not read this file. Please try a different PDF or paste the JD as text." |
| PDF too large (>10MB) | "File too large. Maximum 10MB." Shown before upload. |
| No competitors configured | Market card skipped. System message: "No competitor companies configured. [Add in Settings →]" |
| No past JDs (empty ChromaDB) | Internal check auto-skipped. System message: "No past hiring data yet. Skipping internal check." |
| Empty About Us in org settings | JD generated without About Us section. Warning: "Your About Us is empty — add it in [Settings → Organization] to include it in JDs." |

### Recovery Rule

**The user should never need to restart from scratch due to a technical failure.** Session state (all intake data, skills accepted, variant selected) is saved after every successful stage. At worst, the user retries the failed stage — not the entire workflow.

### Post-JD Refinement

| Scenario | Behavior |
|---|---|
| User asks AI to refine after final JD | AI rewrites and re-streams the full JD. Bias check re-runs automatically. Save button stays enabled throughout. |
| User edits JD manually (Edit mode) | Direct textarea edit. Saved on "Done". Bias check does NOT re-run (user edited intentionally). |
| User wants to change variant after final JD | Type "Go back to variants" or "Show me the skill-focused version" → orchestrator re-runs from JD_VARIANTS stage only. |
