# State Machine Diagrams — AI Talent Lab

> Design Rev 4 · JD Generation & Position Approval Workflow
> Every box = a status. Every arrow = a transition with actor + data + side effects.

---

## 1. `position.status` State Machine

```mermaid
stateDiagram-v2
    direction LR

    [*] --> jd_in_progress : Flow 1: HR picks up hire request\nFlow 2: HR/Admin clicks New Hire

    jd_in_progress --> pending_jd_approval : HR submits JD\n(transactional: ats_threshold,\nsourcing_freq, reviewer_id,\nsubmitted_by_role, submitted_at)

    jd_in_progress --> open : org_head submits (Flow 2 bypass)\n(no reviewer needed)

    jd_in_progress --> cancelled : TL cancels hire request\n(before submit only, notes REQUIRED)\n(HR notified)

    pending_jd_approval --> open : Reviewer approves\n(single txn: position→open,\nhire_request→fulfilled)\n(async: career page, ATS, notifs)

    pending_jd_approval --> draft_needs_revision : Reviewer rejects\n(notes REQUIRED,\nrevision_cycle++,\nbias resets)

    pending_jd_approval --> jd_in_progress : HR withdraws submission\n(reviewer notified,\nbias resets,\nrevision_cycle unchanged)

    draft_needs_revision --> pending_jd_approval : HR re-submits\n(after addressing feedback,\nbias must pass again)

    state jd_in_progress {
        [*] --> ChatRW
        ChatRW : Chat Read-Write
        ChatRW : Bias gate → Finalize
        ChatRW : Save Draft always available
    }

    state pending_jd_approval {
        [*] --> ChatRO
        ChatRO : Chat READ-ONLY
        ChatRO : Delete session disabled
        ChatRO : Reviewer acts
    }

    state draft_needs_revision {
        [*] --> RevisionMode
        RevisionMode : Chat Read-Write (reopened)
        RevisionMode : Bias flag reset
        RevisionMode : Feedback injected as system msg
    }

    state open {
        [*] --> Live
        Live : Career page published
        Live : ATS sourcing active
        Live : Chat permanently locked
        Live : Only ats_threshold + sourcing_freq editable
        Live : (org_head / dept_admin only)
    }

    state cancelled {
        [*] --> Dead
        Dead : Terminal state
    }
```

### Position Transition Rules Table

| # | From | → To | Triggered by | Data required | Notes required | Side effects |
|---|------|------|-------------|---------------|---------------|-------------|
| 1 | — (entry) | `jd_in_progress` | hr (Flow 1: pickup) | Atomic CAS on `picked_up_by` | — | hire_request stays approved |
| 2 | — (entry) | `jd_in_progress` | hr / dept_admin / org_head (Flow 2) | — | — | Position created directly |
| 3 | `jd_in_progress` | `pending_jd_approval` | hr / dept_admin | ats_threshold, sourcing_freq, reviewer_id, submitted_by_role, submitted_at | — | Reviewer notified |
| 4 | `jd_in_progress` | `open` | org_head (Flow 2 bypass) | — | — | Career page + ATS start |
| 5 | `jd_in_progress` | `cancelled` | team_lead | — | **YES** | HR notified |
| 6 | `pending_jd_approval` | `open` | resolved reviewer | — | — | Txn: position→open + hire_request→fulfilled; Async: career, ATS, notifs |
| 7 | `pending_jd_approval` | `draft_needs_revision` | resolved reviewer | — | **YES** | revision_cycle++, bias resets, feedback injected |
| 8 | `pending_jd_approval` | `jd_in_progress` | hr (withdraw) | — | — | Reviewer notified, bias resets |
| 9 | `draft_needs_revision` | `pending_jd_approval` | hr (re-submit) | — | — | Bias must pass again |

### Ambiguity Audit

| Check | Status |
|-------|--------|
| Can TL cancel after `pending_jd_approval`? | **NO** — must reject at review step |
| Can TL cancel after `open`? | **NO** — terminal in Phase 1 |
| Does `open` → `closed` exist? | **YES** but via separate status endpoint, not this state machine |
| Does `revision_cycle` increment on HR withdraw? | **NO** — only on reviewer rejection |
| Does bias reset on HR withdraw? | **YES** |

---

## 2. `hire_request.status` State Machine

```mermaid
stateDiagram-v2
    direction LR

    [*] --> draft : TL creates hire request

    draft --> submitted : TL submits\n(visible to dept admins)

    submitted --> admin_reviewing : Admin begins review\n(atomic CAS lock)

    submitted --> cancelled : TL cancels\n(notes REQUIRED,\nadmin notified if lock active)

    admin_reviewing --> approved : Admin approves\n(no notes needed)

    admin_reviewing --> approved_modified : Admin approves + modifies fields\n(notes REQUIRED,\ndiff stored as JSONB,\nTL notified with diff)

    admin_reviewing --> rejected : Admin rejects\n(notes REQUIRED,\nshown to TL)

    admin_reviewing --> submitted : Admin closes without action\nOR 30-min TTL expires\n(lock released)

    approved --> cancelled : TL cancels before HR pickup\n(notes REQUIRED,\ndept HRs notified)

    approved_modified --> cancelled : TL cancels before HR pickup\n(notes REQUIRED)

    approved --> hr_pickup_exit : HR picks up → position created\n(atomic CAS on position.picked_up_by)
    approved_modified --> hr_pickup_exit : HR picks up → position created\n(atomic CAS on position.picked_up_by)

    state admin_reviewing {
        [*] --> Locked
        Locked : reviewing_locked_by = admin_id
        Locked : reviewing_locked_at = NOW()
        Locked : 30-min TTL auto-release
        Locked : Takeover UI after 10 min
    }

    state approved {
        [*] --> InQueue
        InQueue : Visible in HR pickup queue
        InQueue : Dept-scoped visibility
    }

    state approved_modified {
        [*] --> ModifiedQueue
        ModifiedQueue : Diff stored (JSONB, schema_version 1)
        ModifiedQueue : TL sees field changes
    }

    state rejected {
        [*] --> RejectedFinal
        RejectedFinal : Terminal
        RejectedFinal : Notes shown to TL
    }

    state cancelled {
        [*] --> CancelledFinal
        CancelledFinal : Terminal
    }

    state hr_pickup_exit {
        [*] --> PositionCreated
        PositionCreated : hire_request status UNCHANGED
        PositionCreated : position → jd_in_progress
    }
```

### Hire Request Transition Rules Table

| # | From | → To | Triggered by | Data required | Notes required | Side effects |
|---|------|------|-------------|---------------|---------------|-------------|
| 1 | — (entry) | `draft` | team_lead | role_name, dept, headcount, etc. | — | Not visible to admins |
| 2 | `draft` | `submitted` | team_lead | — | — | Dept admins notified |
| 3 | `submitted` | `admin_reviewing` | dept_admin | Atomic CAS (zero rows = beaten) | — | Lock set |
| 4 | `submitted` | `cancelled` | team_lead | — | **YES** | Admin notified if lock active |
| 5 | `admin_reviewing` | `approved` | dept_admin | — | — | Visible in HR pickup queue |
| 6 | `admin_reviewing` | `approved_modified` | dept_admin | Modified fields | **YES** (diff stored) | TL notified with diff |
| 7 | `admin_reviewing` | `rejected` | dept_admin | — | **YES** | TL sees rejection notes |
| 8 | `admin_reviewing` | `submitted` | dept_admin (close) / system (TTL) | — | — | Lock released |
| 9 | `approved` | `cancelled` | team_lead (before HR pickup) | — | **YES** | Dept HRs notified |
| 10 | `approved_modified` | `cancelled` | team_lead (before HR pickup) | — | **YES** | — |
| 11 | `approved` / `approved_modified` | *(no status change)* | hr (picks up) | Atomic CAS on position | — | position → jd_in_progress |

### Ambiguity Audit

| Check | Status |
|-------|--------|
| Is `hr_pickup` a hire_request status? | **NO** — hire_request stays `approved`/`approved_modified`. Pickup tracked on position. |
| Can TL cancel after HR pickup? | **YES** but via position cancel (jd_in_progress → cancelled), not hire_request status change |
| Can two admins review simultaneously? | **NO** — atomic CAS lock prevents it |
| What happens on 30-min TTL? | Auto-release: status reverts to `submitted`, lock columns nulled |
| Can admin take over? | **YES** — after 10 min, other admins see "Take over" button. Same atomic CAS. |

---

## 3. Cross-Entity Link: Where the Two Machines Connect

```mermaid
flowchart LR
    subgraph hire_request["hire_request.status"]
        A[approved / approved_modified]
    end

    subgraph position["position.status"]
        B[jd_in_progress]
        C[pending_jd_approval]
        D[open]
    end

    A -->|"HR picks up\n(atomic CAS)"| B
    B -->|"HR submits\n(+ reviewer resolved)"| C
    C -->|"Reviewer approves\n(txn: position→open,\nhire_request→fulfilled)"| D

    style A fill:#6366f1,stroke:#818cf8,color:#fff
    style B fill:#16a34a,stroke:#22c55e,color:#fff
    style C fill:#d97706,stroke:#f59e0b,color:#fff
    style D fill:#dc2626,stroke:#ef4444,color:#fff
```

---

## 4. Column Dependencies Per Transition

Each transition requires specific DB columns. This maps to the [migration checklist](schema_gap_analysis.md):

| Transition | Columns needed (⚠ = missing) |
|------------|------------------------------|
| HR pickup CAS | ⚠ `positions.picked_up_by`, ⚠ `positions.picked_up_at` |
| HR submits JD | ⚠ `positions.reviewer_id`, ⚠ `positions.submitted_by_role`, ⚠ `positions.submitted_at`, `positions.ats_threshold` ✓ |
| Reviewer rejects | ⚠ `positions.revision_cycle`, `positions.review_notes` ✓ |
| Authority snapshot | ⚠ `positions.submitted_by_role`, ⚠ `positions.reviewer_role_at_submit` |
| Admin review lock | ⚠ `hire_requests.reviewing_locked_by`, ⚠ `hire_requests.reviewing_locked_at` |
| Admin modify-approve | ⚠ `hire_requests.modification_diff` (JSONB) |
| Feedback injection | ⚠ `chat_messages.message_type`, ⚠ `chat_messages.revision_cycle`, ⚠ unique index |
