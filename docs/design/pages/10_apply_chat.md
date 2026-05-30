> **Build status:** ❌ Not redesigned — old ApplyPage live
> Consolidated docs index: [../../README.md](../../README.md) · Status tracker: [../../STATUS.md](../../STATUS.md) · Design system: [../00_design_system.md](../00_design_system.md)
> This page merges the v3 redesign spec with the pre-v3 behavioral spec (appendix below, where one existed).

# Page 10 — Apply Chat (Candidate-facing)

**Pattern:** *Conversational stepper* (variant A)
**Replaces:** Chat bubbles + progress dots
**Why:** The apply flow is a structured 8-step linear wizard (per `CandidateChatController`), not a free-form chat. Treating it as chat makes progress invisible, hides upcoming steps, and creates an "is this a real form or a chatbot?" trust gap. The stepper turns it into a polished form with conversational copy.

Preview reference: `/tmp/atl-design-preview-v3.html` → tab "Apply Chat".
Existing doc this supersedes: `docs/pages/07_apply.md`.

---

## 1. Route & layout

| Aspect | Value |
|---|---|
| Route | `/apply/:token` |
| Auth | **Public** (magic link only · no JWT) |
| Layout | Centered card · max-width 520px · mobile-first |
| Layout `<head>` | Org-customized: title `"Apply: <role> @ <org>"`, favicon from career-page branding |

---

## 2. Backend tie-in

Already implemented per `apply_service.py`. The redesign is purely UI; the 8-step state machine and SSE remain the same.

| Endpoint | Used for |
|---|---|
| `GET /api/v1/apply/{token}` | Verify token + load context (candidate, position, org branding, screening Qs) |
| `POST /api/v1/apply/{token}/message` | Submit answer to current step (or send free-form chat message) |
| `POST /api/v1/apply/{token}/resume` | Resume upload (file) |
| `POST /api/v1/apply/{token}/complete` | Finalize on step 8 |

The 8 linear steps from `backend/agents/candidate_chat.py`:

1. **greeting** — AI greets by name, confirms interest
2. **interest** — yes/no chip + reason (if no, polite close)
3. **current_role** — current company + title
4. **experience** — years (total + relevant)
5. **compensation** — current CTC + expected CTC (range slider)
6. **notice_period** — availability (chips: "Immediate", "15 days", "30d notice", "60d+")
7. **resume_upload** — file picker (PDF/DOCX, 5MB max)
8. **screening_questions** — dynamic Qs from org settings
9. **completion** — thank-you + status portal link

(Visual progress shows 8 dots; "greeting" and "completion" are not counted as user-input steps.)

---

## 3. Layout

```
[ Centered card · light bg gradient · drop shadow ]
┌─────────────────────────────────────────────────┐
│ HEADER (teal gradient)                          │
│ TechCorp · Engineering                          │
│ Apply: Senior ML Engineer                       │
│ Bangalore · Hybrid · ₹40–60 LPA · Step 4 of 8  │
├─────────────────────────────────────────────────┤
│ PROGRESS BAR                                    │
│ Step 4 · Compensation                  4 of 8  │
│ ●─●─●─●─○─○─○─○                                 │
├─────────────────────────────────────────────────┤
│ BODY (min-height 360px)                         │
│                                                 │
│   [AI avatar] Last few questions on the basics. │
│                                                 │
│   What's your expected compensation?            │
│   Range in ₹ LPA. We'll only show this to the   │
│   hiring team — not panelists.                  │
│                                                 │
│   [── range slider · 32–48 LPA ──]              │
│   20  30  40  50  60  70                        │
│                                                 │
│   Current CTC (optional)                        │
│   [Prefer not to say] [<20] [20-35*] [35-50]    │
│                                                 │
│   🔒 AI disclosure · Your responses are private │
├─────────────────────────────────────────────────┤
│ FOOTER                                          │
│ 🔒 SOC2-secure          [← Back] [Continue →]  │
└─────────────────────────────────────────────────┘
                                                  
[ Magic link · expires in 71h 24m | support@techcorp.com ]
```

---

## 4. Step-by-step interactions

### Step 1 — Greeting (auto-advance)
AI line + 2 buttons: `[Yes, let's go]` (primary) / `[Not interested]`. If "Not interested" → step 1.5 (reason chips) → polite-close screen.

### Step 2 — Interest reason (if needed)
Chips: "Wrong fit", "Comp doesn't match", "Already at offer elsewhere", "Other". Final option opens free-text.

### Step 3 — Current role
Two-input row: `[Company name]` `[Current title]`. Both required.

### Step 4 — Experience
Two number sliders (or steppers): total years · relevant years. Quick-pick chips: "0-2 / 3-5 / 5-10 / 10+".

### Step 5 — Compensation
Range slider for expected CTC band (min/max). CTC current is optional chip-pick. Privacy note: "We'll only show this to the hiring team — not panelists."

### Step 6 — Notice period
Chips: "Immediate", "15 days", "30 days", "60+ days", "Custom". "Custom" opens free-text.

### Step 7 — Resume upload
Large drag-drop tile with `[Choose file]` button. Accepts PDF / DOCX up to 5MB. After upload, AI shows a parsed-fields preview: "I see you're at TechCorp · 5 yrs experience · Python, PyTorch... is that right? [Yes / Edit]".

### Step 8 — Screening questions
Dynamic Qs from `org.screening_questions`. Each Q is a separate sub-step. Question types:
- Text (textarea)
- Yes/No (2 chips)
- Multi-choice (chips)
- Number (slider)
- File (small upload — e.g. portfolio)

### Completion
Thank-you screen + status portal link + "We'll email you at every stage" promise. Auto-redirects to `/status/:status_token` after 5s.

---

## 5. Progress bar

8 dots, full-width across the header. Each dot:
- **Done** — green fill
- **Current** — teal fill with subtle pulse animation
- **Pending** — neutral fill

Below: `Step N · <stage name>` label + `N of 8`.

Tapping a done-dot does NOT let the user navigate back — they use the explicit `[← Back]` button to edit a previous answer (replays that step).

---

## 6. Interaction types

| Step type | UI element |
|---|---|
| Single-choice short list (Yes/No) | Large chip buttons (2-4 wide) |
| Single-choice longer list | Chips that wrap, picked state highlighted |
| Multi-choice | Chips with `picked` state (multiple allowed) |
| Years / number | Number input + quick-pick chips below |
| Range (comp) | Dual-handle range slider with anchored marks |
| Long text | Textarea (auto-grow, max 200 chars indicator) |
| File upload | Drag-drop tile (large) |

All inputs are big touch targets (min 44px height) for mobile.

---

## 7. AI disclosure (legal / trust)

Below every body, a persistent footer note:

> 🔒 **AI disclosure:** This is an AI-powered application chat. Your answers help the hiring team review you faster. Your responses are private · reviewed only by TechCorp's hiring team · GDPR/DPDP compliant.

This satisfies PRODUCT_PLAN §15 rule 4 ("AI disclosure in emails/chat").

---

## 8. Consent capture (GDPR/DPDP — step 0)

Before step 1, a consent screen (one-time, captured in `consent_records`):

```
"By continuing, you agree to share your application data with TechCorp.
 We retain your data for 12 months unless you request earlier deletion.
 [Privacy policy →] [Delete my data →]"

[I agree, continue]   [Decline]
```

Decline → polite close. Agree → record consent, advance to step 1.

---

## 9. Branded for the org

The candidate-facing apply chat is **the org's brand surface** — not AI Talent Lab's. Per PRODUCT_IMPROVEMENTS §5.2, Phase 2 adds:
- Custom primary color (from `org.career_primary_color`)
- Hero banner image (from `org.career_banner_url`)
- Custom tagline (from `org.career_tagline`)
- Custom title bar with org logo

In v3 preview the colors are still teal (AI Talent Lab default). In production each org's apply chat will use their own brand.

---

## 10. Components to build / refactor

| Component | Path | Notes |
|---|---|---|
| `<ApplyPage>` | `frontend/src/components/Apply/ApplyPage.jsx` | Refactor |
| `<ApplyHeader>` | `Apply/ApplyHeader.jsx` | New — branded gradient header |
| `<ApplyProgress>` | `Apply/ApplyProgress.jsx` | New — progress dots + label |
| `<ApplyStep>` | `Apply/ApplyStep.jsx` | New — wrapper for current step body |
| Step components — `<StepInterest>`, `<StepCurrentRole>`, `<StepExperience>`, `<StepCompensation>`, `<StepNotice>`, `<StepResume>`, `<StepScreening>`, `<StepComplete>` | `Apply/steps/` | New — one per step type |
| `<RangeSlider>` | `common/RangeSlider.jsx` | New shared atom (dual-handle) |
| `<ChipPicker>` | `common/ChipPicker.jsx` | New — single/multi-select chip group |
| `<UploadTile>` | `common/UploadTile.jsx` | New — drag-drop file picker |
| `<ConsentScreen>` | `Apply/ConsentScreen.jsx` | New |
| `<ApplyComplete>` | `Apply/ApplyComplete.jsx` | New — thank-you + redirect |

---

## 11. Empty / loading / error states

| Condition | Display |
|---|---|
| Invalid / expired token | Centered card: "This link has expired. Please reach out to your recruiter for a new one." |
| Already applied | "You've already applied to this role on May 6. [View your status →]" |
| Server error mid-step | Inline retry within current step; preserve answers in localStorage |
| Resume upload too large | Inline error: "Max 5MB. Try compressing or upload as PDF." |
| User abandons mid-flow | Backend tracks `last_active_at`; recruiter sees "Started application 4d ago, stopped at step 5" |

---

## 12. Build notes

1. State is server-authoritative (existing `CandidateChatController` handles state per session); UI is mostly presentation.
2. Each step submits via `/message` endpoint with structured payload; backend advances state machine.
3. Allow back-navigation only within the session (`[← Back]` replays previous step with prior answer pre-filled).
4. Persist partial answers in localStorage keyed by token, in case the user loses connection.
5. Mobile-first: test at 375px width; everything must work with thumbs.


---

## Appendix — pre-v3 behavioral spec & flows

_Retained from the original `docs/pages/` spec for workflow, edge-case, and API detail. The v3 spec above supersedes the **visual** design; the behavior here is still the reference._

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

**State B0 — Consent Screen** (shown before first chat if consent not yet given):
```
┌──────────────────────────────────────────┐
│  [Org Logo]  TechCorp                    │
│                                          │
│  Before we start, please review:         │
│                                          │
│  • Your info is used for hiring at       │
│    TechCorp only                         │
│  • AI is used to match your skills       │
│    with the role                         │
│  • Your data is stored securely and      │
│    not shared with third parties         │
│                                          │
│  By continuing, you agree to our         │
│  [Privacy Policy ↗]                      │
│                                          │
│  [I Agree & Continue]   [No Thanks]      │
└──────────────────────────────────────────┘
```
Consent stored in session. Not shown again on re-entry if already consented.

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
│  PROGRESS BAR (above input)                                      │
│  ● ● ● ○ ○ ○ ○ ○   Step 3 of 8                                 │
│  Interest → Role → Experience → Compensation → Notice → Resume  │
│  → Video → Screening → Done                                      │
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

### Step 6.5 — Video Introduction (Optional)
```
AI: "Would you like to record a short video introduction?
     This is optional but helps the team get to know you better."

     [📹 Upload Video (60s max — MP4 or WebM)]    [Skip — I'll pass]
```
Shown only after resume upload. Fully optional — candidate can skip with no consequence.
On upload: video stored, `video_intro_url` saved in `candidate_applications`.
Recruiter sees video player in Candidate Detail → Application tab.

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
