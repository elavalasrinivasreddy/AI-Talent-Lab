# Frontend — AI Talent Lab

React + Vite frontend for the AI-powered JD automation platform.

## Tech Stack

- **React 19** with Vite dev server
- **Vanilla CSS** with CSS custom properties (design tokens)
- **React Markdown** for rendered JD display
- **Dark/Light mode** via body class toggle

## Key Components

| Component | Purpose |
|-----------|---------|
| `ChatContext.jsx` | Global state management — messages, sessions, workflow stage |
| `MessageList.jsx` | Chat stream — renders all messages + inline agent cards |
| `MessageBubble.jsx` | Individual message — user/bot bubbles with markdown |
| `AgentRecommendations.jsx` | Skill-chip selection cards (Internal + Market) |
| `JDOverviewCards.jsx` | 3 JD variant selection cards |
| `JDFullView.jsx` | Rendered markdown JD with Edit/Download (MD + PDF) |
| `Sidebar.jsx` | Session history, new chat, dark/light toggle |

## Design System

All styling uses CSS custom properties in `index.css`:
- Design system v3 with warm charcoal dark + clean slate light
- Indigo-blue accent (`#6366f1`) + violet secondary (`#8b5cf6`)
- Glassmorphism, micro-animations, and skill-chip interactions

## Running

```bash
npm install
npm run dev
# Opens on http://localhost:5173
```

## Environment

The frontend reads backend URL from Vite env:
```
VITE_API_BASE=http://localhost:8000
VITE_USER_NAME=Elavala
```
