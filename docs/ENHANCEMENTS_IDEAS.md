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
