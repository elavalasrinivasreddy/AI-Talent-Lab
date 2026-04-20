---
description: TASK PROMPT - Candidate Apply Chat
---

Read docs/07_apply.md and docs/12_chat_flows.md §Part 2 (candidate flow).
Build: magic link generation + delivery, candidate_sessions table, CandidateChat 
linear controller (agents/candidate_chat.py), apply router (public),
resume text extraction (pdfplumber + python-docx), resume parsing + embedding,
interview process overview email on completion.
Frontend: ApplyPage chat interface (mobile-first), all 8 steps per docs/07_apply.md.
Commit: "feat(step-5): candidate apply chat, resume extraction, magic links"