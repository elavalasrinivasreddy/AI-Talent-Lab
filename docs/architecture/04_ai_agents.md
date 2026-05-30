# Architecture: AI Agents (the differentiator)

> Part of the consolidated docs. Start at [`docs/README.md`](../README.md) for the map.
> This is what no generic ATS does. Carved out of the old backend plan so it's findable.
> Code lives in `backend/agents/`. UI for the JD pipeline: [design/pages/05](../design/pages/05_jd_chat.md).

---

## 1. Agent inventory

| File | Role | Type |
|---|---|---|
| `agents/orchestrator.py` | LangGraph graph definition + runner (the JD pipeline) | LangGraph |
| `agents/state.py` | `AgentState` TypedDict (incl. error/skip fields) | — |
| `agents/streaming.py` | SSE event formatting + async generator | — |
| `agents/nodes/interviewer.py` | **Intake** — gather requirements (NLU) | node |
| `agents/nodes/internal_analyst.py` | **Internal check** — ChromaDB similar past JDs | node |
| `agents/nodes/market_intelligence.py` | **Market research** — Tavily competitor JDs | node |
| `agents/nodes/benchmarking.py` | **Benchmarking** — rank competitor skills vs JD | node |
| `agents/nodes/drafting.py` | **Variants + final JD** — 3 variants then final | node |
| `agents/nodes/interviewer.py` (kit) | interview question/scorecard helpers | node |
| `agents/bias_checker.py` | JD bias detection (post final JD, non-blocking) | agent |
| `agents/candidate_chat.py` | candidate magic-link apply chat (linear, NOT LangGraph) | agent |
| `agents/resume_parser.py` | structured parse + trajectory + red flags + embedding | agent |
| `agents/rejection_drafter.py` | drafts rejection emails from feedback | agent |
| `agents/feedback_enricher.py` | rough panel notes → professional feedback | agent |
| `agents/interview_kit.py` | interview questions + scorecard template from JD | agent |
| `agents/debrief_generator.py` | post-interview debrief doc | agent |
| `agents/interview_agents.py` | interview-related agent helpers | agent |
| `agents/tools/search.py` | Tavily wrapper | tool |
| `agents/tools/role_extractor.py` | extract job title from free text | tool |
| `agents/prompts/*.md` | system prompts (one per agent/node) | prompt |

LLM is provider-agnostic via `adapters/llm/factory.py` (`LLM_PROVIDER`).

---

## 2. JD generation state machine

```
INTAKE -> INTERNAL_CHECK -> MARKET_RESEARCH -> JD_VARIANTS -> FINAL_JD -> BIAS_CHECK -> COMPLETE
```

Each node either HARD-STOPs (cannot continue without it) or SOFT-SKIPs (optional):

| Stage | Node | Behavior |
|---|---|---|
| Intake | interviewer | **HARD STOP** — no JD without requirements |
| Internal check | internal_analyst | **SOFT SKIP** — new orgs have no past JDs |
| Market research | market_intelligence + benchmarking | **SOFT SKIP** — no competitors / Tavily down |
| JD variants | drafting | **HARD STOP** w/ auto-retry then Retry button |
| Final JD | drafting | **HARD STOP** w/ retry; mid-stream interrupt → Regenerate |
| Bias check | bias_checker | **SOFT SKIP** — never blocks save |
| Position setup | save | **HARD STOP** — must persist |

The redesigned UI renders this as an **8-stage stepper** with HARD-STOP vs SOFT-SKIP
badges over a document-first canvas (not chat bubbles). See the page spec.

---

## 3. SSE event stream

```
{"event":"token","content":"Senior"}                    # chat text
{"event":"stage_change","stage":"internal_check","label":"Checking past roles..."}
{"event":"card_internal","data":{"skills":[...]}}        # internal-check chips
{"event":"card_market","data":{"competitors":[...],"skills":[...]}}
{"event":"card_variants","data":{"variants":[...]}}      # 3 variants
{"event":"card_bias","data":{"issues":[...]}}
{"event":"jd_token","content":"# Senior Python Developer\n"}  # final JD stream
{"event":"metadata","session_id":"uuid","title":"..."}
{"event":"done"}
```

Error / skip events:

```
{"event":"error","code":"VARIANTS_FAILED","recoverable":true,"message":"...Retry..."}
{"event":"error","code":"INTAKE_FAILED","recoverable":false,"message":"Start new chat"}
{"event":"stage_skipped","stage":"market_research","message":"Continuing..."}
{"event":"stream_interrupted","partial_content_saved":true,"message":"Regenerate"}
```

> `stage_skipped` is **by design absent for HARD-STOP stages** — only soft skips emit it
> (commit `59582ce`).

Frontend reactions: recoverable error → [Retry] button, input disabled; non-recoverable
→ [Start New Chat]; `stage_skipped` → muted system line, auto-advance; interrupted →
partial JD + [Regenerate]; 3 consecutive errors → "try again later", session preserved.

---

## 4. Error recovery rules

- Max 3 consecutive LLM failures at a HARD-STOP → hard error + Start Over.
- Soft-skip failures are logged server-side, never surfaced as errors; set
  `internal_skipped` / `market_skipped` / `bias_skipped` in state and auto-advance.
- Variants/final-JD: auto-retry once silently, then expose a Retry button; retry
  re-runs **only the failed node**, not the whole pipeline.
- **State checkpoint after every successful node** — `chat_sessions.graph_state` is
  saved so a server restart or closed browser resumes from the last good stage.

`AgentState` carries `error_stage`, `error_code`, `error_message`, `retry_count`, and the
three `*_skipped` booleans.

---

## 5. Candidate apply chat (linear, not LangGraph)

`agents/candidate_chat.py` runs a fixed step list:
`greeting → interest_check → current_role → experience → compensation → notice_period →
resume_upload → custom_questions → completion`. Custom questions come from
`screening_questions`. On completion: application saved, "interview process overview"
email auto-sent, status → Applied, recruiter notified.

---

## 6. Resume intelligence

`agents/resume_parser.py` (called on bulk upload / apply / manual upload) returns
`structured` (skills, education, companies, certs, total_experience),
`trajectory` (pattern: steady_growth/job_hopper/career_pivot/specialist, avg tenure,
progression note), `red_flags` (short_tenure/employment_gap/title_regression/
frequent_switches with severity), a `summary`, and the resume `embedding`. Stored in
`candidates.resume_parsed` + `resume_embedding`, surfaced on Candidate Detail.
