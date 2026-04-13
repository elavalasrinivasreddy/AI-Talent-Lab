# Page Design: Candidate Magic Link Chat (Apply Page)
> **Version 2.1 — Rewritten**
> This is a CHAT interface — NOT a form. Candidate clicks magic link from outreach email.
> No login required. Mobile-first. Secured by signed JWT token.

---

## 1. Overview

| Aspect | Detail |
|---|---|
| Route | `/apply/:token` |
| Auth | None — public, token-based security |
| Entry Point | Candidate clicks magic link in outreach email (or career page "Apply" button) |
| Layout | No sidebar — public layout, mobile-first |
| Token expiry | 72 hours from sending |
| Session | Token links to `candidate_applications` record |

---

## 2. Page States

**State A — Loading:** Verifying token. Show spinner + org logo.

**State B — Valid Token → Chat interface**

**State C — Expired:**
```
┌──────────────────────────────────────────┐
│  [Org Logo]  TechCorp                    │
│                                          │
│  ⏰ This link has expired                 │
│                                          │
│  Application links are valid for 72      │
│  hours. Please contact the recruiter     │
│  for a new link.                         │
│                                          │
│  📧 hiring@techcorp.com                  │
└──────────────────────────────────────────┘
```

**State D — Already Completed:**
```
┌──────────────────────────────────────────┐
│  [Org Logo]  TechCorp                    │
│                                          │
│  ✅ You've Already Applied!              │
│                                          │
│  You submitted your application on       │
│  Apr 10, 2026. The team will review      │
│  it and reach out with next steps.       │
│                                          │
│  Good luck! 🍀                           │
└──────────────────────────────────────────┘
```

---

## 3. Page Layout (Chat Mode)

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER (fixed, 60px)                                            │
│  [Org Logo]  TechCorp                                            │
│              Powered by AI Talent Lab (small, muted)            │
├─────────────────────────────────────────────────────────────────┤
│  POSITION INFO STRIP (collapsible)                               │
│  💼 Senior Python Developer · 📍 Bangalore · Hybrid             │
│  [View Full JD ▾]                                               │
├─────────────────────────────────────────────────────────────────┤
│  CHAT MESSAGES (scrollable, flex-grow)                           │
│                                                                  │
│  ┌── AI ────────────────────────────────────────────────────┐  │
│  │  Hi Rahul! 👋  Thanks for your interest in the           │  │
│  │  Senior Python Developer role at TechCorp.               │  │
│  │  This will take about 3–4 minutes.                       │  │
│  │                                                          │  │
│  │  Are you currently open to exploring this opportunity?   │  │
│  │                                                          │  │
│  │  [Yes, I'm interested!]     [No, thanks]                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  INPUT (sticky bottom)                                           │
│  [Type your reply...                                    Send]   │
│                                                                  │
│  Powered by AI Talent Lab · Privacy Policy                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Conversation Flow (Turn by Turn)

### Step 1 — Greeting + Interest Check
```
AI: "Hi {candidate_name}! 👋

I'm an AI assistant helping {org_name}'s hiring team. We came across 
your profile for the {role_name} role. This takes about 3–4 minutes.

Are you currently open to exploring this opportunity?"

Quick replies: [Yes, I'm interested!]  [No, thanks]
```

**If No:**
```
AI: "No problem at all! We appreciate you letting us know.
We'll keep your profile for future opportunities. Best of luck! 🍀"
```
Session ends. Application status unchanged.

---

### Step 2 — Current Role Confirmation
```
AI: "Great! We have you listed as {current_title} at {current_company}.
Is that still your current role?"

Quick replies: [Yes, that's correct]  [No, let me update]
```
If No → AI asks for current role + company.

---

### Step 3 — Experience
```
AI: "How many years of total professional experience do you have?
And how many years are directly relevant to {role_area}?"
```
Candidate types. AI confirms: `"Got it — 6 years total, 4 years backend."`

---

### Step 4 — Compensation
```
AI: "A couple of questions about compensation — this helps ensure the role 
is the right fit:

1. What is your current annual CTC?
2. What are you expecting for this role?"
```
Note: If candidate declines → `"No problem, that's optional."` — marked as declined in responses.

---

### Step 5 — Notice Period
```
AI: "What is your notice period at your current company?"

Quick replies: [Immediate]  [15 days]  [30 days]  [60 days]  [90+ days]
```
Candidate can also type custom answer.

---

### Step 6 — Resume Upload
```
AI: "Almost done! Please share your latest resume."

[📎 Upload your resume — PDF or DOCX · Max 5MB]
```
After upload: `"✅ Resume received!"`

---

### Step 7 — Dynamic Screening Questions
From `screening_questions` table for this org/department. Asked one at a time.

Example:
```
AI: "Are you comfortable working from our Bangalore office 3 days per week?"
```

---

### Step 8 — Completion
```
AI: "That's everything! 🎉

Your application for {role_name} at {org_name} has been submitted.

Here's what to expect:
• Our team will review your profile shortly
• {org_name} typically conducts {round_count} interview rounds: {round_descriptions}
• If shortlisted, you'll receive an email with next steps

Good luck! 🍀"
```

Input disabled. Magic link marked as completed. Auto-sends "interview process overview" email to candidate.

---

## 5. View Full JD Panel

Clicking "View Full JD ▾" expands:
```
── About TechCorp ────────────────────
{org.about_us}

── Senior Python Developer ───────────
{jd_markdown rendered as HTML}

                              [Collapse ▲]
```
Max-height 60vh, scrollable. Does not block input.

---

## 6. Data Collected & Stored

| Field | Stored In |
|---|---|
| Interest confirmed | `candidate_applications.status = 'applied'` |
| Current role + company | `candidates.current_title/company` |
| Experience (total + relevant) | `candidate_applications.screening_responses` |
| CTC (current + expected) | `candidate_applications.screening_responses` (encrypted) |
| Notice period | `candidate_applications.screening_responses` |
| Resume file | `candidates.resume_url` (data/uploads/) + `candidates.resume_text` |
| Custom question responses | `candidate_applications.screening_responses` (JSON) |
| Full conversation | `candidate_session_messages` table |

On completion:
- `candidate_sessions.status = 'completed'`
- `candidate_applications.status = 'applied'`
- `PipelineEvent` created: `event_type = 'applied'`
- Recruiter notification sent
- "Interview process overview" email sent to candidate

---

## 7. Mobile Considerations

- Full-width chat layout (no columns)
- Quick reply buttons: min 44px tap target
- Sticky input at bottom — uses `visualViewport` to avoid keyboard hiding it
- Font minimum 16px on inputs (prevents iOS auto-zoom)
- File upload: works with mobile camera for resume photo

---

## 8. Security

| Concern | Implementation |
|---|---|
| Token | Signed JWT: `{type: "apply", application_id, exp}` |
| Expiry | 72 hours from sending |
| Already completed | Token blocked after `candidate_sessions.status = 'completed'` |
| CTC fields | Encrypted at rest |
| Rate limiting | Max 10 messages/min per session |
| Resume storage | `data/uploads/` — not public URL, served via signed access |

---

## 9. API Endpoints

| Action | Endpoint | Method |
|---|---|---|
| Verify token + load context | `GET /api/v1/apply/:token` | GET |
| Send candidate message | `POST /api/v1/apply/:token/message` | POST |
| Upload resume | `POST /api/v1/apply/:token/upload-resume` | POST (multipart) |
| Complete application | `POST /api/v1/apply/:token/complete` | POST |

**GET response includes:**
```json
{
  "valid": true,
  "already_completed": false,
  "candidate_name": "Rahul Kumar",
  "position": { "role_name": "...", "location": "...", "work_type": "..." },
  "org": { "name": "...", "logo_url": "...", "about_us": "..." },
  "jd_markdown": "...",
  "screening_questions": [
    { "field_key": "office_availability", "label": "...", "field_type": "text", "is_required": true }
  ]
}
```
