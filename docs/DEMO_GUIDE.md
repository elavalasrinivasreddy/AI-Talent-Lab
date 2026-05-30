# AI Talent Lab — End-to-End Demo & Testing Guide

This guide provides a realistic, structured blueprint for testing the platform from scratch. It covers creating an organization via the public signup flow, setting up departments, inviting users, and executing a complete hiring lifecycle.

> **Important Note on Emails (Resend Dev Mode):**
> Because Resend is in development mode, it can only send emails to your verified developer address. To simulate multiple distinct users, this guide uses the Gmail `+` alias trick. 
> All emails below use `elavalasrinivasreddy+[role]@gmail.com`. The database treats these as distinct users, but Resend will successfully deliver all invitations and magic links to your single inbox (`elavalasrinivasreddy@gmail.com`).

---

## 1. The Scenario: NovaTech Solutions

**Organization**: NovaTech Solutions  
**Org Head (Owner)**: Sarah Chen (`elavalasrinivasreddy+org_head@gmail.com`)

### Department Structure & Team
1. **Engineering**
   - **Department Admin**: Marcus Webb (`elavalasrinivasreddy+eng_admin@gmail.com`)
   - **Team Lead (Hiring Manager)**: David Kim (`elavalasrinivasreddy+eng_lead@gmail.com`)
   - **HR / Recruiter**: Emily Blunt (`elavalasrinivasreddy+eng_hr@gmail.com`)

2. **Marketing**
   - **Department Admin**: Chloe Price (`elavalasrinivasreddy+mkt_admin@gmail.com`)
   - **HR / Recruiter**: Sam Smith (`elavalasrinivasreddy+mkt_hr@gmail.com`)

---

## 2. Setup Phase

### Step 1: Create the Organization (via Public Signup)
Test the public onboarding flow to bootstrap the platform.
1. Navigate to `/register`.
2. Fill in the details to create your organization and the initial Org Head account:
   - Organization Name: `NovaTech Solutions`
   - Your Name: `Sarah Chen`
   - Work Email: `elavalasrinivasreddy+org_head@gmail.com`
   - Password: `Password123!`
3. Complete the registration and log in. You are now the `org_head`.

### Step 2: Create Departments (via App Settings)
1. As Sarah, navigate to **Settings > Departments**.
2. Create the two departments:
   - `Engineering`
   - `Marketing`

### Step 3: Invite the Team (via App Settings)
Test the platform's email invitation and RBAC assignment systems.
1. Navigate to **Settings > Users & Roles** (or Team).
2. Send invites to the Engineering Team:
   - Marcus Webb (Email: `elavalasrinivasreddy+eng_admin@gmail.com`, Role: `Department Admin`, Dept: `Engineering`)
   - David Kim (Email: `elavalasrinivasreddy+eng_lead@gmail.com`, Role: `Team Lead`, Dept: `Engineering`)
   - Emily Blunt (Email: `elavalasrinivasreddy+eng_hr@gmail.com`, Role: `HR / Recruiter`, Dept: `Engineering`)
3. Send invites to the Marketing Team:
   - Chloe Price (Email: `elavalasrinivasreddy+mkt_admin@gmail.com`, Role: `Department Admin`, Dept: `Marketing`)
   - Sam Smith (Email: `elavalasrinivasreddy+mkt_hr@gmail.com`, Role: `HR / Recruiter`, Dept: `Marketing`)
4. **Check your inbox (`elavalasrinivasreddy@gmail.com`)**. You should receive all the invitation emails. Click the links to set passwords for each user and verify the invite flow works.

---

## 3. End-to-End Testing Workflows

Once the structure is set up, execute these workflows to test the core features of the SaaS.

### Workflow A: The Hire Request (Team Lead)
1. Login as **David Kim** (`elavalasrinivasreddy+eng_lead@gmail.com`).
2. Navigate to **Hire Requests**.
3. Raise a new request for a **"Senior Frontend Engineer"**. Provide a realistic justification (e.g., "Replacing outgoing senior engineer, need React expertise") and submit it.

### Workflow B: HR Triage & JD Generation (HR)
1. Login as **Emily Blunt** (`elavalasrinivasreddy+eng_hr@gmail.com`).
2. Navigate to **Hire Requests**. You should see David's request.
3. Approve the request and convert it into a Position.
4. Go through the **AI Chat JD Generation** workflow. Have a conversation with the AI to refine the requirements, finalize the draft, and publish the position.

### Workflow C: The Candidate Experience (Public)
1. Copy the public **Apply Magic Link** for the newly created Senior Frontend Engineer position.
2. Open an Incognito window and navigate to the link.
3. Complete the **Conversational Apply Chat** as a mock candidate (e.g., "Alex Hacker"). 
4. Check your email inbox to test the candidate application confirmation (if enabled).

### Workflow D: ATS Scoring & Pipeline Kanban (HR)
1. Return to the window logged in as **Emily Blunt**.
2. Navigate to the **Positions > Pipeline Kanban** board for the Frontend Engineer role.
3. Verify that "Alex Hacker" appears in the `New` or `Screening` column.
4. Check the AI **ATS Score** and match breakdown on Alex's profile.
5. Drag and drop Alex into the `Interview` stage to test pipeline state persistence.

### Workflow E: RBAC / Tenant Isolation Check (Cross-Department)
1. Login as **Chloe Price** (`elavalasrinivasreddy+mkt_admin@gmail.com`).
2. Navigate through the Dashboard, Positions, and Hire Requests.
3. **Crucial Check**: Chloe should **NOT** be able to see the "Senior Frontend Engineer" position, David's hire request, or Alex's candidate profile, because her scope is restricted strictly to the Marketing department.
