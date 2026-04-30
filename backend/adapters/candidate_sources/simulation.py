"""
adapters/candidate_sources/simulation.py – SimulationAdapter
LLM-based realistic candidate simulation for MVP/demo.
Produces realistic candidate profiles matching the JD requirements.
"""
import json
import logging
import random
import re
import string
from typing import Optional

from backend.adapters.candidate_sources.base import CandidateSourceAdapter
from backend.adapters.llm.factory import get_llm

logger = logging.getLogger(__name__)

# Indian cities weighted by IT job market
CITIES = [
    "Bangalore", "Hyderabad", "Pune", "Chennai", "Mumbai",
    "Delhi NCR", "Noida", "Gurugram", "Kolkata", "Ahmedabad"
]

COMPANIES = [
    "TCS", "Infosys", "Wipro", "HCL Technologies", "Tech Mahindra",
    "Accenture India", "IBM India", "Cognizant", "Capgemini", "Mphasis",
    "Freshworks", "Zoho", "Razorpay", "PhonePe", "Swiggy", "Zomato",
    "Flipkart", "Meesho", "Groww", "CRED", "Paytm", "OYO",
    "Amazon India", "Google India", "Microsoft India", "Oracle India",
    "SAP Labs India", "Adobe India", "Salesforce India", "Atlassian India"
]


def _make_email(name: str) -> str:
    clean = re.sub(r"[^a-z]", "", name.lower())
    num = random.randint(1, 999)
    domains = ["gmail.com", "outlook.com", "yahoo.com", "hotmail.com"]
    return f"{clean}{num}@{random.choice(domains)}"


def _resume_text(name: str, title: str, company: str, exp: int, skills: list[str], location: str) -> str:
    """Generate a realistic plain-text resume snippet."""
    company2 = random.choice(COMPANIES)
    years_current = random.randint(1, min(exp, 4))
    years_prev = exp - years_current
    prev_title = title.replace("Senior", "").replace("Lead", "").strip() or "Developer"

    return f"""{name}
{title}
{location} · {_make_email(name)} · +91-{random.randint(9000000000, 9999999999)}

EXPERIENCE

{title} — {company} (2024–Present, {years_current} year{'s' if years_current > 1 else ''})
• Built and maintained production systems serving millions of users
• Led technical discussions and code reviews for the team
• Worked closely with product and design to ship features on time
• Key skills used: {', '.join(skills[:4])}

{'Associate ' if years_prev < 3 else ''}{prev_title} — {company2} (2021–2024, {years_prev} years)
• Developed backend services and APIs
• Collaborated with cross-functional teams in an Agile environment
• Skills: {', '.join(skills[2:6] if len(skills) > 4 else skills)}

EDUCATION
B.Tech, Computer Science — {random.choice(['IIT Bombay', 'NIT Trichy', 'BITS Pilani', 'VIT Vellore', 'Manipal University'])} ({2024 - exp - 4})

SKILLS
{', '.join(skills)}

CERTIFICATIONS
{random.choice(['AWS Certified Developer', 'GCP Professional', 'Azure Developer', 'Certified Kubernetes Administrator', 'PMP', 'Scrum Master'])}
"""


class SimulationAdapter(CandidateSourceAdapter):
    """
    Uses the LLM to generate realistic candidate profiles for a given position.
    Falls back to template-based generation if LLM fails.
    """

    async def search(self, position: dict, org: dict, limit: int = 20) -> list[dict]:
        role_name = position.get("role_name", "Software Engineer")
        experience_min = position.get("experience_min") or 2
        experience_max = position.get("experience_max") or 8
        location = position.get("location") or "Bangalore"

        # Extract skills from JD markdown (rough extraction)
        jd_text = position.get("jd_markdown") or ""
        # Try LLM-based generation first
        try:
            candidates = await self._llm_generate(
                role_name, experience_min, experience_max, location, jd_text, limit
            )
            if candidates:
                return candidates
        except Exception as e:
            logger.warning(f"LLM candidate generation failed, using template fallback: {e}")

        # Template-based fallback
        return self._template_generate(role_name, experience_min, experience_max, location, limit)

    async def _llm_generate(
        self, role_name: str, exp_min: int, exp_max: int, location: str, jd_text: str, count: int
    ) -> list[dict]:
        """Ask LLM to generate realistic candidate profiles."""
        llm = get_llm(temperature=0.9, max_tokens=3000)
        prompt = f"""Generate {min(count, 10)} realistic Indian software job candidate profiles for the role: {role_name}

Requirements from JD:
{jd_text[:1500]}

Experience range: {exp_min}–{exp_max} years

Return ONLY a JSON array with this exact structure (no markdown, no extra text):
[
  {{
    "name": "Full Name",
    "email": "unique@email.com",
    "phone": "+91-9XXXXXXXXX",
    "current_title": "...",
    "current_company": "Indian company name",
    "experience_years": 5,
    "location": "Indian city",
    "source_profile_url": "https://linkedin.com/in/profile-slug",
    "skills_summary": "Comma-separated list of their key skills",
    "resume_summary": "2-3 sentence professional summary"
  }}
]

Make profiles diverse: 60% strong matches, 30% moderate, 10% weak.
Use realistic Indian names and companies."""

        response = await llm.ainvoke([{"role": "user", "content": prompt}])
        content = response.content.strip()

        # Strip markdown if present
        if "```json" in content:
            content = content.split("```json")[-1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].strip()

        profiles = json.loads(content)
        results = []
        for p in profiles:
            name = p.get("name", "Test Candidate")
            skills_text = p.get("skills_summary", "")
            skills = [s.strip() for s in skills_text.split(",") if s.strip()]
            exp = p.get("experience_years") or random.randint(exp_min, exp_max)
            company = p.get("current_company", random.choice(COMPANIES))
            title = p.get("current_title", role_name)
            loc = p.get("location", location)

            results.append({
                "name": name,
                "email": p.get("email") or _make_email(name),
                "phone": p.get("phone"),
                "current_title": title,
                "current_company": company,
                "experience_years": exp,
                "location": loc,
                "source": "simulation",
                "source_profile_url": p.get("source_profile_url"),
                "resume_text": _resume_text(name, title, company, exp, skills, loc),
            })
        return results

    def _template_generate(
        self, role_name: str, exp_min: int, exp_max: int, location: str, count: int
    ) -> list[dict]:
        """Template-based fallback when LLM fails."""
        # Extract likely tech stack from role name
        tech_map = {
            "python": ["Python", "FastAPI", "Django", "PostgreSQL", "Redis", "Docker", "AWS"],
            "frontend": ["React", "TypeScript", "JavaScript", "CSS", "HTML", "Redux", "Webpack"],
            "java": ["Java", "Spring Boot", "Maven", "Hibernate", "MySQL", "Docker", "Kubernetes"],
            "devops": ["Kubernetes", "Docker", "Terraform", "AWS", "CI/CD", "Ansible", "Linux"],
            "data": ["Python", "SQL", "Pandas", "Spark", "Airflow", "Machine Learning", "TensorFlow"],
            "ml": ["Python", "TensorFlow", "PyTorch", "Scikit-learn", "NLP", "MLOps", "AWS SageMaker"],
            "mobile": ["React Native", "Flutter", "iOS", "Android", "Swift", "Kotlin", "Firebase"],
        }
        role_lower = role_name.lower()
        base_skills = ["Git", "Agile", "REST APIs", "Linux"]
        for key, skills in tech_map.items():
            if key in role_lower:
                base_skills = skills + base_skills
                break
        else:
            base_skills = ["Python", "SQL", "REST APIs", "Docker", "Git", "Agile"] + base_skills

        first_names = ["Rahul", "Priya", "Amit", "Neha", "Sanjay", "Ananya", "Vikram", "Pooja",
                       "Arjun", "Divya", "Karan", "Sneha", "Rohan", "Kavya", "Aditya", "Shreya",
                       "Varun", "Nidhi", "Suresh", "Pallavi", "Ravi", "Meera", "Nikhil", "Sona"]
        last_names = ["Kumar", "Sharma", "Singh", "Patel", "Reddy", "Nair", "Iyer", "Gupta",
                      "Mehta", "Rao", "Joshi", "Malhotra", "Bose", "Pillai", "Khanna", "Verma"]

        results = []
        used_emails = set()
        for i in range(count):
            fname = random.choice(first_names)
            lname = random.choice(last_names)
            name = f"{fname} {lname}"
            email = _make_email(name)
            while email in used_emails:
                email = _make_email(name)
            used_emails.add(email)

            exp = random.randint(exp_min, exp_max)
            company = random.choice(COMPANIES)
            city = random.choice(CITIES)
            # Shuffle skills for diversity
            skills = base_skills.copy()
            random.shuffle(skills)
            skills = skills[:random.randint(4, min(8, len(skills)))]

            results.append({
                "name": name,
                "email": email,
                "phone": f"+91-{random.randint(9000000000, 9999999999)}",
                "current_title": role_name,
                "current_company": company,
                "experience_years": exp,
                "location": city,
                "source": "simulation",
                "source_profile_url": f"https://linkedin.com/in/{name.lower().replace(' ', '-')}-{random.randint(100,999)}",
                "resume_text": _resume_text(name, role_name, company, exp, skills, city),
            })
        return results
