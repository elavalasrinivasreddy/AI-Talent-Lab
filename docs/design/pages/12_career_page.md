> **Build status:** ❌ Not redesigned — old CareerPage live
> Consolidated docs index: [../../README.md](../../README.md) · Status tracker: [../../STATUS.md](../../STATUS.md) · Design system: [../00_design_system.md](../00_design_system.md)
> This page merges the v3 redesign spec with the pre-v3 behavioral spec (appendix below, where one existed).

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


---

## Appendix — pre-v3 behavioral spec & flows

_Retained from the original `docs/pages/` spec for workflow, edge-case, and API detail. The v3 spec above supersedes the **visual** design; the behavior here is still the reference._

# Page Design: Career Page & Job Board
> **Version 2.1 — Updated**
> **Phase 1 Feature.** Public-facing job board per organization. Auto-publishes open positions.
> Candidates find and apply without needing an outreach email.

---

## 1. Overview

| Aspect | Detail |
|---|---|
| Route | `/careers/:orgSlug` · `/careers/:orgSlug/:positionId` |
| Auth | None — fully public |
| Layout | No sidebar — public layout, mobile-first |
| Auto-publish | Positions appear automatically when `status = 'open'` AND `is_on_career_page = true` |
| Phase | Phase 1 (MVP) |

---

## 2. Auto-Publishing Behavior

Organizations do **not** need to manually publish positions. The career page works automatically:

- Position `status` set to `open` + `is_on_career_page = true` → **immediately appears** on career page
- Position `status` changed to anything other than `open` → **immediately disappears**
- `is_on_career_page` can be toggled per position in Position Detail → Settings Tab
- All new positions default to `is_on_career_page = true`

**Career page URL format:**
```
https://aitalentlab.com/careers/techcorp
https://aitalentlab.com/careers/techcorp-ai     (org with spaces in name)
```
Org slug is auto-generated at registration and is immutable.

---

## 3. Career Page Layout (`/careers/:orgSlug`)

```
┌────────────────────────────────────────────────────────────────┐
│  ┌── Org Header ─────────────────────────────────────────────┐ │
│  │  [Logo]  TechCorp                                         │ │
│  │  "Building the future of AI in India"  (from about_us)    │ │
│  │  🌐 techcorp.com  │  📍 Bangalore  │  👥 SMB              │ │
│  │  [LinkedIn ↗]  [Glassdoor ↗]                             │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌── About ─────────────────────────────────────────────────┐ │
│  │  About TechCorp                                           │ │
│  │  {org.about_us content}                                   │ │
│  │                                                           │ │
│  │  🎯 Culture: innovation · remote-first · diversity        │ │
│  │  🎁 Benefits: Health insurance · ESOPs · Learning budget  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌── Open Positions (8) ────────────────────────────────────┐ │
│  │  [🔍 Search roles...]                                     │ │
│  │  [All Departments ▼]  [All Locations ▼]  [All Types ▼]   │ │
│  │                                                           │ │
│  │  ── Engineering (3) ──────────────────────────────────   │ │
│  │  ┌──────────────────────────────────────────────────┐   │ │
│  │  │ Senior Python Developer        📍 Bangalore/Hybrid│   │ │
│  │  │ 5–8 years · Full-time                            │   │ │
│  │  │ Python · FastAPI · PostgreSQL · AWS               │   │ │
│  │  │ Posted 3 days ago              [View & Apply →]   │   │ │
│  │  └──────────────────────────────────────────────────┘   │ │
│  │  ┌──────────────────────────────────────────────────┐   │ │
│  │  │ ML Engineer                    📍 Remote          │   │ │
│  │  │ 3–6 years · Full-time                            │   │ │
│  │  │ Python · TensorFlow · MLOps                      │   │ │
│  │  │ Posted 1 week ago              [View & Apply →]   │   │ │
│  │  └──────────────────────────────────────────────────┘   │ │
│  │                                                           │ │
│  │  ── Product (2) ─────────────────────────────────────   │ │
│  │  ┌──────────────────────────────────────────────────┐   │ │
│  │  │ Senior Product Manager         📍 Bangalore       │   │ │
│  │  │ ...                                              │   │ │
│  │  └──────────────────────────────────────────────────┘   │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌── Footer ─────────────────────────────────────────────────┐ │
│  │  Powered by AI Talent Lab  ·  Privacy Policy  ·  Contact │ │
│  └───────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

---

## 4. Position Detail View (`/careers/:orgSlug/:positionId`)

```
┌────────────────────────────────────────────────────────────────┐
│  [← Back to all positions at TechCorp]                        │
│                                                                │
│  ┌── Position Header ─────────────────────────────────────┐   │
│  │  Senior Python Developer                               │   │
│  │  TechCorp · 📍 Bangalore · Hybrid · Full-time          │   │
│  │  5–8 years · Posted 3 days ago                         │   │
│  │                                           [Apply Now ▶]│   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                │
│  ┌── Full Job Description ────────────────────────────────┐   │
│  │  {jd_markdown rendered as HTML}                        │   │
│  │                                                        │   │
│  │  ## About the Role                                     │   │
│  │  ...                                                   │   │
│  │  ## Requirements                                       │   │
│  │  - 5+ years Python experience                         │   │
│  │  ...                                                   │   │
│  │  ## About TechCorp                                     │   │
│  │  {org.about_us}                                        │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                │
│  ┌── Apply Section ────────────────────────────────────────┐  │
│  │  Interested in this role?                               │  │
│  │                                                        │  │
│  │  [Apply for Senior Python Developer →]                 │  │
│  │                                                        │  │
│  │  Clicking will start a short chat to collect           │  │
│  │  your basic details (3–4 minutes).                     │  │
│  └────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

Clicking "Apply for ..." starts the same candidate chat flow as the magic link apply page.
A new `candidate_session` is created with `source = 'career_page'`.

---

## 5. Filters

| Filter | Options |
|---|---|
| Search | Free text across role name |
| Department | All + list from org departments |
| Location | All + unique locations from open positions |
| Work Type | All, Remote, Hybrid, Onsite |

---

## 6. SEO

Each position page has:
- `<title>` — `{role_name} at {org_name} — Apply Now`
- `<meta description>` — First 160 chars of JD content
- Open Graph tags for LinkedIn/WhatsApp sharing
- `schema.org/JobPosting` structured data for Google Jobs indexing
- Canonical URL: `/careers/{org_slug}/{position_id}`

Career page root has:
- `<title>` — `Careers at {org_name}`
- `sitemap.xml` auto-generated at `/careers/{org_slug}/sitemap.xml`

---

## 7. API Endpoints

| Action | Endpoint | Method |
|---|---|---|
| Load career page | `GET /api/v1/careers/:orgSlug` | GET |
| Load position detail | `GET /api/v1/careers/:orgSlug/positions/:id` | GET |
| Start application | `POST /api/v1/careers/:orgSlug/positions/:id/apply` | POST |

**Career page response structure:**
```json
{
  "org": {
    "name": "TechCorp",
    "logo_url": "...",
    "about_us": "...",
    "culture_keywords": "innovation, remote-first",
    "benefits_text": "...",
    "website": "...",
    "headquarters": "Bangalore, India",
    "size": "smb"
  },
  "positions": [
    {
      "id": 42,
      "role_name": "Senior Python Developer",
      "department": "Engineering",
      "location": "Bangalore",
      "work_type": "hybrid",
      "employment_type": "full_time",
      "experience_min": 5,
      "experience_max": 8,
      "created_at": "2026-04-09T10:00:00Z",
      "key_skills": ["Python", "FastAPI", "PostgreSQL", "AWS"]
    }
  ]
}
```

---

## 8. Design Principles

- **Mobile-first** — candidates browse on phones
- **Fast loading** — no auth overhead, minimal JS
- **Branded** — uses org logo and About Us from settings
- **No AI Talent Lab branding in hero** — the page represents the organization, not the platform
- Small "Powered by AI Talent Lab" footer only
