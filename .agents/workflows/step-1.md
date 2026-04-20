---
description: TASK PROMPT — Foundation: Project Structure, DB, Auth
---

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