"""
One-time Google Calendar credential generator.

Turns an OAuth *client* JSON (downloaded from Google Cloud Console) into an
*authorized-user* token JSON that the backend's GoogleCalendarAdapter can use.
This is the path for an INDIVIDUAL Gmail account (no Google Workspace / no
domain-wide delegation needed).

What it does:
  1. Reads your OAuth client file (the "Desktop app" credentials you download).
  2. Opens a browser so you sign in and consent once.
  3. Writes `google_calendar_token.json` (contains a long-lived refresh_token).

Then point the backend at it:
  CALENDAR_PROVIDER=google
  GOOGLE_CALENDAR_CREDENTIALS=/abs/path/to/google_calendar_token.json
  GOOGLE_CALENDAR_ID=primary            # or a specific calendar's id
  GOOGLE_CALENDAR_TIMEZONE=Asia/Kolkata

Prerequisites (install once):
  pip install google-api-python-client google-auth google-auth-oauthlib

Usage:
  python scripts/google_calendar_setup.py path/to/oauth_client.json
  python scripts/google_calendar_setup.py path/to/oauth_client.json --out google_calendar_token.json

See docs/integrations/calendar.md for the full walkthrough.
"""
import argparse
import sys
from pathlib import Path

# Read + create-event scopes: enough for freebusy queries and inserting
# interview events with a Google Meet link.
SCOPES = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.readonly",
]


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a Google Calendar authorized-user token.")
    parser.add_argument("client_secret", help="Path to the OAuth client JSON from Google Cloud Console.")
    parser.add_argument("--out", default="google_calendar_token.json", help="Where to write the token JSON.")
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Use console flow (prints a URL) instead of opening a local browser.",
    )
    args = parser.parse_args()

    client_path = Path(args.client_secret)
    if not client_path.exists():
        print(f"ERROR: client secret file not found: {client_path}", file=sys.stderr)
        return 1

    try:
        from google_auth_oauthlib.flow import InstalledAppFlow
    except ImportError:
        print(
            "ERROR: missing dependencies. Run:\n"
            "  pip install google-api-python-client google-auth google-auth-oauthlib",
            file=sys.stderr,
        )
        return 1

    flow = InstalledAppFlow.from_client_secrets_file(str(client_path), SCOPES)
    if args.no_browser:
        creds = flow.run_console()
    else:
        # Spins up a localhost listener and opens the consent screen.
        creds = flow.run_local_server(port=0)

    out_path = Path(args.out)
    out_path.write_text(creds.to_json(), encoding="utf-8")
    print(f"\n✅ Wrote {out_path.resolve()}")
    print("   This file contains a refresh_token — keep it secret, do NOT commit it.")
    print("\nNext, set in your .env:")
    print("  CALENDAR_PROVIDER=google")
    print(f"  GOOGLE_CALENDAR_CREDENTIALS={out_path.resolve()}")
    print("  GOOGLE_CALENDAR_ID=primary")
    print("  GOOGLE_CALENDAR_TIMEZONE=Asia/Kolkata")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
