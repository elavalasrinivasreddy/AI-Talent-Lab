"""
routers/notes.py – Collaborative hiring notes on candidates.
All routes under /api/v1/notes/
"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from backend.dependencies import get_current_user
from backend.db.connection import get_connection

router = APIRouter(prefix="/api/v1/notes", tags=["Hiring Notes"])
logger = logging.getLogger(__name__)


class NoteCreate(BaseModel):
    content: str
    application_id: Optional[int] = None
    mentions: list[int] = []   # user IDs mentioned via @


class NoteUpdate(BaseModel):
    content: str


@router.get("/candidate/{candidate_id}")
async def list_notes(candidate_id: int, user=Depends(get_current_user)):
    """List all hiring notes for a candidate within the org."""
    async with get_connection() as conn:
        rows = await conn.fetch(
            """
            SELECT hn.id, hn.content, hn.mentions, hn.created_at, hn.updated_at,
                   hn.application_id,
                   u.name AS author_name, u.role AS author_role, u.avatar_url AS author_avatar
            FROM hiring_notes hn
            JOIN users u ON u.id = hn.author_id
            WHERE hn.candidate_id = $1 AND hn.org_id = $2
            ORDER BY hn.created_at DESC
            """,
            candidate_id, user["org_id"],
        )
    return {"notes": [dict(r) for r in rows]}


@router.post("/candidate/{candidate_id}")
async def create_note(candidate_id: int, body: NoteCreate, user=Depends(get_current_user)):
    """Create a hiring note. Sends in-app notifications to @mentioned users."""
    async with get_connection() as conn:
        # Verify candidate belongs to org
        exists = await conn.fetchval(
            "SELECT 1 FROM candidates WHERE id=$1 AND org_id=$2",
            candidate_id, user["org_id"],
        )
        if not exists:
            raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Candidate not found"})

        import json
        row = await conn.fetchrow(
            """
            INSERT INTO hiring_notes (org_id, candidate_id, application_id, author_id, content, mentions)
            VALUES ($1,$2,$3,$4,$5,$6)
            RETURNING id, content, mentions, created_at, updated_at, application_id
            """,
            user["org_id"], candidate_id, body.application_id,
            user["id"], body.content, json.dumps(body.mentions),
        )

        author_name = await conn.fetchval("SELECT name FROM users WHERE id=$1", user["id"])

        # Notify mentioned users
        if body.mentions:
            candidate_name = await conn.fetchval(
                "SELECT name FROM candidates WHERE id=$1", candidate_id
            )
            for uid in body.mentions:
                await conn.execute(
                    """
                    INSERT INTO notifications (org_id, user_id, type, title, message, action_url)
                    VALUES ($1,$2,'note_mention',$3,$4,$5)
                    """,
                    user["org_id"], uid,
                    f"{author_name} mentioned you",
                    f"In a note about {candidate_name}: \"{body.content[:80]}{'…' if len(body.content) > 80 else ''}\"",
                    f"/candidates/{candidate_id}",
                )

    return {"note": dict(row), "author_name": author_name, "author_role": user.get("role")}


@router.patch("/{note_id}")
async def update_note(note_id: int, body: NoteUpdate, user=Depends(get_current_user)):
    """Edit a note. Only the author can edit."""
    async with get_connection() as conn:
        row = await conn.fetchrow(
            "SELECT id, author_id FROM hiring_notes WHERE id=$1 AND org_id=$2",
            note_id, user["org_id"],
        )
        if not row:
            raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Note not found"})
        if row["author_id"] != user["id"]:
            raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Only the author can edit this note"})
        updated = await conn.fetchrow(
            "UPDATE hiring_notes SET content=$1, updated_at=NOW() WHERE id=$2 RETURNING id, content, updated_at",
            body.content, note_id,
        )
    return {"note": dict(updated)}


@router.delete("/{note_id}")
async def delete_note(note_id: int, user=Depends(get_current_user)):
    """Delete a note. Author or admin only."""
    async with get_connection() as conn:
        row = await conn.fetchrow(
            "SELECT author_id FROM hiring_notes WHERE id=$1 AND org_id=$2",
            note_id, user["org_id"],
        )
        if not row:
            raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Note not found"})
        if row["author_id"] != user["id"] and user.get("role") != "org_head":
            raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Only the author or admin can delete this note"})
        await conn.execute("DELETE FROM hiring_notes WHERE id=$1", note_id)
    return {"ok": True}
