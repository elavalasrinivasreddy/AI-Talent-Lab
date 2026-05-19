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
