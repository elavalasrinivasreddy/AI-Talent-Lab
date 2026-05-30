"""
One-shot probe to verify Resend setup + Gmail dot-trick behavior.

Sends 2 emails:
  1. To the exact account-owner address.
  2. To a dot-variant (Gmail treats them as the same inbox; Resend's behavior
     is what we want to learn).

Prints the full HTTP response so we can see exactly why a send fails.

Usage:
  .venv/bin/python scripts/probe_resend.py <recipient-email>
  e.g. .venv/bin/python scripts/probe_resend.py elavalasrinivasreddy@gmail.com
"""
import sys
import asyncio
import os
from pathlib import Path

# Load .env without depending on the full backend stack
env_path = Path(__file__).parent.parent / ".env"
for line in env_path.read_text().splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, _, v = line.partition("=")
    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

import httpx


async def send(recipient: str, label: str) -> None:
    api_key = os.environ["RESEND_API_KEY"]
    from_email = os.environ["FROM_EMAIL"]
    from_name = os.environ.get("FROM_NAME", "AI Talent Lab")

    sender = f"{from_name} <{from_email}>"
    payload = {
        "from": sender,
        "to": [recipient],
        "subject": f"[Probe — {label}] AI Talent Lab Resend test",
        "html": f"<p>This is a one-shot probe (<b>{label}</b>) to {recipient}.</p>"
                f"<p>If you see this, Resend delivers to that address from "
                f"<code>{from_email}</code>.</p>",
        "text": f"Probe ({label}) to {recipient}. From: {from_email}.",
    }

    print(f"\n── Probe [{label}] → {recipient}")
    print(f"   from: {sender}")
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
    print(f"   HTTP {resp.status_code}")
    print(f"   body: {resp.text}")


async def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: probe_resend.py <recipient-email>")
        sys.exit(1)
    base = sys.argv[1]

    # Build a dot-variant. e.g. elavalasrinivasreddy@gmail.com -> e.lavalasrinivasreddy@gmail.com
    local, _, domain = base.partition("@")
    if len(local) < 2:
        dotted = base
    else:
        dotted = f"{local[0]}.{local[1:]}@{domain}"

    await send(base, "account-owner")
    await send(dotted, "dot-variant")
    print("\nDone. Check your inbox.")


if __name__ == "__main__":
    asyncio.run(main())
