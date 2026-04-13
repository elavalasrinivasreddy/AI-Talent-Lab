# Page Design: Panel Feedback (Magic Link)
> **Version 2.1 — New Document**
> Panel members submit interview feedback via magic link — NO platform login required.
> Structured form with AI enrichment of rough notes.

---

## 1. Overview

| Aspect | Detail |
|---|---|
| Route | `/panel/:token` |
| Auth | None — public, magic link token only |
| Entry Point | Panel member clicks magic link in interview invitation email |
| Layout | No sidebar — standalone public page |
| Token expiry | 7 days from interview date |
| Single-use | Token marked used after final submission |

---

## 2. Page States

**State A — Loading:** Verifying token.

**State B — Attendance Check (shown first):**
```
┌─────────────────────────────────────────────────────┐
│  [Org Logo]  TechCorp · Interview Feedback          │
│                                                     │
│  Were you present in this interview?                │
│                                                     │
│  [Yes, I attended]     [I was not present]          │
└─────────────────────────────────────────────────────┘
```

If "Not present": `interview_panel.not_attended = true`. Show confirmation + close. No feedback form shown.

**State C — Feedback Form (after confirming attendance)**

**State D — Already Submitted:**
```
┌─────────────────────────────────────────────────────┐
│  ✅ Feedback Already Submitted                      │
│  You submitted feedback for Rahul Kumar             │
│  (Round 1 Technical) on Apr 12, 2026 at 2:45 PM.  │
│  Thank you!                                         │
└─────────────────────────────────────────────────────┘
```

**State E — Expired:**
```
┌─────────────────────────────────────────────────────┐
│  ⏰ This link has expired                           │
│  Feedback links are valid for 7 days.              │
│  Contact the hiring team for assistance.           │
│  📧 hiring@techcorp.com                            │
└─────────────────────────────────────────────────────┘
```

---

## 3. Page Layout (Feedback Form)

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER (fixed, 60px)                                            │
│  [Org Logo]  TechCorp · Interview Feedback                      │
├─────────────────────────────────────────────────────────────────┤
│  CONTEXT BANNER                                                  │
│  Candidate: Rahul Kumar  ·  Role: Senior Python Developer       │
│  Round: Round 1 — Technical  ·  Date: Apr 12 · 2:00 PM         │
├─────────────────────────────────────────────────────────────────┤
│  CANDIDATE INFO (collapsible)                                    │
│  [📄 View Resume ▾]    [📋 View JD ▾]                           │
├─────────────────────────────────────────────────────────────────┤
│  FEEDBACK FORM (scrollable)                                      │
│  Section 1: Ratings                                              │
│  Section 2: Written Feedback + AI Enrich                        │
│  Section 3: Recommendation                                       │
│  Section 4: Submit                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Candidate Info (Collapsible)

**View Resume ▾** expands full resume content.
**View JD ▾** expands job description.

**What panel members CAN see:**
- Candidate name
- Candidate resume
- Role being interviewed
- Round details (number, type, date)
- Required skills from JD
- Their own previous draft (if saved)

**What panel members CANNOT see:**
- Candidate phone number
- Candidate CTC (current or expected)
- Other panelists' feedback/scores
- Salary range for the role
- Recruiter internal notes

---

## 5. Section 1 — Skill Ratings

4 dimensions, each rated 1–5. Stars are large (32px) for easy mobile tapping.

```
Technical Skills
"Assess technical depth, problem-solving approach, code quality demonstrated"
★ ★ ★ ★ ☆   [4/5]
Notes: [Strong Python, needs more K8s depth_________________________]

───────────────────────────────────────────────────────────────────

Problem Solving
"Ability to break down complex problems and arrive at systematic solutions"
★ ★ ★ ★ ★   [5/5]
Notes: [Excellent on rate-limiting design problem___________________]

───────────────────────────────────────────────────────────────────

Communication
"Clarity of explanation, listening skills, articulation"
★ ★ ★ ★ ☆   [4/5]
Notes: [Clear, good at whiteboarding________________________________]

───────────────────────────────────────────────────────────────────

Culture Fit
"Alignment with team values and working style"
★ ★ ★ ☆ ☆   [3/5]
Notes: [More individual contributor, team dynamic TBD_______________]

Overall Score:   4.0 / 5  (weighted average — shown live)
```

All 4 dimensions required before submitting.
Clicking a selected star deselects it (for corrections).

---

## 6. Section 2 — Written Feedback + AI Enrich

```
Strengths
┌─────────────────────────────────────────────────────────────┐
│  strong python, built similar systems, good async patterns  │
└─────────────────────────────────────────────────────────────┘

Areas of Concern
┌─────────────────────────────────────────────────────────────┐
│  k8s not strong, never managed prod infra directly          │
└─────────────────────────────────────────────────────────────┘

[✨ AI Enrich — Make this more professional]
```

**After AI Enrich:**
```
── Enriched Preview ─────────────────────────────────────────────
Strengths:
"Candidate demonstrates strong proficiency in Python with hands-on 
experience building high-throughput asynchronous systems. Shows solid 
understanding of FastAPI patterns and event-driven architecture."

Areas of Concern:
"Limited exposure to Kubernetes in production environments. Has not 
independently managed production infrastructure, which may require 
ramp-up time during initial months."

[Use Enriched Version]     [Keep My Original]
─────────────────────────────────────────────────────────────────
```

Raw notes always saved to `scorecards.raw_notes_strengths/concerns` regardless of choice.

---

## 7. Section 3 — Recommendation

```
What is your hiring recommendation?

┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ 💪 Strong Yes│  │ 👍 Yes       │  │ 😐 Neutral   │
└──────────────┘  └──────────────┘  └──────────────┘
┌──────────────┐  ┌──────────────┐
│ 👎 No        │  │ ❌ Strong No  │
└──────────────┘  └──────────────┘

Additional Comments (optional)
┌────────────────────────────────────────────────────────┐
│  Would recommend for senior backend once K8s improves. │
└────────────────────────────────────────────────────────┘
```

Large tap-target buttons. Selected button fills/highlights.

---

## 8. Section 4 — Submit

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  By submitting, you confirm this is your independent        │
│  assessment based on the interview conducted.               │
│                                                              │
│  Overall Score:      4.0 / 5                                 │
│  Recommendation:     👍 Yes                                  │
│                                                              │
│  [Save Draft]                    [Submit Feedback]          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Save Draft:** Saves current state without marking submitted. Panel can return to same link and continue.

**Submit Feedback:**
- Validates all required fields (4 ratings + recommendation)
- Confirmation dialog: "Once submitted, feedback cannot be edited. Confirm?"
- On confirm → submit → show success state → magic link marked as used

**Success state:**
```
┌──────────────────────────────────────────┐
│  ✅ Feedback Submitted!                  │
│                                          │
│  Thank you for assessing Rahul Kumar.   │
│  Score: 4.0/5 · Recommendation: Yes     │
└──────────────────────────────────────────┘
```

---

## 9. Weighted Score Calculation

Default weights (configurable per org in Settings → Interview Templates):
```
Technical Skills:  40%
Problem Solving:   30%
Communication:     15%
Culture Fit:       15%
```

`overall_score = sum(rating × weight for each dimension)`

---

## 10. Notifications Triggered

- Recruiter notified when one panelist submits
- Recruiter notified when ALL panelists submit: "All feedback received — review now"
- PipelineEvent created: `event_type = 'feedback_submitted'`

---

## 11. API Endpoints

| Action | Endpoint | Method |
|---|---|---|
| Verify token + load data | `GET /api/v1/panel/:token` | GET |
| AI enrich rough notes | `POST /api/v1/panel/:token/enrich` | POST |
| Save draft / submit | `POST /api/v1/panel/:token/submit` | POST |

**Submit request body:**
```json
{
  "is_draft": false,
  "attended": true,
  "ratings": [
    {"dimension": "technical_skills", "score": 4, "notes": "Strong Python..."},
    {"dimension": "problem_solving", "score": 5, "notes": "Excellent..."},
    {"dimension": "communication", "score": 4, "notes": "Clear..."},
    {"dimension": "culture_fit", "score": 3, "notes": "More IC..."}
  ],
  "overall_score": 4.0,
  "strengths": "Candidate demonstrates strong Python proficiency...",
  "concerns": "Limited Kubernetes exposure...",
  "raw_notes_strengths": "strong python, built similar systems",
  "raw_notes_concerns": "k8s not strong",
  "recommendation": "yes",
  "additional_comments": "Would recommend once K8s skills develop"
}
```
