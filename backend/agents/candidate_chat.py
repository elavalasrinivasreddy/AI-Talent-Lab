"""
agents/candidate_chat.py – Linear candidate application chat controller.
Flow (see docs/decisions/apply-chat-flow-redesign.md):
  greeting → interest → screening_questions → resume_upload → video_intro → completion

There are no built-in profiling questions. The hiring head's configured screening
questions are the single source of truth; the application is submitted right after
the resume upload (see ApplyService.handle_resume_upload), and the video intro is
an optional post-submission add-on.
"""
import logging
from typing import Optional

from backend.adapters.llm.factory import get_llm

logger = logging.getLogger(__name__)

# ── Step definitions ──────────────────────────────────────────────────────────
STEPS = [
    "greeting",
    "interest",
    "screening_questions",
    "resume_upload",
    "video_intro",
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

        elif step == "screening_questions":
            return await self._step_screening(user_message)

        elif step == "resume_upload":
            # Resume upload handled separately via the file endpoint.
            # If the candidate sends a message without uploading, remind them.
            return await self._step_resume_reminder(user_message)

        elif step == "video_intro":
            # Video is optional and handled via the upload-video endpoint / skip
            # button. A text message here just nudges toward the buttons.
            return await self._step_video_reminder(user_message)

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

        # Interested → ask the head's configured screening questions. If none are
        # configured, skip straight to the resume upload.
        questions = self.context.get("screening_questions", [])
        if questions:
            self.state["step"] = "screening_questions"
            self.state["screening_index"] = 0
            return await self._step_screening(None)

        self.state["step"] = "resume_upload"
        return self._resume_prompt("Wonderful! Let's get started.\n\n")

    def _resume_prompt(self, prefix: str = "") -> tuple[str, dict]:
        """Shared resume-upload prompt. Sets step to resume_upload by convention
        of the caller (caller must set self.state['step'] = 'resume_upload')."""
        return (
            f"{prefix}Please share your latest resume — a "
            "**PDF or Word document** (max 5MB) — using the button below. 📎",
            self.state,
        )

    async def _step_resume_reminder(self, user_message: Optional[str]) -> tuple[str, dict]:
        """Remind candidate to upload resume if they message without uploading."""
        return (
            "Please upload your resume to continue — use the button below to upload "
            "a PDF or DOCX file. 📎",
            self.state
        )

    async def _step_video_reminder(self, user_message: Optional[str]) -> tuple[str, dict]:
        """Nudge toward the optional video buttons. The application is already
        submitted at this point, so there is nothing left to capture here."""
        return (
            "Your application is already submitted ✅ — you can add an optional video "
            "intro with the button below, or you're all done. Good luck! 🍀",
            self.state
        )

    async def _step_screening(self, user_message: Optional[str]) -> tuple[str, dict]:
        """Ask the configured screening questions one at a time, then move to
        resume upload once they're all answered."""
        questions = self.context.get("screening_questions", [])
        idx = self.state.get("screening_index", 0)

        if not self.state.get("screening_responses"):
            self.state["screening_responses"] = {}

        # Save the previous answer (keyed by the question's field_key) if one was
        # being asked. idx==0 means we haven't asked anything yet (first entry).
        if 0 < idx <= len(questions):
            prev_q = questions[idx - 1]
            self.state["screening_responses"][prev_q.get("field_key")] = user_message

        # More questions remain?
        if idx < len(questions):
            q = questions[idx]
            self.state["screening_index"] = idx + 1
            label = q.get("label") or q.get("question", "")
            if idx == 0:
                return f"Great — just a few quick questions.\n\n**{label}**", self.state
            return f"Thanks! **{label}**", self.state

        # All screening questions answered → ask for the resume.
        self.state["step"] = "resume_upload"
        return self._resume_prompt("Thanks — almost done!\n\n")

