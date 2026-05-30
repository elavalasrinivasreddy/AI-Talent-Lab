# Active Work Plan — read this FIRST in any new session

> Purpose: the cheap resume anchor. A new Claude Code session should read **only**
> this file + [`STATUS.md`](STATUS.md) to know where we are — not re-explore the repo.
> Keep it short. Update the "Log" and checkboxes as work lands. Commit it with the code.

**Last updated:** 2026-05-30 · **Branch:** `task/jd_chat_redesign`

---

## How to resume (do this, in order, then stop reading)

1. Read this file + `docs/STATUS.md` (small, cheap).
2. For any code question, run `graphify query "<question>"` — do NOT grep/read files broadly.
3. For "did we already do X?", run the `mem-search` skill (claude-mem) — don't re-derive.
4. Pick the next unchecked task below. Do ONE task. Commit. Update this file. Stop or continue.
5. Read whole large files only when editing them; otherwise use `graphify query` or `Read` with offset/limit.

---

## Current status

**Branch is ready for PR.** 47 commits ahead of main. 15/19 surfaces redesigned to v3.
All critical/high/medium bugs from Opus 4.8 code review resolved.

## Queue (ordered)

- [x] **Security: HTML escape in emails** — `email_service.py`, all 16 templates (commit `9c45684`)
- [x] **Security: dept_admin hire-request scoping** — `hire_request_service.py` (commit `9c45684`)
- [x] **Phase B shared atoms** — `Icon.jsx`, `Chip.jsx`, `Stat.jsx`, `RoleGate.jsx` (commit `c243cb1`)
- [x] **Dashboard redesign (01)** — NOW/NEXT/PULSE lanes, DeptChipBar filter wired end-to-end (commits `f4f019b`, `20fddba`, `50e339e`)
- [x] **Positions List (02)** — Pipeline Garden cards, sparkline, stage strip (commit `f312933`)
- [x] **Position Detail (03)** — PositionHero, StageStatStrip, StageHealthHeader, PipelineStackView, CandidateRankedRow (commit `462cb2d`)
- [x] **Candidate Detail (04)** — CandidateHero, CompareToIdealGrid, ScoreBreakdownBand, TagsRow (commit `71cd476`)
- [x] **Analytics (06)** — Funnel, source breakdown, velocity, time-to-hire. Backend keys aligned (commits `d21ac1e`, `0f7b384`)
- [x] **Settings (07)** — AI Behavior Console, 4-group rail, SettingsLivePreview, adminOnly gates (commit `7b4b0c8`)
- [x] **Talent Pool (08)** — Score matrix, bulk actions, contact status toggle (commit `d9db9e4`)
- [x] **Hire Request (09)** — Full CRUD, dept_admin approval, relay viz, 4 email touchpoints (commit `44aff50`)
- [x] **Apply Chat (10)** — CSS updated; existing flow preserved (commit `52879f0`)
- [x] **Panel Feedback (11)** — Anchored ratings, single-use enforcement, thank-you state (commit `279014b`)
- [x] **Career Page (12)** — CSS updated, department grouping (commit `52879f0`)
- [x] **Status Portal (13)** — CSS + JSX, timeline with stage icons (commit `52879f0`)
- [x] **Interviews (15)** — Day strip, time-grouped timeline, skeleton, status chips (commit `a19558a`)
- [x] **Notifications (16)** — Bell dropdown, unread count, mark-all-read, 30s polling (commit `58bec64`)
- [x] **Platform Admin (17)** — CSS + stats/orgs/activity endpoints (commit `58bec64`)
- [x] **Dev Console (18)** — v3 CSS, tabbed interface (commit `52879f0`)
- [x] **GDPR / Privacy (19)** — v3 CSS, multi-step deletion, rate-limited, atomic transaction (commits `52879f0`, `16fa5a4`)
- [x] **Code review** — Opus 4.8 multi-angle, all C1–C10 + GA findings fixed (commits `5dddb13`, `bf6f703`, `16fa5a4`)
- [ ] **PR → merge `task/jd_chat_redesign` into `main`** ← START HERE

## Deferred (not blocking PR)

| Item | Priority | Tracking |
|------|----------|---------|
| Apply Chat conversational stepper UX | MED | `STATUS.md` |
| Career page story + fit-filter | LOW | `STATUS.md` |
| Status portal transparency URL redesign | LOW | `STATUS.md` |
| Platform Admin control-tower UI | LOW | `STATUS.md` |
| StatusBadge palette reconciliation | LOW | `STATUS.md` |
| Notification drawer (right-slide) | LOW | `STATUS.md` |
| C-MIG-04: AI behavior settings DB storage | LOW | `TECH_DEBT.md` |
| C-APPLY-01: session persistence warning | LOW | `STATUS.md` |

---

## Log (newest first)

- 2026-05-30 — Analytics field names aligned, DeptChipBar wired e2e + IDOR guard, GDPR/DevConsole marked ✅, docs synced. 15/19 surfaces done.
- 2026-05-30 — Code review fixes committed: C7 (notification helpers), C-GDPR-01 (rate limit), C-GDPR-03 (transaction). STATUS.md updated. Commit `16fa5a4`.
- 2026-05-30 — All 19 GA feature commits landed. Build clean (344 modules). Code review: C4–C10, C-HR-02, C-GDPR-02 fixed. Commits `5dddb13`, `bf6f703`.
- 2026-05-29 — Positions List (02) redesigned to v3 (Pipeline Garden). Cards, sparkline, stage strip, toolbar.
- 2026-05-29 — Dashboard (01) redesigned to v3 (NOW/NEXT/PULSE). Built by Sonnet subagent, reviewed on Opus.
- 2026-05-29 — Phase B atoms built (Icon/Chip/Stat/RoleGate). Commit `c243cb1`.
- 2026-05-29 — Consolidated docs (40→31 files), commit `483dba6`. Security: email escape + dept scoping, commit `9c45684`.
