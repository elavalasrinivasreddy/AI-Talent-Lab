# Job Distribution — Solution Thesis & MVP Implementation Plan

**Project:** AI Talent Lab
**Date:** June 2026
**Status:** Draft for review
**Companion to:** Candidate Sourcing Strategy — Decision Record (the *why*; this is the *how*)

---

## 1. Where we landed

The sourcing decision record established the pivot: we don't source candidates, we **distribute jobs** and capture inbound applications with real resumes. This document covers how we actually post jobs to external boards — the complexity, the options, pricing, and the MVP plan.

---

## 2. The core constraint — a two-gate model

Posting to a job board programmatically requires clearing **two** gates, not one:

- **Gate 1 — Partner approval (per board).** The board must approve *our product* as an integration partner. Indeed's posting API is explicitly "not for direct employers." Naukri posting runs through Zwayam Amplify partner onboarding. LinkedIn's posting-partner program is **closed to new partners**. This gate is one-time per board, gated, and slow.
- **Gate 2 — Customer account connection.** Each customer connects their own paid board account (usually via OAuth, sometimes an API key). We then post under their account, on their quota.

Our earlier mental model assumed only Gate 2. Gate 1 is the real blocker, and it is why aggregators exist.

**Agentic / MCP does not bypass this.** The gate is authentication and contract at the platform level. Unofficial LinkedIn MCPs are browser-scrapers (ToS violation, account-ban and legal risk) and cannot be a production foundation. The only official job MCP (Indeed) is read-only.

---

## 3. Complexity assessment

| Area | Complexity | Notes |
|---|---|---|
| Posting framework (adapter pattern) | Low | Mirrors our existing `CandidateSourceAdapter`. |
| Per-tenant credential storage (encrypted) | Low–Medium | OAuth flows add some work. |
| Apply flow (redirect to our page) | Low | Already mostly built (magic-link/careers). |
| Inbound application ingestion | Low–Medium | Webhook only for native-apply boards. |
| **Board partner approvals** | **High (external, time-bound)** | Not code — business/legal process, weeks to months. |
| Aggregator integration (if chosen) | Medium | One API, but enterprise contract + onboarding. |

The hard part is **not engineering** — it's the partner approvals / aggregator contract. We can build 100% of the software against mocks before any gate clears.

---

## 4. Options on the table

**Option A — Direct per-board integrations (DIY gateways).** We get our own partner approval with each board.
*Pros:* no middleman fee, full control, direct relationship. *Cons:* one slow approval per board; realistically only Naukri + Indeed (+Glassdoor free via Indeed) in the near term; LinkedIn unavailable.

**Option B — One aggregator (VONQ / Broadbean / idibu / Joveo).** We integrate one API; they hold all partnerships.
*Pros:* instant multi-board reach incl. LinkedIn; one integration; strong customer pitch on coverage. *Cons:* enterprise pricing (contact-sales); India board depth must be verified; dependency on a third party.

**Option C — Hybrid (recommended).** Direct **Naukri + Indeed** now, **assisted-manual** posting for LinkedIn and the rest (we generate the JD, deep-link the customer to that board's post form), and add **one aggregator** when a paying customer's reach justifies the contract.

---

## 5. Aggregator landscape

All pricing is **custom / contact-sales** — no public per-post rates. Two cost shapes: **multiposting** (platform fee + customer's own board contracts) or **programmatic** (% of ad spend / managed CPC–CPA). India board coverage must be confirmed per vendor before committing.

| Aggregator | Strongest region | Coverage | Model | India fit |
|---|---|---|---|---|
| **VONQ** | Europe | ~5,000 channels | Multiposting; ATS-native API (HAPI) | Best API fit; **verify India** |
| **Broadbean** | UK / US / APAC | 7,000+ boards | Multiposting | Broad; has APAC ops |
| **idibu** | UK / Europe / ANZ | 1,000+ boards | Multiposting; **white-label** | Weakest India depth |
| **Joveo** | US / **India** | Hundreds + network | Programmatic (ad-spend) | India-rooted; ad-budget model |

---

## 6. Top ~10 India portals (our target coverage)

Naukri, LinkedIn, Indeed, Foundit (Monster), Shine, TimesJobs, Apna (blue-collar), Wellfound (startups/tech), Instahyre, Hirist/CutShort (tech). Glassdoor is no longer separate — it surfaces via Indeed. *Multi-platform reality: Naukri + Indeed/Apna alone covers the bulk of Indian applicant traffic.*

---

## 7. Indicative pricing (what customers / we pay)

- **Naukri:** paid only — Classified (basic) and Hot Vacancy (premium); per-post, INR, varies.
- **Indeed:** organic now near-zero visibility without Indeed Apply (since Mar 31, 2026); sponsored is CPC/CPA. Glassdoor included.
- **LinkedIn:** promoted posts ~$500+ per role; Recruiter seats ~$2,000–$15,000/yr.
- **Aggregators:** custom annual contracts; not SMB-self-serve.
- **Google for Jobs:** free (bonus layer, not the pitch).

---

## 8. MVP plan (recommended — Option C)

1. Build the **`JobBoardAdapter` framework** + **`SimulationBoardAdapter`** (mock mirroring real schemas) — buildable today, no gate needed.
2. Build **per-tenant credential connection** UI + encrypted store.
3. Wire the **apply flow**: each posting's apply URL → our magic-link/careers page → real resume → existing ATS pipeline.
4. Pursue **Naukri (Zwayam)** + **Indeed (Job Sync)** partner approvals in parallel (the long-lead items — start now).
5. Ship **assisted-manual** posting for LinkedIn + others (generate JD, deep-link).
6. Layer **Google for Jobs + Indeed organic** for free bonus reach.
7. Defer the **aggregator** until a customer's reach needs justify it; slot it behind the same adapter interface.

---

## 9. What we need to obtain

Naukri / Zwayam partner access (applyintegration@naukri.com); Indeed partner approval + OAuth app; per-tenant OAuth / API-key flows; (later) one aggregator contract after India-coverage validation.

---

## 10. Risks & mitigations

- **Partner approvals are slow** → start now; ship mock + assisted-manual meanwhile.
- **Aggregator India depth uncertain** → verify in writing before signing.
- **Indeed Apply now required for visibility** → support native apply for Indeed early.
- **Inbound is pull, weak for rare roles** → sponsored posts + talent-pool re-engagement.

---

## Appendix — References

- Indeed Job Sync API (partner-only) — https://docs.indeed.com/job-sync-api/
- Glassdoor folded into Indeed; Indeed Apply visibility policy (Pin) — https://www.pin.com/blog/best-job-posting-sites/
- Unofficial LinkedIn MCP scraper (GitHub) — https://github.com/stickerdaniel/linkedin-mcp-server
- VONQ job board types (HAPI) — https://hapisupport.vonq.com/hc/en-us/articles/6042045359003-What-different-types-of-job-boards-are-available
- Broadbean (7,000+ boards) — https://www.broadbean.com/
- idibu network (1,000+ boards) — https://www.idibu.com/network/p/
- 6 programmatic job ad platforms compared (2026) — https://jobcopilot.com/programmatic-job-ad-platforms-compared/
- Ashby — Naukri / Zwayam integration — https://docs.ashbyhq.com/naukri
