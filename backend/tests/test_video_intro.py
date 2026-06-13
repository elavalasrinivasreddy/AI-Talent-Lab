"""
Unit test for the optional post-submission video intro (Sprint 4, Phase D#3).

Guards the contract that finishing the apply chat:
  - sets step == "completion" (so POST /apply/{token}/message auto-completes the
    application: status→applied, confirmation email, ATS dispatch),
  - flags video_offer = True (the video is an optional post-submission add-on),
  - invites the optional video in the completion message while making clear the
    application is already submitted.

This locks the design decision that abandoning/skipping the video never affects
the already-submitted application. Deterministic — no DB, no live LLM.
"""
from unittest.mock import patch, MagicMock

import pytest

from backend.agents.candidate_chat import CandidateChatController


@pytest.mark.asyncio
async def test_step_complete_offers_optional_video():
    with patch("backend.agents.candidate_chat.get_llm", return_value=MagicMock()):
        state = {"step": "screening_questions"}
        context = {
            "position": {"role_name": "Backend Engineer"},
            "org": {"name": "Acme"},
            "candidate": {"name": "Jordan"},
        }
        controller = CandidateChatController(state, context)
        message, new_state = await controller._step_complete()

    # Application is considered submitted at this step (drives auto-complete).
    assert new_state["step"] == "completion"
    # Optional add-on is offered.
    assert new_state.get("video_offer") is True
    # Message invites the optional video and frames the application as already in.
    lower = message.lower()
    assert "video" in lower
    assert "optional" in lower
    assert "submitted" in lower
