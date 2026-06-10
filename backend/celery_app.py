"""
celery_app.py – Celery + Redis configuration.
Background task worker with beat schedule for periodic tasks.
See docs/architecture/03_backend.md §16.
"""
from celery import Celery
from backend.config import settings

celery_app = Celery(
    "talentlab",
    broker=settings.celery_broker,
    backend=settings.REDIS_URL,
    include=[
        "backend.tasks.candidate_pipeline",
        "backend.tasks.pre_eval_grade",
        "backend.tasks.email_outreach",
        "backend.tasks.scheduled_search",
        "backend.tasks.gdpr_cleanup",
        "backend.tasks.copilot_analysis",
        "backend.tasks.auth_cleanup",
        "backend.tasks.hire_request_locks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    timezone="Asia/Kolkata",
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_max_retries=3,
    task_default_retry_delay=60,
)

# Beat schedule — periodic tasks
celery_app.conf.beat_schedule = {
    "run-scheduled-searches": {
        "task": "backend.tasks.scheduled_search.run_scheduled_searches",
        "schedule": 3600.0,  # every hour
    },
    "send-followup-reminders": {
        "task": "backend.tasks.email_outreach.send_followup_reminders",
        "schedule": 3600.0,  # every hour
    },
    "batch-grade-pre-evaluations": {
        "task": "tasks.pre_eval_grade",
        "schedule": 10800.0,  # every 3 hours
    },
    "gdpr-retention-cleanup": {
        "task": "backend.tasks.gdpr_cleanup.cleanup_expired_data",
        "schedule": 604800.0,  # every 7 days (weekly)
    },
    "gdpr-process-deletions": {
        "task": "backend.tasks.gdpr_cleanup.process_verified_deletions",
        "schedule": 3600.0,  # every hour
    },
    "copilot-suggestions": {
        "task": "backend.tasks.copilot_analysis.generate_copilot_suggestions",
        "schedule": 3600.0,  # every hour
    },
    "auth-cleanup-consumed-magic-links": {
        "task": "backend.tasks.auth_cleanup.cleanup_consumed_magic_links",
        "schedule": 86400.0,  # every 24 hours (daily)
    },
    "release-stale-review-locks": {
        "task": "backend.tasks.hire_request_locks.release_stale_review_locks",
        "schedule": 300.0,  # every 5 minutes
    },
}
