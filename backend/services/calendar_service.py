"""
services/calendar_service.py – Calendar integration service.

Adapter pattern: swap MockCalendarAdapter for GoogleCalendarAdapter
by setting CALENDAR_PROVIDER=google in env.

MockCalendarAdapter: returns realistic fake free/busy and meeting links.
GoogleCalendarAdapter: placeholder — requires GOOGLE_CALENDAR_CREDENTIALS env var.
"""
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger(__name__)

CALENDAR_PROVIDER = os.getenv("CALENDAR_PROVIDER", "mock")


class CalendarSlot:
    def __init__(self, start: datetime, end: datetime, all_available: bool, busy_users: list[str]):
        self.start = start
        self.end = end
        self.all_available = all_available
        self.busy_users = busy_users  # names of panelists who are busy

    def to_dict(self):
        return {
            "start": self.start.isoformat(),
            "end": self.end.isoformat(),
            "all_available": self.all_available,
            "busy_users": self.busy_users,
        }


class MockCalendarAdapter:
    """
    Returns deterministic fake availability for dev/staging.
    Mimics real Google Calendar responses so the UI can be built end-to-end.
    """

    @staticmethod
    async def get_free_slots(
        panelist_emails: list[str],
        duration_minutes: int = 60,
        days_ahead: int = 5,
    ) -> list[CalendarSlot]:
        """Return available time slots for the next `days_ahead` working days."""
        slots = []
        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        # Start from next working hour
        start_day = now + timedelta(hours=1)
        if start_day.hour >= 18:
            start_day = (start_day + timedelta(days=1)).replace(hour=9)

        working_hours = [9, 10, 11, 14, 15, 16]  # slots at these hours
        days_added = 0
        current = start_day.replace(hour=9)

        while days_added < days_ahead:
            # Skip weekends
            if current.weekday() >= 5:
                current += timedelta(days=1)
                continue

            for hour in working_hours:
                slot_start = current.replace(hour=hour, minute=0)
                slot_end = slot_start + timedelta(minutes=duration_minutes)

                # Deterministically mark some slots as busy based on hash
                busy = []
                for email in panelist_emails:
                    if (hash(email + str(slot_start.date()) + str(hour)) % 5) == 0:
                        busy.append(email.split("@")[0])

                slots.append(CalendarSlot(
                    start=slot_start,
                    end=slot_end,
                    all_available=len(busy) == 0,
                    busy_users=busy,
                ))

            current += timedelta(days=1)
            days_added += 1

        return slots

    @staticmethod
    async def create_event(
        title: str,
        start: datetime,
        duration_minutes: int,
        attendee_emails: list[str],
        description: str = "",
    ) -> dict:
        """Return a mock calendar event with a fake Meet link."""
        import uuid
        meet_code = uuid.uuid4().hex[:10]
        return {
            "event_id": f"mock_{uuid.uuid4().hex[:16]}",
            "meeting_link": f"https://meet.google.com/{meet_code[:3]}-{meet_code[3:7]}-{meet_code[7:]}",
            "calendar_provider": "mock",
            "start": start.isoformat(),
            "end": (start + timedelta(minutes=duration_minutes)).isoformat(),
            "attendees": attendee_emails,
        }


class GoogleCalendarAdapter:
    """
    Real Google Calendar integration.
    Requires: GOOGLE_CALENDAR_CREDENTIALS env var (service account JSON path or inline JSON).
    Not activated until CALENDAR_PROVIDER=google is set.
    """

    @staticmethod
    async def get_free_slots(
        panelist_emails: list[str],
        duration_minutes: int = 60,
        days_ahead: int = 5,
    ) -> list[CalendarSlot]:
        raise NotImplementedError(
            "Google Calendar not configured. Set CALENDAR_PROVIDER=mock or configure GOOGLE_CALENDAR_CREDENTIALS."
        )

    @staticmethod
    async def create_event(
        title: str,
        start: datetime,
        duration_minutes: int,
        attendee_emails: list[str],
        description: str = "",
    ) -> dict:
        raise NotImplementedError(
            "Google Calendar not configured. Set CALENDAR_PROVIDER=mock or configure GOOGLE_CALENDAR_CREDENTIALS."
        )


def get_calendar_adapter():
    if CALENDAR_PROVIDER == "google":
        return GoogleCalendarAdapter
    return MockCalendarAdapter


class CalendarService:

    @staticmethod
    async def get_availability(
        panelist_emails: list[str],
        duration_minutes: int = 60,
        days_ahead: int = 5,
    ) -> list[dict]:
        adapter = get_calendar_adapter()
        slots = await adapter.get_free_slots(panelist_emails, duration_minutes, days_ahead)
        return [s.to_dict() for s in slots]

    @staticmethod
    async def create_interview_event(
        position_name: str,
        candidate_name: str,
        round_name: str,
        start: datetime,
        duration_minutes: int,
        panelist_emails: list[str],
    ) -> dict:
        title = f"{round_name} — {candidate_name} for {position_name}"
        description = f"Interview for {position_name}\nCandidate: {candidate_name}\nRound: {round_name}"
        adapter = get_calendar_adapter()
        event = await adapter.create_event(
            title=title,
            start=start,
            duration_minutes=duration_minutes,
            attendee_emails=panelist_emails,
            description=description,
        )
        logger.info(f"Calendar event created: {event.get('event_id')} (provider: {event.get('calendar_provider')})")
        return event
