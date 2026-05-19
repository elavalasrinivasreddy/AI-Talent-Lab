# Page 19 — GDPR · Delete My Data · Privacy

**Pattern:** *Trust-led one-page · public · token-aware* (variant A)
**Replaces:** Current `DeleteMyDataPage.jsx` (single component serving both `/delete-my-data` and `/privacy` routes)
**Why:** GDPR Article 17 (right to erasure) and DPDP Act 2023 are baseline legal requirements for any candidate-facing product. This page must be:
1. **Findable** without an account (any candidate can reach it)
2. **Trustworthy in tone** (legal-but-human)
3. **Actually usable** (the right-to-erasure flow should work end-to-end in the UI, not just be documented)

Preview reference: not yet in `/tmp/atl-design-preview-v3.html` — to be added.
Existing component: `frontend/src/components/GDPR/DeleteMyDataPage.jsx`.

---

## 1. Route & layout

| Aspect | Value |
|---|---|
| Routes | `/delete-my-data` and `/privacy` (same component · different default tab) |
| Auth | **Public** — no JWT |
| Layout | Centered single-column page · max-width 720px · brand header · tabs |
| Branding | When opened via `?org=acme` query param, apply that org's branding · default to AI Talent Lab |

---

## 2. Backend tie-in

| Endpoint | Used for |
|---|---|
| `POST /api/v1/gdpr/delete-request` | Initiate erasure request (no auth · captures email + verification) |
| `GET /api/v1/gdpr/verify/{token}` | Verify email via magic-link |
| `POST /api/v1/gdpr/confirm-deletion/{token}` | Confirm + execute deletion (after grace period) |
| `POST /api/v1/gdpr/export-request` | GDPR Article 20 data export (Phase 2 — backend exists, frontend pending) |
| `GET /api/v1/gdpr/retention-policy?org=` | Per-org retention policy text + duration |
| `POST /api/v1/gdpr/withdraw-consent` | Withdraw consent on a specific application (less destructive than full delete) |

Existing tables: `data_deletion_requests`, `consent_records`. No schema changes needed.

---

## 3. Layout

```
[ BRAND HEADER (subtle gradient — org's primary color if known) ]
  TechCorp · Privacy Center                                       [↗ techcorp.com]

[ TABS (under header) ]
  [About your data · default for /privacy]   [Delete my data · default for /delete-my-data]
  [Export my data (GDPR Art 20)]   [Withdraw consent]

[ TAB: About your data ]
  "What we know · why we keep it · how long we keep it"

  ┌─ What we collect when you apply ────────────────────────────────┐
  │  • Resume + work history (you provide)                          │
  │  • Application chat responses (when you apply)                  │
  │  • Optional: video introduction                                 │
  │  • Email · phone · LinkedIn (you provide)                       │
  │  • Skills inferred by AI from your resume                       │
  │  • Interview scorecards (after interviews)                      │
  └─────────────────────────────────────────────────────────────────┘

  ┌─ How long we keep it ──────────────────────────────────────────┐
  │ Active application: until role closes + 12 months              │
  │ Talent pool: until you ask us to remove (or 2 years inactive)  │
  │ Audit logs: 7 years (legal requirement)                        │
  └────────────────────────────────────────────────────────────────┘

  Your rights under GDPR / DPDP:
   • Right to access  → request a copy of your data
   • Right to rectification  → ask us to correct mistakes
   • Right to erasure  → delete my data tab →
   • Right to data portability  → export tab →
   • Right to object  → withdraw consent tab →

[ TAB: Delete my data ]
  ┌─ "Request deletion of your data from TechCorp" ────────────────┐
  │ This will permanently delete:                                  │
  │  • Your candidate profile                                      │
  │  • All applications you submitted                              │
  │  • Interview scorecards (your name redacted; ratings retained) │
  │  • Resume + uploaded files                                     │
  │                                                                │
  │ Some data is retained for legal compliance (anonymized).       │
  │                                                                │
  │ Email *                                                        │
  │ [you@example.com]                                              │
  │                                                                │
  │ Why are you deleting? (optional · helps us improve)           │
  │ [chip: "I'm no longer interested"] [chip: "Privacy"] [...]    │
  │                                                                │
  │ ☑ I understand this is permanent · 30-day grace period applies│
  │                                                                │
  │ [Send verification email]                                     │
  └────────────────────────────────────────────────────────────────┘

[ FOOTER · always visible ]
  Privacy policy · Terms · Contact: privacy@techcorp.com
  Powered by AI Talent Lab · SOC2 Type II · GDPR / DPDP compliant
```

---

## 4. Deletion flow (5 steps)

```
1. User fills email + reason → POST /gdpr/delete-request
2. Email sent with magic verification link (24h validity)
3. User clicks link → GET /gdpr/verify/{token} → confirmation page
   "Confirm deletion · 30-day grace period applies · we'll email you again before final purge"
4. Backend marks `data_deletion_requests.verified=true`, `delete_after=now()+30d`
5. Celery `process_verified_deletions` task runs hourly:
   - For each request past grace period → execute delete
   - Cascade: candidate, applications, resume_files, video_intros, scorecards (anonymize), etc.
   - Audit log entry · email confirmation to user
   - Set `data_deletion_requests.completed_at`
```

User can cancel during grace period via second verification link.

---

## 5. The four tabs

### Tab 1: About your data (default for `/privacy`)
Explains what's collected, why, retention duration. Plain-language version of the privacy policy. Org-specific where relevant (per `org.career_about_us` and `org.data_retention_months`).

### Tab 2: Delete my data (default for `/delete-my-data`)
The flow above. Form + magic-link verification + 30-day grace.

### Tab 3: Export my data (Phase 2)
Article 20 data portability. Form similar to delete; result emailed as a JSON / PDF bundle.

### Tab 4: Withdraw consent
Less destructive than full delete — revokes consent on specific applications. Useful for candidates who don't want to be re-contacted but don't want their interview history erased.

---

## 6. Org-aware branding

When linked from an org's status portal / apply chat / careers page, the URL carries `?org={slug}`:

- Header brand mark uses `org.career_logo_url` and `org.name`
- Primary color tint uses `org.career_primary_color`
- "What we collect" enumerates the specific data this org captures
- "Powered by AI Talent Lab" footer always present (regulatory disclosure)

Without `?org=` param, the page shows generic AI Talent Lab branding.

---

## 7. Trust signals

The page should look **legal-grade but human-friendly**. Use:
- Clean typography, generous whitespace
- Explicit lists of what's collected (no marketing fluff)
- Plain-language explanations of legal terms
- Visible compliance badges (SOC2, GDPR, DPDP, ISO 27001)
- Contact email for privacy questions (clickable, not buried)
- "Last updated: {date}" timestamp on each policy

Avoid:
- Dark patterns ("Are you SURE you want to delete?" with subtle no/cancel button)
- Marketing copy in the privacy explanation
- Pre-checked consent boxes

---

## 8. Components to build / refactor

| Component | Path | Notes |
|---|---|---|
| `<PrivacyPage>` | `frontend/src/components/GDPR/PrivacyPage.jsx` | Refactor — renames `DeleteMyDataPage` to `PrivacyPage` (component handles both routes) |
| `<PrivacyHeader>` | `GDPR/PrivacyHeader.jsx` | New — org-aware brand header |
| `<PrivacyTabs>` | `GDPR/PrivacyTabs.jsx` | New — 4-tab navigation |
| `<AboutYourDataTab>` | `GDPR/tabs/AboutYourDataTab.jsx` | New |
| `<DeleteRequestForm>` | `GDPR/tabs/DeleteRequestForm.jsx` | New — main deletion form with verification flow |
| `<DeleteVerifyScreen>` | `GDPR/DeleteVerifyScreen.jsx` | New — magic-link landing |
| `<ExportRequestForm>` | `GDPR/tabs/ExportRequestForm.jsx` | New (Phase 2) |
| `<WithdrawConsentForm>` | `GDPR/tabs/WithdrawConsentForm.jsx` | New |
| `<ComplianceBadges>` | `common/ComplianceBadges.jsx` | New — SOC2 / GDPR / DPDP / ISO badges (reusable) |

---

## 9. Empty / loading / error states

| Condition | Display |
|---|---|
| Submitted deletion request | "✓ Verification email sent to you@example.com · expires in 24h" |
| Magic link expired | "This link has expired. [Request new verification]" |
| Email not in any org's records | "We couldn't find an application matching that email. Did you apply under a different one?" |
| Grace period active (request submitted but waiting) | Status banner: "Your deletion is scheduled for {date} · [Cancel deletion]" |
| Already deleted | "Your data was deleted on {date}. Nothing more to do." |
| Server error | Inline retry — preserve form state |

---

## 10. Build notes

1. The current `DeleteMyDataPage.jsx` covers the basics — focus refactor on (a) tab structure, (b) org-aware branding, (c) trust-signal visuals.
2. Add the magic-link verification screen as a separate route (`/gdpr/verify/:token`) inside this component.
3. Phase 2: Export tab. Backend endpoint exists per PRODUCT_IMPROVEMENTS §5.6 — no frontend yet.
4. Phase 2: Withdraw consent tab. Less destructive than delete; useful for candidates who applied and want to stay in talent pool but stop receiving emails.
5. Test with screen readers — privacy surfaces are high-scrutiny accessibility-wise.
6. Localize copy in Phase 3 (English + Hindi + Telugu for India market).

---

## 11. Why this page matters

This page is the **regulatory floor** for the entire product. If it doesn't work:
- Cannot legally operate in EU (GDPR Article 17 mandatory)
- Cannot legally operate in India (DPDP Act 2023 Section 12 mandatory)
- Lose B2B deals with regulated industries (legal review will block)

It's also a **brand moment**: candidates who interact with this page form opinions about the product's integrity. A clear, calm, working privacy page wins trust that the rest of the product can't undo.
