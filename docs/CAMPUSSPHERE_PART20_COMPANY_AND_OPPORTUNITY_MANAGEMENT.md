# CampusSphere AI — Part 20: Company & Opportunity Management

## 1. Corporate Master Directory

CampusSphere AI maintains a centralized master directory of authorized corporate partners (`Company.js`).

### 1.1 Company Profiles & Recruiter Data Protection
- Stores verified company codes, company legal names, industry classifications, official web domains, physical office locations, and institutional tier classifications (`tier_1`, `tier_2`, `dream`, `super_dream`, `mass_recruiter`).
- **Data Protection:** Confidential recruiter phone numbers and direct recruitment emails are restricted to authorized Placement Cell staff and are never exposed in public student endpoints.

---

## 2. Job & Internship Opportunity Management

The `PlacementOpportunity` model defines institutional career openings posted by corporate partners.

### 2.1 Supported Opportunity Types
- `full_time`: Permanent graduate employment.
- `internship`: Pre-final year summer or semester industrial internships.
- `apprenticeship`: Vocational industry apprenticeship roles.
- `graduate_trainee`: Structured rotation programs (e.g. GET / MT).

### 2.2 Configurable Academic & Skill Criteria
- **Eligible Branches:** Whitelist of allowed engineering / academic branches (e.g. `['CSE', 'IT', 'ECE']`).
- **Eligible Batches:** Targeted graduation passing-out years (e.g. `[2026]`).
- **Minimum CGPA:** Academic performance cutoff (e.g. `7.5`).
- **Maximum Backlogs:** Allowed active course failures (e.g. `0` for zero-backlog policies).
- **Compensation in Integer Paise:** Stores total CTC in integer paise (`compensationPaise: 160000000` = ₹16 Lakhs) to eliminate floating-point precision drift.

### 2.3 Publication & Draft Isolation
- Opportunities are created in `'draft'` state.
- Students cannot view or query draft opportunities via list endpoints or direct URL IDs (`HTTP 403 Forbidden`).
- Publishing an opportunity (`POST /api/placement/opportunities/:id/publish`) transitions it to `'published'`, records `publishedAt`, and triggers centralized notifications to all eligible registered students under `category: 'placement'`.
- Expired opportunities (`applicationDeadline < Date.now()`) are automatically blocked from accepting new submissions.

