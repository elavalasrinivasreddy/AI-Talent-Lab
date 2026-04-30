"""
agents/interview_kit.py – AI interview kit generator.
Called by PositionService.generate_interview_kit().
"""
import json
import logging

from backend.adapters.llm.factory import get_llm

logger = logging.getLogger(__name__)


async def generate_interview_kit(jd_markdown: str, role_name: str) -> dict:
    """
    Generate structured interview questions and scorecard from the JD.
    Returns: { questions: [...], scorecard_template: [...] }
    """
    try:
        llm = get_llm(temperature=0.3, max_tokens=3000)
        prompt = f"""Generate a structured interview kit for this role.

Role: {role_name}

Job Description:
{jd_markdown[:3000]}

Return ONLY valid JSON with this structure:
{{
  "questions": [
    {{
      "question": "Tell me about a time you...",
      "type": "behavioral",
      "difficulty": "medium",
      "what_to_look_for": "Look for STAR format, specific examples...",
      "follow_ups": ["Can you give another example?", "What was the outcome?"]
    }}
  ],
  "scorecard_template": [
    {{
      "dimension": "Technical Depth",
      "description": "Assesses candidate's technical knowledge and depth",
      "rating_scale": ["1 - Poor", "2 - Below Average", "3 - Average", "4 - Good", "5 - Excellent"]
    }}
  ]
}}

Generate 8-10 diverse questions covering:
- 3 technical/skills questions specific to the role
- 3 behavioral questions (STAR format)
- 2 situational/problem-solving questions
- 1 culture/values question
- 1 career motivation question

Scorecard: 5 evaluation dimensions relevant to this role."""

        response = await llm.ainvoke([{"role": "user", "content": prompt}])
        content = response.content.strip()

        if "```json" in content:
            content = content.split("```json")[-1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].strip()

        result = json.loads(content)
        logger.info(f"Generated interview kit: {len(result.get('questions', []))} questions")
        return result

    except Exception as e:
        logger.error(f"Interview kit generation failed: {e}", exc_info=True)
        # Return minimal fallback kit
        return {
            "questions": [
                {
                    "question": f"Tell me about your experience with the skills required for the {role_name} role.",
                    "type": "technical",
                    "difficulty": "medium",
                    "what_to_look_for": "Look for specific, relevant examples with measurable impact.",
                    "follow_ups": ["Can you walk me through a specific project?", "What was the outcome?"]
                },
                {
                    "question": "Describe a challenging problem you solved. Walk me through your approach.",
                    "type": "behavioral",
                    "difficulty": "medium",
                    "what_to_look_for": "Structured thinking, problem decomposition, resilience.",
                    "follow_ups": ["What would you do differently?"]
                },
                {
                    "question": "Why are you interested in this role and our company?",
                    "type": "motivation",
                    "difficulty": "easy",
                    "what_to_look_for": "Genuine interest, alignment with role, company research.",
                    "follow_ups": []
                }
            ],
            "scorecard_template": [
                {"dimension": "Technical Skills", "description": "Domain expertise and technical proficiency", "rating_scale": ["1 - Poor", "2 - Below Average", "3 - Average", "4 - Good", "5 - Excellent"]},
                {"dimension": "Problem Solving", "description": "Analytical thinking and approach to challenges", "rating_scale": ["1 - Poor", "2 - Below Average", "3 - Average", "4 - Good", "5 - Excellent"]},
                {"dimension": "Communication", "description": "Clarity, structure, and listening", "rating_scale": ["1 - Poor", "2 - Below Average", "3 - Average", "4 - Good", "5 - Excellent"]},
                {"dimension": "Culture Fit", "description": "Values alignment and team collaboration", "rating_scale": ["1 - Poor", "2 - Below Average", "3 - Average", "4 - Good", "5 - Excellent"]},
            ]
        }
