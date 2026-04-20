"""
exceptions.py – Custom exception classes and global FastAPI exception handler.
All exceptions produce the standard error format:
{"error": {"code": "SNAKE_CASE", "message": "...", "details": null}}
See docs/BACKEND_PLAN.md §11.
"""
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import logging

logger = logging.getLogger(__name__)


# ── Base Exception ─────────────────────────────────────────────────────────────

class AppError(Exception):
    """Base application error."""

    def __init__(self, code: str, message: str, status_code: int = 400, details: dict = None):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details
        super().__init__(message)


# ── Auth Errors ────────────────────────────────────────────────────────────────

class InvalidCredentialsError(AppError):
    def __init__(self, message: str = "Invalid email or password"):
        super().__init__("INVALID_CREDENTIALS", message, 401)


class TokenExpiredError(AppError):
    def __init__(self, message: str = "Token has expired"):
        super().__init__("TOKEN_EXPIRED", message, 401)


class InsufficientPermissionsError(AppError):
    def __init__(self, message: str = "Insufficient permissions"):
        super().__init__("INSUFFICIENT_PERMISSIONS", message, 403)


class AccountLockedError(AppError):
    def __init__(self, message: str = "Account locked. Try again later."):
        super().__init__("ACCOUNT_LOCKED", message, 423)


# ── Resource Errors ────────────────────────────────────────────────────────────

class NotFoundError(AppError):
    def __init__(self, message: str = "Resource not found"):
        super().__init__("NOT_FOUND", message, 404)


class AlreadyExistsError(AppError):
    def __init__(self, message: str = "Resource already exists"):
        super().__init__("ALREADY_EXISTS", message, 409)


class ValidationError(AppError):
    def __init__(self, message: str = "Validation error", details: dict = None):
        super().__init__("VALIDATION_ERROR", message, 422, details)


# ── Position Errors ────────────────────────────────────────────────────────────

class PositionClosedError(AppError):
    def __init__(self, message: str = "This position is no longer open"):
        super().__init__("POSITION_CLOSED", message, 400)


# ── Magic Link Errors ──────────────────────────────────────────────────────────

class MagicLinkExpiredError(AppError):
    def __init__(self, message: str = "This link has expired"):
        super().__init__("MAGIC_LINK_EXPIRED", message, 410)


class MagicLinkUsedError(AppError):
    def __init__(self, message: str = "This link has already been used"):
        super().__init__("MAGIC_LINK_USED", message, 410)


# ── Candidate Errors ──────────────────────────────────────────────────────────

class CandidateAlreadyAppliedError(AppError):
    def __init__(self, message: str = "You have already applied for this position"):
        super().__init__("CANDIDATE_ALREADY_APPLIED", message, 409)


class FeedbackAlreadySubmittedError(AppError):
    def __init__(self, message: str = "Feedback has already been submitted"):
        super().__init__("FEEDBACK_ALREADY_SUBMITTED", message, 409)


# ── External Service Errors ───────────────────────────────────────────────────

class LLMError(AppError):
    def __init__(self, message: str = "AI service error. Please try again."):
        super().__init__("LLM_ERROR", message, 502)


class SearchError(AppError):
    def __init__(self, message: str = "Search service error"):
        super().__init__("SEARCH_ERROR", message, 502)


class EmailError(AppError):
    def __init__(self, message: str = "Email service error"):
        super().__init__("EMAIL_ERROR", message, 502)


class UploadError(AppError):
    def __init__(self, message: str = "File upload error"):
        super().__init__("UPLOAD_ERROR", message, 400)


# ── Global Exception Handlers ─────────────────────────────────────────────────

def register_exception_handlers(app: FastAPI) -> None:
    """Register all global exception handlers on the FastAPI app."""

    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "details": exc.details,
                }
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        errors = exc.errors()
        logger.warning(f"Validation error on {request.method} {request.url}: {errors}")
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Request validation failed",
                    "details": errors,
                }
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception(f"Unhandled error on {request.method} {request.url}: {exc}")
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "An unexpected error occurred",
                    "details": None,
                }
            },
        )
