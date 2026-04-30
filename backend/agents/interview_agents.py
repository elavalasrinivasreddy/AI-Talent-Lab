"""
agents/feedback_enricher.py – AI enrichment of panel rough notes into professional feedback.
agents/debrief_generator.py – Synthesize all scorecards into a final hiring recommendation debrief.
agents/rejection_drafter.py – Draft a polished rejection email for a candidate.
"""

# ── Feedback Enricher ─────────────────────────────────────────────────────────

import json
import logging
from typing import Optional
from backend.adapters.llm.factory import get_llm

logger = logging.getLogger(__name__)


async def enrich_feedback(
    strengths_raw: str,
    concerns_raw: str,
    candidate_name: str,
    role_name: str,
    round_name: str,
) -> dict:
    """
    Takes rough panel notes and returns professionally written versions.
    Returns: { strengths_enriched, concerns_enriched }
    """
    llm = get_llm(temperature=0.3, max_tokens=600)

    prompt = f"""You are a professional HR writing assistant.
A panelist interviewed {candidate_name} for the {role_name} role ({round_name}).
They provided rough notes. Rewrite them as clear, professional, specific interview feedback.

Raw strengths: "{strengths_raw}"
Raw concerns: "{concerns_raw}"

Rules:
- Keep the same meaning — don't add opinions not in the original
- Professional tone, 2-4 sentences each section
- Specific and evidence-based, not vague
- Return ONLY valid JSON: {{"strengths": "...", "concerns": "..."}}"""

    try:
        resp = await llm.ainvoke([{"role": "user", "content": prompt}])
        content = resp.content.strip()
        # Strip markdown fences if present
        if "```" in content:
            content = content.split("```")[1].strip()
            if content.startswith("json"):
                content = content[4:].strip()
        return json.loads(content)
    except Exception as e:
        logger.error(f"Feedback enrichment failed: {e}", exc_info=True)
        return {
            "strengths": strengths_raw,
            "concerns": concerns_raw,
        }


# ── Debrief Generator ─────────────────────────────────────────────────────────

async def generate_debrief(
    candidate_name: str,
    role_name: str,
    scorecards: list[dict],
    interview_rounds: list[dict],
) -> str:
    """
    Synthesize all scorecards into a hiring debrief report.
    Returns markdown string.
    """
    llm = get_llm(temperature=0.4, max_tokens=1200)

    scorecards_text = "\n\n".join([
        f"Panelist: {sc.get('panelist_name', 'Unknown')}\n"
        f"Overall Score: {sc.get('overall_score', 'N/A')}/5\n"
        f"Recommendation: {sc.get('recommendation', 'N/A')}\n"
        f"Strengths: {sc.get('strengths') or sc.get('raw_notes_strengths', '')}\n"
        f"Concerns: {sc.get('concerns') or sc.get('raw_notes_concerns', '')}\n"
        f"Comments: {sc.get('additional_comments', '')}"
        for sc in scorecards
    ])

    avg_score = (
        sum(sc.get("overall_score", 0) or 0 for sc in scorecards) / len(scorecards)
        if scorecards else 0
    )
    rec_counts = {}
    for sc in scorecards:
        r = sc.get("recommendation", "neutral")
        rec_counts[r] = rec_counts.get(r, 0) + 1

    prompt = f"""You are a senior HR analyst preparing a hiring debrief report.

Candidate: {candidate_name}
Role: {role_name}
Interview rounds: {len(interview_rounds)}
Average score: {avg_score:.2f}/5
Recommendation counts: {json.dumps(rec_counts)}

Individual panelist feedback:
{scorecards_text}

Write a structured debrief report in markdown with these sections:
## Summary
(2-3 sentences — candidate overview and aggregate recommendation)

## Strengths (Consensus)
(What all/most interviewers agreed on positively)

## Areas of Concern
(Concerns raised, note if they're shared or individual)

## Key Disagreements
(If interviewers disagreed significantly, highlight it)

## AI Recommendation
(Clear recommendation: Proceed / Further Discussion Needed / Do Not Proceed — with rationale)

Be factual, evidence-based, and balanced. Do not fabricate observations."""

    try:
        resp = await llm.ainvoke([{"role": "user", "content": prompt}])
        return resp.content.strip()
    except Exception as e:
        logger.error(f"Debrief generation failed: {e}", exc_info=True)
        return f"""## Interview Debrief — {candidate_name}

**Role:** {role_name}
**Average Score:** {avg_score:.2f} / 5.0
**Panelists:** {len(scorecards)}

*Debrief generation encountered an error. Please review individual scorecards above.*"""


# ── Rejection Drafter ─────────────────────────────────────────────────────────

async def draft_rejection_email(
    candidate_name: str,
    role_name: str,
    org_name: str,
    round_name: Optional[str] = None,
    recruiter_name: Optional[str] = None,
) -> dict:
    """
    Draft a polished, empathetic rejection email.
    Returns: { subject, body }
    """
    llm = get_llm(temperature=0.5, max_tokens=500)

    stage = f"after the {round_name}" if round_name else "after careful consideration"

    prompt = f"""Write a professional, warm rejection email for a job candidate.

Candidate: {candidate_name}
Role: {role_name}
Company: {org_name}
Stage: {stage}
Sender name: {recruiter_name or "Hiring Team"}

Rules:
- Warm and empathetic, not cold or generic
- Specific to the role and company
- Leave door open for future opportunities
- No false promises
- Under 200 words
- Return ONLY valid JSON: {{"subject": "...", "body": "..."}}"""

    try:
        resp = await llm.ainvoke([{"role": "user", "content": prompt}])
        content = resp.content.strip()
        if "```" in content:
            content = content.split("```")[1].strip()
            if content.startswith("json"):
                content = content[4:].strip()
        return json.loads(content)
    except Exception as e:
        logger.error(f"Rejection draft failed: {e}", exc_info=True)
        return {
            "subject": f"Your application for {role_name} at {org_name}",
            "body": (
                f"Dear {candidate_name},\n\n"
                f"Thank you for taking the time to interview for the {role_name} role at {org_name}. "
                f"After careful consideration, we have decided not to move forward with your application {stage}.\n\n"
                f"We appreciate your interest and encourage you to apply for future opportunities.\n\n"
                f"Best regards,\n{recruiter_name or 'Hiring Team'} at {org_name}"
            )
        }
