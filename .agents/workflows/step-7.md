---
description: TASK PROMPT - Talent Pool
---

Read docs/08_talent_pool.md.
Build: auto-pool rules (trigger on reject/close/archive), bulk upload endpoint 
(extract text, parse, embed, dedup, return results), talent_pool router + service,
AI suggest (cosine similarity against position JD embedding).
Frontend: TalentPoolPage with bulk upload zone FIRST, AI suggestions panel,
candidate cards with tags.
Commit: "feat(step-7): talent pool, bulk upload, AI suggestions"