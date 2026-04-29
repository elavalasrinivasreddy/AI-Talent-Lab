"""
agents/tools/role_extractor.py – Extract job title from free-text messages.
Uses LLM with zero-shot structured output (temperature=0.0) for deterministic extraction.
Falls back to None if extraction fails — never crashes the pipeline.
"""
import json
import logging
from typing import Optional

from backend.adapters.llm.factory import get_llm

logger = logging.getLogger(__name__)

EXTRACTION_PROMPT = """You are a precise job title extractor. Given a user message about hiring, extract ONLY the job title/role name.

Rules:
- Return ONLY a JSON object: {"role": "extracted title"} or {"role": null}
- Extract the main job title, not descriptions or qualifications
- Normalize common abbreviations (e.g., "SDE" → "Software Development Engineer")
- Keep seniority level (e.g., "Senior", "Lead", "Staff", "Principal")
- If no clear role is mentioned, return {"role": null}
- NEVER add text outside the JSON object

Examples:
User: "I need a senior python developer with 5 years experience"
Output: {"role": "Senior Python Developer"}

User: "Looking for someone to lead our data team, ML focus"
Output: {"role": "Lead Data Scientist"}

User: "We need to hire for the backend"
Output: {"role": "Backend Developer"}

User: "what's your name?"
Output: {"role": null}
"""


async def extract_role(text: str) -> Optional[str]:
    """
    Extract a job title from free-text user message.

    Args:
        text: User's message text.

    Returns:
        Extracted role title string, or None if no role found.
    """
    try:
        llm = get_llm(temperature=0.0, max_tokens=100)

        messages = [
            {"role": "system", "content": EXTRACTION_PROMPT},
            {"role": "user", "content": text},
        ]

        response = await llm.ainvoke(messages)
        content = response.content.strip()

        # Strip markdown code fences if present
        if content.startswith("```"):
            content = content.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        result = json.loads(content)
        role = result.get("role")

        if role:
            logger.info(f"Extracted role: '{role}' from: '{text[:60]}...'")
        else:
            logger.info(f"No role found in: '{text[:60]}...'")

        return role

    except json.JSONDecodeError as e:
        logger.warning(f"Role extractor JSON parse error: {e}")
        return None
    except Exception as e:
        logger.warning(f"Role extraction failed: {e}")
        return None
