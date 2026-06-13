# Calendar Integration Guide — Developer Documentation

> **Version 1.1** — updated 2026-06-13.
> Complete setup guide for Google Calendar & Outlook integration.
> Covers API credentials, OAuth2 flow, permissions, and testing.
>
> **The real `GoogleCalendarAdapter` is now implemented** (`backend/services/calendar_service.py`).
> It activates from env vars alone — no in-app OAuth screen is required to test.
> Until valid credentials are supplied it falls back to the mock adapter with a
> warning, so scheduling never crashes. Start at **§0** to switch it on.

---

## 0. Quick start — turn the real adapter on (no app UI needed)

The adapter reads its credentials from env vars. Two credential shapes are
auto-detected from the JSON you supply in `GOOGLE_CALENDAR_CREDENTIALS`:

| Your account type | Use this | How to get it |
|---|---|---|
| **Individual Gmail** (your case) | An **authorized-user token** (has a `refresh_token`) | Run the helper script below — §0.2 |
| **Google Workspace** (team) | A **service account** with domain-wide delegation | §2.1 + set `GOOGLE_CALENDAR_SUBJECT` to the user to impersonate |

### 0.1 Install the client libraries (once)

```bash
pip install google-api-python-client google-auth google-auth-oauthlib
# (already added to backend/requirements.txt)
```

### 0.2 Generate a token from an individual Gmail

1. In Google Cloud Console create an **OAuth client ID** of type **Desktop app**
   (Console → APIs & Services → Credentials → Create credentials → OAuth client ID
   → Desktop app). Download the JSON — call it `oauth_client.json`.
   *(First time only: enable the **Google Calendar API**, and on the OAuth consent
   screen add your own Gmail under "Test users" so consent is allowed.)*
2. Run the helper (opens a browser, you sign in + consent once):

   ```bash
   python scripts/google_calendar_setup.py oauth_client.json
   ```

   It writes `google_calendar_token.json` (this is the file that holds the
   long-lived `refresh_token` — keep it secret, never commit it).

### 0.3 Point the backend at it

```bash
# .env
CALENDAR_PROVIDER=google
GOOGLE_CALENDAR_CREDENTIALS=/abs/path/to/google_calendar_token.json   # path OR inline JSON
GOOGLE_CALENDAR_ID=primary                # or a specific calendar id
GOOGLE_CALENDAR_TIMEZONE=Asia/Kolkata     # event times are written in this tz
# GOOGLE_CALENDAR_SUBJECT=user@yourco.com # service-account delegation only
```

Restart the backend. On the first scheduling call you should see
`Google Calendar adapter activated` in the logs. If you instead see
`...could not be activated (...); falling back to MockCalendarAdapter`, the
message tells you exactly what's wrong (missing file, bad JSON, libs not
installed).

### 0.4 Individual-Gmail limitation (important)

A personal Gmail can only read **its own** free/busy and create events on **its
own** calendar. So with an individual account, `GOOGLE_CALENDAR_ID=primary`
checks *your* availability and books on *your* calendar — perfect for testing the
end-to-end flow (freebusy → slot list → event with a real Meet link → invite
email). Reading *other panelists'* real free/busy needs Google Workspace +
domain-wide delegation (§2). The adapter handles both; only the data scope differs.

### 0.5 What the adapter does (matches the live code)

`GoogleCalendarAdapter` is a drop-in for the same interface the app already uses:

- `get_free_slots(panelist_emails, duration_minutes, days_ahead)` → runs a
  `freebusy().query()` over the same working-hour slot grid as the mock, marks
  each slot busy/free by overlapping it with each panelist's busy intervals.
- `create_event(title, start, duration_minutes, attendee_emails, description)` →
  `events().insert()` with `conferenceData` (auto Google Meet link),
  `sendUpdates="all"`, and email/popup reminders; returns `meeting_link`,
  `event_id`, `html_link`.

> Note: §2.4 below is the *original design sketch* (a per-org OAuth token store
> with a different method shape). The shipped adapter uses the env-var approach
> in this section instead — it's simpler to test and needs no new DB columns.

---

## 1. Architecture Decision

### Org-Level vs Per-User Calendar

**We use ORG-LEVEL calendar OAuth (service account approach):**

| Approach | How It Works | Pros | Cons |
|---|---|---|---|
| **Per-user OAuth** | Each panel member connects their calendar individually | Perfect free/busy data | Every user must authorize, high friction |
| **Org-level service account** ✅ | One admin connects org Google Workspace / Microsoft 365 | One-time setup, reads all users | Requires Google Workspace / M365 admin |
| **Hybrid** | Admin connects, individual users can override | Flexible | Complex |

**We go with org-level service account** because:
- Admin sets it up once in Settings → Integrations
- Service account can read free/busy for all org users (panel members)
- Can create events on panelists' calendars
- No need for each panel member to individually connect
- Works with Google Workspace and Microsoft 365 (both support domain-wide delegation)

> ⚠️ This requires the organization to use Google Workspace or Microsoft 365.
> Free Gmail / personal Outlook accounts do NOT support domain-wide delegation.
> For orgs without Workspace/M365, fall back to manual scheduling (current MVP behavior).

---

## 2. Google Calendar Integration

### 2.1 Google Cloud Console Setup

**Step-by-step for the developer:**

1. **Go to Google Cloud Console:** https://console.cloud.google.com/
2. **Create or select project:** `ai-talent-lab`
3. **Enable APIs:**
   - Google Calendar API
   - Google Meet API (for auto-generating meet links)
   
   ```
   APIs & Services → Library → Search "Google Calendar API" → Enable
   APIs & Services → Library → Search "Google Meet API" → Enable
   ```

4. **Create OAuth 2.0 credentials:**
   ```
   APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
   
   Application type: Web application
   Name: AI Talent Lab Calendar
   
   Authorized redirect URIs:
     - http://localhost:5173/settings/integrations/google/callback  (dev)
     - https://app.aitalentlab.com/settings/integrations/google/callback  (prod)
   ```

5. **Download credentials:**
   - Click the download button (⬇️) next to the created OAuth client
   - Save as `google_oauth_credentials.json`
   - Extract `client_id` and `client_secret`

6. **Configure OAuth consent screen:**
   ```
   APIs & Services → OAuth consent screen
   
   User type: External (for testing) → Internal (for production with Workspace)
   App name: AI Talent Lab
   User support email: your email
   
   Scopes to add:
     - https://www.googleapis.com/auth/calendar.readonly     (read free/busy)
     - https://www.googleapis.com/auth/calendar.events        (create events)
     - https://www.googleapis.com/auth/calendar.freebusy      (check availability)
   
   Test users: Add your email for testing
   ```

### 2.2 Environment Variables

```bash
# Add to .env
GOOGLE_CALENDAR_CLIENT_ID=your_client_id_here
GOOGLE_CALENDAR_CLIENT_SECRET=your_client_secret_here
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:5173/settings/integrations/google/callback
```

### 2.3 OAuth Flow (What Happens in the App)

```
Admin clicks "Connect Google Calendar" in Settings → Integrations
  → Frontend redirects to Google OAuth consent URL
  → Admin grants access (they must be Workspace admin)
  → Google redirects back to our callback URL with authorization code
  → Backend exchanges code for access_token + refresh_token
  → Tokens stored encrypted in organizations table
  → Status changes to "🟢 Connected"
```

### 2.4 Backend Implementation

```python
# New file: backend/adapters/calendar/google.py

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.transport.requests import Request

class GoogleCalendarAdapter:
    """Google Calendar integration via OAuth2."""
    
    def __init__(self, access_token: str, refresh_token: str):
        self.credentials = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            client_id=settings.GOOGLE_CALENDAR_CLIENT_ID,
            client_secret=settings.GOOGLE_CALENDAR_CLIENT_SECRET,
            token_uri="https://oauth2.googleapis.com/token",
        )
        self.service = build('calendar', 'v3', credentials=self.credentials)
    
    async def get_free_busy(
        self, 
        emails: list[str],       # Panel member emails
        date_start: datetime,     # Start of availability window
        date_end: datetime,       # End of availability window
    ) -> dict:
        """
        Check free/busy for multiple users.
        Returns: {email: [{start, end}, ...]} — list of busy slots per email.
        """
        body = {
            "timeMin": date_start.isoformat(),
            "timeMax": date_end.isoformat(),
            "items": [{"id": email} for email in emails],
        }
        result = self.service.freebusy().query(body=body).execute()
        
        busy_slots = {}
        for email in emails:
            calendar = result.get("calendars", {}).get(email, {})
            busy_slots[email] = calendar.get("busy", [])
        return busy_slots
    
    async def create_event(
        self,
        summary: str,           # "Interview: Priya S. — Round 1 Technical"
        description: str,       # Interview details (NO panel member info for candidate)
        start_time: datetime,
        duration_minutes: int,
        attendees: list[str],   # ONLY panelists — candidate NOT included
        create_meet: bool = True,
    ) -> dict:
        """
        Create calendar event with optional Google Meet link.
        Attendees are ONLY panel members — candidate gets separate email.
        """
        event = {
            "summary": summary,
            "description": description,
            "start": {"dateTime": start_time.isoformat(), "timeZone": "Asia/Kolkata"},
            "end": {
                "dateTime": (start_time + timedelta(minutes=duration_minutes)).isoformat(),
                "timeZone": "Asia/Kolkata",
            },
            "attendees": [{"email": email} for email in attendees],
            "reminders": {
                "useDefault": False,
                "overrides": [
                    {"method": "email", "minutes": 60},
                    {"method": "popup", "minutes": 15},
                ],
            },
        }
        
        if create_meet:
            event["conferenceData"] = {
                "createRequest": {
                    "requestId": str(uuid4()),
                    "conferenceSolutionKey": {"type": "hangoutsMeet"},
                }
            }
        
        result = self.service.events().insert(
            calendarId="primary",
            body=event,
            conferenceDataVersion=1 if create_meet else 0,
            sendUpdates="all",  # Sends calendar invite to panelists
        ).execute()
        
        return {
            "event_id": result["id"],
            "meet_link": result.get("conferenceData", {})
                               .get("entryPoints", [{}])[0]
                               .get("uri", ""),
            "html_link": result.get("htmlLink", ""),
        }
    
    async def delete_event(self, event_id: str):
        """Cancel/delete a calendar event."""
        self.service.events().delete(
            calendarId="primary", 
            eventId=event_id,
            sendUpdates="all",
        ).execute()
```

### 2.5 Required Python Packages

```
# Add to requirements.txt
google-api-python-client>=2.100.0
google-auth-httplib2>=0.2.0
google-auth-oauthlib>=1.2.0
```

### 2.6 Permissions Model — What Admin Grants

| Permission | Scope | Why |
|---|---|---|
| Read calendars | `calendar.readonly` | View free/busy slots for panel members |
| Create events | `calendar.events` | Add interview events to panelists' calendars |
| Free/busy query | `calendar.freebusy` | Check availability without seeing event details |

**Important: The admin who connects MUST be a Google Workspace admin.**
Regular users cannot read other users' free/busy data.

---

## 3. Microsoft Outlook / M365 Integration (Phase 2)

### 3.1 Azure AD Setup

1. **Go to Azure Portal:** https://portal.azure.com/
2. **App registrations → New registration:**
   ```
   Name: AI Talent Lab Calendar
   Supported account types: Accounts in any organizational directory
   Redirect URI: Web → http://localhost:5173/settings/integrations/outlook/callback
   ```

3. **API Permissions:**
   ```
   Microsoft Graph:
     - Calendars.Read (Delegated) — read free/busy
     - Calendars.ReadWrite (Delegated) — create events
     - OnlineMeetings.ReadWrite (Delegated) — create Teams meetings
   ```

4. **Certificates & secrets → New client secret**

### 3.2 Environment Variables

```bash
OUTLOOK_CLIENT_ID=your_azure_app_id
OUTLOOK_CLIENT_SECRET=your_azure_secret
OUTLOOK_REDIRECT_URI=http://localhost:5173/settings/integrations/outlook/callback
OUTLOOK_TENANT_ID=common  # or specific tenant
```

---

## 4. Schema Changes

```sql
-- Add to organizations table:
calendar_provider         TEXT,       -- 'google' | 'outlook' | NULL
calendar_access_token     TEXT,       -- Encrypted (AES-256)
calendar_refresh_token    TEXT,       -- Encrypted (AES-256)
calendar_connected_at     TIMESTAMP,
calendar_connected_by     INTEGER REFERENCES users(id),

-- Add to interviews table:
calendar_event_id         TEXT,       -- Provider event ID for sync
calendar_provider         TEXT,       -- 'google' | 'outlook'
auto_generated_meet_link  TEXT,       -- Auto-generated Meet/Teams link
```

---

## 5. Interview Invitation — Separate Emails

> ⚠️ CRITICAL: Panel members MUST NOT appear in candidate's interview email.

### Email Flow:

```
When recruiter clicks "Schedule Interview":

1. Calendar event created → ONLY panel members as attendees
   (panel gets calendar invite with event details)

2. SEPARATE email to candidate:
   Subject: "Interview Scheduled — {role} at {org}"
   Contains: date, time, meeting link, round name
   Does NOT contain: panelist names, emails, or any panel info

3. SEPARATE magic link emails to each panel member:
   Subject: "Interview Feedback — {candidate_name} for {role}"
   Contains: candidate profile link, JD link, meeting link,
             feedback magic link, interview kit link
   
   Each panelist gets their OWN unique email — not CC'd together
```

### Why This Matters:
- Candidate cannot see who is interviewing them (prevents contacting/bribing)
- Panel members are separate — each gets their own feedback link
- Calendar event is internal-only (panel's calendars)
- Candidate gets a clean, professional email with just the logistics

---

## 6. Testing as a Developer

### 6.1 Google Calendar Testing

1. **Create a Google Workspace test account:**
   - Sign up at https://workspace.google.com/ (14-day free trial)
   - Create org domain (e.g., `testcorp-dev.com`)
   - Create 3-4 test users (panel members)

2. **Alternative — use test mode with personal Gmail:**
   - Set OAuth consent screen to "Testing" mode
   - Add your personal Gmail as test user
   - You can only test YOUR OWN calendar (not free/busy for others)
   - Sufficient for testing event creation + Meet link generation

3. **Mock adapter for automated tests:**
   ```python
   # adapters/calendar/mock.py
   class MockCalendarAdapter:
       async def get_free_busy(self, emails, start, end):
           # Return simulated busy slots
           return {email: [] for email in emails}
       
       async def create_event(self, **kwargs):
           return {
               "event_id": f"mock_{uuid4().hex[:8]}",
               "meet_link": "https://meet.google.com/mock-test-link",
               "html_link": "#",
           }
   ```

4. **Environment setup for dev:**
   ```bash
   # .env — for development without real Google API:
   CALENDAR_PROVIDER=mock
   
   # .env — for testing with real Google API:
   CALENDAR_PROVIDER=google
   GOOGLE_CALENDAR_CLIENT_ID=...
   GOOGLE_CALENDAR_CLIENT_SECRET=...
   ```

### 6.2 Testing Checklist

- [ ] OAuth flow: Admin connects Google Calendar in Settings
- [ ] Free/busy: Query returns busy slots for panel member emails
- [ ] Event creation: Interview appears in panelists' Google Calendar
- [ ] Meet link: Auto-generated Google Meet link works
- [ ] Candidate email: Does NOT contain panel member info
- [ ] Panel emails: Each gets separate email with their magic link
- [ ] Reschedule: Updates calendar event, sends updated emails
- [ ] Cancel: Deletes calendar event, sends cancellation emails
- [ ] Token refresh: Works when access token expires (1 hour)
- [ ] Disconnect: Admin can disconnect calendar, tokens wiped

---

## 7. Settings → Integrations UI

```
── Calendar ─────────────────────────────────────────────────
┌─────────────────────────┐  ┌─────────────────────────┐
│ 📅 Google Calendar      │  │ 📅 Outlook / M365       │
│                         │  │                         │
│ 🟢 Connected            │  │ 🔴 Not Connected        │
│ Connected by: Srinivas  │  │                         │
│ Connected: May 15, 2026 │  │ Requires Microsoft 365  │
│                         │  │ admin access            │
│ [Test Connection]       │  │                         │
│ [Disconnect]            │  │ [Connect Outlook]       │
└─────────────────────────┘  └─────────────────────────┘

Note: Calendar integration requires Google Workspace or 
Microsoft 365 admin access. Personal Gmail/Outlook accounts
are not supported for reading team availability.

Without calendar: scheduling works manually (enter date/time).
```
