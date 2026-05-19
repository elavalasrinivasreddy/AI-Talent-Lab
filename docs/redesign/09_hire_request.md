# Page 09 — Hire Request

**Pattern:** *5-step relay workflow* (variant A)
**Replaces:** ❌ NOT IN CURRENT ROUTER · this is a **new page** for Phase 2
**Why:** Hire Requests are a multi-actor handoff (Hiring Manager → Dept Head approval → Finance → Recruiter pickup → JD chat). The current product handles this implicitly via internal coordination. Surfacing the relay as a first-class workflow eliminates the "did this get approved?" lookup loop and pre-seeds the JD chat with rich context.

Preview reference: `/tmp/atl-design-preview-v3.html` → tab "Hire Request".

---

## 1. Route & layout

| Aspect | Value |
|---|---|
| Route | `/hire-requests` (list) · `/hire-requests/new` (wizard) · `/hire-requests/:id` (detail/edit) |
| Auth | Required (JWT) · all authenticated roles can file; approval routing varies |
| Layout | App shell · relay visualization · 2-column form |
| **Phase** | Phase 2 — not in current router; this doc is the spec for adding it |

---

## 2. Backend tie-in

This page assumes a new (or extended) backend table `hire_requests`. Per `frontend_structure.md`, hire requests are already referenced in the system (hire_request context auto-seeds JD chat in `ChatPage.jsx`). The frontend page needs explicit CRUD.

### Proposed schema (additive)

```sql
CREATE TABLE hire_requests (
  id            UUID PRIMARY KEY,
  org_id        UUID NOT NULL,
  department_id UUID NOT NULL,

  requested_by_user_id UUID NOT NULL,         -- the HM
  role_name     TEXT NOT NULL,
  headcount     INT NOT NULL DEFAULT 1,
  experience_min INT, experience_max INT,
  work_type     TEXT,                          -- remote / hybrid / onsite
  location      TEXT,
  comp_min      INT, comp_max INT,
  requirements  TEXT,                          -- free-form what-the-HM-needs
  target_start  DATE,

  status        TEXT NOT NULL DEFAULT 'pending_dept_approval',
                                              -- pending_dept_approval / pending_finance / approved /
                                              -- assigned_to_recruiter / jd_in_progress / position_created / rejected
  approval_chain JSONB,                        -- [{role: 'dept_head', user_id, status, decided_at, note}, ...]
  assigned_recruiter_id UUID,
  position_id   UUID,                          -- once JD chat creates a position

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Endpoints (new)

| Endpoint | Use |
|---|---|
| `GET /api/v1/hire-requests/?status=&dept=&owner=` | List view (sidebar badge count) |
| `POST /api/v1/hire-requests/` | Create wizard submit |
| `GET /api/v1/hire-requests/:id` | Detail / edit |
| `PATCH /api/v1/hire-requests/:id` | Update (only by requester or admin) |
| `POST /api/v1/hire-requests/:id/approve` | Approval action (called by dept head / finance via magic link or in-app) |
| `POST /api/v1/hire-requests/:id/reject` | Rejection with reason |
| `POST /api/v1/hire-requests/:id/assign` | Admin assigns recruiter |
| `POST /api/v1/hire-requests/:id/pick-up` | Recruiter accepts assignment — opens JD chat with context |

### Magic-link pattern

Approval emails to dept heads / finance include a magic-link URL (`/hire-requests/:id?approve_token=xxx`) so they can approve without logging in.

---

## 3. Layout — new wizard (route `/hire-requests/new`)

```
[ topbar: "New hire request · Backend Engineer"  · sub: "HR Director → Dept Head approval → ..."  · [Save draft] [Submit for approval] ]

[ RELAY VISUALIZATION ]
  "Request flow · Each step assigns to a specific person · auto-handoff via email + magic link"

  ┌─ ① Ramesh M. (filed) ──→ ─ ② Anika S. (current, dept head approval) ──→ ─ ③ Pick recruiter ──→ ─ ④ JD chat (auto-seeded) ──→ ─ ⑤ Position open ─┐
  │  Today · 9:42 AM        │  Awaiting · sent 9:43 AM                    │  After approval        │  ~24h ETA                  │  After JD save     │
  └────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

[ 2-COL FORM ]
┌─────── The role (60%) ─────────────────┬───── Routing + context (40%) ────┐
│ Role title* [Backend Engineer (Go)]    │ Approval routing                  │
│ Department  [Engineering ▼]            │ ☑ Dept head approval (Anika S.)  │
│ Reports to  [Ramesh M. (you)]          │ ☑ Finance approval (auto if >₹45)│
│ Headcount   [2]   Target start [date]  │ ☐ CEO sign-off                   │
│ Exp min  [4]   Exp max  [8]            │ ── est 24-48h ──                  │
│ Work type  [Remote-friendly ▼]         │                                   │
│ Location   [Bangalore]                 │ Context for the AI                │
│                                        │ "When the recruiter picks this up │
│ Comp band (LPA):  min [30]  max [50]   │  the JD chat will open pre-filled │
│ AI estimates: ~85% of Bangalore market │  with: role, dept, comp band, exp,│
│                                        │  your requirements, your name as  │
│ Key requirements (free form)           │  hiring manager for offer sign-off│
│ [large textarea]                       │  · saves ~5 min per JD"           │
│                                        │                                   │
│                                        │ Similar past requests             │
│                                        │ - Senior Go Eng · Q1 2025         │
│                                        │   18d · 2 hires · ₹45 accepted    │
│                                        │ - Backend Lead · Q4 2024 ...      │
└────────────────────────────────────────┴───────────────────────────────────┘
```

---

## 4. The relay visualization

5 circles connected by a horizontal line. Each step shows:
- **Step number** in the ring (large)
- **Who** the step is assigned to (real name + role)
- **What** the step does ("Filed request" / "Dept head approval" / etc.)
- **When** — relative time + status ("Today 9:42 AM" / "Awaiting · sent 9:43 AM" / "After approval" / "~24h ETA" / "After JD save")

Ring states:
- `done` — green solid (✓)
- `current` — teal solid with halo
- `pending` — gray dashed

Line between rings is solid (passed) or dashed (future).

---

## 5. Form sections

### Left column — The role
Required fields marked with `*`. Auto-saving every 30s while user types.

| Field | Notes |
|---|---|
| Role title | Free text; reusable across hires |
| Department | Dropdown from `departments` table |
| Reports to | Pre-filled with current user if they're an HM |
| Headcount | Integer |
| Target start | Date picker |
| Exp min / Exp max | Years range |
| Work type | Remote / Hybrid / Onsite (drives JD generation) |
| Location | Free text or autocomplete |
| Comp band | Two-input range (min / max) in LPA |
| Key requirements | Large textarea — free-form pitch (NOT a JD; the AI turns this into a JD later) |

Below comp band: AI estimate of market alignment ("AI estimates this band attracts ~85% of Bangalore 4-8yr Go engineers").

### Right column — Routing + context

**Approval routing** — toggles for which approvals are needed:
- Dept head approval (default on, points to assigned dept head)
- Finance approval (auto-toggled on if `comp_max > org_finance_threshold` — e.g. ₹45 LPA)
- CEO sign-off (for Director+ roles; default off, manually toggled)

Below: chip showing the chain ("2-step approval · Anika S. → Finance (Sandeep K.) · est 24-48h").

**Context for the AI** — explainer card showing what data will be passed to the JD chat when a recruiter picks this up. Helps the HM understand they don't need to re-explain.

**Similar past requests** — list of 3 recent similar hires with their cycle time + outcome. Helps calibrate expectations.

---

## 6. Status state machine

```
pending_dept_approval ──(approve)──→ pending_finance ──(approve)──→ approved
        │                                    │                          │
        ↓ (reject)                           ↓ (reject)                 ↓ (admin assigns)
     rejected                             rejected                  assigned_to_recruiter
                                                                          │
                                                                          ↓ (recruiter picks up)
                                                                       jd_in_progress
                                                                          │
                                                                          ↓ (JD saved as position)
                                                                       position_created
```

Each transition emits a notification to the next actor + an entry to `pipeline_events`.

---

## 7. List view (route `/hire-requests`)

For admins, recruiters, and HMs:

```
[ topbar: "Hire Requests" + filter chips: All / Mine / Awaiting Me / Approved / Rejected ]

[ Card list — one card per request ]
  ┌─ Backend Engineer (Go) · Engineering · Bangalore Hybrid ──┐
  │ Filed by Ramesh M. · 2h ago · 2 hires · ₹30–50 LPA       │
  │ ● Pending dept head approval · Anika S.                  │
  │                                              [Open detail]│
  └──────────────────────────────────────────────────────────┘
```

Cards grouped by status. "Awaiting me" filter shows only requests where current user is the next approver.

---

## 8. Detail view (route `/hire-requests/:id`)

Mostly the same layout as the wizard, but with:
- Relay visualization updated to current state
- All form fields read-only unless user is the requester (or admin) AND status is still `pending_dept_approval`
- Approval action buttons visible if user is the current approver (`[Approve] [Reject (with note)]`)
- Comment thread at bottom for back-and-forth between HM and approver

---

## 9. Sidebar integration

Sidebar gets a new nav item (admin / HM / recruiter):

```
🏷 Hire Requests   [5]   ← count = awaiting current user
```

For HMs the count is "your awaiting + your pending"; for admins it's "all awaiting approval"; for recruiters it's "approved and assigned to me".

---

## 10. Components to build

| Component | Path | Notes |
|---|---|---|
| `<HireRequestListPage>` | `frontend/src/components/HireRequests/HireRequestListPage.jsx` | New |
| `<HireRequestWizard>` | `HireRequests/HireRequestWizard.jsx` | New — main form (used for new + edit) |
| `<RelayVisualization>` | `HireRequests/RelayVisualization.jsx` | New — the 5-step ring chain |
| `<HireRequestCard>` | `HireRequests/HireRequestCard.jsx` | New — list item |
| `<ApprovalActionBar>` | `HireRequests/ApprovalActionBar.jsx` | New — visible for current approver |
| `<SimilarPastRequests>` | `HireRequests/SimilarPastRequests.jsx` | New — right-column reference card |
| Router additions | `frontend/src/router.jsx` | 3 new routes |
| Sidebar additions | `frontend/src/components/Sidebar/Sidebar.jsx` | 1 new nav item with role gating |

---

## 11. Recruiter pickup flow (handoff to JD chat)

When a recruiter clicks "Pick up" on an approved hire request:

1. `POST /api/v1/hire-requests/:id/pick-up` → sets `status='jd_in_progress'`, `assigned_recruiter_id=current_user.id`
2. Frontend navigates to `/chat` with `location.state.hireRequest = {...}` (existing pattern from `ChatContext`).
3. `ChatContext` detects state, auto-sends an opening message to AI with all the context (already implemented per `key_services_and_flows.md`).
4. AI skips intake stage entirely (since fields are pre-filled) and jumps to internal_check.

Existing `linkViaSession` API call also still fires on JD save to link `positions.session_id ↔ hire_requests.id`.

---

## 12. Empty / loading / error states

| Condition | Display |
|---|---|
| No hire requests in org | List: "No hire requests yet. [File first request]" |
| Wizard validation error | Inline error per field; submit button disabled |
| Approval timeout (>14d pending) | Card shows `--bad` tint, AI Copilot suggestion fires |
| Recruiter pickup fails (assigned to someone else) | Toast: "Picked up by Arun S. 2 min ago" — read-only mode |
| Position already created | Show position link instead of "Pick up" button |

---

## 13. Why this page matters

The current product handles hire requests implicitly via Slack DMs and email chains. Making this explicit:
- Reduces "is this approved?" pings to the HR team
- Pre-loads the JD chat with rich context, saving ~5 min per JD
- Creates an auditable record of who approved what when (compliance bonus)
- Surfaces approval bottlenecks in analytics (offer-stage equivalent for the upstream)

---

## 14. Phase 1 (shipped 2026-05-19) vs Phase 2 (deferred)

The simple flow (`pending → accepted → fulfilled`, single recruiter pickup) is live. The multi-approver relay, AI-context surfaces, and collaborative bits are explicitly deferred.

### ✅ Phase 1 — shipped

| Area | Detail |
|---|---|
| Schema | `hire_requests` table + `comp_min` / `comp_max` / `location` columns added |
| Backend | Dedicated `/api/v1/hire-requests/*` router · service · repository (replaces legacy `/positions/requests/*` shims) |
| Status flow | `pending → accepted → fulfilled` plus `cancelled`; status guards enforced; transactions wrap mutations |
| Audit log | Entries on create / accept / cancel / fulfilled |
| Tenant isolation | All queries org-scoped; cross-org GET returns 404 (verified live) |
| Validation | Pydantic + service-layer; clean 422 with serializable details |
| Sidebar | Nav entry with pending-count badge for admin / recruiter |
| Frontend pages | `/hire-requests` list (role-aware filters) · `/hire-requests/new` wizard · `/hire-requests/:id` detail · `/hire-requests/:id/edit` |
| Relay viz | 5-step ring chain; dept-head and finance steps render as dimmed Phase 2 placeholders |
| Dashboard | Existing widgets keep working via legacy router shims |

### ❌ Phase 2 — deferred (frontend / UX)

| # | Item | Notes |
|---|---|---|
| F1 | **Two-column wizard layout (60/40)** | Currently single-column; spec §3 calls for "The role" left + "Routing + context" right |
| F2 | **Right-column approval routing toggles** | Dept-head / Finance / CEO checkboxes — pairs with the multi-approver backend below |
| F3 | **"Context for the AI" explainer card** | Right-column card showing what auto-seeds the JD chat on pickup |
| F4 | **"Similar past requests" reference card** | Needs an embedding-similarity backend over historical `hire_requests` |
| F5 | **AI market-alignment estimate under comp band** | Tavily / LLM call: "₹30–55 LPA covers ~85% of Bangalore 4-8yr Go engineers" |
| F6 | **Auto-save every 30s while typing** | Currently submits on explicit click only |
| F7 | **Comment thread on detail page** | Back-and-forth between HM and approver — needs a `hire_request_comments` table |

### ❌ Phase 2 — deferred (backend / multi-approver flow)

| # | Item | Notes |
|---|---|---|
| B1 | **Multi-approver relay** | Add dept-head + finance approval steps; new statuses `pending_dept_approval`, `pending_finance`, `approved`. Schema needs `approval_chain JSONB` column |
| B2 | **Magic-link approval emails** | Approval links to dept-head / finance, leveraging `consumed_magic_links` for single-use enforcement (auth pattern already shipped) |
| B3 | **Status-transition state machine** | Per redesign §6 — proper FSM, today the service just guards `pending`/`accepted` |

### ⚠️ Tech debt — production hardening (not blocking Phase 1 ship, track separately)

See `docs/TECH_DEBT.md` for: rate limiting on `/hire-requests/*`, cursor pagination on list endpoint, unit/integration test coverage for `HireRequestService`.
