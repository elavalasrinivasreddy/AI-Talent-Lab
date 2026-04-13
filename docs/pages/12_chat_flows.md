# Chat Flows — Conversation Scripts
> **Version 2.1 — New Document**
> Exact AI conversation scripts for Recruiter Chat (JD generation) and Candidate Chat (application).
> These scripts define what the AI says, when, and how it handles edge cases.
> This is the product's brain — deviations from these flows must be intentional.

---

## PART 1 — RECRUITER CHAT (JD Generation)

### Workflow Summary
```
Start → Intake → Internal Check → Market Research → Variant Selection → Final JD → Bias Check → Complete
```

---

### 1.1 Session Start

**New session → AI first message:**
```
Hi! I'm your AI hiring assistant. 👋

Let's create a job description together. What role are you looking to fill?

You can also upload an existing JD if you'd like me to start from that.
```

**If user uploads JD file:**
```
Got it! Let me read through this JD...

[parsing...]

Here's what I found:
- Role: {extracted_role}
- Experience: {extracted_experience}
- Key skills: {extracted_skills}
- Location: {extracted_location}

Does this look right? Anything to change or add?
```

---

### 1.2 Intake — Requirements Gathering

**Rule: Max 2–3 questions per message. Never all at once.**

**Turn 1 — After user states role:**
```
A few quick details:
1. What experience range are you targeting? (e.g., 3–5 years, 5–8 years)
2. What are the must-have technical skills?
```

**Turn 2 — After skills + experience:**
```
Got it — {summary}. Two more:
1. Work arrangement: remote / hybrid / onsite?
2. Is this full-time, contract, or internship?
```

**Turn 3 — Summary confirmation:**
```
Here's what I've gathered:

Role: {role}
Experience: {min}–{max} years
Skills: {list}
Work type: {type} · {location}
Employment: {type}

Does this look right, or anything to adjust?
```

User confirms → proceed. User wants changes → accept, confirm, move forward.

**Missing critical info:**
```
Just to make sure I get this right — could you tell me {specific field}?
```

---

### 1.3 Internal Check Stage

**Transition:**
```
Let me check what skills your organization has used in similar past roles...
```
→ Show InternalCheckCard.

**After accepting skills:**
```
Added {skills} to the requirements. These appeared in similar past roles in your organization.
```

**After skipping:**
```
No problem. Moving to market research...
```

**No past data:**
```
No similar past roles found in your organization yet. Moving to market research...
```

---

### 1.4 Market Research Stage

**Transition:**
```
Now let me check what the market is asking for...
```
→ Show MarketResearchCard.

**After accepting:**
```
Added {skills}. These help position the role competitively against {competitor_names}.
```

**After skipping:**
```
Got it. Moving to JD variations...
```

**No competitors configured:**
```
No competitor companies are configured for market benchmarking.

You can add them in Settings → Competitor Intel to enable this for future sessions.

Moving ahead with what we have...
```

---

### 1.5 JD Variant Selection

**Transition:**
```
Based on everything we've gathered, here are 3 JD styles. 
Read through them and pick the one that fits best — you can 
edit any before selecting.
```
→ Show JDVariantsCard.

**After selection (card click or typed):**
```
Great choice! I'll use the {variant_type} style as the foundation. 

Generating your complete job description now...
```

**If user types variant preference:**
- "hybrid" / "the last one" / "option 3" → system maps to correct variant

---

### 1.6 Final JD + Post-Generation

**No transition message — JD streams directly into FinalJDCard.**

**After streaming completes:**
```
Your job description is ready! 

Feel free to edit it directly, or ask me to adjust anything — for example:
• "Make it more senior-focused"
• "Add a section about career growth"
• "Make the tone less formal"

When you're happy with it, click "Save & Find Candidates".
```

**If user asks for refinement:**
```
Updating your JD...
[re-streams with changes]

Here's the updated version. Anything else to adjust?
```

---

### 1.7 Bias Check

Runs automatically. Card shown below FinalJDCard.

**No issues found:**
```
✅ No potentially biased language detected.
```

---

### 1.8 Session Resumption (Existing Session)

**User opens in-progress session:**
```
Welcome back! We were working on the {role_name} JD.

We're at the {stage_label} stage. {context_summary}

Ready to continue?
```

Stage labels:
- intake → "I was gathering your requirements"
- internal_check → "We were reviewing internal skills suggestions"
- market_research → "We were reviewing market research suggestions"
- jd_variants → "You had 3 JD styles to choose from"
- final_jd → "Your JD was ready — you can still edit or save it"
- complete → "This JD was saved as position: {position_name}"

---

## PART 2 — CANDIDATE CHAT (Magic Link Application)

### Flow Summary
```
Greeting → Interest Check → Current Role → Experience → CTC → Notice Period → Resume Upload → Custom Questions → Completion
```

### Rules
- One topic per message — never bundle multiple major questions
- Warm and professional tone — not robotic
- Quick-reply buttons for binary/short choices
- Never mention ATS scores, match percentages, or internal notes
- If confused, re-explain clearly without revealing backend logic

---

### 2.1 Greeting

**Opens automatically on page load:**
```
Hi {candidate_name}! 👋

I'm an AI assistant for {org_name}'s hiring team. We came across your 
profile and think you might be a great fit for our {role_name} role.

This will take about 3–4 minutes. Before we begin — are you currently 
open to exploring this opportunity?
```

Quick replies: `[Yes, I'm interested!]` `[No, thanks]`

---

### 2.2 Not Interested

```
No problem at all! We appreciate you letting us know. Your profile 
will be noted for future opportunities that might be a better fit.

Best of luck! 🍀
```
Session ends. No application created.

---

### 2.3 Current Role Confirmation

**If profile data available:**
```
Wonderful! Let's get started.

We have you listed as {current_title} at {current_company} — is that 
still your current role?
```
Quick replies: `[Yes, that's correct]` `[No, let me update]`

**If no profile data:**
```
Wonderful! Could you share your current role and company?
```

---

### 2.4 Experience

```
How many years of total professional experience do you have?

And of those, how many are directly relevant to {role_area}?
```

AI confirms: `"Got it — 6 years total, 4 years relevant backend experience."`

---

### 2.5 Compensation

```
A couple of questions about compensation — this helps ensure 
the role is the right fit for both of us:

1. What is your current annual CTC?
2. What are you expecting for this role?
```

**If candidate declines:**
```
No problem — that's completely optional. Let's move on.
```
Mark as `"declined"` in screening_responses.

**If asked why:**
```
This information helps our hiring team understand if the compensation 
for this role aligns with your expectations. It's kept confidential 
and only visible to HR.
```

---

### 2.6 Notice Period

```
What is your notice period at your current company?

If you're between jobs or immediately available, just let me know!
```

Quick replies: `[Immediate]` `[15 days]` `[30 days]` `[60 days]` `[90+ days]`

---

### 2.7 Resume Upload

```
Almost done! Please share your latest resume.

You can upload a PDF or Word document (max 5MB).
```

File upload button appears in chat.

**After upload:**
```
✅ Resume received! Thank you.
```

**Upload fails:**
```
It seems there was an issue uploading that file. Could you try 
again? Make sure it's a PDF or DOCX under 5MB.
```

---

### 2.8 Dynamic Screening Questions

Asked one at a time from `screening_questions` table.

Example:
```
One more question — are you comfortable working from our 
{city} office {N} days per week?
```

Another:
```
Do you have any active job offers at the moment?
```

---

### 2.9 Completion

```
That's everything! 🎉

Your application for {role_name} at {org_name} has been submitted.

Here's what to expect next:
• Our hiring team will review your profile shortly
• {org_name} typically conducts {round_count} interview rounds:
  {round_descriptions}
• If shortlisted, you'll receive an email with interview details

We'll keep you updated at each stage. Good luck! 🍀
```

Input disabled. System sends "interview process overview" email automatically.

---

## PART 3 — HANDLING EDGE CASES (Both Chats)

### Candidate asks a question mid-flow

```
{Brief relevant answer if safe to provide}.

To continue with your application — {repeat current question simply}.
```

### Candidate asks about role salary

```
The compensation details will be discussed during the interview 
process. For now, could you share your expected CTC so we can 
ensure alignment?
```

### Candidate wants to update a previous answer

```
Of course! Which part would you like to change?
```
Accept update, confirm, continue from current step.

### Candidate goes offline mid-session

Session stays active 72 hours. On return:
```
Welcome back, {name}! 

We were in the middle of your application for {role_name}. 
Let's pick up where we left off — {last question asked}.
```

### LLM timeout or error

**Recruiter chat:**
```
I ran into a technical issue. Your progress is saved — please 
click "Retry" to continue from where we left off.
```

**Candidate chat:**
```
Something went wrong on our end — your application isn't lost. 
Please refresh the page and we'll pick up where we left off.
```

### Unclear or ambiguous input

**Recruiter:**
```
I'm not quite sure I understood that. Could you rephrase? 
I'm looking for {what was needed}.
```

**Candidate:**
```
Could you clarify that a bit? I want to make sure I 
record your response accurately.
```
