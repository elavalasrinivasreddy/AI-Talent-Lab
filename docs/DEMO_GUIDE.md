# AI Talent Lab — End-to-End Demo & Testing Guide

This guide provides a realistic, structured blueprint for testing the platform from scratch. It covers creating an organization, setting up departments, assigning roles, and executing a complete hiring lifecycle to verify features and Role-Based Access Control (RBAC).

## 1. The Scenario: NovaTech Solutions

**Organization**: NovaTech Solutions  
**Org Head (Owner)**: Sarah Chen (`sarah@novatech.com`)

### Department Structure & Team
1. **Engineering**
   - **Department Admin**: Marcus Webb (`marcus@novatech.com`)
   - **Team Lead (Hiring Manager)**: David Kim (`david@novatech.com`)
   - **HR / Recruiter**: Emily Blunt (`emily@novatech.com`)

2. **Marketing**
   - **Department Admin**: Chloe Price (`chloe@novatech.com`)
   - **HR / Recruiter**: Sam Smith (`sam@novatech.com`)

---

## 2. Setup Phase

### Step 1: Bootstrap the Organization (via Dev Console)
Since you start with a blank database, you must bootstrap the first user and organization using the Dev Console.
1. Navigate to `/dev`.
2. Under the **Create User** panel, select **Create new** Org.
3. Fill in the details:
   - Org Name: `NovaTech Solutions`
   - Name: `Sarah Chen`
   - Email: `sarah@novatech.com`
   - Role: `org_head`
4. Click **+ Create User**.
5. Find Sarah in the Users table on the left and click **Login as →**.

### Step 2: Create Departments (via App Settings)
Now that you are logged into the actual app as the Org Head, you can test the application's configuration UI.
1. Navigate to **Settings > Departments**.
2. Create the two departments:
   - `Engineering`
   - `Marketing`

### Step 3: Invite the Team (via App Settings)
Test the platform's invitation and RBAC assignment systems.
1. Navigate to **Settings > Users & Roles** (or Team).
2. Invite the Engineering Team:
   - Marcus Webb (Role: `Department Admin`, Dept: `Engineering`)
   - David Kim (Role: `Team Lead`, Dept: `Engineering`)
   - Emily Blunt (Role: `HR / Recruiter`, Dept: `Engineering`)
3. Invite the Marketing Team:
   - Chloe Price (Role: `Department Admin`, Dept: `Marketing`)
   - Sam Smith (Role: `HR / Recruiter`, Dept: `Marketing`)
   
*(Note: If email sending is not configured locally, you can return to `/dev` and use the "Login As" button to jump into these newly created accounts).*

---

## 3. End-to-End Testing Workflows

Once the structure is set up, execute these workflows to test the core features of the SaaS.

### Workflow A: The Hire Request (Team Lead)
1. Login as **David Kim** (`team_lead` for Engineering).
2. Navigate to **Hire Requests**.
3. Raise a new request for a **"Senior Frontend Engineer"**. Provide a realistic justification (e.g., "Replacing outgoing senior engineer, need React expertise") and submit it.

### Workflow B: HR Triage & JD Generation (HR)
1. Login as **Emily Blunt** (`hr` for Engineering).
2. Navigate to **Hire Requests**. You should see David's request.
3. Approve the request and convert it into a Position.
4. Go through the **AI Chat JD Generation** workflow. Have a conversation with the AI to refine the requirements, finalize the draft, and publish the position.

### Workflow C: The Candidate Experience (Public)
1. Copy the public **Apply Magic Link** for the newly created Senior Frontend Engineer position.
2. Open an Incognito window and navigate to the link.
3. Complete the **Conversational Apply Chat** as a mock candidate (e.g., "Alex Hacker"). Upload a mock resume if prompted, and complete the screening.

### Workflow D: ATS Scoring & Pipeline Kanban (HR)
1. Return to the window logged in as **Emily Blunt** (`hr`).
2. Navigate to the **Positions > Pipeline Kanban** board for the Frontend Engineer role.
3. Verify that "Alex Hacker" appears in the `New` or `Screening` column.
4. Check the AI **ATS Score** and match breakdown on Alex's profile.
5. Drag and drop Alex into the `Interview` stage to test pipeline state persistence.

### Workflow E: RBAC / Tenant Isolation Check (Cross-Department)
1. Login as **Chloe Price** (`dept_admin` for Marketing).
2. Navigate through the Dashboard, Positions, and Hire Requests.
3. **Crucial Check**: Chloe should **NOT** be able to see the "Senior Frontend Engineer" position, David's hire request, or Alex's candidate profile, because her scope is restricted strictly to the Marketing department.
