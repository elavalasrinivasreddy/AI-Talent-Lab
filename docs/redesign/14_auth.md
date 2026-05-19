# Page 14 — Auth (Login / Register)

**Pattern:** *Magic-link-first auth* (variant A)
**Replaces:** Password-first login with "Sign in with Google" secondary
**Why:** PRODUCT_PLAN §2 core philosophy: *"Magic links over logins."* Surfacing magic link as the primary CTA reduces friction (no password to remember), aligns with how candidates and panelists use the product, and matches the trend in modern B2B SaaS (Notion, Vercel, Linear all default to magic link / OAuth).

Preview reference: `/tmp/atl-design-preview-v3.html` → tab "Auth".
Existing doc this supersedes: `docs/pages/01_auth.md`.

---

## 1. Route & layout

| Aspect | Value |
|---|---|
| Routes | `/login` · `/register` (toggle within same page in v3) |
| Auth | Public; redirects to `/dashboard` (or `/platform` if platform_admin) when authenticated |
| Layout | 2-column split: brand pitch (60%) + form pane (40%) |
| Mobile | Stacks vertically (pitch on top — collapsible — form below) |

---

## 2. Backend tie-in

| Endpoint | Used for |
|---|---|
| `POST /api/v1/auth/login` | Email + password sign-in (existing) |
| `POST /api/v1/auth/magic-link` | **New** — request magic-link email for an existing account |
| `GET /api/v1/auth/magic-link/verify?token=` | **New** — exchange magic-link token for JWT |
| `POST /api/v1/auth/register` | Create org + admin (existing) |
| `POST /api/v1/auth/google/oauth` | Google OAuth callback (Phase 2 — existing or to be added) |

Magic link generation: signed JWT with `{type: "auth_magic", user_id, exp: 15min}`. On verify, server issues a normal session JWT.

---

## 3. Layout

```
┌────────────── Left pitch (gradient teal) ──────────────┬──── Right form ────┐
│ [AI Talent Lab logo]                                    │ [Toggle: Sign in | │
│                                                         │  Create workspace] │
│                                                         │                    │
│ Hire is a verb.                                         │ Welcome back       │
│ Let's make it your favorite.                            │ Sign in to TechCorp│
│                                                         │                    │
│ "AI does the sourcing, screening, scoring, scheduling.  │ [✨ Continue with  │
│  You do the call. Together you ship 10× more hires."    │  magic link]       │
│                                                         │ "No password..."   │
│ [stat] 200+ Hiring teams                                │                    │
│ [stat] 38d Avg time saved/req                           │ [G Continue Google]│
│ [stat] 94% Candidate NPS                                │                    │
│                                                         │ ── OR password ─── │
│ 🔒 SOC2 Type II · GDPR + DPDP · ISO 27001 (in progress) │                    │
│                                                         │ Work email         │
│                                                         │ [you@techcorp.com] │
│                                                         │ Password           │
│                                                         │ [••••••••]         │
│                                                         │ ☐ Remember me  Forgot?│
│                                                         │ [Sign in →]        │
└─────────────────────────────────────────────────────────┴────────────────────┘
```

---

## 4. Left pitch pane

| Element | Source |
|---|---|
| Logo + brand mark | static |
| H1 tagline | "Hire is a verb. Let's make it your favorite." |
| Paragraph | One-line value prop · max 380px |
| 3 stats | "200+ Hiring teams", "38d Avg time saved/req", "94% Candidate NPS". Replace with real product metrics post-launch. |
| Trust line (bottom) | Compliance badges (SOC2, GDPR, ISO) |

Background: full-bleed teal gradient (`--p` → `--p-h` → `--p-a`) with 2 decorative blurred circles. Conveys "serious AI infrastructure" without being clinical.

Mobile: this pane collapses to just the logo + H1 + 1 stat above the form.

---

## 5. Right form pane

### Toggle row

Pill-toggle at the top: `[Sign in] [Create workspace]`. Switches the form body without page reload.

### Sign in form

Order matters — primary action first:

1. **Magic link CTA** (`<MagicLinkCTA>` component, gradient teal-tint background)
   - Icon: lightning bolt
   - Label: "Continue with magic link"
   - Sub: "No password to remember. We email a one-tap secure link."
   - Click → expand to email input → submit → "We've sent a link to {email}" confirmation
2. **Continue with Google** (`<GoogleSignInButton>`)
   - Google's standard branding
   - Routes to OAuth flow
3. **OR password** divider
4. **Email + password** form
   - Email · Password · Remember me · Forgot?
   - Primary submit "Sign in →"

### Create workspace form (when toggle = create)

1. Magic-link CTA replaced with: **"Try free for 14 days · no credit card"** CTA explaining the trial
2. Workspace name · admin email · admin name · password · workspace slug (auto-suggested)
3. Primary submit "Create workspace →"

Both paths invoke the existing `register` and `login` endpoints (server already creates org + admin in a single transaction per `key_services_and_flows.md`).

---

## 6. Why magic-link primary

| Reason | Detail |
|---|---|
| Aligns with product philosophy | Candidates + panelists already use magic links · admins should feel the same surface |
| Lower friction | No password DB to manage, no password-reset support tickets, no leaked-password risk |
| Modern B2B default | Notion, Vercel, Linear all default to magic-link / OAuth |
| Security: phishing-resistant | Magic links are time-limited (15 min) and single-use |

Risks mitigated:
- **Email account compromise** — magic link expires in 15 min and is bound to the requesting browser fingerprint
- **Phishing surface** — frontend instructs users to verify the email sender + show the magic-link URL preview before clicking

---

## 7. OAuth options

For Phase 2:
- **Google Workspace** (most common enterprise SSO in India)
- **Microsoft Azure AD** (enterprise customers)
- **SAML SSO** (Phase 3 — enterprise tier per PRODUCT_IMPROVEMENTS §8 monetization)

These appear as additional buttons between the magic-link CTA and the password form.

---

## 8. Components to build / refactor

| Component | Path | Notes |
|---|---|---|
| `<LoginPage>` | `frontend/src/components/Auth/LoginPage.jsx` | Refactor |
| `<RegisterPage>` | `frontend/src/components/Auth/RegisterPage.jsx` | Refactor (or merge into LoginPage with toggle) |
| `<AuthPitchPane>` | `Auth/AuthPitchPane.jsx` | New — left brand pane |
| `<AuthFormPane>` | `Auth/AuthFormPane.jsx` | New — right form with toggle |
| `<MagicLinkCTA>` | `Auth/MagicLinkCTA.jsx` | New — primary CTA + inline email flow |
| `<GoogleSignInButton>` | `Auth/GoogleSignInButton.jsx` | New (or refactor existing) |
| `<MagicLinkSentScreen>` | `Auth/MagicLinkSentScreen.jsx` | New — "We've sent a link to..." confirmation |
| `<MagicLinkExchange>` | `Auth/MagicLinkExchange.jsx` | New — handles `/auth/verify?token=` redirect |

---

## 9. Magic-link verification flow

1. User clicks magic link in email → opens `https://app.aitalentlab.com/auth/verify?token=xxx`
2. Frontend route mounts `<MagicLinkExchange>` which:
   - Shows spinner: "Signing you in..."
   - Calls `GET /api/v1/auth/magic-link/verify?token=xxx`
   - On success: stores JWT, navigates to `/dashboard` (or `/platform` for platform_admin)
   - On expired token: redirect to `/login` with toast "Link expired. Request a new one."
   - On invalid token: redirect to `/login` with toast "Invalid link."

This route is also used as the **Google OAuth callback** (`/auth/verify?provider=google&token=xxx`).

---

## 10. Empty / loading / error states

| Condition | Display |
|---|---|
| Email field invalid format | Inline error · disable submit |
| Magic link submit success | Replace form with "✓ We've sent a link to {email} · expires in 15 min" |
| Password incorrect | Inline error · counter for failed attempts (lockout after 5 per `auth_service.py`) |
| Account locked | "Too many attempts. Try again in 15 minutes or use magic link." |
| Google OAuth failure | Toast: "Couldn't sign in with Google. Try email instead." |
| Magic-link token expired | Redirect with toast |
| Network error | Toast: "Couldn't reach the server. [Retry]" — preserve form state |

---

## 11. Brand & accessibility

- **Color contrast** — h1 on gradient bg must meet WCAG AA. Test in dark mode.
- **Tab order** — Magic link CTA → Google → email → password → submit. Magic link gets focus first.
- **Screen reader** — Use semantic labels, `aria-label`s on icon-only buttons, announce the toggle change.
- **Mobile** — Form pane scrolls; sticky submit button on small viewports.

---

## 12. Build notes

1. The magic-link endpoint is new (likely 30 lines in `auth_service.py` + `routers/auth.py`). Reuses existing JWT signing.
2. Email sending uses the existing `email_service` adapter pattern (Resend / SMTP / simulation).
3. Email template: "Sign in to AI Talent Lab" — short, branded, link button + URL preview, expiry note.
4. The Auth page is **public-only** — already configured via `PublicGuard` in `router.jsx`. No change to routing needed.
5. After this page ships, the dev console (`/dev`) can also offer a magic-link bypass for developer testing (Phase 2 nice-to-have).

---

## 13. Why this matters

Auth is the first thing every user sees. The choices here signal:
- **Magic-link primary** → "we trust modern auth conventions; we won't make you remember another password"
- **Brand pitch on the side** → "we know what we are; we're confident enough to show our value before asking for your email"
- **OAuth + password fallback** → "we meet you where you are; no enterprise customer left behind"

This is the page that decides whether a recruiter says "this feels like a real product" or "this is yet another HR tool."
