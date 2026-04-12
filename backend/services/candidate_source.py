"""
services/candidate_source.py – Candidate Sourcing with Adapter Pattern

Provides a unified interface for sourcing candidates from multiple platforms.
Currently implements SimulationAdapter (LLM-generated realistic candidates).
Real adapters (LinkedIn, Naukri, Monster) can be swapped in with zero changes
to the rest of the system.
"""
import json
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field, asdict
from typing import Optional
from backend.config import get_llm
from langchain_core.messages import SystemMessage, HumanMessage


# ── Data Models ───────────────────────────────────────────────────────────────

@dataclass
class CandidateSearchQuery:
    role_name: str
    skills: list[str]
    experience_min: int = 0
    experience_max: int = 20
    location: str = "Any"
    max_results: int = 10

@dataclass
class CandidateResult:
    id: str = ""
    name: str = ""
    email: str = ""
    phone: str = ""
    title: str = ""
    company: str = ""
    experience_years: int = 0
    skills: list[str] = field(default_factory=list)
    location: str = ""
    source: str = "simulation"
    resume_summary: str = ""
    profile_url: str = ""
    match_score: float = 0.0


# ── Abstract Adapter ──────────────────────────────────────────────────────────

class CandidateSourceAdapter(ABC):
    """
    Abstract interface for candidate sourcing.
    Implement this for each job portal (LinkedIn, Naukri, Monster).
    """

    @abstractmethod
    async def search_candidates(self, query: CandidateSearchQuery) -> list[CandidateResult]:
        """Search for candidates matching the query."""
        ...

    @abstractmethod
    async def get_candidate_profile(self, candidate_id: str) -> Optional[CandidateResult]:
        """Get detailed profile for a specific candidate."""
        ...

    @property
    @abstractmethod
    def source_name(self) -> str:
        """Name of this source (e.g., 'linkedin', 'naukri')."""
        ...


# ── Simulation Adapter ───────────────────────────────────────────────────────

class SimulationAdapter(CandidateSourceAdapter):
    """
    Generates realistic but synthetic candidate profiles using LLM.
    Mirrors the exact contract real adapters will use — zero changes needed
    when swapping to LinkedIn/Naukri APIs later.
    """

    @property
    def source_name(self) -> str:
        return "simulation"

    async def search_candidates(self, query: CandidateSearchQuery) -> list[CandidateResult]:
        llm = get_llm()

        prompt = f"""Generate {query.max_results} realistic but fictional candidate profiles for this role:

Role: {query.role_name}
Required Skills: {', '.join(query.skills)}
Experience Range: {query.experience_min}-{query.experience_max} years
Location: {query.location}

For each candidate, generate:
- name (realistic Indian/international name)
- email (professional email format, use example.com domain)
- phone (10-digit number starting with +91)
- title (current job title)
- company (realistic company name)
- experience_years (integer)
- skills (list of 5-8 relevant skills, must overlap with required skills)
- location (city, country)
- resume_summary (2-3 sentence professional summary)
- match_score (0-100, percentage match to the required skills)

Output ONLY a valid JSON array. No markdown, no explanation.
Example format:
[
  {{
    "name": "Rahul Kumar",
    "email": "rahul.kumar@example.com",
    "phone": "+919876543210",
    "title": "Senior Developer",
    "company": "TechCorp",
    "experience_years": 6,
    "skills": ["Python", "React", "AWS"],
    "location": "Bangalore, India",
    "resume_summary": "Experienced developer with 6 years...",
    "match_score": 85
  }}
]"""

        response = llm.invoke([
            SystemMessage(content="You are a data generator. Output only valid JSON arrays. No markdown."),
            HumanMessage(content=prompt),
        ])

        try:
            text = response.content.strip()
            # Extract JSON array
            if text.startswith("["):
                candidates_data = json.loads(text)
            else:
                import re
                match = re.search(r"\[.*\]", text, re.DOTALL)
                if match:
                    candidates_data = json.loads(match.group(0))
                else:
                    candidates_data = []
        except (json.JSONDecodeError, Exception):
            candidates_data = []

        results = []
        for item in candidates_data[:query.max_results]:
            results.append(CandidateResult(
                id=f"sim-{uuid.uuid4().hex[:8]}",
                name=item.get("name", "Unknown"),
                email=item.get("email", ""),
                phone=item.get("phone", ""),
                title=item.get("title", ""),
                company=item.get("company", ""),
                experience_years=item.get("experience_years", 0),
                skills=item.get("skills", []),
                location=item.get("location", ""),
                source="simulation",
                resume_summary=item.get("resume_summary", ""),
                match_score=item.get("match_score", 0.0),
            ))

        return results

    async def get_candidate_profile(self, candidate_id: str) -> Optional[CandidateResult]:
        # Simulation doesn't persist profiles — return None
        return None


# ── Future Adapters (stubs) ───────────────────────────────────────────────────

class LinkedInAdapter(CandidateSourceAdapter):
    """LinkedIn Recruiter API adapter. Requires enterprise partnership."""

    def __init__(self, api_key: str = "", client_secret: str = ""):
        self.api_key = api_key
        self.client_secret = client_secret

    @property
    def source_name(self) -> str:
        return "linkedin"

    async def search_candidates(self, query: CandidateSearchQuery) -> list[CandidateResult]:
        raise NotImplementedError("LinkedIn API requires enterprise partnership. Configure API keys.")

    async def get_candidate_profile(self, candidate_id: str) -> Optional[CandidateResult]:
        raise NotImplementedError("LinkedIn API requires enterprise partnership.")


class NaukriAdapter(CandidateSourceAdapter):
    """Naukri candidate search adapter. Requires paid subscription."""

    @property
    def source_name(self) -> str:
        return "naukri"

    async def search_candidates(self, query: CandidateSearchQuery) -> list[CandidateResult]:
        raise NotImplementedError("Naukri API requires paid enterprise subscription.")

    async def get_candidate_profile(self, candidate_id: str) -> Optional[CandidateResult]:
        raise NotImplementedError("Naukri API requires paid enterprise subscription.")


# ── Factory ───────────────────────────────────────────────────────────────────

def get_source_adapter(source: str = "simulation") -> CandidateSourceAdapter:
    """Factory function to get the appropriate source adapter."""
    adapters = {
        "simulation": SimulationAdapter,
        "linkedin": LinkedInAdapter,
        "naukri": NaukriAdapter,
    }
    adapter_class = adapters.get(source, SimulationAdapter)
    return adapter_class()
