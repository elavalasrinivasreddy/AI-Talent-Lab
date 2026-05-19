# Page 12 — Career Page (Public)

**Pattern:** *Story + interactive fit filter* (variant A)
**Replaces:** Generic public job board (list of postings)
**Why:** Generic ATS career pages get ~4% apply rates. The story-led page reframes from transactional ("here are jobs") to relational ("here's who we are and where you'd fit"). The interactive fit filter qualifies candidates *before* they apply, raising both apply rate AND applicant quality.

Preview reference: `/tmp/atl-design-preview-v3.html` → tab "Career Page".
Existing doc this supersedes: `docs/pages/09_career_page.md`.

---

## 1. Route & layout

| Aspect | Value |
|---|---|
| Route | `/careers/:orgSlug` (org index) · `/careers/:orgSlug/:positionId` (specific role) |
| Auth | **Public** (no JWT) |
| Layout | Full-page brand surface · NO sidebar · hero + sections |
| SEO | Server-rendered metadata (title, OG image, description) per position |

---

## 2. Backend tie-in

| Endpoint | Used for |
|---|---|
| `GET /api/v1/careers/{orgSlug}` | Org branding + open positions list + testimonials + stats |
| `GET /api/v1/careers/{orgSlug}/positions/{id}` | Position detail page |
| `POST /api/v1/careers/{orgSlug}/positions/{id}/apply` | Initiate apply flow → returns magic-link token → redirect to `/apply/:token` |
| `GET /api/v1/careers/{orgSlug}/fit?function=&exp=&values=` | **New** — return ranked positions matching the fit-filter selection |

Branding fields read from `organizations`:
- `career_primary_color` (Phase 2 — defaults to `--p`)
- `career_banner_url` (Phase 2)
- `career_tagline` (Phase 2)
- `career_about_us`
- `career_testimonials` (JSONB array of `{quote, author, role, joined_year, avatar_color}`)

---

## 3. Layout

```
[ HERO — full-bleed brand gradient or banner image ]
  TechCorp · careers
  "Hire is a verb. So is build."                  ← brand tagline (h1, 48px, 800 weight)
  "We're a 47-person AI-native team..."           ← brand about (paragraph)
  [See open roles ↓ (white pill)] [About us (ghost)]

[ STATS STRIP (4-cell) ]
  47 Team size  ·  8 Open roles  ·  21d Avg time to hire  ·  100% Remote-friendly

[ FIT FINDER SECTION ]
  "Find your fit in 10 seconds"
  "Tell us about yourself · we'll surface roles where you'd thrive · no email required."
  
  Q: What do you do?        [Eng · picked] [Design] [Product] [Sales] [CS] [Ops]
  Q: How much experience?   [0-3 yrs] [3-7 yrs] [7+ yrs · picked]
  Q: What matters most?     [Ownership · picked] [Stability] [Build · picked] [Mentor] [Tech depth]
  
  Result: "3 roles match · sorted below by fit"

[ JOB CARDS (ranked by fit) ]
  ┌─ Senior ML Engineer ─────────────────────────────────────────[92% fit]┐
  │ Engineering · Bangalore · Hybrid · ₹40–60 LPA · [Urgent chip]         │
  │ "Own LLM fine-tuning and production inference for a system serving..."│
  │ Why this team: "We've shipped two new agents this quarter. We argue..." — Ravi, Tech Lead │
  │                                              12 days open  [Apply via chat →] │
  └──────────────────────────────────────────────────────────────────────┘
  ... 2-3 more cards ...
  [See all 8 open roles →]

[ TESTIMONIAL SECTION ]
  "What it's actually like"
  "Not a careers brochure. Words from people on the team."
  
  ┌──────────────────────────────────────┐  ┌──────────────────────────────────────┐
  │ [avatar] "The PR that taught me..."  │  │ [avatar] "I've shipped to prod..."   │
  │          — Dev S. · ML Eng · 2024    │  │          — Pooja N. · Designer · 2024│
  └──────────────────────────────────────┘  └──────────────────────────────────────┘
```

---

## 4. Hero

Full-bleed gradient using org's primary color (defaults to teal). Background includes 2 decorative blurred circles (10% / 5% opacity).

| Element | Source |
|---|---|
| Org mark | `org.career_logo_url` + `org.name` |
| H1 tagline | `org.career_tagline` (e.g. "Hire is a verb. So is build.") |
| Paragraph | `org.career_about_us` (or first 280 chars) |
| Primary CTA | "See open roles ↓" — scrolls to job cards section |
| Ghost CTA | "About us" — opens an inline expanded org-about section (no separate page) |

---

## 5. Fit finder

Three chip questions, all multi-select chips. As user picks, the result count updates live below.

| Question | Source |
|---|---|
| What do you do? | Static function list: Eng / Design / Product / Sales / CS / Ops |
| Experience? | Static: 0-3 / 3-7 / 7+ |
| What matters most? | Static values: Ownership / Stability / Build from scratch / Mentor others / Deep tech |

Backend `/careers/:orgSlug/fit` endpoint takes selections, returns positions ranked by:
- Function match (must match — filters)
- Experience match (must match — filters)
- Values match (soft — ranks)

Result line: "3 roles match · sorted below by fit." If 0 results: "No exact matches. [See all roles]"

This filter is the **conversion engine** — candidates who self-select into a fit have higher apply rates and stronger fit-to-role alignment.

---

## 6. Job card

```
┌─ Title ──────────────────────────────────────[fit %]┐
│ Meta line (dept · location · comp · urgency chip)    │
│ "Pitch" (1-2 lines from position pitch field)        │
│ Why this team: "..." — Teammate, role                │
│                                                      │
│ days open                              [Apply via chat →] │
└──────────────────────────────────────────────────────┘
```

| Field | Source |
|---|---|
| Title | `positions.role_name` |
| Dept · Location · Comp | `positions` joined fields |
| Urgency chip | `positions.priority` |
| Pitch | `positions.jd_pitch` (Phase 2 — extracted from JD generation) or first 160 chars of JD |
| Why this team | `positions.team_pitch` (custom per-position field, edited in position settings) + author |
| Fit % | only shown if fit finder was used |
| Apply CTA | links to `/careers/:orgSlug/:positionId` apply form, which generates magic link |

Card click → position detail page (a longer JD view, also public).

---

## 7. Testimonial section

Two columns on desktop, single column on mobile.

Each testimonial:
- Large avatar (gradient based on testimonial color)
- Quote in italic, large font
- Attribution: name · role · "joined YEAR"

Sourced from `org.career_testimonials` JSONB array. Org admin curates these in Settings → Career page brand (`07_settings.md`).

---

## 8. Components to build / refactor

| Component | Path | Notes |
|---|---|---|
| `<CareerPage>` | `frontend/src/components/Careers/CareerPage.jsx` | Refactor |
| `<CareerHero>` | `Careers/CareerHero.jsx` | New — brand gradient + tagline + CTAs |
| `<CareerStats>` | `Careers/CareerStats.jsx` | New |
| `<FitFinder>` | `Careers/FitFinder.jsx` | New — 3-question chip selector with live result count |
| `<JobCard>` | `Careers/JobCard.jsx` | New — branded card with fit % |
| `<TestimonialCard>` | `Careers/TestimonialCard.jsx` | New |
| Reuse `<ChipPicker>` from Apply page | `common/ChipPicker.jsx` | shared |

---

## 9. Branding

Each org's career page should look distinctly *theirs* once Phase 2 ships:

- **Primary color** — `org.career_primary_color` overrides `--p` for the entire page
- **Banner image** — `org.career_banner_url` replaces the gradient hero bg (with semi-opaque overlay)
- **Tagline** — `org.career_tagline` replaces the h1
- **Logo** — `org.career_logo_url` in header
- **Custom font** — Phase 3 (only if requested by enterprise customer)

The settings editor (`07_settings.md` → "How candidates see you → Career page brand") drives all of this.

---

## 10. Position detail (when route includes `:positionId`)

Same hero / brand · then the full JD rendered from `positions.jd_markdown` · then big "Apply via chat" CTA · then "Other open roles" at bottom.

Apply flow: `POST /careers/:orgSlug/positions/:id/apply` returns a magic-link token → frontend redirects to `/apply/:token` (Apply Chat page).

---

## 11. SEO & sharing

| Meta | Source |
|---|---|
| Page title | `"<Role name> · TechCorp careers"` |
| Description | First 160 chars of JD |
| OG image | `org.career_og_image_url` (or generated dynamically per position) |
| OG title | role name + org |
| Schema.org JobPosting | Structured data for Google Jobs indexing |

These are the difference between "we have a career page" and "candidates actually find us".

---

## 12. Empty / loading / error states

| Condition | Display |
|---|---|
| Org has no open positions | Hero remains; section says "We're not actively hiring right now. [Join talent pool ↗]" linking to a stay-in-touch form |
| Org slug invalid | 404 page with link back to apply if user has a magic link |
| Position-detail invalid id | 404 with "[See open roles ↑]" |
| Banner image fails to load | Falls back to gradient hero |

---

## 13. Mobile

This page sees ~60% mobile traffic in production. Specific considerations:

- Hero text scales down (h1 → 32px on mobile)
- Fit finder chips wrap nicely (no horizontal scroll)
- Job cards stack single-column on mobile
- "Apply via chat" is a sticky bottom bar on position-detail mobile
- Phase 2: "Share via WhatsApp" button per job card (Indian market — per PRODUCT_IMPROVEMENTS §3.4)
