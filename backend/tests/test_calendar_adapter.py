"""Pure-logic tests for the calendar adapters (no DB, no network, no Google libs).

Covers:
  * the shared candidate-slot grid (weekdays only, fixed hours)
  * MockCalendarAdapter slot/event shape
  * GoogleCalendarAdapter freebusy → slot overlap math (with _freebusy_sync stubbed)
  * get_calendar_adapter() honest fallback to mock when google creds are absent
"""
import os
from datetime import timedelta

import pytest

from backend.services import calendar_service as cal


def test_candidate_slot_grid_weekdays_only():
    slots = list(cal._iter_candidate_slots(60, 3))
    # 3 working days × 6 candidate hours = 18 slots.
    assert len(slots) == 18
    # Never lands on Saturday/Sunday.
    assert all(start.weekday() < 5 for start, _ in slots)
    # Each slot is exactly the requested duration.
    assert all((end - start) == timedelta(minutes=60) for start, end in slots)


@pytest.mark.asyncio
async def test_mock_adapter_shapes():
    slots = await cal.MockCalendarAdapter.get_free_slots(["a@x.com", "b@x.com"], 60, 2)
    assert len(slots) == 12
    d = slots[0].to_dict()
    assert {"start", "end", "all_available", "busy_users"} <= d.keys()

    from datetime import datetime, timezone
    ev = await cal.MockCalendarAdapter.create_event(
        "Round 1", datetime.now(timezone.utc), 45, ["a@x.com"]
    )
    assert ev["calendar_provider"] == "mock"
    assert ev["meeting_link"].startswith("https://meet.google.com/")


@pytest.mark.asyncio
async def test_google_freebusy_overlap_marks_busy(monkeypatch):
    # Build the adapter without running __init__ (which would require real creds).
    adapter = cal.GoogleCalendarAdapter.__new__(cal.GoogleCalendarAdapter)
    slots = list(cal._iter_candidate_slots(60, 2))
    first_start = slots[0][0]

    # Stub the network call: panelist "a" is busy during the first slot only.
    def fake_freebusy(self, emails, time_min, time_max):
        return {"a@x.com": [(first_start, first_start + timedelta(minutes=30))],
                "b@x.com": []}

    monkeypatch.setattr(cal.GoogleCalendarAdapter, "_freebusy_sync", fake_freebusy)

    result = await adapter.get_free_slots(["a@x.com", "b@x.com"], 60, 2)
    assert result[0].all_available is False
    assert "a" in result[0].busy_users
    # Every other slot is free for both panelists.
    assert all(s.all_available for s in result[1:])


def test_get_adapter_falls_back_to_mock_without_creds(monkeypatch):
    monkeypatch.setattr(cal, "CALENDAR_PROVIDER", "google")
    monkeypatch.setattr(cal, "_google_adapter_singleton", None)
    monkeypatch.delenv("GOOGLE_CALENDAR_CREDENTIALS", raising=False)
    assert cal.get_calendar_adapter() is cal.MockCalendarAdapter


def test_load_credentials_raises_on_garbage(monkeypatch):
    monkeypatch.setenv("GOOGLE_CALENDAR_CREDENTIALS", "{not valid json")
    with pytest.raises(cal.CalendarCredentialError):
        cal._load_google_credentials()
