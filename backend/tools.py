"""
tools.py – Utility tools for the Hiring Agent.
Small focused functions used by agent.py.
"""
from backend.config import get_llm

# Role extraction prompt — inline since it's a one-liner
_ROLE_EXTRACT_PROMPT = """Extract the job role or position name from the following user message.
Return ONLY the role/position name as a clean title (e.g., "Senior Python Developer", "Product Manager").
If no clear role is found, return "New Position".
Do NOT return any explanation, just the role title.

User message: {message}"""


def extract_role_name_from_message(message: str) -> str:
    """
    Extract the job role/position name from a user message.
    Called on the very first user message to title the chat session.
    """
    llm = get_llm()
    prompt = _ROLE_EXTRACT_PROMPT.format(message=message)
    response = llm.invoke(prompt)
    role = response.content if hasattr(response, "content") else str(response)
    return role.strip().strip('"').strip("'")
