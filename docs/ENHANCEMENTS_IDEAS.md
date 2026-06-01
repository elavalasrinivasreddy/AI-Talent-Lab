# AI Talent Lab — Enhancements & Future Ideas

This document serves as a living backlog for feature ideas, architectural modifications, and UX enhancements that are outside the scope of the immediate phase but have been agreed upon for future development.

## 1. Org Head "Hiring Pipeline Analytics" Dashboard

**Context:** 
Currently, the `org_head` role does not need to participate in the operational friction of individual hire request approvals (which are handled by `dept_admin` and `hr`). Showing them a list of pending hire requests creates notification fatigue. 

**Enhancement:**
- **Remove "Hire Requests" operational tab from `org_head` scope.** (Completed as a short-term cleanup).
- **Build an Analytics Dashboard for `org_head` (Phase 8).** Instead of an operational list, provide a high-level bird's-eye view of hiring velocity and health.
  
**Key Metrics to Implement:**
1. **Volume:** Number of hire requests being raised per department over time.
2. **Bottlenecks (Time-to-Action):** Average delay/time for Department Admins to approve requests, and average time for HR to pick them up.
3. **Rejection Insights:** Total requests rejected, paired with the top rejection reasons (e.g., budget constraints, poorly defined roles) to identify friction points.

*Implementation Note:* This will require new backend aggregation endpoints (time-series data, `GROUP BY` department queries) and frontend charting components in the `Analytics` or `Dashboard` view for the `org_head`.

## 2. Organization Profile: RAG Integration

**Context:**
Currently, the Organization tab stores "About Us", "Culture Keywords", and "Benefits" as plain text in the PostgreSQL database. When the LangGraph agents generate Job Descriptions, they inject this text naively.

**Enhancement:**
- Vectorize the Organization Profile into ChromaDB.
- Update the JD generation pipelines to use Retrieval-Augmented Generation (RAG). Instead of appending boilerplate, the AI should seamlessly weave the company's specific cultural nuances into the responsibilities and requirements of the JD.

## 3. Department-Level Profile Overrides

**Context:**
Currently, the entire organization shares a single set of culture keywords and benefits. In enterprise environments, departments (e.g., Engineering vs. Sales) have distinct micro-cultures and specific perks.

**Enhancement:**
- Update the `departments` database schema to allow defining localized "About Us" and "Benefits" texts.
- Implement hierarchical fallback logic: If a department lacks an override, inherit from the Organization Profile. Otherwise, use the localized data for sourcing and JD generation.
