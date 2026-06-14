"""
Unit tests for the redesigned apply-chat flow
(see docs/decisions/apply-chat-flow-redesign.md).

Flow: greeting → interest → screening_questions → resume_upload → video_intro → completion.
The application is submitted at resume upload (ApplyService.handle_resume_upload);
the video intro is an optional post-submission add-on. These are deterministic
controller-level tests — no DB, no live LLM.
"""
from unittest.mock import patch, MagicMock

import pytest

from backend.agents.candidate_chat import CandidateChatController


def _controller(state, questions=None):
    if questions is None:
        questions = [{"field_key": "current_ctc", "label": "Current CTC"}]
    with patch("backend.agents.candidate_chat.get_llm", return_value=MagicMock()):
        return CandidateChatController(state, {
            "position": {"role_name": "Backend Engineer"},
            "org": {"name": "Acme"},
            "candidate": {"name": "Jordan"},
            "screening_questions": questions,
        })


@pytest.mark.asyncio
async def test_interest_starts_configured_screening_questions():
    """After 'yes', the bot asks the head's configured questions — no built-ins."""
    controller = _controller({"step": "interest"})
    message, new_state = await controller.process_message("yes, interested")
    assert new_state["step"] == "screening_questions"
    assert "Current CTC" in message
    # Built-in profiling prompts must be gone.
    assert "current role and company" not in message.lower()


@pytest.mark.asyncio
async def test_interest_with_no_questions_skips_to_resume():
    controller = _controller({"step": "interest"}, questions=[])
    message, new_state = await controller.process_message("yes")
    assert new_state["step"] == "resume_upload"
    assert "resume" in message.lower()


@pytest.mark.asyncio
async def test_screening_completion_advances_to_resume_not_completion():
    """The last screening answer is captured by field_key and the bot then asks
    for the resume (submission happens at resume upload, not here)."""
    state = {"step": "screening_questions", "screening_index": 1, "screening_responses": {}}
    controller = _controller(state)
    message, new_state = await controller.process_message("25 LPA")
    assert new_state["step"] == "resume_upload"
    assert "resume" in message.lower()
    assert new_state["screening_responses"]["current_ctc"] == "25 LPA"


@pytest.mark.asyncio
async def test_video_step_reminder_frames_app_as_submitted():
    controller = _controller({"step": "video_intro"})
    message, new_state = await controller.process_message("hi")
    lower = message.lower()
    assert "submitted" in lower
    assert "video" in lower
    assert new_state["step"] == "video_intro"
