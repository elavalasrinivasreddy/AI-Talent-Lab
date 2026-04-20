"""
celery_app.py – Celery + Redis configuration.
Background task worker with beat schedule for periodic tasks.
See docs/BACKEND_PLAN.md §16.
"""
from celery import Celery
from backend.config import settings

celery_app = Celery(
    "talentlab",
    broker=settings.celery_broker,
    backend=settings.REDIS_URL,
    include=[
        "backend.tasks.candidate_pipeline",
        "backend.tasks.email_outreach",
        "backend.tasks.scheduled_search",
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
}
