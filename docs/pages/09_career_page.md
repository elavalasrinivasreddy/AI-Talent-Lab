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
