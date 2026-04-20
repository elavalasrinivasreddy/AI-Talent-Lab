"""
utils/validators.py – Input validation utilities.
Password strength, email format validation.
Reused across register and change-password flows.
"""
import re
from backend.exceptions import ValidationError


def validate_password(password: str) -> None:
    """
    Validate password strength:
    - Minimum 8 characters
    - At least 1 uppercase letter
    - At least 1 number
    - At least 1 special character
    Raises ValidationError if requirements not met.
    """
    errors = []

    if len(password) < 8:
        errors.append("Password must be at least 8 characters long")
    if not re.search(r"[A-Z]", password):
        errors.append("Password must contain at least 1 uppercase letter")
    if not re.search(r"\d", password):
        errors.append("Password must contain at least 1 number")
    if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?~`]", password):
        errors.append("Password must contain at least 1 special character")

    if errors:
        raise ValidationError(
            message="Password does not meet requirements",
            details={"password": errors},
        )


def validate_email(email: str) -> str:
    """
    Validate email format and normalize (lowercase, strip).
    Returns normalized email. Raises ValidationError if invalid.
    """
    email = email.strip().lower()
    pattern = r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
    if not re.match(pattern, email):
        raise ValidationError(
            message="Invalid email format",
            details={"email": ["Please provide a valid email address"]},
        )
    return email


def generate_slug(name: str) -> str:
    """
    Generate URL slug from organization name.
    Rules: lowercase, spaces → hyphens, strip special chars, max 50 chars.
    Example: "TechCorp AI" → "techcorp-ai"
    """
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)  # Remove special chars
    slug = re.sub(r"\s+", "-", slug)  # Spaces → hyphens
    slug = re.sub(r"-+", "-", slug)  # Collapse multiple hyphens
    slug = slug.strip("-")
    return slug[:50]
