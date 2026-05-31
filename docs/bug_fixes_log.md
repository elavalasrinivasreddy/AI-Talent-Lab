# Bug Fixes & Adjustments Log

This document tracks all ad-hoc bug fixes, minor updates, and behavioral changes made during the testing phase. It includes the problem statement, the solution implemented, and the affected file paths.

---

## 1. Dev Console: True Global Reset

**Problem Statement:** 
In the Dev Console's "Global Mode" (no organization selected), clicking the reset buttons only deleted operational data (applications, positions, chat sessions). However, organizations, users, and departments were intentionally preserved. This made it impossible to completely wipe the database and start fresh for rigorous end-to-end testing without manual SQL intervention.

**Idea / Solution:** 
Updated the `reset_all_org_data` endpoint in the developer tools router. When `org_id` is passed as `None` (Global Mode), the endpoint now executes `TRUNCATE TABLE organizations CASCADE`. Because every business data table in the system is linked to `organizations` via foreign keys (as per project rules), the `CASCADE` command safely and instantly wipes **all** tables, giving the developer a completely blank slate. 

**Files Modified:**
- `backend/routers/dev_admin.py` (Lines 272-296)
- `frontend/src/components/DevAdmin/DevAdminPage.jsx` (Modified in prior step to allow global trigger)

---

## 2. FastAPI Deprecation Warnings

**Problem Statement:**
The terminal was outputting `FastAPIDeprecationWarning: regex has been deprecated, please use pattern instead` during server startup and when hitting the dashboard endpoints.

**Idea / Solution:**
Updated the FastAPI `Query` parameter syntax in the dashboard router to use the modern `pattern=` keyword argument instead of the deprecated `regex=` argument.

**Files Modified:**
- `backend/routers/dashboard.py` (Lines 42 & 108)

---

## 3. Dev Console: Org Dropdown Not Refreshing After Global Reset

**Problem Statement:**
After executing a true global wipe from the Dev Console, the database successfully cleared all tables. However, the organization dropdown at the top right of the Dev Console still displayed the list of old companies.

**Idea / Solution:**
The frontend was only fetching the updated row counts (`loadStats()`) after a reset but was failing to refetch the organizations (`loadOrgs()`). Updated `handleReset` in the React component to await a fresh fetch of organizations immediately after a reset, keeping the frontend state perfectly synced with the wiped database.

**Files Modified:**
- `frontend/src/components/DevAdmin/DevAdminPage.jsx` (Line 106)

---

## 4. Settings Page Crash (ReferenceError: disabled is not defined)

**Problem Statement:**
Navigating to the Settings page threw a fatal React error: `ReferenceError: disabled is not defined`. This crashed the entire page rendering, displaying the Vite ErrorBoundary overlay.

**Idea / Solution:**
In the left-rail rendering loop of `SettingsPage.jsx`, a stray check for `{disabled && ...}` was attempting to render a lock icon. Because it wasn't scoping to the mapped object (`item.disabled`), it threw a reference error. Updated the variable to correctly point to `item.disabled`.

**Files Modified:**
- `frontend/src/components/Settings/SettingsPage.jsx` (Line 184)

---

## 5. Remove "General" Default Department

**Problem Statement:**
When a new organization registered, a default "General" department was automatically seeded. This forced users to delete it if it didn't fit their structure, as new orgs should start with a clean slate.

**Idea / Solution:**
Removed the default department creation step from the org seeding logic in the backend. New organizations now start with exactly zero departments.

**Files Modified:**
- `backend/services/settings_service.py`

---

## 6. Team Members UX Improvements & Pending Status

**Problem Statement:**
The Team members table had UI inconsistencies: The current user's role was rendered as raw text instead of a dropdown, the "Add User" modal was over-engineered with a password toggle, and invited users who hadn't accepted their invites yet falsely showed as "Active".

**Idea / Solution:**
1. Unified the Role column to always use a standard `<select>` (disabled for the current user) for better visual consistency.
2. Simplified the Add Member modal to only use the "Send Invite Email" flow, removing the password toggle.
3. Exposed `last_login_at` from the database. If a user has been invited but has never logged in, their status badge now cleanly displays as `⏳ Pending`.

**Files Modified:**
- `backend/db/repositories/users.py`
- `backend/routers/auth.py`
- `backend/services/auth_service.py`
- `frontend/src/components/Settings/tabs/TeamTab.jsx`


---

## 7. Crash in users.py during User Registration / Invite

**Problem Statement:**
When creating a new user or registering a new organization, the backend crashed at line 34 of `users.py`. This occurred because the `last_login_at` column (which was added to the `RETURNING` clause to enable "Pending" status for invites) was missing from existing local databases, throwing an `UndefinedColumnError`. 

**Idea / Solution:**
Added an incremental SQL migration (`ALTER TABLE ... ADD COLUMN`) for `last_login_at`, `failed_login_attempts`, and `locked_until` in `db/migrations.py`. This ensures that existing local databases automatically get the new columns on server startup without requiring a full database wipe. Additionally, added a safety check in `UserRepository.create` to raise a descriptive error if `conn.fetchrow` returns nothing.

**Files Modified:**
- `backend/db/migrations.py`
- `backend/db/repositories/users.py`

---

## 8. Hide Current User in Team Directory & Fix Registration Login State

**Problem Statement:**
The "Team Members" directory was displaying the current logged-in user, which is generally bad UX (users shouldn't accidentally deactivate themselves or edit their own role from a team management table; this belongs in a personal profile). Additionally, newly registered organization heads were showing up as "Pending" because their `last_login_at` timestamp wasn't being set during the initial registration automatic login.

**Idea / Solution:**
1. Filtered out the `currentUser` from the users array in `TeamTab.jsx` before rendering the table, effectively hiding the logged-in user from the Team directory.
2. Modified `AuthService.register` to explicitly call `UserRepository.reset_login_state` right after user creation, correctly setting their initial `last_login_at` timestamp.

**Files Modified:**
- `frontend/src/components/Settings/tabs/TeamTab.jsx`
- `backend/services/auth_service.py`

---

## 9. Implement Strict RBAC for Team Management & UI Polishing

**Problem Statement:**
Department Admins were encountering an error when trying to add HRs, as the endpoint required `org_head` privileges. Additionally, `dept_admin` users could see the "Org Head" profile in their team list, which should be hidden. Lastly, the Active/Inactive status toggle UI used crude buttons instead of a polished visual component.

**Idea / Solution:**
1. **Backend RBAC:** Changed the `/users`, `/add-user`, and `/users/{user_id}` endpoints in `backend/routers/auth.py` to use `require_dept_admin`. Enforced strict boundary logic: `dept_admin` cannot modify or elevate users to `org_head` or `dept_admin`, and can only assign/modify users within their own department.
2. **Frontend RBAC & Visibility:** 
   - Hid the `Departments` settings tab from `dept_admin` (only visible to `org_head`).
   - Hid `Team Members` and `Departments` completely from `hr` and `team_lead`.
   - In `TeamTab.jsx`, restricted the dropdown options so a `dept_admin` can only add HRs and Team Leads to their own department. Filtered the users list so `dept_admin` only sees downstream roles within their own department.
3. **UI Polish & Data Integrity:** 
   - Replaced the ugly status toggle buttons in the team directory with the standard `Chip` component, utilizing hover effects and tooltips for better UX.
   - Removed the inline dropdowns (`<select>`) for Role and Department in the Team Directory table. These are now immutable once a user is invited (rendered as static text). This prevents accidental or invalid reassignment and enforces a cleaner UX pattern where mistakes are corrected by deactivating and re-inviting.
   - **Enhanced Search & Filtering:** Replaced the basic search bar with a modern flexbox row. Added `roleFilter` (available to both `org_head` and `dept_admin`, but respecting role hierarchy limits) and `deptFilter` (available exclusively to `org_head` to search across the entire org). Wrapped the search input in an `Icon` wrapper to match modern SaaS standards.

**Files Modified:**
- `backend/routers/auth.py`
- `frontend/src/components/Settings/SettingsPage.jsx`
- `frontend/src/components/Settings/tabs/TeamTab.jsx`

---

## 10. Industry Standard RBAC for Compliance & Global Settings

**Problem Statement:**
Lower-level roles (Hiring Managers and Recruiters) were able to access the "Data Policies" (GDPR/DPDP) and "Security" sections in Settings. They could also see global organizational profile setups and competitor intelligence. In B2B SaaS, this is non-standard; compliance and global metadata should be restricted to administrators.

**Idea / Solution:**
Reverted the `adminOnly` access controls on `privacy`, `security`, `organization`, and `competitors` in `SettingsPage.jsx`. Only `org_head` and `dept_admin` roles can now access these global/sensitive tabs.

**Files Modified:**
- `frontend/src/components/Settings/SettingsPage.jsx`

---

## 11. Auto-Approval Rules Workflow for Dept Admin and HM

**Problem Statement:**
The platform lacked a way for Department Admins to configure auto-approval for incoming Hire Requests, and for Hiring Managers to auto-approve generated Job Descriptions. These were defined in the workflow but missing from the UI.

**Idea / Solution:**
Replaced the placeholder "Approval rules" tab with a fully functional `ApprovalRulesTab.jsx`.
1. **Dept Admins / Org Heads** can toggle "Auto-Approve Hire Requests" (skips manual review, sends straight to HR).
2. **Hiring Managers (Team Leads)** can toggle "Auto-Approve Final JDs" (bypasses HM review, automatically opens the position after HR generation).
Adjusted `SettingsPage.jsx` to ensure `team_lead` can view this tab.

**Files Modified:**
- `frontend/src/components/Settings/SettingsPage.jsx`
- `frontend/src/components/Settings/tabs/ApprovalRulesTab.jsx`

---

## 12. Hire Request Empty State Button Redundancy & Form Layout

**Problem Statement:**
On the Hire Requests page, when there were zero requests, both the header's "New request" button and the Empty State's large CTA were visible simultaneously, creating redundancy. Additionally, the Hire Request creation form was a single monolithic block, which didn't look premium.

**Idea / Solution:**
1. Conditionally hid the header "New request" button in `HireRequestListPage.jsx` if the request list is empty, forcing the user to use the primary CTA in the empty state.
2. Redesigned `HireRequestForm.jsx` from a single section into a premium, card-based CSS grid (Role Basics, Logistics & Compensation, Requirements & Scope) with better helper text.

**Files Modified:**
- `frontend/src/components/HireRequests/HireRequestListPage.jsx`
- `frontend/src/components/HireRequests/HireRequestForm.jsx`

---

## 13. JSX Syntax Fix in PrivacyTab.jsx

**Problem Statement:**
`PrivacyTab.jsx` threw an "Unterminated JSX contents" error during build because an outer wrapper `div` in the Quick Stats section wasn't closed properly after adding conditional `{isAdmin &&` rendering.

**Idea / Solution:**
Added the missing closing `</div>` tag immediately before the `)}` expression for the Quick Stats section.

**Files Modified:**
- `frontend/src/components/Settings/tabs/PrivacyTab.jsx`

---

## 14. Approval Rules UI Redesign & Toggle Switch Fix

**Problem Statement:**
The `ApprovalRulesTab.jsx` had a redundant top title/description, overly verbose explanations in the cards, and the toggle buttons were rendering as native HTML checkboxes because the `.st-toggle` CSS classes did not exist in the codebase.

**Idea / Solution:**
1. Appended the full CSS implementation for `.st-toggle` and `.st-slider` to `settings.css` to properly render animated, SaaS-style toggle switches.
2. Removed the redundant top header from `ApprovalRulesTab.jsx`.
3. Shortened and refined the descriptive text for both Approval rules to be more concise and role-appropriate.

**Files Modified:**
- `frontend/src/styles/settings.css`
- `frontend/src/components/Settings/tabs/ApprovalRulesTab.jsx`

---

## 15. HR / Team Lead Department Scoping in Hire Requests

**Problem Statement:**
When HR members viewed the Hire Requests list, they saw requests across the entire organization instead of just their assigned department. Similarly, when a Team Lead submitted a new Hire Request, they were presented with a department dropdown allowing them to improperly submit requests for departments other than their own.

**Idea / Solution:**
1. Modified `list_for_user` in `backend/services/hire_request_service.py` to ensure that when `role == "hr"`, the list is automatically filtered by the HR user's `department_id`.
2. Wrapped the Department select input in `HireRequestForm.jsx` with a check for `user?.role === 'org_head'`, ensuring that Team Leads (and other non-org-head roles) cannot change the department.
3. Updated the default state for `department_id` in `HireRequestForm.jsx` to parse `user?.department_id ?? user?.dept_id` to guarantee it safely populates in the background during submission.

**Files Modified:**
- `backend/services/hire_request_service.py`
- `frontend/src/components/HireRequests/HireRequestForm.jsx`

---

## 16. Hire Request Service Record Attribute Error & HR Subtitle Text

**Problem Statement:**
An `AttributeError` ("'Record' object has no attribute 'get'") occurred in `hire_request_service.py` at lines 304 & 305 when trying to extract the raiser and department name from the asyncpg `Record` returned by the repository. Additionally, the subtitle in the HR Hire Requests page still incorrectly stated "Requests filed across the org" instead of reflecting the new department-scoped behavior.

**Idea / Solution:**
1. Fixed the `Record` unpacking by wrapping the result in `dict(req) if req else {}` inside `_notify_approvers_on_create`.
2. Proactively applied `dict(row)` to the return value of `HireRequestService.get()` to ensure downstream callers can safely use standard `.get()` dictionary methods on the request object.
3. Updated the subtitle in `HireRequestListPage.jsx` so that only `org_head` sees the "across the org" messaging; HR and Department Admins now see "Requests filed in your department".

**Files Modified:**
- `backend/services/hire_request_service.py`
- `frontend/src/components/HireRequests/HireRequestListPage.jsx`

---

## 17. Implement Auto-Approval Backend Business Logic

**Problem Statement:**
While the settings UI and database schema supported toggling `auto_approve_hire_requests` (for Department Admins) and `auto_approve_jds` (for Hiring Managers), the underlying business logic in the backend was not executing these flags. Both request creation and JD generation pipelines were still strictly adhering to the manual review process.

**Idea / Solution:**
1. Integrated `auto_approve_hire_requests` into `HireRequestService.create()`. If the department flag is enabled, the request immediately transitions to `approved`, creates a special audit log entry, and alerts HR directly instead of sending an approval email to the Dept Admin. Modified the underlying `approve` repository method to accept `Optional[int]` for `approved_by` to accommodate the system's auto-approval.
2. Integrated `auto_approve_jds` into `PositionService.submit_for_approval()`. When HR submits a finalized JD, the system looks up the `hire_request` associated with the position and checks if the requesting team lead has JD auto-approval enabled. If they do, it immediately records the decision as "approved" (triggering the Celery background sourcing tasks) and skips the manual review loop.

**Files Modified:**
- `backend/services/hire_request_service.py`
- `backend/db/repositories/hire_requests.py`
- `backend/services/position_service.py`

---

## 18. Fix Linter Warnings and Vite API Import Path

**Problem Statement:**
The static analyzer flagged `is_auto_approved` and `created` as possibly unbound in `hire_request_service.py`, and `is_auto_approved`, `auto_approve_user_id`, etc., as possibly unbound in `position_service.py` due to being initialized inside `async with` blocks. Additionally, a Vite import error broke `ApprovalRulesTab.jsx` because it imported the `api` instance from `services/api` instead of `utils/api`.

**Idea / Solution:**
1. Initialized all required variables to default states (`False`, `None`) before entering the `async with` connection/transaction blocks in both backend service files to satisfy strict Python type checking.
2. Corrected the relative import path in `ApprovalRulesTab.jsx` from `../../../services/api` to `../../../utils/api`.

**Files Modified:**
- `backend/services/hire_request_service.py`
- `backend/services/position_service.py`
- `frontend/src/components/Settings/tabs/ApprovalRulesTab.jsx`

---
### 19. Removed Unsupported Toast Import
**Symptom:** Vite build failed complaining about missing `react-hot-toast` dependency in `ApprovalRulesTab.jsx`.
**Root Cause:** The project does not have `react-hot-toast` installed in `package.json`, and it was mistakenly added to the new component.
**Fix:** Removed the `import { toast } from 'react-hot-toast'` and replaced error notifications with native `alert()`.

---
### 20. Corrected Approval Rules Visibility for Dept Admins
**Symptom:** Department Admins were seeing two toggles in the Approval Rules tab ("Auto-Approve Hire Requests" and "Auto-Approve Final JDs").
**Root Cause:** The Final JD auto-approve logic used `(isHM || isDeptAdmin)` which incorrectly exposed the Team Lead-specific setting to Department Admins.
**Fix:** Modified `ApprovalRulesTab.jsx` to restrict the "Auto-Approve Final JDs" toggle exclusively to `isHM` (Team Leads). Department Admins now correctly see only the "Auto-Approve Hire Requests" toggle.

---
### 21. Fixed Unfiled Hire Request Showing Step-1 as Done
**Symptom:** When a Hiring Manager opened the "New Hire Request" page, the progress relay visualizer incorrectly showed Step-1 ("Filed") as completed before the form was even submitted.
**Root Cause:** The `HireRequestForm.jsx` passed a mock request with `status: 'pending'` to the visualizer. In the system logic, `pending` means the request is successfully filed and awaiting Dept Admin approval (i.e., Step-1 is done, Step-2 is active).
**Fix:** Introduced a conceptual `draft` status in `helpers.js` that maps to Step-1 being the `current` state, and passed this `draft` status from the form when `existing` data is null.

---
### 22. Enforced Org Head Exclusivity for Organization Profile
**Symptom:** The "Organization Profile" settings tab (managing global culture, benefits, and branding) was accessible to Department Admins.
**Root Cause:** The `SettingsPage.jsx` UI routing had `adminOnly: true` on the `organization` tab, which allowed both Org Heads and Department Admins to access it.
**Fix:** Updated the frontend rail config for `organization` from `adminOnly: true` to `orgHeadOnly: true`. Competitor intel was intentionally kept as `adminOnly: true` so both Org Heads and Dept Admins can contribute department-specific competitors to the global organizational pool.
---
### 23. Department-Scoped Competitor Intelligence
**Symptom:** Competitor intelligence was previously scoped globally per organization, but the product required maintaining competitors specific to each department (limit 3 per department) with strict visibility boundaries.
**Root Cause:** The `competitors` table and corresponding settings logic relied solely on `org_id`. The frontend `CompetitorsTab` simply listed all competitors without department boundaries.
**Fix:** 
- Added `department_id` to the `competitors` table in database schema.
- Updated the backend `SettingsService` and `/api/v1/settings/competitors` endpoints to enforce a limit of 3 competitors per department.
- Implemented automated cross-role notifications (Dept Admin adds competitor -> Org Head notified, and vice versa).
- Redesigned `CompetitorsTab.jsx` frontend: Org Heads now see competitors grouped by department (with a dropdown to add), while Dept Admins only see and manage competitors strictly within their assigned department.

---
### 24. Fixed Approval Rules Toggle Error for Dept Admins
**Symptom:** Department Admins received a "Failed to update rule" popup when attempting to toggle the "Auto-Approve Hire Requests" setting.
**Root Cause:** The `PATCH /api/v1/settings/departments/{id}` endpoint relied on the `DepartmentUpdate` Pydantic model, which was missing the `auto_approve_hire_requests` field, causing the API to reject the payload.
**Fix:** Added `auto_approve_hire_requests: Optional[bool] = None` to the `DepartmentUpdate` schema in `backend/models/settings.py`.

---
### 25. Redesigned Culture Keywords Chip UI
**Symptom:** The "Culture Keywords" input in the Organization Profile page used a basic text design, leading to a subpar user experience.
**Root Cause:** The `.tag-input-container` and `.tag` classes were unstyled placeholders.
**Fix:** Refactored the UI in `OrganizationTab.jsx` to use a premium chip design system. Applied inline styles utilizing standard CSS variables (`var(--color-primary-bg)`, `var(--radius-md)`, etc.) to present keywords as distinct, rounded tags with hover-enabled delete buttons and seamless input integration.

---
### 26. Fixed Internal Server Error on Competitor Creation
**Symptom:** Adding a new competitor resulted in an unhandled 500 Internal Server Error due to a `TypeError` regarding `NotificationRepository.create()`.
**Root Cause:** The `SettingsService` was invoking `NotificationRepository.create()` using positional arguments, whereas the repository method expects a single `data: dict` argument containing the payload.
**Fix:** Updated `SettingsService.create_competitor` and `SettingsService.delete_competitor` to pass a correctly formatted dictionary to the `NotificationRepository.create()` function, resolving the 500 error.

---
## 27. Settings API KeyErrors and JSON Deserialization

**Problem Statement:**
When adding a competitor as an Org Head, the API crashed with `KeyError: 'department_id'` because it attempted to access a key absent from the user object payload. Additionally, accessing the AI Behavior settings crashed with `ValueError: dictionary update sequence element #0 has length 1` because the database value was fetched as a stringified JSON instead of a raw dictionary.

**Idea / Solution:**
Updated the user property access in `backend/routers/settings.py` to correctly extract `.get("dept_id")`, matching the JWT claims format in `backend/dependencies.py`. Updated `backend/services/settings_service.py` to defend against raw JSON strings by checking `isinstance(row["settings"], str)` and using `json.loads` if needed.

**Files Modified:**
- `backend/routers/settings.py`
- `backend/services/settings_service.py`

---

## 28. Settings Service NoneType and Unpacking Errors

**Problem Statement:**
Errors occurred in `settings_service.py` across several lines:
1. Lines 230, 240, 253: A `TypeError` (`'NoneType' object is not subscriptable`) could occur when checking `creator["role"]` or accessing `creator["name"]` because the database fetch can return `None`.
2. Lines 493, 534: Type-checking and runtime unpacking errors occurred when using `**kwargs` unpacking (`**q` and `**t`) to pass dictionary items into strict repository create methods (`ScreeningQuestionRepository.create` and `MessageTemplateRepository.create`).

**Idea / Solution:**
1. Added safety checks for the `creator` object (`if creator and creator.get("role") == ...`) and gracefully extracted the user's name (`creator["name"] if creator else "System"`).
2. Replaced the `**kwargs` unpacking with explicit keyword assignments (e.g. `field_key=str(q["field_key"])`) and proper fallback logic (`q.get("is_required", False)`), satisfying the strict type-checking constraints.

**Files Modified:**
- `backend/services/settings_service.py`

---

## 29. Notification Bell Rendering Issue (Cut Off / Missing Background)

**Problem Statement:**
The Notifications drawer (which slides in from the right) appeared cut off vertically and its background was missing below the top header. Because the `<NotificationBell />` was rendered inside `.app-topbar` (which has a `backdrop-filter: blur()`), the topbar established a new containing block for `position: fixed` elements. Since the topbar is only 52px high, the drawer's height was restricted to 52px, causing the background to end abruptly and contents to clip visually.

**Idea / Solution:**
Imported `createPortal` from `react-dom` in `NotificationBell.jsx` and wrapped the rendering of the drawer and backdrop so that they mount directly into `document.body`. This escapes the CSS containing block created by the topbar's `backdrop-filter` and allows the drawer to correctly span 100% of the viewport height.

**Files Modified:**
- `frontend/src/components/common/NotificationBell.jsx`

---

## 30. Notification Banner Premium UI/UX Redesign

**Problem Statement:**
The notification banner and drawer UI felt basic and lacked the premium aesthetic expected of a modern AI SaaS application. It needed visual polish, better depth, micro-interactions, and refined typography.

**Idea / Solution:**
Redesigned the `NotificationBell.css` with a premium dark-glassmorphism aesthetic:
- **Depth & Materials:** Added deep transparent dark backgrounds with high-saturation blur (`backdrop-filter: blur(24px) saturate(1.5)`).
- **Typography & Gradients:** Introduced gradient text for the header and a gradient background for the unread banner, along with a pulsing subtle animation for the bell icon.
- **Micro-interactions:** Added a smooth `translateX(4px)` hover state with cubic-bezier transitions on notification items, and rotating hover effects for close buttons.
- **Unread States:** Improved the unread dot with a glowing drop-shadow and a prominent left-border indicator.
- Updated `NotificationBell.jsx` to inject a bell icon alongside the unread count in the banner.

**Files Modified:**
- `frontend/src/components/common/NotificationBell.jsx`
- `frontend/src/components/common/NotificationBell.css`

---

## 31. Notification Timestamp Timezone Issue

**Problem Statement:**
The "time ago" calculation for notifications in the UI was incorrect. For example, a notification created 2 minutes ago displayed as "5h ago" for a user in the IST (+05:30) timezone. This occurred because the backend API returns naive datetime strings representing UTC (e.g., `2026-05-30T13:52:23`), which the frontend's `new Date()` incorrectly parsed as local time.

**Idea / Solution:**
Updated the `timeAgo` function in `NotificationBell.jsx` to append a `Z` suffix to the timestamp string if it lacks explicit timezone information (e.g., `Z` or `+`). This forces the JavaScript Date parser to correctly interpret the backend's naive string as UTC, resulting in an accurate local time difference.

**Files Modified:**
- `frontend/src/components/common/NotificationBell.jsx`

---

## 32. Cleanup of Duplicate Pydantic Fields and Code Formatting

**Problem Statement:**
There were duplicate field definitions for `auto_approve_hire_requests` in the `DepartmentCreate` and `DepartmentResponse` schemas within `backend/models/settings.py` (both `Optional[bool] = None` and `bool = False` were present). Additionally, there were minor whitespace and alignment formatting inconsistencies in the frontend hire request components.

**Idea / Solution:**
Removed the duplicate `Optional[bool] = None` definitions from the Pydantic models in `backend/models/settings.py` to ensure only the correctly typed and defaulted `bool = False` definition remains. Applied code formatting and whitespace cleanup to `frontend/src/components/HireRequests/HireRequestForm.jsx` and `frontend/src/components/HireRequests/helpers.js` to adhere to standard code style.

**Files Modified:**
- `backend/models/settings.py`
- `frontend/src/components/HireRequests/HireRequestForm.jsx`
- `frontend/src/components/HireRequests/helpers.js`

---

## 33. Notification Navigation Routing

**Problem Statement:**
When users clicked on a notification (e.g. for a new hire request or a new competitor), it was only being marked as read in the UI but did not actually navigate the user to the corresponding page. The industry standard expectation is that clicking a notification acts as a deep link to the relevant action or entity.

**Idea / Solution:**
Updated `NotificationBell.jsx` to import and utilize `useNavigate` from `react-router-dom`. Modified the notification item's `onClick` handler to check if an `action_url` is provided in the notification payload. If it exists, the app now closes the notification drawer and routes the user directly to the target page, while still marking the notification as read.

**Files Modified:**
- `frontend/src/components/common/NotificationBell.jsx`

---

## 34. Department Admin Hire Request Badge Leaking Org-wide Count

**Problem Statement:**
The "Hire Requests" sidebar badge was displaying the count of *all* pending and approved hire requests across the entire organization, even for Department Admins who are only supposed to manage their own department. For example, a Marketing Admin was seeing a badge count for a request raised in Engineering, causing confusion.

**Idea / Solution:**
Updated the `/pending-count` backend endpoint to be fully role and department aware. 
- Modified `HireRequestRepository.count_pending_for_org` into a more generic `count_pending` that accepts optional `department_id` and `status` filters.
- Added `get_pending_count_for_user` in `HireRequestService` that mimics the role-based scoping in the list view (e.g., Department Admins only see `pending` requests for their `department_id`, HR only sees `approved` requests for their department or org, etc.).
- Wired the router to call this new service method.

**Files Modified:**
- `backend/db/repositories/hire_requests.py`
- `backend/services/hire_request_service.py`
- `backend/routers/hire_requests.py`

---

## 35. Timezone Issue Showing Incorrect "Time Ago" (e.g., "5h ago")

**Problem Statement:**
Whenever the application displayed a relative time using a `timeAgo` function (such as in Hire Request cards, notifications, the legacy dashboard, etc.), the time displayed was incorrect (e.g., showing "5h ago" instead of "just now"). This occurred because the backend outputs naive UTC timestamp strings (e.g., `2026-05-30T13:52:23`), which the frontend browser interpreted as the user's *local* timezone, leading to a massive offset. Additionally, there were 6 separate duplicated implementations of `timeAgo` scattered across different components.

**Idea / Solution:**
1. Created a shared `date.js` utility in `frontend/src/utils/` containing a robust `timeAgo` function. This function automatically detects naive timestamp strings and appends a `'Z'` to force the browser's `new Date()` to parse them as UTC.
2. Refactored all duplicate `timeAgo` instances across the app to import and use the new shared utility.
3. Updated `daysOpen` in `PositionCard.jsx` to apply the same `'Z'` appending logic.

**Files Modified:**
- `frontend/src/utils/date.js` (created)
- `frontend/src/components/HireRequests/helpers.js`
- `frontend/src/components/Dashboard/legacy/LegacyDashboard.jsx`
- `frontend/src/components/Dashboard/BriefingRow.jsx`
- `frontend/src/components/Platform/PlatformPage.jsx`
- `frontend/src/components/common/NotificationBell.jsx`
- `frontend/src/components/Positions/PositionCard.jsx`

---

## 36. Remove Operational "Hire Requests" Scope from Org Head

**Problem Statement:**
The `org_head` role was seeing a massive badge count for all pending and approved hire requests across the organization. Since the Org Head is an oversight role and doesn't participate in the operational friction of individual hire request approvals (which are handled by Dept Admins and HR), the "Hire Requests" tab and its notification badge were creating unnecessary noise and fatigue.

**Idea / Solution:**
- Completely removed the `org_head` from the `roles` array for the "Hire Requests" navigation item in the Sidebar.
- Removed `org_head` from the badge polling logic.
- Logged a planned enhancement in `docs/ENHANCEMENTS_IDEAS.md` to build an Analytics Dashboard for the Org Head that will summarize hiring velocity, bottlenecks, and rejection insights instead of showing a list of tickets.

**Files Modified:**
- `frontend/src/components/Sidebar/Sidebar.jsx`
- `docs/ENHANCEMENTS_IDEAS.md` (created)

---

## 37. Missing Deep Links in Competitor Notifications

**Problem Statement:**
When a competitor was added or removed, the notification generated in the backend did not include an `action_url`. This meant that when users clicked on a competitor-related notification in the UI bell drawer, it was marked as read but did not actually navigate them to the Competitors tab in the settings page.

**Idea / Solution:**
Added `"action_url": "/settings?tab=competitors"` to the notification payload dictionary in the four places where competitor notifications are dispatched (org head / dept admin for addition/removal). Now, clicking the notification properly deep-links the user to the Settings page with the Competitors tab active.

**Files Modified:**
- `backend/services/settings_service.py`

---

## 38. Department Admin Unable to Update Settings/Competitors

**Problem Statement:**
When a Department Admin tried to toggle the "Auto-Approve New Hire Requests" setting on their department, or delete a competitor, the backend raised a 403 Forbidden error stating "You can only modify your own department". This occurred because the `user` dependency dictionary decoded from the JWT token uses the key `"dept_id"`, but the router endpoints were checking `user.get("department_id")`. This evaluated to `None` and falsely triggered the permission check failure.

**Idea / Solution:**
Fixed the dictionary key references in `backend/routers/settings.py` to correctly use `user.get("dept_id")` for both updating departments and deleting competitors. This correctly validates the Department Admin's scope and allows them to perform these actions successfully.

**Files Modified:**
- `backend/routers/settings.py`

---

## 39. Missing / Empty Filter Tabs in Hire Requests for HR & Dept Admin

**Problem Statement:**
When HR navigated to the Hire Requests page, they saw a "Pending pickup" tab that was filtering for `status: 'pending'`. However, `pending` means waiting for Department Admin approval. HR handles requests that are `status: 'approved'`. Thus, the list was always empty for HR despite having a notification badge. Furthermore, Department Admins were missing the `Pending approval` tab and other global tabs altogether in the UI.

**Idea / Solution:**
Refactored the `FILTERS` constant in `HireRequestListPage.jsx`. Split the queue into `queue_approval` (status: pending, visible to dept_admin) and `queue_pickup` (status: approved, visible to hr). Also expanded the visibility of general tabs (In progress, Fulfilled, Cancelled, All) to `dept_admin` so they have full visibility into their department's pipeline.

**Files Modified:**
- `frontend/src/components/HireRequests/HireRequestListPage.jsx`

---

## 40. Department Admin Forbidden from Listing Hire Requests

**Problem Statement:**
When a Department Admin navigated to the Hire Requests page and clicked on any tab (e.g., "Pending approval", "All", "In progress"), they received an error: "Only admins or recruiters can list all hire requests." This happened because the frontend was sending the query parameter `scope=all`. The backend strictly protects the `scope=all` query (which bypasses department isolation and fetches the whole organization) and restricts it to `org_head` and `hr` only.

**Idea / Solution:**
Updated the filter tabs in `frontend/src/components/HireRequests/HireRequestListPage.jsx` to pass `scope: 'default'` instead of `scope: 'all'`. The backend's `default` scope inherently handles department isolation, allowing a Department Admin to safely view "all" requests *within their own department* without triggering the unauthorized global search block.

**Files Modified:**
- `frontend/src/components/HireRequests/HireRequestListPage.jsx`

---

## 41. Hire Request Missing from "All" Tab & Missing "Resume JD Chat" Button

**Problem Statement:**
1. When HR clicked on the "All" tab on the Hire Requests page, they didn't see requests that were "In progress". This occurred because the backend treated `status: 'all'` as `None`, and then a fallback fallback logic `eff_status or 'approved'` incorrectly overwrote the "All" intent back to "approved".
2. When an HR recruiter deleted their draft JD chat for a picked-up Hire Request (status `accepted`), there was no way to restart or resume the chat because the "Pick up" button disappears once a request is accepted.

**Idea / Solution:**
1. Updated `backend/services/hire_request_service.py` to explicitly handle `status='all'` by setting `eff_status = None` and updated the fallback to `eff_status if eff_status is not None else "approved"`. Also updated the frontend `HireRequestListPage.jsx` to correctly pass `status: 'all'` for the "All" tab.
2. Added a "Resume JD chat" button in `HireRequestDetailPage.jsx` for recruiters when `req.status === 'accepted'` and `!req.position_id`. This allows them to cleanly re-enter the chat with the same hire request payload.

**Files Modified:**
- `backend/services/hire_request_service.py`
- `frontend/src/components/HireRequests/HireRequestListPage.jsx`
- `frontend/src/components/HireRequests/HireRequestDetailPage.jsx`

*Update:* The initial fix for the "All" tab still resulted in only "approved" requests showing. This was because the backend was first converting `status="all"` to `status=None`, and then a downstream line evaluated `status if status is not None else "approved"`, effectively changing it right back to `"approved"`. The logic has been reordered so that the default fallback only applies if `status` was *originally* `None` (no filter requested), allowing `"all"` to properly clear the filter.
---

## 42. Auth Service Type Inference Error (fetchval NoneType)

**Problem Statement:**
The static type checker (linter) was flagging an error in `backend/services/auth_service.py` at the magic-link rate limit check: `Argument 'None' is not assignable to parameter 'value' with type 'int'`. This occurred because `conn.fetchval()` can theoretically return `None`, making the expression `recent_requests >= 3` invalid if `recent_requests` is `None`.

**Idea / Solution:**
Appended a fallback `or 0` to the `conn.fetchval()` call. This guarantees that `recent_requests` evaluates to an integer, satisfying strict type checks and preventing runtime comparison errors if the query were to ever return `None`.

**Files Modified:**
- `backend/services/auth_service.py`


## 45. JD Chat UI Optimizations

**Problem Statement:**
The JD Chat interface (where recruiters generate the job description) was feeling cramped and structurally cluttered. Too much vertical screen real estate was lost to redundant headers (like the global app topbar, the `RailStateCard`, and the chat topbar stage indicators). Furthermore, the chat composer felt boxy, the "Save & find candidates" CTA looked broken and out of place when disabled, the stepper pipeline was left-aligned leaving awkward empty space, and the AI greeting message was failing to render natively on brand-new blank sessions without an expensive API roundtrip. The initial empty canvas also felt overly verbose with too many bullet points.

**Idea / Solution:**
Executed a comprehensive layout sweep of the JD Chat interface to maximize "Document-First" real estate and harmony:
1. **Maximized Real Estate:** Set `chat-page--v3` to `height: 100vh` and hid the global app layout padding/headers on the `/chat` route. 
2. **Header Consolidation:** Removed the redundant `RailStateCard` completely. Ripped redundant stage indicators out of `ChatTopBar.jsx`. The top bar now only elegantly houses the Session Title and Notification Bell.
3. **Stepper Centering:** Centered the `JDStepper` list so the pipeline visuals align nicely in the middle of the screen. Moved the `FinalizeCTA` (styled as a standard secondary button) and the "Toggle Rail" button into this stepper bar on the far right.
4. **Composer Redesign:** Stripped background and border classes off the composer, replacing it with a sleek, floating pill-shaped input (`.composer-shell` at `24px` border-radius). Trimmed footer padding and brought back the muted helper text (`Enter to send`, `AI makes mistakes`).
5. **Instant Local Greeting:** Replaced the backend ping strategy for the initial greeting on completely fresh (404) sessions. `ChatContext.jsx` now locally injects the greeting message (`"Hi! Tell me about the role..."`) into state immediately, ensuring zero-latency startup for new recruiters.
6. **Canvas Clean-up:** Simplified the massive text block in `JDCanvas.jsx`'s empty state into a single elegant heading and sentence.

**Files Modified:**
- `frontend/src/router.jsx`
- `frontend/src/styles/layout.css`
- `frontend/src/styles/chat.css`
- `frontend/src/components/Chat/ChatPage.jsx`
- `frontend/src/components/Chat/JDRail.jsx`
- `frontend/src/components/Chat/MessageInput.jsx`
- `frontend/src/components/Chat/FinalizeCTA.jsx`
- `frontend/src/components/Chat/ChatTopBar.jsx`
- `frontend/src/components/Chat/JDStepper.jsx`
- `frontend/src/components/Chat/JDCanvas.jsx`
- `frontend/src/context/ChatContext.jsx`

## 46. Premium UI Refinements & Workflow Polish

**Problem Statement:**
The JD generation workspace lacked a premium aesthetic and contained UI quirks. The JD variants did not present clearly, variant selection buttons experienced layout squishing, and the Bias Check (Inclusivity) representation was just standard text without an intuitive visual diff. Additionally, the final "Save & Find Candidates" popup contained redundant fields (Department, Headcount, Priority) that had already been set by the Hiring Manager in the original hire request. Finally, when the bias check completed, the pipeline stepper UI did not intuitively advance to the final "Save" stage.

**Idea / Solution:**
1. **Premium Canvas:** Transformed the JD Canvas into a distinct document-centered interface. Implemented a card-like background with generous padding, subtle shadow depth, and a vibrant top-border gradient to clearly separate the document content from the side chat rail.
2. **Git-Style Bias Diffing:** Restyled the bias checker findings to mirror code diffs. Removed text is now struck through with a light red background, and suggestions are highlighted with a light green background, providing instant visual comprehension.
3. **Variant Card Layout Fixes:** Corrected the flexbox layout in `AgentBlockVariants.jsx` to ensure the "Use this" and "Edit" action buttons share equal width (`flex: 1`), resolving the squished layout bugs.
4. **Stepper UI Logic Update:** Modified `JDStepper.jsx` so that upon receiving bias check results (`bias_issues !== undefined`), the visual pipeline logically advances the "Inclusivity" pill to "done" (✓) and makes the final "Save" stage the current active step.
5. **Popup Redundancy Removal:** Cleaned up `PositionSetupModal.jsx` by entirely removing the redundant Department, Headcount, and Priority form fields. The API endpoints in `chat.py` were adjusted to conditionally accept or fallback on stored session state for these values.

**Files Modified:**
- `frontend/src/styles/chat.css`
- `frontend/src/components/Chat/JDCanvas.jsx`
- `frontend/src/components/Chat/JDStepper.jsx`
- `frontend/src/components/Chat/PositionSetupModal.jsx`
- `frontend/src/components/Chat/blocks/AgentBlockVariants.jsx`
- `backend/routers/chat.py`

### 47. Restore Hire Request Priority & Improve Position Detail Aesthetics
**Date:** 2026-05-30
**Status:** Fixed

**Issue:**
The `priority` field was recently removed from the 'Save and Find Candidates' modal in the chat UI, but it was also missing from the initial `HireRequestForm`, meaning priority could not be set at all. Furthermore, on the Position Details page, the Job Description was displayed in raw Markdown rather than a nicely formatted rendered view, and the breadcrumb header redundantly displayed the position name next to the back button even though it was already prominently featured as the main page title.

**Idea / Solution:**
1. **Restore Priority in Hire Request:** Added the `priority` select field (Urgent, High, Normal, Low) to the `HireRequestForm.jsx` so hiring managers can define priority upfront.
2. **Backend Schema Updates:** Updated `HireRequestCreate` and `HireRequestUpdate` Pydantic models to accept `priority`, added a migration in `backend/db/migrations.py` to ensure the `hire_requests` table has a `priority` column, and updated `backend/db/repositories/hire_requests.py` to persist this field correctly.
3. **Rendered Markdown JD:** Converted the raw `<pre>` tag display in `JDTab.jsx` to use `react-markdown` with `remark-gfm`, and added polished markdown typography styles (`.jd-markdown-render`) in `JDTab.css` to beautifully format headings, lists, quotes, and spacing.
4. **Clean Breadcrumbs:** Removed the redundant `<span className="pd-breadcrumb-current">{position.role_name}</span>` and its separator from `PositionHero.jsx` to clean up the page header.

**Files Modified:**
- `backend/models/hire_request.py`
- `backend/db/migrations.py`
- `backend/db/repositories/hire_requests.py`
- `frontend/src/components/HireRequests/HireRequestForm.jsx`
- `frontend/src/components/Positions/PositionHero.jsx`
- `frontend/src/components/Positions/tabs/JDTab.jsx`
- `frontend/src/components/Positions/tabs/JDTab.css`

### 48. JD Approval Workflow & Team Lead Access Controls
**Date:** 2026-05-31
**Status:** Fixed

**Issue:**
Team Leads could incorrectly see JD generation chat history in their sidebar. Additionally, the JD Approval workflow was lacking visual clarity in the UI: the position relay visualization did not show the "JD Approval" step, the Team Lead had no explicit interface to approve/reject the JD within the Position Details, notifications directed users to the default tab instead of the JD tab, and HR could still edit the JD even after submitting it for approval. Finally, there was no indicator in the sidebar showing how many JDs were pending approval.

**Idea / Solution:**
1. **Chat Session Visibility:** Modified `ChatSessionRepository.list_visible` so that `team_lead`s only see their own sessions, not the entire department's chat history (which belongs to HR).
2. **Relay Visualization Update:** Added a new 'JD Approval' stage to `RELAY_STAGES` in `frontend/src/components/HireRequests/helpers.js` to accurately reflect the workflow.
3. **JD Approval UI:** In `JDTab.jsx`, introduced a conditionally rendered banner for Team Leads to "Approve JD" or "Request Changes". 
4. **Edit Restrictions:** Disabled the "Edit" button for HR users while the position `approval_status` is `pending`, giving exclusive review/edit access to the Team Lead during this phase.
5. **Notification Deep-linking:** Updated the `action_url` in `PositionService` so that clicking the "JD Ready for Review" notification (and the email link) takes the user directly to the `/positions/{id}/jd` tab.
6. **Sidebar Badges:** Added a `pendingCount` endpoint for positions and updated `Sidebar.jsx` to show a notification badge on the "Positions" menu item for Team Leads.

**Files Modified:**
- `backend/db/repositories/sessions.py`
- `frontend/src/components/HireRequests/helpers.js`
- `frontend/src/components/Positions/tabs/JDTab.jsx`
- `frontend/src/components/Positions/tabs/JDTab.css`
- `backend/routers/positions.py`
- `frontend/src/utils/api.js`
- `frontend/src/components/Sidebar/Sidebar.jsx`
- `backend/services/position_service.py`

---

### 49. Fix 500 Error in Copilot Suggestions Endpoint
**Date:** 2026-05-31
**Status:** Fixed

**Issue:**
The `GET /api/v1/copilot/suggestions` and `PATCH /api/v1/copilot/suggestions/dismiss-all` endpoints were returning a 500 Internal Server Error due to a `KeyError: 'id'`. This occurred because the endpoint was attempting to access `user["id"]`, but the `get_current_user` dependency returns a dictionary with the key `"user_id"`.

**Idea / Solution:**
Updated the `get_suggestions` and `dismiss_all_suggestions` endpoints in `backend/routers/copilot.py` to correctly reference `user["user_id"]` instead of `user["id"]`.

**Files Modified:**
- `backend/routers/copilot.py`

---

### 50. Restrict Chat History Visibility for Leadership Roles
**Date:** 2026-05-31
**Status:** Fixed

**Issue:**
Org Heads and Department Admins were able to view all JD generation chat histories in their sidebars. In a standard B2B SaaS context, the JD generation chat is a workspace/scratchpad for recruiters (HR) to negotiate with the AI. Leadership only needs to see the finalized job description in the Positions view, not the back-and-forth prompt engineering. Showing this history creates unnecessary noise in the UI and enables micromanagement.

**Idea / Solution:**
Modified `ChatSessionRepository.list_visible` to ensure that only `hr` users can see department-wide chat sessions (allowing collaboration and hand-offs between recruiters). All other roles, including `org_head` and `dept_admin`, are now restricted to seeing only their own chat sessions (should they ever test the chat functionality).

**Files Modified:**
- `backend/db/repositories/sessions.py`

---

### 51. Fix Type Inference Error in Session Repository
**Date:** 2026-05-31
**Status:** Fixed

**Issue:**
The Python type checker reported an overload error: `No matching overload found for function dict.__init__ called with arguments: (Unknown | None)`. This occurred because `asyncpg.Connection.fetchrow()` can technically return `None`, meaning passing it directly into `dict(row)` risks attempting to initialize a dictionary with `None`, violating strict type rules.

**Idea / Solution:**
Appended a fallback conditional `if row else {}` to the `dict(row)` returns inside `ChatSessionRepository.create` and `ChatSessionRepository.add_message`. This guarantees a valid dictionary is returned, satisfying the `dict[str, Any]` return type signature and resolving the static analyzer warnings.

**Files Modified:**
- `backend/db/repositories/sessions.py`

---

### 52. Prevent Duplicate Positions from JD Chat Resubmission
**Date:** 2026-05-31
**Status:** Fixed

**Issue:**
When an HR recruiter finalized a JD and clicked "Save & find candidates", a new position was created successfully. However, if the recruiter later re-opened the same chat session (e.g., to revise the JD based on Team Lead feedback) and clicked the save button again, the backend would blindly create a completely new, duplicate position instead of updating the existing one.

**Idea / Solution:**
Updated `ChatService.finish_and_save_position` to check if the current chat session is already linked to a `position_id`. 
- If a `position_id` exists, the backend now updates the existing position record, clears and re-inserts the variants, and fires an "updated" audit log instead of "created".
- The status of the position is reset to `draft` so it correctly routes back into the Team Lead approval loop (if not auto-approved).
- This prevents pipeline duplication and keeps the history clean.

**Files Modified:**
- `backend/services/chat_service.py`

---

### 53. UI/UX Workflow Refinements for JD Approval & Chat Read-Only State
**Date:** 2026-05-31
**Status:** Fixed

**Issue:**
The JD generation and approval workflow had UX inconsistencies:
1. The "Save & find candidates" button label was misleading, as candidates are not found immediately.
2. The "New Position" button on the Positions page circumvented the "New Hire Request" architecture.
3. Chat sessions could still be edited by HR even after they were submitted for Team Lead approval.
4. JDs could still be edited even after they were fully approved (`open`).
5. Draft/Rejected JDs were difficult to resume from the Chat History.

**Idea / Solution:**
- **Finalize JD:** Renamed the chat action button to "Finalize JD".
- **Remove Redundant Button:** Deleted the generic "New Position" button from the Positions page to enforce proper pipeline entry.
- **Read-Only Chat:** Modified `ChatSessionRepository.get` to join the associated position's status. The Chat Context now tracks `isReadOnly`. If a position is `pending_approval` or `open`, the chat input, editing variants, and JD card editing are all disabled.
- **Resume Chat Deep-link:** Modified `JDTab.jsx` on the Position Details page. Instead of a standard Markdown editor, HR users now see a "💬 Resume AI Chat" deep-link for Drafts or Rejected positions.
- **JD Lockdown:** `JDTab.jsx` now strictly blocks all editing if a position is fully approved (`open`).

**Files Modified:**
- `backend/db/repositories/sessions.py`
- `frontend/src/context/ChatContext.jsx`
- `frontend/src/components/Chat/MessageInput.jsx`
- `frontend/src/components/Chat/FinalizeCTA.jsx`
- `frontend/src/components/Chat/blocks/AgentBlockVariants.jsx`
- `frontend/src/components/Chat/cards/FinalJDCard.jsx`
- `frontend/src/components/Positions/PositionsListPage.jsx`
- `frontend/src/components/Positions/tabs/JDTab.jsx`

### 51. JD Smart Revision Mode & UI Polish
**Date:** 2026-05-31
**Status:** Fixed

**Issue:**
1. Chat UI elements were forced full-width, making standard chat bubbles look stretched.
2. The AI chatbots and user messages lacked clear visual distinction (avatars).
3. The organization name was hardcoded in several agent blocks.
4. Sending a revision request during the `final_jd` stage blindly regenerated the document, breaking the continuity of the original draft.
5. Missing explicit state extraction for when recruiters mentioned new skills during their final review.

**Idea / Solution:**
- **UI Polish:** Re-engineered the chat styling (`.msg`, `.msg-body`) to enforce proper chat bubble width constraints and added user (👤) and bot (🤖) avatars to `MessageList.jsx`.
- **Dynamic Names:** Integrated `AuthContext` into `AgentBlockInternal.jsx` and `RailStateCard.jsx` to swap the hardcoded "TechCorp" reference for the dynamic `org_name`.
- **State Extraction:** Built an `extract_state_updates` LLM task within `drafting_final` to silently update `state["skills_required"]` when recruiters make explicit revision requests, keeping backend states synchronized.
- **Smart Re-Compiler:** Modified the `drafting_final` prompt to act as a "Smart Re-Compiler", feeding the `CURRENT JD DRAFT` into the prompt to retain its structure, rather than generating blindly.
- **JD Edit Lock Recovery:** Re-integrated `FinalJDCard.jsx` into `JDCanvas.jsx` to restore the manual inline Edit and Position setup buttons, properly guarded by the `isReadOnly` state.
- **Market Privacy:** Adjusted the `market_intelligence.py` prompt to generalize sources like "Industry Benchmark" instead of revealing raw competitor names directly on the UI.

**Files Modified:**
- `frontend/src/components/Chat/MessageList.jsx`
- `frontend/src/styles/chat.css`
- `frontend/src/components/Chat/blocks/AgentBlockInternal.jsx`
- `frontend/src/components/Chat/RailStateCard.jsx`
- `frontend/src/components/Chat/JDCanvas.jsx`
- `frontend/src/context/ChatContext.jsx`
- `frontend/src/components/Chat/cards/JDVariantsCard.jsx`
- `backend/agents/nodes/drafting.py`
- `backend/agents/prompts/drafting.md`
- `backend/agents/prompts/market_intelligence.md`

### 52. WYSIWYG Editor & CTA Layout Alignment
**Date:** 2026-05-31
**Status:** Fixed

**Issue:**
1. Users found it jarring to edit raw Markdown (`textarea`) instead of the rendered document in the JD Chat and Position Details tabs.
2. The "Finalize JD" button appeared twice (once in the top stepper, and once at the bottom of the chat). The user requested it to be kept at the bottom for better flow after the bias check.
3. The layout of `FinalJDCard` inside `JDCanvas` lost some of its padding and visual consistency after being moved.

**Idea / Solution:**
- **WYSIWYG Markdown Editing:** Installed `marked` and `turndown` libraries. Replaced raw `<textarea>` fields in `FinalJDCard.jsx` and `JDTab.jsx` with a `contentEditable` `<div className="jd-wysiwyg">`. The div initializes with HTML (via `marked`) and converts back to Markdown (via `turndown`) on save or blur. This allows users to edit the "rendered view" directly.
- **Removed Duplicate CTA:** Removed `<FinalizeCTA />` from the top `JDStepper.jsx`. The existing "Save & find candidates" (finalize) and "Save draft" buttons are already correctly aligned side-by-side horizontally at the bottom of the `FinalJDCard`.
- **Card Styling:** Adjusted `FinalJDCard` markup to use `<article className="jd-body">` to restore proper styling and spacing when viewed inside the chat window.

**Files Modified:**
- `frontend/package.json`
- `frontend/src/components/Chat/cards/FinalJDCard.jsx`
- `frontend/src/components/Positions/tabs/JDTab.jsx`
- `frontend/src/components/Chat/JDStepper.jsx`
