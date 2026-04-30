"""
agents/candidate_chat.py – Linear candidate application chat controller.
Per docs/pages/12_chat_flows.md Part 2 — 8-step flow:
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

        # Interested → move to current role
        candidate = self.context.get("candidate", {})
        current_title = candidate.get("current_title")
        current_company = candidate.get("current_company")

        self.state["step"] = "current_role"

        if current_title and current_company:
            msg = (
                f"Wonderful! Let's get started.\n\n"
                f"We have you listed as **{current_title}** at **{current_company}** — "
                f"is that still your current role?"
            )
            self.state["has_profile"] = True
        else:
            msg = "Wonderful! Could you share your current role and company?"
            self.state["has_profile"] = False

        return msg, self.state

    async def _step_current_role(self, user_message: str) -> tuple[str, dict]:
        """Confirm or update current role."""
        msg_lower = (user_message or "").lower()
        affirmative = ["yes", "correct", "right", "that's right", "yep", "yeah", "sure"]

        if self.state.get("has_profile") and any(kw in msg_lower for kw in affirmative):
            # Confirmed — no change needed
            candidate = self.context.get("candidate", {})
            self.state["current_title"] = candidate.get("current_title")
            self.state["current_company"] = candidate.get("current_company")
        else:
            # Parse updated role/company from message using LLM
            parsed = await self._llm_parse_role(user_message)
            self.state["current_title"] = parsed.get("title", user_message)
            self.state["current_company"] = parsed.get("company", "")

        self.state["step"] = "experience"
        role_name = self.state.get("role_name", "this role")
        # Infer role area from role name
        role_area = role_name.replace("Senior ", "").replace("Lead ", "").replace("Principal ", "")

        return (
            f"Got it!\n\n"
            f"How many years of total professional experience do you have?\n\n"
            f"And of those, how many are directly relevant to {role_area}?",
            self.state
        )

    async def _step_experience(self, user_message: str) -> tuple[str, dict]:
        """Extract experience years."""
        parsed = await self._llm_parse_experience(user_message)
        total = parsed.get("total_years")
        relevant = parsed.get("relevant_years")

        self.state["experience_years"] = total
        self.state["relevant_experience_years"] = relevant
        self.state["step"] = "compensation"

        if total and relevant:
            confirm = f"Got it — {total} years total, {relevant} years of directly relevant experience."
        elif total:
            confirm = f"Got it — {total} years of total experience."
        else:
            confirm = "Got it, thank you!"

        return (
            f"{confirm}\n\n"
            "A couple of questions about compensation — this helps ensure "
            "the role is the right fit for both of us:\n\n"
            "1. What is your current annual CTC?\n"
            "2. What are you expecting for this role?\n\n"
            "*(You can skip this if you prefer — just say \"skip\")*",
            self.state
        )

    async def _step_compensation(self, user_message: str) -> tuple[str, dict]:
        """Collect CTC details or handle decline."""
        msg_lower = (user_message or "").lower()
        skip_kws = ["skip", "prefer not", "decline", "rather not", "no thanks", "pass"]

        if any(kw in msg_lower for kw in skip_kws):
            self.state["compensation_declined"] = True
            self.state["compensation_current"] = "declined"
            self.state["compensation_expected"] = "declined"
        else:
            parsed = await self._llm_parse_compensation(user_message)
            self.state["compensation_current"] = parsed.get("current_ctc", user_message)
            self.state["compensation_expected"] = parsed.get("expected_ctc", "")
            self.state["compensation_declined"] = False

        self.state["step"] = "notice_period"
        return (
            "Thank you!\n\n"
            "What is your notice period at your current company?\n\n"
            "*(If you're between jobs or immediately available, just let me know!)*",
            self.state
        )

    async def _step_notice_period(self, user_message: str) -> tuple[str, dict]:
        """Record notice period."""
        self.state["notice_period"] = (user_message or "").strip()
        self.state["step"] = "resume_upload"

        return (
            "Almost done! Please share your latest resume.\n\n"
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
        return (
            f"That's everything! 🎉\n\n"
            f"Your application for **{role_name}** at **{org_name}** has been submitted.\n\n"
            f"Here's what to expect next:\n"
            f"• Our hiring team will review your profile shortly\n"
            f"• If shortlisted, you'll receive an email with interview details\n"
            f"• We'll keep you updated at each stage\n\n"
            f"Good luck! 🍀",
            self.state
        )

    # ── LLM helpers ────────────────────────────────────────────────────────────

    async def _llm_parse_role(self, text: str) -> dict:
        try:
            resp = await self.llm.ainvoke([{
                "role": "user",
                "content": (
                    f'Extract the job title and company from this text. Return ONLY JSON.\n'
                    f'Text: "{text}"\n'
                    f'Return: {{"title": "...", "company": "..."}}'
                )
            }])
            content = resp.content.strip()
            if "```" in content:
                content = content.split("```")[1].strip()
                if content.startswith("json"):
                    content = content[4:].strip()
            return json.loads(content)
        except Exception:
            return {"title": text, "company": ""}

    async def _llm_parse_experience(self, text: str) -> dict:
        try:
            resp = await self.llm.ainvoke([{
                "role": "user",
                "content": (
                    f'Extract total years and relevant years of experience from: "{text}"\n'
                    f'Return ONLY JSON: {{"total_years": 5, "relevant_years": 3}}\n'
                    f'Use null if not mentioned.'
                )
            }])
            content = resp.content.strip()
            if "```" in content:
                content = content.split("```")[1].strip()
                if content.startswith("json"):
                    content = content[4:].strip()
            return json.loads(content)
        except Exception:
            return {"total_years": None, "relevant_years": None}

    async def _llm_parse_compensation(self, text: str) -> dict:
        try:
            resp = await self.llm.ainvoke([{
                "role": "user",
                "content": (
                    f'Extract current CTC and expected CTC from: "{text}"\n'
                    f'Return ONLY JSON: {{"current_ctc": "12 LPA", "expected_ctc": "18 LPA"}}\n'
                    f'Use null if not mentioned.'
                )
            }])
            content = resp.content.strip()
            if "```" in content:
                content = content.split("```")[1].strip()
                if content.startswith("json"):
                    content = content[4:].strip()
            return json.loads(content)
        except Exception:
            return {"current_ctc": text, "expected_ctc": None}
