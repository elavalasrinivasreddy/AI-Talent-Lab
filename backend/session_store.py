"""
session_store.py – SQLite-backed session + message history management
Sessions persist across server restarts.
"""
import uuid
import json
import sqlite3
import os
from datetime import datetime
from typing import Optional
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(__file__), "db", "talent_lab.sqlite")


@contextmanager
def _get_conn():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _init_session_tables():
    """Create session tables if they don't exist."""
    with _get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL DEFAULT 'New Hire',
                workflow_stage TEXT DEFAULT 'intake',
                graph_state_json TEXT DEFAULT '{}',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
                role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
                content TEXT NOT NULL DEFAULT '',
                extras_json TEXT DEFAULT '{}',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_chat_messages_session
                ON chat_messages(session_id, id);
        """)


# Initialize tables on import
_init_session_tables()


# ── Public API (same interface as before) ─────────────────────────────────────

def create_session() -> str:
    """Create a new chat session and return its ID."""
    session_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    graph_state = {
        "session_id": session_id,
        "role_name": "New Hire",
        "messages": [],
        "workflow_stage": "intake",
        "baseline_requirements": None,
        "internal_recommendations": None,
        "internal_search_done": False,
        "competitors": None,
        "market_recommendations": None,
        "market_search_done": False,
        "jd_overviews": None,
        "final_jd_markdown": None,
    }

    with _get_conn() as conn:
        conn.execute(
            """INSERT INTO chat_sessions (id, title, workflow_stage, graph_state_json, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (session_id, "New Hire", "intake", json.dumps(graph_state), now, now)
        )
    return session_id


def get_session(session_id: str) -> Optional[dict]:
    """Get session metadata + messages."""
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM chat_sessions WHERE id = ?", (session_id,)
        ).fetchone()
        if not row:
            return None

        messages = conn.execute(
            "SELECT role, content, extras_json FROM chat_messages WHERE session_id = ? ORDER BY id",
            (session_id,)
        ).fetchall()

        graph_state = json.loads(row["graph_state_json"] or "{}")

        return {
            "id": row["id"],
            "title": row["title"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "messages": [{"role": m["role"], "content": m["content"]} for m in messages],
            "graph_state": graph_state,
            # Convenience fields from graph_state
            "jd_overviews": graph_state.get("jd_overviews"),
            "selected_overview": graph_state.get("selected_overview"),
            "full_jd": graph_state.get("final_jd_markdown"),
        }


def session_exists(session_id: str) -> bool:
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT 1 FROM chat_sessions WHERE id = ?", (session_id,)
        ).fetchone()
        return row is not None


def add_message(session_id: str, role: str, content: str) -> None:
    """Append a message to session history."""
    if not session_exists(session_id):
        raise KeyError(f"Session {session_id} not found")

    now = datetime.utcnow().isoformat()
    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO chat_messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)",
            (session_id, role, content, now)
        )
        conn.execute(
            "UPDATE chat_sessions SET updated_at = ? WHERE id = ?",
            (now, session_id)
        )


def get_messages(session_id: str) -> list[dict]:
    """Return all messages for LLM consumption."""
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY id",
            (session_id,)
        ).fetchall()
        return [{"role": r["role"], "content": r["content"]} for r in rows]


def get_graph_state(session_id: str) -> Optional[dict]:
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT graph_state_json FROM chat_sessions WHERE id = ?", (session_id,)
        ).fetchone()
        if not row:
            return None
        state = json.loads(row["graph_state_json"] or "{}")
        # Ensure messages from DB are in sync
        messages = get_messages(session_id)
        state["messages"] = messages
        return state


def update_graph_state(session_id: str, new_state: dict) -> None:
    now = datetime.utcnow().isoformat()

    # Extract messages from state and persist them separately
    messages = new_state.get("messages", [])

    # Store a copy of state without messages (messages are in their own table)
    state_for_json = {k: v for k, v in new_state.items() if k != "messages"}

    with _get_conn() as conn:
        # Clear existing messages and re-insert all (simplest approach for consistency)
        conn.execute("DELETE FROM chat_messages WHERE session_id = ?", (session_id,))
        for msg in messages:
            conn.execute(
                "INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)",
                (session_id, msg.get("role", "user"), msg.get("content", ""))
            )

        # Update session
        title = new_state.get("role_name", "New Hire")
        workflow_stage = new_state.get("workflow_stage", "intake")
        conn.execute(
            """UPDATE chat_sessions
               SET title = ?, workflow_stage = ?, graph_state_json = ?, updated_at = ?
               WHERE id = ?""",
            (title, workflow_stage, json.dumps(state_for_json, default=str), now, session_id)
        )


def update_title(session_id: str, title: str) -> None:
    now = datetime.utcnow().isoformat()
    with _get_conn() as conn:
        conn.execute(
            "UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ?",
            (title, now, session_id)
        )
        # Also update graph_state role_name
        row = conn.execute(
            "SELECT graph_state_json FROM chat_sessions WHERE id = ?", (session_id,)
        ).fetchone()
        if row:
            state = json.loads(row["graph_state_json"] or "{}")
            state["role_name"] = title
            conn.execute(
                "UPDATE chat_sessions SET graph_state_json = ? WHERE id = ?",
                (json.dumps(state, default=str), session_id)
            )


def set_selected_overview(session_id: str, overview: str) -> None:
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT graph_state_json FROM chat_sessions WHERE id = ?", (session_id,)
        ).fetchone()
        if row:
            state = json.loads(row["graph_state_json"] or "{}")
            state["selected_overview"] = overview
            conn.execute(
                "UPDATE chat_sessions SET graph_state_json = ? WHERE id = ?",
                (json.dumps(state, default=str), session_id)
            )


def list_sessions() -> list[dict]:
    """Return all sessions sorted by updated_at descending."""
    with _get_conn() as conn:
        rows = conn.execute(
            """SELECT id, title, created_at, updated_at
               FROM chat_sessions
               ORDER BY updated_at DESC
               LIMIT 20"""
        ).fetchall()
        return [
            {
                "id": r["id"],
                "title": r["title"],
                "created_at": r["created_at"],
                "updated_at": r["updated_at"],
            }
            for r in rows
        ]


def delete_session(session_id: str) -> bool:
    with _get_conn() as conn:
        # Messages cascade via FK, but let's be explicit
        conn.execute("DELETE FROM chat_messages WHERE session_id = ?", (session_id,))
        cursor = conn.execute("DELETE FROM chat_sessions WHERE id = ?", (session_id,))
        return cursor.rowcount > 0
