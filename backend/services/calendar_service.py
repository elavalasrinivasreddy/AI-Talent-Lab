"""
services/calendar_service.py – Calendar integration service.

Adapter pattern: swap MockCalendarAdapter for GoogleCalendarAdapter
by setting CALENDAR_PROVIDER=google in env.

MockCalendarAdapter: returns realistic fake free/busy and meeting links.
GoogleCalendarAdapter: real Google Calendar integration via the freebusy +
    events APIs. Activated when CALENDAR_PROVIDER=google AND a credentials
    blob is provided via GOOGLE_CALENDAR_CREDENTIALS. See docs/integrations/
    calendar.md for the one-time credential setup.
"""
import asyncio
import json
import logging
import os
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

CALENDAR_PROVIDER = os.getenv("CALENDAR_PROVIDER", "mock")

# Slot grid shared by both adapters so the UI behaves identically regardless of
# provider: working days only, fixed candidate hours, configurable duration.
_WORKING_HOURS = [9, 10, 11, 14, 15, 16]
# Default calendar to read/write against (a single inbox for personal Gmail, or
# "primary" of the service account / connected user).
_GOOGLE_CALENDAR_ID = os.getenv("GOOGLE_CALENDAR_ID", "primary")
_GOOGLE_TIMEZONE = os.getenv("GOOGLE_CALENDAR_TIMEZONE", "Asia/Kolkata")
_GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.readonly",
]


def _iter_candidate_slots(duration_minutes: int, days_ahead: int):
    """Yield (slot_start, slot_end) UTC datetimes over the next working days.

    Single source of truth for the slot grid so MockCalendarAdapter and
    GoogleCalendarAdapter present the exact same candidate slots — only their
    busy/free verdict differs.
    """
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    current = (now + timedelta(hours=1)).replace(hour=9)
    days_added = 0
    while days_added < days_ahead:
        if current.weekday() >= 5:  # skip Sat/Sun
            current += timedelta(days=1)
            continue
        for hour in _WORKING_HOURS:
            slot_start = current.replace(hour=hour, minute=0)
            yield slot_start, slot_start + timedelta(minutes=duration_minutes)
        current += timedelta(days=1)
        days_added += 1


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
        for slot_start, slot_end in _iter_candidate_slots(duration_minutes, days_ahead):
            # Deterministically mark some slots as busy based on hash
            busy = []
            for email in panelist_emails:
                if (hash(email + str(slot_start.date()) + str(slot_start.hour)) % 5) == 0:
                    busy.append(email.split("@")[0])

            slots.append(CalendarSlot(
                start=slot_start,
                end=slot_end,
                all_available=len(busy) == 0,
                busy_users=busy,
            ))
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


class CalendarCredentialError(RuntimeError):
    """Raised when Google credentials are missing or malformed at setup time."""


def _load_google_credentials():
    """Build a google.oauth2 Credentials object from GOOGLE_CALENDAR_CREDENTIALS.

    The env var may be either:
      * a path to a JSON file, or
      * the JSON blob itself (inline).

    Two credential shapes are auto-detected:
      * service account  — JSON with "type": "service_account"
        (optionally impersonating GOOGLE_CALENDAR_SUBJECT via domain-wide delegation)
      * authorized user  — JSON with a "refresh_token" (the file produced by an
        OAuth consent flow; works with an individual Gmail account)

    Raises CalendarCredentialError on any problem so the caller can fall back to
    mock with a clear log line instead of crashing scheduling.
    """
    raw = os.getenv("GOOGLE_CALENDAR_CREDENTIALS")
    if not raw or not raw.strip():
        raise CalendarCredentialError(
            "GOOGLE_CALENDAR_CREDENTIALS is not set. Provide a service-account or "
            "authorized-user JSON (path or inline). See docs/integrations/calendar.md."
        )

    raw = raw.strip()
    if os.path.exists(raw):
        with open(raw, "r", encoding="utf-8") as fh:
            info = json.load(fh)
    else:
        try:
            info = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise CalendarCredentialError(
                "GOOGLE_CALENDAR_CREDENTIALS is neither a readable file path nor valid JSON."
            ) from exc

    try:
        if info.get("type") == "service_account":
            from google.oauth2 import service_account

            creds = service_account.Credentials.from_service_account_info(
                info, scopes=_GOOGLE_SCOPES
            )
            subject = os.getenv("GOOGLE_CALENDAR_SUBJECT")
            if subject:
                # Domain-wide delegation: act as a specific Workspace user.
                creds = creds.with_subject(subject)
            return creds

        # Authorized-user (OAuth) credentials — has a refresh_token.
        from google.oauth2.credentials import Credentials

        return Credentials.from_authorized_user_info(info, scopes=_GOOGLE_SCOPES)
    except ImportError as exc:  # libraries not installed
        raise CalendarCredentialError(
            "Google API client libraries are not installed. Add "
            "google-api-python-client, google-auth and google-auth-oauthlib to "
            "the environment (see backend/requirements.txt)."
        ) from exc
    except Exception as exc:  # malformed credential payload
        raise CalendarCredentialError(f"Could not build Google credentials: {exc}") from exc


class GoogleCalendarAdapter:
    """
    Real Google Calendar integration via the Calendar v3 freebusy + events APIs.

    Activated when CALENDAR_PROVIDER=google and GOOGLE_CALENDAR_CREDENTIALS holds
    valid credentials. The Google client is synchronous, so every network call is
    pushed to a worker thread to keep the event loop free.
    """

    def __init__(self):
        self._credentials = _load_google_credentials()
        self._service = None  # built lazily inside a thread

    def _build_service(self):
        """Construct (and cache) the Calendar service. Called inside a thread."""
        if self._service is None:
            from googleapiclient.discovery import build

            self._service = build(
                "calendar", "v3", credentials=self._credentials, cache_discovery=False
            )
        return self._service

    def _freebusy_sync(
        self, panelist_emails: list[str], time_min: datetime, time_max: datetime
    ) -> dict[str, list[tuple[datetime, datetime]]]:
        service = self._build_service()
        body = {
            "timeMin": time_min.isoformat(),
            "timeMax": time_max.isoformat(),
            "items": [{"id": email} for email in panelist_emails],
        }
        result = service.freebusy().query(body=body).execute()
        calendars = result.get("calendars", {})
        busy_by_email: dict[str, list[tuple[datetime, datetime]]] = {}
        for email in panelist_emails:
            intervals = []
            for b in calendars.get(email, {}).get("busy", []):
                try:
                    bs = datetime.fromisoformat(b["start"].replace("Z", "+00:00"))
                    be = datetime.fromisoformat(b["end"].replace("Z", "+00:00"))
                    intervals.append((bs, be))
                except (KeyError, ValueError):
                    continue
            busy_by_email[email] = intervals
        return busy_by_email

    async def get_free_slots(
        self,
        panelist_emails: list[str],
        duration_minutes: int = 60,
        days_ahead: int = 5,
    ) -> list["CalendarSlot"]:
        """Return real availability by overlaying the candidate slot grid on the
        panelists' Google free/busy data."""
        slots = list(_iter_candidate_slots(duration_minutes, days_ahead))
        if not slots:
            return []
        window_start = min(s for s, _ in slots)
        window_end = max(e for _, e in slots)

        busy_by_email = await asyncio.to_thread(
            self._freebusy_sync, panelist_emails, window_start, window_end
        )

        out: list[CalendarSlot] = []
        for slot_start, slot_end in slots:
            busy_users = []
            for email in panelist_emails:
                for bs, be in busy_by_email.get(email, []):
                    if slot_start < be and slot_end > bs:  # overlap
                        busy_users.append(email.split("@")[0])
                        break
            out.append(CalendarSlot(
                start=slot_start,
                end=slot_end,
                all_available=len(busy_users) == 0,
                busy_users=busy_users,
            ))
        return out

    def _create_event_sync(
        self, title, start, duration_minutes, attendee_emails, description
    ) -> dict:
        import uuid

        service = self._build_service()
        end = start + timedelta(minutes=duration_minutes)
        event_body = {
            "summary": title,
            "description": description,
            "start": {"dateTime": start.isoformat(), "timeZone": _GOOGLE_TIMEZONE},
            "end": {"dateTime": end.isoformat(), "timeZone": _GOOGLE_TIMEZONE},
            "attendees": [{"email": e} for e in attendee_emails],
            "conferenceData": {
                "createRequest": {
                    "requestId": uuid.uuid4().hex,
                    "conferenceSolutionKey": {"type": "hangoutsMeet"},
                }
            },
            "reminders": {
                "useDefault": False,
                "overrides": [
                    {"method": "email", "minutes": 60},
                    {"method": "popup", "minutes": 15},
                ],
            },
        }
        created = service.events().insert(
            calendarId=_GOOGLE_CALENDAR_ID,
            body=event_body,
            conferenceDataVersion=1,
            sendUpdates="all",
        ).execute()

        meeting_link = ""
        for ep in created.get("conferenceData", {}).get("entryPoints", []):
            if ep.get("entryPointType") == "video" and ep.get("uri"):
                meeting_link = ep["uri"]
                break
        if not meeting_link:
            meeting_link = created.get("hangoutLink", "")

        return {
            "event_id": created["id"],
            "meeting_link": meeting_link,
            "html_link": created.get("htmlLink", ""),
            "calendar_provider": "google",
            "start": start.isoformat(),
            "end": end.isoformat(),
            "attendees": attendee_emails,
        }

    async def create_event(
        self,
        title: str,
        start: datetime,
        duration_minutes: int,
        attendee_emails: list[str],
        description: str = "",
    ) -> dict:
        return await asyncio.to_thread(
            self._create_event_sync,
            title, start, duration_minutes, attendee_emails, description,
        )


# Cache the activated Google adapter so we don't rebuild credentials per call.
_google_adapter_singleton: "GoogleCalendarAdapter | None" = None


def get_calendar_adapter():
    """Return the active calendar adapter.

    When CALENDAR_PROVIDER=google we try to build a real GoogleCalendarAdapter.
    If credentials are missing/invalid or the client libs aren't installed, we
    fall back to MockCalendarAdapter with a loud warning rather than crashing
    interview scheduling — the rest of the app keeps working on mock slots.
    """
    global _google_adapter_singleton
    if CALENDAR_PROVIDER == "google":
        if _google_adapter_singleton is not None:
            return _google_adapter_singleton
        try:
            _google_adapter_singleton = GoogleCalendarAdapter()
            logger.info("Google Calendar adapter activated (calendar_id=%s).", _GOOGLE_CALENDAR_ID)
            return _google_adapter_singleton
        except CalendarCredentialError as exc:
            logger.warning(
                "CALENDAR_PROVIDER=google but the Google adapter could not be "
                "activated (%s); falling back to MockCalendarAdapter.", exc
            )
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
