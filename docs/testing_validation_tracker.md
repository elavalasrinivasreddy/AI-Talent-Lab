# Phase 1 Testing — Validation Tracker

> Tracks validation of all bug fixes from `bug_fixes_log.md` + JD Chat end-to-end flow.
> Branch: `phase_1_testing/bug-fix`
> Updated: 2026-06-04

Legend: ✅ Validated clean | ⚠️ Fixed edge case | ❌ Not yet validated | 🔄 In progress

---

## Testing position (manual, by user)

User has tested manually up to: **Bug #76 (drag-drop screening questions)**.
Next manual test: **Settings tab bugs #77–91, then JD Chat flow J1–J8**.

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
| 77 | Scorecard Rubric UI & Backend Issues | `SettingsPage.jsx`, backend | ❌ | |
| 78 | Remove shape from P2/P3 phase badges | `SettingsPage.jsx` | ❌ | |
| 79 | Departments Tab confirmation modal & dept head redundancy | `DepartmentsTab.jsx` | ❌ | |
| 80 | Team Directory UI & role filter logic | `TeamTab.jsx` | ❌ | |
| 81 | Approval Rules modernization & org head policies | `ApprovalRulesTab.jsx` | ❌ | |
| 82 | Notifications Tab implementation + logout-on-toggle fix | `NotificationsTab.jsx`, `settings.py` | ❌ | |
| 83 | Organization auto-draft capabilities upgrade | `OrganizationTab.jsx`, backend | ❌ | |
| 84 | Organization Tab UI/UX polish | `OrganizationTab.jsx` | ❌ | |
| 85 | Competitors Intel CRUD + premium accordion UI | `CompetitorsTab.jsx`, backend | ❌ | |
| 86 | Message Templates: magic draft, tone analyzer, live preview | `MessageTemplatesTab.jsx`, `settings.py` | ❌ | |
| 87 | Message Templates: role access, UI cleanup, notifications | `MessageTemplatesTab.jsx`, `settings.py` | ❌ | |
| 88 | Career page implementation + backend 500 fix + scaling | `CareerPage.jsx`, `CareersIndexPage.jsx`, `careers.py` | ❌ | |
| 89 | Email service 500 on hire request creation (`_safe_url` infinite recursion) | `email_service.py` | ❌ | |
| 90 | JD rejection requires mandatory feedback note | `positions.py` (router), `LegacyDashboard.jsx` | ❌ | |
| 91 | Bias checker premium git-diff UI | `FinalJDCard.jsx` | ❌ | |
| 92 | Drag-drop screening questions: stale closure (frontend useRef) | `ScreeningQuestionsTab.jsx` | ⚠️ | Frontend fix correct; **real blocker was backend route order (#75 below)** |
| **75** | **Drag-drop never persisted: PATCH /reorder hit /{question_id} (FastAPI route order bug)** | `settings.py` | ✅ | Fixed 2026-06-04: moved `/reorder` before `/{question_id}` (commit `05f44d5`) |

---

## Batch G — JD Chat Workflow (Items #93–110)

| # | Fix | Files | Status | Notes |
|---|---|---|---|---|
| 93 | Resume Chat starts blank — no JD pre-seeding | `JDTab.jsx`, `ChatContext.jsx`, `ChatPage.jsx` | ❌ | |
| 94 | Internal skills check card skipped when no past JDs found | `internal_analyst.py`, `chat_service.py`, `ChatContext.jsx`, `AgentBlockInternal.jsx` | ❌ | |
| 95 | JD variants refine bar broken on dark theme | `chat.css`, `AgentBlockVariants.jsx` | ❌ | |
| 96 | Bias diff: stale counter, no navigation, stale closure on handlers | `FinalJDCard.jsx` | ❌ | |
| 97 | Dev Admin reset leaving orphaned hire requests | `dev_admin.py` | ❌ | |
| 98 | HireRequestService missing `priority` in position creation | `hire_request_service.py` | ❌ | |
| 99 | JD chat not read-only during pending approval | `ChatContext.jsx`, `FinalizeCTA.jsx`, `ChatTopBar.jsx` | ❌ | |
| 100 | Position detail: duplicate approval banners | `PositionHero.jsx` | ❌ | |
| 101 | "Request Changes" broken — wrong decision value + no notes input | `JDTab.jsx` | ❌ | |
| 102 | Team lead feedback notes not visible after changes requested | `migrations.py`, `position_service.py`, `JDTab.jsx` | ❌ | |
| 103 | JD canvas text color inconsistent after AI update | `chat.css` | ❌ | |
| 104 | Bias check not re-triggered after AI update; Finalize not gated | `FinalJDCard.jsx` | ❌ | |
| 105 | Settings page scrolls vertically; no-right-rail no CSS | `layout.css`, `settings.css`, `SettingsPage.jsx` | ❌ | |
| 106 | JD chat shows `alert()` instead of Toast | `MessageInput.jsx` | ❌ | |
| 107 | "New Hire" sidebar shows `window.confirm` dialog | `Sidebar.jsx` | ❌ | |
| 108 | "New Hire" shows old session messages instead of greeting | `ChatContext.jsx` | ❌ | |
| 109 | Resume AI Chat auto-fires after session deleted | `JDTab.jsx` | ❌ | |
| 110 | GET pipeline-summary 500: text ->> unknown (missing ::jsonb cast) | `positions.py` (router) | ❌ | |

---

## Batch H — JD Workflow State Machine (Items #111–115 + Code Review)

| # | Fix | Files | Status | Notes |
|---|---|---|---|---|
| 111 | JD workflow Design Rev 4: DB migrations + repo + service + router | `migrations.py`, `hire_requests.py`, `positions.py`, `hire_request_service.py`, `position_service.py`, `hire_requests.py` (router) | ❌ | 14 new DB columns, CAS pickup, admin_reviewing lock |
| 112 | Transition guard mismatches — state machine | `hire_requests.py` (repo), `hire_request_service.py` | ❌ | |
| 113 | Idempotent feedback injection into chat sessions | `position_service.py` | ❌ | |
| 114 | Celery periodic task — stale review lock cleanup | `hire_request_locks.py`, `celery_app.py` | ❌ | |
| 115 | Full 25-item JD workflow implementation (frontend + backend) | `positions.py`, `position_service.py`, `positions.py` (router), `ChatContext.jsx`, `MessageList.jsx`, `SidebarSessions.jsx`, `chat.css`, `sessions.py` | ❌ | |
| CR-1 | 13 race conditions + permission bypasses fixed (code review 2026-06-04) | `position_service.py`, `positions.py` (repo), `positions.py` (router) | ❌ | commit `0a13d82` — atomic submit, auto-approve fix, Flow 1 reviewer, NULL reviewer bypass, TOCTOU guards |

---

## Session log

| Date | Session | Work done |
|---|---|---|
| 2026-05-30 | S67 | All 41 items validated (Batches A–D). 11 edge cases found and fixed. 4 commits on phase_1_testing/bug-fix. JD Chat flow validation is next. |
| 2026-06-01 | S68 | Reviewed Settings UI batch (items 42–75). Fixed the #75 KNOWN BUG frontend side (stale closure → useRef). Backend reorder chain appeared correct but route ordering bug not caught. |
| 2026-06-01 | S68 | Code-reviewed items 42–75 via 3 parallel Sonnet subagents. 6 confirmed bugs fixed. 6 findings flagged → all fixed. |
| 2026-06-04 | S-today | Code review of commit `14e3aee` (JD workflow implementation). Claude structured + adversarial subagent found 13 bugs (7 P1, 6 P2). All fixed in commit `0a13d82`. Separately: found and fixed real root cause of bug #75 — PATCH `/screening-questions/reorder` was shadowed by `/{question_id}` route (FastAPI order bug). Fixed in commit `05f44d5`. Tracker updated to include Batches F–H (#77–115 + code review). |
