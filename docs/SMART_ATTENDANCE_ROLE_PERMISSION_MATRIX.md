# Smart Attendance Role-Permission Matrix (RBAC)

**System Name:** CampusSphere AI Smart Attendance Module  
**Audit Date:** November 1, 2026  
**Auditor:** Senior Software Architect & Technical Auditor  
**Enforcement Mechanism:** Server-side JWT claims verified via `auth.middleware.js` and `role.middleware.js` (`allowRoles(...)`).

---

## 1. Matrix of Roles and Permissions

| Functional Capability | Student (`student`) | Faculty (`faculty`) | Admin (`admin`) | Technical Enforcement & Route |
|---|---|---|---|---|
| **View Personal Attendance Overview** | **Allowed** | Denied | Allowed (Audit View) | `GET /api/student/attendance`, `GET /api/attendance/student/overview` (`allowRoles('student')`) |
| **View Personal Attendance History** | **Allowed** | Denied | Allowed | `GET /api/student/attendance/history` (`allowRoles('student')`) |
| **View Other Students' Attendance** | **Denied** (403 Forbidden) | Allowed (Only enrolled students in assigned courses) | **Allowed** (Institution-wide) | Handled by student ID query isolation in `attendance.controller.js` |
| **Mark Own Attendance (Face)** | **Allowed** (Self only, 1:1) | Denied | Denied | `POST /api/student/:sessionId/attendance` (`allowRoles('student')`) |
| **Mark Another Student's Attendance** | **Denied** (Enforced by server session token) | Denied | Denied | System verifies `req.user.userId == student.user` |
| **Create Attendance Session** | Denied | **Allowed** (For assigned subjects) | **Allowed** (Any subject) | `POST /api/attendance/sessions` (`allowRoles('faculty', 'admin')`) |
| **Start / Pause / Close Session** | Denied | **Allowed** (Owner faculty) | **Allowed** | `POST /api/attendance/sessions/:id/start`, `end`, `cancel` |
| **Finalize Session** | Denied | **Allowed** (Owner faculty) | **Allowed** | `POST /api/attendance/sessions/:id/finalize` |
| **Generate / View Rotating QR Code** | Denied (Scanner only) | **Allowed** (Session owner) | **Allowed** | `GET /api/attendance/sessions/:id/qr-challenge` |
| **View Live Class Roster** | Denied | **Allowed** (Assigned session) | **Allowed** | `GET /api/attendance/faculty/sessions/:id/students` |
| **Manual Override Attendance Status** | Denied | **Allowed** (With mandatory reason note) | **Allowed** | `PATCH /api/attendance/faculty/records/:id` (`allowRoles('faculty', 'admin')`) |
| **Manage Own Biometric Consent** | **Allowed** (Grant/Revoke) | Denied | Denied | `POST /api/student/face/enroll`, `POST /api/student/face/revoke` |
| **Purge Student Biometric Profile** | **Allowed** (Own profile) | Denied | **Allowed** (Administrative erasure) | `DELETE /api/admin/attendance/face-profiles/:studentId` |
| **View Decrypted Biometric Vectors** | **Denied** (Never exposed) | **Denied** (Never exposed) | **Denied** (Never exposed) | Mongoose `{ select: false }`; only held in volatile Python RAM during matching |
| **View Raw Face Images** | **Denied** (Not stored) | **Denied** (Not stored) | **Denied** (Not stored) | Discarded from memory immediately after embedding extraction |
| **View Class Attendance Reports** | Denied | **Allowed** (Assigned courses) | **Allowed** (All departments) | `GET /api/attendance/faculty/reports` |
| **Configure System Attendance Rules** | Denied | Denied | **Allowed** | `PUT /api/attendance/admin/settings` (`allowRoles('admin')`) |
| **Inspect Immutable Audit Logs** | Denied | Denied | **Allowed** | `GET /api/attendance/admin/audit-logs` (`allowRoles('admin')`) |
| **Manage Users & Academic Roles** | Denied | Denied | **Allowed** | `GET /api/admin/users`, `PATCH /api/admin/users/:id/activate` |

---

## 2. Granular Role Specifications

### 2.1 Student Role Specifications
- **Identity Scope:** Strictly isolated to `req.user.userId`.
- **Query Protection:** When fetching attendance, the database query unconditionally attaches `student: studentDoc._id`. A student cannot inject an arbitrary student ID into query parameters or URL paths.
- **Biometric Self-Determination:** Students have full autonomy over their biometric profile. They can enroll, re-enroll, or revoke consent without requiring administrative intervention.

### 2.2 Faculty Role Specifications
- **Course Scoping:** Faculty can only launch sessions for subjects where `Subject.faculty == req.user.userId` or within their designated academic department.
- **Override Accountability:** Any status modification from `absent` to `present` (or vice versa) requires a non-empty `correctionReason`. The change is attributed to `req.user.userId` and written to `AttendanceAuditLog`.
- **Privacy Barrier:** Faculty members see only operational statuses (`present`, `absent`, `needs review`) and timestamps. They are never granted access to raw vectors, quality scores, or biometric metadata.

### 2.3 Administrator Role Specifications
- **Policy Control:** Administrators define institutional constraints (e.g. minimum attendance percentage, session timeouts). Changes affect all subsequent session evaluations.
- **Erasure Compliance:** Administrators can execute data erasure requests in accordance with privacy laws (DPDP/GDPR). Deleting a student's face profile zeroes out the `FaceEmbedding` record, invalidates template references, and marks the consent status as `revoked`.
- **Supervisory Auditing:** Administrators can review all session creations, cancellations, and manual overrides to detect fraudulent alterations or attendance inflation.

