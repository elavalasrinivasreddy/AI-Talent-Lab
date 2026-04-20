---
description: TASK PROMPT — Recruiter Chat + JD Generation
---

Step 2 is complete. Begin Step 3: Recruiter Chat and JD Generation.

Read ALL of these before writing any code:
- docs/02_chat.md           (full chat UI behavior, all 5 stages, error recovery)
- docs/12_chat_flows.md     (exact AI conversation scripts for each stage)
- docs/BACKEND_PLAN.md §6   (agent architecture, SSE format, LangGraph state)
- docs/BACKEND_PLAN.md §14  (agent error recovery — every node failure mode)

This is the core of the product. Take your time. The chat workflow must be exactly
right — stages, cards, error handling, session persistence.

== BACKEND ==

1. LLM factory (adapters/llm/factory.py)
   Implement get_llm() returning the correct LLM based on LLM_PROVIDER env var.
   Support: groq (ChatGroq), openai (ChatOpenAI), gemini (ChatGoogleGenerativeAI).
   Implement get_embedding_model() per docs/BACKEND_PLAN.md §15.
   Both functions read from config settings. No hardcoding.

2. Agent tools (agents/tools/)
   - search.py: Tavily search wrapper. Takes query string, returns structured results.
     Handles Tavily API errors gracefully — raise SearchError, caller handles skip.
   - role_extractor.py: Takes a free-text message, returns extracted job title.
     Uses LLM with a short prompt. Falls back to None if extraction fails.

3. Agent state (agents/state.py)
   Implement AgentState TypedDict exactly as documented in docs/BACKEND_PLAN.md §6.
   Include ALL fields: session_id, org_id, department_id, user_id, role_name,
   skills_required, internal_skills_found, internal_skills_accepted,
   market_skills_found, market_skills_accepted, jd_variants, selected_variant,
   final_jd, bias_issues, stage, messages, awaiting_user_input, error fields,
   skip tracking fields (internal_skipped, market_skipped, bias_skipped),
   retry_count, error_stage, error_code, error_message.

4. Agent prompts (agents/prompts/)
   Write system prompt files for each node based on docs/12_chat_flows.md:
   - interviewer.md: Intake agent. Extracts requirements via conversation.
     Ask max 2-3 questions per turn. Never dump all questions at once.
     Detect when minimum requirements are met (role, experience, skills, work type).
     Output a structured summary for user confirmation before proceeding.
   - internal_analyst.md: Given past JD embeddings from ChromaDB, identify
     skills used in similar past roles that aren't in current requirements.
   - market_intelligence.md: Given competitors and a web search tool,
     find what skills top companies emphasize for this role.
   - benchmarking.md: Compare market findings against current requirements,
     rank and filter suggestions by relevance.
   - drafting.md: Generate 3 JD style variants (skill_focused, outcome_focused,
     hybrid) then generate the final selected JD. Include About Us from org settings.
   - bias_checker.md: Scan JD text for potentially exclusionary language.
     Return specific phrases and suggested replacements. Be concise.

5. Individual agent nodes (agents/nodes/)
   Implement each node as a pure async function: state_in → state_out.
   
   - interviewer.py: intake conversation logic. Detect completion.
     Save state checkpoint after completion.
   
   - internal_analyst.py: Query ChromaDB vector_store for similar past JDs.
     Extract skills not in current requirements. Return as internal_skills_found.
     SOFT SKIP: on any ChromaDB error, set internal_skipped=True, return state unchanged.
     Save state checkpoint on success.
   
   - market_intelligence.py + benchmarking.py: Use Tavily search tool.
     SOFT SKIP: on any Tavily error or no competitors, set market_skipped=True.
     Save state checkpoint on success.
   
   - drafting.py: Two modes — generate_variants and generate_final.
     HARD STOP: retry once on failure. On second failure raise LLM_ERROR.
     Pull org About Us + culture + benefits from org settings (org_id in state).
     For generate_final: Stream tokens via the streaming callback.
     Save state checkpoint after variants, after final JD.

6. Streaming (agents/streaming.py)
   SSE event generator. Formats all events exactly as in docs/BACKEND_PLAN.md §6:
   token, stage_change, card_internal, card_market, card_variants, card_bias,
   jd_token, metadata, done, error, stage_skipped, stream_interrupted.
   
   Handles async generator pattern for FastAPI StreamingResponse.

7. Bias checker (agents/bias_checker.py)
   Standalone async function, not a LangGraph node.
   Takes JD text string, returns list of {phrase, suggestion} dicts.
   SOFT SKIP: on any error, return empty list silently.

8. LangGraph orchestrator (agents/orchestrator.py)
   Build the full LangGraph state machine:
   INTAKE → INTERNAL_CHECK → MARKET_RESEARCH → JD_VARIANTS → FINAL_JD → BIAS_CHECK → COMPLETE
   
   Implement state routing (conditional edges based on stage and user input).
   Implement the "human in the loop" pause points — the graph pauses after
   INTERNAL_CHECK card and MARKET_RESEARCH card waiting for user acceptance/skip.
   
   Error recovery per docs/BACKEND_PLAN.md §14:
   - Soft skip nodes (internal, market, bias) must catch all exceptions and skip
   - Hard stop nodes (variants, final_jd) retry once, then surface error SSE event
   
   State persistence: call save_state_checkpoint after every node completion.

9. ChromaDB vector store (db/vector_store.py)
   Implement:
   - init_chroma(): initialize persistent ChromaDB client (data/chroma/)
   - embed_jd(position_id, jd_text, role_name, department): embed and store JD
   - search_similar(query_text, org_id, department_id, top_k=5): 
     find similar past JDs within same org/dept
   - delete_jd(position_id): remove JD from index (on position delete)

10. Chat sessions repository (db/repositories/sessions.py)
    Implement ChatSessionRepository:
    - create(org_id, dept_id, user_id, title) → session
    - get(session_id, user_id) → session with graph_state
    - update_state(session_id, stage, graph_state) → checkpoint save
    - update_title(session_id, title)
    - link_position(session_id, position_id)
    - list_by_user(user_id, org_id) → list for sidebar
    - delete(session_id, user_id)

11. Chat router + service (routers/chat.py + services/chat_service.py)
    Implement all chat endpoints from docs/BACKEND_PLAN.md §5:
    POST /api/v1/chat/stream          — SSE streaming endpoint
    GET  /api/v1/chat/sessions        — sidebar list
    GET  /api/v1/chat/sessions/{id}   — full session restore
    DELETE /api/v1/chat/sessions/{id}
    PATCH /api/v1/chat/sessions/{id}/title
    POST /api/v1/chat/sessions/{id}/upload    — reference JD upload
    POST /api/v1/chat/sessions/{id}/save-position — saves position, triggers search
    
    The /stream endpoint:
    - Creates session if first message (no session_id in request)
    - Restores graph state if continuing existing session
    - Runs orchestrator, yields SSE events
    - On save-position: creates position record, generates JD embedding (async),
      embeds JD in ChromaDB, queues Celery task for candidate search

== FRONTEND ==

12. Chat context (context/ChatContext.jsx)
    Implement ChatContext with: sessions list, current session, messages,
    isStreaming, workflowStage, sendMessage(), loadSession(), deleteSession().
    SSE connection management: connect on message send, disconnect on done/error.
    Parse all event types from docs/BACKEND_PLAN.md §6 SSE format.

13. Chat page skeleton (components/Chat/ChatPage.jsx)
    Full-height layout: topbar + message list + input.
    Load existing session on mount if sessionId in URL param.
    
14. Chat top bar (components/Chat/ChatTopBar.jsx)
    Editable title (contenteditable). Stage indicator pill with correct 
    color per stage. "Discard" button (unsaved sessions only).
    "Save & Find Candidates" button — disabled until stage === 'complete'.

15. Message list + bubbles (components/Chat/MessageList.jsx + MessageBubble.jsx)
    User messages: right-aligned, accent color.
    AI messages: left-aligned, secondary bg, markdown rendered.
    System messages: centered, muted text, smaller font.
    Typing indicator: 3-dot pulsing animation BEFORE first token arrives.
    (see docs/FRONTEND_PLAN.md §11.1 for exact implementation)
    Auto-scroll to bottom on new messages.

16. Streaming text (components/Chat/StreamedText.jsx)
    Renders streaming tokens with blinking cursor while streaming.
    Cursor disappears on done event.

17. Message input (components/Chat/MessageInput.jsx)
    Textarea: auto-resize to 5 lines, Enter=send, Shift+Enter=newline.
    Disabled state during streaming with "AI is thinking..." placeholder.
    File upload button (📎): PDF/DOCX only, max 10MB.
    Send button: spinner during streaming.

18. Chat cards (components/Chat/cards/)
    Implement all 5 interactive stage cards exactly per docs/02_chat.md:
    
    InternalCheckCard.jsx: selectable skill chips with source year labels.
    "Accept Selected (N)" button updates count as chips are toggled.
    After action: collapses to read-only summary line.
    
    MarketResearchCard.jsx: same pattern, shows competitor names.
    
    JDVariantsCard.jsx: 3 side-by-side cards. Color-coded header per variant
    (blue=skill-focused, green=outcome-focused, purple=hybrid). 
    Preview expand button. Edit button (textarea). Select This → button.
    
    FinalJDCard.jsx: streams JD markdown with StreamedText.
    Edit/Copy/Download buttons. "Save & Find Candidates" CTA button.
    
    BiasCheckCard.jsx: warning-colored border. Per-phrase Fix buttons.
    Dismiss button. Never blocks saving.

19. Position Setup Modal (components/Chat/PositionSetupModal.jsx)
    Opens when "Save & Find Candidates" clicked.
    Fields: openings count, search frequency, ATS threshold, priority, department.
    Calls POST /api/v1/chat/sessions/{id}/save-position on confirm.
    On success: navigate to /positions/:id with success toast.

20. Sidebar sessions list (components/Sidebar/SidebarSessions.jsx)
    List of chat sessions from GET /api/v1/chat/sessions.
    Solid dot = position saved. Gray dot = incomplete.
    Active session highlighted.
    Right-click or hover shows Rename/Delete options.

== DONE CRITERIA ==

[ ] POST /api/v1/chat/stream returns SSE events for all 5 stages
[ ] stage_change events fire correctly as workflow progresses
[ ] card_internal event fires with skills from ChromaDB (or skips if empty)
[ ] card_market event fires with competitor skills (or skips if Tavily fails)
[ ] card_variants event fires with 3 variant objects
[ ] jd_token events stream the final JD
[ ] card_bias event fires after final JD (or silently skipped)
[ ] Session state is saved to DB after each stage completion
[ ] Browser refresh on mid-chat session correctly restores state
[ ] POST /api/v1/chat/sessions/{id}/save-position creates position record
[ ] JD embedding stored in positions.jd_embedding on save
[ ] Reference JD upload extracts text and feeds into intake stage
[ ] Frontend: Chat opens with greeting message
[ ] Frontend: Typing indicator shows before first AI token
[ ] Frontend: All 5 stage cards render and are interactive
[ ] Frontend: Stage pill updates as workflow progresses
[ ] Frontend: Position setup modal opens and submits correctly
[ ] Frontend: Navigates to /positions/:id after save
[ ] Error recovery: Tavily failure silently skips market research
[ ] Error recovery: LLM failure on variants shows retry button
[ ] Tests passing: pytest tests/test_chat.py -v

Commit message: "feat(step-3): recruiter chat, LangGraph JD generation, all 5 stages"