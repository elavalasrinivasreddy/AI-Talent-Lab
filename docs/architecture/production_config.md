# Production configuration

> Self-contained prod-env setup that is **not** blocked on any external account:
> the encryption key, the reverse-proxy / `X-Forwarded-For` handling that makes
> rate limiting and audit IPs correct, and the billing-layer env. The
> credential-blocked items (Calendar OAuth, Razorpay live keys, email DKIM/SPF)
> live in [`docs/TODO.md`](../TODO.md) under "Blocked"; this doc covers the parts
> we can finish today. Created 2026-06-13 (Sprint 2).

## `ENCRYPTION_KEY` — generate and set

Sensitive candidate fields (currently CTC / compensation) are encrypted at rest
with AES-256-GCM in [`backend/utils/crypto.py`](../../backend/utils/crypto.py).
The key is **self-generated** — there is no provider to wait on. When
`ENCRYPTION_KEY` is empty the encrypt/decrypt helpers are transparent no-ops, so
the app runs fine without it in dev; production must set it.

Generate a high-entropy value and set it as the `ENCRYPTION_KEY` environment
variable. Any of these works (the key is SHA-256-derived to 32 bytes, so length
is not critical as long as entropy is high):

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
# or
openssl rand -base64 36
```

Set it once per environment and **never rotate it casually**: the key is needed
to decrypt every value it has encrypted. Rotating requires a re-encrypt
migration (decrypt-with-old → encrypt-with-new for every `*_enc` column).
Treat it like a database password — store it in the platform secret manager
(not in the repo, not in a committed `.env`). `.gitignore` already excludes
`.env`.

If `ENCRYPTION_KEY` is set in production but was empty when some rows were
written, those rows are stored as plaintext and will be returned as-is on read
(decrypt is a no-op for non-base64 / unencrypted values only if they were never
encrypted — mixed state is safe to read but should be back-filled). Set the key
**before** the first pilot uploads real compensation data to avoid a mixed
state.

## Reverse proxy and `X-Forwarded-For`

In production the app sits behind a reverse proxy / load balancer (nginx, an
ALB, Cloud Run, etc.). Without proxy-header handling, `request.client.host` is
the **proxy's** IP, not the real client's. Two things depend on the real client
IP:

- **Rate limiting** — `backend/middleware/rate_limiter.py` keys limits on
  `get_remote_address`, which reads `request.client.host`. Behind a proxy every
  request looks like it comes from one IP, so the per-IP auth caps would either
  throttle all users together or never trigger.
- **Audit / security logging** — `routers/auth.py` and `routers/hire_requests.py`
  already prefer the `X-Forwarded-For` header and fall back to
  `request.client.host`, so audit rows get the right IP **only if** the proxy
  sets `X-Forwarded-For` and the app is allowed to trust it.

Run uvicorn (or gunicorn's uvicorn worker) with proxy headers enabled, trusting
**only** the proxy's address range so a client cannot spoof its IP by sending a
forged header:

```bash
uvicorn backend.main:app \
  --host 0.0.0.0 --port 8000 \
  --proxy-headers \
  --forwarded-allow-ips "10.0.0.0/8"   # set to the proxy/LB CIDR, NOT "*"
```

And make the proxy forward the real client IP. For nginx:

```nginx
location / {
    proxy_pass http://app:8000;
    proxy_set_header Host              $host;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

With `--proxy-headers` + a trusted `--forwarded-allow-ips`, uvicorn rewrites
`request.client.host` to the left-most `X-Forwarded-For` entry, so both rate
limiting and audit IPs become correct without any code change. Do **not** set
`--forwarded-allow-ips "*"` in production — that lets any caller forge their
source IP and bypass rate limits.

## Billing / SaaS-layer env (Sprint 2)

The billing adapter mirrors the email adapter: simulation by default, live when
keys are present. In dev and until Razorpay KYC clears, leave the defaults — the
full checkout → invoice → plan-assignment flow works in simulation.

| Variable | Default | Prod note |
|---|---|---|
| `BILLING_PROVIDER` | `simulation` | Set to `razorpay` once KYC + keys are ready |
| `RAZORPAY_KEY_ID` | `""` | From the Razorpay dashboard |
| `RAZORPAY_KEY_SECRET` | `""` | Secret — store in the secret manager |
| `RAZORPAY_WEBHOOK_SECRET` | `""` | Used to HMAC-verify `/api/v1/billing/webhook` |

Plan limits and the monthly LLM budget per plan live in
[`backend/services/plans.py`](../../backend/services/plans.py); a single org can
be given a custom LLM ceiling via the `organizations.llm_monthly_budget_usd`
column (overrides the plan default). See
[`backend/services/quota_service.py`](../../backend/services/quota_service.py)
for the soft-warn-then-block enforcement.

## Other production env (status)

`DEV_MODE` must stay **false** in prod (fail-safe default) so `/dev/*` stays
off. `SERVE_LOCAL_UPLOADS` should be **false** in prod with uploads moved to
object storage — see [`uploads.md`](uploads.md). `APP_DATABASE_URL` should point
at the non-superuser `talentlab_app` role so Row-Level Security is enforced on
request traffic — see [`../RLS_ACTIVATION.md`](../RLS_ACTIVATION.md). `SENTRY_DSN`
enables error monitoring when set (no-op when empty). Staging, backups/DR, and
uptime monitoring (the rest of Phase F6) remain open and depend on the hosting
choice.
