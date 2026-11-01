# CampusSphere AI — Part 13: Assignment Management Architecture

## 1. System Overview

The **Assignment Management, Student Submissions & Faculty Evaluation System** provides a secure, role-governed, real-world academic workflow integrated into the CampusSphere AI ERP.

### Key Architectural Pillars
- **Role-Based Scoping & Academic Ownership:** Faculty members can only author and manage assignments for courses they are actively assigned to teach. Students can only view published assignments mapped to their enrolled department, semester, and section.
- **Auditable Submission Lifecycle:** When students submit or resubmit coursework, prior submissions are preserved in an immutable `previousVersions` history array, guaranteeing an audit trail of academic progress.
- **Evaluation Privacy Isolation:** Grading occurs as an unpublished evaluation until faculty explicitly reviews and publishes marks and qualitative feedback. Students cannot view preliminary or draft scores.
- **Storage Isolation & Defense-in-Depth:** Course attachments and student submission files are stored on disk in segregated directories outside the web server root with randomized filenames. Download access is gated behind authorization checks and path traversal validators (`verifySafePath`).
- **Real-Time Notifications:** Integrated with Part 12's `notificationService` to alert students upon grading publication and notify faculty when new submissions arrive.

---

## 2. Component Interaction Architecture

```
[ React 19 Frontend ]
   ├── FacultyAssignments (Creation modal, Submissions list, Grading drawer)
   └── StudentAssignments (Coursework list, Multi-file upload, Version tracker, Score card)
             │
             ▼ REST (JSON + multipart/form-data)
[ Express API Gateway (server.js) ]
   ├── /api/assignments
   └── /api/submissions
             │
   ┌─────────┴─────────┐
   ▼                   ▼
[ authMiddleware ]  [ roleMiddleware (allowRoles) ]
   │
   ▼
[ assignment.controller.js ]
   ├── Academic Ownership Verification
   ├── Deadline & Late Policy Rules Engine
   ├── Versioning & Idempotent Upsert
   └── File Download Gating
         │                     │
         ├─────────────────────┼────────────────────┐
         ▼                     ▼                    ▼
   [ MongoDB ]         [ Local Disk FS ]     [ notificationService ]
   - Assignment         - /uploads/attachments- SSE stream dispatch
   - Submission         - /uploads/submissions- Opt-out aware delivery
```

---

## 3. Security Boundaries & Authorization Matrix

| Action | Student | Assigned Faculty | Cross Faculty | Administrator |
| :--- | :---: | :---: | :---: | :---: |
| **Create Assignment** | ❌ 403 | ✅ Permitted | ❌ 403 | ✅ Permitted |
| **View Draft Assignment** | ❌ Hidden | ✅ Permitted | ❌ 403 | ✅ Permitted |
| **View Published Assignment**| ✅ (If Enrolled) | ✅ Permitted | ❌ 403 | ✅ Permitted |
| **Submit Coursework** | ✅ (If Enrolled) | ❌ 403 | ❌ 403 | ❌ 403 |
| **Evaluate Submission** | ❌ 403 | ✅ Permitted | ❌ 403 | ✅ Permitted |
| **Publish Evaluation Result**| ❌ 403 | ✅ Permitted | ❌ 403 | ✅ Permitted |
| **Download Submission File** | ✅ (Own Only) | ✅ Permitted | ❌ 403 | ✅ Permitted |
| **Download Reference Material**| ✅ (If Enrolled) | ✅ Permitted | ❌ 403 | ✅ Permitted |
| **Admin Analytics Overview**| ❌ 403 | ❌ 403 | ❌ 403 | ✅ Permitted |

---

## 4. Timezone & Locale Handling
All timestamps (`dueDate`, `submittedAt`, `evaluatedAt`, `resultPublishedAt`) are captured and stored in MongoDB in UTC ISO 8601 format. Client and reporting views standardize presentation in **Indian Standard Time (IST, Asia/Kolkata, UTC+5:30)**.

