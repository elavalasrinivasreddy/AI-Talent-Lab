# Architecture: Data Model

> Part of the consolidated docs. Start at [`docs/README.md`](../README.md) for the map.
> **Source of truth is `backend/db/migrations.py`** — this doc is the human map. The
> schema below is illustrative (it predates some columns added during audits, e.g.
> hire-request approval columns, `followup_sent_at`, embeddings). Verify against
> migrations before relying on a column.

---

## The golden rule

Every business table has `org_id NOT NULL`. Tables scoped to a department also have
`department_id NOT NULL`. Every repository query filters by `org_id`. No exceptions.
PostgreSQL Row-Level Security is the second line of defense (see
[`03_backend.md`](03_backend.md) §security).

---

## Entity summary

| Entity | Key points |
|---|---|
| **organizations** | Tenant boundary. `name`/`slug` immutable. Holds About Us, culture, benefits (feed JD gen). |
| **departments** | Sub-unit of org. `head_user_id`. Users/positions/candidates scoped to dept. |
| **users** | Platform users only. `role` ∈ org_head/dept_admin/hr/team_lead (+ platform_admin). |
| **competitors** | Feed market-research step. |
| **screening_questions** | Dynamic questions in candidate apply chat. |
| **message_templates** | Email templates (outreach/rejection/interview_invite/follow_up/...). |
| **scorecard_templates** | Interview dimensions + weights. |
| **positions** | Hiring req from chat. JD, status, ATS threshold, search cadence, `jd_embedding`. |
| **jd_variants** | 3 per position, one `is_selected`. |
| **candidates** | Org-scoped. `UNIQUE(org_id, email)`. Resume text/parsed/embedding. Talent-pool flags. |
| **candidate_applications** | Candidate↔position. One per pair. ATS score, status, magic link, rejection draft. |
| **interviews** | Round per candidate per position. |
| **interview_panel** | Panel member per interview, each with own magic link. |
| **scorecards** | One per panel member per interview. Raw notes + AI-enriched. |
| **interview_kits** | AI questions + scorecard template per position. |
| **pipeline_events** | Immutable log — powers timeline, analytics, audit. |
| **audit_log** | Auth + admin actions (separate from pipeline_events). |
| **notifications** | In-app alerts. |
| **talent_pool_suggestions** | AI pool matches per position. |
| **candidate_tags** | Free-form labels for re-engagement. |
| **chat_sessions** / **chat_messages** | Recruiter JD-creation conversation + LangGraph `graph_state`. |
| **candidate_sessions** / **candidate_session_messages** | Candidate magic-link chat. |
| **hire_requests** | Pre-position request + approval workflow (see [design/pages/09](../design/pages/09_hire_request.md)). |

---

## Status enums

**Position status:** `draft` → `open` → `on_hold` / `closed` / `archived`.
JD chat now saves at `draft`; `open` happens after team_lead JD approval + setup.

**Candidate application status:**
`sourced` → `emailed` → `applied` → `screening` → `interview` → `selected` / `rejected` / `on_hold`.

```
Sourced -> Emailed -> Applied -> Screening -> Interview (R1, R2...) -> Selected
                                                                    -> Rejected
```

Rules: any round result = Rejected → system drafts rejection email → human sends.
All rounds passed → "Mark as Selected". Recruiter can manually reject any stage.
Never auto-send rejections.

**Interview status:** `pending` / `scheduled` / `completed` / `cancelled` / `rescheduled`;
`overall_result` ∈ `passed` / `rejected` / `pending`.

**Hire request status:** `pending` → `accepted`/`approved` → `fulfilled`, plus
`cancelled` / `rejected`. dept_admin/org_head approve; hr/org_head pick up. See the
hire-request page spec for the full FSM and the deferred multi-tier relay.

**Chat workflow_stage:**
`intake` → `internal_check` → `market_research` → `jd_variants` → `final_jd` → `bias_check` → `complete`
(plus 8-stage stepper in the redesigned canvas — see [design/pages/05](../design/pages/05_jd_chat.md)).

---

## Core DDL (illustrative)

Foundation, hiring, interview, event-log and chat tables are defined in
`backend/db/migrations.py`. The shapes below are the stable core; treat migrations as
authoritative for exact columns and types.

Notable columns worth knowing:

- `positions`: `ats_threshold REAL DEFAULT 80.0`, `search_interval_hours`,
  `next_search_at`, `is_on_career_page`, `jd_embedding` (JSON), `followup_delay_hours`.
- `candidates`: `UNIQUE(org_id, email)`, `resume_text`, `resume_parsed` (JSON),
  `resume_embedding` (JSON), `in_talent_pool`, `talent_pool_reason`, `source`.
- `candidate_applications`: `UNIQUE(candidate_id, position_id)`, `skill_match_score`,
  `skill_match_data` (JSON), `magic_link_*`, `rejection_draft`, `followup_sent_at`.
- `pipeline_events`: `event_type` (sourced/emailed/applied/status_changed/
  interview_scheduled/feedback_submitted/rejection_sent/selected/added_to_pool/...),
  `event_data` (JSON). Append-only.
- `chat_sessions`: `graph_state` (LangGraph AgentState JSON), `workflow_stage`,
  `position_id` (set on save).

---

## Resume storage decision

Store **text, not files**. On upload: extract text (`pdfplumber` / `python-docx`),
parse structured data + trajectory + red flags (`resume_parser`), generate embedding,
store all three, discard the file. No S3/R2, no resume download (Phase 2 if needed via
`resume_storage_key`). Re-extract only on new upload.
