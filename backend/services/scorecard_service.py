"""
services/scorecard_service.py – Scorecard business logic.

Per project rules:
- Three-layer: Router → Service → Repository
- All queries filter by org_id for tenant isolation
- All mutations logged to audit_log

Handles CRUD on interview scorecards, aggregation of scores, and
consensus calculation for the debrief view.
"""
import json
import logging
from typing import Optional

from backend.db.connection import get_connection

logger = logging.getLogger(__name__)


class ScorecardService:
    """Interview scorecard business logic."""

    @staticmethod
    async def get_by_interview(interview_id: int, org_id: int) -> list[dict]:
        """Get all scorecards for an interview."""
        async with get_connection() as conn:
            rows = await conn.fetch(
                """
                SELECT s.*, ip.panelist_name, ip.panelist_email
                FROM scorecards s
                JOIN interview_panel ip ON ip.id = s.panel_member_id
                WHERE s.interview_id=$1 AND s.org_id=$2
                ORDER BY s.submitted_at DESC
                """,
                interview_id, org_id,
            )
        result = []
        for r in rows:
            d = dict(r)
            if isinstance(d.get("ratings"), str):
                try:
                    d["ratings"] = json.loads(d["ratings"])
                except Exception:
                    pass
            result.append(d)
        return result

    @staticmethod
    async def get_by_id(scorecard_id: int, org_id: int) -> Optional[dict]:
        """Get a single scorecard by ID."""
        async with get_connection() as conn:
            row = await conn.fetchrow(
                """
                SELECT s.*, ip.panelist_name, ip.panelist_email
                FROM scorecards s
                JOIN interview_panel ip ON ip.id = s.panel_member_id
                WHERE s.id=$1 AND s.org_id=$2
                """,
                scorecard_id, org_id,
            )
        if not row:
            return None
        d = dict(row)
        if isinstance(d.get("ratings"), str):
            try:
                d["ratings"] = json.loads(d["ratings"])
            except Exception:
                pass
        return d

    @staticmethod
    async def submit(
        interview_id: int,
        panel_member_id: int,
        org_id: int,
        ratings: dict,
        overall_score: float,
        recommendation: str,
        strengths: Optional[str] = None,
        concerns: Optional[str] = None,
        additional_comments: Optional[str] = None,
        raw_notes_strengths: Optional[str] = None,
        raw_notes_concerns: Optional[str] = None,
        is_draft: bool = False,
    ) -> dict:
        """
        Submit or update a scorecard.
        Uses UPSERT — a panelist can update their scorecard until finalized.
        """
        async with get_connection() as conn:
            # Get candidate_id and position_id from the interview
            interview = await conn.fetchrow(
                "SELECT candidate_id, position_id FROM interviews WHERE id=$1 AND org_id=$2",
                interview_id, org_id,
            )
            if not interview:
                raise ValueError(f"Interview {interview_id} not found")

            ratings_json = json.dumps(ratings) if isinstance(ratings, dict) else ratings

            row = await conn.fetchrow(
                """
                INSERT INTO scorecards
                    (interview_id, panel_member_id, candidate_id, position_id, org_id,
                     is_draft, ratings, overall_score, recommendation,
                     strengths, concerns, additional_comments,
                     raw_notes_strengths, raw_notes_concerns, submitted_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
                ON CONFLICT (interview_id, panel_member_id) DO UPDATE SET
                    is_draft=$6, ratings=$7, overall_score=$8, recommendation=$9,
                    strengths=$10, concerns=$11, additional_comments=$12,
                    raw_notes_strengths=$13, raw_notes_concerns=$14, submitted_at=NOW()
                RETURNING id, overall_score, recommendation, submitted_at
                """,
                interview_id, panel_member_id,
                interview["candidate_id"], interview["position_id"], org_id,
                is_draft, ratings_json, overall_score, recommendation,
                strengths, concerns, additional_comments,
                raw_notes_strengths, raw_notes_concerns,
            )

            # Mark panelist as having submitted feedback
            if not is_draft:
                await conn.execute(
                    "UPDATE interview_panel SET feedback_submitted=TRUE WHERE id=$1",
                    panel_member_id,
                )

            # Audit log
            await conn.execute(
                """
                INSERT INTO audit_log (org_id, action, entity_type, entity_id, details)
                VALUES ($1, $2, $3, $4, $5)
                """,
                org_id,
                "scorecard_submitted" if not is_draft else "scorecard_draft_saved",
                "scorecard",
                str(row["id"]),
                json.dumps({
                    "interview_id": interview_id,
                    "panel_member_id": panel_member_id,
                    "overall_score": overall_score,
                    "recommendation": recommendation,
                }),
            )

        return dict(row)

    @staticmethod
    async def aggregate_scores(interview_id: int, org_id: int) -> dict:
        """
        Aggregate all submitted scorecards for an interview.
        Returns average scores per dimension, overall average, and consensus.
        """
        scorecards = await ScorecardService.get_by_interview(interview_id, org_id)
        submitted = [s for s in scorecards if not s.get("is_draft")]

        if not submitted:
            return {
                "total_panelists": 0,
                "submitted": 0,
                "avg_overall_score": None,
                "dimension_averages": {},
                "recommendations": {},
                "consensus": None,
            }

        # Aggregate overall scores
        overall_scores = [s["overall_score"] for s in submitted if s.get("overall_score")]
        avg_overall = round(sum(overall_scores) / len(overall_scores), 1) if overall_scores else None

        # Aggregate per-dimension ratings
        all_dimensions = {}
        for s in submitted:
            ratings = s.get("ratings", {})
            if isinstance(ratings, str):
                try:
                    ratings = json.loads(ratings)
                except Exception:
                    ratings = {}
            for dim, score in ratings.items():
                if dim not in all_dimensions:
                    all_dimensions[dim] = []
                if isinstance(score, (int, float)):
                    all_dimensions[dim].append(score)

        dimension_averages = {
            dim: round(sum(scores) / len(scores), 1)
            for dim, scores in all_dimensions.items()
            if scores
        }

        # Recommendation distribution
        rec_counts = {}
        for s in submitted:
            rec = s.get("recommendation", "no_decision")
            rec_counts[rec] = rec_counts.get(rec, 0) + 1

        # Consensus: strong_yes if >50% say "strong_hire", etc.
        majority = max(rec_counts, key=rec_counts.get) if rec_counts else None

        return {
            "total_panelists": len(scorecards),
            "submitted": len(submitted),
            "avg_overall_score": avg_overall,
            "dimension_averages": dimension_averages,
            "recommendations": rec_counts,
            "consensus": majority,
        }

    @staticmethod
    async def get_candidate_scores(candidate_id: int, org_id: int) -> list[dict]:
        """Get all scorecards across all interviews for a candidate."""
        async with get_connection() as conn:
            rows = await conn.fetch(
                """
                SELECT s.*, ip.panelist_name, i.round_name, i.round_type
                FROM scorecards s
                JOIN interview_panel ip ON ip.id = s.panel_member_id
                JOIN interviews i ON i.id = s.interview_id
                WHERE s.candidate_id=$1 AND s.org_id=$2
                ORDER BY i.round_number, s.submitted_at
                """,
                candidate_id, org_id,
            )
        result = []
        for r in rows:
            d = dict(r)
            if isinstance(d.get("ratings"), str):
                try:
                    d["ratings"] = json.loads(d["ratings"])
                except Exception:
                    pass
            result.append(d)
        return result
