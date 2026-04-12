"""
services/background_tasks.py – Background Jobs for Pipeline Phase 6
Handles automated candidate sourcing and ATS scoring after JD is finalized.
"""
import sys
import json
import traceback
from backend.db.database import (
    get_position_by_session, add_candidate, get_connection, add_notification
)
from backend.services.candidate_source import get_source_adapter, CandidateSearchQuery
from backend.services.ats_scorer import score_candidate
import backend.session_store as session_store
import asyncio
from backend.services.email_service import send_outreach_email


async def start_candidate_pipeline(session_id: str, org_id: int):
    """
    Background worker:
    1. Extracts position and skills
    2. Uses Source Adapter to find simulated candidates
    3. Runs AI ATS scoring on candidates
    4. Triggers a notification on completion
    """
    try:
        print(f"🚀 [Pipeline] Starting candidate pipeline for session {session_id}")
        
        # 1. Get position and state
        position = get_position_by_session(session_id)
        if not position:
            print(f"⚠️ [Pipeline] Position not found for session {session_id}")
            return

        position_id = position["id"]
        role_name = position["role_name"]
        jd_markdown = position["jd_markdown"] or ""

        state = session_store.get_graph_state(session_id)
        # Gather all skills
        internal_req = state.get("accepted_internal_skills", [])
        market_req = state.get("accepted_market_skills", [])
        
        # Safe extraction if they are dicts or lists
        def extract_names(skills_list):
            if not skills_list: return []
            return [s["name"] if isinstance(s, dict) and "name" in s else str(s) for s in skills_list]

        all_skills = list(set(extract_names(internal_req) + extract_names(market_req)))
        if not all_skills:
            all_skills = ["Communication", "Problem Solving"]  # Fallback

        # 2. Source Candidates
        print(f"🔍 [Pipeline] Sourcing candidates for {role_name}...")
        adapter = get_source_adapter("simulation")
        query = CandidateSearchQuery(
            role_name=role_name,
            skills=all_skills,
            experience_min=2,
            experience_max=8,
            location="Any",
            max_results=8
        )
        
        candidates = await adapter.search_candidates(query)
        print(f"✅ [Pipeline] Found {len(candidates)} candidates.")

        # 3. Save candidates & Run ATS Scoring
        db_candidates = []
        for c in candidates:
            try:
                db_id = add_candidate(
                    org_id=org_id,
                    position_id=position_id,
                    name=c.name,
                    email=c.email,
                    phone=c.phone,
                    resume_text=c.resume_summary,
                    source=adapter.source_name,
                    skill_match_score=0.0  # Will be updated by ATS
                )
                db_candidates.append({
                    "id": db_id,
                    "resume_text": c.resume_summary
                })
            except Exception as e:
                print(f"⚠️ [Pipeline] Failed to save candidate {c.name}: {e}")

        # ATS Scoring
        print(f"🤖 [Pipeline] Running ATS scoring for {len(db_candidates)} candidates...")
        for c in db_candidates:
            try:
                score_result = score_candidate(
                    resume_text=c["resume_text"],
                    jd_requirements=jd_markdown[:2000], # Pass truncated JD as requirements
                    required_skills=all_skills
                )
                
                # Update candidate inside DB
                with get_connection() as conn:
                    conn.execute("""
                        UPDATE candidates
                        SET skill_match_score = ?, screening_data = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    """, (score_result["match_score"], json.dumps(score_result), c["id"]))
            except Exception as e:
                print(f"⚠️ [Pipeline] ATS Scoring failed for candidate {c['id']}: {e}")

        print(f"🎉 [Pipeline] Candidate pipeline completed for {role_name}!")

        # 4. Create Notification
        add_notification(
            org_id=org_id,
            type="pipeline_complete",
            title=f"Candidates Ready: {role_name}",
            message=f"We have successfully sourced and scored {len(db_candidates)} candidates for your open position.",
            session_id=session_id
        )

    except Exception as e:
        print(f"❌ [Pipeline] Fatal error: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        add_notification(
            org_id=org_id,
            type="pipeline_error",
            title=f"Pipeline Failed",
            session_id=session_id
        )

async def send_outreach_emails_task(candidate_ids: list[int], position_id: int, role_name: str, org_id: int, session_id: str):
    """
    Background worker for sending mass email outreach.
    """
    try:
        results = []
        
        # Get org name
        with get_connection() as conn:
            org = conn.execute(
                "SELECT name FROM organizations WHERE id = ?", (org_id,)
            ).fetchone()
            org_name = org["name"] if org else "Our Company"
            
        for candidate_id in candidate_ids:
            with get_connection() as conn:
                candidate = conn.execute(
                    "SELECT * FROM candidates WHERE id = ?", (candidate_id,)
                ).fetchone()

            if not candidate:
                results.append({"candidate_id": candidate_id, "success": False, "message": "Not found"})
                continue
                
            try:
                result = await send_outreach_email(
                    candidate_id=candidate_id,
                    candidate_name=candidate["name"],
                    candidate_email=candidate["email"],
                    role_name=role_name,
                    org_name=org_name,
                    match_score=candidate["skill_match_score"] or 0,
                    position_id=position_id,
                )
                if result["success"]:
                    with get_connection() as conn:
                        conn.execute("UPDATE candidates SET status = 'emailed', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (candidate_id,))
                results.append({"candidate_id": candidate_id, **result})
            except Exception as e:
                results.append({"candidate_id": candidate_id, "success": False, "message": str(e)})

        success_count = sum(1 for r in results if r.get("success"))
        
        add_notification(
            org_id=org_id,
            type="emails_sent",
            title="📧 Outreach Complete",
            message=f"{success_count}/{len(candidate_ids)} emails sent for {role_name}",
            session_id=session_id
        )
        print(f"📧 [Pipeline] Successfully sent {success_count}/{len(candidate_ids)} emails for {role_name}.")
    except Exception as e:
        print(f"❌ [Pipeline] Email Outreach Error: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        add_notification(
            org_id=org_id,
            type="emails_error",
            title="Outreach Failed",
            message=f"There was an issue sending emails for {role_name}.",
            session_id=session_id
        )
