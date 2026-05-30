> **Build status:** ✅ Built (v3) — document-first canvas + 8-stage stepper + interactive refinement shipped
> Consolidated docs index: [../../README.md](../../README.md) · Status tracker: [../../STATUS.md](../../STATUS.md) · Design system: [../00_design_system.md](../00_design_system.md)
> This page merges the v3 redesign spec with the pre-v3 behavioral spec (appendix below, where one existed).

# Page 05 — JD Chat (JD Generation)

**Pattern:** *Document-first canvas with inline agent blocks* (variant **B**)
**Replaces:** Chat bubbles + stacked agent cards (current `ChatPage` + `MessageList` + agent cards inside the chat scroll)
**Why:** JD generation is a structured LangGraph ritual, not a free-form chat. Treating it as chat buries the state machine and makes variant selection awkward (which-bubble-do-I-tap). The document is the *output* — it should be the canvas. Chat is a side rail for clarification.

Preview reference: `/tmp/atl-design-preview-v3.html` → tab "JD Chat".
Existing doc this supersedes: `docs/pages/02_chat.md` + `docs/pages/12_chat_flows.md`.

---

## 1. Route & layout

| Aspect | Value |
|---|---|
| Route | `/chat` (new session) · `/chat/:sessionId` (resume) |
| Auth | Required (JWT) |
| Layout | **No sidebar** during chat (full bleed) · top stepper · main canvas (≈65%) · right rail (320px fixed) |

---

## 2. Backend tie-in

This page is the most state-machine-heavy. Everything maps to the existing `chat_service.py` SSE flow.

| Endpoint | Used for |
|---|---|
| `POST /api/v1/chat/stream` (SSE) | All AI activity. Events: `token`, `stage_change`, `title_update`, `card_internal`, `card_market`, `card_variants`, `jd_token`, `card_bias`, `stage_skipped`, `done`, `error` |
| `GET /api/v1/chat/sessions/{id}` | Resume — replays state from `chat_sessions.graph_state` JSON |
| `PUT /api/v1/chat/sessions/{id}/save-draft` | Save partial state |
| `POST /api/v1/chat/sessions/{id}/save-position` | Finalize — creates `positions` row, triggers Celery search |

The 8 LangGraph stages from `backend/agents/orchestrator.py`:

1. **intake** (HARD STOP) — gather role / yrs / location / comp / must-haves
2. **internal_check** (SOFT SKIP) — ChromaDB query of past org JDs → skill chips with provenance
3. **market_research** (SOFT SKIP) — Tavily competitor JD scan → skill chips with frequency
4. **benchmarking** (SOFT SKIP) — filter/rank market skills (often skipped silently)
5. **jd_variants** (HARD STOP) — generate 3 variants, user picks
6. **final_jd** (HARD STOP) — stream full JD token-by-token
7. **bias_check** (SOFT SKIP) — manual trigger, find/fix pairs
8. **complete** — enable "Save & Find Candidates" CTA

---

## 3. Layout

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ TOP STEPPER (sticky)                                                            │
│ ① Intake ✓ HARD → ② Internal ✓ SOFT → ③ Market ✓ SOFT → ④ Bench ⊘ → ⑤ Variants ● HARD ... │
├─────────────────────────────────────────────┬───────────────────────────────────┤
│ TOOLBAR                                     │  RAIL HEADER                      │
│ "Session" [editable title]  saved 12s ago   │  "State & chat" · connected · #s..│
├─────────────────────────────────────────────┼───────────────────────────────────┤
│                                             │                                   │
│  JD CANVAS (scrollable)                     │  RAIL BODY (scrollable)           │
│                                             │                                   │
│  # Senior Machine Learning Engineer         │  [Current stage]                  │
│  Bangalore · Hybrid · ₹40–60 LPA · 2 hc     │  ● JD Variants · HARD STOP        │
│                                             │  Won't advance until picked       │
│  ## About TechCorp                          │                                   │
│  [auto from settings.org.about_us]          │  ⚠ Stage retry · Variants 1/2     │
│                                             │  [Manually retry]                 │
│  ┌─ Agent block: Intake ───────────────┐   │                                   │
│  │ Role · Yrs · Loc · Comp · Headcount │   │  [Conversation]                   │
│  │ ...captured fields grid             │   │  AI: Hi! I'll help...             │
│  └────────────────────────────────────┘   │  You: Senior ML Eng...            │
│                                             │  AI: Got it. A few questions...   │
│  ## Role Overview                           │  ...                              │
│  (paragraph)                                │                                   │
│                                             │                                   │
│  ## Responsibilities                        │                                   │
│  - Bullet  ...                              │                                   │
│                                             │                                   │
│  ┌─ Agent block: Internal Check ───────┐   │                                   │
│  │ "From past TechCorp JDs"             │   │                                   │
│  │ [chip + provenance: "used in 8 past"]│   │                                   │
│  │ [chip + provenance: ...]             │   │                                   │
│  └────────────────────────────────────┘   │                                   │
│                                             │                                   │
│  ┌─ Agent block: Market Research ──────┐   │                                   │
│  │ "Competitors emphasize"             │   │                                   │
│  │ [chip + competitor list]            │   │                                   │
│  │ Bench insight: comp aligned w market │   │                                   │
│  └────────────────────────────────────┘   │                                   │
│                                             │                                   │
│  ## Requirements                            │                                   │
│  - bullet ...                               │                                   │
│                                             │                                   │
│  ┌─ Agent block: Variants — ACTIVE ────┐   │                                   │
│  │ 3-column comparator with diff       │   │                                   │
│  │ [A · skill-focused]                 │   │                                   │
│  │ [B · outcome-focused · picked]      │   │                                   │
│  │ [C · hybrid]                        │   │                                   │
│  │ [Use Variant B →] [Edit] [Regen]    │   │                                   │
│  └────────────────────────────────────┘   │                                   │
│                                             │                                   │
│  ## Nice to Have                            │                                   │
│  - bullet ...<streaming-cursor>             │                                   │
│                                             │                                   │
│  [ placeholder for bias check block ]      ├───────────────────────────────────┤
│                                             │  RAIL INPUT (textarea + send)     │
│                                             ├───────────────────────────────────┤
│                                             │  FINALIZE — Save & Find Candidates│
│                                             │  (disabled until stage=complete)  │
└─────────────────────────────────────────────┴───────────────────────────────────┘
```

---

## 4. Top stepper

8 pills, scrollable horizontally on narrow widths. Each pill state:

| State | Dot glyph | Color | Meaning |
|---|---|---|---|
| `done` | ✓ | `--ok` | Stage completed successfully |
| `current` | ● | `--p` with halo | Active stage, awaiting user or AI |
| `skipped` | ⊘ | dashed gray | SOFT SKIP'd (e.g. benchmarking) |
| `paused` | ⏸ | `--warn` | HARD STOP, awaiting your input |
| `retry` | ⚠ | `--bad` | Failed once, will retry |
| `pending` | ○ | gray | Hasn't run yet |

Each pill has a small `HARD` / `SOFT` tag chip showing its retry behavior. Clicking a `done` pill scrolls the canvas to its agent block (lets you re-edit).

---

## 5. Agent blocks (the core innovation)

Each agent block is a `<div class="agent-block">` inserted **inline** in the JD canvas, scoped by `data-stage`. Stage color drives left border accent + header icon background.

### Intake block (done)
```
┌── ① Intake · gathered from you · 8 fields captured ──┐
│ Role: Senior ML Eng  · Years: 5+  · Loc: Bangalore   │
│ Comp: ₹40–60 LPA · Headcount: 2  · ...               │
└──────────────────────────────────────────────────────┘
```

### Internal Check block (done, with provenance)
```
┌── ② Internal Skills Check · from past TechCorp JDs ──┐
│ "Skills your team has hired for in similar roles"    │
│ [PyTorch · used in 8 past JDs] (selected)            │
│ [Python · 14 past JDs] (selected)                    │
│ [Kubernetes · Sr Backend Dev 2024] (selected)        │
│ [Ray · ML Platform Eng 2025] (not selected)          │
└──────────────────────────────────────────────────────┘
```

Each chip is interactive — click to toggle into/out of the JD. Provenance is shown as a smaller right-aligned label inside the chip with a thin left separator.

### Market Research block (done, with competitor list)
Similar shape; provenance shows which competitors emphasize each skill. Bench insight footer shows comp-range alignment ("aligned with Bangalore market median").

### Variants block (HARD STOP, currently active in preview)
3-column comparator. Each variant card:
- variant name (kicker color)
- short tagline
- description (1-2 lines)
- meta line ("12 required skills · +30% applicant volume")

One variant has `.picked` highlight. Buttons row: `Use Variant B →` (primary), `Edit picked`, `Regenerate variants`. Status hint: "Asking AI: 'make B more senior-leaning'" if user typed a follow-up in rail.

### Bias Check block (placeholder until triggered)
Empty state: "Bias check will run after Final JD is generated · soft-skippable". When triggered, shows fix-pair rows:

```
"rockstar" → "high-performing"   why: gendered language     [Apply]
"culture fit" → "values alignment"  why: vague exclusion criterion  [Apply]
```

Each `[Apply]` patches the JD text in place + adds an entry to the rail conversation.

---

## 6. Right rail

Fixed 320px width, always visible. Three sections from top to bottom:

### A — State control
- `[Current stage]` card — stage chip + HARD STOP / SOFT SKIP indicator + 1-line description
- `[⚠ Stage retry]` card — only visible when current stage has failed once (LangGraph retry count). Manual retry button.
- Other state widgets: temperature, LLM provider (read-only).

### B — Conversation
A scrollable feed of user ↔ AI messages. **Supplementary** — primary interaction is via canvas blocks. Used for:
- Initial intake Q&A (stage 1)
- Asking for variant refinement ("make B more senior")
- Asking for whole-section rewrites ("rewrite responsibilities in second person")
- Triggering bias check ("check for bias")

Bubble style: user messages have teal left border + slight indent; AI messages are bg-3 + plain.

### C — Input + Finalize CTA
- Textarea + send icon button (paper-plane)
- Below: "Save & Find Candidates" primary button. Disabled with greyed-out label "Enabled once stage = complete" until LangGraph state reaches `complete`.

---

## 7. SSE event handling

Maps to existing `ChatContext` SSE handler. v3 mapping:

| SSE event | UI effect |
|---|---|
| `stage_change` | Animate stepper transition; set current pill |
| `card_internal` | Insert/replace Internal Check agent block |
| `card_market` | Insert/replace Market Research agent block |
| `card_variants` | Insert/replace Variants agent block · scroll canvas to it |
| `jd_token` | Append token to "Final JD" content area (with stream cursor) |
| `card_bias` | Insert/replace Bias Check agent block |
| `stage_skipped` | Set stepper pill to `skipped` state |
| `token` | Append to current canvas section being streamed |
| `title_update` | Update session title in toolbar |
| `done` | Stepper pill → `done`; if all done → finalize CTA enabled |
| `error` | Stepper pill → `retry`; show retry card in rail |

Critical: every event must be **idempotent** — replaying `card_variants` re-renders the same block (no duplication). State is keyed by stage name in canvas DOM order.

---

## 8. User actions → backend

| Canvas action | API call |
|---|---|
| Toggle chip in Internal block | `POST /chat/stream` with `action=update_internal_skills`, payload `{ accepted: ["Python", "Kubernetes"] }` |
| Toggle chip in Market block | Same, `action=update_market_skills` |
| Click "Use Variant B" | `POST /chat/stream`, `action=select_variant`, payload `{ variant_id: "b" }` |
| Click "Regenerate variants" | `POST /chat/stream`, `action=regenerate_variants` |
| Apply bias fix | `POST /chat/stream`, `action=apply_bias_fix`, payload `{ from, to }` |
| Save & Find Candidates | `POST /chat/sessions/{id}/save-position` |

The existing chat service already supports most of these via the `user_action` field in `AgentState`. Verify in `backend/agents/orchestrator.py`.

---

## 9. Resume behavior

On `/chat/:sessionId` load:
1. Fetch `GET /chat/sessions/{id}` → returns `graph_state` JSON
2. For each completed stage, render the corresponding canvas block + mark stepper pill `done`
3. Set current stage from `graph_state.stage`
4. Replay messages array into rail conversation
5. If `awaiting_user_input=true`, focus the relevant block (e.g. Variants comparator)
6. If `stage=complete`, enable Finalize CTA

State persistence is unchanged — backend already saves after every node per `ai_agent_pipeline.md`.

---

## 10. Components to build / refactor

| Component | Path | Notes |
|---|---|---|
| `<ChatPage>` | `frontend/src/components/Chat/ChatPage.jsx` | Refactor — owns layout + SSE wiring |
| `<JDStepper>` | `Chat/JDStepper.jsx` | New — top 8-stage pill row |
| `<JDCanvas>` | `Chat/JDCanvas.jsx` | New — scrollable doc surface |
| `<JDToolbar>` | `Chat/JDToolbar.jsx` | New — session title + export |
| `<AgentBlockIntake>` | `Chat/blocks/AgentBlockIntake.jsx` | New |
| `<AgentBlockInternal>` | `Chat/blocks/AgentBlockInternal.jsx` | New |
| `<AgentBlockMarket>` | `Chat/blocks/AgentBlockMarket.jsx` | New |
| `<AgentBlockVariants>` | `Chat/blocks/AgentBlockVariants.jsx` | New |
| `<AgentBlockBias>` | `Chat/blocks/AgentBlockBias.jsx` | New |
| `<ProvenanceChip>` | `Chat/blocks/ProvenanceChip.jsx` | New shared chip with provenance label |
| `<JDRail>` | `Chat/JDRail.jsx` | New — right rail container |
| `<RailStateCard>` | `Chat/RailStateCard.jsx` | New — current stage + retry |
| `<RailConversation>` | `Chat/RailConversation.jsx` | New — supplementary chat feed |
| `<FinalizeCTA>` | `Chat/FinalizeCTA.jsx` | New |

Old components to remove (deprecated by canvas blocks):
- `Chat/MessageList.jsx` (replaced by `RailConversation`)
- `Chat/cards/InternalCheckCard.jsx` (replaced by `AgentBlockInternal`)
- `Chat/cards/MarketResearchCard.jsx` (replaced by `AgentBlockMarket`)
- `Chat/cards/JDVariantsCard.jsx` (replaced by `AgentBlockVariants`)
- `Chat/cards/BiasCheckCard.jsx` (replaced by `AgentBlockBias`)
- `Chat/cards/FinalJDCard.jsx` (final JD now lives inline in canvas)

Keep:
- `Chat/MessageInput.jsx` — repurpose into rail input
- `Chat/ChatTopBar.jsx` — repurpose into JD toolbar
- `Chat/PositionSetupModal.jsx` — opens on Finalize CTA

---

## 11. Empty / loading / error states

| Condition | Display |
|---|---|
| New session (`/chat`) | Empty canvas with placeholder "Tell the AI what role you're hiring for." Rail conversation has AI's first message. Stepper: only stage 1 visible. |
| Resume mid-flow | All completed blocks render at once; rail shows full conversation history; current stage focused. |
| LangGraph stuck (retry exhausted) | Canvas block shows `<div class="agent-block-error">` with retry button + "Stage failed twice. Try editing your inputs or skip to next." |
| SSE disconnects | Toast "Reconnecting..." + retry; preserve canvas state |
| Save & Find fails | Toast + rail entry; CTA re-enabled after 5s |

---

## 12. This is the biggest architectural change

JD chat redesign is the single largest piece of work in v3. It replaces ~6 components with 12 new ones and reorganizes the entire chat surface from vertical scroll into a 2-pane canvas/rail layout. Estimated build effort: **3-5 days** depending on whether SSE event mapping needs backend changes.

If we ship the redesign incrementally, this page can ship **last** — Dashboard / Positions / Candidate Detail / Analytics can all ship first since they don't touch the SSE flow.

---

## 13. Phase 1 (shipped 2026-05-20) vs Phase 2 (deferred)

The layout inversion, inline agent blocks, stepper, and rail are live. The
heavier interactions (real LLM token streaming, in-canvas bias-fix patching,
variant follow-up refinement) are explicitly Phase 2.

### ✅ Phase 1 — shipped

| Area | Detail |
|---|---|
| Layout | `chat-page--v3` with `JDStepper` on top, `JDCanvas` (~65%) on left, `JDRail` (360px) on right. Includes toggle button to hide rail and maximize canvas area on smaller screens. |
| Stepper | 8-stage pill row with HARD/SOFT badges and done/current/skipped/pending state dots |
| Canvas | Inline doc with header (role + meta) + 5 inline agent blocks + JD body |
| Agent blocks | `AgentBlockIntake` (new — renders captured fields as a grid), `AgentBlockInternal`, `AgentBlockMarket`, `AgentBlockVariants`, `AgentBlockBias` — all share `AgentBlockShell` for the frame |
| Shared atoms | `ProvenanceChip` (skill + source attribution), `AgentBlockShell` (number badge + title + status pill) |
| Rail | `RailStateCard` (current stage + retry + error), `RailConversation` (supplementary chat feed), `MessageInput`, `FinalizeCTA` |
| Finalize CTA | Lives in rail footer; opens existing `PositionSetupModal`; disabled until a final JD exists |
| Backend | Orchestrator records each stage transition + soft-skip in transient `_run_meta`; `chat_service` emits one `stage_change` per transition and one `stage_skipped` per soft-skip (was previously only emitting one event per turn) |
| ChatContext | Mirrors backend `graph_state_parsed` into `graphState`; refreshes on every SSE `done`; tracks `stageSkipped[]` so the stepper renders skipped pills correctly across resumes |
| Hire-request handoff | Switched from legacy `positionsApi.linkViaSession` to new `hireRequestsApi.linkSession`. Auto-seed message now includes location + comp band fields |
| UX Refinements (Validation) | Added `isRailOpen` toggle to `ChatTopBar` to expand canvas space on 13-inch screens. Implemented `scroll-behavior: smooth` and `overflow-anchor: auto` to mitigate Layout Shift during LLM streaming. Added `@keyframes biasFlash` to prepare for in-place text patching visibility. |

### ❌ Phase 2 — deferred

| # | Item | Notes |
|---|---|---|
| F1 | **Real LLM token streaming for `final_jd`** | Today `chat_service.run_chat_stream` splits the finished JD into words and `asyncio.sleep(0.012)` between them — typewriter illusion, not actual streaming. Real streaming needs adapter changes in `backend/adapters/llm/*` to expose `astream_tokens` and `drafting_final` to consume it |
| F2 | **`emit_token` is misnamed** | Sends the *complete* assistant message as one chunk. Same fix as F1 — wire real token streaming through |
| F3 | **In-canvas bias-fix patching** | `AgentBlockBias` lists `find → replace` pairs but each pair is advisory only. Spec calls for per-pair `[Apply]` that patches the JD markdown in place. Needs editable canvas content + `apply_bias_fix` action wired through orchestrator |
| F4 | **Variant follow-up refinement** | "Make B more senior-leaning" — user types in rail, AI re-runs variant generation with refinement context. Needs `refine_variant` action + UI hint surfacing (shipped 2026-05-28 via Bucket B Task B7) |
| F5 | **Variant inline `Edit` + `Regenerate`** | `AgentBlockVariants` ships pick-only. Spec wants per-variant Edit (free text override) and overall Regenerate. Needs new actions + writeback to `jd_variants` |
| F6 | **Click-to-scroll stepper** | Clicking a `done` pill should scroll the canvas to that agent block. Trivial DOM work; deferred so this PR stays focused |
| F7 | **Whole-section rail rewrites** | "Rewrite responsibilities in second person" — user types in rail, AI rewrites a specific section. Needs section-aware editing of `final_jd` markdown |
| F8 | **Stage retry card in rail** | When `error_stage` is set, surface a retry button bound to a `retry_stage` action. Today errors render as a banner without recovery affordance |
| F9 | **Centralized greeting** | `chat_service.GREETING_MESSAGE` and `ChatContext.resetChat` both hardcode the welcome text. Will drift. Phase 2: extract to a config endpoint or single source |

### ⚠️ Tech debt — production hardening (not blocking Phase 1, see `docs/TECH_DEBT.md`)

- Stage skip emission for `intake` / `final_jd` stages doesn't fire (only internal/market/bias do). Low priority because only soft-skippable stages need the event today
- Pre-existing type-checker warnings in `agents/orchestrator.py` (TypedDict vs `dict` parameter typing, `action_data` potentially None when `action` is set). Static analysis only — runtime is safe because Python doesn't enforce TypedDict
- `routers/positions.py`, `candidates.py`, `talent_pool.py` still use `current_user["id"]` instead of `user_id` (pre-existing) — already tracked in TECH_DEBT


---

## Appendix — pre-v3 behavioral spec & flows

_Retained from the original `docs/pages/` spec for workflow, edge-case, and API detail. The v3 spec above supersedes the **visual** design; the behavior here is still the reference._

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


---

# Chat Flows — Conversation Scripts
> **Version 2.1 — New Document**
> Exact AI conversation scripts for Recruiter Chat (JD generation) and Candidate Chat (application).
> These scripts define what the AI says, when, and how it handles edge cases.
> This is the product's brain — deviations from these flows must be intentional.

---

## PART 1 — RECRUITER CHAT (JD Generation)

### Workflow Summary
```
Start → Intake → Internal Check → Market Research → Variant Selection → Final JD → Bias Check → Complete
```

---

### 1.1 Session Start

**New session → AI first message:**
```
Hi! I'm your AI hiring assistant. 👋

Let's create a job description together. What role are you looking to fill?

You can also upload an existing JD if you'd like me to start from that.
```

**If user uploads JD file:**
```
Got it! Let me read through this JD...

[parsing...]

Here's what I found:
- Role: {extracted_role}
- Experience: {extracted_experience}
- Key skills: {extracted_skills}
- Location: {extracted_location}

Does this look right? Anything to change or add?
```

---

### 1.2 Intake — Requirements Gathering

**Rule: Max 2–3 questions per message. Never all at once.**

**Turn 1 — After user states role:**
```
A few quick details:
1. What experience range are you targeting? (e.g., 3–5 years, 5–8 years)
2. What are the must-have technical skills?
```

**Turn 2 — After skills + experience:**
```
Got it — {summary}. Two more:
1. Work arrangement: remote / hybrid / onsite?
2. Is this full-time, contract, or internship?
```

**Turn 3 — Summary confirmation:**
```
Here's what I've gathered:

Role: {role}
Experience: {min}–{max} years
Skills: {list}
Work type: {type} · {location}
Employment: {type}

Does this look right, or anything to adjust?
```

User confirms → proceed. User wants changes → accept, confirm, move forward.

**Missing critical info:**
```
Just to make sure I get this right — could you tell me {specific field}?
```

---

### 1.3 Internal Check Stage

**Transition:**
```
Let me check what skills your organization has used in similar past roles...
```
→ Show InternalCheckCard.

**After accepting skills:**
```
Added {skills} to the requirements. These appeared in similar past roles in your organization.
```

**After skipping:**
```
No problem. Moving to market research...
```

**No past data:**
```
No similar past roles found in your organization yet. Moving to market research...
```

---

### 1.4 Market Research Stage

**Transition:**
```
Now let me check what the market is asking for...
```
→ Show MarketResearchCard.

**After accepting:**
```
Added {skills}. These help position the role competitively against {competitor_names}.
```

**After skipping:**
```
Got it. Moving to JD variations...
```

**No competitors configured:**
```
No competitor companies are configured for market benchmarking.

You can add them in Settings → Competitor Intel to enable this for future sessions.

Moving ahead with what we have...
```

---

### 1.5 JD Variant Selection

**Transition:**
```
Based on everything we've gathered, here are 3 JD styles. 
Read through them and pick the one that fits best — you can 
edit any before selecting.
```
→ Show JDVariantsCard.

**After selection (card click or typed):**
```
Great choice! I'll use the {variant_type} style as the foundation. 

Generating your complete job description now...
```

**If user types variant preference:**
- "hybrid" / "the last one" / "option 3" → system maps to correct variant

---

### 1.6 Final JD + Post-Generation

**No transition message — JD streams directly into FinalJDCard.**

**After streaming completes:**
```
Your job description is ready! 

Feel free to edit it directly, or ask me to adjust anything — for example:
• "Make it more senior-focused"
• "Add a section about career growth"
• "Make the tone less formal"

When you're happy with it, click "Save & Find Candidates".
```

**If user asks for refinement:**
```
Updating your JD...
[re-streams with changes]

Here's the updated version. Anything else to adjust?
```

---

### 1.7 Bias Check

Runs automatically. Card shown below FinalJDCard.

**No issues found:**
```
✅ No potentially biased language detected.
```

---

### 1.8 Session Resumption (Existing Session)

**User opens in-progress session:**
```
Welcome back! We were working on the {role_name} JD.

We're at the {stage_label} stage. {context_summary}

Ready to continue?
```

Stage labels:
- intake → "I was gathering your requirements"
- internal_check → "We were reviewing internal skills suggestions"
- market_research → "We were reviewing market research suggestions"
- jd_variants → "You had 3 JD styles to choose from"
- final_jd → "Your JD was ready — you can still edit or save it"
- complete → "This JD was saved as position: {position_name}"

---

## PART 2 — CANDIDATE CHAT (Magic Link Application)

### Flow Summary
```
Greeting → Interest Check → Current Role → Experience → CTC → Notice Period → Resume Upload → Custom Questions → Completion
```

### Rules
- One topic per message — never bundle multiple major questions
- Warm and professional tone — not robotic
- Quick-reply buttons for binary/short choices
- Never mention ATS scores, match percentages, or internal notes
- If confused, re-explain clearly without revealing backend logic

---

### 2.1 Greeting

**Opens automatically on page load:**
```
Hi {candidate_name}! 👋

I'm an AI assistant for {org_name}'s hiring team. We came across your 
profile and think you might be a great fit for our {role_name} role.

This will take about 3–4 minutes. Before we begin — are you currently 
open to exploring this opportunity?
```

Quick replies: `[Yes, I'm interested!]` `[No, thanks]`

---

### 2.2 Not Interested

```
No problem at all! We appreciate you letting us know. Your profile 
will be noted for future opportunities that might be a better fit.

Best of luck! 🍀
```
Session ends. No application created.

---

### 2.3 Current Role Confirmation

**If profile data available:**
```
Wonderful! Let's get started.

We have you listed as {current_title} at {current_company} — is that 
still your current role?
```
Quick replies: `[Yes, that's correct]` `[No, let me update]`

**If no profile data:**
```
Wonderful! Could you share your current role and company?
```

---

### 2.4 Experience

```
How many years of total professional experience do you have?

And of those, how many are directly relevant to {role_area}?
```

AI confirms: `"Got it — 6 years total, 4 years relevant backend experience."`

---

### 2.5 Compensation

```
A couple of questions about compensation — this helps ensure 
the role is the right fit for both of us:

1. What is your current annual CTC?
2. What are you expecting for this role?
```

**If candidate declines:**
```
No problem — that's completely optional. Let's move on.
```
Mark as `"declined"` in screening_responses.

**If asked why:**
```
This information helps our hiring team understand if the compensation 
for this role aligns with your expectations. It's kept confidential 
and only visible to HR.
```

---

### 2.6 Notice Period

```
What is your notice period at your current company?

If you're between jobs or immediately available, just let me know!
```

Quick replies: `[Immediate]` `[15 days]` `[30 days]` `[60 days]` `[90+ days]`

---

### 2.7 Resume Upload

```
Almost done! Please share your latest resume.

You can upload a PDF or Word document (max 5MB).
```

File upload button appears in chat.

**After upload:**
```
✅ Resume received! Thank you.
```

**Upload fails:**
```
It seems there was an issue uploading that file. Could you try 
again? Make sure it's a PDF or DOCX under 5MB.
```

---

### 2.8 Dynamic Screening Questions

Asked one at a time from `screening_questions` table.

Example:
```
One more question — are you comfortable working from our 
{city} office {N} days per week?
```

Another:
```
Do you have any active job offers at the moment?
```

---

### 2.9 Completion

```
That's everything! 🎉

Your application for {role_name} at {org_name} has been submitted.

Here's what to expect next:
• Our hiring team will review your profile shortly
• {org_name} typically conducts {round_count} interview rounds:
  {round_descriptions}
• If shortlisted, you'll receive an email with interview details

We'll keep you updated at each stage. Good luck! 🍀
```

Input disabled. System sends "interview process overview" email automatically.

---

## PART 3 — HANDLING EDGE CASES (Both Chats)

### Candidate asks a question mid-flow

```
{Brief relevant answer if safe to provide}.

To continue with your application — {repeat current question simply}.
```

### Candidate asks about role salary

```
The compensation details will be discussed during the interview 
process. For now, could you share your expected CTC so we can 
ensure alignment?
```

### Candidate wants to update a previous answer

```
Of course! Which part would you like to change?
```
Accept update, confirm, continue from current step.

### Candidate goes offline mid-session

Session stays active 72 hours. On return:
```
Welcome back, {name}! 

We were in the middle of your application for {role_name}. 
Let's pick up where we left off — {last question asked}.
```

### LLM timeout or error

**Recruiter chat:**
```
I ran into a technical issue. Your progress is saved — please 
click "Retry" to continue from where we left off.
```

**Candidate chat:**
```
Something went wrong on our end — your application isn't lost. 
Please refresh the page and we'll pick up where we left off.
```

### Unclear or ambiguous input

**Recruiter:**
```
I'm not quite sure I understood that. Could you rephrase? 
I'm looking for {what was needed}.
```

**Candidate:**
```
Could you clarify that a bit? I want to make sure I 
record your response accurately.
```
