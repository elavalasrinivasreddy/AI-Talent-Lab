# Page Design: Authentication

> Login, Register, and Password Reset pages — the entry point for all users.

---

## 1. Pages in This Module

| Page | Route | Auth Required | Purpose |
|------|-------|---------------|---------|
| Login | `/login` | No | Email/password sign-in |
| Register | `/register` | No | New org + admin user signup |
| Forgot Password | `/forgot-password` | No | Request password reset email |
| Reset Password | `/reset-password/:token` | No | Set new password via token |

---

## 2. Login Page

### Layout
```
┌──────────────────────────────────────────────────┐
│                                                  │
│           ┌──────────────────────────┐            │
│           │      🧪 AI Talent Lab    │            │
│           │                          │            │
│           │  Email                   │            │
│           │  ┌──────────────────┐    │            │
│           │  │                  │    │            │
│           │  └──────────────────┘    │            │
│           │                          │            │
│           │  Password                │            │
│           │  ┌──────────────────┐    │            │
│           │  │                  │ 👁  │            │
│           │  └──────────────────┘    │            │
│           │                          │            │
│           │  [Forgot password?]      │            │
│           │                          │            │
│           │  ┌──────────────────┐    │            │
│           │  │    Sign In       │    │            │
│           │  └──────────────────┘    │            │
│           │                          │            │
│           │  Don't have an account?  │            │
│           │  [Register your org →]   │            │
│           └──────────────────────────┘            │
│                                                  │
│         Background: gradient or subtle pattern    │
└──────────────────────────────────────────────────┘
```

### UI Details
- **Background**: Full-page gradient (deep navy → purple) or subtle animated pattern
- **Card**: Centered, `max-width: 400px`, glass-morphism card with backdrop blur
- **Logo**: App logo + name at top of card
- **Inputs**: Full-width, dark-themed inputs with focus ring
- **Password toggle**: Eye icon to show/hide password
- **Error display**: Red alert below the field with the issue
- **Loading state**: Button shows spinner + "Signing in..."
- **Auto-focus**: Email field gets auto-focus on page load

### Backend Integration
- `POST /api/auth/login` → `{ email, password }` → `{ token, user }`
- On success: store token + user in localStorage, redirect to Dashboard
- On 401: show "Invalid email or password"
- On network error: show "Unable to connect to server"

### Validation Rules
| Field | Rules |
|-------|-------|
| Email | Required, valid email format |
| Password | Required, min 8 characters |

---

## 3. Register Page

### Layout
```
┌──────────────────────────────────────────────────┐
│           ┌──────────────────────────┐            │
│           │    🧪 Create Your Account│            │
│           │                          │            │
│           │  ── Organization ──      │            │
│           │  Organization Name       │            │
│           │  ┌──────────────────┐    │            │
│           │  │                  │    │            │
│           │  └──────────────────┘    │            │
│           │                          │            │
│           │  Industry / Segment      │            │
│           │  ┌──────────────────┐    │            │
│           │  │ Technology     ▼ │    │            │
│           │  └──────────────────┘    │            │
│           │                          │            │
│           │  Company Size            │            │
│           │  ○ Startup  ○ SMB  ○ Ent │            │
│           │                          │            │
│           │  Website (optional)      │            │
│           │  ┌──────────────────┐    │            │
│           │  │                  │    │            │
│           │  └──────────────────┘    │            │
│           │                          │            │
│           │  ── Admin Account ──     │            │
│           │  Your Name               │            │
│           │  ┌──────────────────┐    │            │
│           │  │                  │    │            │
│           │  └──────────────────┘    │            │
│           │                          │            │
│           │  Email                   │            │
│           │  ┌──────────────────┐    │            │
│           │  │                  │    │            │
│           │  └──────────────────┘    │            │
│           │                          │            │
│           │  Password                │            │
│           │  ┌──────────────────┐    │            │
│           │  │                  │    │            │
│           │  └──────────────────┘    │            │
│           │  Password strength: ████ │            │
│           │                          │            │
│           │  ┌──────────────────┐    │            │
│           │  │  Create Account  │    │            │
│           │  └──────────────────┘    │            │
│           │                          │            │
│           │  Already registered?     │            │
│           │  [Sign in →]             │            │
│           └──────────────────────────┘            │
└──────────────────────────────────────────────────┘
```

### UI Details
- **Two sections**: "Organization" and "Admin Account" visually separated
- **Industry dropdown**: Pre-populated with common industries (Technology, Healthcare, Finance, etc.)
- **Company size**: Radio button group or segmented control
- **Password strength**: Visual bar (red → yellow → green) with requirement checklist
- **Terms**: Consider adding a terms/privacy checkbox before launch

### Backend Integration
- `POST /api/auth/register` → `{ org_name, email, password, name, segment, size, website }`
- On success: auto-login, redirect to Dashboard
- On 409 (duplicate email): "Email already registered"
- On 409 (duplicate org): "Organization name already taken"

### Validation Rules
| Field | Rules |
|-------|-------|
| Org Name | Required, 2–100 chars, unique |
| Segment | Required, from dropdown |
| Size | Required, radio selection |
| Name | Required, 2–50 chars |
| Email | Required, valid email, unique |
| Password | Required, min 8, 1 uppercase, 1 number, 1 special char |

---

## 4. Forgot Password Page

### Layout
```
┌──────────────────────────────────────────────────┐
│           ┌──────────────────────────┐            │
│           │    🔑 Reset Password     │            │
│           │                          │            │
│           │  Enter your email and    │            │
│           │  we'll send a reset link.│            │
│           │                          │            │
│           │  Email                   │            │
│           │  ┌──────────────────┐    │            │
│           │  │                  │    │            │
│           │  └──────────────────┘    │            │
│           │                          │            │
│           │  ┌──────────────────┐    │            │
│           │  │  Send Reset Link │    │            │
│           │  └──────────────────┘    │            │
│           │                          │            │
│           │  [← Back to Login]       │            │
│           └──────────────────────────┘            │
│                                                  │
│  (After submit, show confirmation):              │
│           ┌──────────────────────────┐            │
│           │  ✅ Check your email     │            │
│           │  We've sent a reset link │            │
│           │  to your email address.  │            │
│           │                          │            │
│           │  [← Back to Login]       │            │
│           └──────────────────────────┘            │
└──────────────────────────────────────────────────┘
```

### Backend Integration
- `POST /api/auth/forgot-password` → `{ email }`
- Always show success message (don't leak whether email exists)
- Send email with signed reset token (24-hour expiry)

---

## 5. Security Considerations

- **Rate limit**: 5 login attempts per email per 15 minutes
- **CSRF**: Not needed for JWT (stateless)
- **XSS**: No `dangerouslySetInnerHTML` with user input
- **Token storage**: `localStorage` (acceptable for SPA; consider `httpOnly` cookies for stricter security)
- **Password visibility toggle**: Never pre-fill passwords from history
- **Session expiry**: Check token validity on app load; if expired, redirect to login
