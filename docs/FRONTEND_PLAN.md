# AI Talent Lab — Frontend Plan
> **Version 2.1 — Corrected & Complete**
> Aligned with RESTRUCTURE_PLAN.md. PascalCase component folders, split CSS, hooks layer, full component tree including all new features.

---

## 1. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| **Framework** | React 18+ (Vite) | Fast HMR, ES modules |
| **Build Tool** | Vite 5+ | Zero-config, lightning fast |
| **Styling** | Vanilla CSS (custom properties) | Split into page-scoped files — no 39KB monolith |
| **State** | React Context API | AuthContext, ChatContext, NotificationContext, ThemeContext |
| **HTTP Client** | Axios + native Fetch (SSE) | Axios for REST, Fetch for SSE streaming |
| **Routing** | React Router v6 | URL-based, deep linking, code splitting |
| **Markdown** | react-markdown + remark-gfm | JD rendering |
| **Icons** | Inline SVG | No icon library dependency |
| **Fonts** | DM Sans + DM Mono (Google Fonts) | Professional, distinctive |

---

## 2. Design System

### 2.1 Color Palette

```css
/* Dark Theme (default) */
:root {
  --bg-primary:      #0a0a1a;
  --bg-secondary:    #12122a;
  --bg-tertiary:     #1a1a3e;
  --bg-hover:        #22224a;
  --text-primary:    #e8e8f0;
  --text-secondary:  #9898b8;
  --text-tertiary:   #666680;
  --accent-primary:  #667eea;
  --accent-secondary:#764ba2;
  --accent-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --accent-success:  #22c55e;
  --accent-warning:  #f59e0b;
  --accent-danger:   #ef4444;
  --accent-info:     #06b6d4;
  --border:          #2a2a4a;
  --border-light:    #1a1a3e;
  --shadow:          0 4px 24px rgba(0,0,0,0.3);
  --shadow-lg:       0 8px 40px rgba(0,0,0,0.4);
}

/* Light Theme */
.theme-light {
  --bg-primary:    #f8f9fc;
  --bg-secondary:  #ffffff;
  --bg-tertiary:   #f0f1f5;
  --bg-hover:      #e8e9f0;
  --text-primary:  #1a1a2e;
  --text-secondary:#555570;
  --border:        #e0e0ee;
  --shadow:        0 4px 24px rgba(0,0,0,0.08);
}
```

### 2.2 Typography

```css
--font-sans: 'DM Sans', -apple-system, sans-serif;
--font-mono: 'DM Mono', monospace;
--text-xs:   0.75rem;    /* 12px */
--text-sm:   0.875rem;   /* 14px */
--text-base: 1rem;       /* 16px */
--text-lg:   1.125rem;   /* 18px */
--text-xl:   1.25rem;    /* 20px */
--text-2xl:  1.5rem;     /* 24px */
--text-3xl:  2rem;       /* 32px */
```

### 2.3 Spacing & Layout Tokens

```css
--space-1: 4px;   --space-2: 8px;   --space-3: 12px;  --space-4: 16px;
--space-5: 20px;  --space-6: 24px;  --space-8: 32px;  --space-10: 40px;
--radius-sm: 4px; --radius-md: 8px; --radius-lg: 12px; --radius-full: 9999px;
--sidebar-width: 280px;  --topbar-height: 56px;
```

### 2.4 Pipeline Status Colors

```css
--status-sourced:   #06b6d4;  /* cyan */
--status-emailed:   #8b5cf6;  /* violet */
--status-applied:   #3b82f6;  /* blue */
--status-screening: #f59e0b;  /* amber */
--status-interview: #667eea;  /* purple-blue */
--status-selected:  #22c55e;  /* green */
--status-rejected:  #ef4444;  /* red */
--status-on-hold:   #6b7280;  /* gray */
```

---

## 3. Project Structure

> Follows RESTRUCTURE_PLAN.md component folder conventions (PascalCase for component folders).
> New features (Panel/, Careers/, TalentPool/) added. api/client.js split into endpoints/ for maintainability.

```
frontend/src/
├── main.jsx
├── App.jsx                            # Root: RouterProvider, all context providers
├── router.jsx                         # All route definitions
│
├── api/
│   ├── client.js                      # Axios instance with interceptors (base URL, auth header)
│   ├── stream.js                      # SSE streaming helper
│   └── endpoints/                     # One file per API domain (improvement over single client.js)
│       ├── auth.js
│       ├── chat.js
│       ├── positions.js
│       ├── candidates.js
│       ├── interviews.js
│       ├── dashboard.js
│       ├── settings.js
│       ├── notifications.js
│       ├── talentPool.js
│       ├── apply.js                   # Public endpoints — no auth header
│       ├── panel.js                   # Panel token endpoints
│       └── careers.js                 # Public career page endpoints
│
├── hooks/                             # Custom React hooks
│   ├── useAuth.js
│   ├── useChat.js
│   ├── useNotifications.js
│   ├── useDebounce.js                 # 300ms debounce for search inputs
│   ├── useLocalStorage.js
│   └── usePagination.js
│
├── context/
│   ├── AuthContext.jsx                # token, user, login(), logout()
│   ├── ChatContext.jsx                # sessions, messages, streaming, workflowStage
│   ├── NotificationContext.jsx        # unread count, poll every 30s
│   └── ThemeContext.jsx               # dark/light/system — stored in localStorage
│
├── styles/                            # Split CSS — replaces 39KB index.css monolith
│   ├── globals.css                    # CSS custom properties, resets, base typography
│   ├── layout.css                     # Sidebar, topbar, main container, responsive
│   ├── components.css                 # Buttons, inputs, cards, badges, chips — shared tokens
│   ├── auth.css                       # Login, register pages
│   ├── chat.css                       # Chat window, messages, stage cards, streaming
│   ├── dashboard.css                  # Stats cards, funnel chart, positions table
│   ├── positions.css                  # Position detail, pipeline Kanban board
│   ├── candidates.css                 # Candidate detail, skills match, timeline
│   ├── settings.css                   # Settings layout + all tabs
│   ├── apply.css                      # Candidate magic link chat (public)
│   ├── panel.css                      # Panel feedback page (public)
│   ├── talent-pool.css
│   ├── career-page.css
│   ├── interview-kit.css
│   ├── notifications.css
│   └── animations.css                 # Skeleton loaders, transitions, streaming cursor
│
├── components/
│   │
│   ├── common/                        # Shared UI primitives (replaces scattered inline styles)
│   │   ├── Button.jsx
│   │   ├── Input.jsx
│   │   ├── Badge.jsx                  # Status badges, priority chips, score badges
│   │   ├── Card.jsx
│   │   ├── Modal.jsx
│   │   ├── Tabs.jsx
│   │   ├── Timeline.jsx               # Vertical event timeline component
│   │   ├── SkillChip.jsx              # Selectable/display-only skill chip
│   │   ├── ScoreCircle.jsx            # ATS score circle visualization
│   │   ├── EmptyState.jsx
│   │   ├── LoadingSpinner.jsx
│   │   ├── SkeletonCard.jsx           # Loading skeleton — NOT spinning wheel
│   │   ├── ConfirmDialog.jsx
│   │   ├── Pagination.jsx
│   │   ├── PageHeader.jsx
│   │   ├── BackLink.jsx               # Context-aware back button
│   │   ├── SearchBar.jsx              # Debounced search input
│   │   └── Toast.jsx
│   │
│   ├── Auth/                          # PascalCase — matches RESTRUCTURE_PLAN
│   │   ├── LoginPage.jsx
│   │   └── RegisterPage.jsx
│   │
│   ├── Sidebar/
│   │   ├── Sidebar.jsx
│   │   ├── SidebarBrand.jsx
│   │   ├── SidebarNav.jsx             # Dashboard, Talent Pool, Settings links
│   │   ├── SidebarSessions.jsx        # Active chat sessions list
│   │   └── SidebarUser.jsx            # Avatar + role + logout
│   │
│   ├── Chat/                          # Recruiter JD creation chat
│   │   ├── ChatPage.jsx
│   │   ├── ChatTopBar.jsx             # Session title (editable) + stage indicator + actions
│   │   ├── MessageList.jsx
│   │   ├── MessageBubble.jsx          # User/assistant bubble
│   │   ├── StreamedText.jsx           # Token streaming with blinking cursor
│   │   ├── MessageInput.jsx           # Textarea + file upload + send button
│   │   ├── FileUploader.jsx           # Reference JD upload (PDF/DOCX)
│   │   ├── PositionSetupModal.jsx     # Headcount, search freq, ATS threshold, priority
│   │   └── cards/                     # Interactive cards inside chat
│   │       ├── InternalCheckCard.jsx  # Internal skills — selectable chips
│   │       ├── MarketResearchCard.jsx # Market skills — selectable chips
│   │       ├── JDVariantsCard.jsx     # 3 JD variants side by side
│   │       ├── FinalJDCard.jsx        # Final JD with edit/download/save
│   │       └── BiasCheckCard.jsx      # Bias check results
│   │
│   ├── Dashboard/
│   │   ├── DashboardPage.jsx
│   │   ├── StatsCards.jsx             # 4 cards with global period selector
│   │   ├── HiringFunnel.jsx           # Horizontal bar funnel chart
│   │   ├── ActivityFeed.jsx           # Timeline of recent events (polls 30s)
│   │   └── PositionsTable.jsx         # Filterable positions list
│   │
│   ├── Positions/
│   │   ├── PositionDetailPage.jsx
│   │   ├── PositionHeader.jsx         # Title, stats row, status dropdown
│   │   └── tabs/
│   │       ├── PipelineTab.jsx        # Kanban board
│   │       ├── CandidatesTab.jsx      # List view with bulk actions
│   │       ├── JDTab.jsx              # JD viewer + edit + download
│   │       ├── InterviewKitTab.jsx    # AI questions + scorecard template
│   │       ├── ActivityTab.jsx        # Team activity feed + comment box
│   │       └── SettingsTab.jsx        # Auto-search, threshold, position config
│   │
│   ├── Candidates/
│   │   ├── CandidateDetailPage.jsx
│   │   ├── CandidateHeader.jsx        # Name, contact, score, status, actions
│   │   └── tabs/
│   │       ├── SkillsMatchTab.jsx
│   │       ├── ApplicationTab.jsx     # Screening responses
│   │       ├── ResumeTab.jsx
│   │       ├── InterviewsTab.jsx      # Rounds + aggregate scorecards + debrief
│   │       └── TimelineTab.jsx        # Unified activity timeline (replaces CandidateHistory)
│   │
│   ├── Interviews/
│   │   ├── ScheduleInterviewModal.jsx # Create/edit interview round
│   │   ├── InterviewCard.jsx          # Single round display with status
│   │   └── ScorecardView.jsx          # Aggregate scorecard display per round
│   │
│   ├── TalentPool/
│   │   ├── TalentPoolPage.jsx
│   │   ├── BulkUploadZone.jsx         # Prominent upload area — appears FIRST
│   │   ├── PoolCandidateCard.jsx
│   │   └── AISuggestionsPanel.jsx     # Pool matches for selected position
│   │
│   ├── Settings/
│   │   ├── SettingsPage.jsx
│   │   └── tabs/
│   │       ├── ProfileTab.jsx
│   │       ├── OrganizationTab.jsx    # About Us, culture keywords, benefits — feeds JD gen
│   │       ├── TeamTab.jsx
│   │       ├── DepartmentsTab.jsx
│   │       ├── CompetitorsTab.jsx     # Feeds market research step
│   │       ├── ScreeningQuestionsTab.jsx  # Dynamic questions for apply chat
│   │       ├── MessageTemplatesTab.jsx    # Email templates incl. interview_process_overview
│   │       ├── InterviewTemplatesTab.jsx  # Scorecard dimension templates
│   │       ├── IntegrationsTab.jsx
│   │       ├── AppearanceTab.jsx
│   │       └── SecurityTab.jsx
│   │
│   ├── Notifications/
│   │   └── NotificationBell.jsx       # Bell icon + unread count + dropdown
│   │
│   ├── Apply/                         # Candidate magic link chat — PUBLIC
│   │   ├── ApplyPage.jsx              # Verifies token, renders correct state
│   │   ├── ApplyChat.jsx              # Chat interface
│   │   ├── ApplyExpired.jsx           # Expired link state
│   │   └── ApplyComplete.jsx          # Success state
│   │
│   ├── Panel/                         # Panel feedback — PUBLIC (new)
│   │   ├── PanelPage.jsx              # Verifies token, renders correct state
│   │   ├── AttendanceCheck.jsx        # "Did you attend?" — first thing shown
│   │   ├── PanelFeedbackForm.jsx      # Full feedback form
│   │   ├── ScorecardForm.jsx          # Ratings + notes per dimension
│   │   └── PanelComplete.jsx          # Submitted state
│   │
│   └── Careers/                       # Public career page — PUBLIC (new)
│       ├── CareerPage.jsx             # Org info + open positions list
│       ├── PositionCard.jsx           # Single position card
│       ├── CareerPositionDetail.jsx   # Full JD + apply button
│       └── CareerApplyFlow.jsx        # Direct apply (starts candidate chat)
│
└── utils/
    ├── formatters.js                  # Date, currency, number formatting
    ├── validators.js                  # Form validation
    ├── constants.js                   # Pipeline stages, status colors, roles
    └── permissions.js                 # Role-based UI helpers (canEdit, canView, etc.)
```

---

## 4. Routing

```jsx
const routes = [
  // Public — no sidebar, no auth
  { path: '/login',     element: <LoginPage /> },
  { path: '/register',  element: <RegisterPage /> },
  { path: '/apply/:token',          element: <PublicLayout><ApplyPage /></PublicLayout> },
  { path: '/panel/:token',          element: <PublicLayout><PanelPage /></PublicLayout> },
  { path: '/careers/:orgSlug',      element: <PublicLayout><CareerPage /></PublicLayout> },
  { path: '/careers/:orgSlug/:id',  element: <PublicLayout><CareerPositionDetail /></PublicLayout> },

  // Authenticated — with sidebar + topbar
  {
    path: '/',
    element: <AuthGuard><AppLayout /></AuthGuard>,
    children: [
      { index: true,                       element: <DashboardPage /> },
      { path: 'chat',                      element: <ChatPage /> },
      { path: 'chat/:sessionId',           element: <ChatPage /> },
      { path: 'positions/:id',             element: <PositionDetailPage /> },
      { path: 'positions/:id/:tab',        element: <PositionDetailPage /> },
      { path: 'candidates/:id',            element: <CandidateDetailPage /> },
      { path: 'candidates/:id/:tab',       element: <CandidateDetailPage /> },
      { path: 'talent-pool',               element: <TalentPoolPage /> },
      { path: 'settings',                  element: <SettingsPage /> },
      { path: 'settings/:tab',             element: <SettingsPage /> },
    ]
  }
];
```

All API calls use `/api/v1/` prefix matching backend routes.

---

## 5. State Management

### Context Provider Hierarchy

```jsx
<ThemeProvider>           // dark/light/system — localStorage
  <AuthProvider>          // token, user, login(), logout()
    <NotificationProvider>// unread count, poll every 30s
      <ChatProvider>      // sessions, messages, streaming, workflowStage
        <RouterProvider router={router} />
      </ChatProvider>
    </NotificationProvider>
  </AuthProvider>
</ThemeProvider>
```

### ChatContext — SSE Streaming Events

```javascript
// Events received from /api/v1/chat/stream
"token"        → append to current message bubble
"stage_change" → update stage indicator in topbar + sidebar label
"card_internal"→ render InternalCheckCard in message list
"card_market"  → render MarketResearchCard
"card_variants"→ render JDVariantsCard (3 side-by-side)
"card_bias"    → render BiasCheckCard below FinalJDCard
"jd_token"     → append to FinalJDCard (separate stream from chat text)
"metadata"     → update session title, stage
"done"         → setIsStreaming(false)
"error"        → show error on current message
```

---

## 6. Context-Aware Back Navigation

Candidate detail can be reached from multiple places. The back button must return correctly:

```javascript
// Always pass context when navigating TO candidate detail:
navigate(`/candidates/${id}`, {
  state: {
    from: currentPath,       // e.g., '/positions/42' or '/talent-pool'
    fromLabel: 'Back to Senior Python Developer',
    fromTab: 'pipeline'      // which tab to restore on position page
  }
});

// In CandidateDetailPage:
const { state } = useLocation();
const backPath  = state?.from || '/';
const backLabel = state?.fromLabel || 'Back to Dashboard';
```

**Candidate profile must open from:**
- Position Detail → Pipeline tab (Kanban card)
- Position Detail → Candidates tab (list row)
- Talent Pool → candidate card
- Dashboard → activity feed candidate name
- Notification → action_url click

---

## 7. Page Navigation Map

```
PUBLIC (no sidebar):
  /login  /register
  /apply/:token          → Candidate magic link chat
  /panel/:token          → Panel feedback form
  /careers/:orgSlug      → Career page
  /careers/:orgSlug/:id  → Position detail + direct apply

AUTHENTICATED (sidebar + topbar):
  / (Dashboard)
    → click position row → /positions/:id
    → click "New Hire"   → /chat

  /chat  /chat/:sessionId
    → save JD → Position Setup Modal → /positions/:id

  /positions/:id
    Tabs: Pipeline | Candidates | JD | Interview Kit | Activity | Settings
    → click candidate → /candidates/:id (with from context)
    → back ← → /  (Dashboard)

  /candidates/:id
    Tabs: Skills Match | Application | Resume | Interviews | Timeline
    → back ← → wherever user came from (position or talent pool)

  /talent-pool
    → click candidate → /candidates/:id (with from=talent-pool)

  /settings  /settings/:tab
    Tabs: Profile | Organization | Team | Departments | Competitors |
          Screening Questions | Message Templates | Interview Templates |
          Integrations | Appearance | Security
```

---

## 8. Responsive Design

| Breakpoint | Layout | Sidebar |
|---|---|---|
| Desktop >1200px | Full sidebar + main content | Always visible |
| Tablet 768–1200px | Main content only | Overlay on hamburger |
| Mobile <768px | Full-width | Hidden, hamburger menu |

**Priority:** Desktop-first (B2B SaaS). Public pages (apply, panel, careers) are **mobile-first** since candidates use phones.

---

## 9. Performance

- **Code splitting:** `React.lazy()` on all page-level components
- **Debounced search:** 300ms on all filter/search inputs
- **SSE buffering:** Batch token updates — don't re-render on every character
- **Skeleton screens:** All data-loading views use skeleton cards (not spinner wheels)
- **Optimistic updates:** Status changes + comments update UI immediately, revert on error
- **Pagination:** All candidate and pool lists paginate at 20 items per page

---

## 10. Theme System

```javascript
// ThemeContext.jsx
const THEMES = ['dark', 'light', 'system'];
// 'system' reads window.matchMedia('(prefers-color-scheme: dark)')
// Stored in localStorage as 'theme'
// Applied as class on <html>: 'theme-dark' or 'theme-light'
// Changes apply instantly — no page reload
```
