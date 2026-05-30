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

### Step 2: Configure Organization Profile & Departments
1. As Sarah, navigate to **Settings > Organization Profile**.
2. Fill out the company details exactly as follows:
   - **Industry / Segment**: `B2B SaaS`
   - **Company Size**: `enterprise`
   - **Website**: `https://novatech.com`
   - **Headquarters**: `San Francisco, CA`
   - **About Us**: `NovaTech Solutions is a leading provider of innovative B2B SaaS software tailored for global enterprises.`
   - **Culture Keywords**: Type `fast-paced` and press Enter, then `remote-friendly`, then `engineering-led`.
   - **Benefits Template**: `Unlimited PTO, Comprehensive Health Insurance, 401k Match, Annual Learning Stipend.`
   - **LinkedIn URL**: `https://linkedin.com/company/novatech`
   - **Glassdoor URL**: `https://glassdoor.com/novatech`
   These are used later by AI workflows.
3. Click **Save Organization**.
4. Navigate to **Settings > Departments**.
5. Create the two departments:
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

### Step 4: Add Competitor Intelligence (via App Settings)
Test the department-scoped competitor grouping.
1. As Sarah (`org_head`), navigate to **Settings > Competitor intel**.
2. Click **+ Add Competitor**, select the **Engineering** department, and add the following competitor:
   - **Name**: `Tech Innovators`
   - **Website**: `https://techinnovators.com`
   - **Industry**: `Technology`
   - **Notes**: `Direct rival in cloud infrastructure.`
3. Click **+ Add Competitor**, select the **Marketing** department, and add the following competitor:
   - **Name**: `Creative Sync`
   - **Website**: `https://creativesync.io`
   - **Industry**: `Marketing Tech`
   - **Notes**: `Competes for digital marketing talent.`
4. Notice that Sarah sees competitors properly grouped by their respective departments.
5. Login as **Marcus Webb** (`elavalasrinivasreddy+eng_admin@gmail.com`), the Engineering Dept Admin.
6. Verify Marcus received an internal notification that Sarah added "Tech Innovators" to his department's competitors.
7. Navigate to **Settings > Competitor intel**. Marcus should only see the Engineering competitors (he will not see "Creative Sync").
8. As Marcus, click **+ Add Competitor**. Note that the department selection is locked/hidden. Add a second competitor:
   - **Name**: `CodeCrafters`
   - **Website**: `https://codecrafters.io`
   - **Industry**: `Technology`
   - **Notes**: `High compensation packages.`
9. When Sarah logs back in, she will have a notification that Marcus added "CodeCrafters" to the Engineering department.
10. Note the hard limit: Attempting to add a 4th competitor to a single department should return an error.

---

## 3. End-to-End Testing Workflows

Once the structure is set up, execute these workflows to test the core features of the SaaS.

### Workflow A: The Hire Request (Team Lead)
1. Login as **David Kim** (`elavalasrinivasreddy+eng_lead@gmail.com`).
2. Navigate to **Hire Requests**.
3. Click **New request** to raise a request for a **"Senior Frontend Engineer"**. 
4. Fill in the basics exactly as follows:
   - **Headcount**: `1`
   - **Experience**: `5` to `8` years
   - **Compensation**: `30` to `45` LPA
   - **Work Type**: `Hybrid`
5. In the **"Context for the AI"** field, paste exactly this text:
   `Replacing outgoing senior engineer. Must have deep expertise in React, performance optimization, and mentoring juniors.`
   Then click submit.

### Workflow B: HR Triage & JD Generation (HR)
1. Login as **Emily Blunt** (`elavalasrinivasreddy+eng_hr@gmail.com`).
2. Navigate to **Hire Requests**. You should see David's request.
3. Approve the request and convert it into a Position.
4. Go through the **AI Chat JD Generation** workflow. Have a conversation with the AI to refine the requirements, finalize the draft, and publish the position.

### Workflow C: The Candidate Experience (Public)
1. Copy the public **Apply Magic Link** for the newly created Senior Frontend Engineer position.
2. Open an Incognito window and navigate to the link.
3. Complete the **Conversational Apply Chat** as a mock candidate:
   - **Name**: `Alex Hacker`
   - **Email**: `alex.hacker@example.com`
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
