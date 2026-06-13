# AI Talent Lab — Security & Data Protection Note

> The "detailed security note available on request" promised in the
> [sales brief](06_sales_brief.md) §7. Audience: a prospect's founder, IT lead, or DPO.
> One page; every claim is code-traced (sources in the footer). Last verified: 2026-06-13.

---

## The short version

Each client's data is fully isolated at the database level, sensitive fields are encrypted,
candidates give explicit consent before any data is collected, anyone can have their data
deleted on request, and every significant action is logged. The AI assists — it never
auto-rejects a candidate; humans make every hiring decision.

## Tenant isolation

- Every client organization's data is separated by **PostgreSQL Row-Level Security (RLS)** —
  isolation is enforced by the database itself, not just application code. The application
  connects through a restricted database role; a query physically cannot return another
  organization's rows.
- Isolation is covered by automated tests that attempt cross-tenant access and assert it fails.

## Encryption

- **In transit:** TLS for all client–server traffic.
- **At rest:** sensitive candidate fields — notably salary / CTC expectations — are encrypted
  with **AES-256** before storage.
- Passwords are stored only as salted hashes, never in plain text.

## Access control & account security

- Role-based access (recruiter, team lead, department admin, org admin, platform admin) — users
  see only what their role requires.
- Account lockout after repeated failed logins; sessions are revocable server-side
  (JWT denylist), so a stolen token can be invalidated immediately.
- Magic links for candidates and interview panelists are single-use and scoped to one purpose.

## Consent & candidate rights (DPDP Act 2023 / GDPR)

- **Consent first:** before a candidate answers a single application question, they see a
  consent notice describing what is collected and why. No consent → no processing.
- **Right to deletion:** any candidate can request deletion via a public, no-login page;
  deletion is org-scoped and rate-limited to prevent abuse.
- **Data retention:** each organization sets a retention period; expired candidate data is
  deleted automatically by scheduled cleanup jobs.
- **Data export:** candidates can request a copy of their data (GDPR Article 20).
- **AI disclosure:** AI involvement is disclosed in candidate-facing chat and emails.

## AI safeguards

- The AI drafts JDs, parses resumes, and **ranks with reasons** — it never auto-rejects a
  candidate. Every decision is made by a human at the employer.
- JDs are automatically scanned for biased language before publication.
- Candidate data is sent to LLM providers only to provide the service, under provider
  agreements that exclude training on customer data.

## Operational security

- **Audit logs:** significant actions across the organization are recorded and reviewable
  by org admins.
- **Error monitoring:** Sentry across backend, background workers, and frontend, with data
  minimization.
- **Data portability:** clients can export their data at any time — no lock-in.

## Honest footnotes (what we'll tell you before you ask)

- We are early-stage: no SOC 2 / ISO 27001 certification yet. The controls above are real and
  testable; formal certification is planned as we grow.
- Production deployment specifics (hosting region, backup cadence, sub-processor list) are
  shared during onboarding and in the [Privacy Policy](../../landing/privacy.html).

---

**Questions / verification:** elavalasrinivasreddy@gmail.com — we're happy to walk your
technical reviewer through any of this live.

*Internal traceability: RLS — `docs/RLS_ACTIVATION.md`, `test_rls_isolation.py` · encryption —
`docs/STATUS.md` Phase C · deletion — `DELETE /api/v1/gdpr/delete-my-data` (org-scoped, rate-limited) ·
consent — apply-chat consent step · audit logs & Sentry — `docs/STATUS.md`.*
