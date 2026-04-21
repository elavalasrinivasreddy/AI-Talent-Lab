# Page Design: Authentication
> **Version 2.2 — Updated**
> Login, Register, and Password Reset. Entry point for all platform users. Org slug auto-generated on registration.

---

## 1. Pages

| Page | Route | Auth | Purpose |
|---|---|---|---|
| Login | `/login` | No | Email/password sign-in |
| Register | `/register` | No | New org + admin user |
| Forgot Password | `/forgot-password` | No | Request reset email |
| Reset Password | `/reset-password/:token` | No | Set new password |

---

## 2. Login Page

### Layout
```
┌──────────────────────────────────────────────────────┐
│  (Full-page dark gradient: deep navy → purple)        │
│                                                      │
│         ┌── Glass card (max-width: 400px) ──┐        │
│         │    🧪 AI Talent Lab                │        │
│         │    Sign in to your workspace       │        │
│         │                                   │        │
│         │  Email                            │        │
│         │  [name@company.com          ]     │        │
│         │                                   │        │
│         │  Password              [Forgot?]  │        │
│         │  [••••••••            ] [👁]      │        │
│         │                                   │        │
│         │  [Sign In]  ← primary button      │        │
│         │                                   │        │
│         │  ── or ──                         │        │
│         │                                   │        │
│         │  [G Sign in with Google]          │        │
│         │                                   │        │
│         │  Don't have an account?           │        │
│         │  [Register your organization →]   │        │
│         └───────────────────────────────────┘        │
└──────────────────────────────────────────────────────┘
```

### Behavior
- Email field auto-focus on page load
- Eye icon toggles password visibility
- Enter key submits form
- Button shows spinner + "Signing in..." while loading
- Error appears as red inline message below the affected field
- On success: store JWT token + user in memory (AuthContext), redirect to `/`

### Role-Based Landing After Login
| Role | Landing Page |
|---|---|
| admin | `/` (Dashboard — full org view) |
| recruiter | `/` (Dashboard — dept view) |
| hiring_manager | `/` (Dashboard — assigned positions only) |

### API
- `POST /api/v1/auth/login` → `{ email, password }` → `{ token, user }`
- 401: "Invalid email or password"
- 423: "Account locked. Try again in {N} minutes." (after 5 failed attempts)

### Validation
| Field | Rules |
|---|---|
| Email | Required, valid format |
| Password | Required, min 8 chars |

---

## 3. Register Page

### Layout
```
┌──────────────────────────────────────────────────────┐
│         ┌── Glass card (max-width: 480px) ──┐        │
│         │    🧪 Create Your Organization     │        │
│         │                                   │        │
│         │  ── Organization ──               │        │
│         │                                   │        │
│         │  Organization Name *              │        │
│         │  [TechCorp                  ]     │        │
│         │  Career page: aitalentlab.com/techcorp     │
│         │                                   │        │
│         │  Industry / Segment *             │        │
│         │  [Technology              ▼]      │        │
│         │                                   │        │
│         │  Company Size *                   │        │
│         │  (○) Startup  (●) SMB  (○) Enterprise      │
│         │                                   │        │
│         │  Website                          │        │
│         │  [https://techcorp.com      ]     │        │
│         │                                   │        │
│         │  ── Your Admin Account ──         │        │
│         │                                   │        │
│         │  Full Name *                      │        │
│         │  [Srinivas R                ]     │        │
│         │                                   │        │
│         │  Work Email *                     │        │
│         │  [srinivas@techcorp.com     ]     │        │
│         │                                   │        │
│         │  Password *                       │        │
│         │  [                    ] [👁]      │        │
│         │  ████████░░ Strength: Strong      │        │
│         │  ✅ 8+ chars  ✅ Uppercase         │        │
│         │  ✅ Number    ✅ Special char      │        │
│         │                                   │        │
│         │  Confirm Password *               │        │
│         │  [                    ] [👁]      │        │
│         │                                   │        │
│         │  [Create Organization]            │        │
│         │                                   │        │
│         │  Already registered? [Sign in →]  │        │
│         └───────────────────────────────────┘        │
└──────────────────────────────────────────────────────┘
```

### Org Slug Auto-Generation
When user types org name, system shows the preview career page URL in real time:
```
Organization Name: [TechCorp AI]
Career page URL:   aitalentlab.com/techcorp-ai  ← auto-generated, shown live
```
Slug rules: lowercase, spaces → hyphens, special chars removed, max 50 chars.
Slug is immutable after registration (it's part of public URLs).

### Segment Options
Technology, Healthcare, Finance & Banking, E-Commerce, Manufacturing, Education, Media & Entertainment, Consulting, Other

### API
- `POST /api/v1/auth/register` → `{ org_name, slug (auto), email, password, name, segment, size, website }`
- On success: auto-login → redirect to `/`
- 409 duplicate email: "This email is already registered"
- 409 duplicate org name: "This organization name is taken"

### Validation
| Field | Rules |
|---|---|
| Org Name | Required, 2–100 chars, unique |
| Segment | Required, from dropdown |
| Size | Required, one of: startup/smb/enterprise |
| Name | Required, 2–50 chars |
| Email | Required, valid email, unique |
| Password | Required, min 8, 1 uppercase, 1 number, 1 special char |

---

## 4. Forgot Password Page

```
┌──────────────────────────────────────────────────────┐
│         ┌── Glass card (max-width: 400px) ──┐        │
│         │    🔑 Reset your password          │        │
│         │    Enter your email and we'll      │        │
│         │    send you a reset link.          │        │
│         │                                   │        │
│         │  Email                            │        │
│         │  [name@company.com          ]     │        │
│         │                                   │        │
│         │  [Send Reset Link]                │        │
│         │  [← Back to Login]                │        │
│         │                                   │        │
│         │  ── After submit ──               │        │
│         │  ✅ Check your inbox              │        │
│         │  If that email exists, we've sent │        │
│         │  a reset link. Valid for 24h.     │        │
│         │  [← Back to Login]                │        │
│         └───────────────────────────────────┘        │
└──────────────────────────────────────────────────────┘
```

**Always show success message** regardless of whether email exists — never leak user existence.

- `POST /api/v1/auth/forgot-password` → `{ email }`
- Email sent via `EMAIL_PROVIDER` adapter

---

## 5. Reset Password Page (`/reset-password/:token`)

```
┌──────────────────────────────────────────────────────┐
│         ┌── Glass card ──────────────────────┐       │
│         │    🔑 Set new password              │       │
│         │                                   │       │
│         │  New Password                     │       │
│         │  [                    ] [👁]      │       │
│         │                                   │       │
│         │  Confirm Password                 │       │
│         │  [                    ] [👁]      │       │
│         │                                   │       │
│         │  [Reset Password]                 │       │
│         │                                   │       │
│         │  ── If token expired ──           │       │
│         │  ⏰ This link has expired          │       │
│         │  [Request new reset link →]       │       │
│         └───────────────────────────────────┘       │
└──────────────────────────────────────────────────────┘
```

- `POST /api/v1/auth/reset-password` → `{ token, new_password }`
- Token valid 24 hours from request time
- On success: redirect to `/login` with success toast

---

## 6. Security

| Concern | Implementation |
|---|---|
| Rate limiting | 10 auth attempts per IP per minute |
| Account lockout | 5 failed login attempts → locked for 15 min |
| Token storage | JWT stored in memory (AuthContext) — not localStorage for security |
| Password visibility | Never pre-fill from browser history |
| Session check | On app load, validate token; if expired → redirect to /login |
| CSRF | Not needed (JWT is stateless) |
