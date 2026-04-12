# AI Talent Lab — Frontend Plan

> Frontend architecture, design system, tech stack, routing, and component structure for the AI Talent Lab platform.

---

## 1. Tech Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| **Framework** | React 18+ (Vite) | Fast builds, HMR, modern ecosystem |
| **Build Tool** | Vite 5+ | Lightning fast HMR, ES modules, zero-config |
| **Styling** | Vanilla CSS (custom properties) | Full control, no utility class clutter, CSS variables for theming |
| **State** | React Context API | Sufficient for current scale, no Redux overhead |
| **HTTP Client** | Axios + Fetch (SSE) | Axios for REST, native Fetch for SSE streaming |
| **Routing** | Simple state-based (→ React Router later) | Currently `currentPage` state; migrate to React Router for URL support |
| **Markdown** | react-markdown + remark-gfm | JD rendering with GitHub-flavored markdown |
| **PDF Export** | html2pdf.js or jsPDF | Client-side JD download as PDF |
| **Icons** | Inline SVG + Emoji | Lightweight, no icon library dependency |
| **Fonts** | Inter (Google Fonts) | Modern, clean, excellent readability |

---

## 2. Design System

### 2.1 Color Palette (CSS Custom Properties)

```css
/* ── Dark Theme (default) ── */
--bg-primary:    #0a0a1a;      /* Deep navy — main background */
--bg-secondary:  #12122a;      /* Slightly lighter — cards, sidebar */
--bg-tertiary:   #1a1a3e;      /* Interactive elements, inputs */
--bg-hover:      #22224a;      /* Hover states */

--text-primary:  #e8e8f0;      /* Main text */
--text-secondary:#9898b8;      /* Muted text, labels */
--text-tertiary: #666680;      /* Disabled, placeholders */

--accent-primary:  #667eea;    /* Primary actions, links */
--accent-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
--accent-success:  #22c55e;    /* Positive states */
--accent-warning:  #f59e0b;    /* Warnings */
--accent-danger:   #ef4444;    /* Errors, destructive */
--accent-info:     #06b6d4;    /* Information */

--border:        #2a2a4a;      /* Default borders */
--border-light:  #1a1a3e;      /* Subtle separators */
--shadow:        0 4px 24px rgba(0,0,0,0.3);

/* ── Light Theme ── */
.light-theme {
  --bg-primary:    #f8f9fc;
  --bg-secondary:  #ffffff;
  --bg-tertiary:   #f0f1f5;
  --text-primary:  #1a1a2e;
  --text-secondary:#666680;
  --border:        #e0e0e8;
}
```

### 2.2 Typography
```css
--font-family:    'Inter', -apple-system, sans-serif;
--font-size-xs:   0.75rem;     /* 12px — badges, timestamps */
--font-size-sm:   0.875rem;    /* 14px — body text, inputs */
--font-size-md:   1rem;        /* 16px — paragraphs */
--font-size-lg:   1.25rem;     /* 20px — section titles */
--font-size-xl:   1.5rem;      /* 24px — page titles */
--font-size-2xl:  2rem;        /* 32px — hero stats */
```

### 2.3 Spacing & Layout
```css
--spacing-xs:  4px;
--spacing-sm:  8px;
--spacing-md:  16px;
--spacing-lg:  24px;
--spacing-xl:  32px;
--spacing-2xl: 48px;

--radius-sm:   4px;
--radius-md:   8px;
--radius-lg:   12px;
--radius-xl:   16px;
--radius-full: 9999px;

--sidebar-width:     280px;
--sidebar-collapsed: 64px;
--topbar-height:     56px;
```

### 2.4 Component Tokens
```css
/* Buttons */
--btn-height:        40px;
--btn-padding:       0 20px;
--btn-radius:        var(--radius-md);
--btn-font-weight:   600;

/* Cards */
--card-bg:           var(--bg-secondary);
--card-border:       1px solid var(--border);
--card-radius:       var(--radius-lg);
--card-padding:      var(--spacing-lg);
--card-shadow:       var(--shadow);

/* Inputs */
--input-height:      42px;
--input-bg:          var(--bg-tertiary);
--input-border:      1px solid var(--border);
--input-radius:      var(--radius-md);
--input-focus-ring:  0 0 0 2px rgba(102, 126, 234, 0.3);
```

---

## 3. Application Structure

```
frontend/src/
├── App.jsx                          # Root: routing, auth gate, layout
├── main.jsx                         # Vite entry point
│
├── api/
│   └── client.js                    # Axios instance, SSE streaming, API functions
│
├── hooks/                           # Custom React hooks
│   ├── useAuth.js                   # Auth context hook
│   ├── useChat.js                   # Chat context hook
│   ├── useNotifications.js          # Notification context hook
│   └── useDebounce.js               # Debounce hook for search inputs
│
├── context/
│   ├── AuthContext.jsx              # Auth state (token, user, login, logout)
│   ├── ChatContext.jsx              # Chat state (sessions, messages, streaming)
│   └── NotificationContext.jsx      # Notification polling
│
├── styles/                          # Split CSS (replaces single index.css)
│   ├── globals.css                  # CSS custom properties, resets, typography
│   ├── layout.css                   # Sidebar, main container, responsive
│   ├── components.css               # Buttons, inputs, cards, badges
│   ├── auth.css
│   ├── chat.css
│   ├── dashboard.css
│   ├── positions.css
│   ├── candidates.css
│   ├── settings.css
│   ├── apply.css
│   ├── notifications.css
│   ├── interview-kit.css
│   ├── talent-pool.css
│   ├── scheduling.css
│   └── career-page.css
│
├── components/
│   ├── common/                      # Shared UI primitives
│   │   ├── StatusBadge.jsx
│   │   ├── SkillChip.jsx
│   │   ├── EmptyState.jsx
│   │   ├── LoadingSpinner.jsx
│   │   ├── ConfirmDialog.jsx
│   │   ├── Pagination.jsx
│   │   ├── PageHeader.jsx
│   │   ├── CommentThread.jsx          # Reusable comment list + input (for collaboration)
│   │   └── TagInput.jsx               # Tag input with autocomplete
│   │
│   ├── Auth/
│   │   ├── LoginPage.jsx
│   │   └── RegisterPage.jsx
│   │
│   ├── Sidebar/
│   │   ├── Sidebar.jsx
│   │   ├── ProductBrand.jsx
│   │   ├── NewHireButton.jsx
│   │   ├── ActiveRoles.jsx
│   │   ├── NavLinks.jsx               # Dashboard, Talent Pool, Career Page links
│   │   └── UserProfile.jsx
│   │
│   ├── Chat/
│   │   ├── ChatWindow.jsx
│   │   ├── ChatTopBar.jsx
│   │   ├── MessageList.jsx
│   │   ├── MessageBubble.jsx
│   │   ├── MessageInput.jsx
│   │   ├── StreamedText.jsx
│   │   └── FileUploader.jsx
│   │
│   ├── JD/
│   │   ├── AgentRecommendations.jsx   # Skill chip selector
│   │   ├── JDOverviewCards.jsx        # 3 JD variant cards
│   │   ├── JDFullView.jsx             # Final JD viewer/editor + download
│   │   └── CandidatesPanel.jsx        # Candidates list below JD
│   │
│   ├── Dashboard/
│   │   ├── DashboardPage.jsx          # Main dashboard
│   │   ├── StatsCards.jsx             # Summary stat cards
│   │   ├── HiringFunnel.jsx           # Funnel visualization
│   │   ├── ActivityTimeline.jsx       # Recent events
│   │   ├── PositionsTable.jsx         # Filterable positions table
│   │   └── SourceEffectiveness.jsx    # Source conversion chart
│   │
│   ├── Positions/
│   │   ├── PositionDetailPage.jsx     # Full position page with tabs
│   │   ├── PipelineBoard.jsx          # Kanban-style pipeline view
│   │   ├── PositionJDTab.jsx          # JD viewer tab
│   │   ├── PositionSettingsTab.jsx    # Auto-search config
│   │   └── PositionActivityFeed.jsx   # Team activity feed on position
│   │
│   ├── Candidates/
│   │   ├── CandidateDetailPage.jsx    # Full candidate profile
│   │   ├── SkillsMatchCard.jsx        # Visual skills comparison
│   │   ├── CandidateHistory.jsx       # Activity timeline + comments
│   │   ├── CommunicationThread.jsx    # Email/WhatsApp thread view
│   │   └── ScorecardsView.jsx         # Aggregate scorecard display
│   │
│   ├── InterviewKit/                # [NEW]
│   │   ├── InterviewKitTab.jsx        # Tab on Position Detail
│   │   ├── QuestionsList.jsx          # Categorized questions display
│   │   ├── ScorecardTemplate.jsx      # Editable scorecard template
│   │   └── ShareableKitView.jsx       # Public shareable interview kit
│   │
│   ├── TalentPool/                  # [NEW]
│   │   ├── TalentPoolPage.jsx         # Searchable talent pool
│   │   ├── PoolCandidateCard.jsx      # Candidate card with tags
│   │   ├── PoolSuggestionsPanel.jsx   # AI-suggested matches for position
│   │   └── DeduplicationView.jsx      # Duplicate merge interface
│   │
│   ├── Scheduling/                  # [NEW]
│   │   ├── ScheduleInterviewModal.jsx # Create/edit interview modal
│   │   ├── InterviewTimeline.jsx      # Multi-round visual timeline
│   │   ├── SelfSchedulePage.jsx       # Public: candidate picks slot
│   │   └── ScorecardForm.jsx          # Interviewer scorecard submission
│   │
│   ├── Settings/
│   │   └── SettingsPage.jsx           # Organization settings (multi-tab)
│   │
│   ├── Notifications/
│   │   └── NotificationBell.jsx
│   │
│   ├── Apply/
│   │   └── ApplyPage.jsx              # Public application form (magic link)
│   │
│   └── CareerPage/                  # [NEW]
│       ├── CareerPage.jsx             # Public job board
│       ├── PositionCard.jsx           # Open position card
│       └── DirectApplyForm.jsx        # Apply without magic link
│
└── utils/                           # Frontend utilities
    ├── formatters.js                # Date, currency, number formatting
    ├── validators.js                # Form validation helpers
    └── constants.js                 # Pipeline stages, status colors, roles
```

---

## 4. Routing Plan

Currently using state-based routing (`currentPage`). Plan to migrate to React Router for URL support:

| Route | Component | Auth | Description |
|-------|-----------|------|-------------|
| `/login` | LoginPage | No | Login form |
| `/register` | RegisterPage | No | Org registration |
| `/` | DashboardPage | Yes | Dashboard home |
| `/chat` | ChatWindow | Yes | New chat |
| `/chat/:sessionId` | ChatWindow | Yes | Existing chat session |
| `/positions/:id` | PositionDetailPage | Yes | Position with pipeline/interview kit |
| `/positions/:id/:tab` | PositionDetailPage | Yes | Specific tab (pipeline/candidates/jd/interview-kit/settings) |
| `/candidates/:id` | CandidateDetailPage | Yes | Candidate profile |
| `/talent-pool` | TalentPoolPage | Yes | Org-wide talent pool |
| `/settings` | SettingsPage | Yes | Organization settings |
| `/settings/:tab` | SettingsPage | Yes | Specific settings tab |
| `/apply/:token` | ApplyPage | No | Public application (magic link) |
| `/schedule/:token` | SelfSchedulePage | No | Candidate self-scheduling (public) |
| `/interview-kit/:token` | ShareableKitView | No | Shareable interview kit for interviewers |
| `/careers/:orgSlug` | CareerPage | No | Public career page |
| `/careers/:orgSlug/:positionId` | CareerPage | No | Single position on career page |

---

## 5. Page Navigation Flow

```
Login / Register
       │
       ▼
┌─────────────────────────────────────────────┐
│          Sidebar (always visible)            │
│  ┌─────────────────┐  ┌──────────────────┐  │
│  │ 🧪 AI Talent Lab│  │ + New Hire       │  │
│  │                 │  │                  │  │
│  │ Session History │  │ Dashboard        │  │
│  │  • Sr Python... │  │ Talent Pool      │  │
│  │  • ML Engin...  │  │ Settings         │  │
│  │                 │  │ [user] [logout]  │  │
│  └─────────────────┘  └──────────────────┘  │
├─────────────────────────────────────────────┤
│          Main Content Area                   │
│                                              │
│  Dashboard ──(click position)──→ Position    │
│                                  Detail      │
│  Position  ──(click candidate)──→ Candidate  │
│  Detail                           Detail     │
│                                              │
│  Position  ──(Interview Kit tab)─→ Interview │
│  Detail                           Kit View   │
│                                              │
│  Candidate ──(schedule)──────────→ Schedule   │
│  Detail                           Modal      │
│                                              │
│  Chat      ──(JD done, save)───→ Dashboard   │
│  Window                           (position  │
│                                    created)   │
│                                              │
│  Talent    ──(click candidate)──→ Candidate  │
│  Pool                             Detail     │
│                                              │
│  Notification ──(click)─────────→ Position/  │
│                                   Chat page   │
└──────────────────────────────────────────────┘
```

Public pages (no sidebar):
```
Career Page ──(click position)──→ Position Detail ──(apply)──→ Direct Apply Form
Magic Link  ──────────────────→ Apply Page
Schedule    ──────────────────→ Self-Schedule Page (candidate picks slot)
Interview Kit ────────────────→ Shareable Kit View (interviewer sees questions)
```

---

## 6. State Management

### 6.1 Context Providers
```
<AuthProvider>                    → token, user, login, logout
  <NotificationProvider>          → unread count, notifications list
    <ChatProvider>                → sessions, messages, streaming, workflow
      <App />
    </ChatProvider>
  </NotificationProvider>
</AuthProvider>
```

### 6.2 Data Flow for Streaming
```
User types message
    │
    ▼
ChatContext.sendMessage()
    │
    ▼
api.streamMessage() ──→ SSE POST /api/chat/stream
    │
    ├── event: token    → append to current message content
    ├── event: jd_token → append to JD card (separate from chat)
    ├── event: card_text→ create new message bubble
    ├── event: metadata → update workflow state, session ID, title
    ├── event: done     → finalize message, stop streaming
    └── event: error    → show error in message
```

---

## 7. Responsive Design Strategy

| Breakpoint | Layout | Sidebar |
|------------|--------|---------|
| **Desktop** (>1200px) | Sidebar + main content | Full sidebar |
| **Tablet** (768–1200px) | Sidebar overlay + main | Collapsible sidebar |
| **Mobile** (<768px) | Full-width pages | Hidden sidebar, hamburger menu |

**Priority**: Desktop-first (B2B SaaS — desktop is primary usage). Mobile responsiveness as progressive enhancement.

**Public pages** (Career Page, Apply, Self-Schedule): Mobile-first design since candidates use phones.

---

## 8. Performance Considerations

- **Lazy loading**: Route-based code splitting with `React.lazy()` for all pages
- **Memoization**: `useCallback` and `useMemo` for expensive computations
- **Virtual scrolling**: For candidate lists > 100 items and talent pool
- **Debounced search**: Filters and search inputs debounced at 300ms
- **SSE efficiency**: Token buffering to avoid excessive re-renders (batch updates)
- **Image optimization**: Lazy load avatars and logos
- **Optimistic updates**: Scorecard submission, comment posting, status changes
- **Skeleton screens**: Loading states for all data-fetching pages
