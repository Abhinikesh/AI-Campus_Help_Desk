# CampusSphere AI — Part 14: Examination Security Review

## 1. Executive Summary

This document reviews the security architecture, authorization controls, data boundaries, and threat mitigation measures implemented in **CampusSphere AI — Part 14: Examination Management, Marks Entry & Result Publication**.

---

## 2. Threat Modeling & Mitigation Matrix

| Threat Category | Potential Attack Vector | Implemented Mitigation | Verification Status |
| :--- | :--- | :--- | :---: |
| **Insecure Direct Object Reference (IDOR)** | Student queries unpublished marks or marks of other students by guessing Mark ObjectId. | Student controller scopes mark queries to `req.user._id` and filters strictly by `status: 'published'`. | Verified |
| **Privilege Escalation** | Student attempts to create or cancel an exam via `POST /api/exams`. | `requireRole(['faculty', 'admin'])` middleware rejects unauthorized attempts with HTTP 403. | Verified |
| **Cross-Subject Tampering** | Faculty member schedules exams or enters marks for a subject taught by another instructor. | Controller verifies assigned faculty mapping (`subject.faculty === req.user._id` or `exam.faculty === req.user._id`). | Verified |
| **Self-Approval / Conflict of Interest** | Faculty member enters inflated marks and immediately approves them. | Anti-self-approval rule prevents creators from approving their own marks unless role is `admin`. | Verified |
| **Silent Mark Tampering** | Post-publication grade alteration without accountability. | In-place modifications locked; updates require mandatory reason and write to `correctionHistory`. | Verified |
| **Cross-Cohort Information Leakage** | Students viewing examination timetables or room allocations of other academic departments. | Exam schedules strictly filtered by student's enrolled department, semester, and section. | Verified |
| **Denial of Service / Scheduling Conflicts** | Duplicate room bookings or double-booking student cohorts at the same time slot. | Compound indexes and conflict checking middleware validate time windows and room allocations. | Verified |

---

## 3. Role-Based Access Control (RBAC) Matrix

| Endpoint | Student | Faculty (Assigned) | Faculty (Other) | Admin |
| :--- | :---: | :---: | :---: | :---: |
| `POST /api/exams` | ❌ 403 | ✅ Allowed | ❌ 403 | ✅ Allowed |
| `GET /api/exams/faculty` | ❌ 403 | ✅ Allowed | ❌ Filtered | ✅ Allowed (All) |
| `GET /api/exams/:id` | ✅ Filtered | ✅ Allowed | ✅ View Only | ✅ Allowed |
| `PUT /api/exams/:id` | ❌ 403 | ✅ (Before Eval) | ❌ 403 | ✅ Allowed |
| `DELETE /api/exams/:id` | ❌ 403 | ✅ (Before Eval) | ❌ 403 | ✅ Allowed |
| `GET /api/exams/:id/roster` | ❌ 403 | ✅ Allowed | ❌ 403 | ✅ Allowed |
| `POST /api/exams/:id/marks/draft` | ❌ 403 | ✅ Allowed | ❌ 403 | ✅ Allowed |
| `POST /api/exams/:id/marks/submit` | ❌ 403 | ✅ Allowed | ❌ 403 | ✅ Allowed |
| `POST /api/exams/:id/marks/approve` | ❌ 403 | ❌ Anti-Self | ✅ Reviewer | ✅ Allowed |
| `POST /api/exams/:id/publish` | ❌ 403 | ✅ Allowed | ❌ 403 | ✅ Allowed |
| `POST .../request-correction` | ❌ 403 | ✅ Allowed | ❌ 403 | ✅ Allowed |
| `POST .../correct` | ❌ 403 | ❌ 403 | ❌ 403 | ✅ Allowed |
| `GET /api/exams/student/schedule` | ✅ Enrolled Only | ❌ 403 | ❌ 403 | ✅ Allowed |
| `GET /api/exams/student/results` | ✅ Published Only | ❌ 403 | ❌ 403 | ✅ Allowed |
| `GET /api/exams/admin/overview` | ❌ 403 | ❌ 403 | ❌ 403 | ✅ Allowed |

---

## 4. Input Sanitization & Boundary Validation

1. **Numeric Range Enforcement:**
   - Marks Obtained: $0 \le \text{marksObtained} \le \text{maximumMarks}$.
   - Passing Marks: $0 \le \text{passingMarks} \le \text{maximumMarks}$.
   - Duration: $15 \le \text{durationMinutes} \le 360$.
2. **Date & Time Boundaries:**
   - Date formats validated against ISO 8601 strings.
   - Start time and end time strings validated against 24-hour `HH:mm` format.
3. **Mandatory Audit Reason Strings:**
   - Minimum length: 5 characters.
   - Trimming prevents whitespace-only bypasses.

