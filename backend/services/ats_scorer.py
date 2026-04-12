"""
services/ats_scorer.py – ATS (Applicant Tracking System) Resume Scoring

Extracts skills from resume text using LLM, compares against position
requirements, and computes a match percentage.
"""
import json
from backend.config import get_llm
from langchain_core.messages import SystemMessage, HumanMessage


def score_candidate(resume_text: str, jd_requirements: str, required_skills: list[str] = None) -> dict:
    """
    Score a candidate's resume against position requirements.
    
    Returns:
        {
            "match_score": 85.0,
            "matched_skills": ["Python", "React", ...],
            "missing_skills": ["Kubernetes", ...],
            "additional_skills": ["GraphQL", ...],
            "experience_analysis": "...",
            "recommendation": "Strong Match" | "Good Match" | "Partial Match" | "Weak Match"
        }
    """
    llm = get_llm()

    prompt = f"""Analyze this candidate's resume against the job requirements and provide a skill match assessment.

JOB REQUIREMENTS:
{jd_requirements}

{f"REQUIRED SKILLS: {', '.join(required_skills)}" if required_skills else ""}

CANDIDATE RESUME:
{resume_text[:3000]}

Provide your analysis as a JSON object with these fields:
- match_score: number 0-100 (percentage of how well the candidate matches)
- matched_skills: list of skills the candidate has that match the requirements
- missing_skills: list of required skills the candidate lacks
- additional_skills: list of extra relevant skills the candidate has
- experience_analysis: brief 1-2 sentence assessment of their experience level
- recommendation: one of "Strong Match" (80+), "Good Match" (60-79), "Partial Match" (40-59), "Weak Match" (below 40)

Output ONLY valid JSON. No markdown, no explanation.
"""

    response = llm.invoke([
        SystemMessage(content="You are an expert ATS system. Analyze resumes objectively. Output only valid JSON."),
        HumanMessage(content=prompt),
    ])

    try:
        text = response.content.strip()
        if text.startswith("{"):
            result = json.loads(text)
        else:
            import re
            match = re.search(r"\{.*\}", text, re.DOTALL)
            if match:
                result = json.loads(match.group(0))
            else:
                result = _fallback_score(resume_text, required_skills or [])
    except (json.JSONDecodeError, Exception):
        result = _fallback_score(resume_text, required_skills or [])

    # Ensure all fields exist
    result.setdefault("match_score", 0)
    result.setdefault("matched_skills", [])
    result.setdefault("missing_skills", [])
    result.setdefault("additional_skills", [])
    result.setdefault("experience_analysis", "Unable to analyze")
    result.setdefault("recommendation", _get_recommendation(result["match_score"]))

    return result


def _get_recommendation(score: float) -> str:
    if score >= 80:
        return "Strong Match"
    elif score >= 60:
        return "Good Match"
    elif score >= 40:
        return "Partial Match"
    else:
        return "Weak Match"


def _fallback_score(resume_text: str, required_skills: list[str]) -> dict:
    """Simple keyword-based fallback if LLM fails."""
    resume_lower = resume_text.lower()
    matched = [s for s in required_skills if s.lower() in resume_lower]
    missing = [s for s in required_skills if s.lower() not in resume_lower]
    score = (len(matched) / max(len(required_skills), 1)) * 100

    return {
        "match_score": round(score, 1),
        "matched_skills": matched,
        "missing_skills": missing,
        "additional_skills": [],
        "experience_analysis": "Keyword-based analysis (LLM unavailable)",
        "recommendation": _get_recommendation(score),
    }
