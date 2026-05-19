"""
db/migrations.py – ALL CREATE TABLE statements.
Implements every table from docs/BACKEND_PLAN.md §4 (sections 4.1–4.5).
Includes schema additions from §12 (followup) and §15 (embeddings).
Uses IF NOT EXISTS — safe to run on every app startup.
After tables, enables PostgreSQL Row-Level Security on tenant-scoped tables.
"""
import logging

logger = logging.getLogger(__name__)


# ── 4.1 Foundation Tables ──────────────────────────────────────────────────────

FOUNDATION_TABLES = """
-- Organizations (Tenants)
CREATE TABLE IF NOT EXISTS organizations (
    id               SERIAL PRIMARY KEY,
    name             TEXT NOT NULL UNIQUE,
    slug             TEXT NOT NULL UNIQUE,
    segment          TEXT NOT NULL,
    size             TEXT NOT NULL,
    website          TEXT,
    about_us         TEXT,
    logo_url         TEXT,
    culture_keywords TEXT,
    benefits_text    TEXT,
    headquarters     TEXT,
    linkedin_url     TEXT,
    glassdoor_url    TEXT,
    hiring_contact_email TEXT,
    created_at       TIMESTAMP DEFAULT NOW()
);

-- Departments
CREATE TABLE IF NOT EXISTS departments (
    id               SERIAL PRIMARY KEY,
    org_id           INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    description      TEXT,
    parent_dept_id   INTEGER REFERENCES departments(id),
    head_user_id     INTEGER,
    created_at       TIMESTAMP DEFAULT NOW(),
    UNIQUE(org_id, name)
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id               SERIAL PRIMARY KEY,
    org_id           INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    department_id    INTEGER REFERENCES departments(id),
    email            TEXT NOT NULL UNIQUE,
    password_hash    TEXT NOT NULL,
    role             TEXT NOT NULL DEFAULT 'recruiter',
    name             TEXT NOT NULL,
    phone            TEXT,
    avatar_url       TEXT,
    timezone         TEXT DEFAULT 'Asia/Kolkata',
    is_active        BOOLEAN DEFAULT TRUE,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until     TIMESTAMP,
    last_login_at    TIMESTAMP,
    created_at       TIMESTAMP DEFAULT NOW()
);

-- Competitors
CREATE TABLE IF NOT EXISTS competitors (
    id               SERIAL PRIMARY KEY,
    org_id           INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    website          TEXT,
    industry         TEXT,
    notes            TEXT,
    is_active        BOOLEAN DEFAULT TRUE,
    UNIQUE(org_id, name)
);

-- Screening Questions
CREATE TABLE IF NOT EXISTS screening_questions (
    id               SERIAL PRIMARY KEY,
    org_id           INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    department_id    INTEGER REFERENCES departments(id),
    field_key        TEXT NOT NULL,
    label            TEXT NOT NULL,
    field_type       TEXT NOT NULL DEFAULT 'text',
    options          TEXT,
    is_required      BOOLEAN DEFAULT FALSE,
    sort_order       INTEGER DEFAULT 0,
    is_active        BOOLEAN DEFAULT TRUE,
    created_at       TIMESTAMP DEFAULT NOW()
);

-- Message Templates
CREATE TABLE IF NOT EXISTS message_templates (
    id               SERIAL PRIMARY KEY,
    org_id           INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    category         TEXT NOT NULL,
    subject          TEXT,
    body             TEXT NOT NULL,
    is_default       BOOLEAN DEFAULT FALSE,
    is_active        BOOLEAN DEFAULT TRUE,
    created_at       TIMESTAMP DEFAULT NOW()
);

-- Scorecard Templates
CREATE TABLE IF NOT EXISTS scorecard_templates (
    id               SERIAL PRIMARY KEY,
    org_id           INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    dimensions       TEXT NOT NULL,
    is_default       BOOLEAN DEFAULT FALSE,
    created_at       TIMESTAMP DEFAULT NOW()
);
"""

# ── 4.5 Chat Session Tables (must come before positions which references chat_sessions) ──

CHAT_TABLES = """
-- Recruiter JD creation sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
    id               TEXT PRIMARY KEY,
    org_id           INTEGER REFERENCES organizations(id),
    department_id    INTEGER REFERENCES departments(id),
    user_id          INTEGER REFERENCES users(id),
    position_id      INTEGER,
    title            TEXT NOT NULL DEFAULT 'New Hire',
    workflow_stage   TEXT DEFAULT 'intake',
    graph_state      TEXT DEFAULT '{}',
    created_at       TIMESTAMP DEFAULT NOW(),
    updated_at       TIMESTAMP DEFAULT NOW()
);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id               SERIAL PRIMARY KEY,
    session_id       TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role             TEXT NOT NULL,
    content          TEXT NOT NULL DEFAULT '',
    extras           TEXT DEFAULT '{}',
    created_at       TIMESTAMP DEFAULT NOW()
);

-- Candidate magic link apply sessions
CREATE TABLE IF NOT EXISTS candidate_sessions (
    id               SERIAL PRIMARY KEY,
    org_id           INTEGER NOT NULL REFERENCES organizations(id),
    candidate_id     INTEGER REFERENCES candidates(id),
    application_id   INTEGER UNIQUE REFERENCES candidate_applications(id),
    session_state    TEXT DEFAULT '{}',
    messages         TEXT DEFAULT '[]',
    status           TEXT DEFAULT 'active',
    completed_at     TIMESTAMP,
    created_at       TIMESTAMP DEFAULT NOW(),
    updated_at       TIMESTAMP DEFAULT NOW()
);

-- Candidate session messages (detailed log)
CREATE TABLE IF NOT EXISTS candidate_session_messages (
    id               SERIAL PRIMARY KEY,
    session_id       INTEGER NOT NULL REFERENCES candidate_sessions(id) ON DELETE CASCADE,
    role             TEXT NOT NULL,
    content          TEXT NOT NULL,
    created_at       TIMESTAMP DEFAULT NOW()
);
"""

# ── 4.2 Hiring Tables ─────────────────────────────────────────────────────────

HIRING_TABLES = """
-- Positions
CREATE TABLE IF NOT EXISTS positions (
    id                    SERIAL PRIMARY KEY,
    org_id                INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    department_id         INTEGER NOT NULL REFERENCES departments(id),
    session_id            TEXT REFERENCES chat_sessions(id),
    role_name             TEXT NOT NULL,
    jd_markdown           TEXT,
    jd_variant_selected   TEXT,
    jd_embedding          TEXT,
    status                TEXT DEFAULT 'draft',
    priority              TEXT DEFAULT 'normal',
    headcount             INTEGER DEFAULT 1,
    location              TEXT,
    work_type             TEXT DEFAULT 'onsite',
    employment_type       TEXT DEFAULT 'full_time',
    experience_min        INTEGER,
    experience_max        INTEGER,
    salary_min            REAL,
    salary_max            REAL,
    currency              TEXT DEFAULT 'INR',
    ats_threshold         REAL DEFAULT 80.0,
    search_interval_hours INTEGER DEFAULT 24,
    last_search_at        TIMESTAMP,
    next_search_at        TIMESTAMP,
    deadline              TEXT,
    is_on_career_page     BOOLEAN DEFAULT TRUE,
    followup_delay_hours  INTEGER DEFAULT 48,
    created_by            INTEGER REFERENCES users(id),
    assigned_to           INTEGER REFERENCES users(id),
    created_at            TIMESTAMP DEFAULT NOW(),
    updated_at            TIMESTAMP DEFAULT NOW(),
    closed_at             TIMESTAMP
);

-- JD Variants
CREATE TABLE IF NOT EXISTS jd_variants (
    id               SERIAL PRIMARY KEY,
    position_id      INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
    variant_type     TEXT NOT NULL,
    summary          TEXT NOT NULL,
    content          TEXT NOT NULL,
    is_selected      BOOLEAN DEFAULT FALSE,
    created_at       TIMESTAMP DEFAULT NOW()
);

-- Candidates
CREATE TABLE IF NOT EXISTS candidates (
    id                   SERIAL PRIMARY KEY,
    org_id               INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                 TEXT,
    email                TEXT,
    phone                TEXT,
    current_title        TEXT,
    current_company      TEXT,
    experience_years     INTEGER,
    location             TEXT,
    resume_url           TEXT,
    resume_text          TEXT,
    resume_parsed        TEXT,
    resume_embedding     TEXT,
    source               TEXT DEFAULT 'manual',
    source_profile_url   TEXT,
    in_talent_pool       BOOLEAN DEFAULT FALSE,
    talent_pool_reason   TEXT,
    talent_pool_added_at TIMESTAMP,
    notes                TEXT,
    created_at           TIMESTAMP DEFAULT NOW(),
    updated_at           TIMESTAMP DEFAULT NOW(),
    UNIQUE(org_id, email)
);

-- Candidate Applications
CREATE TABLE IF NOT EXISTS candidate_applications (
    id                    SERIAL PRIMARY KEY,
    candidate_id          INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    position_id           INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
    org_id                INTEGER NOT NULL REFERENCES organizations(id),
    department_id         INTEGER NOT NULL REFERENCES departments(id),
    skill_match_score     REAL,
    skill_match_data      TEXT,
    status                TEXT DEFAULT 'sourced',
    applied_at            TIMESTAMP,
    screening_responses   TEXT,
    magic_link_token      TEXT UNIQUE,
    magic_link_sent_at    TIMESTAMP,
    magic_link_clicked_at TIMESTAMP,
    magic_link_expires_at TIMESTAMP,
    rejection_draft       TEXT,
    rejection_sent_at     TIMESTAMP,
    followup_sent_at      TIMESTAMP,
    created_at            TIMESTAMP DEFAULT NOW(),
    updated_at            TIMESTAMP DEFAULT NOW(),
    UNIQUE(candidate_id, position_id)
);
"""

# ── 4.3 Interview & Feedback Tables ───────────────────────────────────────────

INTERVIEW_TABLES = """
-- Interviews
CREATE TABLE IF NOT EXISTS interviews (
    id               SERIAL PRIMARY KEY,
    org_id           INTEGER NOT NULL REFERENCES organizations(id),
    department_id    INTEGER NOT NULL REFERENCES departments(id),
    position_id      INTEGER NOT NULL REFERENCES positions(id),
    candidate_id     INTEGER NOT NULL REFERENCES candidates(id),
    application_id   INTEGER NOT NULL REFERENCES candidate_applications(id),
    round_number     INTEGER NOT NULL DEFAULT 1,
    round_name       TEXT,
    round_type       TEXT DEFAULT 'technical',
    scheduled_at     TIMESTAMP,
    duration_minutes INTEGER DEFAULT 60,
    meeting_link     TEXT,
    status           TEXT DEFAULT 'pending',
    overall_result   TEXT,
    invite_sent_at   TIMESTAMP,
    notes            TEXT,
    ai_summary       TEXT,
    created_at       TIMESTAMP DEFAULT NOW(),
    updated_at       TIMESTAMP DEFAULT NOW()
);

-- Interview Panel
CREATE TABLE IF NOT EXISTS interview_panel (
    id                    SERIAL PRIMARY KEY,
    interview_id          INTEGER NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    user_id               INTEGER REFERENCES users(id),
    panelist_name         TEXT NOT NULL,
    panelist_email        TEXT NOT NULL,
    magic_link_token      TEXT UNIQUE,
    magic_link_expires_at TIMESTAMP,
    feedback_submitted    BOOLEAN DEFAULT FALSE,
    not_attended          BOOLEAN DEFAULT FALSE,
    invite_sent_at        TIMESTAMP,
    created_at            TIMESTAMP DEFAULT NOW()
);

-- Scorecards
CREATE TABLE IF NOT EXISTS scorecards (
    id                  SERIAL PRIMARY KEY,
    interview_id        INTEGER NOT NULL REFERENCES interviews(id),
    panel_member_id     INTEGER NOT NULL REFERENCES interview_panel(id),
    candidate_id        INTEGER NOT NULL REFERENCES candidates(id),
    position_id         INTEGER NOT NULL REFERENCES positions(id),
    org_id              INTEGER NOT NULL REFERENCES organizations(id),
    is_draft            BOOLEAN DEFAULT FALSE,
    ratings             TEXT NOT NULL,
    overall_score       REAL,
    recommendation      TEXT,
    strengths           TEXT,
    concerns            TEXT,
    additional_comments TEXT,
    raw_notes_strengths TEXT,
    raw_notes_concerns  TEXT,
    submitted_at        TIMESTAMP DEFAULT NOW(),
    UNIQUE(interview_id, panel_member_id)
);

-- Interview Kits
CREATE TABLE IF NOT EXISTS interview_kits (
    id                  SERIAL PRIMARY KEY,
    position_id         INTEGER NOT NULL UNIQUE REFERENCES positions(id),
    org_id              INTEGER NOT NULL REFERENCES organizations(id),
    questions           TEXT NOT NULL,
    scorecard_template  TEXT,
    generated_at        TIMESTAMP DEFAULT NOW(),
    regenerated_count   INTEGER DEFAULT 0
);
"""

# ── 4.4 Event, Notification & System Tables ───────────────────────────────────

EVENT_TABLES = """
-- Pipeline Events (immutable log)
CREATE TABLE IF NOT EXISTS pipeline_events (
    id               SERIAL PRIMARY KEY,
    org_id           INTEGER NOT NULL REFERENCES organizations(id),
    candidate_id     INTEGER REFERENCES candidates(id),
    position_id      INTEGER REFERENCES positions(id),
    application_id   INTEGER REFERENCES candidate_applications(id),
    interview_id     INTEGER REFERENCES interviews(id),
    user_id          INTEGER REFERENCES users(id),
    event_type       TEXT NOT NULL,
    event_data       TEXT,
    created_at       TIMESTAMP DEFAULT NOW()
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
    id               SERIAL PRIMARY KEY,
    org_id           INTEGER NOT NULL,
    user_id          INTEGER,
    action           TEXT NOT NULL,
    entity_type      TEXT,
    entity_id        TEXT,
    details          TEXT,
    ip_address       TEXT,
    created_at       TIMESTAMP DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id               SERIAL PRIMARY KEY,
    org_id           INTEGER NOT NULL REFERENCES organizations(id),
    user_id          INTEGER REFERENCES users(id),
    type             TEXT NOT NULL,
    title            TEXT NOT NULL,
    message          TEXT NOT NULL,
    action_url       TEXT,
    is_read          BOOLEAN DEFAULT FALSE,
    created_at       TIMESTAMP DEFAULT NOW()
);

-- Talent Pool Suggestions
CREATE TABLE IF NOT EXISTS talent_pool_suggestions (
    id               SERIAL PRIMARY KEY,
    org_id           INTEGER NOT NULL REFERENCES organizations(id),
    position_id      INTEGER NOT NULL REFERENCES positions(id),
    candidate_id     INTEGER NOT NULL REFERENCES candidates(id),
    match_score      REAL,
    suggested_at     TIMESTAMP DEFAULT NOW(),
    actioned         BOOLEAN DEFAULT FALSE,
    UNIQUE(position_id, candidate_id)
);

-- Candidate Tags
CREATE TABLE IF NOT EXISTS candidate_tags (
    id               SERIAL PRIMARY KEY,
    org_id           INTEGER NOT NULL REFERENCES organizations(id),
    candidate_id     INTEGER NOT NULL REFERENCES candidates(id),
    tag              TEXT NOT NULL,
    created_by       INTEGER REFERENCES users(id),
    created_at       TIMESTAMP DEFAULT NOW(),
    UNIQUE(org_id, candidate_id, tag)
);
"""

# ── Row-Level Security Policies (§9) ──────────────────────────────────────────

RLS_SETUP = """
-- Enable RLS on all tenant-scoped business tables
ALTER TABLE departments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates              ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_applications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews              ENABLE ROW LEVEL SECURITY;
ALTER TABLE scorecards              ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications           ENABLE ROW LEVEL SECURITY;
ALTER TABLE talent_pool_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_tags          ENABLE ROW LEVEL SECURITY;
ALTER TABLE jd_variants             ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitors             ENABLE ROW LEVEL SECURITY;
ALTER TABLE screening_questions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE scorecard_templates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_kits          ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_panel         ENABLE ROW LEVEL SECURITY;
"""

# Tables that have org_id directly
RLS_TABLES_WITH_ORG_ID = [
    "departments",
    "positions",
    "candidates",
    "candidate_applications",
    "interviews",
    "scorecards",
    "pipeline_events",
    "notifications",
    "talent_pool_suggestions",
    "candidate_tags",
    "competitors",
    "screening_questions",
    "message_templates",
    "scorecard_templates",
    "interview_kits",
]

# Tables that don't have org_id directly (need join-based or skip RLS policy)
# jd_variants → accessed via position_id (parent has org_id)
# interview_panel → accessed via interview_id (parent has org_id)


async def run_migrations(conn) -> None:
    """Run all CREATE TABLE statements and set up RLS. Idempotent."""
    logger.info("Running database migrations...")

    # Create all tables in dependency order
    for name, sql in [
        ("Foundation Tables", FOUNDATION_TABLES),
        ("Chat Tables", CHAT_TABLES),
        ("Hiring Tables", HIRING_TABLES),
        ("Interview Tables", INTERVIEW_TABLES),
        ("Event Tables", EVENT_TABLES),
    ]:
        logger.info(f"  Creating {name}...")
        await conn.execute(sql)

    # Enable RLS
    logger.info("  Enabling Row-Level Security...")
    await conn.execute(RLS_SETUP)

    # Create tenant isolation policies for tables with org_id
    for table in RLS_TABLES_WITH_ORG_ID:
        policy_sql = f"""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE tablename = '{table}' AND policyname = 'tenant_isolation'
            ) THEN
                EXECUTE 'CREATE POLICY tenant_isolation ON {table}
                    USING (org_id = current_setting(''app.current_org_id'', true)::int)';
            END IF;
        END $$;
        """
        await conn.execute(policy_sql)

    # Create indexes for performance
    index_sql = """
    CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_positions_org ON positions(org_id);
    CREATE INDEX IF NOT EXISTS idx_positions_dept ON positions(department_id);
    CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);
    CREATE INDEX IF NOT EXISTS idx_candidates_org ON candidates(org_id);
    CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(org_id, email);
    CREATE INDEX IF NOT EXISTS idx_applications_position ON candidate_applications(position_id);
    CREATE INDEX IF NOT EXISTS idx_applications_candidate ON candidate_applications(candidate_id);
    CREATE INDEX IF NOT EXISTS idx_applications_status ON candidate_applications(status);
    CREATE INDEX IF NOT EXISTS idx_pipeline_events_org ON pipeline_events(org_id);
    CREATE INDEX IF NOT EXISTS idx_pipeline_events_candidate ON pipeline_events(candidate_id);
    CREATE INDEX IF NOT EXISTS idx_pipeline_events_position ON pipeline_events(position_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_interviews_position ON interviews(position_id);
    CREATE INDEX IF NOT EXISTS idx_interviews_candidate ON interviews(candidate_id);
    CREATE INDEX IF NOT EXISTS idx_talent_pool ON candidates(org_id, in_talent_pool) WHERE in_talent_pool = TRUE;
    """
    await conn.execute(index_sql)

    # ── Incremental schema migrations (safe to run multiple times) ────────────
    incremental_sql = """
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name='candidate_sessions' AND column_name='session_state') THEN
            ALTER TABLE candidate_sessions
                ADD COLUMN session_state TEXT DEFAULT '{}',
                ADD COLUMN messages TEXT DEFAULT '[]',
                ADD COLUMN candidate_id INTEGER,
                ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='candidate_sessions' AND column_name='magic_link_token') THEN
            ALTER TABLE candidate_sessions
                DROP COLUMN IF EXISTS magic_link_token,
                DROP COLUMN IF EXISTS position_id,
                DROP COLUMN IF EXISTS expires_at;
        END IF;
    END $$;

    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name='positions' AND column_name='followup_delay_hours') THEN
            ALTER TABLE positions ADD COLUMN followup_delay_hours INTEGER DEFAULT 72;
        END IF;
    END $$;

    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name='organizations' AND column_name='hiring_contact_email') THEN
            ALTER TABLE organizations ADD COLUMN hiring_contact_email TEXT;
        END IF;
    END $$;

    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name='interview_kits' AND column_name='org_id') THEN
            ALTER TABLE interview_kits ADD COLUMN org_id INTEGER REFERENCES organizations(id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name='interview_kits' AND column_name='regenerated_count') THEN
            ALTER TABLE interview_kits ADD COLUMN regenerated_count INTEGER DEFAULT 0;
        END IF;
    END $$;

    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name='chat_sessions' AND column_name='status') THEN
            ALTER TABLE chat_sessions ADD COLUMN status TEXT DEFAULT 'active';
        END IF;
    END $$;

    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name='positions' AND column_name='assigned_to') THEN
            ALTER TABLE positions ADD COLUMN assigned_to INTEGER REFERENCES users(id);
        END IF;
    END $$;
    """
    await conn.execute(incremental_sql)

    # ── GDPR / DPDP compliance tables ────────────────────────────────────────
    gdpr_sql = """
    -- Consent Records — tracks when and what consent was given
    CREATE TABLE IF NOT EXISTS consent_records (
        id               SERIAL PRIMARY KEY,
        org_id           INTEGER NOT NULL REFERENCES organizations(id),
        candidate_id     INTEGER REFERENCES candidates(id),
        application_id   INTEGER REFERENCES candidate_applications(id),
        consent_type     TEXT NOT NULL,  -- 'data_processing', 'ai_analysis', 'communication'
        consent_given    BOOLEAN NOT NULL DEFAULT FALSE,
        consent_text     TEXT NOT NULL,  -- exact text shown to user
        ip_address       TEXT,
        user_agent       TEXT,
        given_at         TIMESTAMP DEFAULT NOW(),
        withdrawn_at     TIMESTAMP
    );

    -- Data Deletion Requests — right-to-erasure workflow
    CREATE TABLE IF NOT EXISTS data_deletion_requests (
        id               SERIAL PRIMARY KEY,
        org_id           INTEGER NOT NULL REFERENCES organizations(id),
        candidate_id     INTEGER NOT NULL REFERENCES candidates(id),
        request_email    TEXT NOT NULL,
        request_token    TEXT UNIQUE NOT NULL,
        status           TEXT NOT NULL DEFAULT 'pending',  -- pending, verified, processing, completed, rejected
        reason           TEXT,
        verified_at      TIMESTAMP,
        completed_at     TIMESTAMP,
        deleted_data     TEXT,  -- JSON summary of what was deleted
        created_at       TIMESTAMP DEFAULT NOW()
    );

    -- Add consent tracking to candidate_applications
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name='candidate_applications' AND column_name='consent_given_at') THEN
            ALTER TABLE candidate_applications ADD COLUMN consent_given_at TIMESTAMP;
        END IF;
    END $$;

    -- Add retention tracking to candidates
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name='candidates' AND column_name='data_retained_until') THEN
            ALTER TABLE candidates ADD COLUMN data_retained_until TIMESTAMP;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name='candidates' AND column_name='data_anonymized_at') THEN
            ALTER TABLE candidates ADD COLUMN data_anonymized_at TIMESTAMP;
        END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS idx_consent_records_candidate ON consent_records(candidate_id);
    CREATE INDEX IF NOT EXISTS idx_deletion_requests_email ON data_deletion_requests(request_email);
    CREATE INDEX IF NOT EXISTS idx_deletion_requests_token ON data_deletion_requests(request_token);
    CREATE INDEX IF NOT EXISTS idx_candidates_retention ON candidates(data_retained_until)
        WHERE data_retained_until IS NOT NULL;
    """
    await conn.execute(gdpr_sql)
    logger.info("  GDPR/DPDP compliance tables created.")

    # ── Feature schema additions (v2 product plan) ────────────────────────────
    feature_sql = """
    -- candidate_applications: status_token (permanent, for candidate status portal)
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name='candidate_applications' AND column_name='status_token') THEN
            ALTER TABLE candidate_applications ADD COLUMN status_token TEXT UNIQUE;
        END IF;
    END $$;

    -- candidate_applications: video intro
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name='candidate_applications' AND column_name='video_intro_url') THEN
            ALTER TABLE candidate_applications ADD COLUMN video_intro_url TEXT;
            ALTER TABLE candidate_applications ADD COLUMN video_intro_duration INTEGER;
        END IF;
    END $$;

    -- candidates: contact_status for talent pool unsubscribe
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name='candidates' AND column_name='contact_status') THEN
            ALTER TABLE candidates ADD COLUMN contact_status TEXT DEFAULT 'active';
            ALTER TABLE candidates ADD COLUMN contact_status_updated_at TIMESTAMP;
        END IF;
    END $$;

    -- positions: approval workflow
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name='positions' AND column_name='requires_approval') THEN
            ALTER TABLE positions ADD COLUMN requires_approval BOOLEAN DEFAULT FALSE;
            ALTER TABLE positions ADD COLUMN approval_status TEXT;
            ALTER TABLE positions ADD COLUMN approved_by INTEGER REFERENCES users(id);
            ALTER TABLE positions ADD COLUMN approved_at TIMESTAMP;
        END IF;
    END $$;

    -- organizations: default approval setting + data retention
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name='organizations' AND column_name='default_require_approval') THEN
            ALTER TABLE organizations ADD COLUMN default_require_approval BOOLEAN DEFAULT FALSE;
            ALTER TABLE organizations ADD COLUMN data_retention_months INTEGER DEFAULT 24;
        END IF;
    END $$;

    -- interviews: calendar integration fields
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name='interviews' AND column_name='calendar_event_id') THEN
            ALTER TABLE interviews ADD COLUMN calendar_event_id TEXT;
            ALTER TABLE interviews ADD COLUMN calendar_provider TEXT;
        END IF;
    END $$;

    -- copilot_suggestions: AI copilot action bar data
    CREATE TABLE IF NOT EXISTS copilot_suggestions (
        id              SERIAL PRIMARY KEY,
        org_id          INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id         INTEGER REFERENCES users(id),
        type            TEXT NOT NULL,
        title           TEXT NOT NULL,
        action_url      TEXT,
        action_label    TEXT,
        entity_id       INTEGER,
        entity_type     TEXT,
        is_dismissed    BOOLEAN DEFAULT FALSE,
        created_at      TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_copilot_org ON copilot_suggestions(org_id, is_dismissed);

    -- hiring_notes: collaborative notes on candidates
    CREATE TABLE IF NOT EXISTS hiring_notes (
        id              SERIAL PRIMARY KEY,
        org_id          INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        candidate_id    INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
        application_id  INTEGER REFERENCES candidate_applications(id),
        author_id       INTEGER NOT NULL REFERENCES users(id),
        content         TEXT NOT NULL,
        mentions        TEXT DEFAULT '[]',
        created_at      TIMESTAMP DEFAULT NOW(),
        updated_at      TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_hiring_notes_candidate ON hiring_notes(candidate_id);
    CREATE INDEX IF NOT EXISTS idx_hiring_notes_org ON hiring_notes(org_id);

    -- backfill status_token for existing applications that don't have one
    UPDATE candidate_applications
    SET status_token = gen_random_uuid()::text
    WHERE status_token IS NULL;

    -- organizations: career page branding
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name='organizations' AND column_name='career_primary_color') THEN
            ALTER TABLE organizations ADD COLUMN career_primary_color TEXT;
            ALTER TABLE organizations ADD COLUMN career_banner_url TEXT;
            ALTER TABLE organizations ADD COLUMN career_tagline TEXT;
        END IF;
    END $$;

    -- chat_sessions: link to originating hire_request
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name='chat_sessions' AND column_name='hire_request_id') THEN
            ALTER TABLE chat_sessions ADD COLUMN hire_request_id INTEGER;
        END IF;
    END $$;

    -- hire_requests: hiring manager submits a request for a new position
    CREATE TABLE IF NOT EXISTS hire_requests (
        id               SERIAL PRIMARY KEY,
        org_id           INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        department_id    INTEGER REFERENCES departments(id),
        requested_by     INTEGER NOT NULL REFERENCES users(id),
        accepted_by      INTEGER REFERENCES users(id),
        role_name        TEXT NOT NULL,
        headcount        INTEGER DEFAULT 1,
        work_type        TEXT DEFAULT 'onsite',
        experience_min   INTEGER,
        experience_max   INTEGER,
        target_start     TEXT,
        requirements     TEXT,
        status           TEXT DEFAULT 'pending',
        chat_session_id  TEXT REFERENCES chat_sessions(id),
        created_at       TIMESTAMP DEFAULT NOW(),
        updated_at       TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_hire_requests_org    ON hire_requests(org_id, status);
    CREATE INDEX IF NOT EXISTS idx_hire_requests_by     ON hire_requests(requested_by);

    -- hire_requests: link to the position created from this request
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name='hire_requests' AND column_name='position_id') THEN
            ALTER TABLE hire_requests ADD COLUMN position_id INTEGER REFERENCES positions(id);
        END IF;
    END $$;

    -- hire_requests: comp band + location (used by the redesigned wizard / detail UI)
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name='hire_requests' AND column_name='comp_min') THEN
            ALTER TABLE hire_requests
                ADD COLUMN comp_min INTEGER,
                ADD COLUMN comp_max INTEGER,
                ADD COLUMN location TEXT;
        END IF;
    END $$;

    -- consumed_magic_links: enforces single-use on magic-link JWTs (auth, password_reset, etc.)
    -- jti is the unique JWT id minted at issue time; on verify we INSERT and rely on UNIQUE
    -- to reject replays. Periodic cleanup removes rows older than 30 days.
    CREATE TABLE IF NOT EXISTS consumed_magic_links (
        jti              TEXT PRIMARY KEY,
        token_type       TEXT NOT NULL,
        entity_id        INTEGER,
        consumed_at      TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_consumed_magic_links_consumed_at
        ON consumed_magic_links(consumed_at);
    """
    await conn.execute(feature_sql)
    logger.info("  Feature schema additions (v2) applied.")

    logger.info("Database migrations complete.")
