# Page 13 — Status Portal (Candidate-facing)

**Pattern:** *Permanent transparency URL* (variant A)
**Replaces:** Current `CandidateStatusPage` (already exists but minimal)
**Why:** PRODUCT_PLAN §2 core philosophy: *"Transparency via communication — candidates receive status updates at every stage — no ghosting."* The status portal is the candidate's persistent home — a permanent link that always tells them where they are and what's next. Trust-builder.

Preview reference: `/tmp/atl-design-preview-v3.html` → tab "Status Portal".
Existing component: `frontend/src/components/Status/CandidateStatusPage.jsx`.

---

## 1. Route & layout

| Aspect | Value |
|---|---|
| Route | `/status/:token` (`status_token` is permanent, per-application) |
| Auth | **Public** (token-based, no JWT) |
| Layout | Centered card stack · max-width 600px · mobile-first |
| Token validity | Permanent — survives the application lifecycle |

---

## 2. Backend tie-in

| Endpoint | Used for |
|---|---|
| `GET /api/v1/status/{token}` | Load candidate + application + position + status + timeline + recruiter info |
| `POST /api/v1/status/{token}/question` | Submit a question to the recruiter (creates `pipeline_event` + email notif) |
| `POST /api/v1/status/{token}/delete-data` | Trigger GDPR right-to-deletion (redirects to `/delete-my-data?token=...`) |

DB: `candidate_applications.status_token` (already in schema per `database_schema.md`).

---

## 3. Layout

```
[ HERO CARD ]
  TechCorp · for Alex Chen                                  ← org branding
  Your application status                                   ← h1
  For Senior ML Engineer · Applied May 6 · "This page lives at your private URL · bookmark it."

  [ 6-STAGE PROGRESS — horizontal connected dots ]
  ✓ Applied  ✓ Screening  ✓ Tech Round  ✓ Panel  ● Offer  ○ Hired

  [ CURRENT STEP CARD (highlighted teal-tint) ]
  Current step · Offer extended
  "Your offer has been sent on May 17 to alex.chen@example.com"
  📩 Please review and respond by May 24. Questions? Reply to the offer email or use the form below —
     Priya Sharma (your recruiter) responds within 4 hours.

[ TIMELINE CARD ]
  What's happened so far
  May 17 · Offer extended · sent via email
  May 15 · Panel complete · 4/4 panelists submitted · positive feedback
  May 10 · Technical interview with Ravi K. · passed
  May 6  · Screening call with Priya S. · passed
  May 6  · Application received · ATS reviewed within 4 hours

[ QUESTION CARD ]
  "Got a question?"
  "Ask anything · Priya typically responds within 4 hours during business hours · no ghosting, ever."
  [textarea] [Send →]

[ FOOTER ]
  🔒 Permanent secure URL · only you can see this · [Delete my data] [Privacy]
```

---

## 4. Hero card

| Field | Source |
|---|---|
| Org mark | small chip with org logo + slug ("TechCorp · for {candidate name}") |
| H1 | "Your application status" |
| Sub | role + applied date + "permanent URL · bookmark it" |
| Progress stages | 6 horizontal dots: Applied → Screening → Tech Round → Panel → Offer → Hired. Done = green ✓; current = teal ● with pulse animation; pending = gray ○ |
| Current step card | teal-tinted card with `kicker` "Current step · X" + bold v line + helpful "next" text |

The 6 stages are normalized for candidate-friendliness; the actual backend statuses (sourced/emailed/applied/screening/interview/on_hold/selected/rejected) map to these display stages:

| Display stage | Backend statuses |
|---|---|
| Applied | applied |
| Screening | screening (or interview round 1) |
| Tech Round | interview round 2 |
| Panel | interview round 3+ |
| Offer | offer |
| Hired | selected |

If candidate is `rejected`, show 5-step path collapsed to "Application closed" with empathetic copy.

---

## 5. Current step card content

For each stage, the displayed message + next-action text is tuned to **reduce anxiety**:

| Stage | Current step copy | Next text |
|---|---|---|
| Applied | "Your application was received and is being reviewed." | "We'll respond within 4 business days · usually faster." |
| Screening | "Your application is being matched against the role." | "If we want to move forward, you'll hear from a recruiter for a 30-min call." |
| Tech Round | "You're scheduled for a technical interview on {date}." | "Calendar invite was sent to {email}. Need to reschedule? [Click here]" |
| Panel | "Your hiring panel is on {date}." | "After the panel, decisions take 48 hours · we'll email you either way." |
| Offer | "Your offer has been sent to {email} on {date}." | "Please review and respond by {date+7d}. Questions? Use the form below." |
| Hired | "🎉 Welcome to the team! Your start date is {date}." | "Watch for onboarding info from People Ops within 48 hours." |
| Rejected | "We've moved forward with other candidates for this role." | "Your profile is in our talent pool · we'll reach out if a better fit opens up." |

---

## 6. Timeline card

Reverse-chronological feed of pipeline events filtered to candidate-friendly types:

| Event | Show? | Display |
|---|---|---|
| `application_received` | ✅ | "Application received · ATS reviewed within 4 hours" |
| `screening_passed` | ✅ | "Screening call with {recruiter} · passed" |
| `interview_scheduled` | ✅ | "Interview scheduled · {date}" |
| `interview_complete` | ✅ | "{round_type} interview with {panel} · {pass/move-forward}" |
| `panel_feedback_complete` | ✅ | "Panel complete · {N/N} panelists submitted · {positive/awaiting decision}" |
| `offer_extended` | ✅ | "Offer extended · sent via email" |
| `selected` | ✅ | "🎉 You've been selected!" |
| `ats_score_updated` | ❌ | hide (internal) |
| `note_added` | ❌ | hide |
| `manual_status_change` | ❌ | hide unless it's user-facing (e.g. "Application closed") |
| `outreach_email_sent` | ❌ | hide (already in their inbox) |

Items grouped by date. Today / Yesterday / This week / Earlier headers (per existing pattern in candidate detail timeline).

---

## 7. Question form

Persistent textarea + send button. Submitting:
1. Creates a `pipeline_event` of type `candidate_question` with the message body
2. Emails the recruiter assigned to the position
3. Shows confirmation in-place: "Sent! Priya will reply at {email} within 4 hours."

The question form is the **anti-ghosting promise** made interactive. Candidates can always reach a human.

---

## 8. Branding

Same per-org branding as Career page (`12_career_page.md`):
- `org.career_primary_color` overrides `--p`
- `org.career_logo_url` shown in hero org-mark
- `org.career_tagline` could appear as a subtle subtitle

Status portal is a **brand touchpoint** — candidates remember the experience of waiting, and a well-designed status page is what they tell their friends about.

---

## 9. Components to build / refactor

| Component | Path | Notes |
|---|---|---|
| `<CandidateStatusPage>` | `frontend/src/components/Status/CandidateStatusPage.jsx` | Refactor |
| `<StatusHero>` | `Status/StatusHero.jsx` | New |
| `<StatusStages>` | `Status/StatusStages.jsx` | New — 6-stage progress dots |
| `<CurrentStepCard>` | `Status/CurrentStepCard.jsx` | New — stage-aware copy |
| `<StatusTimeline>` | `Status/StatusTimeline.jsx` | New — filtered candidate-friendly events |
| `<QuestionCard>` | `Status/QuestionCard.jsx` | New — textarea form |
| `<StatusFooter>` | `Status/StatusFooter.jsx` | New — privacy + delete-my-data links |

---

## 10. Bookmarkable / shareable

The `status_token` URL is intentionally:
- **Permanent** — never expires (unlike apply token's 72h)
- **Single-purpose** — only shows status, no action capability beyond submitting questions
- **Private** — only the candidate knows it (and the recruiter if they look it up)
- **Bookmarkable** — candidates encouraged to save it ("This page lives at your private URL · bookmark it")
- **Mobile-friendly** — fits in phone-text-message contexts

Email signatures from recruiter to candidate should include this URL: "Check your status anytime: {status_url}"

---

## 11. Empty / loading / error states

| Condition | Display |
|---|---|
| Invalid token | "We couldn't find this status page. If you applied recently, contact your recruiter for a new link." |
| Candidate withdrew or data deleted | "This application has been closed. Thanks for your interest in TechCorp." |
| API error | Inline retry: "Couldn't load. [Retry]" — graceful degradation |
| No timeline events yet | "Your timeline will fill in as your application moves forward." |
| Position deleted (rare) | "This role has been closed. Your profile remains in our talent pool." |

---

## 12. Build notes

1. The token is generated on apply-submit and stored in `candidate_applications.status_token`. Confirm this is already happening (per `database_schema.md` it is).
2. The status page replaces the current minimal `CandidateStatusPage.jsx`. The existing route is preserved.
3. After hire: status page transitions to a "Welcome aboard!" celebration view with onboarding next-steps (Phase 2).
4. After rejection: status page transitions to "We've moved forward" view with talent-pool re-engagement opt-in.
5. **No login required at any point** — this is the candidate's permanent home in the system.
