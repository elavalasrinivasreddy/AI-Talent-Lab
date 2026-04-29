"""
agents/bias_checker.py – Standalone async function for bias checking.
Uses zero-shot structured output with temperature=0.0.
SOFT SKIP gracefully on any error.
"""
import json
import logging
import os

from backend.adapters.llm.factory import get_llm

logger = logging.getLogger(__name__)

_PROMPT_PATH = os.path.join(os.path.dirname(__file__), "prompts", "bias_checker.md")

def _load_prompt() -> str:
    with open(_PROMPT_PATH, "r") as f:
        return f.read()


async def check_bias(jd_text: str) -> list[dict]:
    """
    Check JD text for biased/exclusionary language.
    Returns: List of dicts with {"phrase", "category", "suggestion"}
    Soft Skip: On error, returns an empty list, no interruption to JD flow.
    """
    if not jd_text:
        return []

    try:
        llm = get_llm(temperature=0.0, max_tokens=1000)
        system_prompt = _load_prompt()

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Please verify this JD for bias or exclusionary language:\n\n{jd_text}"},
        ]

        logger.info("Running bias check on final JD")
        response = await llm.ainvoke(messages)
        content = response.content.strip()

        if "```json" in content:
            json_str = content.split("```json")[-1].split("```")[0].strip()
        elif "```" in content:
            json_str = content.split("```")[-2].split("```")[-1].strip()
        else:
            json_str = content

        result = json.loads(json_str)
        issues = result.get("issues", [])

        # Validate issue format
        valid_issues = []
        for i in issues:
            if "phrase" in i and "suggestion" in i:
                valid_issues.append({
                    "phrase": i["phrase"],
                    "suggestion": i["suggestion"],
                    "category": i.get("category", "other")
                })

        return valid_issues

    except Exception as e:
        logger.warning(f"Bias check failed (soft skip): {e}")
        return []
