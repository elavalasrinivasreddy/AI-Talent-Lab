# Active Work Plan — read this FIRST in any new session

> Purpose: the cheap resume anchor. A new Claude Code session should read **only**
> this file + [`STATUS.md`](STATUS.md) to know where we are — not re-explore the repo.
> Keep it short. Update the "Log" and checkboxes as work lands. Commit it with the code.

**Last updated:** 2026-05-29 · **Branch:** `task/jd_chat_redesign`

---

## How to resume (do this, in order, then stop reading)

1. Read this file + `docs/STATUS.md` (small, cheap).
2. For any code question, run `graphify query "<question>"` — do NOT grep/read files broadly.
3. For "did we already do X?", run the `mem-search` skill (claude-mem) — don't re-derive.
4. Pick the next unchecked task below. Do ONE task. Commit. Update this file. Stop or continue.
5. Read whole large files only when editing them; otherwise use `graphify query` or `Read` with offset/limit.

---

## Queue (ordered)

- [x] **Security: HTML escape in emails** — `email_service.py`, all 16 templates (commit `9c45684`)
- [x] **Security: dept_admin hire-request scoping** — `hire_request_service.py` (commit `9c45684`)
- [x] **Phase B shared atoms** — `Icon.jsx`, `Chip.jsx`, `Stat.jsx`, `RoleGate.jsx` in `components/common/` (2026-05-29). Reference `--color-*` tokens w/ hex fallbacks.
- [x] **Dashboard redesign** — NOW/NEXT/PULSE lanes (2026-05-29). Lanes derived client-side from copilot+activity+stats; no backend change. Legacy behind `?legacy_dashboard=1`. Follow-up: DeptChipBar needs a backend `department_id` param to actually filter.
- [ ] **Positions List (02)** then **Position Detail (03)** — daily work surfaces. START HERE next session.
- [ ] **Candidate Detail (04)** — compare-to-ideal grid (ATS reasoning)
- [ ] **Settings (07), Analytics (06), Talent Pool (08)**
- [ ] **Public: Apply (10), Panel (11), Career (12), Status (13)**
- [ ] **Interview Scheduling (15)** — also re-enable `/interviews` route
- [ ] **Notifications drawer (16), Platform (17), Dev (18), GDPR (19)**
- [ ] **Hire Request wizard polish (09)** — 2-col layout + routing toggles (closes the 🟡)

Production hardening (interleave, see `TECH_DEBT.md`): rate-limit hire-requests,
cursor pagination, frontend code-split, `.gitignore` chroma.

## Rule for each redesign task
Per the design system: redesign from backend reality, not by recoloring. Each page already
has a v3 spec in `docs/design/pages/NN_*.md` with a build-status banner. Build to the spec,
use the Phase B atoms + design tokens, then flip its banner to ✅ and update `STATUS.md`.

---

## Log (newest first, one line each)

- 2026-05-29 — Dashboard (01) redesigned to v3 (NOW/NEXT/PULSE). Built by Sonnet subagent, reviewed on Opus. Next: Positions List (02).
- 2026-05-29 — Phase B atoms built (Icon/Chip/Stat/RoleGate). Next: Dashboard redesign (01).
- 2026-05-29 — Consolidated docs (40→31 files), commit `483dba6`. Security: email escape + dept scoping, commit `9c45684`.
