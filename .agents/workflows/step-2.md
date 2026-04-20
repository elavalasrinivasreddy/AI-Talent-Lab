---
description: TASK PROMPT — Settings & Organization Configuration
---

Step 1 is complete. Begin Step 2: Settings & Organization Configuration.

Read docs/06_settings.md and docs/BACKEND_PLAN.md §5 (Settings API) before writing any code.

The Settings module is critical — it feeds directly into JD generation (org About Us, 
culture keywords, benefits), market research (competitors), candidate apply chat 
(screening questions), and panel feedback (scorecard templates). 
Build it correctly here or every downstream feature is wrong.

== BACKEND ==

1. Repositories
   Implement all repository classes needed for settings:
   - db/repositories/departments.py: DeptRepository (CRUD, list by org, hierarchy)
   - db/repositories/competitors.py: CompetitorRepository (CRUD, list active by org)
   - db/repositories/screening_questions.py: ScreeningQuestionRepository 
     (CRUD, list by org+dept, reorder)
   - db/repositories/message_templates.py: MessageTemplateRepository
     (CRUD, list by org+category, get defaults)
   - db/repositories/scorecard_templates.py: (same file) ScorecardTemplateRepository

2. Settings service (services/settings_service.py)
   Implement all business logic:
   - get_org_profile(org_id) → full org with slug
   - update_org_profile(org_id, data) → update all mutable fields
   - get/create/update/delete departments with validation 
     (cannot delete dept with users or positions)
   - get/create/update/delete competitors
   - get screening questions (with dept fallback: if dept has questions use those,
     else use org-wide default)
   - create/update/delete/reorder screening questions
   - get/create/update/delete message templates
   - seed default message templates for new orgs (outreach, rejection, 
     interview_invite, interview_process_overview, follow_up)
   - get/create/update scorecard templates
   - seed default scorecard template for new orgs

3. Settings router (routers/settings.py)
   Implement all endpoints from docs/BACKEND_PLAN.md §5 under Settings section.
   Admin-only endpoints must use require_admin() dependency.
   
   Special behavior on org update:
   After updating org profile, re-embed the About Us + culture_keywords + 
   benefits_text into a combined "org_context" string and store it 
   (used later by JD generation agent to pull org context).

4. Pydantic models (models/settings.py)
   OrgProfileResponse, OrgProfileUpdate, DepartmentCreate, DepartmentUpdate,
   DepartmentResponse, CompetitorCreate, CompetitorResponse,
   ScreeningQuestionCreate, ScreeningQuestionUpdate, ScreeningQuestionResponse,
   MessageTemplateCreate, MessageTemplateUpdate, MessageTemplateResponse,
   ScorecardTemplateCreate, ScorecardTemplateResponse

5. Default data seeding
   When a new org is registered (hook into auth_service.register):
   - Create a default "General" department
   - Seed 5 default screening questions:
     notice_period (select), current_ctc (number), expected_ctc (number),
     total_experience (number), office_availability (select)
   - Seed default message templates (outreach, rejection, follow_up,
     interview_invite, interview_process_overview)
   - Seed default scorecard template:
     Technical Skills (40%), Problem Solving (30%), Communication (15%), 
     Culture Fit (15%)

== FRONTEND ==

6. Settings page skeleton (components/Settings/SettingsPage.jsx)
   Two-column layout: left tab list (240px), right content panel.
   Tab list with all 11 tabs from docs/06_settings.md.
   Active tab highlighted. URL updates to /settings/:tab on tab click.
   Implement tab switching.

7. Profile tab (components/Settings/tabs/ProfileTab.jsx)
   Implement exactly per docs/06_settings.md §3.1.
   All fields, read-only fields, save action, change password inline form.
   Calls PATCH /api/v1/auth/profile and POST /api/v1/auth/change-password.

8. Organization tab (components/Settings/tabs/OrganizationTab.jsx)
   Implement exactly per docs/06_settings.md §3.2.
   Admin: all fields editable. Non-admin: read-only view.
   About Us, culture keywords (tag input), benefits text — these three fields
   have a subtle "Feeds into JD generation" label. Users must know why they matter.
   Calls GET + PATCH /api/v1/settings/org.

9. Team Members tab (components/Settings/tabs/TeamTab.jsx)
   Implement exactly per docs/06_settings.md §3.3.
   User table with search. Inline role/dept dropdowns. Deactivate toggle.
   Add user form at bottom. Admin only.

10. Departments tab (components/Settings/tabs/DepartmentsTab.jsx)
    Implement per docs/06_settings.md §3.4.
    Tree view showing hierarchy. Add/edit/delete (only empty depts).

11. Competitors tab (components/Settings/tabs/CompetitorsTab.jsx)
    Implement per docs/06_settings.md §3.5.
    Card grid. Add form. Subtle label: "Used in JD market research step."

12. Screening Questions tab (components/Settings/tabs/ScreeningQuestionsTab.jsx)
    Implement per docs/06_settings.md §3.6.
    Department filter (org default vs per-dept).
    Drag-to-reorder (use @dnd-kit/sortable).
    Add/edit/delete questions. Field type selector.
    Subtle label: "These questions are asked in the candidate application chat."

13. Message Templates tab (components/Settings/tabs/MessageTemplatesTab.jsx)
    Implement per docs/06_settings.md §3.7.
    List of templates by category. Edit modal with subject + body.
    Variable chips shown below editor: {{candidate_name}}, {{role_name}}, etc.
    NO WhatsApp templates visible — WhatsApp is Phase 2.

14. Interview Templates tab (components/Settings/tabs/InterviewTemplatesTab.jsx)
    Implement per docs/06_settings.md §3.8.
    List of scorecard dimension templates. Dimensions with weight sliders.
    Note: "AI auto-generates position-specific scorecards from the JD. 
    These are fallback defaults."

15. Appearance tab (components/Settings/tabs/AppearanceTab.jsx)
    Three theme cards: Dark (default), Light, System.
    Selected card is highlighted. Clicking changes theme immediately via ThemeContext.
    Implement ThemeContext.jsx: dark/light/system stored in localStorage,
    applied as class on <html> element.

16. Integrations + Security tabs
    Integrations tab: show all integration cards from docs/06_settings.md §3.9
    as "Not configured / Phase 2" placeholders. Clean UI, not broken-looking.
    Security tab: placeholder with "Coming soon" for 2FA, session management.

== DONE CRITERIA ==

[ ] GET /api/v1/settings/org returns org profile with all fields
[ ] PATCH /api/v1/settings/org updates About Us, culture_keywords, benefits_text
[ ] Department CRUD works, cannot delete non-empty department
[ ] Competitor CRUD works
[ ] Screening questions CRUD + reorder works, dept fallback to org default works
[ ] Message templates CRUD works, defaults seeded on new org registration
[ ] Scorecard template CRUD works, default seeded on new org registration
[ ] New org registration automatically seeds all defaults
[ ] Frontend: all 11 settings tabs render
[ ] Frontend: Organization tab clearly labels the 3 JD-feeding fields
[ ] Frontend: Screening questions drag-to-reorder works
[ ] Frontend: Theme switching works immediately on click
[ ] Tests passing: pytest tests/test_settings.py -v

Commit message: "feat(step-2): settings, org profile, departments, templates, seeding"