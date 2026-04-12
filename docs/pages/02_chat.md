# Page Design: Chat Window (JD Generation)

> The core product experience — a conversational AI interface where recruiters generate JDs through natural conversation.

---

## 1. Overview

| Aspect | Detail |
|--------|--------|
| Route | `/chat` (new) · `/chat/:sessionId` (existing) |
| Auth | Required (JWT) |
| Layout | Sidebar + Chat area (full width) |
| Key Components | ChatTopBar, MessageList, MessageBubble, MessageInput, AgentRecommendations, JDOverviewCards, JDFullView, CandidatesPanel |

---

## 2. Page Layout

```
┌──────┬──────────────────────────────────────────────────────┐
│      │  Chat Top Bar                                        │
│      │  ┌──────────────────────────────────────────────────┐│
│      │  │ 🧪 Senior Python Developer  ·  Stage: Intake    ││
│      │  └──────────────────────────────────────────────────┘│
│ S    │                                                      │
│ I    │  Message Area (scrollable)                           │
│ D    │  ┌──────────────────────────────────────────────────┐│
│ E    │  │                                                  ││
│ B    │  │  🤖 Great! Let's start. What role are you        ││
│ A    │  │     hiring for?                                  ││
│ R    │  │                                                  ││
│      │  │                    Senior Python Developer 👤    ││
│      │  │                                                  ││
│      │  │  🤖 Excellent! A few questions:                  ││
│      │  │     • Experience range?                          ││
│      │  │     • Must-have skills?                          ││
│      │  │                                                  ││
│      │  │  ┌── Agent Card ──────────────────────────────┐  ││
│      │  │  │  📊 Internal Skills Check                  │  ││
│      │  │  │  Found 3 skills from past hires:           │  ││
│      │  │  │  [✅ Redis] [✅ Docker] [☐ MongoDB]        │  ││
│      │  │  │  [Accept Selected] [Skip]                  │  ││
│      │  │  └────────────────────────────────────────────┘  ││
│      │  │                                                  ││
│      │  │  ┌── JD Card ────────────────────────────────┐   ││
│      │  │  │  📄 Your Job Description                  │   ││
│      │  │  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │   ││
│      │  │  │  # Senior Python Developer                │   ││
│      │  │  │  ## About Us                              │   ││
│      │  │  │  ...rendered markdown...                   │   ││
│      │  │  │                                           │   ││
│      │  │  │  [✏️ Edit] [📋 Copy] [📥 Download]        │   ││
│      │  │  │  [💾 Save & Open Position]                │   ││
│      │  │  └───────────────────────────────────────────┘   ││
│      │  │                                                  ││
│      │  └──────────────────────────────────────────────────┘│
│      │                                                      │
│      │  Message Input                                       │
│      │  ┌──────────────────────────────────────────────────┐│
│      │  │ 📎 Type your message...                    [➤]  ││
│      │  └──────────────────────────────────────────────────┘│
└──────┴──────────────────────────────────────────────────────┘
```

---

## 3. Workflow Stages (In-Chat)

### Stage 1: Intake
- AI asks 1-2 questions per turn
- User can type or upload a reference JD
- File upload: PDF/DOCX → extracted text fed to agent
- Auto-completes when 4 minimum requirements gathered + user confirms
- **Trigger**: `[INTAKE_COMPLETE]` signal in agent response

### Stage 2: Internal Review Card
Appears as an interactive card within the chat:
```
┌── 📊 Internal Skills Analysis ─────────────────────────┐
│                                                        │
│  Based on your past hires for similar roles, we found  │
│  these additional skills that could strengthen the JD:  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ ✅ Redis  ─ Used in 2024 Sr Python Developer     │  │
│  │ ✅ Docker ─ Standard in 2025 Backend Developer   │  │
│  │ ☐  MongoDB ─ Used in 2024 Full Stack Developer   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  Summary: 3 skills from past hires not in current req  │
│                                                        │
│  [Accept Selected (2)]  [Accept All]  [Skip →]         │
└────────────────────────────────────────────────────────┘
```
- Skills are toggleable checkboxes (pre-selected by default)
- Each skill shows source (which past JD it came from)
- "Accept Selected" sends accepted skills to agent
- "Skip" moves forward without adding skills
- Card becomes **read-only** after selection (shows what was chosen)

### Stage 3: Market Review Card
```
┌── 🌐 Market Benchmarking ──────────────────────────────┐
│                                                        │
│  Competitor Analysis:                                  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 🏢 Google — uses GraphQL, gRPC                  │  │
│  │ 🏢 Flipkart — emphasizes Kafka, Microservices   │  │
│  │ 🏢 Razorpay — requires K8s, Terraform           │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  Recommended Skills (not in your current list):        │
│  ✅ GraphQL  ✅ Kafka  ☐ gRPC  ☐ Terraform            │
│                                                        │
│  [Accept Selected (2)]  [Accept All]  [Skip →]         │
└────────────────────────────────────────────────────────┘
```
- Shows competitor names and what they look for
- Differential skills (not already in baseline) shown as chips
- Same accept/skip pattern as internal review

### Stage 4: JD Variant Selection
```
┌── 📋 Choose a JD Style ────────────────────────────────┐
│                                                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │ 🎯 Skill-    │ │ 🏆 Outcome-  │ │ ⚡ Hybrid     │  │
│  │   Focused     │ │   Focused     │ │   Balanced    │  │
│  │              │ │              │ │              │  │
│  │ Emphasizes   │ │ Emphasizes   │ │ Balanced mix │  │
│  │ technical    │ │ impact and   │ │ of skills +  │  │
│  │ skills and   │ │ results the  │ │ outcomes +   │  │
│  │ qualifications│ │ candidate    │ │ growth       │  │
│  │              │ │ will deliver │ │ opportunities│  │
│  │              │ │              │ │              │  │
│  │ Skills: 12   │ │ Skills: 8    │ │ Skills: 10   │  │
│  │ Tone: Formal │ │ Tone: Engaging│ │ Tone: Modern │  │
│  │              │ │              │ │              │  │
│  │ [Select]     │ │ [Select]     │ │ [Select]     │  │
│  └──────────────┘ └──────────────┘ └──────────────┘  │
└────────────────────────────────────────────────────────┘
```
- 3 horizontally stacked cards
- Each shows: title, description, key differentiator, skill count, tone
- Click "Select" → triggers full JD generation
- Only one can be selected (radio-like behavior)

### Stage 5: Final JD
- Rendered as a large card with full markdown JD
- Streams token-by-token with typing animation
- After streaming completes:
  - **Edit button**: Switch JD content to textarea for manual edits
  - **Copy button**: Copy raw markdown to clipboard
  - **Download**: PDF or Markdown download
  - **Save & Open Position**: Primary CTA — saves position and starts pipeline

---

## 4. Chat Top Bar

```
┌──────────────────────────────────────────────────────────┐
│  🧪 Senior Python Developer     ·     ● intake          │
│                                                          │
│  Title animation on first set │ Stage pill (color-coded) │
└──────────────────────────────────────────────────────────┘
```

- **Title**: Animated typewriter effect when first set, then static
- **Stage indicator**: Color-coded pill showing current workflow stage
  - intake → blue, internal_review → purple, market_review → cyan, jd_variants → amber, done → green
- **No actions** in top bar (keep it clean)

---

## 5. Message Input

```
┌──────────────────────────────────────────────────────────┐
│  📎 │  Type your message...                       │ [➤] │
└──────────────────────────────────────────────────────────┘
```

- **Paperclip icon**: Opens file upload dialog (PDF/DOCX only)
- **Text area**: Auto-resizes up to 4 lines, then scrolls
- **Send button**: Disabled when empty or during streaming
- **Enter to send**: Shift+Enter for new line
- **Disabled state**: Input disabled when streaming, shows "AI is thinking..."
- **Post-JD state**: Input disabled after position is saved, shows "Position saved. Go to dashboard to manage."

---

## 6. Message Bubble Design

### User Message
```
                                    ┌──────────────────┐
                                    │ We need 5+ years │
                                    │ of Python exp.   │
                                    └──────────────────┘
```
- Right-aligned
- Background: `var(--accent-primary)` with white text
- Rounded corners (more rounded on right side)
- Max-width: 70%

### Assistant Message
```
┌──────────────────────────────────────┐
│ 🤖 Great! Here's what I've gathered │
│    so far. A few more questions...   │
└──────────────────────────────────────┘
```
- Left-aligned
- Background: `var(--bg-secondary)`
- Rounded corners (more rounded on left side)
- Supports markdown rendering (for structured responses)
- **Streaming animation**: Characters appear progressively with a blinking cursor

---

## 7. Backend Integration

| Action | API Call | Notes |
|--------|----------|-------|
| Send message (streaming) | `POST /api/chat/stream` (SSE) | Handles all 5 stages |
| Send message (legacy) | `POST /api/chat/message` | Fallback, non-streaming |
| Load session | `GET /api/chat/sessions/:id` | Restores messages + workflow state |
| List sessions | `GET /api/chat/sessions` | For sidebar history |
| Delete session | `DELETE /api/chat/sessions/:id` | Remove from sidebar |
| Rename session | `PATCH /api/chat/sessions/:id/title` | Sidebar rename |
| Save JD | `PUT /api/chat/sessions/:id/jd` | Manual JD save |
| Upload file | `POST /api/chat/sessions/:id/upload` | Reference JD upload |
| Save & Open Position | `POST /api/positions` (from JD data) | Creates position, triggers pipeline |

---

## 8. Edge Cases

| Scenario | Behavior |
|----------|----------|
| Browser refresh mid-chat | Session persisted server-side; reload restores from session store |
| SSE connection drops | Show reconnection banner; user can resend last message |
| LLM timeout (>60s) | Show timeout error; "Try again" button on failed message |
| Empty chat history | Show welcome message: "Hi! I'm your AI hiring assistant. What role are you looking to fill?" |
| Multiple tabs | Each tab uses the same session; last write wins |
| Very long JD (>5000 words) | JD card has max-height with scroll; "Expand" button for full view |
