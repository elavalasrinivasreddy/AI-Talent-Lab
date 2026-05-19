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
