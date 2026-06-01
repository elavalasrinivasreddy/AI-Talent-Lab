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
