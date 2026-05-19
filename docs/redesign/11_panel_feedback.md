# Page 11 — Panel Feedback (Magic Link)

**Pattern:** *Anchored tap-rate* (variant A)
**Replaces:** 1–5 numeric rating cells per competency
**Why:** Panelists are external to the app · doing this between meetings · on a phone. Numeric 1–5 scales without anchors invite range bias ("I always give 3"). Anchored buttons (🔴 Concern · 🟡 Mixed · 🟢 Strong · 🌟 Outstanding) with rubric-specific examples force calibration without slowing the panelist down.

Preview reference: `/tmp/atl-design-preview-v3.html` → tab "Panel Feedback".
Existing doc this supersedes: `docs/pages/11_panel_feedback.md`.

---

## 1. Route & layout

| Aspect | Value |
|---|---|
| Route | `/panel/:token` |
| Auth | **Public** (magic link · single-use) |
| Layout | Centered card · max-width 540px · mobile-first card stack |
| Required to load page | Token must be valid AND `interview_panel.feedback_submitted = false` |

---

## 2. Backend tie-in

Already implemented per `interview_service.py · PanelFeedbackService`. The redesign is purely UI.

| Endpoint | Used for |
|---|---|
| `GET /api/v1/panel/verify/{token}` | Verify token + load context (candidate, interview round, competencies, peer-avg) |
| `POST /api/v1/panel/{token}/enrich` | Optional: send rough notes → AI enriches to structured |
| `POST /api/v1/panel/{token}/submit` | Submit scorecard (single-use, marks `feedback_submitted=true`) |

The 4-dimension weighted scorecard from existing `scorecard_templates`:
1. Technical Depth (default weight 40%)
2. System Design (30%)
3. Collaboration & Communication (15%)
4. Leadership / Culture Fit (15%)

Each org can edit dimensions in Settings (`07_settings.md`).

---

## 3. Layout

```
[ Centered card stack — vertical scroll on mobile ]

[ CONTEXT CARD (first, sticky-ish) ]
  [Avatar]  Maya Patel                                   [Pending chip]
            Senior ML Engineer applicant
  ── divider ──
  Round: Round 2 · Hiring Panel        Interview date: May 17 · 2:00–3:30 PM
  You're rating: Tech / Sys design /   Other panelists: Ravi K. · Aditi S. · Jordan N.
                Comms / Culture

[ COMPETENCY CARD × 4 ]
  Competency 1 of 4
  Technical Depth
  "Demonstrated mastery of ML systems, theory, trade-offs..."
  📐 Strong = led 50M req/day prod system · Outstanding = published research

  [🔴 Concern]  [🟡 Mixed]  [🟢 Strong]  [🌟 Outstanding · picked]

  [textarea: "One specific thing they said that supports your rating..."]
  Comparison: avg panel score for this dimension across past hires: 3.8 / 5

[ ... Competency 2, 3, 4 ... ]

[ RECOMMENDATION CARD (gradient highlight) ]
  Bottom line
  Your overall recommendation?
  [⛔ Strong No Hire]  [👎 No Hire]  [👍 Hire]  [🌟 Strong Hire · picked]

[ SUBMIT BAR ]
  "Submission is final. AI will enrich your notes for the team.
   Other panelists: 2 of 3 submitted."        [Submit feedback]

[ NEXT STEPS CARD ]
  "What happens next: Once all 4 panelists submit, the hiring team will
   review feedback within 48 hours and reach out to Maya..."

[ Magic link · single-use · expires 24h after submission ]
```

---

## 4. Context card

The first thing the panelist sees. Loaded from `interview_panel` + `candidates` + `interviews`.

| Field | Source |
|---|---|
| Avatar + name | `candidates.full_name`, generated initials avatar |
| Role applicant | `positions.role_name + " applicant"` |
| Pending chip | computed from `feedback_submitted` |
| Round | `interviews.round_number + interviews.round_type` |
| Interview date | `interviews.scheduled_at` |
| You're rating | comma-separated competency names from scorecard template |
| Other panelists | from `interview_panel` excluding self |

Per PRODUCT_IMPROVEMENTS §3.5 recommendation: "Show interview context card first — candidate name, role, round type, date — before attendance check."

---

## 5. Competency card anatomy

```
┌─────────────────────────────────────────────┐
│  Competency 1 of 4                          │  ← kicker
│  Technical Depth                            │  ← name
│  Demonstrated mastery of ML systems...      │  ← description
│                                             │
│  📐 Strong = led 50M req/day prod system ·  │  ← rubric anchors (KEY)
│     Outstanding = published research        │
│                                             │
│  [🔴 Concern]  [🟡 Mixed]  [🟢 Strong]  [🌟 Out.] │ ← 4 anchored buttons (2×2 grid on narrow)
│   Gaps that    Some depth  Clear        Top 5%      │ ← micro-hint per button
│   worry me     · gaps       senior depth  I've met  │
│                                             │
│  [textarea — required]                      │  ← supporting evidence
│  "One specific thing they said..."          │
│                                             │
│  Comparison: avg panel score: 3.8 / 5       │  ← optional peer-avg line
└─────────────────────────────────────────────┘
```

### The 4 anchored buttons

Each button is a large tap target with:
- **Glyph** (emoji as visual anchor — intentional exception to "no emoji icons" rule)
- **Label** (one word)
- **Hint** (one short sentence — what this means for this competency)

Picked state changes button to the corresponding semantic color (red/amber/teal/green fill).

### Rubric anchors

The line "📐 Strong = led 50M req/day prod system · Outstanding = published research" is **competency-specific** — pulled from the scorecard template that the org's admin set up. Panelists with no app experience instantly know what "Strong" means *for this dimension on this role*.

### Required note

Each competency requires a 1-sentence note. Prevents drive-by ratings. Note can be very short ("Walked through tradeoffs cleanly · ready for senior").

### Peer-average comparison

Optional line at the bottom: "Comparison: avg panel score for this dimension across past hires: 3.8 / 5". Helps the panelist calibrate. Hide if there's no historical data yet (cold start).

---

## 6. Recommendation card

Final question, always last. Gradient teal background to signal end.

Q: **"Your overall recommendation?"**

4 buttons in a 4-column row:
- ⛔ Strong No Hire (red border on pick)
- 👎 No Hire (gray)
- 👍 Hire (teal border)
- 🌟 Strong Hire (green border)

The recommendation is **independent** of per-competency ratings — a panelist can rate someone strong across competencies but still recommend "No Hire" if they had a gut concern, and vice versa. AI-enriched debrief surfaces this conflict if it happens.

---

## 7. Submit semantics

**Single-use, irreversible.** Submit button shows confirmation:

```
"Submit feedback for Maya Patel?

 This cannot be edited after submission.
 AI will enrich your notes for the hiring team."

  [Cancel]  [Yes, submit]
```

On confirm:
1. Frontend POSTs scorecard
2. Backend marks `feedback_submitted=true` (single-use enforced at DB level)
3. If this was the last panelist → backend triggers debrief generation + notifies recruiter
4. UI replaces card stack with a "Thanks!" confirmation + summary of submitted ratings + next-steps box

---

## 8. Optional rough-notes mode

In the body of each competency card, a small "✏ Just give me rough notes" link reveals an alternative input:

```
[Rough notes textarea]
"They went deep on tradeoffs. Knew their stuff. Worth pushing to offer."

[AI will structure this →]  → calls /enrich endpoint, returns suggested ratings + notes
```

Panelist reviews AI's structured output, edits if needed, then submits. Saves time when typing on a phone between meetings.

---

## 9. Components to build / refactor

| Component | Path | Notes |
|---|---|---|
| `<PanelPage>` | `frontend/src/components/Panel/PanelPage.jsx` | Refactor |
| `<PanelContextCard>` | `Panel/PanelContextCard.jsx` | New |
| `<CompetencyCard>` | `Panel/CompetencyCard.jsx` | New |
| `<AnchorButton>` | `Panel/AnchorButton.jsx` | New — single anchored rating button |
| `<RecommendationCard>` | `Panel/RecommendationCard.jsx` | New |
| `<SubmitBar>` | `Panel/SubmitBar.jsx` | New — final submit + co-panelist progress |
| `<NextStepsCard>` | `Panel/NextStepsCard.jsx` | New |
| `<EnrichNotesMode>` | `Panel/EnrichNotesMode.jsx` | New — rough-notes textarea + enrich button |

---

## 10. Mobile-specific concerns

- All tap targets ≥ 44px (anchored buttons are 80px+)
- Sticky context card on scroll (so panelist remembers who they're rating)
- Auto-save draft locally on every change (in case browser closes)
- Haptic feedback on rating tap (`navigator.vibrate(10)` if available)
- Submit button stays visible at bottom of viewport (sticky footer on mobile)

---

## 11. Empty / loading / error states

| Condition | Display |
|---|---|
| Invalid token | "This link has expired or already been used. Contact the hiring team if you need a new one." |
| Already submitted | Centered: "Thanks! You submitted feedback on May 18 at 3:24 PM. [View summary]" + ability to view (read-only) the submitted scorecard. |
| Interview not yet complete | "This interview is scheduled for May 17. The feedback form will activate after the interview." |
| Required field missing on submit | Inline error per competency: "Add a one-sentence note to submit." |
| Server error on submit | Toast: "Couldn't submit. Try again in a moment." — preserve all answers in localStorage |

---

## 12. Build notes

1. The redesign is mostly visual — backend already supports the flow.
2. The big win is *anchor buttons* replacing 1-5 cells; everything else flows from that.
3. Make sure submitted scorecard data preserves the picked-anchor as a numeric value for downstream analytics (Concern=1, Mixed=2, Strong=4, Outstanding=5; consistent across orgs).
4. Test on actual phone — this surface is used 80% on mobile.
