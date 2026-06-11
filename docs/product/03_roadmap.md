# Roadmap, Positioning & Compliance

> Part of the consolidated docs. Start at [`docs/README.md`](../README.md) for the map.
> Sibling docs: [`01_overview.md`](01_overview.md) · [`02_features.md`](02_features.md)

Status legend: ✅ done · ⚠️ partial · ❌ not started

---

## 1. Product validation

> ⚠️ **Self-assessment, not evidence (flagged 2026-06-11):** the ⭐ ratings below are aspirational and
> some compliance ✅ marks were contradicted by the code (GDPR had a cross-tenant deletion hole; RLS is
> inert). For an independent strategic read — including why the *real* moat is owned/consented candidate
> data rather than "conversational UI" — see [`../PRODUCT_ASSESSMENT.md`](../PRODUCT_ASSESSMENT.md).

Verdict: strong product-market fit with good timing.

| Dimension | Assessment | Score |
|---|---|---|
| Problem clarity | Recruiters spend 60–70% of time on repetitive work | ⭐⭐⭐⭐⭐ |
| Solution approach | Chat-first > form-first is a genuine UX innovation in ATS | ⭐⭐⭐⭐⭐ |
| Market timing | AI-native hiring tools booming 2025–2026 | ⭐⭐⭐⭐ |
| Differentiation | Conversational JD + semantic ATS + magic links | ⭐⭐⭐⭐ |
| Multi-tenant architecture | Proper org + dept isolation from day 1 | ⭐⭐⭐⭐⭐ |
| Candidate experience | Magic link chat > traditional form | ⭐⭐⭐⭐⭐ |
| Technical feasibility | Proven stack, no moonshot tech | ⭐⭐⭐⭐⭐ |

### Risks to monitor

| Risk | Severity | Mitigation |
|---|---|---|
| LLM cost at scale | 🟡 | Embedding-first ATS; LLM only above threshold |
| Candidate data privacy (GDPR/DPDP) | 🔴 | Consent capture, deletion flow, retention implemented |
| Magic link phishing surface | 🟡 | Time-limited + single-use for panel; add rate limiting on link gen |
| India WhatsApp dependency | 🟡 | Deferred to Phase 2; email-first MVP valid for enterprise |

---

## 2. Competitive landscape

| Feature | AI Talent Lab | Lever | Greenhouse | HireVue | Ashby |
|---|---|---|---|---|---|
| Conversational JD creation | ✅ Chat-first | ❌ | ❌ | ❌ | ❌ |
| AI candidate scoring | ✅ Semantic | ❌ | ⚠️ Keyword | ✅ AI video | ⚠️ Basic |
| Magic link applications | ✅ No account | ❌ | ❌ | ❌ | ❌ |
| Panel magic link feedback | ✅ No login | ❌ | ⚠️ Login | ❌ | ❌ |
| Multi-tenant isolation | ✅ Day 1 | ✅ | ✅ | ✅ | ✅ |
| Career page auto-publish | ✅ | ✅ | ✅ | ❌ | ✅ |
| AI interview kit generation | ✅ | ❌ | ❌ | ❌ | ❌ |
| Candidate chat application | ✅ | ❌ | ❌ | ⚠️ Video | ❌ |
| Bias checker | ✅ Built-in | ❌ | ⚠️ Plugin | ❌ | ❌ |

The combination of conversational UI + semantic AI + zero-friction access is the moat.

---

## 3. Role-based UX recommendations

Backlog ideas per persona (not yet built unless noted).

### org_head — visibility, control, confidence
- Org health score (composite), hiring velocity sparkline, cost-per-hire card
- Prominent department switcher (chips) — admins switch constantly
- Audit log viewer in Settings → Security
- AI usage dashboard — LLM calls, credits, per-department

### hr (recruiter) — speed, flow state, minimal clicks
- Chat sidebar: pinned sessions, tags (draft/active/complete), search within sessions
- Pipeline keyboard shortcuts: `E` email, `I` interview, `R` reject
- Smart select: "all above 80%", "all sourced in last 7 days"
- Grouped notifications: "5 candidates applied today"

### team_lead (hiring manager) — read-mostly, decision support
- Dedicated team_lead dashboard: assigned positions + week's interviews
- Side-by-side candidate comparison (2–3 in columns)
- One-click interview prep packet (JD + resume + questions PDF)
- Decision card after interviews: all panel scores + AI recommendation

### Candidate — trust, simplicity, mobile-first
- Apply chat progress bar ("Step 3 of 8")
- Career page: team testimonials, day-in-the-life
- "Share via WhatsApp" on career job cards (India)

### Panel member — zero friction, guided, fast
- Interview context card first (name, role, round, date) before attendance check
- Scorecard comparison guidance ("avg for this dimension: 3.8")
- Estimated next steps on completion

---

## 4. Phase 2 roadmap (next sprint)

| # | Feature | Status | Notes |
|---|---|---|---|
| 1 | Google Calendar OAuth (real) | ⚠️ Mock | Mock adapter done; needs OAuth client + `GoogleCalendarAdapter`. Schema columns exist. [Guide](../integrations/calendar.md) |
| 2 | Career page custom branding | ❌ | Primary color, hero banner, tagline per org; store `career_primary_color`, `career_banner_url`, `career_tagline` |
| 3 | Video intro frontend | ⚠️ | Backend + DB done; need apply-chat step + player in candidate detail |
| 4 | WhatsApp integration | ❌ | Business API for outreach — critical for India |
| 5 | Self-scheduling links | ❌ | Candidates pick slots — needs calendar integration first |
| 6 | GDPR data export (Article 20) | ❌ | Backend `GET /gdpr/export/{candidate_id}` exists, no frontend |
| 7 | Audit log UI | ❌ | Settings → Security: filterable table of org actions |
| 8 | team_lead dashboard | ❌ | Role-focused: assigned positions + weekly schedule |
| 9 | Hire request — multi-approver relay | ⚠️ | dept_admin tier shipped; finance/CEO tiers + `approval_chain JSONB` + magic-link approval emails remain |
| 10 | Hire request — wizard polish | ❌ | 2-col layout, routing toggles, AI-context card, similar-requests, market-alignment, auto-save, comment thread |
| 11 | JD chat — real LLM token streaming | ❌ | Replace typewriter-illusion `jd_token` with real streaming through adapter |
| 12 | JD chat — interactive refinement | ✅ | Bias-fix Apply, per-variant Edit + Regenerate, rail-driven refinement, click-to-scroll stepper, retry card all shipped (commits `099cdd0`–`62fe99e`) |

Per-page Phase 2 detail lives in the relevant
[`design/pages/`](../design/pages/) spec.

---

## 5. Phase 3 roadmap

| Feature | Notes |
|---|---|
| LinkedIn / Naukri real API | ToS complexity; needs partner access |
| HRIS sync (BambooHR, Zoho People) | Post-launch on customer request |
| Slack / Teams notifications | Route hire events to channels |
| Offer management module | Generate/send/track/sign — legally sensitive |
| Referral program | Needs employee portal / employee user type |
| Multi-language JD generation | LLM contextual translation |
| Custom domain for career pages | `careers.techcorp.com` |
| Chrome extension for LinkedIn sourcing | Direct sourcing from profiles |
| API & webhooks | Let enterprise build on top |

---

## 6. Compliance — current state

| Requirement | Status |
|---|---|
| GDPR Article 17 (right to deletion) | ✅ `DELETE /api/v1/gdpr/delete-my-data` |
| DPDP Act 2023 consent capture | ✅ consent prompt before first apply question |
| Data retention policy | ✅ `data_retention_months` + Celery cleanup |
| AI disclosure in emails/chat | ✅ |
| CTC data encryption (AES-256) | ✅ documented — needs `ENCRYPTION_KEY` in prod |
| GDPR Article 20 (data export) | ❌ backend only |
| Audit log viewer in UI | ❌ |

---

## 7. Monetization (post-launch)

| Tier | Name | Price | Key features |
|---|---|---|---|
| Free | Starter | ₹0 | 1 user, 2 active positions, 50 candidates/mo, email simulation |
| Growth | Professional | ₹4,999/mo | 5 users, 10 positions, 500 candidates, real email, talent pool |
| Scale | Business | ₹14,999/mo | 25 users, unlimited positions, API access, custom branding |
| Enterprise | Enterprise | Custom | SSO, custom domain, dedicated support, SLA |

Additional streams: AI credits (per-LLM-call overage), career page SEO boost,
integration marketplace.

---

## 8. Mobile strategy

| Page | Current | Recommendation |
|---|---|---|
| Apply chat | Responsive | PWA support — installable, offline-capable cached session |
| Panel feedback | Responsive | Larger touch targets, haptic feedback on ratings |
| Career page | Mobile-first | "Share via WhatsApp" on every job card (Phase 2) |
| Recruiter dashboard | Desktop-first | React Native companion app (Phase 3) — notifications + quick actions |
