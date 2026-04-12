# Page Design: Career Page & Job Board

> Public-facing page showing all open positions for organic candidate acquisition.

---

## 1. Page Purpose

The Career Page is a **public, SEO-optimized** page that displays all of an organization's open positions. Candidates can browse, filter, and apply directly — no outreach email needed. This creates an organic acquisition channel that reduces dependency on paid job portals.

**URL**: `/careers/{org_slug}` (e.g., `/careers/techcorp`)

---

## 2. Page Layout

```
┌────────────────────────────────────────────────────────────────┐
│  ┌─ Org Header ────────────────────────────────────────────┐   │
│  │  [Logo]  TechCorp                                        │   │
│  │  "Building the future of fintech in India"               │   │
│  │  🌐 techcorp.com  │  📍 Bangalore, Mumbai  │  👥 250+    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─ About Section ─────────────────────────────────────────┐   │
│  │  About TechCorp                                          │   │
│  │  {org.about_us content from settings}                    │   │
│  │                                                          │   │
│  │  🎯 Our Culture: Innovation, Remote-first, Diversity     │   │
│  │  🎁 Benefits: Health insurance, ESOPs, Learning budget   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─ Open Positions ({count}) ──────────────────────────────┐   │
│  │  [🔍 Search roles...]                                    │   │
│  │  [All Depts ▼] [All Locations ▼] [All Types ▼]          │   │
│  │                                                          │   │
│  │  ── Engineering (3 positions) ──────────────────────────  │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │ Senior Python Developer           📍 Bangalore     │  │   │
│  │  │ 5-8 years │ Full-time │ Remote                     │  │   │
│  │  │ Python, FastAPI, PostgreSQL, AWS                   │  │   │
│  │  │ Posted 3 days ago                    [View & Apply] │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │ ML Engineer                        📍 Hyderabad    │  │   │
│  │  │ 3-6 years │ Full-time │ Hybrid                     │  │   │
│  │  │ Python, TensorFlow, PyTorch, MLOps                 │  │   │
│  │  │ Posted 1 week ago                    [View & Apply] │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  │                                                          │   │
│  │  ── Product (2 positions) ──────────────────────────────  │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │ Product Manager                    📍 Mumbai       │  │   │
│  │  │ 4-7 years │ Full-time │ Onsite                     │  │   │
│  │  │ Agile, Data Analytics, B2B SaaS                    │  │   │
│  │  │ Posted 2 days ago                    [View & Apply] │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─ Footer ────────────────────────────────────────────────┐   │
│  │  Powered by AI Talent Lab │ Privacy Policy │ Contact    │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

### Position Detail View (`/careers/{org_slug}/{position_id}`)

```
┌────────────────────────────────────────────────────────────────┐
│  [← Back to all positions]                                     │
│                                                                 │
│  ┌─ Position Header ──────────────────────────────────────┐    │
│  │  Senior Python Developer                                │    │
│  │  TechCorp │ 📍 Bangalore │ Remote │ Full-time           │    │
│  │  5-8 years │ ₹25-40 LPA │ Posted 3 days ago            │    │
│  │                                          [Apply Now ▶]  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─ JD Content (Markdown Rendered) ───────────────────────┐    │
│  │  ## About the Role                                      │    │
│  │  {jd_markdown rendered as HTML}                         │    │
│  │                                                         │    │
│  │  ## Requirements                                        │    │
│  │  - 5+ years Python experience...                        │    │
│  │  - FastAPI, Django...                                   │    │
│  │                                                         │    │
│  │  ## About TechCorp                                      │    │
│  │  {org.about_us}                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─ Application Form ────────────────────────────────────┐     │
│  │  Apply for Senior Python Developer                     │     │
│  │                                                        │     │
│  │  Name *           [________________]                   │     │
│  │  Email *          [________________]                   │     │
│  │  Phone            [________________]                   │     │
│  │  Resume *         [Upload PDF/DOCX]                    │     │
│  │                                                        │     │
│  │  {Dynamic screening questions from settings}            │     │
│  │  Notice Period *  [Immediate ▼]                        │     │
│  │  Expected Salary  [________________]                   │     │
│  │  ...                                                   │     │
│  │                                                        │     │
│  │                              [Submit Application]      │     │
│  └────────────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────────┘
```

---

## 3. Sections

### 3.1 Org Header
- Organization logo, name, tagline (from `about_us` first line or culture keywords)
- Website link, headquarters, company size
- All data pulled from org settings

### 3.2 About Section
- Full `about_us` content from organization settings
- Culture keywords displayed as tags
- Benefits template displayed

### 3.3 Positions List
- Grouped by department
- Each card: role name, location, experience range, employment type, work type, key skills
- "Posted X ago" timestamp
- Search and filter by department, location, work type
- Only positions with `status = 'open'` are shown

### 3.4 Position Detail View
- Full JD rendered as HTML from markdown
- Organization "About Us" section appended
- **Application form** with:
  - Required: name, email, resume upload
  - Dynamic screening questions (from `screening_questions` table for the position's department)
  - Submit button → creates candidate + application records

### 3.5 Footer
- "Powered by AI Talent Lab" branding
- Privacy policy link
- Contact link (org email)

---

## 4. Backend APIs Used

| Action | Endpoint | Method |
|--------|----------|--------|
| Load career page | `/api/careers/{org_slug}` | GET |
| Load position detail | `/api/careers/{org_slug}/positions/{id}` | GET |
| Submit application | `/api/careers/{org_slug}/positions/{id}/apply` | POST |

---

## 5. SEO & Sharing

- **Title tag**: `{Role Name} at {Org Name} — AI Talent Lab`
- **Meta description**: First 160 chars of JD content
- **Open Graph tags**: For LinkedIn/WhatsApp sharing with role name, org name, location
- **Canonical URL**: `/careers/{org_slug}/{position_id}`
- **Schema.org**: `JobPosting` structured data for Google Jobs indexing
- **Sitemap**: Auto-generated `/careers/{org_slug}/sitemap.xml`

---

## 6. Embed Widget

Organizations can embed their career page on their own website:

```html
<iframe 
  src="https://aitalentlab.com/careers/techcorp/embed"
  width="100%" 
  height="600"
  frameborder="0"
></iframe>
```

Or a simple widget:
```html
<script src="https://aitalentlab.com/widget.js" data-org="techcorp"></script>
```

---

## 7. Design Principles

- **Mobile-first** — Candidates browse on phones
- **Fast loading** — No auth, no heavy JS framework needed (could be SSR)
- **Branded** — Uses org logo, colors if available
- **Accessible** — WCAG 2.1 AA compliance
- **No AI Talent Lab branding in premium plans** — White-label option
