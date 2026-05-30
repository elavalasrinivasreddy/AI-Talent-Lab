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
