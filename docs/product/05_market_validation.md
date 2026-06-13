# Market Validation & SaaS Readiness Brief

> Product diagnostic written 2026-06-13 (pre-launch, no users, target market undecided).
> Companion to [`04_strategy.md`](04_strategy.md) (internal strategic read). This doc looks **outward**:
> market reality, survival scope, and what's missing to be a real SaaS business.
> Sibling docs: [`01_overview.md`](01_overview.md) · [`02_features.md`](02_features.md) · [`03_roadmap.md`](03_roadmap.md)

---

## 1. Verdict up front

**Conditional GO.** The product thesis is sound and the build quality is unusually high for a
solo founder. But the business is at risk for the opposite reason most startups fail:
**you have ~3x more product than you have evidence anyone will pay for it.** Zero users, zero
revenue, zero billing code, no landing page — and 56+ built features.

The next 90 days should be **selling, not building.** The only build work that matters is the
short "SaaS launch readiness" list in §6 (now tracked as Phase F in [`../STATUS.md`](../STATUS.md)).

---

## 2. The seven questions (product diagnostic)

| # | Question | Answer | Confidence |
|---|---|---|---|
| 1 | **Who is this for?** | The HR generalist or 1–2 person recruiting team at a 50–500 employee company that hires 5–30 roles/year and has no dedicated TA-ops. Recommended beachhead: **India SMB/startups** (see §4). | Medium — needs customer conversations |
| 2 | **What's the pain?** | Recruiters spend 60–70% of time on repetitive work (JDs, portal search, email). Avg Indian SMB takes ~45 days to fill a position. Pain is real, frequent, and quantified. | High |
| 3 | **Why now?** | 2025–26 is the AI-native window: incumbents (Greenhouse/Lever/Zoho) are retrofitting AI; buyers now treat AI as must-have, not novelty. Window closes as incumbents catch up. | High |
| 4 | **10-star version?** | "I told it I need a backend engineer on Monday; by Friday I had 5 qualified, consented, pre-screened candidates with interviews booked — and I never opened a job portal." | — |
| 5 | **MVP that proves the thesis?** | The **inbound loop**: career page → apply chat → ATS qualification → recruiter review → interview → decision. Already built and E2E-tested. The MVP exists; it's unproven *commercially*, not technically. | High |
| 6 | **Anti-goals** | Offer management, background verification, job-board marketplace, employee referral portal, video interviews-as-assessment (Paradox/HireVue territory). | High |
| 7 | **How do you know it's working?** | **Activation:** org publishes first JD + receives first application ≤ 7 days from signup. **North star:** qualified applications processed per org per week. **Survival:** 3 paying orgs in 90 days. | — |

---

## 3. Market reality (researched 2026-06)

The space is crowded and well-funded. Position accordingly.

| Segment | Players | What it means for us |
|---|---|---|
| Enterprise conversational AI | **Paradox** (Olivia) — conversational screening/scheduling at scale, multilingual, market leader | "Conversational hiring" alone is not a moat — it's already someone's mature product. Avoid enterprise high-volume. |
| AI-native sourcing | **Juicebox** ($36M, Sequoia), Pin (850M profiles), hireEZ, GoPerfect | Outbound sourcing is a losing battlefield for us — they have data scale we never will. Confirms strategy doc: sourcing is a feeder, not the asset. |
| AI-native ATS | **Spott**, Manatal, PeoplePilot ("teams with no recruiting function") | Direct competitors for the same wedge. Differentiation must come from geography + workflow depth + owned data. |
| Incumbent ATS | Greenhouse, Lever, **Ashby** (analytics as differentiator), iCIMS | They win on integrations + trust. Post-go-live integration quality is where ATS products fail — our adapter pattern helps only if real adapters ship. |
| India SMB | **Zoho Recruit** (₹1,250–2,500/user/mo), **Keka** (per-employee, payroll-bundled), Freshteam, HirePro | Price anchors exist; ₹4,999/mo Growth tier is plausible. None are chat-first or candidate-experience-led. Naukri integration is table stakes here. |

**Honest competitive read:** the [`03_roadmap.md`](03_roadmap.md) comparison table only scores
features we have. Add the columns we'd lose: candidate database scale, integration count,
SOC 2/compliance certifications, brand trust, sales team. The defensible combination is
**(a) owned/consented candidate data per org, (b) candidate-experience-first apply flow,
(c) India-specific workflow (WhatsApp, Naukri, INR, DPDP)** — not any single feature.

Sources: [Qureos AI platforms guide](https://www.qureos.com/hiring-guide/best-ai-recruiting-platforms) ·
[Humanly 2026 review](https://www.humanly.io/blog/best-ai-recruiting-software-tools-2026) ·
[Juicebox AI tools guide](https://juicebox.ai/blog/ai-recruiting-tools) ·
[PeoplePilot ATS-for-startups](https://www.peoplepilot.io/blog/best-ats-for-startups-2026) ·
[HR Tech Institute ATS comparison](https://www.hr-tech-institute.com/ats-comparison-2026-the-criteria-that-matter-once-the-demo-is-over) ·
[Woco India ATS guide](https://woco.co.in/blogs/how-to-choose-ats-india-2026/) ·
[Zimyo India recruitment software](https://www.zimyo.com/insights/top-recruitment-software-in-india/) ·
[InCruiter AI-in-recruitment 2026](https://incruiter.com/blog/ai-in-recruitment-2026-trends-stats-what-works/)

---

## 4. Beachhead recommendation: India SMB first

You asked the report to pick. **India SMB/startups (50–500 employees, tech-adjacent hiring).** Why:

1. The product already leans there: INR pricing tiers, WhatsApp on the roadmap, DPDP consent built.
2. US/EU SMB means head-on competition with Sequoia-funded AI-natives; India's chat-first +
   candidate-experience gap is wider and the competitors (Zoho/Keka) are form-first suites.
3. You can do founder-led sales there — pilots come from your own network, in your time zone.
4. Trade-off accepted: lower willingness-to-pay and longer payment friction. Counter it with
   a low-friction founder price (₹2,999–4,999/mo) and annual-prepay discounts.

**Falsifiable test:** 25 discovery calls with India HR leads in 30 days. If <3 agree to a paid
pilot, revisit the segment (mid-market India or global niche, e.g. agencies).

---

## 5. Is the SaaS implemented correctly? (gap audit)

What you'd expect a SaaS to have vs. what exists in the codebase:

| SaaS fundamental | State | Evidence / note |
|---|---|---|
| Multi-tenancy + isolation | ✅ Strong | org_id everywhere, Postgres RLS live, dual connection pools, tested |
| Security baseline | ✅ Ahead of stage | JWT denylist, rate limiting, lockout, audit logs, Sentry, CTC encryption (needs prod key) |
| Test net | ✅ | 106 backend tests + Playwright core-loop E2E |
| Deployment | ⚠️ | Dockerfile + docker-compose exist; no staging env, no backup/DR runbook, no uptime monitoring |
| **Billing & subscriptions** | ❌ **None** | No Razorpay/Stripe code anywhere. Tiers exist only in docs. **You cannot charge money today.** |
| **Plan/quota enforcement** | ❌ None | "2 positions / 50 candidates per month" limits are unenforced. LLM usage is *tracked* but not *capped* — a single org could burn unbounded LLM spend (COGS risk). |
| Self-serve onboarding | ⚠️ | Registration works; no guided first-run (sample data, checklist, "publish your first JD" path) |
| Marketing surface | ❌ | No landing page, pricing page, or waitlist. Product has no front door. |
| Legal/trust pages | ❌ | No ToS / privacy policy pages (GDPR deletion flow exists, the *policy* doesn't) |
| Email deliverability | ⚠️ | Resend/SMTP adapters fine; no SPF/DKIM/domain-warmup runbook — outreach emails will land in spam without it |
| Repo hygiene | ⚠️ | GitHub has 1 stale commit; README still says SQLite while code is Postgres+RLS. Fix before showing anyone the repo. |

**Architecture verdict:** the engineering is *more* correct than typical seed-stage SaaS
(repository pattern, adapters, RLS, tests). Nothing needs re-architecting. What's missing is
the **commercial layer** around the product, not the product.

---

## 6. Enhancement priorities (ICE-ranked)

Impact × Confidence ÷ Effort, 1–5 each. Build top-down; everything below the line waits.

| Rank | Item | I | C | E | Score | Why |
|---|---|---|---|---|---|---|
| 1 | Razorpay billing + plan enforcement + LLM quota caps | 5 | 5 | 3 | 8.3 | Converts product → business; caps COGS risk |
| 2 | Landing page + pricing + waitlist/demo-booking | 5 | 5 | 2 | 12.5 | Cheapest, highest leverage; needed for 25 discovery calls |
| 3 | Self-serve onboarding (seeded demo org, first-run checklist) | 4 | 4 | 2 | 8.0 | Time-to-value ≤ 7 days is the activation metric |
| 4 | Email deliverability runbook (SPF/DKIM, warm-up) + ToS/privacy | 4 | 5 | 1 | 20* | Small effort, gates everything candidate-facing (*do alongside #2) |
| 5 | WhatsApp outreach (Business API) | 4 | 4 | 3 | 5.3 | The India wedge vs Zoho/Keka; candidates respond on WhatsApp, not email |
| 6 | Naukri job posting (post-out, not scraping) | 4 | 3 | 3 | 4.0 | India table stakes; employers expect it |
| 7 | Real Google Calendar OAuth | 3 | 4 | 3 | 4.0 | Already roadmapped; unlocks self-scheduling later |
| — | *Defer:* pre-eval polish, video intro UI, copilot expansion, Chrome extension, HRIS sync, multi-language | | | | | Surface you don't need until customers ask |

---

## 7. Survival scope — the honest risks

1. **Distribution risk (the big one).** Nothing in the repo or docs is about getting customers.
   Competitors have sales teams and $36M warchests. Survival = founder-led sales + a niche they
   won't fight for. The product is ready enough; the company isn't started yet.
2. **Solo-founder surface risk** (from [`04_strategy.md`](04_strategy.md), still true): 19 surfaces,
   160+ backend files, one maintainer. Mitigation shipped (tests, Sentry); don't widen the surface.
3. **COGS risk.** LLM-per-org spend unmetered (§5). One enthusiastic free-tier org = real money.
4. **Incumbent-catch-up risk.** Zoho ships an "AI recruiter" eventually. Your durable assets:
   per-org consented candidate data + talent pool that compounds, and workflow depth they
   won't copy quickly (hire-request approval chains, panel magic links, bias check).
5. **Trust deficit.** Hiring data is sensitive; unknown vendors lose deals on this. Counter early:
   security page listing what's already true (RLS, encryption, audit logs, GDPR/DPDP) — you have
   more substance here than most seed-stage competitors; say so publicly.

---

## 8. The 90-day plan (sell-first)

| Weeks | Goal |
|---|---|
| 1–2 | Items #2 + #4 (landing, pricing, deliverability, ToS). Fix GitHub README. Record a 3-min demo video from [`DEMO_GUIDE.md`](../DEMO_GUIDE.md). |
| 1–4 | 25 discovery calls (your network → HR communities → LinkedIn). Pitch the inbound loop, not 56 features. |
| 3–6 | Item #1 (billing + quotas). Convert 3–5 calls into paid pilots at founder pricing. Onboard them personally — that *is* item #3's research. |
| 7–12 | Ship #3, #5 driven by pilot feedback only. Weekly usage review per pilot org. Kill/keep features by usage, not roadmap. |
| Day 90 | Gate: ≥3 paying orgs and ≥1 hire made through the platform → raise/scale decision. Fewer → revisit segment per §4. |

**Rule for this phase:** no new feature unless a pilot customer is blocked without it.
