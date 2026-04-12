"""
db/database.py – SQLite Relational Database (Production Schema)
Manages organizations, users, positions, candidates, emails, and applications.
Designed with a repository pattern — switching to PostgreSQL requires only changing
the connection layer; all queries use standard SQL.
"""
import sqlite3
import os
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(__file__), "talent_lab.sqlite")


@contextmanager
def get_connection():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Create all tables and seed initial data."""
    with get_connection() as conn:
        conn.executescript("""
            -- ── Organizations ────────────────────────────────────────────────
            CREATE TABLE IF NOT EXISTS organizations (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                name       TEXT NOT NULL UNIQUE,
                segment    TEXT NOT NULL,
                size       TEXT NOT NULL CHECK(size IN ('startup','smb','enterprise')),
                website    TEXT,
                about_us   TEXT,
                logo_url   TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- ── Users & Auth ─────────────────────────────────────────────────
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id        INTEGER NOT NULL REFERENCES organizations(id),
                email         TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role          TEXT NOT NULL DEFAULT 'recruiter'
                              CHECK(role IN ('admin','recruiter','hiring_manager')),
                name          TEXT,
                phone         TEXT,
                is_active     BOOLEAN DEFAULT 1,
                created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- ── Competitors ──────────────────────────────────────────────────
            CREATE TABLE IF NOT EXISTS competitors (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id          INTEGER NOT NULL REFERENCES organizations(id),
                competitor_name TEXT NOT NULL,
                website         TEXT,
                notes           TEXT,
                UNIQUE(org_id, competitor_name)
            );

            -- ── Positions (Hiring Requests) ──────────────────────────────────
            CREATE TABLE IF NOT EXISTS positions (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id        INTEGER NOT NULL REFERENCES organizations(id),
                session_id    TEXT UNIQUE,
                role_name     TEXT NOT NULL,
                jd_markdown   TEXT,
                status        TEXT DEFAULT 'draft'
                              CHECK(status IN ('draft','open','closed','on_hold')),
                ats_threshold REAL DEFAULT 80.0,
                created_by    INTEGER REFERENCES users(id),
                created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- ── Candidates ───────────────────────────────────────────────────
            CREATE TABLE IF NOT EXISTS candidates (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id           INTEGER NOT NULL REFERENCES organizations(id),
                position_id      INTEGER REFERENCES positions(id),
                name             TEXT,
                email            TEXT,
                phone            TEXT,
                resume_path      TEXT,
                resume_text      TEXT,
                source           TEXT DEFAULT 'manual'
                                 CHECK(source IN ('linkedin','naukri','monster','upload','manual','simulation')),
                skill_match_score REAL,
                status           TEXT DEFAULT 'sourced'
                                 CHECK(status IN ('sourced','emailed','applied','screening','interview','selected','rejected','on_hold')),
                screening_data   TEXT,
                created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(org_id, email, position_id)
            );

            -- ── Candidate Emails ─────────────────────────────────────────────
            CREATE TABLE IF NOT EXISTS candidate_emails (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                candidate_id    INTEGER NOT NULL REFERENCES candidates(id),
                email_type      TEXT NOT NULL
                                CHECK(email_type IN ('outreach','reminder','rejection','offer','custom')),
                subject         TEXT,
                body            TEXT,
                sent_at         DATETIME,
                magic_link      TEXT UNIQUE,
                link_clicked_at DATETIME,
                created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- ── Applications (Candidate Screening Response) ──────────────────
            CREATE TABLE IF NOT EXISTS applications (
                id                     INTEGER PRIMARY KEY AUTOINCREMENT,
                candidate_id           INTEGER NOT NULL REFERENCES candidates(id),
                position_id            INTEGER NOT NULL REFERENCES positions(id),
                applied_via            TEXT DEFAULT 'magic_link',
                prev_company           TEXT,
                notice_period          TEXT,
                total_experience       TEXT,
                relevant_experience    TEXT,
                current_salary         TEXT,
                expected_salary        TEXT,
                availability           TEXT,
                interview_availability TEXT,
                additional_info        TEXT,
                applied_at             DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(candidate_id, position_id)
            );

            -- ── Notifications ────────────────────────────────────────────────
            CREATE TABLE IF NOT EXISTS notifications (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id       INTEGER NOT NULL REFERENCES organizations(id),
                user_id      INTEGER REFERENCES users(id),
                type         TEXT NOT NULL,
                title        TEXT NOT NULL,
                message      TEXT NOT NULL,
                session_id   TEXT,
                is_read      BOOLEAN DEFAULT 0,
                created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- ── Indexes ──────────────────────────────────────────────────────
            CREATE INDEX IF NOT EXISTS idx_candidates_position
                ON candidates(position_id);
            CREATE INDEX IF NOT EXISTS idx_candidates_org
                ON candidates(org_id);
            CREATE INDEX IF NOT EXISTS idx_candidates_status
                ON candidates(status);
            CREATE INDEX IF NOT EXISTS idx_positions_org
                ON positions(org_id);
            CREATE INDEX IF NOT EXISTS idx_positions_status
                ON positions(status);
            CREATE INDEX IF NOT EXISTS idx_candidate_emails_candidate
                ON candidate_emails(candidate_id);
            CREATE INDEX IF NOT EXISTS idx_applications_position
                ON applications(position_id);
            CREATE INDEX IF NOT EXISTS idx_users_org
                ON users(org_id);
            CREATE INDEX IF NOT EXISTS idx_notifications_org_read
                ON notifications(org_id, is_read);
        """)

        # ── Seed default organization ─────────────────────────────────────
        conn.execute("""
            INSERT OR IGNORE INTO organizations (name, segment, size, website, about_us)
            VALUES (
                'AI Talent Lab',
                'AI Recruitment Technology',
                'startup',
                'https://aitalentlab.com',
                'AI Talent Lab is an innovative AI-powered recruitment platform that helps companies find, evaluate, and hire the best talent efficiently. Our mission is to make hiring smarter, faster, and more human.'
            )
        """)

        # Get org id
        org_id = conn.execute(
            "SELECT id FROM organizations WHERE name = 'AI Talent Lab'"
        ).fetchone()["id"]

        # Seed competitors
        competitors_seed = [
            ("Turing",        "https://turing.com",        "AI-powered global tech talent platform"),
            ("HireQuotient",  "https://hirequotient.com",  "AI assessment and sourcing platform"),
            ("Keka",          "https://keka.com",          "HR, payroll & ATS platform for SMBs"),
            ("Darwinbox",     "https://darwinbox.com",     "Enterprise HR + talent management SaaS"),
            ("BairesDev",     "https://bairesdev.com",     "Tech talent staffing for enterprises"),
        ]

        for name, website, notes in competitors_seed:
            conn.execute("""
                INSERT OR IGNORE INTO competitors (org_id, competitor_name, website, notes)
                VALUES (?, ?, ?, ?)
            """, (org_id, name, website, notes))


# ── Query helpers ─────────────────────────────────────────────────────────────

def get_competitors(org_name: str = "AI Talent Lab") -> list[dict]:
    """Returns the list of competitor names and websites for the given org."""
    with get_connection() as conn:
        rows = conn.execute("""
            SELECT c.competitor_name, c.website, c.notes
            FROM competitors c
            JOIN organizations o ON c.org_id = o.id
            WHERE o.name = ?
        """, (org_name,)).fetchall()
        return [dict(r) for r in rows]


def get_org_by_name(org_name: str = "AI Talent Lab") -> dict | None:
    """Get organization details."""
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM organizations WHERE name = ?", (org_name,)
        ).fetchone()
        return dict(row) if row else None


def save_position(session_id: str, role_name: str, org_id: int = None,
                  org_name: str = None, jd_markdown: str = None,
                  ats_threshold: float = 80.0):
    """Create or update a hiring position record."""
    import sys
    print(f"\n📦 save_position called | session={session_id} | role={role_name} | org_id={org_id} | org_name={org_name}", file=sys.stderr)
    with get_connection() as conn:
        if not org_id and org_name:
            org = conn.execute(
                "SELECT id FROM organizations WHERE name = ?", (org_name,)
            ).fetchone()
            if not org:
                return
            org_id = org["id"]
        if not org_id:
            print(f"   ❌ No org_id resolved — skipping position save", file=sys.stderr)
            return
        print(f"   ✅ Inserting/updating position with org_id={org_id}", file=sys.stderr)
        conn.execute("""
            INSERT INTO positions (org_id, role_name, session_id, jd_markdown, ats_threshold)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(session_id) DO UPDATE SET
                role_name = excluded.role_name,
                jd_markdown = COALESCE(excluded.jd_markdown, jd_markdown),
                ats_threshold = excluded.ats_threshold,
                updated_at = CURRENT_TIMESTAMP
        """, (org_id, role_name, session_id, jd_markdown, ats_threshold))


def update_position_jd(session_id: str, jd_markdown: str):
    """Update the JD for a position after generation."""
    with get_connection() as conn:
        conn.execute("""
            UPDATE positions SET jd_markdown = ?, status = 'open', updated_at = CURRENT_TIMESTAMP
            WHERE session_id = ?
        """, (jd_markdown, session_id))


def get_positions(org_name: str = "AI Talent Lab") -> list[dict]:
    """Get all positions for an organization."""
    with get_connection() as conn:
        rows = conn.execute("""
            SELECT p.* FROM positions p
            JOIN organizations o ON p.org_id = o.id
            WHERE o.name = ?
            ORDER BY p.created_at DESC
        """, (org_name,)).fetchall()
        return [dict(r) for r in rows]


def get_position_by_session(session_id: str) -> dict | None:
    """Get a position by its session ID."""
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM positions WHERE session_id = ?", (session_id,)
        ).fetchone()
        return dict(row) if row else None


# ── Candidate helpers ─────────────────────────────────────────────────────────

def add_candidate(org_id: int, position_id: int, name: str, email: str,
                  phone: str = None, resume_text: str = None,
                  source: str = "simulation", skill_match_score: float = None) -> int:
    """Add a candidate and return their ID."""
    with get_connection() as conn:
        cursor = conn.execute("""
            INSERT INTO candidates (org_id, position_id, name, email, phone,
                                    resume_text, source, skill_match_score)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(org_id, email, position_id) DO UPDATE SET
                name = excluded.name,
                phone = excluded.phone,
                resume_text = COALESCE(excluded.resume_text, resume_text),
                skill_match_score = COALESCE(excluded.skill_match_score, skill_match_score),
                updated_at = CURRENT_TIMESTAMP
        """, (org_id, position_id, name, email, phone, resume_text, source, skill_match_score))
        return cursor.lastrowid


def get_candidates_for_position(position_id: int) -> list[dict]:
    """Get all candidates for a position."""
    with get_connection() as conn:
        rows = conn.execute("""
            SELECT * FROM candidates
            WHERE position_id = ?
            ORDER BY skill_match_score DESC NULLS LAST
        """, (position_id,)).fetchall()
        return [dict(r) for r in rows]


def update_candidate_status(candidate_id: int, status: str):
    """Update a candidate's pipeline status."""
    with get_connection() as conn:
        conn.execute("""
            UPDATE candidates SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (status, candidate_id))


# ── Dashboard/Stats helpers ──────────────────────────────────────────────────

def get_dashboard_stats(org_name: str = "AI Talent Lab") -> dict:
    """Get aggregate stats for the dashboard."""
    with get_connection() as conn:
        org = conn.execute(
            "SELECT id FROM organizations WHERE name = ?", (org_name,)
        ).fetchone()
        if not org:
            return {}
        org_id = org["id"]

        open_positions = conn.execute(
            "SELECT COUNT(*) as c FROM positions WHERE org_id = ? AND status = 'open'",
            (org_id,)
        ).fetchone()["c"]

        total_candidates = conn.execute(
            "SELECT COUNT(*) as c FROM candidates WHERE org_id = ?",
            (org_id,)
        ).fetchone()["c"]

        emails_sent = conn.execute("""
            SELECT COUNT(*) as c FROM candidate_emails ce
            JOIN candidates c ON ce.candidate_id = c.id
            WHERE c.org_id = ? AND ce.sent_at IS NOT NULL
        """, (org_id,)).fetchone()["c"]

        applications = conn.execute("""
            SELECT COUNT(*) as c FROM applications a
            JOIN candidates c ON a.candidate_id = c.id
            WHERE c.org_id = ?
        """, (org_id,)).fetchone()["c"]

        return {
            "open_positions": open_positions,
            "total_candidates": total_candidates,
            "emails_sent": emails_sent,
            "applications": applications,
        }

# ── Notifications ─────────────────────────────────────────────────────────────

def add_notification(org_id: int, type: str, title: str, message: str, session_id: str = None, user_id: int = None) -> int:
    """Add a new notification."""
    with get_connection() as conn:
        cursor = conn.execute("""
            INSERT INTO notifications (org_id, user_id, type, title, message, session_id)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (org_id, user_id, type, title, message, session_id))
        return cursor.lastrowid

def get_unread_notifications(org_id: int, user_id: int = None) -> list[dict]:
    """Get all unread notifications for an organization (optionally filtered by user)."""
    with get_connection() as conn:
        if user_id:
            cursor = conn.execute("""
                SELECT * FROM notifications
                WHERE org_id = ? AND is_read = 0 AND (user_id IS NULL OR user_id = ?)
                ORDER BY created_at DESC
            """, (org_id, user_id))
        else:
            cursor = conn.execute("""
                SELECT * FROM notifications
                WHERE org_id = ? AND is_read = 0
                ORDER BY created_at DESC
            """, (org_id,))
        return [dict(r) for r in cursor.fetchall()]

def mark_notification_read(notification_id: int, org_id: int) -> bool:
    """Mark a specific notification as read."""
    with get_connection() as conn:
        cursor = conn.execute("""
            UPDATE notifications
            SET is_read = 1
            WHERE id = ? AND org_id = ?
        """, (notification_id, org_id))
        return cursor.rowcount > 0

def mark_session_notifications_read(session_id: str, org_id: int) -> int:
    """Mark all notifications for a specific session as read."""
    with get_connection() as conn:
        cursor = conn.execute("""
            UPDATE notifications
            SET is_read = 1
            WHERE session_id = ? AND org_id = ? AND is_read = 0
        """, (session_id, org_id))
        return cursor.rowcount


# Auto-initialize on import
init_db()
