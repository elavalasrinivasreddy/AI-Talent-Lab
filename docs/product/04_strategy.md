# Product Strategy — Vision, Design, Gaps, Alternatives

> Strategic companion to [`../STATUS.md`](../STATUS.md) (live status) and the forward
> [`03_roadmap.md`](03_roadmap.md). Written 2026-06-11, builder-to-builder, grounded in the full code
> audit. Opinionated on purpose — disagree where your context beats mine.
>
> *Note (2026-06-12): the audit this references is now mostly executed — P0/P1s closed, RLS built,
> Sentry added, core-loop test landed. The strategic argument (the data moat, narrow-the-surface, the
> definition of done) still stands; check [`../STATUS.md`](../STATUS.md) for current state.*

---

## 1. Vision — what's true, what's overstated

**The pitch ("AI hiring copilot, chat is the work layer, humans decide") is a good wedge, not the moat.**

- **Chat-as-work-layer is real for exactly two moments:** JD generation and candidate apply. There it's
  genuinely differentiated. Everywhere else — pipeline, analytics, settings — the product is (correctly)
  tables and forms. The roadmap claim *"conversational UI + semantic AI + zero-friction access is the moat"*
  overstates it: **conversation is a feature a funded competitor copies in a quarter.** Don't anchor the
  story there.

- **The real moat is the one your own implementation plan already named:** an **owned, consented candidate
  database built from qualifying real applicants** (where you receive the actual CV), org-level now, product-level
  later. That is defensible and compounding. Sourcing (Tavily web-search) is commodity, metadata-only, and
  legally fraught — it's a feeder, not the asset. **Recommendation: re-center the vision on qualification +
  owned data, demote sourcing to "one of several feeders."**

- **"Company-first, no global candidate identity"** — correct call for trust/compliance and a clean
  differentiator vs the LinkedIn/Naukri model. It caps network-effect upside, but that's the right trade now.

- **Tension to resolve:** the philosophy says *"magic links over logins — candidates have no accounts,"* but you
  shipped a **password-based candidate portal** (multi-app + pre-eval host). That directly contradicts the stated
  principle. It's defensible (multi-application candidates need durable access), but decide explicitly: is the
  portal worth breaking zero-friction? If yes, update the philosophy doc; if no, the portal is scope creep.

---

## 2. The core strategic risk (read this one twice)

**You are one developer maintaining a broad horizontal product — 24 core + 11 extended + 12 Phase-2 + 9 Phase-3
features — across 162 backend and 143 frontend files, with near-zero tests on the critical paths.**

The audit proved the consequence directly: **features look done but silently break** (dead collusion, no-op
interview emails, 404 status portal, fake AI-match) precisely because no one can hold that surface in their head
and there's no test net to catch regressions. The "production-from-day-1, polish-everything" instinct **worked
against you** — effort spread across 19 beautiful surfaces instead of one bulletproof flow. **Polish outran
plumbing.**

The single highest-leverage move is not a feature. It is **narrowing the surface:**

> Pick the ONE flow that is the product's reason to exist, make it work flawlessly end-to-end with an automated
> test that walks it, and **hide or flag everything else as "beta" until it's equally real.**

My nominee for that flow: **inbound apply** — career page → candidate apply chat → ATS qualification → recruiter
review → interview → decision. That's where the real CV + consent enter (the moat). Outbound sourcing, pre-eval,
and talent-pool AI-match are secondary and currently the most broken — defer them.

---

## 3. Design — the strongest part of the product

The v3 design system is genuinely good and is your clearest competitive edge after the data moat:
- **Backend-first, not a recolor** ([design/00_design_system.md](design/00_design_system.md)) — patterns derived
  from what the product does (LangGraph state machine as first-class blocks, ATS reasoning as the value, AI-vs-human
  source distinction). The explicit "rejected patterns" table is exactly right discipline.
- **Teal `#0D9488` + Plus Jakarta Sans + no AI-slop** reads as serious infrastructure, not another indigo
  "Ask AI ✨" toy. Keep this. It's a real asset.

**Design debt to close (low-grade but real):**
1. **Token drift** — the design doc defines short v3 names (`--p`, `--bg-2`) but `globals.css` ships v2.2
   (`--color-primary`); `constants.js` pipeline palette differs from the doc. Pick ONE source of truth and reconcile.
2. **Interaction-integrity holes the visuals hide** — bulk reject uses a browser `window.prompt()`; bias-fix
   buttons are wired via `window.acceptBiasFix` globals. These break the design system's own quality bar and are
   fragile. (Both in [`../STATUS.md`](../STATUS.md).)
3. **Missing states** in several flows (status portal renders an always-empty timeline; pre-eval CTA points at a
   non-existent page). Visually "done," functionally dead.

Verdict: design is ~9/10 as a system, dragged down by wiring, not aesthetics.

---

## 4. Better-than-existing alternatives (architecture/product choices)

| Current choice | Issue | Better option |
|---|---|---|
| **RLS policies present but inert** (P0-2) | Worst possible state: the *appearance* of DB isolation with none of the protection. False security. | **Commit fully** (wire `set_config('app.current_org_id')` per connection — defense in depth) **or delete the policies** and rely on a *tested* repository layer that always scopes by org. Don't ship the illusion. |
| **Sourcing = Tavily web-search** | Commodity, metadata-only (`email=None`), ToS-fraught. | **Lead with inbound** (career page + apply chat quality) as primary acquisition — that's where the real CV + consent arrive. Keep enrichment as opt-in; treat outbound as a minor feeder. (You already started this pivot.) |
| **Pre-evaluation: LLM-graded test + pairwise collusion** | Most complex, least-validated subsystem; currently broken; few early customers will use it. | **Defer the whole subsystem** until the core loop is solid. If kept, simplify: async take-home + manual review beats nightly batch grading + collusion math for an MVP. |
| **JD chat = 8-stage LangGraph + SSE + window globals** | Highest code-complexity subsystem; fragile streaming/state wiring. | Keep it (it's a real differentiator) but **add a fallback path** and tests. Know the maintenance cost: a guided multi-step form with per-step AI assist would be ~80% of the value at ~20% of the fragility if reliability ever forces the choice. |
| **Self-assessed roadmap ("all 5 stars, functional end-to-end")** | Contradicted by code; your own green checkmarks aren't evidence. | Treat **PRODUCT_STATUS.md as the only status source.** A feature is "done" when a test walks it, not when the UI renders. |

---

## 5. Gaps that aren't in the code audit (product-level)

- **No automated test net on critical paths** — this is the gap that produces all the other gaps. One Playwright
  test over the core loop is worth more than any single feature right now.
- **No "definition of done"** — the org has design done, redesign done, "production-ready" claimed, yet the core
  loop doesn't run clean. Adopt: *done = E2E test passes + no P0/P1 on that flow in PRODUCT_STATUS.md.*
- **Compliance claims outrun reality** — roadmap marks GDPR/DPDP ✅, but deletion had a cross-tenant hole (now
  fixed P0-3) and RLS is inert (P0-2). CTC AES-256 is "documented, needs `ENCRYPTION_KEY`" = not actually on.
  For a hiring product holding CTC + resumes, treat security as a feature, not a checkbox.
- **Solo-founder operational gap** — no error monitoring/alerting surfaced in the audit. When a Celery task
  silently dies (rejection_task NotRegistered, outreach TypeError), you find out from a user, not a dashboard.

---

## 6. What I'd actually do next (opinionated, for a solo founder)

1. **Finish Gate 0** (the P0s): RLS decision (P0-2) is the only one left. — *½ day*
2. **Make the inbound core loop bulletproof + tested:** career → apply (incl. the skipped profiling steps) →
   ATS → recruiter review → interview (with real invite emails + set-result UI) → decision. One Playwright test
   walks it. — *3-4 days*
3. **Hide/flag everything not in that loop** as beta: outbound sourcing, pre-eval, talent-pool AI-match,
   calendar-real, copilot. Reduce the surface you're on the hook for.
4. **Add error monitoring** (Sentry or equivalent) before any real users. — *1 hour*
5. **Then** refresh the product docs to match reality and resume feature work — on a narrower base.

Don't add a new feature until step 2's test is green. The product doesn't need more surface; it needs the surface
it has to actually run.

---

*This is a strategic read, not gospel. You have market/customer/timing context I don't. Where your judgment
disagrees, yours wins — just write down why.*
