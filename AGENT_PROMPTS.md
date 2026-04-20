# AI Talent Lab — Coding Agent Prompts
> These prompts are designed for Claude Code or any agentic coding tool.
> Use them in order. Do not skip steps. Each prompt assumes the previous step is complete and committed.

---

## HOW TO USE THIS

1. Start a new Claude Code session (or equivalent coding agent)
2. Give it the **Master Context Prompt** first — once per project
3. Then give it the **Step 1 Task Prompt** to begin coding
4. When Step 1 is complete and you've reviewed + tested it, give the Step 2 Task Prompt
5. Continue step by step

Do NOT give multiple step prompts at once. Each step depends on the previous one working correctly.

---

## MASTER CONTEXT PROMPT
> Give this ONCE at the very beginning of the project. This orients the agent to everything.
> Copy and paste exactly as written.

---

```
You are the lead engineer building AI Talent Lab — a production-grade, 
conversational AI hiring SaaS platform. Your job is to implement this product 
exactly as documented in the planning files inside the docs/ folder of this 
repository.

== PROJECT OVERVIEW ==

AI Talent Lab is a multi-tenant SaaS where:
- Recruiters create Job Descriptions through an AI chat conversation (not forms)
- The system automatically sources and scores candidates in the background
- Candidates apply via a magic-link chat interface (no account needed)
- Panel members submit interview feedback via magic links (no account needed)
- Everything is scoped per organization (tenant) and per department

The product has already been fully planned. Every architectural decision, 
database schema, API endpoint, UI component, and workflow is documented. 
Your job is to implement — not design.

== DOCUMENTATION ==

All planning documents are in the docs/ folder. Read them before writing any code.
Priority reading order:

1. docs/PRODUCT_PLAN.md       — What we're building, why, all features, build order
2. docs/BACKEND_PLAN.md       — Full DB schema, API endpoints, agent architecture,
                                error recovery, ATS scoring strategy, security, config
3. docs/FRONTEND_PLAN.md      — Component tree, design system, routing, UI/UX standards
4. docs/01_auth.md             — Auth pages (login, register, forgot/reset password)
5. docs/02_chat.md             — Chat window, 5-stage JD generation workflow, error recovery
6. docs/03_dashboard.md        — Dashboard with stats, funnel, positions table, activity feed
7. docs/04_position_detail.md  — Position page with Kanban pipeline, JD, interview kit, settings
8. docs/05_candidate_detail.md — Candidate profile with timeline, skills match, interviews
9. docs/06_settings.md         — Settings page (11 tabs)
10. docs/07_apply.md            — Candidate magic link chat application
11. docs/08_talent_pool.md      — Talent pool with bulk upload and AI suggestions
12. docs/09_career_page.md      — Public career page and job board
13. docs/10_interview_scheduling.md — Interview scheduling and debrief
14. docs/11_panel_feedback.md   — Panel feedback with AI enrichment
15. docs/12_chat_flows.md       — Exact AI conversation scripts for both chats

== TECH STACK ==

Backend:  FastAPI (Python 3.11+), PostgreSQL 16, Celery + Redis,
          LangChain + LangGraph, ChromaDB, JWT + bcrypt
Frontend: React 18 + Vite, Vanilla CSS (custom properties), React Router v6,
          Context API (no Redux)
LLM:      Groq (default), switchable via LLM_PROVIDER env var
Search:   Tavily API
Email:    Simulation adapter (dev), Resend (prod)

== ABSOLUTE RULES — NEVER VIOLATE ==

1. Every DB table that contains business data MUST have org_id INTEGER NOT NULL.
   Tables scoped to a department MUST also have department_id INTEGER NOT NULL.
   Every repository query MUST filter by org_id. This is tenant isolation. No exceptions.

2. All API routes are versioned under /api/v1/. Never /api/ without the version.

3. Three-layer architecture in the backend — NEVER skip layers:
   Routers (HTTP) → Services (business logic) → Repositories (SQL queries)
   Routers never query the DB directly.
   Services never write SQL directly.
   Repositories never contain business logic.

4. Celery + Redis for ALL background tasks from day one. Never FastAPI BackgroundTasks.

5. PostgreSQL everywhere — dev and prod. Docker Compose provides local Postgres.
   Never SQLite. The docker-compose.yml is at the project root.

6. Session state (LangGraph graph_state) MUST be saved to the DB after every 
   successful agent node completion. Users must be able to resume sessions after 
   browser refresh or server restart without losing progress.

7. Magic links are signed JWTs. Apply links expire in 72 hours. Panel feedback 
   links expire in 7 days. They are single-use for panel feedback (marked as 
   submitted). Never expose magic link tokens in logs.

8. Resume content is stored as text in the database (resume_text, resume_parsed, 
   resume_embedding columns). Resume files are NOT stored on disk or in object 
   storage. Extract text on upload, store text, discard the file.

9. JD embeddings are generated once when a position is created and stored in 
   positions.jd_embedding (JSON float array). Resume embeddings are generated 
   once when resume is parsed and stored in candidates.resume_embedding. 
   These are reused — never regenerated unless the source changes.

10. The frontend design system uses CSS custom properties defined in styles/globals.css.
    Pipeline stage colors come from PIPELINE_STAGES constant in utils/constants.js.
    StatusBadge component is the ONLY place pipeline status color logic lives.
    Never define inline status colors in individual components.

== PROJECT STRUCTURE ==

The backend follows exactly the structure in docs/BACKEND_PLAN.md § 2.
The frontend follows exactly the structure in docs/FRONTEND_PLAN.md § 3.
Do not invent new directories or files that aren't in those structures.
If you think a new file is needed, ask before creating it.

== ENVIRONMENT ==

Development environment uses docker-compose.yml at project root.
All configuration is via .env file (copy .env.example to .env for local dev).
The app must start with: docker compose up -d && uvicorn main:app --reload
Zero manual setup steps beyond those two commands.

== QUALITY STANDARDS ==

- Type hints on all Python functions
- Pydantic models for all request/response schemas
- Every repository method handles the case where the entity doesn't exist
- Every API endpoint that mutates data writes to audit_log
- Never expose stack traces or internal error details to API responses
- All user-facing error messages are in the standard format:
  {"error": {"code": "SNAKE_CASE_CODE", "message": "...", "details": null}}
- Skeleton loading states on all data-loading frontend components (no spinners)
- Empty state screens on all list/collection pages (see docs/FRONTEND_PLAN.md § 11)

You have read and understood all of the above. Confirm by saying:
"Ready. I have read the project documentation and understand the architecture, 
rules, and constraints. What should I build first?"

Then wait for the first task prompt.
```

---

## STEP 1 TASK PROMPT — Foundation: Project Structure, DB, Auth
> Give this AFTER the agent has confirmed it read the master context.
> This implements the foundation everything else depends on.

---

```
Begin Step 1: Foundation.

Read docs/BACKEND_PLAN.md §2 (project structure) and §3 (architecture) 
and §16 (database + Docker setup) carefully before writing any code.
Read docs/01_auth.md for the auth pages.

Build the following in this exact order. Commit after each numbered item.

== BACKEND ==

1. Project scaffolding
   Create the complete backend/ folder structure exactly as specified in 
   docs/BACKEND_PLAN.md §2. Create all __init__.py files and empty module 
   files with docstring comments describing what each file will contain.
   Do not write implementation yet — just the structure.

2. docker-compose.yml + .env.example
   Create docker-compose.yml at the project root exactly as specified in 
   docs/BACKEND_PLAN.md §16. Include PostgreSQL 16 and Redis 7.
   Create .env.example with all variables from docs/BACKEND_PLAN.md §10
   with safe placeholder values. Include a comment above each variable 
   explaining what it does and whether it is required.

3. config.py
   Implement using Pydantic BaseSettings exactly as documented in 
   docs/BACKEND_PLAN.md §10. The app MUST fail to start if JWT_SECRET is 
   not set. DATABASE_URL defaults to the Docker local PostgreSQL URL.
   Include a REDIS_URL setting.

4. Database connection (db/connection.py)
   Implement async PostgreSQL connection using asyncpg or SQLAlchemy async.
   Connection pool. Health check function. Context manager for transactions.
   On startup, run db/migrations.py to create all tables.

5. Database migrations (db/migrations.py)
   Implement ALL CREATE TABLE statements from docs/BACKEND_PLAN.md §4 
   (sections 4.1 through 4.5). Every table. Every column. Every constraint.
   Including the two schema additions from §15 (jd_embedding, resume_embedding 
   on positions and candidates tables) and §12 (followup_sent_at, 
   followup_delay_hours).
   
   Use IF NOT EXISTS on all CREATE TABLE statements so migrations are 
   idempotent — safe to run on every app startup.
   
   After creating tables, enable PostgreSQL Row-Level Security on all 
   tenant-scoped tables as documented in docs/BACKEND_PLAN.md §9.

6. exceptions.py
   Define all custom exception classes and the global FastAPI exception handler.
   Every exception must produce the standard error format:
   {"error": {"code": "SNAKE_CASE", "message": "...", "details": null}}
   Error codes: INVALID_CREDENTIALS, TOKEN_EXPIRED, INSUFFICIENT_PERMISSIONS,
   ACCOUNT_LOCKED, NOT_FOUND, ALREADY_EXISTS, VALIDATION_ERROR,
   POSITION_CLOSED, MAGIC_LINK_EXPIRED, MAGIC_LINK_USED,
   CANDIDATE_ALREADY_APPLIED, FEEDBACK_ALREADY_SUBMITTED,
   LLM_ERROR, SEARCH_ERROR, EMAIL_ERROR, UPLOAD_ERROR

7. middleware/
   Implement all four middleware files:
   - cors.py: CORS with FRONTEND_URL whitelist from config
   - rate_limiter.py: 100 req/min per IP, 10 auth attempts/min (use slowapi)
   - request_logger.py: Log every request with correlation ID, user_id if authed,
     endpoint, method, status code, response time in milliseconds
   - tenant_context.py: Decode JWT, extract org_id + dept_id + role, set on 
     request.state. Also executes "SET LOCAL app.current_org_id = :id" for RLS.
     Raise TOKEN_EXPIRED or INVALID_CREDENTIALS if token is invalid.

8. utils/security.py
   Implement: bcrypt password hashing (12 rounds), JWT encode/decode with 
   org_id + dept_id + role + exp claims, magic link token generation 
   (signed JWT with type + entity_id + exp), token verification with 
   proper expiry checking and error raising.

9. dependencies.py
   Implement FastAPI Depends() functions:
   - get_db(): yields async DB connection
   - get_current_user(): decodes JWT from Authorization header, returns user dict
   - require_admin(): get_current_user + assert role == 'admin'
   - verify_apply_token(token): validates apply magic link JWT
   - verify_panel_token(token): validates panel magic link JWT

10. db/repositories/users.py and db/repositories/organizations.py
    Implement full CRUD for users and organizations.
    All queries parameterized. All queries filter by org_id.
    Methods needed:
    - UserRepository: create, get_by_id, get_by_email, update, deactivate,
      list_by_org, update_failed_login_attempts, lock_account
    - OrgRepository: create, get_by_id, get_by_slug, update

11. Auth router + service (routers/auth.py + services/auth_service.py)
    Implement all endpoints from docs/BACKEND_PLAN.md §5 under Auth section:
    POST /api/v1/auth/register
    POST /api/v1/auth/login
    GET  /api/v1/auth/me
    GET  /api/v1/auth/users          (admin only)
    POST /api/v1/auth/add-user       (admin only)
    PATCH /api/v1/auth/users/{id}    (admin only)
    PATCH /api/v1/auth/profile
    POST /api/v1/auth/change-password
    POST /api/v1/auth/forgot-password
    POST /api/v1/auth/reset-password
    
    Register flow: create org + create admin user in one transaction.
    Auto-generate org slug from org name (lowercase, spaces→hyphens, 
    strip special chars, max 50 chars, ensure uniqueness by appending -2, -3 etc).
    
    Login: bcrypt verify, account lockout after 5 failures (15 min),
    return JWT + user object.
    
    Password rules: min 8 chars, 1 uppercase, 1 number, 1 special char.
    Validate in utils/validators.py, reuse across register and change-password.
    
    Forgot password: send email via email adapter (simulation in dev).
    Reset token valid 24 hours. Never leak whether email exists.

12. main.py
    FastAPI app factory. Register all middleware. Register auth router.
    Startup event: run migrations, verify DB connection.
    GET /api/v1/health endpoint: returns {status, db, version, timestamp}.
    GET / endpoint: returns {status: "ok"}.

== FRONTEND ==

13. Project scaffolding (Vite + React)
    Create frontend/ with the structure from docs/FRONTEND_PLAN.md §3.
    Install dependencies: react-router-dom, axios, react-markdown, remark-gfm.
    Create all component files as empty stubs with a comment: 
    "// TODO: Implement — see docs/[relevant_doc].md"

14. Design system (styles/globals.css)
    Implement ALL CSS custom properties from docs/FRONTEND_PLAN.md §2:
    - All background, text, accent, border, shadow variables
    - All pipeline stage colors (PIPELINE_STAGES)
    - All spacing, radius, layout tokens
    - Typography tokens
    - Light theme overrides
    - DM Sans + DM Mono fonts from Google Fonts

15. utils/constants.js
    Implement PIPELINE_STAGES object with label, color, bg for all 8 stages
    (sourced, emailed, applied, screening, interview, selected, rejected, on_hold).
    
16. common/Badge.jsx (StatusBadge)
    Implement StatusBadge component exactly as documented in 
    docs/FRONTEND_PLAN.md §11.2. This is the ONLY place pipeline status 
    colors are defined. Uses PIPELINE_STAGES from constants.js.

17. common/EmptyState.jsx
    Implement reusable EmptyState component from docs/FRONTEND_PLAN.md §11.3.
    Accept: icon, title, description, actions props.

18. common/SkeletonCard.jsx
    Implement shimmer skeleton component. Accept: lines (number of lines).
    Shimmer animation using CSS. Used on all loading states.

19. AuthContext + useAuth hook
    Implement AuthContext.jsx: token, user, login(), logout(), isAuthenticated.
    Store token in memory (not localStorage for security).
    On app load, check for token, redirect to /login if missing.
    useAuth.js hook that consumes AuthContext.

20. Login and Register pages (components/Auth/)
    Implement LoginPage.jsx and RegisterPage.jsx exactly per docs/01_auth.md.
    Login: email + password, show/hide password, loading state, error handling,
    lockout message (show time remaining).
    Register: two-section form (org + admin account), org slug live preview,
    password strength indicator, all validation from docs/01_auth.md.
    
    Both pages: centered glass card on gradient background, DM Sans font.

21. router.jsx + App.jsx
    Set up React Router v6 with all routes from docs/FRONTEND_PLAN.md §4.
    AuthGuard component: redirects to /login if not authenticated.
    PublicLayout component: no sidebar, used for apply/panel/careers pages.
    AppLayout component: sidebar + topbar, used for authenticated pages.
    Implement basic Sidebar.jsx with navigation links and session list stubs.

== DONE CRITERIA ==

Step 1 is complete when:
[ ] docker compose up -d starts Postgres + Redis with no errors
[ ] All database tables are created on first app startup (check with psql)
[ ] PostgreSQL RLS policies are applied to all tenant tables
[ ] POST /api/v1/auth/register creates org + admin user, returns JWT
[ ] POST /api/v1/auth/login authenticates and returns JWT
[ ] GET /api/v1/auth/me returns current user with org data (requires valid JWT)
[ ] GET /api/v1/health returns {status: "ok", db: "connected", version: "1.0.0"}
[ ] Account lockout triggers after 5 failed logins
[ ] Org slug is auto-generated and unique
[ ] Frontend: npm run dev starts with no errors
[ ] Frontend: /login page renders correctly with DM Sans font
[ ] Frontend: /register page renders with org slug live preview
[ ] Frontend: Login submits to backend and stores token, redirects to /
[ ] Frontend: Invalid credentials shows correct error message
[ ] Frontend: All CSS custom properties are defined and loading
[ ] No TypeScript — pure JavaScript + JSX throughout

Do not proceed to Step 2 until all Done Criteria are checked.
Run the test suite before marking complete:
  cd backend && pytest tests/test_auth.py -v

Commit message when done: "feat(step-1): foundation - auth, DB schema, project structure"
```

---

## STEP 2 TASK PROMPT — Settings & Organization Configuration
> Give this AFTER Step 1 is complete, committed, and tested.

---

```
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
```

---

## STEP 3 TASK PROMPT — Recruiter Chat + JD Generation
> Give this AFTER Step 2 is complete, committed, and tested.

---

```
Step 2 is complete. Begin Step 3: Recruiter Chat and JD Generation.

Read ALL of these before writing any code:
- docs/02_chat.md           (full chat UI behavior, all 5 stages, error recovery)
- docs/12_chat_flows.md     (exact AI conversation scripts for each stage)
- docs/BACKEND_PLAN.md §6   (agent architecture, SSE format, LangGraph state)
- docs/BACKEND_PLAN.md §14  (agent error recovery — every node failure mode)

This is the core of the product. Take your time. The chat workflow must be exactly
right — stages, cards, error handling, session persistence.

== BACKEND ==

1. LLM factory (adapters/llm/factory.py)
   Implement get_llm() returning the correct LLM based on LLM_PROVIDER env var.
   Support: groq (ChatGroq), openai (ChatOpenAI), gemini (ChatGoogleGenerativeAI).
   Implement get_embedding_model() per docs/BACKEND_PLAN.md §15.
   Both functions read from config settings. No hardcoding.

2. Agent tools (agents/tools/)
   - search.py: Tavily search wrapper. Takes query string, returns structured results.
     Handles Tavily API errors gracefully — raise SearchError, caller handles skip.
   - role_extractor.py: Takes a free-text message, returns extracted job title.
     Uses LLM with a short prompt. Falls back to None if extraction fails.

3. Agent state (agents/state.py)
   Implement AgentState TypedDict exactly as documented in docs/BACKEND_PLAN.md §6.
   Include ALL fields: session_id, org_id, department_id, user_id, role_name,
   skills_required, internal_skills_found, internal_skills_accepted,
   market_skills_found, market_skills_accepted, jd_variants, selected_variant,
   final_jd, bias_issues, stage, messages, awaiting_user_input, error fields,
   skip tracking fields (internal_skipped, market_skipped, bias_skipped),
   retry_count, error_stage, error_code, error_message.

4. Agent prompts (agents/prompts/)
   Write system prompt files for each node based on docs/12_chat_flows.md:
   - interviewer.md: Intake agent. Extracts requirements via conversation.
     Ask max 2-3 questions per turn. Never dump all questions at once.
     Detect when minimum requirements are met (role, experience, skills, work type).
     Output a structured summary for user confirmation before proceeding.
   - internal_analyst.md: Given past JD embeddings from ChromaDB, identify
     skills used in similar past roles that aren't in current requirements.
   - market_intelligence.md: Given competitors and a web search tool,
     find what skills top companies emphasize for this role.
   - benchmarking.md: Compare market findings against current requirements,
     rank and filter suggestions by relevance.
   - drafting.md: Generate 3 JD style variants (skill_focused, outcome_focused,
     hybrid) then generate the final selected JD. Include About Us from org settings.
   - bias_checker.md: Scan JD text for potentially exclusionary language.
     Return specific phrases and suggested replacements. Be concise.

5. Individual agent nodes (agents/nodes/)
   Implement each node as a pure async function: state_in → state_out.
   
   - interviewer.py: intake conversation logic. Detect completion.
     Save state checkpoint after completion.
   
   - internal_analyst.py: Query ChromaDB vector_store for similar past JDs.
     Extract skills not in current requirements. Return as internal_skills_found.
     SOFT SKIP: on any ChromaDB error, set internal_skipped=True, return state unchanged.
     Save state checkpoint on success.
   
   - market_intelligence.py + benchmarking.py: Use Tavily search tool.
     SOFT SKIP: on any Tavily error or no competitors, set market_skipped=True.
     Save state checkpoint on success.
   
   - drafting.py: Two modes — generate_variants and generate_final.
     HARD STOP: retry once on failure. On second failure raise LLM_ERROR.
     Pull org About Us + culture + benefits from org settings (org_id in state).
     For generate_final: Stream tokens via the streaming callback.
     Save state checkpoint after variants, after final JD.

6. Streaming (agents/streaming.py)
   SSE event generator. Formats all events exactly as in docs/BACKEND_PLAN.md §6:
   token, stage_change, card_internal, card_market, card_variants, card_bias,
   jd_token, metadata, done, error, stage_skipped, stream_interrupted.
   
   Handles async generator pattern for FastAPI StreamingResponse.

7. Bias checker (agents/bias_checker.py)
   Standalone async function, not a LangGraph node.
   Takes JD text string, returns list of {phrase, suggestion} dicts.
   SOFT SKIP: on any error, return empty list silently.

8. LangGraph orchestrator (agents/orchestrator.py)
   Build the full LangGraph state machine:
   INTAKE → INTERNAL_CHECK → MARKET_RESEARCH → JD_VARIANTS → FINAL_JD → BIAS_CHECK → COMPLETE
   
   Implement state routing (conditional edges based on stage and user input).
   Implement the "human in the loop" pause points — the graph pauses after
   INTERNAL_CHECK card and MARKET_RESEARCH card waiting for user acceptance/skip.
   
   Error recovery per docs/BACKEND_PLAN.md §14:
   - Soft skip nodes (internal, market, bias) must catch all exceptions and skip
   - Hard stop nodes (variants, final_jd) retry once, then surface error SSE event
   
   State persistence: call save_state_checkpoint after every node completion.

9. ChromaDB vector store (db/vector_store.py)
   Implement:
   - init_chroma(): initialize persistent ChromaDB client (data/chroma/)
   - embed_jd(position_id, jd_text, role_name, department): embed and store JD
   - search_similar(query_text, org_id, department_id, top_k=5): 
     find similar past JDs within same org/dept
   - delete_jd(position_id): remove JD from index (on position delete)

10. Chat sessions repository (db/repositories/sessions.py)
    Implement ChatSessionRepository:
    - create(org_id, dept_id, user_id, title) → session
    - get(session_id, user_id) → session with graph_state
    - update_state(session_id, stage, graph_state) → checkpoint save
    - update_title(session_id, title)
    - link_position(session_id, position_id)
    - list_by_user(user_id, org_id) → list for sidebar
    - delete(session_id, user_id)

11. Chat router + service (routers/chat.py + services/chat_service.py)
    Implement all chat endpoints from docs/BACKEND_PLAN.md §5:
    POST /api/v1/chat/stream          — SSE streaming endpoint
    GET  /api/v1/chat/sessions        — sidebar list
    GET  /api/v1/chat/sessions/{id}   — full session restore
    DELETE /api/v1/chat/sessions/{id}
    PATCH /api/v1/chat/sessions/{id}/title
    POST /api/v1/chat/sessions/{id}/upload    — reference JD upload
    POST /api/v1/chat/sessions/{id}/save-position — saves position, triggers search
    
    The /stream endpoint:
    - Creates session if first message (no session_id in request)
    - Restores graph state if continuing existing session
    - Runs orchestrator, yields SSE events
    - On save-position: creates position record, generates JD embedding (async),
      embeds JD in ChromaDB, queues Celery task for candidate search

== FRONTEND ==

12. Chat context (context/ChatContext.jsx)
    Implement ChatContext with: sessions list, current session, messages,
    isStreaming, workflowStage, sendMessage(), loadSession(), deleteSession().
    SSE connection management: connect on message send, disconnect on done/error.
    Parse all event types from docs/BACKEND_PLAN.md §6 SSE format.

13. Chat page skeleton (components/Chat/ChatPage.jsx)
    Full-height layout: topbar + message list + input.
    Load existing session on mount if sessionId in URL param.
    
14. Chat top bar (components/Chat/ChatTopBar.jsx)
    Editable title (contenteditable). Stage indicator pill with correct 
    color per stage. "Discard" button (unsaved sessions only).
    "Save & Find Candidates" button — disabled until stage === 'complete'.

15. Message list + bubbles (components/Chat/MessageList.jsx + MessageBubble.jsx)
    User messages: right-aligned, accent color.
    AI messages: left-aligned, secondary bg, markdown rendered.
    System messages: centered, muted text, smaller font.
    Typing indicator: 3-dot pulsing animation BEFORE first token arrives.
    (see docs/FRONTEND_PLAN.md §11.1 for exact implementation)
    Auto-scroll to bottom on new messages.

16. Streaming text (components/Chat/StreamedText.jsx)
    Renders streaming tokens with blinking cursor while streaming.
    Cursor disappears on done event.

17. Message input (components/Chat/MessageInput.jsx)
    Textarea: auto-resize to 5 lines, Enter=send, Shift+Enter=newline.
    Disabled state during streaming with "AI is thinking..." placeholder.
    File upload button (📎): PDF/DOCX only, max 10MB.
    Send button: spinner during streaming.

18. Chat cards (components/Chat/cards/)
    Implement all 5 interactive stage cards exactly per docs/02_chat.md:
    
    InternalCheckCard.jsx: selectable skill chips with source year labels.
    "Accept Selected (N)" button updates count as chips are toggled.
    After action: collapses to read-only summary line.
    
    MarketResearchCard.jsx: same pattern, shows competitor names.
    
    JDVariantsCard.jsx: 3 side-by-side cards. Color-coded header per variant
    (blue=skill-focused, green=outcome-focused, purple=hybrid). 
    Preview expand button. Edit button (textarea). Select This → button.
    
    FinalJDCard.jsx: streams JD markdown with StreamedText.
    Edit/Copy/Download buttons. "Save & Find Candidates" CTA button.
    
    BiasCheckCard.jsx: warning-colored border. Per-phrase Fix buttons.
    Dismiss button. Never blocks saving.

19. Position Setup Modal (components/Chat/PositionSetupModal.jsx)
    Opens when "Save & Find Candidates" clicked.
    Fields: openings count, search frequency, ATS threshold, priority, department.
    Calls POST /api/v1/chat/sessions/{id}/save-position on confirm.
    On success: navigate to /positions/:id with success toast.

20. Sidebar sessions list (components/Sidebar/SidebarSessions.jsx)
    List of chat sessions from GET /api/v1/chat/sessions.
    Solid dot = position saved. Gray dot = incomplete.
    Active session highlighted.
    Right-click or hover shows Rename/Delete options.

== DONE CRITERIA ==

[ ] POST /api/v1/chat/stream returns SSE events for all 5 stages
[ ] stage_change events fire correctly as workflow progresses
[ ] card_internal event fires with skills from ChromaDB (or skips if empty)
[ ] card_market event fires with competitor skills (or skips if Tavily fails)
[ ] card_variants event fires with 3 variant objects
[ ] jd_token events stream the final JD
[ ] card_bias event fires after final JD (or silently skipped)
[ ] Session state is saved to DB after each stage completion
[ ] Browser refresh on mid-chat session correctly restores state
[ ] POST /api/v1/chat/sessions/{id}/save-position creates position record
[ ] JD embedding stored in positions.jd_embedding on save
[ ] Reference JD upload extracts text and feeds into intake stage
[ ] Frontend: Chat opens with greeting message
[ ] Frontend: Typing indicator shows before first AI token
[ ] Frontend: All 5 stage cards render and are interactive
[ ] Frontend: Stage pill updates as workflow progresses
[ ] Frontend: Position setup modal opens and submits correctly
[ ] Frontend: Navigates to /positions/:id after save
[ ] Error recovery: Tavily failure silently skips market research
[ ] Error recovery: LLM failure on variants shows retry button
[ ] Tests passing: pytest tests/test_chat.py -v

Commit message: "feat(step-3): recruiter chat, LangGraph JD generation, all 5 stages"
```

---

## STEP 4 TASK PROMPT — Candidate Sourcing, ATS Scoring, Pipeline
> Brief version — expand same as Steps 1-3

```
Step 3 is complete. Begin Step 4: Candidate Sourcing, Scoring, and Pipeline.

Read: docs/04_position_detail.md, docs/05_candidate_detail.md, 
docs/BACKEND_PLAN.md §8 (background tasks), §15 (semantic ATS scoring).

Build:
1. CandidateSourceAdapter ABC + SimulationAdapter (realistic generated candidates)
2. db/repositories/candidates.py + applications.py + pipeline_events.py
3. tasks/candidate_pipeline.py Celery task (source → dedup → score → notify)
4. Semantic ATS scoring (embedding cosine similarity + LLM structured analysis)
   per docs/BACKEND_PLAN.md §15 exactly — two-step approach
5. Positions router + service (CRUD, search-now, status management)
6. Candidates router + service (list, detail, status update, bulk outreach, draft/send rejection, mark-selected)
7. Dashboard pipeline endpoint (GET /api/v1/dashboard/pipeline/:id for Kanban)
8. Frontend: PositionDetailPage with all 6 tabs (Pipeline, Candidates, JD, Interview Kit, Activity, Settings)
9. Frontend: PipelineTab Kanban board with stage-colored columns
10. Frontend: CandidatesTab list with bulk actions
11. Frontend: CandidateDetailPage with all 5 tabs
12. Frontend: SkillsMatchTab showing score arc, matched/missing/extra skills,
    trajectory analysis, red flags (docs/FRONTEND_PLAN.md §11.4 for ScoreCircle)
13. Frontend: TimelineTab — unified event feed from pipeline_events table

Done: position search triggers Celery task, candidates appear in pipeline,
ATS scores compute correctly, Kanban renders with correct stage colors.
Commit: "feat(step-4): candidate sourcing, semantic ATS, pipeline management"
```

---

## STEP 5–9 TASK PROMPTS (Summaries)

### Step 5 — Candidate Apply Chat
```
Read docs/07_apply.md and docs/12_chat_flows.md §Part 2 (candidate flow).
Build: magic link generation + delivery, candidate_sessions table, CandidateChat 
linear controller (agents/candidate_chat.py), apply router (public),
resume text extraction (pdfplumber + python-docx), resume parsing + embedding,
interview process overview email on completion.
Frontend: ApplyPage chat interface (mobile-first), all 8 steps per docs/07_apply.md.
Commit: "feat(step-5): candidate apply chat, resume extraction, magic links"
```

### Step 6 — Interviews, Panel Feedback, Rejection
```
Read docs/10_interview_scheduling.md, docs/11_panel_feedback.md.
Build: interviews table CRUD, interview_panel magic links, panel feedback router (public),
feedback_enricher agent (AI enriches rough notes), scorecards storage, 
rejection_drafter agent, debrief_generator agent.
Frontend: ScheduleInterviewModal, InterviewsTab on candidate page with scorecards,
PanelPage (mobile-first), AI Enrich button, star ratings.
Commit: "feat(step-6): interviews, panel feedback, rejection, debrief"
```

### Step 7 — Talent Pool
```
Read docs/08_talent_pool.md.
Build: auto-pool rules (trigger on reject/close/archive), bulk upload endpoint 
(extract text, parse, embed, dedup, return results), talent_pool router + service,
AI suggest (cosine similarity against position JD embedding).
Frontend: TalentPoolPage with bulk upload zone FIRST, AI suggestions panel,
candidate cards with tags.
Commit: "feat(step-7): talent pool, bulk upload, AI suggestions"
```

### Step 8 — Dashboard & Analytics
```
Read docs/03_dashboard.md.
Build: dashboard service (stats aggregation, funnel from pipeline_events,
activity feed, positions with counts), all 5 dashboard endpoints.
Frontend: full DashboardPage — stats cards with period selector, animated 
funnel bars, positions table with filters, activity feed polling.
Empty state: first-impression screen for new orgs (docs/FRONTEND_PLAN.md §11.3).
Commit: "feat(step-8): dashboard, analytics, funnel, activity feed"
```

### Step 9 — Interview Kit, Career Page, Notifications
```
Read docs/09_career_page.md, docs/PRODUCT_PLAN.md §7 (Interview Kit).
Build: interview_kit agent (questions + scorecard from JD), interview_kits table,
interview kit router, careers router (public, SEO meta tags), 
notifications table + service, notification bell polling.
Frontend: InterviewKitTab on position page, CareerPage (public, mobile-first),
NotificationBell dropdown, empty states for no notifications.
Commit: "feat(step-9): interview kit, career page, notifications"
```

---

## GENERAL RULES FOR THE CODING AGENT
> Remind the agent of these when starting any new step.

```
Before writing any code for this step:
1. Read the relevant docs listed at the top of this prompt
2. Check what already exists — do not reimplement things from earlier steps
3. Run existing tests to confirm nothing is broken before starting
4. If you find a conflict between docs and existing code, stop and ask

While writing code:
- Follow the 3-layer architecture strictly
- Every new DB query must filter by org_id
- Every new endpoint must be under /api/v1/
- Write tests in tests/ alongside implementation, not as an afterthought
- Commit after each numbered item — small commits, not one big commit at the end

If you are unsure about any behavior:
- Check the relevant page doc (01_auth.md through 12_chat_flows.md)
- Check BACKEND_PLAN.md for the API contract
- Check FRONTEND_PLAN.md for the component spec
- Ask me rather than guess
```
