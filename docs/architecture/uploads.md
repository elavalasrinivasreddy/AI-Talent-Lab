# File Uploads — Local Dev vs. Production (E7)

**Status:** local-dev mount gated 2026-06-13; object storage **not yet built** (do before pilots upload real resumes).

## Today (dev)

Uploaded files (candidate resumes, video intros) are written to the local
`./uploads/` directory and served as static files at `/uploads/*` by FastAPI:

```python
# backend/main.py
if settings.SERVE_LOCAL_UPLOADS:
    os.makedirs("uploads/videos", exist_ok=True)
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
```

This mount is now gated behind `SERVE_LOCAL_UPLOADS` (config default `True`).

## Why this must change before production

- **Unauthenticated exposure.** `/uploads/*` is public static serving — anyone
  with (or guessing) a path can fetch a candidate's resume or video. These are
  PII and fall under the GDPR/DPDP commitments in the security one-pager.
- **No tenancy isolation.** Static file paths bypass the org-scoped RLS that
  protects every other piece of candidate data.
- **Ephemeral / non-scalable.** Local disk doesn't survive redeploys, doesn't
  work across multiple app instances, and has no lifecycle/retention controls.

## Production plan

1. **Set `SERVE_LOCAL_UPLOADS=false`** in the production `.env` — disables the
   static mount entirely (logged at startup).
2. **Object storage adapter.** Add an `ObjectStorageAdapter` (same simulation-first
   pattern as the email/billing adapters): `LocalStorage` for dev, `S3Storage` /
   `GCSStorage` for prod, selected by env.
3. **Signed URLs.** Serve every download through a short-lived, org-scoped signed
   URL minted by an authenticated endpoint that re-checks the caller's org +
   role — never a raw public path.
4. **Upload path.** Write through the adapter (server-side `put`), store the
   object key (not a URL) on the candidate/application row.
5. **Retention.** Apply a lifecycle policy aligned to the data-retention promise
   (auto-expire after the stated window).

## Checklist before first pilot upload

- [ ] `SERVE_LOCAL_UPLOADS=false` in prod env
- [ ] Object storage bucket provisioned (private, encrypted at rest)
- [ ] `ObjectStorageAdapter` + signed-URL download endpoint (org/role checked)
- [ ] Existing `/uploads/*` references migrated to signed-URL fetches
- [ ] Retention lifecycle rule configured
