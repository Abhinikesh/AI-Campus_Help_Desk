# CampusSphere AI — Part 20: REST API Reference

All Placement endpoints are mounted under `/api/placement` and require Bearer JWT authentication.

---

## 1. Student Placement Profile & Resumes

### `GET /api/placement/profile/my`
- **Access:** Student
- **Description:** Retrieves student placement preferences, skills, and authoritative academic CGPA snapshot.

### `PUT /api/placement/profile/my`
- **Access:** Student
- **Description:** Updates technical skills, career interests, projects, and recalculates profile completion score.

### `POST /api/placement/profile/resume`
- **Access:** Student (`multipart/form-data`)
- **Description:** Uploads a PDF or DOCX resume document.

### `GET /api/placement/resumes/:filename`
- **Access:** Authenticated (Anti-IDOR protected)
- **Description:** Streams download of candidate resume document.

---

## 2. Company Master Directory

### `GET /api/placement/companies`
- **Access:** Authenticated
- **Query Params:** `status`, `industry`, `search`, `page`, `limit`
- **Description:** Lists partner companies and corporate recruiters.

### `POST /api/placement/companies`
- **Access:** Admin, Placement Officer
- **Description:** Registers a new enterprise partner in the directory.

### `GET /api/placement/companies/:id`
- **Access:** Authenticated
- **Description:** Retrieves full company details and associated drives.

### `PUT /api/placement/companies/:id`
- **Access:** Admin, Placement Officer
- **Description:** Updates company profile, recruitment tier, or active status.

---

## 3. Career Opportunities & Eligibility

### `GET /api/placement/opportunities`
- **Access:** Authenticated (Students only receive `published` opportunities)
- **Query Params:** `type`, `search`, `status`
- **Description:** Lists job vacancies and internship openings.

### `POST /api/placement/opportunities`
- **Access:** Admin, Placement Officer
- **Description:** Creates an opportunity draft with academic criteria and compensation in integer paise.

### `GET /api/placement/opportunities/:id`
- **Access:** Authenticated
- **Description:** Retrieves opportunity details. For students, runs real-time server-side eligibility check.

### `PUT /api/placement/opportunities/:id`
- **Access:** Admin, Placement Officer
- **Description:** Updates opportunity details and logs change history.

### `POST /api/placement/opportunities/:id/publish`
- **Access:** Admin, Placement Officer
- **Description:** Transitions opportunity to published and broadcasts notification to eligible students.

---

## 4. Recruitment Drives & Selection Rounds

### `GET /api/placement/drives`
- **Access:** Authenticated
- **Description:** Lists scheduled campus recruitment drives.

### `POST /api/placement/drives`
- **Access:** Admin, Placement Officer
- **Description:** Schedules a recruitment drive and syncs with Academic Calendar.

### `GET /api/placement/drives/:id`
- **Access:** Authenticated
- **Description:** Retrieves drive details, assigned coordinators, and selection stages.

### `POST /api/placement/stages`
- **Access:** Admin, Placement Officer, Assigned Coordinator
- **Description:** Adds an ordered selection stage to a drive.

### `POST /api/placement/stages/result`
- **Access:** Admin, Placement Officer, Assigned Coordinator
- **Description:** Records candidate outcome for an interview round.

### `PATCH /api/placement/stages/results/:id/correct`
- **Access:** Admin, Placement Officer, Assigned Coordinator
- **Description:** Corrects a previously entered outcome with mandatory audit reason.

---

## 5. Candidate Applications & Offers

### `POST /api/placement/applications`
- **Access:** Student
- **Description:** Submits application for a published opportunity with server eligibility validation.

### `GET /api/placement/applications/my`
- **Access:** Student
- **Description:** Lists submitted applications and current status.

### `GET /api/placement/applications`
- **Access:** Admin, Placement Officer, Assigned Coordinator
- **Description:** Lists applications scoped by drive or status.

### `POST /api/placement/applications/:id/withdraw`
- **Access:** Student (Self), Admin
- **Description:** Withdraws application before selection.

### `PATCH /api/placement/applications/:id/status`
- **Access:** Admin, Placement Officer, Assigned Coordinator
- **Description:** Advances application status (`shortlisted`, `rejected`, etc.).

### `POST /api/placement/offers`
- **Access:** Admin, Placement Officer
- **Description:** Issues corporate employment offer with integer paise compensation.

### `PATCH /api/placement/offers/:id/respond`
- **Access:** Student
- **Description:** Accepts or declines an issued offer.

### `POST /api/placement/offers/:id/verify`
- **Access:** Admin, Placement Officer
- **Description:** Officially verifies institutional placement.

---

## 6. Analytics & CSV Exports

### `GET /api/placement/metrics`
- **Access:** Admin, Placement Officer, Placement Coordinator
- **Description:** Direct database placement KPIs and verified placement rate.

### `GET /api/placement/export`
- **Access:** Admin, Placement Officer, Placement Coordinator
- **Query Params:** `type` (`applications` | `offers` | `companies`)
- **Description:** Downloads RFC-4180 CSV export with CWE-1236 formula sanitization.
