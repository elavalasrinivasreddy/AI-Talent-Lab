---
description: TASK PROMPT — Candidate Sourcing, ATS Scoring, Pipeline
---

Step 3 is complete. Begin Step 4: Candidate Sourcing, Scoring, and Pipeline.

Read: docs/04_position_detail.md, docs/05_candidate_detail.md, 
docs/BACKEND_PLAN.md §8 (background tasks), §15 (semantic ATS scoring).

Build:
1. CandidateSourceAdapter ABC + SimulationAdapter (realistic generated candidates)
2. db/repositories/candidates.py + applications.py + pipeline_events.py
3. tasks/candidate_pipeline.py Celery task (source → dedup → score → notify)
4. Semantic ATS scoring (embedding cosine similarity + LLM structured analysis)
   per docs/BACKEND_PLAN.md §15 exactly — two-step approach
5. Positions router + service (CRUD, search-now, status management)
6. Candidates router + service (list, detail, status update, bulk outreach, draft/send rejection, mark-selected)
7. Dashboard pipeline endpoint (GET /api/v1/dashboard/pipeline/:id for Kanban)
8. Frontend: PositionDetailPage with all 6 tabs (Pipeline, Candidates, JD, Interview Kit, Activity, Settings)
9. Frontend: PipelineTab Kanban board with stage-colored columns
10. Frontend: CandidatesTab list with bulk actions
11. Frontend: CandidateDetailPage with all 5 tabs
12. Frontend: SkillsMatchTab showing score arc, matched/missing/extra skills,
    trajectory analysis, red flags (docs/FRONTEND_PLAN.md §11.4 for ScoreCircle)
13. Frontend: TimelineTab — unified event feed from pipeline_events table

Done: position search triggers Celery task, candidates appear in pipeline,
ATS scores compute correctly, Kanban renders with correct stage colors.
Commit: "feat(step-4): candidate sourcing, semantic ATS, pipeline management"