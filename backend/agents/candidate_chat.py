"""
agents/candidate_chat.py – Linear candidate application chat controller.
Per docs/design/pages/05_jd_chat.md Part 2 — 8-step flow:
  greeting → interest → current_role → experience → compensation →
  notice_period → resume_upload → screening_questions → completion
"""
import json
import logging
from typing import AsyncGenerator, Optional

from backend.adapters.llm.factory import get_llm

logger = logging.getLogger(__name__)

# ── Step definitions ──────────────────────────────────────────────────────────
STEPS = [
    "greeting",
    "interest",
    "current_role",
    "experience",
    "compensation",
    "notice_period",
    "resume_upload",
    "screening_questions",
    "completion",
]


class CandidateChatController:
    """
    Stateless controller — all state is passed in and returned.
    session_state dict keys:
      step: str
      candidate_name: str
      org_name: str
      role_name: str
      role_area: str
      current_title: str
      current_company: str
      experience_years: int
      relevant_experience_years: int
      compensation_current: str
      compensation_expected: str
      compensation_declined: bool
      notice_period: str
      resume_uploaded: bool
      screening_questions: list[dict]
      screening_index: int
      screening_responses: dict
      messages: list[dict]
    """

    def __init__(self, session_state: dict, context: dict):
        self.state = session_state
        self.context = context  # {position, org, candidate, screening_questions}
        self.llm = get_llm(temperature=0.4, max_tokens=400)

    async def process_message(
        self, user_message: Optional[str], action: Optional[str] = None
    ) -> tuple[str, dict]:
        """
        Process one candidate message. Returns (ai_response, updated_state).
        """
        step = self.state.get("step", "greeting")

        if step == "greeting":
            return await self._step_greeting()

        elif step == "interest":
            return await self._step_interest(user_message)

        elif step == "current_role":
            return await self._step_current_role(user_message)

        elif step == "experience":
            return await self._step_experience(user_message)

        elif step == "compensation":
            return await self._step_compensation(user_message)

        elif step == "notice_period":
            return await self._step_notice_period(user_message)

        elif step == "resume_upload":
            # Resume upload handled separately via file endpoint
            # If user sends a message without uploading, remind them
            return await self._step_resume_reminder(user_message)

        elif step == "screening_questions":
            return await self._step_screening(user_message)

        elif step == "completion":
            return "Your application has already been submitted. Good luck! 🍀", self.state

        else:
            return await self._step_greeting()

    async def _step_greeting(self) -> tuple[str, dict]:
        """Initial greeting — step 1."""
        pos = self.context.get("position", {})
        org = self.context.get("org", {})
        candidate = self.context.get("candidate", {})

        name = candidate.get("name", "there")
        org_name = org.get("name", "the company")
        role_name = pos.get("role_name", "this role")

        msg = (
            f"Hi {name}! 👋\n\n"
            f"I'm an AI assistant for {org_name}'s hiring team. We came across your "
            f"profile and think you might be a great fit for our **{role_name}** role.\n\n"
            f"This will take about 3–4 minutes. Before we begin — are you currently "
            f"open to exploring this opportunity?"
        )

        self.state["step"] = "interest"
        self.state["candidate_name"] = name
        self.state["org_name"] = org_name
        self.state["role_name"] = role_name
        return msg, self.state

    async def _step_interest(self, user_message: str) -> tuple[str, dict]:
        """Detect yes/no interest."""
        msg_lower = (user_message or "").lower()
        declined_keywords = ["no", "not interested", "no thanks", "nope", "not now"]
        is_declined = any(kw in msg_lower for kw in declined_keywords)

        if is_declined:
            self.state["step"] = "declined"
            self.state["not_interested"] = True
            return (
                "No problem at all! We appreciate you letting us know. Your profile "
                "will be noted for future opportunities that might be a better fit.\n\n"
                "Best of luck! 🍀",
                self.state
            )

        # Interested → start the short profiling sequence
        self.state["step"] = "current_role"

        return (
            "Wonderful! Let's get started.\n\n"
            "First, what's your **current role and company**? "
            "(e.g. \"Senior Backend Engineer at Acme\")",
            self.state
        )

    async def _step_current_role(self, user_message: str) -> tuple[str, dict]:
        """Capture current title + company, then ask about experience."""
        answer = (user_message or "").strip()
        # Naive split on " at " — store the whole thing as title if no split.
        if " at " in answer.lower():
            title, _, company = answer.partition(" at ")
            self.state["current_title"] = title.strip()
            self.state["current_company"] = company.strip()
        else:
            self.state["current_title"] = answer
            self.state["current_company"] = None

        self.state["step"] = "experience"
        return (
            "Thanks! How many **years of experience** do you have overall, and how "
            "many are directly relevant to this role?",
            self.state
        )

    async def _step_experience(self, user_message: str) -> tuple[str, dict]:
        """Capture experience (stored as free text), then ask compensation."""
        self.state["experience_years"] = (user_message or "").strip()
        self.state["step"] = "compensation"
        return (
            "Got it. What's your **current and expected compensation** (CTC)? "
            "Feel free to say \"prefer not to say\" if you'd rather skip this.",
            self.state
        )

    async def _step_compensation(self, user_message: str) -> tuple[str, dict]:
        """Capture compensation (or a decline), then ask notice period."""
        answer = (user_message or "").strip()
        decline_kw = ["prefer not", "skip", "rather not", "decline", "n/a", "later"]
        if any(kw in answer.lower() for kw in decline_kw):
            self.state["compensation_declined"] = True
        else:
            self.state["compensation_current"] = answer
        self.state["step"] = "notice_period"
        return (
            "No problem. Lastly — what's your **notice period / availability** to start?",
            self.state
        )

    async def _step_notice_period(self, user_message: str) -> tuple[str, dict]:
        """Capture notice period, then move to resume upload."""
        self.state["notice_period"] = (user_message or "").strip()
        self.state["step"] = "resume_upload"
        return (
            "Perfect — almost done!\n\n"
            "Please share your latest resume. "
            "You can upload a **PDF or Word document** (max 5MB).",
            self.state
        )

    async def _step_resume_reminder(self, user_message: str) -> tuple[str, dict]:
        """Remind candidate to upload resume if they message without uploading."""
        return (
            "Please upload your resume to continue — you can upload a PDF or DOCX file using the button below. 📎",
            self.state
        )

    async def _step_screening(self, user_message: str) -> tuple[str, dict]:
        """Ask screening questions one at a time."""
        questions = self.context.get("screening_questions", [])
        idx = self.state.get("screening_index", 0)

        if not self.state.get("screening_responses"):
            self.state["screening_responses"] = {}

        # Save previous answer if there was a question being asked
        if idx > 0 and questions:
            prev_q = questions[idx - 1]
            self.state["screening_responses"][prev_q.get("field_key")] = user_message

        # Check if more questions remain
        if idx < len(questions):
            q = questions[idx]
            self.state["screening_index"] = idx + 1
            label = q.get("label") or q.get("question", "")
            return f"One more question — {label}", self.state
        else:
            # All questions done → completion
            return await self._step_complete()

    async def _step_complete(self) -> tuple[str, dict]:
        """Final completion message."""
        pos = self.context.get("position", {})
        org = self.context.get("org", {})
        role_name = pos.get("role_name", "the role")
        org_name = org.get("name", "the company")

        self.state["step"] = "completion"
        # Application is fully submitted here (the /message endpoint auto-completes on
        # step == "completion": status→applied, confirmation email, ATS dispatch). The
        # video intro below is a purely optional post-submission add-on — skipping or
        # abandoning it never affects the submitted application.
        self.state["video_offer"] = True
        return (
            f"That's everything! 🎉\n\n"
            f"Your application for **{role_name}** at **{org_name}** has been submitted.\n\n"
            f"Here's what to expect next:\n"
            f"• Our hiring team will review your profile shortly\n"
            f"• If shortlisted, you'll receive an email with interview details\n"
            f"• We'll keep you updated at each stage\n\n"
            f"📹 **Optional:** want to stand out? Record a short 30–60s video intro using "
            f"the button below — it's completely optional and your application is already in.\n\n"
            f"Good luck! 🍀",
            self.state
        )

