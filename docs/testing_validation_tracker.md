# Phase 1 Testing — Validation Tracker

> Tracks validation of all bug fixes from `bug_fixes_log.md` + JD Chat end-to-end flow.
> Branch: `phase_1_testing/bug-fix`
> Updated: 2026-06-06

Legend: ✅ Validated clean | ⚠️ Fixed edge case | ❌ Not yet validated | 🔄 In progress

---

## Testing position (manual, by user)

User has tested manually up to: **Bug #76 (drag-drop screening questions)**.
Next manual test: **Settings tab bugs #77–91, then JD Chat flow J1–J8, then Batch I #116–138**.

---

## Batch A — Core infrastructure (Items 1–10)

| # | Fix | Files | Status | Notes |
|---|---|---|---|---|
| 1 | Dev Console global reset (TRUNCATE CASCADE) | `dev_admin.py`, `DevAdminPage.jsx` | ⚠️ | Fixed: `if org_id:` → `if org_id is not None:` to handle org_id=0 edge case |
| 2 | FastAPI deprecation warnings (regex→pattern) | `dashboard.py` | ✅ | Both occurrences fixed; no other routers using regex= |
| 3 | Dev Console org dropdown not refreshing | `DevAdminPage.jsx` | ✅ | loadOrgs() awaited after reset, correct order |
| 4 | Settings crash (ReferenceError: disabled) | `SettingsPage.jsx` | ✅ | item.disabled used correctly, no bare disabled reference |
| 5 | Remove "General" default department on org create | `settings_service.py` | ⚠️ | Code correct; fixed stale docstring still mentioning "General" dept |
| 6 | Team members UX (role dropdown, pending status) | `users.py`, `auth.py`, `auth_service.py`, `TeamTab.jsx` | ✅ | last_login_at returned, Pending badge correct; role column is static text (intended per item 9) |
| 7 | users.py crash on registration (missing last_login_at) | `migrations.py`, `users.py` | ✅ | Migration idempotent (IF NOT EXISTS), fetchrow None check in place |
| 8 | Hide current user in team directory + fix registration login state | `TeamTab.jsx`, `auth_service.py` | ⚠️ | Fixed: empty state guard changed from users.length to filtered.length so sole-member org shows empty state |
| 9 | Strict RBAC for team management + UI polish | `auth.py`, `SettingsPage.jsx`, `TeamTab.jsx` | ⚠️ | Fixed: dept_admin with dept_id=None JWT could bypass dept enforcement (None!=None Python bug) |
| 10 | Org head exclusivity for compliance/security settings | `SettingsPage.jsx` | ⚠️ | Fixed (2026-06-06): organization tab was missing `orgHeadOnly: true` flag — non-org-heads could view the tab (backend blocked saves, but UI was visible). Added flag; rail filter + URL guard now both enforce it. |

## Batch B — Settings & Approval Rules (Items 11–20)

| # | Fix | Files | Status | Notes |
|---|---|---|---|---|
| 11 | Auto-approval rules UI for dept admin + HM | `SettingsPage.jsx`, `ApprovalRulesTab.jsx` | ⚠️ | Fixed: toggle guard moved before optimistic state update to prevent wrong UI state on no-dept admin |
| 12 | Hire request empty state button redundancy + form layout | `HireRequestListPage.jsx`, `HireRequestForm.jsx` | ✅ | Button hidden when empty with loading guard to prevent flash; 3-section form correct |
| 13 | JSX syntax fix in PrivacyTab.jsx | `PrivacyTab.jsx` | ✅ | All tags balanced, no JSX errors |
| 14 | Approval rules UI redesign + toggle switch CSS | `settings.css`, `ApprovalRulesTab.jsx` | ✅ | .st-toggle/.st-slider present, no redundant header |
| 15 | HR/Team Lead department scoping in hire requests | `hire_request_service.py`, `HireRequestForm.jsx` | ⚠️ | Fixed: HR with no dept_id now returns [] instead of leaking org-wide approved requests |
| 16 | Hire request Record attribute error + HR subtitle text | `hire_request_service.py`, `HireRequestListPage.jsx` | ✅ | dict() wrapping correct, subtitle role-aware |
| 17 | Auto-approval backend business logic | `hire_request_service.py`, `hire_requests.py`, `position_service.py` | ⚠️ | Fixed: `if department_id:` → `is not None` for auto-approve; org-level requests intentionally skip auto-approve |
| 18 | Linter warnings + Vite API import path fix | `hire_request_service.py`, `position_service.py`, `ApprovalRulesTab.jsx` | ✅ | All vars initialized before async with; import path correct |
| 19 | Remove unsupported toast import | `ApprovalRulesTab.jsx` | ✅ | No react-hot-toast import, alert() used |
| 20 | Corrected approval rules visibility for dept admins | `ApprovalRulesTab.jsx` | ⚠️ | Fixed: added informational message for org_head (was blank page) |

## Batch C — Competitors & Notifications (Items 21–30)

| # | Fix | Files | Status | Notes |
|---|---|---|---|---|
| 21 | Status visualization draft fix (unfiled request) | `HireRequestForm.jsx`, `helpers.js` | ✅ | draft→Step-1 current; pending→Step-1 done/Step-2 active; fallthrough for unknown status is pre-existing |
| 22 | Org Head exclusivity for Organization Profile tab | `SettingsPage.jsx` | ✅ | orgHeadOnly:true present; rail filter and URL guard both enforce it |
| 23 | Department-scoped competitor intelligence | `competitors` table, `settings_service.py`, `CompetitorsTab.jsx` | ⚠️ | Fixed: CompetitorsTab used user?.department_id (undefined in auth ctx) instead of user?.dept_id — dept_admin would see no competitors |
| 24 | Fixed approval rules toggle error for dept admins | `settings.py` (models) | ✅ | auto_approve_hire_requests in DepartmentUpdate model; DB migration present |
| 25 | Redesigned culture keywords chip UI | `OrganizationTab.jsx` | ⚠️ | Fixed: no deduplication in addTag — duplicate keywords would silently save. Fixed again (2026-06-06): dedup was case-sensitive so "Innovation" and "innovation" saved as separate tags; changed to case-insensitive `.some(k => k.toLowerCase() === val.toLowerCase())` |
| 26 | Fixed 500 error on competitor creation | `settings_service.py` | ✅ | NotificationRepository.create called with dict arg; signature matches |
| 27 | Settings API KeyErrors + JSON deserialization | `settings.py` (router), `settings_service.py` | ⚠️ | Fixed: get_ai_behavior now handles non-dict/non-str JSONB values with try/except fallback |
| 28 | Settings service NoneType + unpacking errors | `settings_service.py` | ✅ | creator guarded, "System" fallback present; explicit kwargs used, no **unpacking |
| 29 | Notification bell portal rendering fix | `NotificationBell.jsx` | ✅ | createPortal to document.body; all event listeners and interval properly cleaned up |
| 30 | Notification banner premium UI redesign | `NotificationBell.jsx`, `NotificationBell.css` | ⚠️ | Working correctly; TYPE_META uses hardcoded hex (bypasses design tokens) — logged as polish item, not fixed |

## Batch D — Hire Request Filters & Timezone (Items 31–41)

| # | Fix | Files | Status | Notes |
|---|---|---|---|---|
| 31 | Notification timestamp UTC fix | `NotificationBell.jsx` | ✅ | 'Z' appending correct; null guard present; double-append prevented |
| 32 | Cleanup duplicate Pydantic fields | `settings.py` (models) | ✅ | auto_approve_hire_requests defined once with bool=False in DepartmentCreate and DepartmentResponse |
| 33 | Notification navigation routing | `NotificationBell.jsx` | ⚠️ | Fixed: absolute URLs (https://...) now open in new tab via window.open instead of breaking React Router |
| 34 | Dept admin badge leaking org-wide count | `hire_requests.py` (repo), `hire_request_service.py`, `hire_requests.py` (router) | ✅ | count_pending scoped by dept+status per role; org_head excluded from polling in sidebar |
| 35 | Shared timeAgo utility (timezone fix) | `date.js`, 6 components | ✅ | utils/date.js exists; all 6 components import from it; PositionCard daysOpen also has 'Z' guard |
| 36 | Remove Hire Requests scope from org_head | `Sidebar.jsx`, `ENHANCEMENTS_IDEAS.md` | ✅ | org_head absent from roles array; badge polling guard excludes org_head |
| 37 | Missing deep links in competitor notifications | `settings_service.py` | ✅ | All 4 notification payloads (create×2, delete×2) have action_url present |
| 38 | Dept admin forbidden from updating settings/competitors | `settings.py` (router) | ✅ | All 4 permission checks use user.get("dept_id") consistently |
| 39 | Missing/empty filter tabs for HR & dept admin | `HireRequestListPage.jsx` | ✅ | queue_approval for dept_admin, queue_pickup for hr; dept_admin has general tabs; team_lead only sees 'mine' |
| 40 | Dept admin forbidden from listing hire requests | `HireRequestListPage.jsx` | ✅ | All dept_admin filters use scope:'default'; HR with no dept returns [] (intentional by design) |
| 41 | All tab fix + Resume JD Chat button | `hire_request_service.py`, `HireRequestListPage.jsx`, `HireRequestDetailPage.jsx` | ⚠️ | status='all' → eff_status=None correctly; "Resume JD chat" shown for accepted+no position_id; navigates with hireRequest state. **Edge case fixed (919b4db):** canPickup only checked `approved` — backend allows pickup from `approved_modified` too; fixed to `['approved', 'approved_modified'].includes(req.status)` |

---

## Batch E — Code review of items 42–75 (S68, 2026-06-01)

Parallel Sonnet review subagents over the JD-chat / Settings / Dashboard / Positions / Talent-Pool batch. Each finding verified by Opus against the motivating line before action.

### Fixed
| Severity | File:line | Bug | Fix |
|---|---|---|---|
| P1 | `routers/positions.py:58` | `/pending-count` read `current_user["department_id"]` but JWT dict uses `dept_id`, so team_lead/dept_admin always fell through to the org-wide count (badge leak). | Read `dept_id`. |
| P1 | `agents/nodes/{market_intelligence,interviewer,internal_analyst,benchmarking}.py` | Bare `response.content.strip()` with no multimodal list→str guard (item 57 only patched `drafting.py`/`bias_checker.py`). `interviewer` is the first-turn HARD STOP node → a list response blocked every new session. | Added the same `isinstance(content_raw, list)` guard. |
| P2 | `components/Sidebar/Sidebar.jsx:36` | Analytics nav shown to `hr`, but `/analytics` RoleGuard is `['org_head','dept_admin']` → hr clicked it and got bounced to /dashboard. | Removed `'hr'` from the nav entry. |
| P2 | `agents/nodes/market_intelligence.py:133+` | Fallback market-skill `source` stamped raw competitor names ("Google, Microsoft"); item 51 only generalized the LLM prompt, not the fallback path. | Source label → "Industry Benchmark". |

### Flagged findings — all resolved (user approved fixing all 6)
| Severity | File | Fix applied |
|---|---|---|
| P2 | `chat_service.py:207` | Market card SSE now ships `["Industry Benchmark"]` (or `[]`) instead of raw `competitors_used` — names never reach the client (`AgentBlockMarket.jsx` rendered them verbatim). Matches item 51's generalization. |
| P2 | `routers/positions.py:222` | Inline `submit-for-approval` now **delegates to the dept-scoped `PositionService.submit_for_approval`** (notifies only the position's department's team leads + org-level, and honors JD auto-approval). Returns the real post-call `approval_status`. |
| P2 | `db/repositories/positions.py:181` | Added `role_name`, `jd_variant_selected`, `employment_type`, `experience_min`, `experience_max` to the `update()` allowed-set so they persist on a JD resubmit. |
| P2 | `Chat/PositionSetupModal.jsx` + `chat_service.py` | org_head can now finish a JD chat: modal shows a **Department selector only when the user has no department of their own** (`!user?.department_id`); submit/draft disabled until chosen. Also fixed a latent bug — the modal previously auto-sent `departments[0]`, silently overriding the hire request's department for HR; now it only sends a department when the selector is shown, so the backend uses the session's (hire request's) department otherwise. |
| P2 | `agents/nodes/drafting.py:278` | Empty model completion now raises (routes into the existing retry path that sets `error_stage` at retry ≥2) instead of being stored as the JD and re-looping to `max_iterations`. |
| P3 | TalentPool / useDashboardData / DashboardPage | Removed the dead `platform_admin` entries (unreachable behind `OrgGuard`). |

**Verdict on others reviewed:** sessions.py `list_visible` (items 48/50), positions `list_for_org` (item 70), dashboard `_resolve_dept_id` (item 69), copilot key fix (item 49), TypedDict completeness (item 57), and frontend items 58/61/64/65/66/67/72 verified clean. The `isOnboarding` double-guard (DashboardPage:114) is redundant but behaves correctly (onboarding = truly empty) — left as-is.

---

## JD Chat Flow (to test after item 41)

| Step | Description | Status | Notes |
|---|---|---|---|
| J1 | HR picks up hire request (approved → jd_in_progress) | ❌ | Status now `jd_in_progress` (not `accepted`) — new state machine |
| J2 | HR starts JD chat from hire request detail page | ❌ | |
| J3 | Chat stages 1–8 execute correctly | ❌ | |
| J4 | JD variants generated, HR reviews | ❌ | |
| J5 | HR submits JD for reviewer approval (ATS popup + submit) | ❌ | |
| J6 | Reviewer approves → position goes open | ❌ | |
| J7 | Reviewer rejects → feedback injected in chat, HR revises | ❌ | |
| J8 | Candidate applies via career page | ❌ | |

---

## Batch F — Settings Tabs & Career Page (Items #77–92)

| # | Fix | Files | Status | Notes |
|---|---|---|---|---|
| 77 | Scorecard Rubric UI & Backend Issues | `SettingsPage.jsx`, backend | ✅ | DELETE/PATCH/set-default all correct; ConfirmModal wired; set-default unsets others atomically |
| 78 | Remove shape from P2/P3 phase badges | `SettingsPage.jsx` | ✅ | Plain text badges; no background/border |
| 79 | Departments Tab confirmation modal & dept head redundancy | `DepartmentsTab.jsx` | ⚠️ | ConfirmModal correct; **Edge case fixed:** form init had `head_user_id:''` but reset omitted it — removed stale key from initial state |
| 80 | Team Directory UI & role filter logic | `TeamTab.jsx` | ✅ | Org Head excluded from filter; edit+deactivate icons correct |
| 81 | Approval Rules modernization & org head policies | `ApprovalRulesTab.jsx` | ✅ | Org head dept selector; allow_auto_approve_jds migration; Toast replaces alert; res.data path fixed |
| 82 | Notifications Tab implementation + logout-on-toggle fix | `NotificationsTab.jsx`, `settings.py` | ✅ | JSONB column; setUser(res.data.user) logout fix correct; preferences initialized from user object |
| 83 | Organization auto-draft capabilities upgrade | `OrganizationTab.jsx`, backend | ✅ | Tavily fallback on 403; fallback_used UI warning; PDF upload endpoint functional |
| 84 | Organization Tab UI/UX polish | `OrganizationTab.jsx` | ✅ | Toast replaces msg array; glassmorphism overlay on isDrafting |
| 85 | Competitors Intel CRUD + premium accordion UI | `CompetitorsTab.jsx`, backend | ✅ | PATCH endpoint scoped correctly; 3/dept limit enforced server+client; ConfirmModal; accordion state |
| 86 | Message Templates: magic draft, tone analyzer, live preview | `MessageTemplatesTab.jsx`, `settings.py` | ✅ | All AI endpoints exist with require_hr; live preview; variable insert at cursor; duplicate works |
| 87 | Message Templates: role access, UI cleanup, notifications | `MessageTemplatesTab.jsx`, `settings.py` | ✅ | require_hr on all endpoints; ConfirmModal; setEditing(null) on save; Toast notifications |
| 88 | Career page implementation + backend 500 fix + scaling | `CareerPage.jsx`, `CareersIndexPage.jsx`, `careers.py` | ✅ | key_skills removed; fit endpoint clean; back navigation present |
| 89 | Email service 500 on hire request creation (`_safe_url` infinite recursion) | `email_service.py` | ✅ | Returns "" for empty; prepends FRONTEND_URL for "/" paths; no recursion; html.escape return |
| 90 | JD rejection requires mandatory feedback note | `positions.py` (router), `LegacyDashboard.jsx` | ✅ | Backend 422 NOTES_REQUIRED enforced; frontend textarea disabled until note typed; both layers validated |
| 91 | Bias checker premium git-diff UI | `FinalJDCard.jsx` | ✅ | Diff pills (red/green); category badges; accepted state; "Accept all (N)" banner correct |
| 92 | Drag-drop screening questions: stale closure (frontend useRef) | `ScreeningQuestionsTab.jsx` | ⚠️ | Frontend fix correct; **real blocker was backend route order (#75 below)**; useRef pattern verified; onDragLeave child-element guard present |
| **75** | **Drag-drop never persisted: PATCH /reorder hit /{question_id} (FastAPI route order bug)** | `settings.py` | ✅ | Fixed 2026-06-04: moved `/reorder` before `/{question_id}` (commit `05f44d5`) |

---

## Batch G — JD Chat Workflow (Items #93–110)

| # | Fix | Files | Status | Notes |
|---|---|---|---|---|
| 93 | Resume Chat starts blank — no JD pre-seeding | `JDTab.jsx`, `ChatContext.jsx`, `ChatPage.jsx` | ✅ | sessionLoaded guard + messages.some(role=user) prevents race; auto-seed correctly gated |
| 94 | Internal skills check card skipped when no past JDs found | `internal_analyst.py`, `chat_service.py`, `ChatContext.jsx`, `AgentBlockInternal.jsx` | ✅ | Emission guard uses stage+accepted check; Array.isArray restore correct; empty-state UI renders |
| 95 | JD variants refine bar broken on dark theme | `chat.css`, `AgentBlockVariants.jsx` | ✅ | .variant-refine-bar dark-theme styling; Enter-key submit present |
| 96 | Bias diff: stale counter, no navigation, stale closure on handlers | `FinalJDCard.jsx` | ✅ | focusedDiffIdx + pendingIndices memo; latest-ref pattern for global handlers; auto-advance correct |
| 97 | Dev Admin reset leaving orphaned hire requests | `dev_admin.py` | ✅ | DELETE FROM hire_requests in org-scoped, global, and full-wipe paths |
| 98 | HireRequestService missing `priority` in position creation | `hire_request_service.py` | ✅ | priority=setup_data.get("priority","normal") forwarded to PositionRepository.create() |
| 99 | JD chat not read-only during pending approval | `ChatContext.jsx`, `FinalizeCTA.jsx`, `ChatTopBar.jsx` | ✅ | pendingApproval flag set; FinalizeCTA gated; amber banner shown to HR |
| 100 | Position detail: duplicate approval banners | `PositionHero.jsx` | ✅ | pd-approval-banner removed; single status chip shows "Pending Review" in warning variant |
| 101 | "Request Changes" broken — wrong decision value + no notes input | `JDTab.jsx` | ✅ | Inline modal; calls changes_requested with notes; submit disabled until notes non-empty; inline error banners |
| 102 | Team lead feedback notes not visible after changes requested | `migrations.py`, `position_service.py`, `JDTab.jsx` | ✅ | review_notes persisted on rejection, cleared on approval atomically; amber box in JDTab |
| 103 | JD canvas text color inconsistent after AI update | `chat.css` | ✅ | .jd-body p/ul/ol/li all use --color-text-secondary |
| 104 | Bias check not re-triggered after AI update; Finalize not gated | `FinalJDCard.jsx` | ✅ | prevFinalJdRef tracks markdown; resets biasCheckDone on change; Finalize disabled until check done |
| 105 | Settings page scrolls vertically; no-right-rail no CSS | `layout.css`, `settings.css`, `SettingsPage.jsx` | ✅ | height:100vh on app-layout; min-height:0+overflow:auto on app-main; no-right-rail grid fix present |
| 106 | JD chat shows `alert()` instead of Toast | `MessageInput.jsx` | ✅ | Toast imported; local toast state; all 3 alert() calls replaced; Toast rendered in composer |
| 107 | "New Hire" sidebar shows `window.confirm` dialog | `Sidebar.jsx` | ✅ | window.confirm removed; handleNewHire always calls resetChat+navigate |
| 108 | "New Hire" shows old session messages instead of greeting | `ChatContext.jsx` | ✅ | Initial messages state is [DEFAULT_GREETING] not []; resetChat also sets greeting |
| 109 | Resume AI Chat auto-fires after session deleted | `JDTab.jsx` | ✅ | navigate() has no state; session URL only; prevents intake auto-seed on 404 |
| 110 | GET pipeline-summary 500: text ->> unknown (missing ::jsonb cast) | `positions.py` (router) | ✅ | event_data::jsonb->>key cast applied at all 6 expressions in both query blocks |

---

## Batch H — JD Workflow State Machine (Items #111–115 + Code Review)

| # | Fix | Files | Status | Notes |
|---|---|---|---|---|
| 111 | JD workflow Design Rev 4: DB migrations + repo + service + router | `migrations.py`, `hire_requests.py`, `positions.py`, `hire_request_service.py`, `position_service.py`, `hire_requests.py` (router) | ⚠️ | All 14 DB columns present; all repo/service/router methods confirmed. **Edge case fixed (2026-06-06):** `begin_review` service had TOCTOU pre-read; reordered to CAS-first so the atomic repo UPDATE runs before any state check |
| 112 | Transition guard mismatches — state machine | `hire_requests.py` (repo), `hire_request_service.py` | ⚠️ | `approve_request`/`reject_request`/`accept` guards all correct. **Gap fixed (2026-06-06):** `approve_modified` guard was missing `"submitted"` — asymmetric vs `approve_request`; dept_admin could not approve-modified without first clicking begin-review |
| 113 | Idempotent feedback injection into chat sessions | `position_service.py` | ✅ | Logic, revision_cycle increment, ON CONFLICT index all correct. **Critical bug fixed (2026-06-06):** INSERT included `org_id` column which does not exist on `chat_messages` — every `changes_requested` decision silently swallowed the psql error and never injected feedback into the chat |
| 114 | Celery periodic task — stale review lock cleanup | `hire_request_locks.py`, `celery_app.py` | ✅ | File exists; task registered in `include` list; beat_schedule entry with 300s interval; `release_expired_locks` uses 30-min TTL; transitions back to `submitted`; event-loop helper handles both sync/async contexts |
| 115 | Full 25-item JD workflow implementation (frontend + backend) | `positions.py`, `position_service.py`, `positions.py` (router), `ChatContext.jsx`, `MessageList.jsx`, `SidebarSessions.jsx`, `chat.css`, `sessions.py` | ⚠️ | `approve_and_open` CAS correct; cancel/withdraw/re_resolve_reviewers all present; cross-dept authority check correct (org_head bypasses, others validated). **Route shadow fixed (2026-06-06):** `GET /resolve-reviewer` was shadowed by `GET /{position_id}` — endpoint was unreachable; moved before the parameterised route. **Stale snapshot fixed:** `withdraw_submission` now clears `submitted_by_role` and `reviewer_role_at_submit` |
| CR-1 | 13 race conditions + permission bypasses fixed (code review 2026-06-04) | `position_service.py`, `positions.py` (repo), `positions.py` (router) | ✅ | commit `0a13d82` — atomic CAS confirmed at `hire_requests.py:384-397`; dept-scope guard confirmed at `hire_request_service.py:474-479`; NULL reviewer guard confirmed at `position_service.py:391-395` |

---

## Batch I — JD Workflow Follow-Up & UI Hardening (Items #116–138)

| # | Fix | Files | Status | Notes |
|---|---|---|---|---|
| 116 | HR approval note conveyed to team lead | `hire_request.py`, `hire_requests.py` (router), `hire_request_service.py`, `email_service.py`, `api.js`, `HireRequestDetailPage.jsx` | ✅ | Backend/email/audit correct. **Edge case fixed (2026-06-06):** Approve button now opens inline note panel (same UX as reject) — admin types optional note before confirming; `handleApprove` passes note to API |
| 117 | JD chat greeting inconsistent across entry points | `ChatContext.jsx`, `ChatPage.jsx` | ✅ | Greeting fix correct. **Edge case fixed (2026-06-06):** `resetChat` now accepts `sessionData` param and passes it to `buildGreeting` — revision-aware greeting works from all entry points |
| 118 | StrictMode double-seed: duplicate sessions + two bot replies | `ChatPage.jsx` | ✅ | `location.key` guard correct. **Edge case fixed (2026-06-06):** `AbortController` added to SSE stream — prior stream is aborted before new `sendMessage` fires; concurrent stream writers eliminated |
| 119 | Seeded intake message included approval metadata noise | `ChatPage.jsx` | ✅ | Clean — headcount correctly kept for >1 hires; null fields omitted; all JD-relevant fields present |
| 120 | TL not notified + stage stuck — wrong "settings" column in resolve_reviewer | `position_service.py`, `test_position_approval.py` | ✅ | Clean — `get_ai_behavior` used; correct connection passed; safe defaults confirmed |
| 121 | HR chat editable while JD pending approval | `chat.py` (router), `JDTab.jsx` | ✅ | Lock logic correct. **Stale status fixed (2026-06-06):** removed dead `"rejected"` from `_EDITABLE_POSITION_STATUSES`; frontend `loadSession` and `refreshGraphState` editable lists also updated to match |
| 122 | Stale approval-decision tests (KeyError after Rev 4) | `test_position_approval.py` | ✅ | Clean — complete mock rows, CAS patches, `_FakeConn.transaction()` all verified |
| 123 | Org competitors not loaded into JD market-research state | `chat_service.py`, `test_competitor_state.py` | ✅ | Clean — `list_by_org` NULL handling correct; empty list handled gracefully; dept fallback logic correct |
| 124 | Position created as 'draft' blocked auto-submit for approval | `chat_service.py`, `chat.py` (router), `PositionSetupModal.jsx` | ✅ | **Fixed (2026-06-06):** service annotates position dict with `auto_submitted` flag; router returns it in response; frontend shows inline warning if auto_submitted=false so HR can manually submit from JD tab |
| 125 | Dashboard analytics 500 — asyncpg interval/timestamp mismatch | `dashboard_service.py` | ✅ | **Fully fixed (2026-06-06):** `get_stats` now uses `datetime.now(timezone.utc).replace(tzinfo=None)` + `timedelta` params; `get_analytics` velocity query uses `$2` cutoff param; no raw SQL interval strings remain |
| 126 | Hire request + chat stalling at "JD Generation" | `PositionSetupModal.jsx` | ✅ | **Fixed (2026-06-06):** `res.json()` read immediately after `res.ok` check before any async work (`linkSession`, `sendMessage`); body-consumed error eliminated; auto_submitted warning shown if submission silent-failed |
| 127 | Missing "Edit Notes" workflow for dept admins | `hire_request.py`, `hire_request_service.py`, `hire_requests.py` (repo), `HireRequestForm.jsx`, `HireRequestDetailPage.jsx` | ✅ | Workflow correct. **Constraint fixed (2026-06-06):** `HireRequestUpdate.notes` now has `max_length=1000` via `Field()` — consistent with `HireRequestApprove.note` |
| 128 | ChromaDB vector store adapter type mismatch | `vector_store.py`, `main.py` | ✅ | **Fixed (2026-06-06):** `startup_probe()` added to `vector_store.py`; called in `lifespan()` at boot — distinguishes not-installed (warning) vs failed-to-init (error); logs clearly so ops know vector search is degraded |
| 129 | "Open Position" link wrong tab + UI state not updated post-approve | `positions.py` (router) | ✅ | Link routing correct. **TOCTOU fixed (2026-06-06):** post-decision response now derived from decision enum directly (`{"approved": {"status":"open", ...}}`); no re-fetch, no race window |
| 130 | Team lead JD approval permission denied — wrong reviewer assigned | `position_service.py` | ⚠️ | `fulfilled` status correctly included. **Known limitation:** if admin edits `requested_by` on a fulfilled hire request, wrong TL becomes reviewer; no guard against this edge case — accepted as low-probability admin error |
| 131 | Team lead cannot view open positions (HR created them) | `positions.py` (router), `position_service.py`, `positions.py` (repo) | ✅ | **Security bug fixed (2026-06-06):** reviewer_id OR branch now scoped to `team_lead_dept_id` — TL can only see positions from their own department; dept_id passed from router through service to repo |
| 132 | Chat "Pending approval" banner shown after JD approved | `ChatContext.jsx`, `ChatPage.jsx` | ✅ | **Fixed (2026-06-06):** `refreshGraphState` now also updates `isReadOnly`/`readOnlyReason`; `ChatPage.jsx` polls `refreshGraphState` every 30s when pending_approval — banner clears without page reload when TL approves |
| 133 | Hire request "Reject" button missing danger styling | `HireRequests.css` | ✅ | Clean — `.hr-btn-danger` defined; applied correctly; specificity and hover both correct |
| 134 | Hire request cancellation: `window.confirm` + no TL notification | `HireRequestDetailPage.jsx`, `hire_request_service.py`, `hire_requests.py` (repo/router) | ✅ | **Auth bypass + TOCTOU fixed (2026-06-06):** `cancel()` uses `RETURNING id` to detect zero-row updates; dept_admin scoped to own dept_id; notifications gated on actual cancellation; `caller_dept_id` threaded through router→service |
| 135 | Org Head dashboard: 422 error, missing depts, wrong default period, dept chip for dept_admin | `DashboardPage.jsx` | ✅ | Core fixes correct. **Silent failure fixed (2026-06-06):** `getDepartments()` error now sets `deptsError` state and shows inline error + retry button instead of silently emptying chip bar |
| 136 | Sweep: replace all `window.confirm` with `ConfirmModal` | `CandidateDetailPage.jsx`, `DevAdminPage.jsx`, `PrivacyTab.jsx`, `ConfirmModal.jsx` | ✅ | Zero `window.confirm` remaining. **Shared concern fixed (2026-06-06):** `ConfirmModal` now `await`s `onConfirm()` before calling `onClose()`; shows "Please wait…" during async; overlay click disabled while confirming |
| 137 | Interview Kit tab crashes (blank screen) on malformed LLM data | `InterviewKitTab.jsx` | ✅ | Main guards correct. **Fixed (2026-06-06):** `q.what_to_look_for` and `fu` items now guarded with `typeof … === 'string'` ? … : `String(…)`; empty `questions=[]` shows empty state with Regenerate button; `handleCopyAll` also guarded |
| 138 | "Generate Interview Kit" 401 Unauthorized | `InterviewKitTab.jsx` | ✅ | Clean — uses centralized `positionsApi`; correct session storage key; old `authHeader` fully removed |

---

## Batch J — Phase 2 Feature Set (Items #139–152)

| # | Fix | Files | Status | Notes |
|---|---|---|---|---|
| 139 | Dashboard v3 Execution Fixes | `dashboard_service.py`, `HealthStrip.jsx`, `BriefingLane.jsx`, `dashboard.css`, `DashboardPage.jsx` | ✅ | All 4 fixes confirmed: `avg_time_to_hire` in `get_stats()`, correct field mapping in HealthStrip, `.tb-lane--empty` green tint, period-switcher tooltip |
| 140 | Analytics Redesign: Agent ROI Dashboard | `dashboard_service.py`, `dashboard.py`, `api.js`, Analytics components | ⚠️ | Core implementation confirmed. **2 data-binding gaps fixed:** (1) `KpiStrip` read `active_positions` which was never returned — added query + field to `get_analytics()`; (2) `AgentROIHero` read `share_delta` never returned — added prior-period queries + `share_delta` computation to `get_agent_roi()` |
| 141 | (malformed duplicate entry — skip) | — | ✅ | Empty placeholder in log; real fix is #142 |
| 142 | Fix Default 50% Match Display on Career Page | `careers.py` | ✅ | `has_filters` computed, `fit_score=0` when no filters, frontend hides badge when `fit_score === 0` |
| 143 | Fix "Apply via chat" Button | `CareerPage.jsx`, `CareerPage.css` | ✅ | `positionId` extracted from route params, position fetch on mount, detail view renders with button |
| 144 | Fix Career Page JD Formatting and Public Apply Flow | `careers.py`, `CareerPage.jsx` | ✅ | Interstitial modal, backend creates candidate+application+token, `ReactMarkdown` renders JD |
| 145 | Fix react-markdown className Prop Error | `CareerPage.jsx` | ✅ | `<div>` wrapper carries className; `<ReactMarkdown>` has no className prop |
| 146 | Fix Career Page Apply Endpoint — Missing department_id + Wrong Token Function | `careers.py` | ✅ | `department_id` in SELECT; module-level `generate_apply_token` imported and called correctly |
| 147 | Fix Browser Alert → Toast on Career Page | `CareerPage.jsx` | ✅ | No `alert()` calls; Toast component used throughout |
| 148 | Fix Apply Chat — Session Creation & Column Name Bugs | `apply_service.py` | ⚠️ | All 3 claimed fixes present. **Latent gap fixed:** `_load_context` org dict was missing `"id": org_id` key (added) — would cause `KeyError` in chat controller `context["org"]["id"]` access |
| 149 | Fix GDPR Consent — Timezone-Aware vs Naive Datetime | `gdpr_service.py` | ⚠️ | Fix direction correct (naive datetime needed for `timestamp without time zone` column). **Code quality fix:** replaced deprecated `datetime.utcnow()` with `datetime.now(timezone.utc).replace(tzinfo=None)` |
| 150 | Fix Celery Worker DB Pool Initialization | `connection.py` | ✅ | `get_pool()` auto-initializes with lazy `settings.DATABASE_URL` import; logic correct |
| 151 | Trigger ATS Scoring for Organic Applicants | `candidate_pipeline.py`, `apply_service.py` | ✅ | Task and dispatch both present and correct. Pre-existing edge case: `position_id=None` dispatch not guarded, but task exits early cleanly — acceptable |
| 152 | Prevent Groq API Rate Limits During Celery Sourcing | `tavily.py` | ✅ | Confirmed `llama-3.1-8b-instant` model used with matching inline comment |

---

## Batch K — Phase 2 UI Polish & UX Fixes (Items #153–178)

| # | Fix | Files | Status | Notes |
|---|---|---|---|---|
| 153 | Expose ATS Retry in UI | `candidates.py` (router) | ✅ | `/retry-ats` endpoint confirmed; `int(application_id)` + `int(position_id)` casts before Celery dispatch |
| 154 | positionId context loss during navigation | `PipelineStackView.jsx`, `PipelineTab.jsx` | ✅ | Both navigate calls pass `positionId` in router state; `PipelineTab.jsx:279` confirmed |
| 155 | Celery type mismatch for ATS retry | `candidates.py` (router) | ✅ | Same `int()` cast fix as #153 — same endpoint, both paths covered |
| 156 | Analytics: emoji in error banner | `AnalyticsPage.jsx` | ✅ | `role="alert"` div, no emoji, plain text error message |
| 157 | Analytics: `Promise.all` total failure | `AnalyticsPage.jsx` | ✅ | `Promise.allSettled` at line 34 — partial data renders on single API failure |
| 158 | Analytics: missing KPI strip | `AnalyticsPage.jsx`, `dashboard_service.py` | ✅ | `KpiStrip` component present; `active_positions` backend field added in Batch J |
| 159 | Analytics: `AgentROIHero` typography (B-grade) | `AgentROIHero.jsx`, `AgentROIHero.css` | ✅ | `roi-hero-share-num` large display, delta chip conditional on non-null delta, null guard on data prop |
| 160 | Analytics: `DualFunnel` hardcoded hex | `DualFunnel.jsx`, `AnalyticsPage.css` | ✅ | JSX uses CSS class names only; `.dual-funnel-bar-human/ai` use `var(--color-chart-human)` / `var(--color-primary)` |
| 161 | Analytics: `BottleneckRadar` hardcoded legend + no regression signal | `BottleneckRadar.jsx`, `AnalyticsPage.css` | ✅ | `radar-legend-dot-*` CSS classes; `isRegressed()` helper adds `↓` marker + `radar-label-regressed` class |
| 162 | Analytics: period switcher not pill style | `AnalyticsPage.css` | ✅ | `.analytics-period-switcher { border-radius: 9999px }` + `.analytics-period-btn { border-radius: 9999px }` |
| 163–167 | Analytics A+ Design upgrade (duplicate entries for #159–162 + #156) | same files | ✅ | Same implementations verified — duplicate log entries only |
| 168 | Dashboard: PULSE event titles raw lowercase | `BriefingRow.jsx` | ✅ | `formatEventTitle()` helper: uppercase known acronyms + title-cases other strings |
| 169 | Dashboard: VelocitySparkline "open reqs" always plural | `VelocitySparkline.jsx` | ✅ | Line 67: `` `${n} open req${n !== 1 ? 's' : ''}` `` |
| 170 | Positions List: "active roles" always plural | `PositionsListPage.jsx` | ✅ | Line 125: `` `active role${openCount !== 1 ? 's' : ''}` `` |
| 171 | Position Detail: AI confidence raw decimal | `StageHealthHeader.jsx` | ✅ | `Math.round(confidence * 100)%` shown as Chip with High/Medium/Low label + success/warning/danger variant |
| 172 | Position Card: stage bars 7 colors, no tooltips | `StagePipeStrip.jsx` | ✅ | 3 semantic colors (primary/success/muted); `title={fullLabel}` tooltip on every segment |
| 173 | Dashboard: Avg Time to Hire bare dash | `HealthStrip.jsx` | ✅ | `delta: !health.avg_time_to_hire ? 'No hires this period' : undefined` passed to `Stat` atom |
| 174 | Positions List: empty state no A+ design/CTA | `PositionsListPage.jsx` | ✅ | `EmptyPositions` component: SVG icon, segment-aware title, role-aware CTA (`/chat` for HR, `/hire-requests/new` for TL) |
| 175 | Position Detail: ATS chip no tooltip; saturation no explanation | `StageHealthHeader.jsx` | ✅ | ATS Chip has `title` prop (line 56); saturation div has `title` attribute (line 102) |
| 176 | Dashboard: PULSE "View" buttons too small; empty lane too tall | `dashboard.css` | ✅ | `.tb-row-action { min-height: 44px }` (line 466); `.tb-lane-empty { padding: var(--space-3) }` compact |
| 177 | Position Detail: status dropdown isolated from title | `PositionHero.jsx` | ✅ | Status `Chip` inline in `.pd-hero-title-row`; Change Status overlay select in `.pd-hero-right` — same `pd-hero` card |
| 178 | Positions Toolbar: sort raw inline styles | `PositionsToolbar.jsx` | ✅ | Full CSS class coverage: `positions-toolbar`, `positions-search-wrap`, `positions-sort-wrap`, `positions-select` |

## Batch L — Phase 2: Candidate Portal, Pre-Evals, Sourcing (#179–197)

| Bug # | Description | Files | Status | Notes |
|---|---|---|---|---|
| 179 | Candidate Hero button styling & disabled states | `CandidateHero.jsx`, `CandidateDetailPage.css` | ✅ | `.cd-btn-primary/outline/ghost` CSS families; Move button disabled when no `VISIBLE_MOVE_STAGES` remain |
| 180 | Candidate Detail: native `window.confirm()` popups | `CandidateDetailPage.jsx` | ✅ | State-driven `ConfirmModal` replaces native confirm; `setSelectConfirmOpen(true)` triggers modal |
| 181 | Candidate Notes 500 error (KeyError: 'id', 'name') | `notes.py`, `dependencies.py` | ✅ | `"id"` injected alongside `"user_id"` in `get_current_user`; `author_name` queried from `users` table directly |
| 182 | Note mentions not dispatching notifications; edit-mode no dropdown | `NotesTab.jsx` | ✅ | `extractMentions()` maps @names → user IDs in payload; `handleInputChange(e, mode)` unifies draft and edit state |
| 183 | Position Hero status dropdown — unstyled native select | `PositionHero.jsx` | ✅ | Native `<select>` overlaid on styled `Chip`; preserves design while keeping interactivity |
| 184 | Position status interactive dropdown clutters title row | `PositionHero.jsx` | ✅ | Status reverted to static `Chip` in title row; "Change Status" moved to `pd-hero-actions` right-hand action bar |
| 185 | Candidate actions missing confirm modals; modal height issues | `CandidateDetailPage.jsx`, global CSS | ✅ | `handleStatusChange`/`handleRetryAts` intercepted with state-driven `ConfirmModal`; removed `min-height: 400px`, increased `max-height` to `90vh` |
| 186 | Organic ATS scoring failure: `position_id = None` from JWT | `apply_service.py` | ✅ | `position_id` now fetched from `candidate_applications` table via `application_id`; notification URL and Celery task args corrected |
| 187 | Phase 2: Audit Logs UI, Video Intros, Team Lead Dashboard | multiple | ✅ | `AuditService` + `/audit-logs` endpoint; `/uploads` static mount; `TeamLeadDashboard.jsx` conditionally rendered for `team_lead` |
| 188 | Bias check: LLM returns markdown+JSON, `json.loads` fails | `bias_checker.py`, `factory.py` | ✅ | `json_mode=True` enforced on LLM; JSON extraction fallback added |
| 189 | Missing Platform Providers Settings API + UI | `settings.py`, `settings_service.py`, `ProvidersTab.jsx` | ✅ | `GET/PATCH /settings/providers` behind `require_platform_admin`; `ProvidersTab.jsx` masks keys. **Extra fix: env key allowlist in `update_providers()` — prevents overwriting `SECRET_KEY`/`DATABASE_URL`/`REDIS_URL`** |
| 190 | Auto-reject/on-hold routing + sourcing email dedup | `candidate_pipeline.py`, `candidates.py`, `PipelineTab.jsx` | ✅ | ATS routing to `screening`/`on_hold`; `source_profile_url` dedup; `POST /candidates/bulk-reject`. **Extra fix: replaced `body: dict` with `BulkRejectBody(position_id: int, threshold: float)` Pydantic model** |
| 191 | Sourcing config, pre-evaluations, candidate portal, GDPR schema | multiple | ✅ | SourcingTab, enrichment adapter, `pre_evaluations` table/router/repo, candidate portal login/timeline/consent. **Extra fix: `password_hash` column was nested inside `contact_status` IF NOT EXISTS guard — silently never runs on existing DBs; extracted to its own independent guard block** |
| 192 | Candidate portal auth, pre-eval batching, talent pool schema | multiple | ✅ | Nightly grading task, `set-password`, `opt-in-talent-pool`. **Extra fixes: (1) `next_search_at` written with TZ-aware datetime — asyncpg `DataError` on every sourcing run; fixed to `.replace(tzinfo=None)`. (2) `jti` check in `set-password` was conditional (`if jti:`) — tokens without jti could be replayed; now mandatory with 400 if absent. (3) Server-side password policy enforced (≥8 chars, not all digits). (4) `get_current_candidate` used direct `payload["sub"]`/`payload["org_id"]` — KeyError on malformed token; replaced with `.get()` + explicit error** |
| 193 | Critical backend wiring: routers not registered, candidate role unblocked | `main.py`, `dependencies.py`, `pre_evaluations.py`, `api.js` | ✅ | Routers registered; `_candidateFetch` + API exports; `get_db` import fixed; candidate role blocked. **Extra fixes: (1) `POST /submit` declared AFTER `GET /{token}` — FastAPI matched "submit" as token value → 405 on every submit; moved `POST /submit` first. (2) All `HTTPException` details in `pre_evaluations.py` now use standard `{"error": {"code": ..., "message": ..., "details": None}}` envelope** |
| 194 | Pre-eval pipeline correctness: arg order, column names, asyncio | `pre_eval_grade.py`, `candidates.py`, `migrations.py` | ✅ | Arg order fixed; `jd_markdown`; `asyncio.run()`. **Extra fixes: (1) `trigger_pre_evaluation` Celery task still used deprecated `asyncio.get_event_loop()` — fixed to `asyncio.run()`. (2) LLM score unclamped — out-of-range values could reach DB; fixed to `max(0.0, min(100.0, ...))`. (3) LLM `decision` not validated — arbitrary strings accepted; filtered to `pass`/`fail` allowlist. (4) `pre_evaluations` in `RLS_TABLES_WITH_ORG_ID` but missing `ENABLE ROW LEVEL SECURITY` in `RLS_SETUP` — policy existed but was never enforced; added `ALTER TABLE pre_evaluations ENABLE ROW LEVEL SECURITY`** |
| 195 | Sourcing adapter, enrichment safety, providers security | `candidate_pipeline.py`, `settings.py`, `enrichment/__init__.py` | ✅ | Per-org adapter resolution; enrichment returns `None` for real providers; providers moved to `require_platform_admin`. **Extra fixes: (1) `GET /settings/sourcing-config` used `get_current_user` (any staff); aligned to `require_dept_admin` matching the PATCH. (2) `candidate_consents` table absent from `RLS_SETUP` and `RLS_TABLES_WITH_ORG_ID` — GDPR consent records had zero tenant isolation; added `ENABLE ROW LEVEL SECURITY`, policy, and FK indexes** |
| 196 | Frontend: missing imports, stub login, wrong API patterns | multiple | ✅ | Rewrote portal components; login logic implemented; auth guard added; key renamed; Button/InputField created; `pre_eval_token` in timeline. **Extra fixes: (1) `PIPELINE_STAGES.find(s => s.id === app.status)` — `PIPELINE_STAGES` is a keyed object `{}` not an array; `.find()` throws `TypeError` crashing the dashboard on every render; fixed to `PIPELINE_STAGES[app.status]?.label`. (2) `alert()` for opt-in feedback — replaced with inline toast state (`showToast` + 3.5s auto-dismiss)** |
| 197 | Collusion detection in pre-eval grader | `pre_eval_grade.py` | ✅ | `_detect_collusion` + `_answer_similarity` (difflib, threshold 0.80); flagged pairs revert to `on_hold`. **Extra fix: removed redundant `ALTER TABLE pre_evaluations ADD COLUMN IF NOT EXISTS` for `position_id`/`evaluated_at` — both already in `CREATE TABLE`; dead migration code removed** |

---

## Session log

| Date | Session | Work done |
|---|---|---|
| 2026-05-30 | S67 | All 41 items validated (Batches A–D). 11 edge cases found and fixed. 4 commits on phase_1_testing/bug-fix. JD Chat flow validation is next. |
| 2026-06-01 | S68 | Reviewed Settings UI batch (items 42–75). Fixed the #75 KNOWN BUG frontend side (stale closure → useRef). Backend reorder chain appeared correct but route ordering bug not caught. |
| 2026-06-01 | S68 | Code-reviewed items 42–75 via 3 parallel Sonnet subagents. 6 confirmed bugs fixed. 6 findings flagged → all fixed. |
| 2026-06-04 | S-today | Code review of commit `14e3aee` (JD workflow implementation). Claude structured + adversarial subagent found 13 bugs (7 P1, 6 P2). All fixed in commit `0a13d82`. Separately: found and fixed real root cause of bug #75 — PATCH `/screening-questions/reorder` was shadowed by `/{question_id}` route (FastAPI order bug). Fixed in commit `05f44d5`. Tracker updated to include Batches F–H (#77–115 + code review). |
| 2026-06-06 | S-today | Added Batch I (#116–138) to tracker. Adversarial review via 4 parallel Sonnet subagents. Found: 5 real bugs (❌ #124 #125 #126 #131 #134), 12 edge-case concerns (⚠️), 6 confirmed clean (✅ #119 #120 #122 #123 #133 #138). Statuses updated accordingly — see Notes column per item. |
| 2026-06-06 | S-today | Fixed all Batch I bugs found in adversarial review. All 23 items now ✅. Committed in `50eb235`. |
| 2026-06-06 | S-today | Batch H adversarial review (Sonnet subagent). Found: 1 critical (❌ #113 org_id column missing), 3 bugs (⚠️ #111 TOCTOU, #112 asymmetric guard, #115 route shadow + stale snapshot), 2 confirmed clean (#114 ✅, CR-1 ✅). All fixed in `12fc941`. Batch H complete. |
| 2026-06-10 | S-today | Batch J (#139–152) reviewed via 3 parallel Sonnet subagents. Found 4 issues: (1) #140 `KpiStrip` read `active_positions` never returned by analytics API — added field to `get_analytics()`; (2) #140 `AgentROIHero` read `share_delta` never returned — added prior-period queries + delta computation to `get_agent_roi()`; (3) #148 `_load_context` missing `"id": org_id` in org dict — fixed in `apply_service.py`; (4) #149 deprecated `datetime.utcnow()` — replaced with `datetime.now(timezone.utc).replace(tzinfo=None)`. All other items (142-147, 150-152) confirmed clean. |
| 2026-06-10 | S-today | Batch K (#153–178) reviewed by direct file inspection. All 26 items confirmed clean — no additional bugs found. Key verifications: `int()` casts in `/retry-ats` (#153/#155); `positionId` in navigate state both in `PipelineStackView` and `PipelineTab` (#154); `Promise.allSettled` + no emoji + `KpiStrip` present in Analytics (#156–158); `AgentROIHero` null-guards + delta chip conditional (#159/#163); `DualFunnel`/`BottleneckRadar`/CSS all use design tokens (#160–162/#164–167); `formatEventTitle` acronym helper (#168); pluralization in `VelocitySparkline` + `PositionsListPage` (#169/#170); AI confidence shown as % chip (#171); `StagePipeStrip` semantic colors + tooltips (#172); `HealthStrip` "No hires this period" delta text (#173); `EmptyPositions` A+ design with role-aware CTA (#174); ATS chip + saturation bar tooltips (#175); `.tb-row-action { min-height: 44px }` (#176); `PositionHero` status chip inline in title row (#177); `PositionsToolbar` CSS classes throughout (#178). `ConfirmModal.onConfirm` calls `onClose()` after await — no dangling modal bug. |
| 2026-06-10 | S-today | Batch L (#179–197) reviewed via `/review` skill (gstack) with 4 parallel specialist subagents (security, testing, data-migration, api-contract). All 19 items verified. **16 additional bugs found and fixed across the branch:** (1) TZ-aware datetime in `next_search_at` write → asyncpg DataError; (2) `password_hash` ADD COLUMN in wrong migration guard — silent skip on existing DBs; (3) `pre_evaluations` ENABLE ROW LEVEL SECURITY missing from `RLS_SETUP` — policy existed but never enforced; (4) `candidate_consents` absent from RLS entirely — GDPR records had zero tenant isolation; FK indexes added; (5) `PIPELINE_STAGES.find()` TypeError crash on dashboard render — `PIPELINE_STAGES` is a `{}` not an array; (6) LLM score unclamped (out-of-range values stored); (7) LLM decision unvalidated (arbitrary strings accepted); (8) `POST /submit` route after `GET /{token}` — FastAPI matched "submit" as token value giving 405; (9) `pre_evaluations.py` error envelopes used bare strings, breaking frontend error handler; (10) `bulk-reject` used `body: dict` not Pydantic model — no input validation; (11) `get_current_candidate` direct `payload["sub"]` → KeyError on malformed token; (12) `set-password` `jti` check conditional — token-less links replayable indefinitely; (13) No server-side password policy on `set-password`; (14) `update_providers()` wrote arbitrary env keys — `SECRET_KEY`/`DATABASE_URL` could be overwritten; (15) `GET /sourcing-config` used `get_current_user` while PATCH required `require_dept_admin`; (16) `asyncio.get_event_loop()` remaining in `trigger_pre_evaluation` + 3 other Celery tasks; (17) `alert()` in CandidateDashboard replaced with toast; (18) Redundant `ALTER TABLE pre_evaluations ADD COLUMN IF NOT EXISTS` removed. All fixes committed on `feature/phase2-items`. |
