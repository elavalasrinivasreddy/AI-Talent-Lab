# Decision: Apply-chat flow redesign

Date: 2026-06-14
Status: Approved, implementing
Area: candidate magic-link apply chat (`backend/agents/candidate_chat.py`,
`backend/services/apply_service.py`, `backend/routers/apply.py`,
`frontend/src/components/Apply/ApplyPage.jsx`)

## Problem

1. The chat asked **hardcoded** questions (current role, experience, CTC, notice
   period) AND then the hiring head's **configured** screening questions. These
   duplicate each other — candidates were asked the same things twice (once
   before resume, once after).
2. The optional video intro only appeared on a **revisit**, never on first
   completion: `send_message` returned `completed: true`, and the frontend
   immediately switched to the "Already Applied" screen, hiding the video UI.
3. The progress bar reset to "Step 1 of 6" because the frontend step map was
   missing the backend step strings `compensation` and `screening_questions`
   (fixed separately).

## Decision

Single source of truth for questions = the head's **configured screening
questions**. No built-in questions.

### New flow

```
greeting → interest → screening_questions → resume_upload → [SUBMIT] → video_intro → done
```

- Keep the interest Yes/No gate after the greeting.
- If no screening questions are configured: greeting → interest → resume →
  video → done.

### Submission timing

The application is **submitted right after the resume upload** (the last
*required* input), not after the video. At that point all data exists
(screening answers + resume). Submission does: `status='applied'`, ATS dispatch,
confirmation email, GDPR consent/retention.

This removes the data-loss risk of "submit after video" — a tab close at the
video prompt can never lose a resume-complete application, because it is already
submitted. Video becomes a true optional add-on that is persisted at upload time
and attached to the already-submitted application.

### field_key detection → structured data

Screening questions are configured with a free-text `field_key` (the "name").
At completion, classify each answer by keyword match on `field_key` + `label`
(case-insensitive) and route into the structured slots that power existing
features:

| Detected as   | Keywords (field_key or label)                              | Action |
|---------------|------------------------------------------------------------|--------|
| compensation  | ctc, compensation, salary, comp, pay, package, remuneration | encrypt answer → `compensation_enc` |
| experience    | experience, exp, years, yoe                                | parse leading int → `candidates.experience_years` (feeds ATS) |
| notice_period | notice, availability, join                                 | store in `screening_responses` |
| current_role  | company, organization, organisation, employer, current role/title | update `candidates.current_title` / `current_company` |

Every answer is also stored verbatim in `screening_responses`. Unmatched
questions remain plain responses. Detection is best-effort; a miss only means the
answer isn't promoted to a structured field (it is still saved).

### Video + already-applied semantics

- After resume-submit, the video step shows in-session: "Application submitted!
  Optionally add a 30–60s video intro."
- Upload video → persisted immediately, attached to the submitted application.
- Skip / done → terminal "done" view.
- **Refresh or revisit after submission → "Already Applied" screen** (option A).
  The video offer is session-only; this matches "once done, show already
  applied". Closing *before* resume-submit restores the chat history to continue.

## Consequences

- ATS scoring fires at resume-submit without the video (video is not an ATS
  signal, so no quality impact).
- Encrypted-CTC and experience-for-ATS are preserved via `field_key` detection
  rather than built-in questions. Heads should name compensation/experience
  questions with recognizable keys/labels to get encryption + ATS promotion.
- A candidate who refreshes at the video step loses the video opportunity but
  keeps a safely-submitted application (accepted tradeoff, option A).
