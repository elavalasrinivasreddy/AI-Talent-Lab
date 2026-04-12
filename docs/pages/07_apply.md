# Page Design: Public Application Page

> Where candidates land after clicking the magic link — no authentication required.

---

## 1. Overview

| Aspect | Detail |
|--------|--------|
| Route | `/apply/:token` |
| Auth | None (public page, secured by signed JWT token) |
| Entry Point | Candidate clicks link in outreach email |
| Layout | No sidebar — standalone, clean page |

---

## 2. Page Layout

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  ┌─ Header ───────────────────────────────────────────────┐  │
│  │            🏢 {Organization Name}                      │  │
│  │            Powered by AI Talent Lab                    │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Position Info Card ───────────────────────────────────┐  │
│  │                                                        │  │
│  │  💼 Senior Python Developer                           │  │
│  │                                                        │  │
│  │  📍 Bangalore, India  ·  🏠 Hybrid  ·  💼 Full-time  │  │
│  │  📆 Experience: 5-8 years                             │  │
│  │                                                        │  │
│  │  ┌── About {Organization} ──────────────────────────┐ │  │
│  │  │ We are a leading technology company focused on...  │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  │                                                        │  │
│  │  ┌── Role Overview ─────────────────────────────────┐ │  │
│  │  │ We are looking for a Senior Python Developer     │ │  │
│  │  │ to join our Engineering team...                   │ │  │
│  │  │ (truncated JD preview — max 500 chars)           │ │  │
│  │  │ [View Full JD ▼]                                 │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  │                                                        │  │
│  │  Your match score: 92%  ✅ Strong Match               │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Application Form ────────────────────────────────────┐  │
│  │                                                        │  │
│  │  Hi {Candidate Name}! Interested? Tell us more:       │  │
│  │                                                        │  │
│  │  Previous Company *                                    │  │
│  │  ┌────────────────────────────────────────────────┐   │  │
│  │  │                                                │   │  │
│  │  └────────────────────────────────────────────────┘   │  │
│  │                                                        │  │
│  │  Notice Period *                                       │  │
│  │  ┌────────────────────────────────────────────────┐   │  │
│  │  │ [Immediate ▼]                                  │   │  │
│  │  └────────────────────────────────────────────────┘   │  │
│  │  Options: Immediate, 15 days, 30 days, 60 days, 90+  │  │
│  │                                                        │  │
│  │  Total Experience (years) *                            │  │
│  │  ┌──────────────────┐                                 │  │
│  │  │                  │                                 │  │
│  │  └──────────────────┘                                 │  │
│  │                                                        │  │
│  │  Relevant Experience (years)                           │  │
│  │  ┌──────────────────┐                                 │  │
│  │  │                  │                                 │  │
│  │  └──────────────────┘                                 │  │
│  │                                                        │  │
│  │  Current Salary (Annual)                               │  │
│  │  ┌──────────────────┐                                 │  │
│  │  │                  │                                 │  │
│  │  └──────────────────┘                                 │  │
│  │                                                        │  │
│  │  Expected Salary (Annual) *                            │  │
│  │  ┌──────────────────┐                                 │  │
│  │  │                  │                                 │  │
│  │  └──────────────────┘                                 │  │
│  │                                                        │  │
│  │  When can you start? *                                 │  │
│  │  ┌────────────────────────────────────────────────┐   │  │
│  │  │                                                │   │  │
│  │  └────────────────────────────────────────────────┘   │  │
│  │                                                        │  │
│  │  Interview Availability                                │  │
│  │  ┌────────────────────────────────────────────────┐   │  │
│  │  │ e.g., Mon-Fri 10am-6pm IST                    │   │  │
│  │  └────────────────────────────────────────────────┘   │  │
│  │                                                        │  │
│  │  Anything else you'd like us to know?                  │  │
│  │  ┌────────────────────────────────────────────────┐   │  │
│  │  │                                                │   │  │
│  │  │                                                │   │  │
│  │  └────────────────────────────────────────────────┘   │  │
│  │                                                        │  │
│  │  ┌────────────────────────────────────────────────┐   │  │
│  │  │            📝 Submit Application                │   │  │
│  │  └────────────────────────────────────────────────┘   │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Footer ───────────────────────────────────────────────┐  │
│  │  Powered by AI Talent Lab · Privacy Policy · Contact   │  │
│  │  This link expires in 72 hours                         │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Page States

### 3.1 Loading State
```
┌──────────────────────────────────────┐
│           🧪 AI Talent Lab           │
│                                      │
│        Loading application...        │
│        ●●● (animated dots)           │
└──────────────────────────────────────┘
```

### 3.2 Expired Link
```
┌──────────────────────────────────────┐
│           🧪 AI Talent Lab           │
│                                      │
│     ⏰ This link has expired         │
│                                      │
│     This application link is no      │
│     longer valid. Please contact     │
│     the recruiter for a new link.    │
│                                      │
│     Contact: recruiting@company.com  │
└──────────────────────────────────────┘
```

### 3.3 Invalid Link
```
┌──────────────────────────────────────┐
│           🧪 AI Talent Lab           │
│                                      │
│     ❌ Invalid Application Link      │
│                                      │
│     This link is invalid or has      │
│     been tampered with.              │
└──────────────────────────────────────┘
```

### 3.4 Already Applied
```
┌──────────────────────────────────────┐
│           🧪 AI Talent Lab           │
│                                      │
│     ✅ You've Already Applied!       │
│                                      │
│     You submitted your application   │
│     on Apr 10, 2026. Our team will   │
│     review it and get back to you.   │
│                                      │
│     Reference: APP-20260410-001      │
└──────────────────────────────────────┘
```

### 3.5 Submission Success
```
┌──────────────────────────────────────┐
│           🧪 AI Talent Lab           │
│                                      │
│     🎉 Application Submitted!       │
│                                      │
│     Thank you for applying for       │
│     Senior Python Developer          │
│     at {Organization Name}.          │
│                                      │
│     Our team will review your        │
│     application and reach out if     │
│     there's a good fit.              │
│                                      │
│     Good luck! 🍀                    │
└──────────────────────────────────────┘
```

---

## 4. Design Considerations

- **No sidebar, no navigation**: This is a standalone public page
- **Branding**: Shows the hiring org's name and logo (if available)
- **Mobile-first**: Many candidates will open this on their phone from an email
- **Simple form**: Minimize fields — only ask what's essential for screening
- **No account required**: Candidate never needs to create an account
- **Accessibility**: Proper labels, form validation, keyboard navigation
- **Loading speed**: Minimal JS bundle — this page should load instantly

---

## 5. Backend Integration

| Action | API Endpoint | Method | Auth |
|--------|-------------|--------|------|
| Verify token + load data | `/api/apply/:token` | GET | None |
| Submit application | `/api/apply/:token` | POST | None |

### Verify Response
```json
{
  "candidate_name": "Rahul Kumar",
  "candidate_email": "rahul@example.com",
  "position": {
    "role_name": "Senior Python Developer",
    "org_name": "TechCorp",
    "location": "Bangalore, India",
    "work_type": "hybrid",
    "experience_range": "5-8 years",
    "jd_summary": "We are looking for..."
  },
  "match_score": 92,
  "already_applied": false
}
```

### Submit Payload
```json
{
  "prev_company": "TechCorp",
  "notice_period": "30 days",
  "total_experience": "6 years",
  "relevant_experience": "4 years",
  "current_salary": "18 LPA",
  "expected_salary": "24 LPA",
  "availability": "After 30 days notice",
  "interview_availability": "Mon-Fri 10am-6pm IST",
  "additional_info": "Open to relocation"
}
```

---

## 6. Security

- Token is a signed JWT with `candidate_id`, `position_id`, `exp` (72h)
- Token cannot be reused after successful submission (mark as used)
- No sensitive data exposed in the URL
- Rate limit: 3 submissions per token per hour (prevent spam)
- CSRF not needed (no cookies, POST with signed token = sufficient)
