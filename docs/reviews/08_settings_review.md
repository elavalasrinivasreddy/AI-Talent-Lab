# Code Review: 08 — Settings

> **Surface:** SettingsPage (frontend), settingsApi / orgApi (backend)
> **Reviewer:** Automated GA pass (2026-05-29)
> **Status:** REVIEW COMPLETE

---

## 1. Authorization

| Check | Status | Notes |
|-------|--------|-------|
| API calls scoped | ✅ PASS | Settings API uses Bearer token; backend scopes all queries by `org_id` |
| Tab-level role gates | ⚠️ WARN | Settings tabs (Users, Departments, Competitors, etc.) are all visible to all roles. Spec says "Team Members" and "Departments" tabs should be `org_head`-only |
| User invite action | ✅ PASS | `POST /api/v1/auth/invite` checks for `org_head` role |
| Org settings update | ✅ PASS | `PATCH /api/v1/settings/org` requires `org_head` |

**Finding C-SET-01 (MEDIUM):** Hide "Team Members" and "Departments" tabs from `hr` and `team_lead` roles. They can view them currently even though the backend rejects their mutations.

---

## 2. SQL / Query Safety

| Check | Status | Notes |
|-------|--------|-------|
| Frontend | ✅ N/A | No SQL |
| Backend settings queries | ✅ PASS | All scoped by `org_id` with parameterized queries |
| Screening questions CRUD | ✅ PASS | `INSERT/UPDATE/DELETE` all use `AND org_id = $N` |
| Message templates CRUD | ✅ PASS | Same pattern as screening questions |

---

## 3. Error Handling

| Check | Status | Notes |
|-------|--------|-------|
| Save errors | ✅ PASS | Each tab shows inline error messages on save failure |
| Load failures | ✅ PASS | Individual tab error states |
| Permission denied | ⚠️ WARN | Backend returns 403 but frontend shows generic "Something went wrong" instead of "Permission denied" |

**Finding C-SET-02 (LOW):** Frontend should detect 403 responses and show "You don't have permission to modify this setting" instead of a generic error.

---

## 4. Status Transitions

| Check | Status | Notes |
|-------|--------|-------|
| User deactivation | ✅ PASS | `PATCH /users/:id` sets `is_active=false` — toggle is idempotent |
| Department delete | ✅ PASS | Backend checks for existing positions before allowing delete |

---

## 5. Idempotency

| Check | Status | Notes |
|-------|--------|-------|
| Org settings save | ✅ PASS | `PATCH` with same values is idempotent |
| User invite re-send | ⚠️ WARN | Inviting same email twice creates duplicate invite tokens. Backend should check for existing active invite |

**Finding C-SET-03 (MEDIUM):** `POST /api/v1/auth/invite` should check if user with this email already exists (active or invited) before creating a new entry. Currently creates duplicate rows.

---

## 6. Email HTML Escaping

| Check | Status | Notes |
|-------|--------|-------|
| User invite email | ✅ PASS | `EmailService.send_user_invite()` escapes `invitee_name`, `inviter_name`, `org_name`, `role_label` with `html.escape()` |

---

## 7. Frontend Loading/Error States

| Check | Status | Notes |
|-------|--------|-------|
| Tab loading | ✅ PASS | Each tab shows loading indicator |
| Empty states | ✅ PASS | "No team members", "No departments" etc. messages |
| Save button disabled | ✅ PASS | Disabled while saving |

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 2 (C-SET-01, C-SET-03) |
| LOW | 1 (C-SET-02) |
