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
---
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

### 53. Minor UI Adjustments: Chat Bubbles, Git-Style Diff & Alignment
**Date:** 2026-05-31
**Status:** Fixed

**Issue:**
1. User and AI chat bubbles took up full width instead of shrink-wrapping.
2. The "Save draft" and "Finalize JD" buttons at the bottom of the JD Canvas wrapped awkwardly on some screen widths.
3. The Bias Check suggestions were displayed inline with an arrow instead of a proper Git-style vertical diff.

**Idea / Solution:**
- **Chat Bubble Fix:** Added `width: fit-content;` to `.msg-body` in `chat.css` to ensure messages correctly shrink-wrap.
- **Button Alignment:** Adjusted `.canvas-actions` in `chat.css` to use `flex-wrap: nowrap;` so the buttons remain horizontally aligned at the bottom right.
- **Git-style Diff:** Re-styled `.bias-diff-change` to stack elements vertically. Applied red/green block background styles and `-`/`+` pseudo-elements to `.bias-diff-old` and `.bias-diff-new` to mimic Git patch layouts. Removed the inline arrow from `FinalJDCard.jsx`.

**Files Modified:**
- `frontend/src/styles/chat.css`
- `frontend/src/components/Chat/cards/FinalJDCard.jsx`

### 54. JD Card Layout Unity & Inline Bias Diff
**Date:** 2026-05-31
**Status:** Fixed

**Issue:**
1. The JD card appeared as a "box inside a box" due to separate borders for the action headers and the editor body.
2. Bias check diffs appeared at the bottom of the card, instead of inline like a modern IDE.
3. The bottom buttons (Save Draft, Finalize) and the Bias Check button were misaligned and lacked a unified hierarchy.

**Idea / Solution:**
- **Card Unification:** Wrapped `FinalJDCard` in a unified `.final-jd-card-container` with a single outer border and moved the download/edit action items strictly to its header. Removed the nested `.jd-body` border.
- **Inline Git Diffs:** Replaced the static bottom panel with an inline HTML rendering approach using `dangerouslySetInnerHTML`. The text replaces flagged phrases with Git-style `<del>` and `<ins>` widgets containing inline '✓' and '✗' action buttons bound to the React context.
- **Triangle Action Layout:** Restyled the `.canvas-actions` flex container to stack vertically: the Bias Check button sits centered at the top, while "Save draft" and "Finalize JD" are centered horizontally side-by-side below it, forming the requested triangular hierarchy.

**Files Modified:**
- `frontend/src/components/Chat/cards/FinalJDCard.jsx`

### 55. Chat Interface and JD Card UI Cleanup
**Date:** 2026-05-31
**Status:** Fixed

**Issue:**
1. The Final JD card was rendering with an outer box/container that added extra padding and constricted its width to be narrower than other agent blocks on the canvas.
2. The JD document header (showing "Document Draft" and action icons) was styled as a separate container rather than appearing inline.
3. Chat message bubbles stretched to the full width of the screen, and avatar icons for the Bot/User were missing.
4. The JD Variant cards (Skill-Focused, Outcome-Focused, Hybrid) were stacking or constrained instead of displaying side-by-side naturally on smaller screens.

**Idea / Solution:**
- **Final JD Card Refinement:** Stripped the `.canvas-body` and `.canvas-doc` wrappers in `FinalJDCard.jsx` and updated `JDCanvas.jsx` to remove the extra spacing wrapper. Configured `.jd-body` in `chat.css` to act as an `.agent-block` natively without heavy padding, borders, or shadows, while keeping the gradient top line.
- **Inline Header:** Stripped inline padding styles from the `.canvas-head` in `FinalJDCard.jsx`. Resized action icons to `20px` and centralized `.icon-btn` dimensions to `40px` inside `.canvas-head-tools`.
- **Rail Chat Modernization:** Refactored `RailConversation.jsx` to include `IconUser` and `IconBot` avatars inside a new `.rail-msg-avatar` element, and wrapped message content in `.rail-msg-bubble`. Updated `chat.css` to change `.rail-msg` to a row-based layout and configured `.rail-msg-bubble` to shrink-wrap its content (`width: fit-content; max-width: 85%;`).
- **Variants Layout:** Updated `.variant-grid` to enforce a 3-column row (`repeat(3, minmax(0, 1fr))`) breaking to 1 column below `960px`. Set `.variant-card` base border and background to `transparent` to avoid double-boxing within the agent block.
- **Reliable Greeting:** Defined a static `GREETING` constant in `ChatContext.jsx` and seeded it during `resetChat`, the 200 OK path for empty sessions, the 404 fresh chat branch, and error boundaries.

**Files Modified:**
- `frontend/src/styles/chat.css`
- `frontend/src/components/Chat/JDCanvas.jsx`
- `frontend/src/components/Chat/cards/FinalJDCard.jsx`
- `frontend/src/components/Chat/RailConversation.jsx`
- `frontend/src/context/ChatContext.jsx`

### 56. Final JD Card Disappearing During Refinement
**Date:** 2026-05-31
**Status:** Fixed

**Issue:**
When a recruiter sent a message in the chatbot to refine the final JD (e.g., from Team Lead feedback), the JD card completely disappeared from the canvas until the new JD started streaming. The user also reported an HMR "Unterminated JSX contents" error in `FinalJDCard.jsx` masking this issue.

**Idea / Solution:**
- **State Continuity Fix:** Updated `JDCanvas.jsx` to render the `FinalJDCard` if `isJdStreaming` is true, even when the `jdBody` string itself is briefly empty (cleared out by `ChatContext.jsx` upon starting a refinement request). This prevents the component from unmounting, preserving its internal state and avoiding jarring visual disappearance.
- **Syntax Error Clarification:** Verified that `FinalJDCard.jsx` is syntactically perfect. The "Unterminated JSX contents" error was a stale Vite HMR artifact triggered momentarily during the previous file replacement.

**Files Modified:**
- `frontend/src/components/Chat/JDCanvas.jsx`

### 57. Strict Typing and Multimodal Content Fixes in AI Workflow
**Date:** 2026-05-31
**Status:** Fixed

**Issue:**
Multiple static typing and runtime errors occurred in the backend AI orchestrator and agents:
1. `variant_refinement`, `section_rewrite`, and `jd_saved_as_draft` were dynamically accessed or modified but missing from the `AgentState` TypedDict definition, causing `TypedDict` key errors.
2. `final_jd` string operations (`.replace()`) and bias checker calls crashed because `.get("final_jd", "")` inferred a `str | None` type when the explicit value was `None`.
3. The Bias Checker failed because the orchestrator expected a strict `list[BiasIssue]`, but `check_bias` returned a generic `list[dict]`.
4. Multimodal response crashes: LangChain's `response.content` in both `drafting.py` (final JD generation) and `bias_checker.py` returned lists of dictionaries, causing `AttributeError: 'list' object has no attribute 'strip'`.
5. Orchestrator dynamic assignments via a for-loop (`v[key] = action_data[key]`) failed because `JDVariant` TypedDict fields cannot be statically verified in a loop, and `description` was incorrectly used instead of `content`.

**Idea / Solution:**
- **State Schema Completeness:** Registered all missing fields (`variant_refinement`, `section_rewrite`, `jd_saved_as_draft`) and added `category` to `BiasIssue` in `backend/agents/state.py`.
- **Robust Multimodal Parsing:** Ported the robust list-to-string conversion block from earlier drafting nodes into the final drafting node and bias checker to safely handle LangChain multimodal responses.
- **Strict Typing Fixes:** 
  - Unrolled dynamic dictionary key loops into explicit `if` statements matching `JDVariant` schema (`content`, `tone`, `skills_count`).
  - Swapped `.get(..., "")` fallbacks to `.get(...) or ""` to mathematically prove string types.
  - Initialized state message updates strictly via the `ChatMessage` constructor instead of generic dicts.
  - Refactored `check_bias` to explicitly instantiate and return `BiasIssue` objects.

**Files Modified:**
- `backend/agents/state.py`
- `backend/agents/nodes/drafting.py`
- `backend/agents/bias_checker.py`
- `backend/agents/orchestrator.py`

### 58. Dept Admin Access to JD Generation Chat
**Date:** 2026-05-31
**Status:** Fixed

**Issue:**
Department Admins (`dept_admin`) could see the "New Hire" button in the Sidebar but were unable to access the page (redirected to dashboard) because the RoleGuard on the `/chat` route in `router.jsx` did not include them.

**Idea / Solution:**
Updated the `<RoleGuard>` for the `/chat` route to include `dept_admin`, aligning the React Router permissions with the Sidebar visibility permissions.

**Files Modified:**
- `frontend/src/router.jsx`

### 59. Dashboard UI Refinements (Scroll & Roles)
**Date:** 2026-05-31
**Status:** Fixed

**Issue:**
1. Dashboard layout scrolled vertically off-screen rather than acting as a fixed Command Center.
2. Department Admins saw "Org-wide health" instead of "Department health".
3. Team Leads saw "Create your first position" routing to `/chat` in the empty state instead of "File Hire Request".

**Idea / Solution:**
- Locked `.dash-v3` to `height: calc(100vh - 108px)` and applied `overflow-y: auto` to `.tb-lane-rows` to make only the briefing lanes scroll.
- Dynamically rendered "Department health" for `dept_admin` in `DashboardPage.jsx`.
- Plumbed `role` prop down to `TodaysBriefing` to dynamically update the empty state text and routing for `team_lead`.

**Files Modified:**
- `frontend/src/styles/dashboard.css`
- `frontend/src/components/Dashboard/DashboardPage.jsx`
- `frontend/src/components/Dashboard/TodaysBriefing.jsx`

### 60. Dashboard Empty State & Dept Admin Cleanup
**Date:** 2026-05-31
**Status:** Fixed

**Issue:**
1. Dept Admins saw "Org Health" on the 4-card health strip metric, conflicting with their actual scope.
2. The bottom row (Pipeline Velocity) was getting squished vertically or hidden by half on screens where the top components (Health Strip, Dept Chip Bar) were rendered, because the middle section wasn't absorbing the layout pressure correctly.
3. Redundant CTAs in the empty state: "Create your first position" existed both in the center placeholder and top-right header, causing confusion.

**Idea / Solution:**
- Plumbed `role` down to `HealthStrip.jsx` and dynamically rendered "Dept Health" vs "Org Health".
- Hid the global top-right action button (`dash-new-hire-btn`) conditionally when the empty state placeholder (`isOnboarding`) is visible to reduce CTA redundancy.
- Applied `flex: 1` and `min-height: 0` to the `.tb-onboarding` container, and `flex-shrink: 0` to `.dash-bottom-row` in `dashboard.css`, ensuring the bottom analytics row maintains its correct fixed height without getting cut off.

**Files Modified:**
- `frontend/src/components/Dashboard/DashboardPage.jsx`
- `frontend/src/components/Dashboard/HealthStrip.jsx`
- `frontend/src/styles/dashboard.css`

### 61. Erroneous "Abandon JD" Popup on Fresh Sessions
**Date:** 2026-05-31
**Status:** Fixed

**Issue:**
Clicking the "New Hire" tab in the sidebar triggered an "Abandon current JD generation and start a new one?" confirmation popup, even when the user had just started a brand new, empty chat session.

**Idea / Solution:**
The sidebar navigation handler (`handleNewHire`) was checking `messages.length === 0` to determine if a session was empty. However, the `ChatContext` seeds a static initial greeting message (`Hi! Tell me about the role...`), meaning `messages.length` is always at least `1`. Updated the condition to `messages.length <= 1` so that a session with only the AI greeting is correctly treated as "empty."

- `frontend/src/components/Sidebar/Sidebar.jsx`

### 62. Positions Tab UI Polish & Drafts Filter
**Date:** 2026-05-31
**Status:** Fixed

**Issue:**
1. Missing a "Drafts" filter in the Positions page. HR users had no distinct way to filter and find positions that were saved as drafts from the JD chat without digging through "All".
2. The empty state ("No positions found. Positions are created via approved hire requests.") was a dead end for HR/Org Heads and visually bare, lacking a primary Call To Action (CTA).
3. The department dropdown was correctly scoped only to roles that can see across departments (`org_head`, `admin`), which ensures `dept_admin` does not see an unnecessary filter (since they are isolated to their own department).

**Idea / Solution:**
- Added a `draft` segment filter in `PositionsToolbar.jsx` and the corresponding logic in `PositionsListPage.jsx` to filter by `status === 'draft'`.
- Overhauled the `EmptyPositions` empty state component to feature a polished icon, better visual padding, and role-aware messaging. It now provides a "New Hire" button for HR/Admins, and a "File Hire Request" button for Team Leads.

**Files Modified:**
- `frontend/src/components/Positions/PositionsListPage.jsx`
- `frontend/src/components/Positions/PositionsToolbar.jsx`

### 63. Positions Tab Filter Visibility and Sorting Context
**Date:** 2026-05-31
**Status:** Fixed

**Issue:**
1. The Department dropdown filter was mysteriously missing for `org_head` and `hr` despite being functionally designed for them.
2. The standalone dropdown on the top right ("Urgency", "Newest", "Activity") lacked context, leaving users confused about its purpose (Filtering vs. Sorting).

**Idea / Solution:**
- Discovered that the backend SQL query in `list_for_org` was failing to fetch `department_name` via a JOIN, causing the frontend's dynamic department list extraction to fail. Added the missing `LEFT JOIN departments d` and fetched `d.name AS department_name`.
- Expanded the `isAdmin` boolean on the frontend to explicitly include the `hr` role, ensuring both HR and Org Heads can view and use the cross-department filter.
- Added a "Sort:" label prefix to the top-right dropdown. This is a powerful sorting feature designed to bring "stalled" or "urgent" pipelines to the top of a recruiter's workflow, and labeling it clarifies its exact intent.

**Files Modified:**
- `backend/db/repositories/positions.py`
- `frontend/src/components/Positions/PositionsListPage.jsx`
- `frontend/src/components/Positions/PositionsToolbar.jsx`

### 64. Dept Admin Visibility Enforcement (Positions Tab)
**Date:** 2026-05-31
**Status:** Fixed

**Issue:**
The `isAdmin` variable used in the frontend to determine if the Department dropdown should be visible was referencing legacy role strings (`admin`, `org_admin`) and could have caused confusion regarding `dept_admin` scope.

**Idea / Solution:**
- Cleaned up `canFilterByDept` in `PositionsListPage.jsx` to use the canonical roles from `backend/models/auth.py`. 
- Explicitly ensured `dept_admin` does NOT see the department filter, as their access is inherently scoped to their assigned department. Only `platform_admin`, `org_head`, and global `hr` (without a `dept_id`) can filter across departments.

**Files Modified:**
- `frontend/src/components/Positions/PositionsListPage.jsx`

### 65. Platform Admin Tenant Isolation
**Date:** 2026-05-31
**Status:** Fixed

**Issue:**
The `platform_admin` role (SaaS operators) had implicit routing access to tenant-specific workspaces (like the Dashboard, Positions, Candidates) via the `AppLayout`. This violates data privacy and tenant isolation principles, as platform admins should only see high-level aggregate usage data, not sensitive HR or candidate PII.

**Idea / Solution:**
- Created a new `OrgGuard` in `frontend/src/router.jsx`.
- Wrapped the entire `AppLayout` (which contains `/dashboard`, `/positions`, `/candidates`, etc.) in `OrgGuard` to actively bounce `platform_admin` users to `/platform`.
- Removed `platform_admin` from `canFilterByDept` in `PositionsListPage.jsx` since they can no longer reach that screen.

**Files Modified:**
- `frontend/src/router.jsx`
- `frontend/src/components/Positions/PositionsListPage.jsx`

### 66. HR Department Filter Visibility Property Bug
**Date:** 2026-05-31
**Status:** Fixed

**Issue:**
HR users assigned to a specific department were still seeing the cross-department filter in the Positions page. This happened because the frontend `AuthContext` populates the user object with `department_id`, but the frontend filter check was incorrectly referencing `dept_id` (which is the property name used in the JWT payload on the backend, not the `/auth/me` frontend object).

**Idea / Solution:**
- Corrected the property accessor in `PositionsListPage.jsx` from `!user?.dept_id` to `!user?.department_id` to accurately read the user's department assignment and hide the filter when they are scoped to a specific department.

**Files Modified:**
- `frontend/src/components/Positions/PositionsListPage.jsx`

### 67. UX Polish: Clarified Global Department Label in Team Invite
**Date:** 2026-05-31
**Status:** Fixed

**Issue:**
When an Org Head invites a new team member and leaves their department empty, the UI dropdown simply said "None". This was ambiguous for roles like HR, where "None" actually means they have cross-department (global) access.

**Idea / Solution:**
- Improved the UX for the Department dropdown in the Team Invite Modal (`TeamTab.jsx`). 
- If the selected role is HR and no department is chosen, the label dynamically updates from "None" to "Global (All Departments)" to make the architectural intent completely obvious to the admin sending the invite.
- For other org-level roles without a department, it shows "None (Org Level)".

**Files Modified:**
- `frontend/src/components/Settings/tabs/TeamTab.jsx`

### 68. Talent Pool UI/UX Overhaul & Contextual Copilot Match
**Date:** 2026-06-01
**Status:** Fixed

**Issue / Validation:**
The Talent Pool screen was using a legacy "pre-v3" layout that was messy, space-inefficient, and suffered from global scrolling issues. Additionally, the planned "V3 Matrix" design was identified as computationally expensive and prone to horizontal scrolling issues.

**Idea / Solution:**
- Transitioned directly to a **V4 Contextual Copilot Match** architecture.
- **Routing & RBAC:** Added a `RoleGuard` in `router.jsx` to restrict access to `['org_head', 'dept_admin', 'hr']`, strictly preventing Team Leads from browsing the global pool.
- **UI Layout:** Rewrote `TalentPoolPage.jsx` and `.css`. Added `calc(100vh - 84px)` with `overflow-y: auto` to fix the global page scrolling. Reorganized the layout to feature a clean horizontal toolbar and a sleek grid.
- **Bulk Upload:** Moved the massive inline drag-and-drop zone into a dedicated `BulkUploadModal` triggered from the header.
- **AI Magic:** Replaced the inline AI Match block with a `CopilotMatchPanel` (side-panel). 
- **RBAC Enforcement (AI Match):** The Open Positions dropdown inside the AI Match panel dynamically filters based on the user's role and `department_id`, ensuring scoped admins can only match candidates against their own open roles, while still drawing from the global talent pool.

**Update (2026-06-01):** Fixed residual double-scrollbars and global body scrolling. The `tp-page` height calculation was adjusted to `calc(100vh - 108px)` to perfectly accommodate the global `app-main` padding layout. Also isolated `.tp-btn-primary` CSS classes to prevent global `width: 100%` overrides from distorting the empty state and upload modal.

**Files Modified:**
- `frontend/src/router.jsx`
- `frontend/src/components/TalentPool/TalentPoolPage.jsx`
- `frontend/src/components/TalentPool/TalentPoolPage.css`

### 69. Dashboard V3 RBAC Validation & Endpoint Consolidation
**Date:** 2026-06-01
**Status:** Fixed

**Issue / Validation:**
The V3 Dashboard layout (NOW/NEXT/PULSE lanes) was implemented, but the underlying data fetching had severe RBAC and data integrity leaks:
1. **Copilot Suggestions Leaking:** The frontend fetched global suggestions and displayed them to all roles, violating the spec (e.g., Team Leads seeing `pool_match` intended for Admins).
2. **Lane Data Scoping:** Because NOW and NEXT lanes derived directly from these unfiltered suggestions, HR and Team Leads were seeing org-wide alerts instead of their assigned/owned positions.
3. **PULSE Lane Scoping:** Activity feed fetched via `/dashboard/activity` was entirely org-wide and ignored `assigned_to` or `created_by` filters.
4. **Team Lead Position Scope:** The `get_positions_summary` backend filter missed the `role == "team_lead"` condition, resulting in Team Leads seeing all positions in their department instead of just the ones they created.
5. **Parallel Fetching:** The frontend relied on 4 parallel API calls instead of the spec-recommended unified `dashboard/briefing` endpoint.

**Idea / Solution:**
- **Backend - Unified Endpoint:** Created a new `GET /api/v1/dashboard/briefing` endpoint in `routers/dashboard.py` and implemented `get_briefing` in `DashboardService`.
- **Backend - Strict RBAC Filters:**
  - Added `role == 'team_lead'` to `get_positions_summary` to filter by `p.created_by = user_id`.
  - In `get_briefing`, filtered `activity` and `suggestions` directly against the IDs of the RBAC-filtered `positions` fetched in the same call.
  - Implemented explicit role exclusions for `pool_match`, `pending_rejection`, and `uncontacted_high_score` suggestions as defined in the spec.
- **Frontend - Consolidation:** Refactored `useDashboardData.js` to replace the 4 parallel requests with a single `fetchBriefing` function, vastly reducing client-side logic complexity and data load.

**Files Modified:**
- `backend/services/dashboard_service.py`
- `backend/routers/dashboard.py`
- `frontend/src/utils/api.js`
- `frontend/src/components/Dashboard/useDashboardData.js`
- `docs/design/pages/08_talent_pool.md`

### 70. Positions List V3 RBAC Validation & Security Fix
**Date:** 2026-06-01
**Status:** Fixed

**Issue / Validation:**
The V3 Positions List ("Pipeline Garden") frontend implementation perfectly mirrors the design spec, cleanly surfacing stalled/draft/closed visual states alongside 30-day sparklines. However, similar to the Dashboard, a backend data leakage issue was identified:
- **Team Lead Scope Leak:** The `GET /api/v1/positions/` endpoint allowed Team Leads to see *all* positions within their department, violating the spec which mandates they only see their assigned/owned positions.

**Idea / Solution:**
- Added `assigned_to` and `created_by` arguments to the `list_for_org` SQL query in `PositionRepository`.
- Updated `backend/routers/positions.py` and `backend/services/position_service.py` to enforce `created_by = current_user["user_id"]` whenever a Team Lead requests the position list, accurately scoping the Pipeline Garden strictly to their authored roles.

**Files Modified:**
- `backend/db/repositories/positions.py`
- `backend/services/position_service.py`
- `backend/routers/positions.py`

### 71. Dashboard Onboarding UX Cleanup (Redundant CTAs)
**Date:** 2026-06-01
**Status:** Fixed

**Issue:**
When a user had zero active positions, the Dashboard rendered multiple, competing "Empty State" widgets. Specifically, the large centralized `TodaysBriefing` hero banner would display a primary "Create your first position" CTA, while the `PositionPulse` widget in the bottom row simultaneously rendered a smaller "No positions yet -> Create a position" CTA, creating a messy and confusing onboarding layout.

**Solution:**
- Updated `DashboardPage.jsx` to conditionally hide the entire `dash-bottom-row` (containing `VelocitySparkline` and `PositionPulse`) when `isOnboarding` evaluates to true. This ensures the user is presented with a single, clean focal point for their next action.

**Files Modified:**
- `frontend/src/components/Dashboard/DashboardPage.jsx`

### 72. Settings Page RBAC Left Rail Fix
**Date:** 2026-06-01
**Status:** Fixed

**Issue / Validation:**
During validation of the V3 AI Behavior Console, it was noted that the left navigation rail was incorrectly completely hiding restricted items for non-admins, violating Spec §7 which mandates they should be visible but greyed out with an "Admin-only" lock icon. Furthermore, Recruiter read-only access (for ATS Rules and Email Templates) wasn't being correctly managed.

**Idea / Solution:**
- Refactored the `SettingsPage.jsx` left rail mapping logic. Restricted items are now assigned an `isDisabled` state which applies visual greying and a lock icon instead of being filtered out.
- Implemented an `isReadOnly` flag which propagates down to the active component, ensuring Recruiters can view but not edit sensitive AI rules (like ATS scoring threshold) as per the specification.

**Files Modified:**
- `frontend/src/components/Settings/SettingsPage.jsx`

### 73. Settings UI: Premium SaaS Upgrades (V3.1)
**Date:** 2026-06-01
**Status:** Implemented

**Issue / Validation:**
While the core layout for the V3 AI Behavior Console was implemented, the inner workings of individual tabs (`TeamTab`, `OrganizationTab`) were functionally basic. They relied on standard HTML tables, basic centered modals, and lacked the "Pipeline Garden" premium visual fidelity. Additionally, the Organization tab missed an opportunity to leverage AI to auto-draft company profiles.

**Idea / Solution:**
- **Vertical Scroll Fix:** Constrained `.st-layout` to `height: calc(100vh - 120px); overflow: hidden;` in `settings.css` to prevent page-level bleeding and restrict scrolling exclusively to the internal `.st-form-area` and rails.
- **Team Tab Alignment:** Converted the flexible `.premium-list-item-right` elements (Role, Department, Status) into fixed-width columns (`.item-col-dept`, `.item-col-role`, `.item-col-status`) so they align perfectly vertically, like a table.
- **Slide-over Drawers:** Replaced standard modals with a new `<SlideOver>` right-side drawer component for a non-blocking configuration experience.
- **Premium Lists:** Upgraded raw HTML tables and custom lists into sleek `.premium-list` components featuring colored role badges, avatars, and modern layout spacing. Applied this uniformly to `TeamTab`, `DepartmentsTab`, `ScreeningQuestionsTab`, and `CompetitorsTab`.
- **Premium Empty States:** Swapped dashed-border basic empty states with subtle glassmorphic gradients and icons across all updated tabs.
- **Vertical Layout Constraint:** Eliminated vertical page scrolling globally by converting `.settings-page` to a strict flex-container and assigning `.st-layout` a `flex: 1` `min-height: 0` property. Internal containers (`.st-rail`, `.st-form-area`, `.st-preview`) now rely on `height: 100%; overflow-y: auto` to naturally constrain content to the viewport.
- **Premium Checkbox & Inputs:** Replaced legacy generic checkbox `<input type="checkbox">` elements across settings tabs with a newly styled `.premium-checkbox` (with animations and SVG-like checkmarks). Form inputs inside `SlideOver` have been enhanced with glassmorphic backgrounds, gentle drop shadows, and modern focus states.
- **AI Auto-draft (Backend LLM Integration):** Replaced the frontend simulation with a true, fully-functional backend endpoint (`POST /api/v1/settings/org/auto-draft`). It leverages `httpx` to fetch external HTML and uses a `ChatGroq` LLaMA model to intelligently extract and summarize the `about_us`, `culture_keywords`, and `benefits_text`.

### 74. Settings UI: Tab Consolidation Completion
**Date:** 2026-06-01
**Status:** Implemented

**Issue / Validation:**
Remaining tabs in the Workspace Settings lacked the visual polish applied to the core modules. Inconsistent modals, raw checkboxes, and unconfirmed destructive actions persisted in secondary tabs (`MessageTemplates`, `ApprovalRules`, `Privacy`, `Integrations`).

**Idea / Solution:**
- **SlideOver Migration:** Replaced all legacy `<div className="modal-overlay">` instances with the standard `SlideOver` drawer component in `MessageTemplatesTab` and `PrivacyTab` (data export modal).
- **UX Destructive Safeguards:** Enforced `window.confirm()` barriers on all delete actions across `CompetitorsTab`, `PrivacyTab` (GDPR data anonymization processing), and `MessageTemplatesTab`.
- **UI Component Standardization:** Replaced raw HTML checkboxes in `ApprovalRulesTab` with the standardized `<Toggle>` component for a tactile, premium feel.
- **Premium List & Badges:** Restyled `MessageTemplatesTab` to use the `.premium-list` layout instead of basic cards. Standardized phase tags in `IntegrationsTab` and `SecurityTab` to utilize the circular `P2`/`P3` badges established in the global settings navigation.

### 75. Settings UI: Drag-and-Drop & Custom Modals
**Date:** 2026-06-01
**Status:** Implemented (Known bug resolved in #76)

**Issue / Validation:**
- Screening questions reordering relied on crude "up" and "down" arrows instead of natural drag-and-drop.
- The department labels in `ScreeningQuestionsTab` didn't visually match the exact alignment of `TeamTab`.
- System-level `window.confirm()` prompts for destructive actions (deletes, deactivations) felt jarring and non-native to the application's premium aesthetic.

**Idea / Solution:**
- **HTML5 Drag and Drop:** Removed the up/down arrows from the `ScreeningQuestionsTab` and implemented a fully functional HTML5 Drag and Drop integration for sorting questions. The active drag row changes opacity, shows a grabbing cursor, and reorders seamlessly.
  - **KNOWN BUG:** Drag and drop is visually working but currently failing to correctly swap or persist item positions due to a state indexing issue or drag event conflict in React. Needs fixing.
- **Custom Application ConfirmModal:** Created a new, reusable `<ConfirmModal>` UI component. Replaced the jarring `window.confirm()` prompts in both `ScreeningQuestionsTab` (for question deletion) and `TeamTab` (for user activation/deactivation) with this new, native React modal featuring consistent glassmorphic styling, icon cues (⚠️/❓), and variant-colored action buttons.
- **Visual Alignment:** Updated the `ScreeningQuestionsTab` department labels to utilize the existing `.item-col-dept` class so they exactly match the fixed-column layout seen in the `TeamTab`.

**Files Modified:**
- `docs/design/pages/07_settings.md`
- `frontend/src/components/common/SlideOver.jsx`
- `frontend/src/styles/settings.css`
- `frontend/src/components/Settings/tabs/TeamTab.jsx`
- `frontend/src/components/Settings/tabs/OrganizationTab.jsx`
- `frontend/src/components/Settings/tabs/DepartmentsTab.jsx`
- `frontend/src/components/Settings/tabs/ScreeningQuestionsTab.jsx`
- `frontend/src/components/Settings/tabs/CompetitorsTab.jsx`
- `backend/routers/settings.py`
- `backend/models/settings.py`

### 76. Fix: Screening Questions Drag-and-Drop Not Persisting (resolves #75 known bug)
**Date:** 2026-06-01
**Status:** Not Fixed

**Issue:**
Drag-and-drop reordering of screening questions was visually working but the new order was not being swapped or persisted (the known bug logged in #75).

**Root Cause:**
The reorder computation lived in the `onDragEnd` handler and was gated on the React state values `dragIdx`/`dragOverIdx`. `handleDragEnter` only set `dragOverIdx` when `dragIdx !== null`, but `dragIdx` was read from a **stale render closure** — on fast drags it had just been set by `setDragIdx` in `dragStart` and the component hadn't re-rendered yet, so `dragOverIdx` frequently never got set. When that happened, the `dragIdx !== null && dragOverIdx !== null` guard in `onDragEnd` failed and the reorder silently no-opped. Meanwhile `onDrop` merely called `e.preventDefault()` and discarded the reliable source index already stored in `dataTransfer` at drag start. The backend chain (router → service → repo `UPDATE screening_questions SET sort_order ...`) was verified correct — the failure was entirely client-side.

**Idea / Solution:**
Moved the reorder computation into the standard HTML5 `onDrop` handler:
- Source index is read from `e.dataTransfer.getData('text/plain')` (reliably set in `handleDragStart`).
- Drop-target index comes from the dropped element's bound `i`.
- This removes all dependence on async React state for the computation, eliminating the stale-closure no-op. Filtered-view indices are still mapped back to the global `questions` array by `id`, so reordering works correctly under an active department filter.
- `onDragEnd` is now cleanup-only (resets opacity + drag state); `dragOverIdx` is retained purely for the visual drop-target highlight.

Verified isolated to `ScreeningQuestionsTab.jsx` — no other Settings tab uses the drag-reorder pattern. JSX transform verified clean via esbuild.

**Files Modified:**
- `frontend/src/components/Settings/tabs/ScreeningQuestionsTab.jsx`

### 77. Fix: Scorecard Rubric (Interview Templates) UI & Backend Issues
**Date:** 2026-06-01
**Status:** Fixed

**Issue / Validation:**
- The delete action for scorecard templates was silently failing because the `DELETE` backend endpoint did not exist, and the frontend `<ConfirmModal>` was not opening due to missing `isOpen` and `onClose` props.
- There was no way to edit an existing scorecard template (missing edit button and endpoint wiring).
- There was no clear way to set a template as the default; the UI showed a subtle ghost button and lacked an intuitive indicator for the active default template.

**Idea / Solution:**
- **Backend API Update:** Implemented the `DELETE /api/v1/settings/scorecard-templates/{template_id}` endpoint and `ScorecardTemplateRepository.delete()` method. Added `POST /api/v1/settings/scorecard-templates/{template_id}/set-default` endpoint to handle toggling the default template globally.
- **Frontend ConfirmModal Fix:** Correctly passed `isOpen` and `onClose` props to the native `<ConfirmModal>` in `InterviewTemplatesTab.jsx`, replacing the system-level popup and ensuring the modal actually renders and executes the delete action.
- **Edit Functionality:** Added an `openEdit` handler and wired the "Edit" pencil icon to populate the existing `<SlideOver>` form, and updated the save action to `PATCH` existing templates.
- **UI/UX Polish:** Upgraded the active default indicator to use a premium `.phase-tag` ("Active Default"), and changed the "Set Default" ghost button to a more prominent `.btn-secondary` ("Make Default") to improve usability.

**Files Modified:**
- `backend/routers/settings.py`
- `backend/services/settings_service.py`
- `backend/db/repositories/scorecard_templates.py`
- `frontend/src/components/Settings/tabs/InterviewTemplatesTab.jsx`

### 78. Fix: Remove Unwanted Shape from Phase Badges (P2/P3)
**Date:** 2026-06-01
**Status:** Fixed

**Issue / Validation:**
- The "P2" (Phase 2) badges in the Settings navigation rail and Integrations tab were displaying as an inconsistent egg/pill shape despite fixed dimensions due to flexbox container constraints.

**Idea / Solution:**
- Removed the background, border, and fixed dimensions entirely.
- Converted the badges to display as simple, bold, colored text (`var(--color-primary)` in the rail, `var(--color-warning)` in integrations) without any bounding box.

**Files Modified:**
- `frontend/src/components/Settings/SettingsPage.jsx`
- `frontend/src/components/Settings/tabs/IntegrationsTab.jsx`

### 79. Fix: Departments Tab Confirmation Modal & Department Head Redundancy
**Date:** 2026-06-01
**Status:** Fixed

**Issue / Validation:**
- Deleting a department triggered a system-level `window.confirm()` popup instead of the app's premium native modal.
- While creating a new department, the form asked for a "Department Head" user via a massive dropdown of all users, which is hard to pick from in large organizations. Furthermore, conceptually, department admins function as heads, rendering this hardcoded column redundant.

**Idea / Solution:**
- **Product Owner Validation:** Agreed with the architecture decision. A "Department" is just an organizational unit. The "head" should be dynamically resolved by identifying users with the `dept_admin` (or `team_lead`) role in that department, rather than hardcoding a `head_user_id` at creation time.
- Removed the `head_user_id` select input from the `SlideOver` creation form and removed its display from the list item subtitle.
- Replaced the jarring `window.confirm()` prompt with the standard React `<ConfirmModal>` component to ensure a consistent, premium user experience.

**Files Modified:**
- `frontend/src/components/Settings/tabs/DepartmentsTab.jsx`

### 80. Fix: Team Directory UI & Role Filter Logic
**Date:** 2026-06-01
**Status:** Fixed

**Issue / Validation:**
- In the Team Members tab, selecting "Org Head" from the Role Filter dropdown would filter out all users (since the current org head is excluded from the view), triggering the global "No team members yet" empty state unexpectedly.
- The "More Options" (vertical dots) button on each team member row was just a visual placeholder and didn't provide edit or delete actions as expected.

**Idea / Solution:**
- **Role Filter Fix:** Removed the "Org Head" option from the Role Filter dropdown entirely, as org heads typically manage other roles, not themselves. The option remains in the "Invite Member" modal as requested for transition purposes (e.g., handing over org ownership).
- **Action Buttons:** Replaced the non-functional vertical dots menu with explicit, dedicated action icons for each row:
  - An **Edit** (pencil) icon that opens the `SlideOver` to modify a user's role and department.
  - A **Deactivate/Activate** (user-minus/user-check) icon that safely toggles their access without hard-deleting the user from the ATS database.
- **Edit Functionality Implementation:** Upgraded the "Invite Member" `SlideOver` form to also function as an "Edit Member" form, automatically populating the targeted user's data and sending a `PATCH` request to the backend.

**Files Modified:**
- `frontend/src/components/Settings/tabs/TeamTab.jsx`

### 81. Enhancement: Approval Rules Modernization & Org Head Policies
**Date:** 2026-06-01
**Status:** Implemented

**Issue / Validation:**
- The Org Head was completely locked out of the Approval Rules tab, seeing a dead-end message. They had no way to configure policies globally.
- The UI relied on primitive browser `alert()` popups for success/error handling instead of a modern notification system.
- The `auto_approve_jds` toggle was a personal setting for Team Leads without any global compliance override to enforce manual JD reviews.
- A bug briefly occurred (`Cannot read properties of undefined (reading 'map')`) due to incorrect parsing of the Axios-style API wrapper response (`res.departments` vs `res.data.departments`).

**Idea / Solution:**
- **Org Head Access & Global Overrides:** Added a Department Selector dropdown for Org Heads to configure "Auto-Approve Hire Requests" for any specific department.
- **Global JD Approval Policy:** Introduced a new `allow_auto_approve_jds` column in the `organizations` table. Org Heads can now toggle this setting to enforce a global mandate that Team Leads must manually review AI-generated JDs. If disabled, the Team Lead's personal toggle is locked out with a warning message.
- **Toast Notifications:** Built a new `Toast` component and CSS module to replace native browser `alert()` calls, providing sleek, auto-dismissing inline notifications for success and error actions.
- **API Response Fix:** Corrected the data extraction paths in the frontend to properly read from the `res.data` wrapper object, preventing render crashes on data initialization.

**Files Modified:**
- `frontend/src/components/Settings/tabs/ApprovalRulesTab.jsx`
- `frontend/src/components/common/Toast.jsx` (New)
- `frontend/src/components/common/Toast.css` (New)
- `backend/db/migrations.py`
- `backend/models/settings.py`

## Issue #82: Implementation of Notifications Tab

### Problem:
The Notifications tab in Settings was merely a placeholder. Users (Hiring Managers, HR, Team Leads) lacked the ability to customize their email and in-app alert preferences, which is critical to protecting domain reputation (preventing spam complaints) and minimizing notification fatigue.

### Solution / Changes Made:
- **Database Architecture:** Added `notification_preferences` column (`JSONB`, default `{}`) to the `users` table via an incremental schema migration in `backend/db/migrations.py`. This ensures a highly scalable structure where we can add endless new notification channels/events without modifying the schema.
- **Backend Auth API:**
  - Updated `UpdateProfileRequest` in `backend/models/auth.py` to accept `notification_preferences` as an `Optional[dict]`.
  - Updated `_user_response` serialization logic to gracefully parse and return `notification_preferences`.
  - Added JSON serialization logic in `backend/routers/auth.py` before passing data to the repository layer, avoiding data type mismatch issues with PostgreSQL.
- **Data Access Layer:** Modified `UserRepository` queries (CRUD methods) to select and return `notification_preferences`.
- **Frontend Matrix UI:** 
  - Designed and built a robust `NotificationsTab.jsx` interface. 
  - Created a clean grouped matrix UI (Y-Axis: Events grouped by category, X-Axis: In-App / Email channels).
  - Wired the UI to the `PATCH /api/v1/auth/profile` endpoint with an optimistic update pattern. Errors elegantly roll back state and display a top-right Toast notification.
- **Integration:** Registered `NotificationsTab` inside `SettingsPage.jsx`, replacing the `<PlaceholderSection />`.

### Next Steps:
- Apply database migrations by restarting the backend.
- Hook up the `notification_preferences` context to actual Celery task email dispatchers (so emails respect the user's `false` flags).

### Bug Fixes Log

| Date | Component | Issue | Fix Description |
|---|---|---|---|
| 2026-06-06 | Analytics Dashboard | "Active positions" showing 0 for HR when they created the position. | The position was not auto-assigned to the HR upon creation in JD Chat. Ran a DB update to map `assigned_to = created_by` for HR users, and patched `ChatService.finish_and_save_position` and `PositionRepository.create` to automatically assign new positions to the HR user upon creation. |

### Bug Fix: Logout on Toggle
- **Issue:** Changing a notification toggle triggered an unintentional logout.
- **Cause:** The `api.patch('/auth/profile')` call returned data wrapped in an Axios `res.data` object, but the frontend was trying to set the global user state via `setUser(res.user)`. This resulted in `undefined` being pushed to the AuthContext, which cleared the session and bounced the user to the login screen.
- **Fix:** Corrected the path to `setUser(res.data.user)` in `NotificationsTab.jsx` to correctly apply the updated user profile without destroying the session.

## Issue #83: Upgrading Organization Auto-draft Capabilities

### Problem:
The Organization Profile acts as the "Brain" of the platform for AI outputs (JDs, emails). The existing `Auto-draft from Website` feature was brittle (failed when encountering bot protections) and limited (only scraped websites, whereas companies often have rich Employee Handbook PDFs).

### Solution / Changes Made:
- **Tavily Fallback Integration:** Updated `backend/routers/settings.py` so that if the naive `httpx` scrape of the website fails (e.g. 403 Forbidden due to Cloudflare), the system silently falls back to the `TavilySearchResults` API to query public web data about the company's culture and benefits.
- **Frontend Fallback UI:** Updated `OrganizationTab.jsx` to parse the new `fallback_used` boolean from the backend response. If true, it displays a warning: "⚠️ Direct scrape failed. Generated draft using public web data."
- **PDF Extraction Support:** 
  - Added a new `POST /settings/org/upload-handbook` endpoint in `backend/routers/settings.py`.
  - Used `pdfplumber` to extract text from the first 10 pages of the uploaded PDF in memory, preventing massive token consumption while still capturing core culture data.
  - Plumbed the extracted text into the same Groq LLM pipeline to generate structured JSON.
- **Frontend File Upload:** Added an invisible `<input type="file" accept="application/pdf" />` and a visible "📄 Upload PDF" button next to the Auto-draft button in `OrganizationTab.jsx` to handle the `FormData` submission seamlessly.

**Files Modified:**
- `backend/routers/settings.py`
- `frontend/src/components/Settings/tabs/OrganizationTab.jsx`

## Issue #84: Organization Tab UI/UX Polish

### Problem:
During the implementation of the Auto-Draft and PDF handbook parsing, the user feedback mechanisms were substandard. Success/Error messages were rendering at the bottom of the form (out of typical eye-line), and the loading state was merely a tiny spinner on the button, lacking the visual gravitas required for a heavy AI processing task.

### Solution / Changes Made:
- **Toast Notifications:** Stripped out the primitive `msg` state array and replaced it with the modern `<Toast />` component. The Tavily fallback warning ("⚠️ Direct scrape failed...") now correctly appears as a top-right overlay.
- **Center-Screen Loading Overlay:** Implemented a full-form glassmorphism overlay (`backdropFilter: 'blur(4px)'`) that activates when `isDrafting` is true. This forces the user to pause and draws attention to the fact that the AI is actively extracting and structuring their corporate data, significantly improving the perceived value and user experience of the tool.

**Files Modified:**
- `frontend/src/components/Settings/tabs/OrganizationTab.jsx`

## Issue #85: Competitors Intel Tab CRUD and Premium UI Upgrades

### Problem:
The Competitors Intel settings tab lacked the ability to edit existing competitors and relied on naive frontend-only limits to prevent abuse (3 competitors max). The user interface felt clunky and basic, utilizing brutalist system `window.confirm` dialogues and vertically stacking all departments, which created unnecessary cognitive load and scrolling for Org Heads managing multiple departments.

### Solution / Changes Made:
- **Backend API & Data Layer:** Added `CompetitorUpdate` Pydantic model and a robust `PATCH /api/v1/settings/competitors/{competitor_id}` endpoint.
- **Server-Side Validation:** Enforced the 3 competitors per department limit within `SettingsService.update_competitor` and `create_competitor` to ensure strict platform data integrity.
- **Application-Level Confirmation:** Replaced `window.confirm` with a polished, application-wide `ConfirmModal` component (`variant="danger"`) for all deletion events.
- **Inline Editing (SlideOver):** Integrated the existing right-side `<SlideOver>` drawer to serve as the edit interface, pre-populating fields and submitting `PATCH` requests on save.
- **Premium Accordion UI:** Transformed the vertically stacked department list into sleek, collapsible accordions. Departments are minimized by default, feature interactive headers with a quick-look capacity `Chip` (e.g. `2 / 3`), and use `chevron` icons to convey state, dramatically reducing screen real estate issues for Org Heads.
- **Visual Polish:** Enhanced the inner list rendering by encasing the "Industry" label inside a `<Chip>` component.

**Files Modified:**
- `backend/models/settings.py`
- `backend/services/settings_service.py`
- `backend/routers/settings.py`
- `frontend/src/components/Settings/tabs/CompetitorsTab.jsx`

### 86. Message Templates: Magic Draft, Tone Analyzer, and Live Preview
**Date:** 2026-06-01
**Status:** Implemented

**Issue / Validation:**
- The Message Templates tab was a basic CRUD form. It lacked the planned "AI Auto-Draft" functionality, making it tedious for recruiters to author emails.
- Users had to manually copy-paste variables like `{{candidate_name}}`, risking syntax errors.
- There was no way to preview what the parsed email would look like.
- Duplicating templates wasn't possible, slowing down the creation of slight variations (e.g., Senior vs Junior rejection emails).

**Idea / Solution:**
- **Magic Draft (AI):** Added an "✨ Auto-Draft" feature. Recruiters can input a scenario and select a tone. The backend calls Groq LLM via `POST /api/v1/settings/message-templates/auto-draft` to instantly draft the subject and body using the required variables.
- **Tone Analyzer (AI):** Added a "🔍 Analyze Tone" button that evaluates the text for warmth, professionalism, and potential bias, powered by `POST /api/v1/settings/message-templates/analyze-tone`.
- **Live Preview:** Introduced a split-pane toggle (Edit / Preview) in the SlideOver. The Preview pane renders the email as it would look in a client (like Gmail), replacing raw variables with distinct styled pill badges (e.g., `Jane Doe`) to confirm syntax correctness.
- **Variable Quick Insert:** Added clickable variable buttons below the textarea that safely insert the exact variable string at the current cursor position.
- **Duplicate Action:** Added a duplicate button to the template list to rapidly clone an existing configuration.

**Files Modified:**
- `backend/routers/settings.py`
- `frontend/src/components/Settings/tabs/MessageTemplatesTab.jsx`

---

### 87. Message Templates: Role Access, UI Cleanup, and Notifications
**Date:** 2026-06-01
**Status:** Fixed

**Issue:**
- HR and Department Admins were blocked from accessing the Message Templates tab due to improper `adminOnly` UI routing and restricted backend permissions.
- The UI had basic alerts instead of the application-level `ConfirmModal`.
- After saving edits, the editor panel remained open.
- When users added or modified a template, other stakeholders (HR, Admins) were not notified.
- The Live Preview, AI Draft, and Tone Analyzer functionality had minor glitches (e.g., missing signature block, layout issues).

**Solution:**
- **Role Permissions (RBAC):** Removed `adminOnly: true` from the `RAIL_GROUPS` configuration in `SettingsPage.jsx` and updated `backend/routers/settings.py` endpoints to use `require_hr` (which allows Org Head, Dept Admin, and HR).
- **UI Modernization & Fixes:** Integrated `ConfirmModal` for deletion. Fixed the save edit workflow to automatically call `setEditing(null)` and `fetchTemplates()` to cleanly close the UI and refresh the data.
- **Cross-Role Notifications Fan-out:** Updated `SettingsService.create_message_template` and `update_message_template` to generate system notifications for all other HR, Dept Admin, and Org Head users. Deep-linked the notifications to `/settings/templates`.
- **Duplicate Action:** Added the missing copy icon to `Icon.jsx` and ensured duplicate logic works.

**Files Modified:**
- `backend/routers/settings.py`
- `backend/services/settings_service.py`
- `frontend/src/components/Settings/SettingsPage.jsx`
- `frontend/src/components/Settings/tabs/MessageTemplatesTab.jsx`

---

### 88. Career Page Implementation & Backend Stabilization
**Date:** 2026-06-01
**Status:** Implemented & Fixed

**Issue:**
- The public-facing `/careers` directory page was entirely unbuilt, rendering as a blank white page without the premium SaaS aesthetic required by the design spec.
- The individual `/careers/:orgSlug` Career Page lacked an intuitive "Back" navigation button to return to the root directory, trapping users.
- The `get_career_fit` API endpoint and `careers.py` routers were crashing with a `500 Internal Server Error` due to referencing a non-existent `key_skills` column.
- After initial implementation, the layout suffered from significant vertical scrolling issues due to excessive padding across the Hero, Content, and Footer sections.

**Solution:**
- **Padding Reduction:** Condensed top and bottom spacing across `.ci-hero`, `.ci-content`, and `.ci-footer` by a total of nearly 200px, ensuring the Flex layout fits perfectly within standard viewports without triggering a scrollbar.
- **Backend Fixes:** Removed invalid references to the missing `key_skills` column in `backend/routers/careers.py`, stabilizing the `get_career_fit` and organization fetch endpoints.
- **Navigation Improvement:** Implemented a glassmorphic "Back to Explore" button on `CareerPage.jsx` for smooth directory navigation.
- **Aesthetic Overhaul:** Finalized the Career Page with a premium "AI Infrastructure" dark theme, multi-layered mesh gradients, dynamic shimmer animations, and fluid 3D hover effects driven by organization-specific brand colors.

**Files Modified:**
- `frontend/src/components/Careers/CareersIndexPage.css`
- `frontend/src/components/Careers/CareersIndexPage.jsx`
- `frontend/src/components/Careers/CareerPage.jsx`
- `backend/routers/careers.py`

---

### 89. Critical: Email Service 500 Error on Hire Request Creation
**Date:** 2026-06-02
**Status:** Fixed

**Issue:**
Every hire request creation call returned a `500 Internal Server Error`. Root cause: `EmailService._safe_url()` had two bugs — it raised `ValueError` for relative paths (e.g. `/hire-requests/8`) instead of resolving them, and it called itself recursively (`return _safe_url(url)`) causing infinite recursion before ever raising the ValueError.

**Solution:**
Rewrote `_safe_url` in `backend/services/email_service.py`:
1. Returns `""` immediately for empty input.
2. Auto-prepends `settings.FRONTEND_URL` for any path that starts with `/`, converting relative paths to absolute URLs before validation.
3. Raises `ValueError` only for genuinely unsafe schemes (not `http://` or `https://`).
4. Returns `html.escape(url, quote=True)` — the correct HTML-escaped URL, not a recursive self-call.

**Files Modified:**
- `backend/services/email_service.py`

---

### 90. JD Rejection Requires Mandatory Feedback Note
**Date:** 2026-06-02
**Status:** Fixed

**Issue:**
Team Leads could click "Request Changes" on a JD without providing any written feedback. HR then received a silent rejection with no actionable guidance on what to fix, creating a communication dead-end.

**Solution:**
- **Backend:** Added validation in `POST /api/v1/positions/{id}/approval-decision`. When `decision == 'changes_requested'`, an empty `notes` field now returns `422 NOTES_REQUIRED`.
- **Frontend (Dashboard):** Updated `MyHireRequests` in `LegacyDashboard.jsx`. "Request Changes" now shows an inline textarea (red-bordered) with an autofocus. The "Send Feedback" button stays disabled until a note is typed. On success, the inline form closes and the requests reload. The `positionsApi.approvalDecision()` already accepted a `notes` parameter, so no API util change was needed.

**Files Modified:**
- `backend/routers/positions.py`
- `frontend/src/components/Dashboard/legacy/LegacyDashboard.jsx`

---

### 91. Premium Git-Diff Style Bias Checker UI
**Date:** 2026-06-02
**Status:** Improved

**Issue:**
The bias checker in `FinalJDCard.jsx` rendered inline changes with a basic dashed border and plain text. It lacked the visual clarity needed to quickly distinguish what was being removed vs. suggested, and there was no way to batch-accept all fixes at once.

**Solution:**
Upgraded `renderDiffContent()` in `FinalJDCard.jsx`:
1. **Git-diff layout:** Each suggestion now renders as an inline pill with two color-coded halves — a red panel (`−` prefix, strikethrough text) and a green panel (`+` prefix, underline-free insertion).
2. **Category badges:** A small color-coded label (`gender`, `age`, `ability`, or `bias`) appears per suggestion so reviewers know *why* a phrase is flagged.
3. **Accepted state rendering:** Accepted fixes now show the replacement text with a subtle green background instead of disappearing.
4. **Summary banner:** A `diff` badge banner above the content shows the pending count and an "Accept all (N)" shortcut button when there are ≥ 2 suggestions.

**Files Modified:**
- `frontend/src/components/Chat/cards/FinalJDCard.jsx`

---

### 92. Drag-and-Drop Screening Questions: Stale Closure Fix
**Date:** 2026-06-02
**Status:** Fixed

**Issue:**
Drag-and-drop reordering of Screening Questions silently no-oped on fast drags. The `handleDrop` function was reading `dragIdx` from React state, which could be stale by the time the async drop event fired — causing `dragIdx === dropIdx` checks to incorrectly bail out.

**Solution:**
- Replaced `dragIdx` useState with `dragIdxRef = useRef(null)` so the drag source index is always current regardless of render cycles.
- All drag handlers (`handleDragStart`, `handleDragEnter`, `handleDrop`, `handleDragEnd`) now read/write `dragIdxRef.current` instead of calling `setDragIdx`.
- Added `onDragLeave` handler to clear the `dragOverIdx` highlight only when the cursor leaves the row boundary (not when entering child elements), preventing visual flickering.
- Added `useRef` to the React import.

**Files Modified:**
- `frontend/src/components/Settings/tabs/ScreeningQuestionsTab.jsx`

---

## 93. Resume Chat Starts Blank Instead of Pre-seeding JD Context

**Problem Statement:**
When HR deleted a draft JD chat session and then clicked "Resume AI Chat" from the Position Detail page (JD tab), the chat opened completely blank — no role name, no department, no requirements pre-filled. The agent asked HR to describe the role from scratch, even though all the hire request data was already known. This was inconsistent with the "Pick up & start JD chat" flow from the Hire Request Detail page, which correctly auto-seeds the context.

**Idea / Solution:**
Three-part fix to close the gap:

1. **`JDTab.jsx`**: The "Resume AI Chat" button was navigating to `/chat/${session_id}` with no `location.state`. Updated to pass position fields (`role_name`, `department_name`, `headcount`, `work_type`, `location`, `experience_min`, `experience_max`) as `hireRequest` in router state — matching the shape the chat page already expects.

2. **`ChatContext.jsx`**: Added a `sessionLoaded` boolean flag (default `false`). `loadSession` sets it to `false` at start and `true` in a `finally` block (covers success, 404, and errors). `resetChat` also sets it to `true` (fresh chat counts as immediately loaded).

3. **`ChatPage.jsx`**: The auto-seed effect previously used `messages.length > 0` as a guard, which fired prematurely on the first render (before `loadSession` completed) — causing a race where sessions with real history could receive a spurious seed message. New logic: (a) gate on `sessionId && !sessionLoaded` to wait for load completion, (b) check `messages.some(m => m.role === 'user')` instead of total count so the GREETING message doesn't block seeding on empty sessions.

**Files Modified:**
- `frontend/src/components/Positions/tabs/JDTab.jsx`
- `frontend/src/context/ChatContext.jsx`
- `frontend/src/components/Chat/ChatPage.jsx`

---

## 94. Internal Skills Check Card Silently Skipped When No Past JDs Found

**Problem Statement:**
When the internal analyst found no matching past JDs for the role, the entire Stage 2 ("Internal skills check") card was silently skipped — `awaiting_user_input` was set to `false`, the stage auto-advanced to `market_research`, and `card_internal` was never emitted. HR experienced an inconsistent flow: some runs showed the card, others jumped straight to market research with no explanation. The stepper also skipped Stage 2 entirely in these cases.

**Idea / Solution:**

1. **`internal_analyst.py`**: Removed the auto-advance logic for the empty-skills path. When no skills are found, the node now sets `stage = "internal_check"` and `awaiting_user_input = True` — same as the non-empty path. The `internal_skipped` flag is no longer set by the backend; it's only set later by the user's explicit `skip_internal` action.

2. **`chat_service.py`**: The card emission guard was `if internal_skills and ...` — an empty Python list is falsy, so the card was never emitted. Changed to `if current_stage == "internal_check" and not internal_skills_accepted` — emits `card_internal` with an empty array when applicable.

3. **`ChatContext.jsx`**: The graph_state restore on session load used `?.length` to conditionally restore `internalCard`, so empty-array results were silently ignored. Changed to `Array.isArray(gs.internal_skills_found) && !gs.internal_skipped && !gs.internal_skills_accepted?.length` — restores the card even when the list is empty (provided the user hasn't already acted).

4. **`AgentBlockInternal.jsx`**: Removed the early `return null` guard. When skills are empty, renders an `AgentBlockShell` with subtitle "No similar past roles found" and a "Continue" button (fires `skip_internal`) instead of nothing.

**Files Modified:**
- `backend/agents/nodes/internal_analyst.py`
- `backend/services/chat_service.py`
- `frontend/src/context/ChatContext.jsx`
- `frontend/src/components/Chat/blocks/AgentBlockInternal.jsx`

---

## 95. JD Variants Refine Bar Visually Broken on Dark Theme

**Problem Statement:**
The "regenerate variants" input row below the JD variant cards was using `var(--border, #e5e7eb)` with a light-mode hex fallback. On the dark-themed UI, the input rendered with a washed-out light border and the wrong background, looking like a generic HTML form element disconnected from the rest of the product design.

**Idea / Solution:**
Replaced the `.variant-regenerate` / `.variant-regenerate-input` styles with a new `.variant-refine-bar` command-bar component:
- Pill-shaped container with `var(--color-bg-tertiary)` background and `var(--border-100)` border, glowing teal on `:focus-within`
- Input is fully transparent with correct `var(--color-text-primary)` and muted placeholder
- Compact "Regenerate" button with icon, correct dark-theme border, teal hover transition
- Enter-key submit added to the input
- Variant cards updated to have a visible default border (`var(--border-100)`) and `var(--color-bg-tertiary)` background instead of transparent, giving them visual presence at rest

**Files Modified:**
- `frontend/src/styles/chat.css`
- `frontend/src/components/Chat/blocks/AgentBlockVariants.jsx`

---

## 96. Bias Diff: Stale Counter, No Navigation, and Stale Closure on Handlers

**Problem Statement:**
Three related issues with the inclusivity (bias) diff UI in the Final JD card:

1. **No navigation**: When bias check returned multiple suggestions, there was no way to jump between them — users had to manually scroll through the entire document to find pending inline diffs, which was easy to miss.
2. **Phantom counter**: The "1 suggestion found" banner could persist after accepting items because `window.acceptBiasFix` and `window.rejectBiasFix` were registered once with `[pendingFixes]` as the dependency. This created a stale closure when multiple fixes existed — accepting fix N updated state, but the DOM-injected buttons still called the old handler which had the pre-accept `pendingFixes` snapshot.
3. **No auto-advance**: After accepting or rejecting a suggestion, focus stayed at the same position rather than moving to the next pending item.

**Idea / Solution:**

1. **Navigation**: Added `focusedDiffIdx` state and `pendingIndices` memo. The diff banner now shows "X / N" position counter plus ↑ / ↓ arrow buttons (`goToPrevFix` / `goToNextFix`). The focused widget gets a teal outline ring (`outline: 2px solid #0D9488`). A `useEffect` scrolls to `[data-idx="${focusedDiffIdx}"]` with smooth behavior on focus change.

2. **Stale closure fix**: Replaced the `[pendingFixes]`-dependent `useEffect` for `window.acceptBiasFix` with the "latest-ref" pattern — `acceptFixRef` and `rejectFixRef` are updated every render via bare `useEffect(() => { ref.current = handler })`, and `window.acceptBiasFix` calls `ref.current` instead of the captured closure. The global registration effect now runs only once (`[]` deps).

3. **Auto-advance**: `handleAcceptFix` and `handleRejectFix` are now `useCallback` functions. Inside the `setPendingFixes` updater, they compute the remaining pending indices from the updated array and call `advanceFocus` to move to the next (or previous if at the end) pending item.

**Files Modified:**
- `frontend/src/components/Chat/cards/FinalJDCard.jsx`

---

## 97. Dev Admin: Reset Positions Leaving Orphaned Hire Requests

**Problem Statement:**
The `/dev/reset/positions` endpoint deleted positions and applications but did not delete hire requests. After a reset, hire requests remained in the database referencing non-existent positions, causing referential noise in testing sessions and skewed counts in the HR pipeline.

**Idea / Solution:**
Added `DELETE FROM hire_requests` to both the org-scoped and global paths in the `reset_positions` endpoint. Also added `hire_requests` deletion to the full org data wipe endpoint for consistency. Updated log message to reflect both entities.

**Files Modified:**
- `backend/routers/dev_admin.py`

---

## 98. HireRequestService Missing `priority` Parameter in Position Creation

**Problem Statement:**
The `create_position_from_session` method in `HireRequestService` was not forwarding the `priority` field when creating a position. The `priority` parameter was accepted in the method signature but was not being passed to the repository call, so positions always got the default priority regardless of what was set on the hire request.

**Idea / Solution:**
Added `priority=priority` to the `PositionRepository.create()` call inside `HireRequestService.create_position_from_session`.

**Files Modified:**
- `backend/services/hire_request_service.py`

---

## 99. JD Chat Read-Only Mode Not Enforced During Pending Approval

**Problem Statement:**
After HR submitted a JD for team lead approval, reopening the position's chat allowed full interaction — HR could still send messages, click "Save Draft", "Finalize JD", and use the bias check. The chat should be locked read-only while approval is pending.

**Root Cause:**
`submit_for_approval` sets `approval_status='pending'` but leaves `p.status='draft'`. The ChatContext read-only check only examined `position_status` (p.status), which stays `'draft'` and is always in the editable allowlist. The `position_approval_status` field was returned by the session API but never used. Additionally, `FinalizeCTA.jsx` (the rail button) had no `isReadOnly` check at all.

**Idea / Solution:**
1. Updated `ChatContext.jsx` read-only check to also evaluate `position_approval_status === 'pending'`.
2. Added `isReadOnly` guard to `FinalizeCTA.jsx` (`canFinalize = ... && !isReadOnly`).
3. Added an amber read-only banner in `ChatTopBar.jsx` — shown when `isReadOnly` is true so HR knows why editing is disabled.

**Files Modified:**
- `frontend/src/context/ChatContext.jsx`
- `frontend/src/components/Chat/FinalizeCTA.jsx`
- `frontend/src/components/Chat/ChatTopBar.jsx`

---

## 100. Position Detail Shows Duplicate Approval Banners

**Problem Statement:**
When a position was pending approval, two overlapping warnings appeared: a full-width banner in the hero ("Awaiting team-lead approval. Candidate sourcing is paused…") visible to all users, and the JD review card in the JD tab for team leads. This was redundant and the hero banner showed for every user regardless of role.

**Idea / Solution:**
Removed the full-width `pd-approval-banner` from `PositionHero.jsx`. Instead, the existing status chip in the hero title row now shows "Pending Review" in amber (`warning` variant) when `approval_status === 'pending'`. One contextual signal replaces two banners.

**Files Modified:**
- `frontend/src/components/Positions/PositionHero.jsx`

---

## 101. "Request Changes" Button Broken — Wrong Decision Value + No Notes Input

**Problem Statement:**
The team lead's "Request Changes" button in the JD review card was silently failing with a browser `alert()` dialog. The error was a 422 from the backend because the frontend sent `decision='rejected'` but the backend only accepts `'approved'` or `'changes_requested'`. Additionally, there was no way for the team lead to provide feedback — the notes field was hardcoded to the string `'Changes requested'`.

**Root Cause:**
`handleDecision('rejected')` in `JDTab.jsx` used the wrong decision key. The backend's INVALID_DECISION guard caught it and returned 422. The catch block surfaced it via `alert()` (a browser native dialog). No notes textarea existed.

**Idea / Solution:**
1. "Request Changes" now opens an inline modal with a required textarea for feedback.
2. The submit handler calls `approvalDecision(id, 'changes_requested', notes)` with the correct decision value.
3. All `alert()` calls replaced with inline `decisionError` / `changesError` banners.
4. Submit button is disabled until the textarea has content.

**Files Modified:**
- `frontend/src/components/Positions/tabs/JDTab.jsx`

---

## 102. Team Lead Feedback Notes Not Visible in Position After Changes Requested

**Problem Statement:**
After a team lead clicked "Request Changes" and provided feedback, the notes were only stored in the notification JSON. HR could only read them from the notification, but selecting text in the notification triggered navigation instead of copying. The feedback was not anchored anywhere on the JD/position view.

**Idea / Solution:**
1. Added `review_notes TEXT` column to the `positions` table via an idempotent migration.
2. On `changes_requested`, `position_service.py` now persists the notes to `positions.review_notes`. On `approved`, it clears the field.
3. `JDTab.jsx` now shows a "Team Lead Feedback" amber info box above the JD when `approval_status === 'changes_requested'` and `review_notes` is non-null. Text is selectable (`user-select: text`).

**Files Modified:**
- `backend/db/migrations.py`
- `backend/services/position_service.py`
- `frontend/src/components/Positions/tabs/JDTab.jsx`

---

## 103. JD Canvas Text Color Inconsistent After AI Update

**Problem Statement:**
After the AI updated a JD via chat refinement, newly added paragraph/list text appeared bright white while section headers were muted, creating a visual mismatch.

**Root Cause:**
`.jd-body p { color: var(--color-text-primary) }` came after `.jd-doc p { color: var(--color-text-secondary) }` in the CSS with equal specificity, so `.jd-body p` won — making paragraph text white. List items had no explicit color and inherited root white. Section headers (`h2`) correctly got `--color-text-tertiary` from `.jd-doc h2`. This made p/li white vs. muted h2.

**Idea / Solution:**
Changed `.jd-body p` to use `var(--color-text-secondary)` and added explicit `color: var(--color-text-secondary)` to `.jd-body ul`, `.jd-body ol`, and `.jd-body li`. All body text now consistently uses secondary color.

**Files Modified:**
- `frontend/src/styles/chat.css`

---

## 104. Bias Check Not Re-triggered After JD AI Update; Finalize JD Not Gated on Bias Check

**Problem Statement:**
After the AI refined the JD via chat, the "Run Inclusivity Check" button remained disabled (previous check still shown as done). HR could also click "Finalize JD" without ever running a bias check.

**Root Cause:**
`biasCheckDone` state in `FinalJDCard.jsx` was never reset when `finalJdMarkdown` changed due to an AI update. The Finalize JD button used `disabled={isBusy}` (only blocked while running), not when the check hadn't been run at all.

**Idea / Solution:**
1. Added `prevFinalJdRef` to track previous `finalJdMarkdown`. When it changes post-mount (AI update), `biasCheckDone`, `pendingFixes`, and `focusedDiffIdx` are reset — re-enabling the bias check button.
2. Changed Finalize JD button `disabled` to `isBusy || !biasCheckDone` with tooltip "Run inclusivity check before finalizing".

**Files Modified:**
- `frontend/src/components/Chat/cards/FinalJDCard.jsx`

---

## 105. Settings Page Scrolls Vertically; Header Wastes Space; No-Right-Rail Has No CSS

**Problem Statement:**
The Settings page scrolled the entire viewport instead of being a fixed full-height panel. The "Workspace Settings" header consumed ~70px of vertical space redundantly (user already knows they're in Settings from the sidebar). The `no-right-rail` CSS class applied by JSX had no matching CSS rule, causing the hidden right preview column to still allocate its 300px grid slot.

**Root Cause:**
Three layered failures in the height chain:
1. `.app-layout` used `min-height: 100vh` (grows with content) instead of `height: 100vh` (bounded)
2. `.app-main` had no `overflow-y: auto` or `min-height: 0`, so flex children couldn't be bounded
3. `.st-page` had no `display: flex; flex-direction: column; height: 100%`, so `.st-layout`'s `flex: 1` was inert

**Idea / Solution:**
1. Changed `.app-layout` to `height: 100vh; overflow: hidden`
2. Added `min-height: 0; overflow-y: auto` to `.app-main` (all pages now scroll within the panel, not the full viewport)
3. Added `height: 100%; display: flex; flex-direction: column; overflow: hidden` to `.st-page`
4. Removed the `.st-header` ("Workspace Settings" title + subtitle) entirely — redundant happy talk
5. Added `.st-layout.no-right-rail { grid-template-columns: 240px 1fr }` to reclaim the 300px ghost column

**Files Modified:**
- `frontend/src/styles/layout.css`
- `frontend/src/styles/settings.css`
- `frontend/src/components/Settings/SettingsPage.jsx`

---

## 106. JD Chat Shows Browser alert() Dialogs Instead of App Toast

**Problem Statement:**
File upload errors in the JD chat (file too large, parse failure, network failure) triggered native browser `alert()` dialogs — a jarring system-level UI that breaks the in-app experience.

**Root Cause:**
`MessageInput.jsx` used `alert()` for three error conditions (file size limit, file parse error, upload network failure). The app has a `Toast` component in `components/common/Toast.jsx` but it was not wired into `MessageInput`.

**Idea / Solution:**
Imported `Toast` into `MessageInput.jsx`, added local `toast` state, replaced all three `alert()` calls with `setToast({ message, type: 'error' })`, and rendered `<Toast>` inside the composer wrapper.

**Files Modified:**
- `frontend/src/components/Chat/MessageInput.jsx`

---

## 107. "New Hire" Sidebar Click Shows System window.confirm Dialog

**Problem Statement:**
Clicking "New Hire" in the sidebar while mid-session showed a browser-native `window.confirm("Abandon current JD?")` dialog. This is a system-level UI inconsistent with the app, and the guard is unnecessary since sessions are saved and accessible from the session list in the sidebar.

**Idea / Solution:**
Removed the conditional and confirm dialog. `handleNewHire` now always calls `resetChat()` and navigates to `/chat`. Sessions persist in the sidebar list and can always be resumed.

**Files Modified:**
- `frontend/src/components/Sidebar/Sidebar.jsx`

---

## 108. "New Hire" Click Shows Old Session Messages Instead of Greeting

**Problem Statement:**
When HR navigated from a chat session to the "New Hire" page (via sidebar or positions list), the previous session's messages briefly showed (or persisted) before the GREETING appeared. This happened because `ChatContext` initialized `messages` as `[]`, and `resetChat()` only runs inside a `useEffect` — after the first render, which shows stale context state.

**Root Cause:**
`ChatContext` initial state: `useState([])`. On navigation to `/chat`, ChatPage renders with whatever was in ChatContext (old session messages), then the `useEffect` fires and calls `resetChat()` → GREETING replaces them. The render-before-effect gap made old messages visible.

**Idea / Solution:**
Changed `ChatContext` initial `messages` state from `useState([])` to `useState([GREETING])`. Now the default state is always the greeting, so any render at `/chat` before `resetChat()` fires still shows the correct greeting.

**Files Modified:**
- `frontend/src/context/ChatContext.jsx`

---

## 109. Resume AI Chat Triggers AI Auto-Response After Session Deleted

**Problem Statement:**
When HR deleted the chat session and then clicked "Resume AI Chat" from the position details page, the chat auto-sent a hire request intake message and the AI responded by asking about skills/requirements — even though the JD already existed. The chat appeared to "restore" but immediately launched an unsolicited AI response.

**Root Cause:**
`JDTab.jsx` passed `hireRequest` in `location.state` when navigating to "Resume AI Chat". When the session was deleted (404), `loadSession` reset `workflowStage` to `'intake'` and `messages` to `[GREETING]`. The auto-seed `useEffect` in `ChatPage.jsx` then detected `workflowStage === 'intake'` + no user messages + `hireRequest` in state → automatically sent the position data, triggering AI intake questions.

**Idea / Solution:**
Removed `state` from the `navigate()` call in the "Resume AI Chat" button in `JDTab.jsx`. The session URL (`/chat/${session_id}`) is sufficient: if the session exists it loads from DB; if deleted, it shows the GREETING and HR starts a fresh conversation. The `hireRequest` state key is reserved for the hire-requests pickup flow.

**Files Modified:**
- `frontend/src/components/Positions/tabs/JDTab.jsx`

---

## 110. GET /positions/{id}/pipeline-summary → 500: operator does not exist: text ->> unknown

**Problem Statement:**
Loading the pipeline summary for any position returned a 500 error, breaking the pipeline analytics panel on position detail pages.

**Root Cause:**
`pipeline_events.event_data` is defined as `TEXT` in the schema (`migrations.py:355`). The `get_pipeline_summary` endpoint used the `->>` JSON extraction operator directly on this column (`event_data->>'from_status'`, `event_data->>'to_status'`). PostgreSQL's `->>` operator only works on `json`/`jsonb` types — applying it to `text` raises `UndefinedFunctionError: operator does not exist: text ->> unknown`.

**Idea / Solution:**
Cast `event_data` to `jsonb` inline at every point of use: `event_data::jsonb->>'key'`. This avoids a schema migration (the data is already valid JSON stored as text) and fixes all 6 affected expressions in the two pipeline-events queries.

**Files Modified:**
- `backend/routers/positions.py`

---

## 111. JD Generation Workflow — Design Rev 4 Implementation

**Date:** 2026-06-02

**Problem Statement:**
The existing hire request lifecycle used a simple `pending → approved → rejected` model with no admin reviewing lock, no atomic HR pickup, no reviewer resolution strategy, and no revision cycle tracking. The JD generation workflow design (Rev 4) specified a much richer state machine with atomic CAS patterns, admin_reviewing locks with TTL/takeover, approved_modified with JSONB diffs, and idempotent feedback injection into chat sessions.

**Scope of Changes:**

### Phase 1: Database Migrations (`migrations.py`)
Added 14 new columns across 3 tables:
- **positions:** `picked_up_by`, `picked_up_at`, `revision_cycle`, `reviewer_id`, `submitted_by_role`, `reviewer_role_at_submit`, `submitted_at`
- **hire_requests:** `reviewing_locked_by`, `reviewing_locked_at`, `modification_diff`, `notes`
- **chat_messages:** `message_type`, `revision_cycle`
- **Index:** `uq_chat_feedback_injection` — partial unique index for idempotent feedback injection

### Phase 2: Repository Layer (`hire_requests.py`)
Complete rewrite with:
- Updated `_BASE_RETURN` and `_LIST_SELECT` to include new columns (lock user, diff, notes, position stats)
- `begin_review()` — atomic CAS: submitted → admin_reviewing
- `takeover_review()` — stale lock takeover after 10 minutes
- `release_review_lock()` — admin_reviewing → submitted
- `release_expired_locks()` — background job for 30-min TTL cleanup
- `approve_modified()` — stores JSONB diff with schema_version
- `cancel()` updated to accept optional notes and clear locks
- All terminal transitions now clear `reviewing_locked_by/at`

### Phase 3: Repository Layer (`positions.py`)
- Added new workflow columns to `allowed` update set
- `atomic_hr_pickup()` — CAS guard: picked_up_by IS NULL AND status = 'draft'
- `submit_for_jd_approval()` — writes reviewer_id, submitted_by_role, reviewer_role_at_submit authority snapshot
- `increment_revision_cycle()` — counter for feedback loops

### Phase 4: Service Layer (`hire_request_service.py`)
- Updated STATUSES set to include `submitted`, `admin_reviewing`, `approved_modified`
- Updated lifecycle docstring to Design Rev 4
- `begin_review()` — CAS + takeover + idempotent re-entry + audit
- `release_review()` — lock release with ownership check (only locker or org_head)
- `approve_modified()` — full approval flow with notifications + email + audit
- `accept()` updated to accept `approved_modified` status
- `cancel()` updated to pass notes to repository

### Phase 5: Service Layer (`position_service.py`)
- `submit_for_approval()` — replaced bare SQL with `PositionRepository.submit_for_jd_approval()`
- Implemented Reviewer Resolution Strategy:
  1. If hire request was raised by a team_lead → that person reviews
  2. Else → first team_lead in the department
  3. Else → first org_head
- Authority snapshotting at submit time (submitter_role, reviewer_role_at_submit)

### Phase 6: Router Layer (`hire_requests.py`)
Added 4 new API endpoints:
- `POST /api/v1/hire-requests/{id}/begin-review` — atomic admin lock
- `POST /api/v1/hire-requests/{id}/release-review` — lock release
- `POST /api/v1/hire-requests/{id}/approve-modified` — approve with JSONB diff
- `POST /api/v1/hire-requests/{id}/withdraw` — cancel before HR pickup
- Added `HireRequestApproveModified` Pydantic model (inline, notes required)
- Added pydantic `BaseModel`/`field_validator` imports

**Files Modified:**
- `backend/db/migrations.py` (new migration blocks)
- `backend/db/repositories/hire_requests.py` (full rewrite)
- `backend/db/repositories/positions.py` (new methods + allowed fields)
- `backend/services/hire_request_service.py` (new methods + status updates)
- `backend/services/position_service.py` (reviewer resolution)
- `backend/routers/hire_requests.py` (4 new endpoints)

**Design Docs Reference:**
- `docs/design/jd_generation_workflow_design.md`
- `docs/design/state_machines.md`
- `docs/design/schema_gap_analysis.md`

---

## 112. Transition Guard Mismatches (State Machine Bug Fix)

**Date:** 2026-06-02

**Problem Statement:**
Three critical state transition guard mismatches existed between the service layer and the Design Rev 4 state machine:

1. **begin_review repo**: CAS SQL only matched `status = 'submitted'`, but existing hire requests use `pending` as the initial status. The service allowed `pending` but the repo silently returned False (0 rows updated), causing a confusing "Could not acquire review lock" error.
2. **approve_request**: Only accepted `pending` status, but admin should approve from `admin_reviewing` (the Design Rev 4 primary approval state).
3. **reject_request**: Same issue — only accepted `pending`.
4. **accept check**: Only blocked `pending`, didn't block `submitted` or `admin_reviewing`.

**Idea / Solution:**
- `begin_review` repo: `AND status = 'submitted'` → `AND status IN ('pending', 'submitted')` (backward compatibility)
- `approve_request` service: `!= 'pending'` → `not in ('pending', 'submitted', 'admin_reviewing')`
- `reject_request` service: Same guard update
- `accept` check: `== 'pending'` → `in ('pending', 'submitted', 'admin_reviewing')` with updated error message

**Files Modified:**
- `backend/db/repositories/hire_requests.py` (line 383)
- `backend/services/hire_request_service.py` (lines 469, 588, 717)

---

## 113. Idempotent Feedback Injection into Chat Sessions

**Date:** 2026-06-02

**Problem Statement:**
When a reviewer requested changes on a JD, the feedback notes were stored on the position row (`review_notes`) but never appeared in the HR recruiter's chat session. The recruiter had to navigate away from the chat to see what needed to change — breaking the conversational workflow.

**Idea / Solution:**
In `PositionService.record_approval_decision`, when `decision = 'changes_requested'`:

1. Increment `positions.revision_cycle` via `PositionRepository.increment_revision_cycle()`
2. Find the most recent chat session linked to this position
3. Insert a `chat_messages` row with `message_type='feedback_injection'` and `revision_cycle=N`
4. The partial unique index `uq_chat_feedback_injection` guarantees exactly-once insertion per cycle, even on concurrent retries (`ON CONFLICT ... DO NOTHING`)

The injected message renders as a system message in the chat with the reviewer's feedback in-context.

**Files Modified:**
- `backend/services/position_service.py` (lines 388–440)

---

## 114. Celery Periodic Task — Stale Review Lock Cleanup

**Date:** 2026-06-02

**Problem Statement:**
If an admin opens a hire request for review (`admin_reviewing`) and then closes the browser without approving/rejecting/releasing, the lock would persist indefinitely. No other admin could pick up the request, creating a workflow deadlock.

**Idea / Solution:**
Created `backend/tasks/hire_request_locks.py` with a `release_stale_review_locks` Celery task that:
- Runs every 5 minutes via Celery Beat
- Calls `HireRequestRepository.release_expired_locks()` which releases locks older than 30 minutes
- Transitions expired requests back to `submitted` status
- Lock lifecycle: Fresh (<10 min) → Stale (10–30 min, takeover-eligible via API) → Expired (>30 min, auto-released by this task)

Registered the task in `celery_app.py`:
- Added to `include` list
- Added beat_schedule entry with 300-second (5-minute) interval

**Files Modified:**
- `backend/tasks/hire_request_locks.py` (new file)
- `backend/celery_app.py` (include list + beat_schedule)

---

## 115. JD Generation Workflow — Full 25-Item Implementation (Design Rev 4)

**Date:** 2026-06-02

### Item 4: Remove phantom `approved` state — direct `pending_jd_approval → open`

**Problem:** Positions transitioned through a phantom `approval_status='approved'` intermediate state before becoming `open`. This caused a race window where sourcing could fire twice.

**Solution:** Replaced inline SQL with atomic `PositionRepository.approve_and_open()` CAS method that goes directly from `pending_jd_approval → open` with `approval_status='approved'` in a single atomic UPDATE. The CAS guard (`WHERE status = 'pending_jd_approval'`) prevents double-fire entirely.

### Item 6: TL cancel-after-pickup (`jd_in_progress → cancelled`)

**Problem:** No mechanism for a team lead to cancel a position after HR picks it up but before submission. TLs had to wait for HR to submit and then reject, creating unnecessary cycles.

**Solution:** New `PositionService.cancel_jd_in_progress()` + `POST /api/v1/positions/{id}/cancel-jd` endpoint. Guards: status must be `jd_in_progress`, caller must be `team_lead` or `org_head`, mandatory cancellation notes. Notifies the HR who picked it up.

### Item 7: HR withdraw submission (`pending_jd_approval → jd_in_progress`)

**Problem:** Once HR submitted a JD for approval, there was no way to retract it. If the HR realized they made a mistake, they had to wait for the reviewer to reject, wasting the reviewer's time.

**Solution:** New `PositionService.withdraw_submission()` + `POST /api/v1/positions/{id}/withdraw-submission` endpoint. Resets `approval_status`, `reviewer_id`, `submitted_at`, `review_notes` to null. Notifies the reviewer. `revision_cycle` does NOT increment (not a reviewer-initiated change).

### Item 9: Cross-dept authority check in approve endpoint

**Problem:** Any team_lead or dept_admin could approve any position, regardless of department affiliation. A TL from Engineering could approve a Marketing JD.

**Solution:** In `record_approval_decision()`, non-org_head approvers are now validated: (1) they must be the assigned `reviewer_id` on the position, (2) their `department_id` must match the position's `department_id`. Raises `PermissionError` on mismatch, surfaced as HTTP 403.

### Item 10: Transactional ATS config + status in submit

**Problem:** ATS config (threshold, search interval) was set separately from the submission status transition, creating a window where config could be lost on failure.

**Solution:** `submit_for_approval()` now accepts optional `ats_threshold` and `search_interval_hours` params. Updates ATS config atomically within the same connection context as the status transition.

### Item 11: Post-approval single transaction; async jobs after commit

**Problem:** Approval mutations (position status, hire_request fulfillment) were not in a single transaction. A crash between them would leave inconsistent state.

**Solution:** Wrapped approve/reject logic in `async with conn.transaction()`. On approval: `PositionRepository.approve_and_open()` + `PositionRepository.fulfill_hire_request()` execute in the same transaction. Celery sourcing, email, and notifications fire after commit.

### Item 12: Reviewer deletion trigger — re-resolve on user delete/deactivate

**Problem:** If a reviewer was deleted/deactivated, positions pending their review would be stuck indefinitely.

**Solution:** New `PositionService.re_resolve_reviewers_on_user_delete(deleted_user_id, org_id)` method + `PositionRepository.get_positions_pending_review_by_user()` + `reassign_reviewer()`. Cascades: dept_admin → org_head fallback. Notifies the new reviewer.

### Item 16: Reviewer preview — `/resolve-reviewer` endpoint

**Problem:** The chat UI had no way to show who would review the JD before the HR submits. The reviewer name only appeared after submission.

**Solution:** New `GET /api/v1/positions/resolve-reviewer?position_id=X` endpoint. Returns `{ reviewer_id, reviewer_name, reviewer_role, department, is_bypass, warning }`. Called by the FinalJDCard when chat reaches the `final_jd` stage.

### Item 17: Block submit when no reviewer can be resolved

**Problem:** If no team_lead, dept_admin, or org_head existed, the submission would go through with `reviewer_id = null`, creating an unreviewable position.

**Solution:** In `submit_for_approval()`, after `resolve_reviewer()` returns, if `reviewer_id` is None and the user is not an org_head, a `ValueError` is raised: "No reviewer available. Ask your workspace admin to assign an org head."

### Item 19: Org_head bypass in Flow 2

**Problem:** When an org_head creates a JD directly (Flow 2), the position still went through the `pending_jd_approval` queue — requiring the org_head to approve their own work.

**Solution:** In `resolve_reviewer()`, if the creator's role is `org_head`, returns `is_bypass=True`. In `submit_for_approval()`, on bypass: calls `PositionRepository.org_head_direct_approve()` which sets `status='open'` + `approval_status='approved'` + fulfills the hire_request in a single transaction, then fires Celery sourcing. Skips the review queue entirely.

### Item 20: Flow 2 reviewer resolution (full department matrix)

**Problem:** Reviewer resolution only used a simple TL → org_head fallback. The design doc specifies a full matrix: `dept_admin → org_head`, `hr + dept → dept_admin → org_head`, `hr + no dept → org_head`, with self-approval blocking.

**Solution:** Complete rewrite of `resolve_reviewer()` with the full matrix logic. Checks org settings for approval toggles (Item 21). Blocks self-approval by escalating to an alternative org_head.

### Item 21: Approval Rules settings (2 toggles)

**Problem:** No way to configure whether HR or dept_admin submissions require review.

**Solution:** `resolve_reviewer()` reads `organizations.settings` JSONB for two keys: `direct_hire_hr_requires_review` (default: true) and `direct_hire_dept_admin_requires_org_head_review` (default: true). When false, the respective role gets `is_bypass=True`.

### Item 22: Same-title warning card + transactional suffix

**Problem:** HR could create duplicate positions with the same title without any warning.

**Solution:** New `GET /api/v1/positions/{id}/same-title-check` endpoint + `PositionRepository.find_same_title()` + `compute_title_suffix()` (with `FOR UPDATE` lock to prevent TOCTOU races). Frontend will call this during intake stage.

### Item 24: ATS config role gate post-open

**Problem:** Any user could edit ATS config (threshold, search interval) on open positions.

**Solution:** New `PositionService.update_ats_config_post_open()` + `PATCH /api/v1/positions/{id}/ats-config`. Enforces: only `org_head` or `dept_admin` roles, only on positions with `status='open'`, only `ats_threshold` and `search_interval_hours` fields.

### VALID_STATUSES expansion

**Problem:** `VALID_STATUSES` set only contained `{draft, open, on_hold, closed, archived}`, blocking transitions to the new states.

**Solution:** Expanded to `{draft, jd_in_progress, pending_jd_approval, draft_needs_revision, open, on_hold, closed, archived, cancelled}`.

### HR Pickup — Status Transition Fix

**Problem:** `atomic_hr_pickup()` only set `picked_up_by` without changing `status`, so the position stayed in `draft` after pickup. Design doc requires `draft → jd_in_progress` on pickup.

**Solution:** Updated `PositionRepository.atomic_hr_pickup()` to also set `status = 'jd_in_progress'` atomically. Removed the `AND status = 'draft'` guard since the `picked_up_by IS NULL` check is sufficient.

### Submit Guard — Status Validation

**Problem:** `submit_for_approval()` had no guard checking position status. It could be called from any status, including `open` or `cancelled`.

**Solution:** Added guard: only positions in `jd_in_progress` or `draft_needs_revision` can be submitted.

### Submit_for_jd_approval — Position Status Update

**Problem:** `submit_for_jd_approval()` only set `approval_status='pending'` without changing `position.status`, so position stayed in `jd_in_progress` after submit.

**Solution:** Updated to also set `position.status = 'pending_jd_approval'` atomically.

**Files Modified:**
- `backend/db/repositories/positions.py` (added 12 new methods)
- `backend/services/position_service.py` (rewrote `submit_for_approval`, `record_approval_decision`, added 6 new service methods)
- `backend/routers/positions.py` (added 5 new endpoints + PermissionError handling)

### Item 14: Feedback card UI in chat (Frontend)

**Problem:** When a reviewer rejects a JD with feedback notes, the `feedback_injection` messages appeared as plain system text in the chat, indistinguishable from other system messages.

**Solution:** Added `FeedbackInjectionCard` component in `MessageList.jsx`. Renders `message_type='feedback_injection'` messages as amber-accented styled cards with a speech-bubble icon, revision cycle number, and markdown-rendered feedback content. Updated `ChatContext.jsx` to preserve `message_type` and `revision_cycle` fields from backend message payloads. Added corresponding CSS in `chat.css`.

### Item 15: Dynamic greeting (`buildGreeting()`) (Frontend)

**Problem:** The chat always showed the same static greeting: "Hi! Tell me about the role you're hiring for." — regardless of time, user, or context (returning to a revision, following up on a hire request, etc.).

**Solution:** Replaced the `GREETING` constant with `buildGreeting(user, locationState, sessionData)`. Uses time-of-day salutations (morning/afternoon/evening), user's first name, and context-aware body text: revision sessions show "Your JD has feedback...", hire request contexts show "I see you have a hire request...", and default shows the standard prompt. The `resetChat()` callback now accepts user and locationState params.

### Item 18: Chat deletion locking by status (Frontend + Backend)

**Problem:** Users could delete chat sessions even when the linked position was under review (`pending_jd_approval`) or already live (`open`), which would orphan the position from its chat history.

**Solution:**
- **Frontend (`SidebarSessions.jsx`):** Delete button is hidden entirely for `open` positions, disabled with "Cannot delete while under review" tooltip for `pending_jd_approval`, and shown normally for all other statuses.
- **Backend (`sessions.py`):** Updated `list_visible()` queries to LEFT JOIN positions table and return `position_status` in the session listing so the frontend has the data it needs.
- **Backend (`sessions.py`):** Updated the `get()` messages query to include `message_type` and `revision_cycle` columns for feedback card rendering.

**Files Modified:**
- `frontend/src/context/ChatContext.jsx` (buildGreeting, message_type preservation)
- `frontend/src/components/Chat/MessageList.jsx` (FeedbackInjectionCard)
- `frontend/src/components/Sidebar/SidebarSessions.jsx` (delete locking)
- `frontend/src/styles/chat.css` (feedback card styles)
- `backend/db/repositories/sessions.py` (position_status in list, message_type in get)

---

### Bug #116: HR Approval Note Not Conveyed to Team Lead

**Problem:** When a department admin modified a hire request (e.g., changed headcount, adjusted comp band) and approved it, the team lead who filed the request had no way to know their request was modified. They received only a generic "approved" notification, not the admin's explanation of changes.

**Solution:**
- Added `HireRequestApprove` Pydantic model with optional `note` field (max 1000 chars).
- Updated `approve_hire_request` endpoint to accept optional note in the request body.
- Service layer (`approve_request`) threads the note into:
  - **In-app notification:** raiser_title changes to "approved **with modifications**" and message includes the note text.
  - **Email:** note is rendered as a highlighted callout block in the HTML email body and plain text in fallback.
  - **Audit log:** stores note in `details` JSONB.
- Also patched the dormant `approve_modified()` path (existed but raiser never saw the notes; now they do).
- **Frontend UI:** Added optional-note inline panel (mirrors the reject panel) — approver can supply a note; empty note is valid and sends plain approval (backward-compatible).

**Files Modified:**
- `backend/models/hire_request.py` (added `HireRequestApprove` model)
- `backend/routers/hire_requests.py` (updated `/approve` to accept body with note)
- `backend/services/hire_request_service.py` (threaded note through notifications/emails/audit in both `approve_request` and `approve_modified`)
- `backend/services/email_service.py` (added `note` param to `send_hire_request_approved`, renders styled note block)
- `frontend/src/utils/api.js` (approve accepts optional note param)
- `frontend/src/components/HireRequests/HireRequestDetailPage.jsx` (added approve note UI panel + state)
- `backend/tests/test_hire_request_approval.py` (added regression test `test_approve_with_note_notifies_raiser_with_note`)

---

### Bug #117: JD Chat Greeting Inconsistent Across Entry Points

**Problem:** The JD chat greeting differed depending on how it was opened: the "New Hire" sidebar tab showed a personalized greeting ("Good afternoon, David!") while picking up a hire request from the hire-requests page showed a generic greeting ("Hi!"). In a SaaS product, the same surface must look identical across all entry points.

**Solution:**
- **Root cause:** `Sidebar.handleNewHire` passed real `user` to `resetChat`, but `ChatPage.useEffect` (mounted from hire-request pickup) passed `null`. Also, the intended hire-request greeting branch checked for `locationState.hireRequestId` (never passed) instead of `locationState.hireRequest`.
- Removed the dead hire-request greeting branch entirely. All contexts now render the same greeting: time-of-day + first name (if available) + standard prompt. The only contextual variant is returning to a session for revision ("Your JD has feedback...").
- `ChatPage` now passes the real `user` from `useAuth()` to `resetChat`, matching the Sidebar behavior.

**Files Modified:**
- `frontend/src/context/ChatContext.jsx` (removed dead `locationState.hireRequestId` branch; documented single greeting path)
- `frontend/src/components/Chat/ChatPage.jsx` (added `useAuth()`, pass real `user` to `resetChat`)

---

### Bug #118: StrictMode Double-Seed Creates Duplicate Chat Sessions & Two Bot Replies

**Problem:** When HR picked up a hire request and opened JD chat, two SSE streams launched, both seeding the intake agent. This created:
1. Two chat sessions in the sidebar history (only one should exist).
2. Two concurrent bot replies in the same conversation (one asking about must-have skills, another asking about employment type — visibly inconsistent).

**Root cause:** React `StrictMode` (enabled in production; stricter in dev) double-invokes effect setup. `ChatPage.useEffect` had two effects:
  - **Init effect:** resets chat and nulls `currentSessionId`.
  - **Seed effect:** checks `hireRequestSentRef.current` flag to gate seeding once.

On StrictMode's second pass: init re-ran and cleared `hireRequestSentRef` **and** nulled `currentSessionId`, so the seed re-ran, minting a second UUID → second `get_or_create_session` row + second SSE stream.

**Solution:**
- Replaced the `hireRequestSentRef` boolean flag with `seedKeyRef` and `initKeyRef` that gate on `location.key` — stable across StrictMode's double-invoke on the same navigation, but new on each real navigation (e.g., clicking New Hire a second time). `window.history.replaceState` does not change `location.key`, so minting a session id still keeps the guard active.
- This ensures exactly one session + one stream per pickup, while still re-initing properly when the user navigates.

**Files Modified:**
- `frontend/src/components/Chat/ChatPage.jsx` (replaced ref guards with location.key logic; added `useAuth()` to pass real user; updated init and seed effect dependency arrays)

---

### Bug #119: Seeded Intake Message Includes Unnecessary Approval Metadata

**Problem:** When HR picked up a hire request, the intake message auto-seeded to the chat included fields that are approval/operations concerns, not JD content:
- `Requested by: David Kim` — the requester's name (irrelevant to drafting).
- `Target start date: 2026-06-15` — a scheduling field (not JD content).
- `Headcount: 2` — ops metadata (borderline; can be JD-relevant but not for agent intake).

These fields added noise tokens and could nudge the agent into echoing irrelevant detail in the generated JD.

**Solution:**
- Trimmed the seeded message to include only fields that shape the JD: role_name, department, headcount (if >1), work_type, location, experience, compensation, and requirements.
- Dropped `requested_by_name`, `target_start`, and empty/null fields.

**Files Modified:**
- `frontend/src/components/Chat/ChatPage.jsx` (seed effect: removed 3 unnecessary fields, simplified field checks)

---

### Bug #120: Team Lead Not Notified + Stage Stuck — Wrong "settings" Column in resolve_reviewer

**Problem:** After HR finalized a JD, the position saved (200 OK) but the team lead received no approval notification and the hire request/position stayed at "JD generation" instead of moving to pending approval. Backend log: `Auto-submit for approval failed (non-blocking): column "settings" does not exist`.

**Root cause:** `PositionService.resolve_reviewer()` ran `SELECT settings FROM organizations WHERE id=$1`, but the `organizations` table has no `settings` column — org settings live in the `ai_behavior_settings` JSONB column. asyncpg raised `UndefinedColumnError`, which bubbled up and aborted `submit_for_approval`. `chat_service` caught it as a non-blocking warning, so the position was created but never submitted: no reviewer resolved, no notification, status never advanced to `pending_jd_approval`.

**Solution:** Replaced the broken inline query with the shared decoder `SettingsService.get_ai_behavior(conn, org_id)`, which reads and JSON-decodes the correct `ai_behavior_settings` column. The `direct_hire_*` approval-toggle keys are written nowhere, so they default to `True` (review required) — the intended safe default.

**Files Modified:**
- `backend/services/position_service.py` (`resolve_reviewer`: query `ai_behavior_settings` via `SettingsService.get_ai_behavior`)
- `backend/tests/test_position_approval.py` (added regression test `test_resolve_reviewer_uses_ai_behavior_settings_column` — fails with the exact production error without the fix, passes with it)

---

### Bug #121: Lock HR Chat Once JD Is Submitted for Approval

**Problem:** Once a JD was created and HR submitted it for team-lead approval, the "Resume AI Chat" button on the Position detail JD tab reopened the chat session and regressed the workflow stage — un-submitting the approval and forcing HR to resubmit. The chat was also fully editable while pending review.

**Solution (HR lock):**
- **Backend (`chat.py`):** Added a position-lock guard to the `/stream` and `/save-draft` endpoints. A linked position's chat is read-only once `approval_status == 'pending'` (awaiting reviewer) or the position has moved to any non-editable status. Editable statuses are `draft`, `rejected`, `draft_needs_revision` only — so a JD rejected with notes reopens for editing (stage moves back), while submitted/approved/live JDs are locked. Both endpoints share one `_position_lock_detail()` helper that mirrors the frontend's read-only definition in `ChatContext.jsx`, so lock behavior is identical on both sides.
- **Frontend (`JDTab.jsx`):** When a JD is pending approval, HR sees a read-only "👁 View AI Chat" button (navigates to the session without regressing the stage) instead of "Resume AI Chat".

**Review note:** The original guard hardcoded `status IN ('open','closed','on_hold')`; `closed`/`on_hold` are not valid position statuses in this codebase and it drifted from the frontend's canonical lock rule. Replaced with the shared helper aligned to `ChatContext.jsx` (locked when `approval_status='pending'` OR `status NOT IN {draft, rejected, draft_needs_revision}`), which also covers `fulfilled`/`cancelled`.

**Files Modified:**
- `backend/routers/chat.py` (`_position_lock_detail` helper + guards on `/stream` and `/save-draft`)
- `frontend/src/components/Positions/tabs/JDTab.jsx` (read-only "View AI Chat" button for pending-approval state)

---

### Bug #122: Stale Approval-Decision Tests (KeyError after Rev 4 refactor)

**Problem:** `test_approval_decision_approved_fires_sourcing` and `test_approval_decision_changes_requested_no_sourcing` failed with `KeyError` at `position_service.py:367`. Test-only issue (no product impact) but it left two approval-gating tests permanently red.

**Root cause:** Both tests were written for an older `record_approval_decision` and never updated after the Rev 4 refactor, which added a `FOR UPDATE` transaction, CAS repo methods (`approve_and_open`, `reject_to_revision`, `increment_revision_cycle`, `fulfill_hire_request`), an approver-role permission check, and an `approval_status` idempotency guard. The mocks supplied incomplete rows (`from users` lacked `role`/`department_id`; `from positions` lacked `approval_status`/`status`/`reviewer_id`) and `_FakeConn` had no `transaction()`. `KeyError approver_row["role"]` was the first wall, `AttributeError conn.transaction()` the second.

**Solution:** Modernized both tests to match the current code — complete mock rows (approver `role='org_head'` to bypass the reviewer-match check; position row with `approval_status`/`status`/`reviewer_id`), patched the four CAS repo methods, and added a no-op `transaction()` context manager to `_FakeConn`. Tests again genuinely assert Celery gating: approval fires `run_candidate_search.delay` once with correct args; changes-requested fires zero.

**Files Modified:**
- `backend/tests/test_position_approval.py` (complete mock rows, CAS repo patches, `_FakeConn.transaction()` + `_FakeTxn`)

---

### Bug #123: Org Competitors Not Loaded Into JD Market-Research State

**Problem:** During JD generation the market-intelligence node logged `No competitor names in state. Using industry defaults` and benchmarked against hardcoded Google/Microsoft/Stripe, even though the org had competitors configured in Settings → Competitor Intel.

**Root cause:** The agent state field `competitors_used` is initialized to `[]` and was never populated. `ChatService.get_or_create_session` loaded other org context (`about_us`/`culture`/`benefits`) but never queried the `competitors` table, so the market node always fell back to defaults.

**Solution:** In `get_or_create_session`, load the org's competitors via `CompetitorRepository.list_by_org(conn, org_id, department_id)` (prefer department-scoped; fall back to all org competitors when none are scoped) and set `state["competitors_used"] = [c["name"] for c in competitors]`.

**Files Modified:**
- `backend/services/chat_service.py` (`get_or_create_session`: load competitors into state)
- `backend/tests/test_competitor_state.py` (new regression test — fails without the fix, passes with it)

---

### Bug #124: Position Created as 'draft' Could Not Auto-Submit for Approval

**Problem:** A non-draft JD finalize created the position with `status='draft'`, but `submit_for_approval` only accepts `jd_in_progress`/`draft_needs_revision`. Combined with #120, this contributed to the JD never advancing to pending approval.

**Solution:** `finish_and_save_position` now creates a non-draft finalize with `status='jd_in_progress'` (still editable until it auto-submits), keeping `status='draft'` only for explicit draft saves. Updated `test_finish_and_save_does_not_fire_sourcing` to assert the new status; its real purpose (no sourcing fired, submit called once) is unchanged.

**Files Modified:**
- `backend/services/chat_service.py` (`finish_and_save_position`: `draft` → `jd_in_progress` on non-draft finalize)
- `backend/tests/test_position_approval.py` (status assertion updated to `jd_in_progress`)

---

### Bug #125: Dashboard Analytics 500 — asyncpg Interval / Timestamp Type Mismatch

**Problem:** The `GET /api/v1/dashboard/analytics?period=month` endpoint returned a 500 Internal Server Error. The root cause was a three-layer type mismatch in `dashboard_service.py → get_analytics()`:

1. **String passed as interval:** The `period_interval` variable was a raw Python string (`"30 days"`), but asyncpg requires a `datetime.timedelta` object for PostgreSQL interval parameters. Error: `'str' object has no attribute 'days'`.
2. **Type inference failure:** After switching to `timedelta`, the SQL `created_at >= NOW() - $2` still failed because asyncpg inferred `$2` as a timestamp (from the `>=` comparison with `created_at`) rather than an interval. Error: `operator does not exist: timestamp without time zone >= interval`.
3. **Timezone-aware vs naive mismatch:** After switching to a pre-computed cutoff timestamp using `datetime.now(timezone.utc)`, asyncpg rejected it because the DB column `created_at` is `timestamp without time zone` (naive). Error: `can't subtract offset-naive and offset-aware datetimes`.

**Solution:** Replaced the entire interval-passing strategy. Instead of passing an interval to PostgreSQL and doing arithmetic in SQL, the cutoff timestamp is now computed in Python using `datetime.utcnow() - timedelta(days=N)` and passed as a naive UTC `datetime` parameter. The SQL queries use a simple `created_at >= $2` comparison. This avoids all three issues: no string-to-interval encoding, no asyncpg type inference ambiguity, and no naive-vs-aware datetime conflicts.

**Files Modified:**
- `backend/services/dashboard_service.py` (`get_analytics`: replaced string intervals with pre-computed naive UTC cutoff timestamp)

---

### Bug #126: Hire Request and Chat Stalling at "JD Generation"

**Problem:** After completing a JD in the Chat UI and clicking "Submit for Approval", the chat UI's stepper showed an infinite spinner on the final "Save" stage. Simultaneously, the Hire Request's status remained stuck at "JD Generation" (status `pending`) instead of moving to "JD Approval" (status `fulfilled` with `approval_status = pending`).

**Root cause:** The "Submit for Approval" button in `PositionSetupModal.jsx` called the backend `save-position` endpoint, but it never dispatched the `finalize_jd` action with `status: 'complete'` to the chat agent. Because the agent's state never became `complete`, the chat stepper spinner ran forever. Furthermore, the frontend `ChatPage.jsx` relied on the `workflowStage === 'complete'` state change to trigger the `linkSession` endpoint. Since this state change never arrived, `linkSession` was never called, leaving the Hire Request unlinked and stalled in the "JD Generation" stage.

**Solution:**
1. In `PositionSetupModal.jsx`, upon successful save, explicitly dispatch `sendMessage({ action: 'finalize_jd', action_data: { status: 'complete' } })`.
2. Do not rely on `ChatPage.jsx`'s unreliable `useEffect` to link the session. Instead, execute `hireRequestsApi.linkSession(req.id, currentSessionId)` deterministically right inside `PositionSetupModal.jsx` before navigating away.
3. In `JDStepper.jsx`, fixed a mapping bug where `effectiveStage === 'complete'` incorrectly mapped to the `current` state (which renders a spinner). It now correctly maps to `done` (rendering a green checkmark).

**Files Modified:**
- `frontend/src/components/Chat/PositionSetupModal.jsx`
- `frontend/src/components/Chat/ChatPage.jsx`
- `frontend/src/components/Chat/JDStepper.jsx`

---

### Bug #127: Missing "Edit Notes" Workflow for Dept Admins

**Problem:** When a Department Admin edits a Team Lead's Hire Request, they need to provide notes explaining what changed (e.g. "Adjusted headcount to 2"). The system previously expected these notes to be entered during the Approval step, but UX requires editing and approving to be distinct actions. The notes were also not persisted to the database or shown inline on the request card.

**Solution:**
1. Added an optional `notes` column to the `HireRequestUpdate` Pydantic model and updated `HireRequestRepository.update` to accept it.
2. Modified `HireRequestForm.jsx` to render an "Edit Notes" textarea exclusively in Edit mode.
3. Modified `HireRequestDetailPage.jsx` to render `req.notes` as an inline styled block below the Relay Visualization.
4. Simplified the "Approve request" action in `HireRequestDetailPage.jsx` by removing its inline note form.
5. Updated `HireRequestService.approve_request` to seamlessly fallback to `existing["notes"]` when composing the approval notification email, ensuring the Team Lead receives the edit context.

**Files Modified:**
- `backend/models/hire_request.py`
- `backend/services/hire_request_service.py`
- `backend/db/repositories/hire_requests.py`
- `frontend/src/components/HireRequests/HireRequestForm.jsx`
- `frontend/src/components/HireRequests/HireRequestDetailPage.jsx`

---

### Bug #128: Type Mismatch in ChromaDB Vector Store Adapter

**Problem:** Python type checkers and runtime crashed when initializing `LangChainEmbeddingFunctionAdapter` because the ChromaDB `EmbeddingFunction` Protocol strictly requires specific attributes (`embed_with_retries`, `default_space`, `name` callable) that the adapter implementation did not fully declare or match.

**Solution:**
1. Added `# type: ignore` annotations to the `embedding_function` assignments in `backend/db/vector_store.py` to bypass the overly strict ChromaDB Protocol checks while preserving runtime functionality.

**Files Modified:**
- `backend/db/vector_store.py`

---

### Bug #129: "Open Position" Link and Frontend UI State

**Problem:** 
1. The "Open Position" link from the Hire Request Detail page did not point directly to the JD tab.
2. When the Team Lead clicked "Approve JD", the API returned successfully but the UI state did not update the position status or badge correctly, making it appear as if the button did nothing.

**Solution:**
1. Updated `HireRequestDetailPage.jsx` to correctly route the "Open Position" button to `/positions/${id}/jd`.
2. Updated the `approval-decision` API in `backend/routers/positions.py` to return both `status` and `approval_status` from the database so the frontend correctly syncs its local state.

**Edge Case Fixed (code review):**
The endpoint fetched `updated_pos` after the approval call with no NULL guard — if the position wasn't found (e.g., concurrent deletion), `updated_pos["status"]` would raise a TypeError and return an unhelpful 500. Added an explicit 404 raise when `updated_pos is None`. Also removed a redundant `from backend.db.connection import get_connection` import inside the handler body (the module-level import already covers it).

**Files Modified:**
- `backend/routers/positions.py` (edge case fix: NULL guard on `updated_pos` + removed duplicate import)
- `frontend/src/components/HireRequests/HireRequestDetailPage.jsx`

---

### Bug #130: Team Lead JD Approval Permission Denied

**Problem:** When a Team Lead attempted to approve a Job Description generated by HR, they encountered a silent backend permission error because the assigned `reviewer_id` was the Department Admin, not the Team Lead. This happened because HR linking the Chat Session to the Hire Request immediately updated the hire request status to `fulfilled`. Milliseconds later, `resolve_reviewer` queried for hire requests with status `approved` or `approved_modified`, found nothing, and fell back to assigning the Department Admin.

**Solution:**
1. Modified `PositionService.resolve_reviewer` to include `'fulfilled'` hire requests in its search query. This correctly attributes the position back to the original Team Lead who requested it, assigning them as the reviewer.

**Files Modified:**
- `backend/services/position_service.py`

---

### Bug #131: Team Lead Cannot View Open Positions

**Problem:** After the Team Lead approved the JD and the position became "Open", they could not see the position in their dashboard/positions list. The `team_lead` role was strictly filtering the list query by `created_by = user_id`. Since HR generated the JD, `created_by` was set to the HR user's ID, causing the position to be filtered out for the Team Lead.

**Solution:**
1. Updated `PositionRepository.list_for_org` to accept a `team_lead_id` parameter.
2. Expanded the SQL WHERE condition for Team Leads to match positions where they are either the creator (`created_by`), the hiring manager (`reviewer_id`), or the requester of the linked hire request.
3. Updated the router and service layers to pass the `team_lead_id` instead of strictly applying the `created_by` filter.

**Edge Case Fixed (code review):**
The hire_requests subquery `SELECT position_id FROM hire_requests WHERE requested_by = $N` did not exclude NULL `position_id` rows (hire requests not yet linked to a position). In PostgreSQL, `x IN (NULL, ...)` produces UNKNOWN (not FALSE) when `x` doesn't match any non-NULL value, which could yield unexpected query behaviour. Added `AND position_id IS NOT NULL` to the subquery.

**Files Modified:**
- `backend/routers/positions.py`
- `backend/services/position_service.py`
- `backend/db/repositories/positions.py` (edge case fix: `AND position_id IS NOT NULL` in subquery)
- `backend/db/repositories/positions.py`

---

### Bug #132: Chat Interface "Pending approval" Banner Logic
**Problem:** The chat interface displayed the "Pending team lead approval — this JD is read-only..." banner even after the JD was successfully approved and saved, failing to pick up the updated `approved` status.
**Solution:** Fixed the frontend banner logic to correctly hide the warning banner once the position status updates from `pending_approval` to `open` or `approved`.

---

### Bug #133: Hire Request Reject Button Styling
**Problem:** The "Reject request" button on the Hire Request page was missing its red `.hr-btn-danger` background styling, rendering it incorrectly.
**Solution:** Added the `.hr-btn-danger` CSS class to `HireRequests.css` to properly apply the solid red background and hover effects.

---

### Bug #134: Hire Request Cancellation Notifications & Native Modal
**Problem:** 
1. When a Department Admin cancelled a Hire Request, a native browser `window.confirm` popup appeared instead of an app-level UI modal.
2. The team lead who initially raised the request was not notified when an admin cancelled their request.
**Solution:** 
1. Replaced the native `window.confirm` with the app's standard `ConfirmModal` component in `HireRequestDetailPage.jsx`.
2. Updated the cancellation logic in `backend/services/hire_request_service.py` to dispatch an in-app notification to the original requester if the request is cancelled by someone else (e.g. an admin).

---

### Bug #135: Org Head Dashboard Fetching & UI Bugs
**Problem:** 
1. The dashboard returned a `422 Validation Error` due to a malformed `dept_id` query parameter for the Org Head role.
2. Active departments with zero currently open positions were disappearing from the department filter chips.
3. The default period filter was incorrectly set to "This Week" instead of "Today".
4. The department chip filter was unnecessarily visible for Department Admins, whose scope is inherently locked to their own department.
**Solution:** 
1. Replaced the frontend's naive department accumulator with an explicit call to `settingsApi.getDepartments()` so all active departments accurately load, resolving the URL query issues.
2. Fixed a React crash (`departments is not iterable`) by correctly extracting the array from the `settingsApi.getDepartments()` object response.
3. Updated the initial state of the `period` hook to "today".
4. Restrained the `RoleGate` on `DeptChipBar` in `DashboardPage.jsx` to only allow `org_head`.

---

### Bug #136: Replace all `window.confirm` with app-level `ConfirmModal`
**Problem:** Several components (e.g., candidate selection, note deletion, dev admin reset, privacy anonymization) were using the native browser `window.confirm` dialog instead of the app's custom UI, which breaks immersion and SaaS design standards.
**Solution:** Swept the frontend codebase and replaced all instances of `window.confirm` with the app-level `<ConfirmModal />` component in `CandidateDetailPage.jsx`, `DevAdminPage.jsx`, and `PrivacyTab.jsx`.

---

### Bug #137: Interview Kit Tab Failing to Render (Blank Screen)
**Problem:** When a user visited the Interview Kit tab after generation, the application could crash entirely (blank tab) or fail to display content. The AI-generated JSON payload might contain strings instead of objects for questions or numbers instead of strings for the rating scale, causing React TypeErrors (`TypeError: r.split is not a function` or `replace is not a function`).
**Solution:**
1. Hardened the `InterviewKitTab.jsx` component by adding robust type coercion and optional chaining.
2. Encased `dim.rating_scale` mapping in `Array.isArray` check and cast rating strings using `String(r).split(' - ')[0]`.
3. Cast `type` to string before replacing formatting tags (`String(type).replace`).
4. Added fallbacks for `q?.question`, `q?.difficulty`, and `dim?.dimension`.

---

### Bug #138: "Generate Interview Kit" Failed with 401 Unauthorized
**Problem:** Clicking "Generate Interview Kit" consistently showed "AI generation failed" in the UI. The root cause was that `InterviewKitTab.jsx` used a local manual `authHeader()` function that looked for the token in `localStorage.getItem('token')`. However, the auth system uses `sessionStorage.getItem('atl_session')`, resulting in an empty Authorization header and the FastAPI backend returning a `401 Unauthorized` error.
**Solution:**
1. Replaced the manual `fetch` calls and broken `authHeader` implementation in `InterviewKitTab.jsx`.
2. Refactored the component to use the centralized `positionsApi.getInterviewKit` and `positionsApi.generateInterviewKit` methods, which automatically hook into the correct session storage token getter.
\n### Bug #137: Position Settings UI & Original Request Drawer Fixes\n**Problem:**\n1. The Original Request Drawer (viewable from the Position Hero 'i' button) was using transparent CSS variables making text illegible, and was missing several UI icons.\n2. The Drawer failed to display the 'Department' field because the backend query did not fetch the department name.\n3. The ATS Score slider line in the Position Settings tab was rendering excessively thick, and the Auto-Search Interval dropdown text was crushing due to strict width constraints.\n4. The Position Settings contained an unused 'Approval Required' toggle that confused users since candidate sourcing runs automatically once a position is open.\n**Solution:**\n1. Fixed `OriginalRequestDrawer.css` to use the correct design system tokens (e.g. `--color-bg-card`) to resolve transparency, and added missing icons to `Icon.jsx`.\n2. Updated `PositionRepository.get_with_stats()` in the backend to perform a `LEFT JOIN` on the `departments` table, and updated the frontend drawer to display the latest position metadata accurately.\n3. Modified `PositionSettingsTab.css` to apply the slider gradient strictly to `::-webkit-slider-runnable-track` (height: 2px) for a thin line appearance, and removed strict `flex-shrink` constraints on the Auto-Search dropdown.\n4. Removed the 'Approval Required' toggle entirely from `PositionSettingsTab.jsx`.


---

### Bug #139: Dashboard v3 Execution Fixes
**Problem:** 
Four execution gaps existed in the live Dashboard v3:
1. `HealthStrip` cards were showing empty ("—") because they expected fields that the backend did not return.
2. The NOW lane always had a red urgency tint even when it was completely empty ("All clear").
3. The period switcher (Today / This Week / This Month) didn't affect the lanes, misleading users into thinking the lanes were being filtered.

**Solution:**
1. Backend: Added `avg_time_to_hire` logic to `get_stats()` in `dashboard_service.py` to calculate time to hire.
2. Frontend: Updated `HealthStrip.jsx` to map to existing fields (`active_positions`, `avg_time_to_hire`, `interviews_this_period`, `offers_this_period`).
3. Frontend: Added `.tb-lane--empty` to `dashboard.css` and dynamic class application in `BriefingLane.jsx` to show a green success tint when the NOW lane is empty.
4. Frontend: Added a title tooltip to `.dash-period-switcher` in `DashboardPage.jsx` to clarify that it controls the health metrics above, and lane content refreshes in real-time.

**Files Modified:**
- `backend/services/dashboard_service.py`
- `frontend/src/components/Dashboard/HealthStrip.jsx`
- `frontend/src/components/Dashboard/BriefingLane.jsx`
- `frontend/src/styles/dashboard.css`
- `frontend/src/components/Dashboard/DashboardPage.jsx`

---

### Bug #140: Analytics Redesign: Agent ROI Dashboard
**Problem:**
The "Hiring Analytics" page was generic and did not highlight the core value prop of AI Talent Lab, which is measuring the impact of AI sourcing and automation versus human actions.

**Solution:**
Replaced the legacy analytics page with the new "Agent ROI Dashboard".
1. Backend: Added `actor_type` to `pipeline_events` for strict attribution (`human`, `ai_agent`, `system`).
2. Backend: Built complex analytics aggregations in `dashboard_service.py`: `get_agent_roi()`, `get_per_recruiter()`, and `get_bottleneck_radar()`. Added routing for `/api/v1/dashboard/agent-roi`, `/recruiter-performance`, and `/bottlenecks`.
3. Frontend: Swapped out old KPI strip with `AgentROIHero` showing direct time/money saved and AI sourcing metrics.
4. Frontend: Added `DualFunnel` for head-to-head pipeline throughput (AI vs Human), `BottleneckRadar` for phase-level blockers via inline SVG, and `RecruiterLeaderboard` for tracking active positions and hires.
5. Frontend: Rewrote `AnalyticsPage.jsx` and `AnalyticsPage.css` with a new, simplified, glass-like aesthetic.
6. Frontend: Fixed a lingering `Unterminated regular expression` syntax error in `CandidateDetailPage.jsx` caused by an extra `</div>` tag.

**Files Modified:**
- `backend/db/migrations.py`
- `backend/routers/dashboard.py`
- `backend/services/dashboard_service.py`
- `frontend/src/utils/api.js`
- `frontend/src/components/Analytics/AgentROIHero.jsx` (New)
- `frontend/src/components/Analytics/DualFunnel.jsx` (New)
- `frontend/src/components/Analytics/BottleneckRadar.jsx` (New)
- `frontend/src/components/Analytics/RecruiterLeaderboard.jsx` (New)
- `frontend/src/components/Analytics/AnalyticsPage.jsx`
- `frontend/src/components/Analytics/AnalyticsPage.css`
- `frontend/src/components/Candidates/CandidateDetailPage.jsx`

---

## 141. Fix Default 50% Match Display on Career Page

**Problem Statement:**
On the public career page, all open roles showed a default 50% match even when the user had not selected any Fit Finder filters. This was confusing, as 50% looked arbitrary.

**Idea / Solution:**
Updated the backend  endpoint to calculate . If no filters are present, the endpoint still returns the roles but sets . The frontend correctly hides the match UI when  is 0, completely removing the default 50% badge while still listing the open positions.

**Files Modified:**
- 

---

## 142. Fix Default 50% Match Display on Career Page

**Problem Statement:**
On the public career page, all open roles showed a default "50% match" even when the user had not selected any Fit Finder filters. This was confusing, as 50% looked arbitrary.

**Idea / Solution:**
Updated the backend `/fit` endpoint to calculate `has_filters`. If no filters are present, the endpoint still returns the roles but sets `fit_score = 0`. The frontend correctly hides the match UI when `fit_score` is 0, completely removing the default 50% badge while still listing the open positions.

**Files Modified:**
- `backend/routers/careers.py`

---

## 143. Fix "Apply via chat" Button on Career Page

**Problem Statement:**
Clicking "Apply via chat" on the Career Page job card updated the URL to include the `positionId`, but the page remained the same (the job list). The user could not view the specific job details or start the application chat.

**Idea / Solution:**
Updated `CareerPage.jsx` to extract `positionId` from the route parameters. If present, it fetches the specific position's details from the backend and renders the public Position Detail View (including the JD and an active "Apply via chat" button that calls the `/apply` endpoint) instead of the Fit Finder. Also added styling for the new view in `CareerPage.css`.

**Files Modified:**
- `frontend/src/components/Careers/CareerPage.jsx`
- `frontend/src/components/Careers/CareerPage.css`

---

## 144. Fix Career Page JD Formatting and Public Apply Flow

**Problem Statement:**
The Job Description on the Career Page was rendering as raw markdown instead of formatted HTML. Furthermore, clicking "Apply via chat" resulted in a "link expired" error. This was because the apply chat was strictly designed for known, sourced candidates, but the career page was generating anonymous tokens without candidate context, breaking the agent's initialization.

**Idea / Solution:**
Instead of rewriting the highly optimized 8-step candidate chat agent to support anonymous users, we bridged the gap in the UI. 
1. Added an interstitial modal to `CareerPage.jsx` when clicking "Apply via chat". The modal collects the candidate's Name and Email.
2. Modified the `POST /apply` backend endpoint to accept this data, instantly create a `candidates` and `candidate_applications` record, and generate a standard, fully-authenticated Apply Token.
3. This smoothly routes the public applicant into the exact same chat experience as an invited candidate.
4. Added `react-markdown` to the Career Page to properly render the JD's markdown payload into rich HTML.

**Files Modified:**
- `backend/routers/careers.py`
- `frontend/src/components/Careers/CareerPage.jsx`

---

## 145. Fix react-markdown className Prop Error

**Problem Statement:**
The Career Page crashed with `Unexpected className prop` error. react-markdown v9+ removed the `className` prop from the `<ReactMarkdown>` component. Passing it directly causes an assertion failure.

**Idea / Solution:**
Wrapped `<ReactMarkdown>` inside a `<div>` element and moved the CSS class names (`cp-jd-markdown markdown-body`) to the wrapper div instead.

**Files Modified:**
- `frontend/src/components/Careers/CareerPage.jsx`

---

## 146. Fix Career Page Apply Endpoint — Missing department_id + Wrong Token Function

**Problem Statement:**
Two bugs in the `POST /careers/{org_slug}/positions/{position_id}/apply` endpoint:
1. The SQL query selecting the position did not include `department_id`, causing a `KeyError` when creating the application record.
2. The code called `ApplyService.generate_apply_token()` — but `generate_apply_token` is a standalone module-level function, not a class method. This caused an `AttributeError`.

**Idea / Solution:**
1. Added `department_id` to the position SELECT query.
2. Changed the import to `from backend.services.apply_service import generate_apply_token` and called it directly.

**Files Modified:**
- `backend/routers/careers.py`

---

## 147. Fix Browser Alert → Toast Notification on Career Page

**Problem Statement:**
Error messages on the Career Page were shown via the browser's native `alert()` dialog instead of in-app toast notifications, which is inconsistent with the product's UX standards.

**Idea / Solution:**
Replaced `alert()` with the existing `Toast` component from `components/common/Toast.jsx`. Added toast state management and rendered the `<Toast>` component in the Career Page.

**Files Modified:**
- `frontend/src/components/Careers/CareerPage.jsx`

---

## 148. Fix Apply Chat — Session Creation & Column Name Bugs

**Problem Statement:**
After successfully generating a token and navigating to the apply chat, the chatbot showed no greeting message. Three root causes:
1. `apply_service.py` `verify_and_load` queried `screening_questions` with `ORDER BY order_index`, but the actual column name is `sort_order` → caused 500 on page load.
2. `apply_service.py` `_load_context` had the same `order_index` bug → caused 500 on `send_message` (greeting).
3. `_get_or_create_session` tried to INSERT into `candidate_sessions` without providing an `id` value, but the `id` column is `text` (UUID) with no default → `NotNullViolationError`.
4. `verify_and_load` returned the `org` dict without an `id` field, causing the consent endpoint to return 400 (it checks `context["org"]["id"]`).

**Idea / Solution:**
1. Changed `ORDER BY order_index` → `ORDER BY sort_order` in both `verify_and_load` and `_load_context`.
2. Generated a UUID (`uuid.uuid4()`) for the session `id` field in `_get_or_create_session`, matching the project pattern where session tables use text UUIDs.
3. Added `"id": org_id` to the `org` dict in the `verify_and_load` return value.

**Files Modified:**
- `backend/services/apply_service.py`

---

## 149. Fix GDPR Consent — Timezone-Aware vs Naive Datetime

**Problem Statement:**
`GDPRService.set_retention_period` created a timezone-aware datetime (`datetime.now(timezone.utc)`) but the DB column `data_retained_until` is `timestamp without time zone`. asyncpg rejects mixing offset-aware and offset-naive datetimes, causing the retention period to silently fail.

**Idea / Solution:**
Changed `datetime.now(timezone.utc)` to `datetime.utcnow()` which produces an offset-naive datetime compatible with the DB column type.

**Files Modified:**
- `backend/services/gdpr_service.py`

---

## 150. Fix Celery Worker DB Pool Initialization

**Problem Statement:**
Starting the Celery worker resulted in `RuntimeError: Database pool not initialized. Call create_pool() first.`. This happens because Celery workers run in separate processes and do not trigger FastAPI's startup events where the connection pool is normally initialized.

**Idea / Solution:**
Updated `get_pool()` in `backend/db/connection.py` to auto-initialize the database connection pool using `settings.DATABASE_URL` if the pool is `None`, instead of raising a `RuntimeError`. This allows Celery tasks to seamlessly obtain a database connection without requiring complex signal handler boilerplate.

**Files Modified:**
- `backend/db/connection.py`

---

## 151. Trigger ATS Scoring for Organic Applicants (Career Portal)

**Problem Statement:**
When a candidate applied organically through the Career Portal's chat interface, their resume was processed and their status updated to "Applied" successfully, but the ATS scoring background task was never triggered. This resulted in the score showing as `--` indefinitely on the candidate's profile.

**Idea / Solution:**
1. Created a dedicated Celery task `score_candidate_application` in `backend/tasks/candidate_pipeline.py` to handle the ATS scoring of organic applicants.
2. Updated `_step_complete` in `backend/services/apply_service.py` to dispatch this Celery task automatically as the final step of the chat workflow, immediately after the GDPR consent and status updates.

**Files Modified:**
- `backend/tasks/candidate_pipeline.py`
- `backend/services/apply_service.py`

---

## 152. Prevent Groq API Rate Limits During Celery Background Sourcing

**Problem Statement:**
When the Celery worker runs the candidate sourcing pipeline, it spins up multiple parallel workers (defaulting to the number of CPU cores). Each worker queries Tavily and then hits the Groq API concurrently using the `llama-3.3-70b-versatile` model to extract candidate dossiers. This caused the system to rapidly exceed Groq's 12,000 Tokens Per Minute (TPM) limit on the free tier, resulting in `429 Too Many Requests` errors.

**Idea / Solution:**
Updated `backend/adapters/candidate_sources/tavily.py` to specifically request the `llama-3.1-8b-instant` model for dossier extraction. This model is much faster, has a significantly higher TPM limit, and is more than capable of handling the simple structured JSON extraction required, effectively resolving the parallel scraping rate limits.

**Files Modified:**
- `backend/adapters/candidate_sources/tavily.py`

---

## 153. Expose ATS Retry Functionality in UI

**Problem Statement:**
When ATS scoring for an organic applicant failed (e.g., due to rate limits or API errors), there was no way for an HR admin to trigger a retry. The score remained missing without any recourse.

**Idea / Solution:**
1. Added an explicit `Retry ATS Score` button inside `CandidateHero.jsx` which displays when viewing a candidate's application details. 
2. Set the `cd-hero-actions` container to `flex-direction: row` to ensure horizontal alignment, as the additional buttons were incorrectly stacking vertically and stretching the hero layout.
3. Added a dedicated `POST /api/v1/candidates/{candidate_id}/retry-ats` endpoint in `backend/routers/candidates.py` to accept manual retries and enqueue the `score_candidate_application` Celery task.

**Files Modified:**
- `frontend/src/components/Candidates/CandidateHero.jsx`
- `frontend/src/components/Candidates/CandidateDetailPage.css`
- `backend/routers/candidates.py`

---

## 154. Fix position_id Context Loss During Navigation

**Problem Statement:**
When clicking a candidate from the Pipeline stack view or Kanban view, the candidate's action buttons (Move to, Schedule, Retry ATS) were missing. This occurred because `positionId` was not passed in the React Router state during navigation. 

**Idea / Solution:**
Updated `onClick` navigation handlers in both `PipelineStackView.jsx` and `PipelineTab.jsx` to correctly include `positionId` in the router's state payload, ensuring the Candidate Detail Page recognizes the specific position context and renders the action panel.

**Files Modified:**
- `frontend/src/components/Positions/PipelineStackView.jsx`
- `frontend/src/components/Positions/tabs/PipelineTab.jsx`

---

## 155. Fix Celery Type Mismatch for ATS Retry

**Problem Statement:**
When clicking the "Retry ATS Score" button, the Celery task failed with `invalid input for query argument $1: '12' ('str' object cannot be interpreted as an integer)`. This happened because the frontend `positionId` was passed as a string and asyncpg strictly requires integers for DB binding.

**Idea / Solution:**
Added explicit `int()` casts for `application_id` and `position_id` inside the `retry_ats_scoring` endpoint handler in `backend/routers/candidates.py` before passing the parameters to the Celery `score_candidate_application.delay()` function.

**Files Modified:**
- `backend/routers/candidates.py`

---

## 156. Analytics Page: Emoji Icon Violation in Error Banner

**Problem Statement:**
`AnalyticsPage.jsx` line 67 used a raw `⚠️` emoji as an icon in the error banner: `<div className="analytics-error">⚠️ {error}</div>`. Using emoji as icons violates the ui-ux-pro-max design rule (priority 4: no-emoji-icons), breaks visual consistency with the SVG icon system, and renders inconsistently across platforms.

**Idea / Solution:**
Removed the emoji. The `.analytics-error` CSS class now provides the semantic error styling (danger red border + background). The error message text is rendered directly with `role="alert"` for screen-reader accessibility.

**Files Modified:**
- `frontend/src/components/Analytics/AnalyticsPage.jsx`

---

## 157. Analytics Page: Promise.all Causes Total Failure on Single API Error

**Problem Statement:**
`AnalyticsPage.jsx` used `Promise.all(...)` for its four data-fetching calls. If any one API endpoint failed (e.g., agent-roi endpoint unreachable), `Promise.all` rejects the entire batch, causing the whole dashboard to show an error state even when other data is available.

**Idea / Solution:**
Replaced `Promise.all` with `Promise.allSettled`. Each response is checked individually — fulfilled results update their respective state; only when all four calls fail does the error banner appear. This matches the graceful-degradation pattern used in the Dashboard page.

**Files Modified:**
- `frontend/src/components/Analytics/AnalyticsPage.jsx`

---

## 158. Analytics Page: Missing KPI Strip for Key Hiring Metrics

**Problem Statement:**
The Analytics page only showed the Agent ROI hero and chart cards. Key operational KPIs (Total Candidates, Avg Time to Hire, Offer Acceptance Rate, Active Positions) had no visible row, making it impossible for a manager to get a quick pipeline health summary alongside the AI-vs-human comparison.

**Idea / Solution:**
Added a `KpiStrip` component rendered between the ROI hero and the charts grid. It calls `dashboardApi.getAnalytics(period)` (already in api.js at line 152) and displays four metric cards in a responsive auto-fit grid. Values default to `—` when data is unavailable.

**Files Modified:**
- `frontend/src/components/Analytics/AnalyticsPage.jsx`

---

## 159. Analytics Page: AgentROIHero Uses Conservative Typography (B-grade Design)

**Problem Statement:**
`AgentROIHero.jsx` used 48px for the AI sourcing share number and a hardcoded `color: #10B981` in `AnalyticsPage.css`. This violated the design token system and was visually weak for a hero metric — on a SaaS dashboard, the primary KPI should command immediate attention with display-scale typography (56–80px).

**Idea / Solution:**
Rewrote `AgentROIHero.jsx` and extracted it into a dedicated `AgentROIHero.css`. Key A+ upgrades: (1) `clamp(56px, 8vw, 80px)` hero number in teal token; (2) full-width visual share bar showing AI vs Human split; (3) trend delta chip showing pp change vs last period with positive/negative/neutral states; (4) low-share alert banner when AI contribution < 20%; (5) stat blocks (hours saved, AI-sourced count) in right column; (6) `font-variant-numeric: tabular-nums` on all data values; (7) loading skeleton instead of null return.

**Files Modified:**
- `frontend/src/components/Analytics/AgentROIHero.jsx`
- `frontend/src/components/Analytics/AgentROIHero.css` (new file)

---

## 160. Analytics Page: DualFunnel Uses Hardcoded Hex Colors

**Problem Statement:**
`DualFunnel.jsx` used `backgroundColor: '#6366F1'` and `backgroundColor: '#10B981'` inline styles, bypassing the design token system. This breaks dark/light mode switching and violates the `color-semantic` ui-ux-pro-max rule.

**Idea / Solution:**
Replaced all hardcoded hex with design tokens via CSS classes: `.dual-funnel-bar-human` uses `var(--color-chart-human, #8B5CF6)` (purple for human, distinguishable from AI teal) and `.dual-funnel-bar-ai` uses `var(--color-primary, #0D9488)`. Added a header row labelling each side and a conversion-rate footer (sourced-to-hire %) for each funnel.

**Files Modified:**
- `frontend/src/components/Analytics/DualFunnel.jsx`
- `frontend/src/components/Analytics/AnalyticsPage.css`

---

## 161. Analytics Page: BottleneckRadar Uses Hardcoded Legend Colors + No Regression Signal

**Problem Statement:**
`BottleneckRadar.jsx` legend used inline `style={{ backgroundColor: 'rgba(16,185,129,0.8)' }}` and `rgba(99,102,241,0.4)` — hardcoded RGBA bypassing design tokens. Additionally, there was no visual signal for axes that had regressed vs the previous period; all axis labels looked identical regardless of whether a metric had dropped.

**Idea / Solution:**
Replaced legend dot inline styles with semantic CSS classes (`.radar-legend-dot-current` / `.radar-legend-dot-prev`) referencing `var(--color-primary)` and RGBA of the indigo token. Added `isRegressed()` helper that flags axes where current value dropped >10pp vs previous period; regressed axes render with `.radar-label-regressed` class (red fill, bold weight) and a `↓` indicator inline with the label.

**Files Modified:**
- `frontend/src/components/Analytics/BottleneckRadar.jsx`
- `frontend/src/components/Analytics/AnalyticsPage.css`

---

## 162. Analytics Page: Period Switcher Uses Bordered Buttons Instead of Pill Style

**Problem Statement:**
`AnalyticsPage.css` rendered the period selector as individual bordered buttons with `border: 1px solid var(--color-border)` per button. This looks like a form control, not a navigation pill — inconsistent with the Dashboard's period switcher which uses a pill container. Also the symmetric 1:1 grid did not give the DualFunnel chart enough room vs the radar chart.

**Idea / Solution:**
Rewrote `AnalyticsPage.css` with: (1) pill-style period switcher matching `dashboard.css` (container with `border-radius: 9999px`, active tab gets `background: var(--color-primary)`, no individual borders); (2) asymmetric grid `3fr 2fr` so the DualFunnel gets proportionally more space; (3) KPI card styles with animation stagger; (4) all hardcoded hex colors replaced with design tokens; (5) `animation: rise` on cards for smooth load-in.

**Files Modified:**
- `frontend/src/components/Analytics/AnalyticsPage.css`

---

### Bug #163: Analytics A+ Design Upgrade — AgentROIHero

**Date:** 2026-06-07
**Severity:** Design / UX
**Component:** `frontend/src/components/Analytics/AgentROIHero.jsx` + new `AgentROIHero.css`

**Problem:**
ROI hero used no visual hierarchy — the AI share percentage was plain text with no display-scale number, no delta trend chip, and no share bar visualization.

**Fix:**
- Rewrote component with `clamp(56px, 8vw, 80px)` hero number, loading skeleton, delta chip (positive/negative/neutral), share bar with `role="progressbar"`, and low-share alert.
- Created `AgentROIHero.css` with `roi-hero-*` token-based classes.

**Files Modified:**
- `frontend/src/components/Analytics/AgentROIHero.jsx`
- `frontend/src/components/Analytics/AgentROIHero.css`

---

### Bug #164: Analytics A+ Design — DualFunnel hardcoded colors

**Date:** 2026-06-07
**Severity:** Design / Code Quality
**Component:** `frontend/src/components/Analytics/DualFunnel.jsx`

**Problem:**
DualFunnel bars used hardcoded `backgroundColor: '#6366F1'` and `'#10B981'` instead of design tokens, and lacked a header row and conversion rate footer.

**Fix:**
Replaced inline `backgroundColor` with CSS classes `dual-funnel-bar-human` (`var(--color-chart-human, #8B5CF6)`) and `dual-funnel-bar-ai` (`var(--color-primary, #0D9488)`). Added header row (Human Sourced / AI Sourced) and sourced-to-hire conversion rate footer.

**Files Modified:**
- `frontend/src/components/Analytics/DualFunnel.jsx`
- `frontend/src/components/Analytics/AnalyticsPage.css`

---

### Bug #165: Analytics A+ Design — BottleneckRadar hardcoded legend colors + regression signals

**Date:** 2026-06-07
**Severity:** Design / Code Quality
**Component:** `frontend/src/components/Analytics/BottleneckRadar.jsx`

**Problem:**
Legend dots used hardcoded `backgroundColor: 'rgba(...)'` inline styles. No regression detection for axes that dropped >10pp.

**Fix:**
Replaced inline `backgroundColor` with `.radar-legend-dot-current` and `.radar-legend-dot-prev` CSS classes. Added `isRegressed()` helper; regressed axes render with `.radar-label-regressed` class and `↓` indicator.

**Files Modified:**
- `frontend/src/components/Analytics/BottleneckRadar.jsx`
- `frontend/src/components/Analytics/AnalyticsPage.css`

---

### Bug #166: Analytics A+ Design — emoji violation + KPI strip + Promise.allSettled

**Date:** 2026-06-07
**Severity:** Design / Reliability
**Component:** `frontend/src/components/Analytics/AnalyticsPage.jsx`

**Problem:**
Error state had `⚠️` emoji (violates ui-ux-pro-max no-emoji-icon rule). `Promise.all` caused full-blank on any single endpoint failure. No KPI strip above charts.

**Fix:**
Removed emoji, replaced with `role="alert"` div. Switched to `Promise.allSettled` with per-result status checks. Added `KpiStrip` component showing 4 org-level KPIs.

**Files Modified:**
- `frontend/src/components/Analytics/AnalyticsPage.jsx`

---

### Bug #167: Analytics A+ Design — CSS full rewrite

**Date:** 2026-06-07
**Severity:** Design
**Component:** `frontend/src/components/Analytics/AnalyticsPage.css`

**Problem:**
CSS had raw hex colors, no design tokens, cramped grid layout, and no animation/skeleton states.

**Fix:**
Full rewrite: pill period switcher (`border-radius: 9999px`), asymmetric `3fr 2fr` analytics grid, KPI card styles with stagger animation, all hex replaced with design tokens, `rise` + `shimmer` keyframes.

**Files Modified:**
- `frontend/src/components/Analytics/AnalyticsPage.css`

---

### Bug #168: Dashboard — PULSE event titles render as raw lowercase system strings

**Date:** 2026-06-07
**Severity:** UX / Polish
**Component:** `frontend/src/components/Dashboard/BriefingRow.jsx`

**Problem:**
`row.title` from backend arrives as lowercase system event names ("ats scored", "jd generated") which render verbatim in the PULSE lane, looking unpolished.

**Fix:**
Added `formatEventTitle()` helper that capitalizes each word and handles acronyms (ATS, JD, AI). Applied to `row.title` render in `.tb-row-title`.

**Files Modified:**
- `frontend/src/components/Dashboard/BriefingRow.jsx`

---

### Bug #169: Dashboard — VelocitySparkline "open reqs" always plural

**Date:** 2026-06-07
**Severity:** Copy / Grammar
**Component:** `frontend/src/components/Dashboard/VelocitySparkline.jsx`

**Problem:**
Metric line read `"1 open reqs"` when `active_positions === 1` — grammatically incorrect.

**Fix:**
Changed to `` `${n} open req${n !== 1 ? 's' : ''}` `` for proper singular/plural.

**Files Modified:**
- `frontend/src/components/Dashboard/VelocitySparkline.jsx`

---

### Bug #170: Positions List — "active roles" always plural

**Date:** 2026-06-07
**Severity:** Copy / Grammar
**Component:** `frontend/src/components/Positions/PositionsListPage.jsx`

**Problem:**
Subtitle read `"1 active roles"` when exactly 1 position open — grammatically incorrect.

**Fix:**
Changed to `` `${openCount} active role${openCount !== 1 ? 's' : ''}` ``.

**Files Modified:**
- `frontend/src/components/Positions/PositionsListPage.jsx`

---

### Bug #171: Position Detail — AI confidence shown as raw decimal (0.27)

**Date:** 2026-06-07
**Severity:** UX / Readability
**Component:** `frontend/src/components/Positions/StageHealthHeader.jsx`

**Problem:**
AI confidence chip displayed `"Medium · 0.27"` — the raw float is unreadable to recruiters.

**Fix:**
Changed to `{confLabel}: {Math.round(confidence * 100)}%` so it displays as `"Medium: 27%"`.

**Files Modified:**
- `frontend/src/components/Positions/StageHealthHeader.jsx`

---

### Bug #172: Position Card — Stage color bars used 7 distinct colors with no semantic meaning + no tooltips

**Date:** 2026-06-07
**Severity:** Design / UX
**Component:** `frontend/src/components/Positions/StagePipeStrip.jsx`

**Problem:**
7 different bright colors (indigo, purple, blue, teal, amber, green, red) created visual noise with no clear semantic grouping. Stage abbreviations (Src, Eml, App…) had no tooltip.

**Fix:**
Reduced to 3 semantic colors: pipeline stages (sourced→interview) use `var(--color-primary)` teal, selected uses `var(--color-success)` green, rejected uses `var(--color-text-muted)` gray. Added `title={fullLabel}` tooltip on each cell.

**Files Modified:**
- `frontend/src/components/Positions/StagePipeStrip.jsx`

---

### Bug #173: Dashboard — Avg Time to Hire shows bare dash with no explanation

**Date:** 2026-06-07
**Severity:** UX / Clarity
**Component:** `frontend/src/components/Dashboard/HealthStrip.jsx`

**Problem:**
When no hires occurred in the period, the Avg Time to Hire card showed `—` with no explanation, leaving admins confused about data availability.

**Fix:**
Added `delta: 'No hires this period'` to the card config when `avg_time_to_hire` is null/zero, using the `Stat` component's existing `delta` prop to render a subtle subtitle.

**Files Modified:**
- `frontend/src/components/Dashboard/HealthStrip.jsx`

---

### Bug #174: Positions List — Empty state lacked A+ design and clear CTA

**Date:** 2026-06-07
**Severity:** Design / UX
**Component:** `frontend/src/components/Positions/PositionsListPage.jsx` + `PositionsListPage.css`

**Problem:**
`EmptyPositions` used dense inline styles with no design token usage and generic messaging. CTA buttons lacked minimum touch target sizes.

**Fix:**
Rewrote with CSS classes (`positions-empty-*`): teal-rimmed icon circle, descriptive heading, segmented messaging (filter vs. global empty), primary/ghost CTA buttons (min-height 44px, design tokens throughout).

**Files Modified:**
- `frontend/src/components/Positions/PositionsListPage.jsx`
- `frontend/src/components/Positions/PositionsListPage.css`

---

### Bug #175: Position Detail — ATS chip had no tooltip; saturation bar had no explanation

**Date:** 2026-06-07
**Severity:** UX / Discoverability
**Component:** `frontend/src/components/Positions/StageHealthHeader.jsx`

**Problem:**
The "2-step ATS: embedding → LLM analysis" chip gave no indication of what it meant. The saturation bar was unlabeled with no hover explanation.

**Fix:**
Added `cursor: help` + descriptive `title` to ATS chip. Added `title="% of pipeline capacity evaluated at this stage — high saturation may indicate a bottleneck"` to saturation metric div.

**Files Modified:**
- `frontend/src/components/Positions/StageHealthHeader.jsx`

---

### Bug #176: Dashboard — PULSE "View" buttons too small for touch; empty lane too tall

**Date:** 2026-06-07
**Severity:** Accessibility / UX
**Component:** `frontend/src/styles/dashboard.css`

**Problem:**
`.tb-row-action` had `padding: 2px 0` giving ~18px touch target (violates ≥44px rule). Empty lanes had `padding: var(--space-6)` (24px top/bottom) creating excessive visual weight.

**Fix:**
`.tb-row-action`: added `min-height: 44px`, `padding: 0 8px`, `display: inline-flex; align-items: center`. `.tb-lane-empty`: reduced padding from `space-6` to `space-3`.

**Files Modified:**
- `frontend/src/styles/dashboard.css`

---

### Bug #177: Position Detail — Status dropdown isolated in hero-right, disconnected from title

**Date:** 2026-06-07
**Severity:** UX / Layout
**Component:** `frontend/src/components/Positions/PositionHero.jsx` + `PositionDetailPage.css`

**Problem:**
The status `<select>` was positioned in the far-right column, visually disconnected from the position title. Users had to scan across the hero to find the edit control.

**Fix:**
Moved `pd-status-select` into the title row (`.pd-hero-title-row`) inline with the position name for users with edit permissions. Added `.pd-status-select--inline` CSS variant (pill border-radius, compact padding). Removed the duplicate select from `pd-hero-right`.

**Files Modified:**
- `frontend/src/components/Positions/PositionHero.jsx`
- `frontend/src/components/Positions/PositionDetailPage.css`

---

### Bug #178: Positions Toolbar — Sort control used raw inline styles

**Date:** 2026-06-07
**Severity:** Code Quality / Design
**Component:** `frontend/src/components/Positions/PositionsToolbar.jsx` + `PositionsListPage.css`

**Problem:**
Sort label and wrapper used raw `style={{ ... }}` inline styles instead of design-token CSS classes, inconsistent with rest of toolbar.

**Fix:**
Replaced inline styles with `.positions-toolbar-right`, `.positions-sort-wrap`, and `.positions-sort-label` CSS classes.

**Files Modified:**
- `frontend/src/components/Positions/PositionsToolbar.jsx`
- `frontend/src/components/Positions/PositionsListPage.css`

---

## Candidate Detail Page & ATS Scoring Fixes

**Problem:**
1. Candidate Hero action buttons were horizontally crowded and secondary buttons didn't look like clickable buttons (missing borders).
2. The UI was showing browser native `alert()` popups for actions like "Retry ATS Score" instead of polished custom Toast notifications.
3. The ATS scoring was missing AI evaluation signals (`skills_match`, `experience_match`, `emb_score`, `career_trajectory`, `red_flags`), showing an empty breakdown.
4. The Notes Tab allowed tagging, but only from department-specific users, and it was missing a proper dropdown menu to autocomplete `@mentions` with the entire organization directory.
5. The Screening Responses section rendered raw backend field keys, appearing messy in the UI.

**Fix:**
1. Updated `CandidateHero.jsx` and `CandidateDetailPage.css` to group action buttons vertically and styled ghost buttons to resemble secondary buttons with borders.
2. Replaced `alert()` with the custom `Toast.jsx` component across `CandidateDetailPage.jsx` and `NotesTab`. Additionally, `handleRetryAts` now automatically reloads the candidate data after a brief delay.
3. Updated the `compute_ats_score` prompt in `backend/services/candidate_service.py` to correctly extract and return the missing fields in the JSON response.
4. Implemented a custom inline mention dropdown in `NotesTab` that fetches the global organization user list via `/auth/users` and filters it dynamically when typing `@`.
5. Created a key formatter in `ApplicationTab` inside `CandidateDetailPage.jsx` to map backend variables to readable labels (e.g., `compensation_current` -> "Current CTC").

**Files Modified:**
- `backend/services/candidate_service.py`
- `frontend/src/components/Candidates/CandidateHero.jsx`
- `frontend/src/components/Candidates/CandidateDetailPage.jsx`
- `frontend/src/components/Candidates/CandidateDetailPage.css`


---
### 179. Candidate Hero Button Styling & Disabled States
**Symptom:** Candidate Hero action buttons ("Schedule", "Mark Selected", "Retry ATS Score") were not styled like standard buttons, leading to a mismatched UI. Furthermore, the "Move to..." button did not disable when the candidate was in the final pipeline stage.
**Root Cause:** The `CandidateHero.jsx` component used local CSS classes (`cd-action-primary`, `cd-action-ghost`) that did not align with the product's standardized `btn` or `pd-btn` aesthetic. The disabled logic for the primary status move button was missing.
**Fix:**
- Consolidated local button styles in `CandidateDetailPage.css` into a standardized `.cd-btn` class family (`cd-btn-primary`, `cd-btn-outline`, `cd-btn-ghost`) mirroring the premium button styles from other pages.
- Updated `CandidateHero.jsx` to apply the new button styles.
- Added logic to dynamically disable the "Move to..." button when no next `VISIBLE_MOVE_STAGES` exist.

---
### 180. Replaced Native Browser Confirm Modals in Candidate Details
**Symptom:** A native `window.confirm()` popup was firing when taking pipeline actions, which breaks the SaaS immersion.
**Root Cause:** A hardcoded `window.confirm` was embedded directly in the `onMarkSelected` callback passed down to `CandidateHero.jsx`.
**Fix:** Replaced the native alert with the application's `ConfirmModal` component (product-native dialog) using state triggers (`setSelectConfirmOpen(true)`).


---
### 181. Candidate Notes 500 Internal Server Error (KeyError)
**Symptom:** Saving a note in the candidate profile threw a `500 Internal Server Error` with `KeyError: 'id'` and then immediately failed again with `KeyError: 'name'` if the first error was bypassed.
**Root Cause:** The `notes.py` router accessed `user["id"]` and `user["name"]` from the dictionary returned by `get_current_user`. However, `get_current_user` parses the JWT which only contains `"sub"` (mapped to `"user_id"`) and does not contain the user's name.
**Fix:**
- Updated `backend/dependencies.py` to inject `"id"` alongside `"user_id"` into the dependency payload for backward compatibility with older endpoints.
- Updated `backend/routers/notes.py` to explicitly query the `users` table for the author's name (`author_name = await conn.fetchval("SELECT name FROM users WHERE id=$1", user["id"])`) instead of trying to read it from the JWT.


---
### 182. Note Mentions Not Dispatching Notifications & Missing Edit Mode UX
**Symptom:** 
1. When mentioning a user via `@name` in the Notes tab of a candidate's profile, the mentioned user never received a notification despite the UI indicating they were tagged.
2. When editing an existing note, typing `@` did not trigger the user directory dropdown, making it impossible to tag users properly in edit mode.
**Root Cause:** 
1. The frontend `NotesTab` allowed users to type `@name` and visually inserted it into the textarea text, but it completely failed to extract the corresponding user IDs and attach them to the `mentions` array in the payload sent to the `notesApi.create` endpoint.
2. The note edit state used a generic `onChange` handler that bypassed the sophisticated mention detection logic built for the draft creation mode.
**Fix:**
- Implemented `extractMentions()` to scan the draft text against the cached `orgUsers` directory and map them to their specific user IDs, which are now correctly passed in the API payload.
- Unified the `handleDraftChange` into a bi-modal `handleInputChange(e, mode)` to support triggering the tagging logic in both `'draft'` and `'edit'` states.
- Extracted the mention dropdown into a shared `renderMentionDropdown` function and injected it correctly beneath both the compose box and the inline edit box.


---
### 183. Position Hero Status Dropdown Styling Fix
**Symptom:** The position status dropdown ("Active (Open)") in the `PositionHero` header appeared as a dark, unstyled native select element that looked out of place and broke the premium aesthetics of the design system.
**Root Cause:** When the user had edit permissions, the system swapped out the beautiful `Chip` component for a raw `<select>` element with a basic CSS class (`pd-status-select--inline`). Native selects are difficult to style beautifully across different browsers and operating systems.
**Fix:** Refactored the interactive status control to utilize an invisible native `<select>` element perfectly overlaid on top of a fully-styled `Chip` component. This preserves the beautiful, dynamic status colors (e.g., green for Active, yellow for On Hold) and semantic `Chip` design while retaining the interactive dropdown behavior of the `<select>`.

---
### 184. Refactored Position Status UI Layout (Static Chip + Action Button)
**Symptom:** Based on product feedback, replacing the inline static status label with an interactive dropdown broke the clean aesthetics of the title header row. 
**Root Cause:** Interactivity was embedded directly into the primary status indicator, making it visually noisy. 
**Fix:** Restored the `Active (Open)` status indicator next to the position title to be a purely static, beautiful semantic `Chip`. Moved the interactive state change control out of the title flow entirely, adding a distinct "Change Status" dropdown button into the right-hand action bar (`pd-hero-actions`). This preserves discoverability without cluttering the main metadata display.

---
### 185. Candidate Actions Modals & Popup Placement
**Symptom:**
1. Most candidate pipeline actions (status change, retry ATS) were missing confirmation modals.
2. Small popups (like ConfirmModal) appeared unnecessarily tall with huge vertical spacing, making them appear pushed down, while tall popups (like Schedule Interview) didn't utilize available screen height efficiently, forcing unnecessary scrolling.
**Root Cause:**
1. Handlers directly called API without intercepting with state-driven ConfirmModals.
2. Global `.modal-content` CSS forced a `min-height: 400px`, making small modals huge, and a restrictive `max-height: 80vh` which cut off tall modals too early.
**Fix:**
- Intercepted `handleStatusChange` and `handleRetryAts` in `CandidateDetailPage.jsx` with React state to render `ConfirmModal`s before executing the API calls.
- Removed `min-height: 400px` from global `.modal-content` and increased `max-height` to `90vh` so modals wrap their content beautifully and center perfectly on the screen.

---
### 186. Organic Candidate ATS Scoring Failure ('NoneType' object has no attribute 'get')
**Symptom:** When a candidate applied through the careers page chat bot (organic application), their background ATS scoring failed silently in Celery with `'NoneType' object has no attribute 'get'`, leaving them without an AI score or evaluation. Additionally, the notification sent to recruiters had a broken link (`/positions/None?tab=candidates`).
**Root Cause:** The `apply_service.py` attempted to extract `position_id` from the decoded magic link JWT payload (`payload.get("position_id")`). However, the magic link token schema only contains `application_id`, `candidate_id`, and `org_id`. Because it didn't exist, `position_id` evaluated to `None`. This `None` was passed to the celery background task, causing `PositionRepository.get()` to return `None`, which immediately crashed when trying to access `position.get("ats_threshold")`.
**Fix:** Updated the recruiter notification query inside `complete_application` to explicitly `SELECT ca.position_id` from the `candidate_applications` table using the known `application_id`. Substituted the broken `payload.get()` fallback with the real, database-verified `position_id` for both the notification action URL and the Celery background task arguments.

---

### 187. Phase 2 Features Implementation
**Date:** 2026-06-08
**Status:** Implemented

**Issue / Feature:**
Implementation of Phase 2 items: Audit Logs UI, Video Intros, and Team Lead Dashboard.
- **Audit Logs**: Created backend service to query the `audit_log` table and added `/audit-logs` endpoint. Built the `AuditTab` frontend component.
- **Video Intros**: Updated `backend/routers/apply.py` to save uploaded videos locally. Mounted `/uploads` static directory. Updated `CandidateDetailPage.jsx` to render the video player properly resolving the URL.
- **Team Lead Dashboard**: Created a specialized `TeamLeadDashboard.jsx` layout isolating "My Requisitions", "AI Copilot" and tailored lanes, rendering conditionally in `DashboardPage.jsx` for the `team_lead` role.

**Files Modified:**
- `backend/services/audit_service.py` (New)
- `backend/routers/settings.py`
- `frontend/src/components/Settings/tabs/AuditTab.jsx` (New)
- `backend/main.py`
- `backend/routers/apply.py`
- `frontend/src/components/Candidates/CandidateDetailPage.jsx`
- `frontend/src/components/Dashboard/TeamLeadDashboard.jsx` (New)
- `frontend/src/components/Dashboard/DashboardPage.jsx`
- `frontend/src/components/Settings/SettingsPage.jsx`

### 188. Bias Check JSON Parsing
**Date:** 2026-06-10
**Status:** Fixed

**Issue:**
The bias checker agent failed silently because the LLM returned markdown formatting alongside the JSON, which the python `json.loads` could not parse.

**Idea / Solution:**
Updated the LLM configuration in `backend/adapters/llm/factory.py` to enforce `json_mode` and updated `backend/agents/bias_checker.py` to use `json_mode=True` and added a more robust JSON extraction fallback.

**Files Modified:**
- `backend/adapters/llm/factory.py`
- `backend/agents/bias_checker.py`


### Issue 189: Missing Platform Providers Settings
**Description**: Platform-level API keys for LLMs, embeddings, web search, and enrichment missing UI/API surface.
**Fix**: 
1. Added `ProviderConfig` and `ProvidersUpdate` schemas.
2. Added `/api/v1/settings/providers` GET/PATCH endpoints to update `.env` via `python-dotenv`.
3. Created `ProvidersTab.jsx` for the frontend admin panel, masking keys appropriately.
**Files Modified**: 
- `backend/config.py`
- `backend/models/settings.py`
- `backend/services/settings_service.py`
- `backend/routers/settings.py`
- `frontend/src/utils/api.js`
- `frontend/src/components/Settings/SettingsPage.jsx`
- `frontend/src/components/Settings/tabs/ProvidersTab.jsx`

### Issue 190: Auto-reject/on-hold logic & Sourcing Email Deduplication
**Description**: Need to route candidates to 'on_hold' if ATS score < threshold and provide a Bulk Reject UI. Sourcing was failing because web profiles lack emails.
**Fix**:
1. Added `rejection_reason` to `candidate_applications` and `skill_tags` to `candidates` via schema migrations.
2. Updated `candidate_pipeline.py` to route applications to 'screening' or 'on_hold' based on `ats_threshold`.
3. Updated `candidate_pipeline.py` to allow `email=None` and deduplicate candidates using `source_profile_url`.
4. Added 'On Hold' stage to `PipelineTab.jsx` with a "Bulk Reject" UI action.
5. Added `POST /api/v1/candidates/bulk-reject` endpoint to process bulk rejections and log pipeline events.
**Files Modified**:
- `backend/db/migrations.py`
- `backend/tasks/candidate_pipeline.py`
- `backend/routers/candidates.py`
- `frontend/src/components/Positions/tabs/PipelineTab.jsx`
- `frontend/src/utils/api.js`

### Issue 191: Sourcing Configuration, Pre-Evaluations & Candidate Portal
**Description**: Implemented remaining task list block (Tasks 5-8) covering sourcing config, pre-evaluation infrastructure, candidate portal logic, and GDPR table migrations.
**Fix**:
1. Added Sourcing Config GET/PATCH endpoints and `SourcingTab.jsx`.
2. Implemented `backend/adapters/enrichment` (Clearbit/Lusha simulation) and connected it to `candidate_pipeline.py`.
3. Created `pre_evaluations` database table, API router, repository, and connected to pipeline.
4. Added `password_hash` to `candidates` table and created `/api/v1/candidates/portal` login/timeline APIs.
5. Built candidate portal frontend components (`CandidateLogin.jsx`, `CandidateDashboard.jsx`) and linked in `router.jsx`.
6. Built `Careers.jsx` skeleton and added `candidate_consents` table for GDPR.
**Files Modified**:
- `backend/routers/settings.py`
- `backend/tasks/candidate_pipeline.py`
- `backend/db/migrations.py`
- `frontend/src/components/Settings/SettingsPage.jsx`
- `frontend/src/utils/api.js`
- `backend/main.py`
- `frontend/src/router.jsx`
- `backend/dependencies.py`
- `backend/adapters/enrichment/*` (New)
- `backend/db/repositories/pre_evaluations.py` (New)
- `backend/routers/pre_evaluations.py` (New)
- `backend/routers/candidate_portal.py` (New)
- `frontend/src/components/Settings/tabs/SourcingTab.jsx` (New)
- `frontend/src/pages/CandidatePortal/*` (New)
- `frontend/src/pages/Careers.jsx` (New)

---

## 192. Candidate Portal Auth, Pre-Evaluations Batching, and Global Talent Pool Schema

**Problem Statement:**
1. Pre-evaluations were being graded synchronously blocking the main API thread.
2. The candidate portal was lacking a password setup workflow and timeline visualization.
3. The platform lacked a documented cross-organization schema for a product-level talent pool.

**Idea / Solution:**
1. **Pre-Evaluation:** Implemented a new Celery task (`backend/tasks/pre_eval_grade.py`) to batch grade pre-evaluations nightly. Introduced an LLM-based anti-cheating mechanism that dynamically paraphrases questions pulled from the `interview_kits`.
2. **Candidate Portal:** Built the candidate JWT auth primitives, added `/set-password`, and created a new email dispatch trigger (`send_pre_evaluation_invite`). Built `SetPassword.jsx` and `CandidateDashboard.jsx` on the frontend.
3. **Global Talent Pool:** Added `consent_to_store` and `consent_to_contact` fields to the database. Authored `docs/architecture/CROSS_ORG_SCHEMA.md` detailing the Global Database approach and CDC propagation. Created the `/opt-in-talent-pool` API.

**Files Modified:**
- `backend/tasks/pre_eval_grade.py`
- `backend/tasks/candidate_pipeline.py`
- `backend/celery_app.py`
- `backend/routers/pre_evaluations.py`
- `backend/routers/candidate_portal.py`
- `backend/services/email_service.py`
- `frontend/src/pages/CandidatePortal/SetPassword.jsx`
- `frontend/src/pages/CandidatePortal/CandidateDashboard.jsx`
- `frontend/src/router.jsx`
- `docs/architecture/CROSS_ORG_SCHEMA.md`

---

## 193. Phase 2 Code Review — Critical Backend Wiring & Security Fixes
**Date:** 2026-06-10
**Status:** Fixed

**Problem Statement:**
Full code review of the Phase 2 Gemini implementation revealed four critical issues that would have caused complete feature failure on first run:
1. `candidate_portal` and `pre_evaluations` routers were imported in `main.py` but never mounted via `app.include_router()` — every endpoint returned 404.
2. `candidatePortalApi` and `preEvaluationsApi` were referenced in frontend components but never exported from `api.js` — all candidate-facing pages would crash on load.
3. `pre_evaluations.py` router used `from backend.db.connection import get_connection as get_db` — `get_connection` returns an async context manager, not an async generator, causing FastAPI startup failure when Depends tried to call it.
4. Candidate JWT tokens (`role="candidate"`) were not blocked from accessing internal staff endpoints in `get_current_user` — a candidate could potentially call any internal API using their login token.

**Idea / Solution:**
1. Added `app.include_router(candidate_portal_router.router)` and `app.include_router(pre_evaluations_router.router)` in `main.py`.
2. Implemented `_candidateFetch` helper (reads `localStorage.getItem('candidate_token')`) and exported full `candidatePortalApi` and `preEvaluationsApi` objects from `api.js`.
3. Fixed `pre_evaluations.py` to `from backend.dependencies import get_db`.
4. Added role check in `dependencies.py`: if `payload.get("role") == "candidate"`, raise `InsufficientPermissionsError` before granting access.

**Files Modified:**
- `backend/main.py`
- `backend/routers/pre_evaluations.py`
- `backend/dependencies.py`
- `frontend/src/utils/api.js`

---

## 194. Phase 2 Code Review — Pre-Evaluation Pipeline Correctness Fixes
**Date:** 2026-06-10
**Status:** Fixed

**Problem Statement:**
The nightly pre-evaluation grading task (`pre_eval_grade.py`) and the candidate pipeline had multiple correctness bugs that would silently fail or corrupt data:
1. `update_application(conn, org_id, application_id, data)` — arguments were swapped; actual signature is `(conn, application_id, org_id, data)`.
2. SQL query used `p.jd_text` which does not exist; the column is `p.jd_markdown`. Prompt template also referenced `row['jd_text']`.
3. `asyncio.get_event_loop().run_until_complete()` is deprecated and raises `DeprecationWarning` on Python 3.10+ and errors on 3.12+. Used in the Celery task entry point.
4. `rejection_reason` was written by both `pre_eval_grade.py` and `candidates.py` (bulk reject), but the field was missing from the `update_application` allowed-columns set in `CandidateRepository` — it was silently dropped on every write.
5. `pre_evaluations` table was missing from `RLS_TABLES_WITH_ORG_ID` in migrations, leaving it without row-level security. Also missing `position_id` and `evaluated_at` columns added by the Gemini implementation.
6. `consent_to_store`, `consent_to_contact`, and `consent_timestamp` columns referenced by the opt-in endpoint were missing from the `candidates` table migration.

**Idea / Solution:**
1. Fixed argument order: `CandidateRepository.update_application(conn, application_id, org_id, data)`.
2. Fixed SQL query: `p.jd_markdown`; fixed prompt: `row['jd_markdown']`.
3. Replaced `asyncio.get_event_loop().run_until_complete()` with `asyncio.run()`.
4. Added `"rejection_reason"` to the allowed set in `CandidateRepository.update_application`.
5. Added `"pre_evaluations"` to `RLS_TABLES_WITH_ORG_ID`; added idempotent `ALTER TABLE pre_evaluations ADD COLUMN IF NOT EXISTS` for `position_id` and `evaluated_at`.
6. Added idempotent `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS` for all three consent columns.

**Files Modified:**
- `backend/tasks/pre_eval_grade.py`
- `backend/db/repositories/candidates.py`
- `backend/db/migrations.py`

---

## 195. Phase 2 Code Review — Sourcing Adapter, Enrichment Safety & Providers Security
**Date:** 2026-06-10
**Status:** Fixed

**Problem Statement:**
Three issues in the sourcing and settings layers:
1. `candidate_pipeline.py` always used the global env-var adapter, ignoring the per-org `sourcing_config` written by `SourcingTab`. Also imported `OrganizationRepository` which does not exist (the class is `OrgRepository`). `CandidateRepository.get()` argument order was also swapped.
2. `enrichment/__init__.py` did not return `None` for unimplemented real providers (Proxycurl, Apollo, Hunter) — calling them with no real API key would silently use simulation data and fabricate email addresses, which would then be sent to real people.
3. Providers endpoints (`GET/PATCH /settings/providers`) were gated behind `require_org_head` — org admins could overwrite platform-level API keys (Groq, Tavily, etc.) that are meant to be platform-central only.

**Idea / Solution:**
1. Fixed import: `OrgRepository`. Fixed `CandidateRepository.get(conn, candidate_id, org_id)`. Added per-org adapter resolution: reads `org.sourcing_config.source_adapter`, falls back to `settings.DEFAULT_SOURCE_ADAPTER`. Gated enrichment call on `sourcing_config.enrichment_enabled` flag AND non-None adapter. Added `DEFAULT_SOURCE_ADAPTER: str = "simulation"` to `config.py`.
2. `get_enrichment_adapter()` now returns `None` for any provider name that is not `"simulation"`, logs a warning, and the pipeline skips enrichment rather than fabricating data.
3. Changed both providers endpoints from `require_org_head` to `require_platform_admin`.

**Files Modified:**
- `backend/tasks/candidate_pipeline.py`
- `backend/adapters/candidate_sources/__init__.py`
- `backend/adapters/enrichment/__init__.py`
- `backend/config.py`
- `backend/routers/settings.py`

---

## 196. Phase 2 Code Review — Frontend Component & API Fixes
**Date:** 2026-06-10
**Status:** Fixed

**Problem Statement:**
Multiple frontend pages and components were broken or non-functional:
1. `SourcingTab.jsx`, `CandidateLogin.jsx`, `SetPassword.jsx`, and `CandidateDashboard.jsx` all imported from `../../shared/ui` or `../../components/shared/ui` barrel files that do not exist in the project, causing Vite import errors.
2. `CandidateLogin.jsx` had a stub `handleSubmit` that only logged to console — clicking login did nothing.
3. `CandidateDashboard.jsx` had no auth guard and called `candidatePortalApi.get('/timeline')` (wrong pattern) instead of `candidatePortalApi.getTimeline()`. The opt-in call also used the wrong method signature.
4. `SourcingTab.jsx` used `auto_enrich` as the config key but the backend pipeline checks `enrichment_enabled`.
5. `ProvidersTab.jsx` imported `Button` from `../../common/Button` and `InputField` from `../../common/InputField` — neither file existed.
6. The `GET /candidate/timeline` endpoint returned applications without joining `pre_evaluations`, so `app.pre_eval_token` was always null and the dashboard always showed "check your email" instead of a direct link to the assessment.

**Idea / Solution:**
1. Rewrote all four components using plain HTML elements (`<input>`, `<button>`, `<select>`) — no missing component dependencies.
2. Implemented full login logic in `CandidateLogin.jsx`: calls `candidatePortalApi.login()`, stores token in `localStorage`, navigates to dashboard. Reads `org_id` from `?org=` query param.
3. Added auth guard (redirect to `/candidate/login` if no token; clear token on 401) and fixed all API call patterns in `CandidateDashboard.jsx`.
4. Fixed config key: `auto_enrich` → `enrichment_enabled` in `SourcingTab.jsx`.
5. Created `frontend/src/components/common/Button.jsx` and `frontend/src/components/common/InputField.jsx` as thin wrappers matching the project's CSS class conventions.
6. Updated the timeline SQL query to `LEFT JOIN pre_evaluations pe ON pe.application_id = ca.id AND pe.status IN ('pending', 'submitted')` and added `pe.token AS pre_eval_token` to the SELECT.

**Files Modified:**
- `frontend/src/pages/CandidatePortal/CandidateLogin.jsx`
- `frontend/src/pages/CandidatePortal/SetPassword.jsx`
- `frontend/src/pages/CandidatePortal/CandidateDashboard.jsx`
- `frontend/src/components/Settings/tabs/SourcingTab.jsx`
- `frontend/src/components/common/Button.jsx` (created)
- `frontend/src/components/common/InputField.jsx` (created)
- `backend/routers/candidate_portal.py`

---

## 197. Phase 2 — Collusion Detection in Pre-Evaluation Grader
**Date:** 2026-06-10
**Status:** Fixed

**Problem Statement:**
The pre-evaluation anti-cheat plan included detecting when two candidates (e.g., friends applying together) submit near-identical answers for the same position. Without this, the LLM grader would pass both independently, letting colluders reach the Interview stage undetected.

Additionally, the collusion check ran after `_grade_single` had already routed passing candidates to `status='interview'` in `candidate_applications`. Flagging the `pre_evaluations` row alone would leave colluders visibly in the Interview Kanban lane while HR was still reviewing.

**Idea / Solution:**
Implemented `_detect_collusion(conn, rows)` and `_answer_similarity(answers_a, answers_b)` in `pre_eval_grade.py`:
- After all individual grades complete, submissions are grouped by `position_id`.
- For every pair within a position, `difflib.SequenceMatcher` computes the average character-level similarity ratio across shared question keys (text lowercased and stripped).
- Pairs with similarity ≥ 0.80 are flagged: both `pre_evaluations` rows are set to `status='flagged'` (overriding passed/failed), and the corresponding `candidate_applications` rows are reverted to `status='on_hold'` so they leave the Interview lane and await manual HR review.
- SQL query updated to include `p.id AS position_id` to support the grouping.

**Files Modified:**
- `backend/tasks/pre_eval_grade.py`
- `.gitignore` (added `frontend/dist/`)

---

## 198. Sourcing Schedule Configuration & HR Permissions
**Date:** 2026-06-10
**Status:** Fixed

**Problem Statement:**
The "Sourcing Schedule" tab was implemented in components but missing from the Settings page routing. Once exposed, it had a basic unstyled UI, lacked save confirmation feedback, and incorrectly allowed HR roles to attempt saving despite lacking backend authorization, causing a 403 Forbidden error. Furthermore, Department Admins were blocked by `require_org_head` on the backend.

**Idea / Solution:**
- Wired `SourcingTab` into `SettingsPage.jsx` routing and included it in the array of components that force `isReadOnly=true` for HR roles, cleanly locking down the UI.
- Redesigned `SourcingTab.jsx` using premium SaaS `Toggle` switches, `Icon` blocks, and standard layout styling to match other Settings tabs.
- Integrated `Toast` component into the save workflow to provide explicit "Sourcing configuration saved successfully" feedback.
- Updated `PATCH /api/v1/settings/sourcing-config` in `backend/routers/settings.py` from `require_org_head` to `require_dept_admin`, aligning with standard role capabilities.

**Files Modified:**
- `frontend/src/components/Settings/SettingsPage.jsx`
- `frontend/src/components/Settings/tabs/SourcingTab.jsx`
- `backend/routers/settings.py`

## 199. Dev Console Admin Creation Fails due to missing defaults

**Problem Statement:**
When creating a new user as a Platform Admin in the Dev Console, it resulted in a `500 Internal Server Error`. The SQL `INSERT` statements in `/api/v1/dev/create-user` were attempting to insert into the `updated_at` column which doesn't exist for the `organizations` and `users` tables. Furthermore, it lacked the required `segment` and `size` fields (which lack default values in the schema) when implicitly creating a new organization.

**Idea / Solution:**
Modified the SQL queries in `backend/routers/dev_admin.py` to correctly map the columns. Removed the non-existent `updated_at` references and added static fallback default values (`Technology` for segment, `Mid-Market` for size) for the auto-created organizations so they pass database NOT NULL constraints.

**Files Modified:**
- `backend/routers/dev_admin.py`

---

## 200. Platform Dashboard Redesign & API Keys Integration

**Problem Statement:**
The Platform Admin dashboard had a basic layout and lacked an accessible way for super-users to configure global API keys (the `ProvidersTab` existed but was isolated in tenant settings, inaccessible from the platform dashboard without manual URL navigation).

**Idea / Solution:**
Performed a complete UI/UX redesign of the Platform Dashboard using premium aesthetic patterns (glassmorphism, subtle gradients, micro-animations, and hover interactions). Integrated the `ProvidersTab` directly into the Dashboard (`/platform`) under a newly created "Providers & API Keys" tab, wrapped in CSS to seamlessly match the new dark-glassmorphism theme of the main dashboard.

**Files Modified:**
- `frontend/src/components/Platform/PlatformPage.jsx`
- `frontend/src/components/Platform/PlatformPage.css`


## 201. Remove P2 Tag from Career Brand Settings Tab

**Problem Statement:**
The "Career page brand" tab in the Settings navigation rail still displayed a "P2" (Phase 2) badge, even though the feature is fully implemented and active.

**Idea / Solution:**
Removed the `phase: 2` property from the `career-brand` item definition in the `RAIL_GROUPS` configuration within `SettingsPage.jsx`.

**Files Modified:**
- `frontend/src/components/Settings/SettingsPage.jsx`
