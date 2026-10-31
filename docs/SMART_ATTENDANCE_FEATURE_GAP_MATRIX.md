# Smart Attendance Feature-Gap Matrix

**System Name:** CampusSphere AI Smart Attendance Module  
**Audit Date:** November 1, 2026  
**Auditor:** Senior Software Architect & Technical Auditor  
**Inspection Scope:** Direct codebase inspection of `client/src`, `server/`, `ai-service/`, and MongoDB collections.

---

## 1. Comprehensive Feature-Gap Assessment

| Feature | Existing Status | Evidence from Repository Inspection | Gap Identified | Required Action | Priority | Dependencies |
|---|---|---|---|---|---|---|
| **User Login & Session** | **Operational** | `auth.controller.js`, `auth.routes.js`, `LoginPage/index.jsx`. Validates student, faculty, admin login IDs with bcrypt. Issues JWT with 7-day expiration. | No automatic token refresh before expiration; relies on single token lifecycle. | Add silent token refresh endpoint or handle graceful expiration redirect. | **P1** | Node.js Express, MongoDB User model |
| **Role-Based Permissions (RBAC)** | **Operational** | `role.middleware.js` enforces `allowRoles('student')`, `allowRoles('faculty')`, `allowRoles('admin')`. | Some legacy routes in `ai.routes.js` lacked explicit role guards. | Audit all routes to ensure strict role-scoping on every endpoint. | **P0** | Express middleware |
| **Faculty Timetable Integration** | **Operational** | `Timetable.js`, `Subject.js`, `FacultyTimetable/index.jsx`. Real Semester 5 subjects (`CS501` to `CS514`) seeded. | Current model supports single-period slots; multi-period block labs (e.g. 2-hour lab slots) are split into individual records. | Enhance timetable modal to support contiguous multi-period blocks for laboratory courses. | **P1** | Subject, Timetable, AttendanceSession |
| **Attendance Session Lifecycle** | **Operational** | `AttendanceSession.js`, `attendance.controller.js` (`createSession`, `startSession`, `endSession`, `finalizeSession`). | Session auto-close timer runs client-side; needs a scheduled backend cron or cleanup task for orphaned open sessions. | Add background job or on-access timeout check to auto-close expired active sessions. | **P0** | AttendanceSession model |
| **Student Attendance Record** | **Operational** | `Attendance.js` model with fields `status`, `verificationMethod`, `confidence`, `markedAt`, `isManualOverride`. | Historical records across semesters 1–4 are stored in results/marks ledger, but attendance records exist only for Sem 5. | Maintain Sem 5 as active operational dataset; retain historical mark ledger intact. | **P0** | Student, Subject, Attendance |
| **Face Enrollment & Consent** | **Operational** | `FaceRegistration.jsx`, `ConsentRecord.js`, `FaceEmbedding.js`, `ai-service/app/routes/enrollment_routes.py`. | UI takes single or multi-sample frames; does not provide animated multi-angle head-turn guidance (pitch/yaw). | Add visual pitch/yaw feedback prompts during capture to improve template angular tolerance. | **P1** | Webcam API, OpenCV, dlib ResNet |
| **Face Verification (1:1)** | **Operational** | `MarkAttendance.jsx`, `verification_routes.py`, `verification_service.py`. Euclidean distance matching against student's encrypted vector. | Distance between 0.55 and 0.65 requires clear user guidance on why review is needed (e.g., lighting/angle). | Refine client status strings to display actionable advice ("Tilt head up", "Move closer"). | **P0** | Python AI service, dlib, OpenCV |
| **Duplicate Prevention** | **Operational** | MongoDB compound unique index `{ subject: 1, student: 1, date: 1, period: 1 }` in `Attendance.js`. Application check in controller. | Fully protected at both application and database layers. Zero gaps. | Maintain index enforcement in all seed and migration scripts. | **P0** | MongoDB WiredTiger index engine |
| **Student Attendance History** | **Operational** | `AttendanceHistory.jsx`, `attendance.service.js`. Searchable list with date filters and status badges. | Lacks direct PDF export of attendance statement for students. | Add simple client-side printable statement view or PDF export. | **P2** | React components, CSS print styles |
| **Faculty Live Roster Console** | **Operational** | `LiveAttendance.jsx`. Displays real-time student count, presence list, timer, and rotating QR token. | Updates via 3-second HTTP polling rather than WebSocket / Server-Sent Events (SSE). | Keep HTTP polling with exponential backoff on idle; evaluate SSE for low-overhead broadcast in Part 4. | **P1** | AttendanceSession, Attendance |
| **Admin Analytics & Settings** | **Operational** | `AdminAttendance/index.jsx`, `AttendanceSettings.js`, `attendance.controller.js`. System threshold configuration (75%). | Settings changes saved to MongoDB require manual server restart or re-fetch on each request. | Introduce in-memory cached settings with a 60-second TTL to reduce DB read overhead. | **P1** | AttendanceSettings model |
| **Non-Biometric Fallback** | **Operational** | `LiveAttendance.jsx` manual override modal with mandatory justification reason; rotating QR challenge code. | QR code input field on student portal requires manual text typing if student camera is broken. | Ensure short 6-digit code entry is prominent on mobile and desktop views. | **P0** | AttendanceSession QR token |
| **Audit Trail & Logging** | **Operational** | `AttendanceAuditLog.js`. Records session events, biometric updates, and manual overrides with user attribution. | Admin audit viewer has basic table; needs full-text search and date range filtering. | Enhance filter controls in Admin Attendance Audit tab. | **P0** | AttendanceAuditLog model |

---

## 2. Priority Definition & Summary

- **P0 (Critical / Mandatory for System Integrity):** 
  - Role permissions enforcement on all endpoints.
  - Complete session lifecycle (create, join, close, finalize).
  - Database-enforced duplicate prevention.
  - Student 1:1 biometric verification with calibrated distance threshold.
  - Non-biometric fallback with auditable manual override.
  - Immutable audit trail.
- **P1 (High / Required for Usable Enterprise Experience):**
  - Live roster polling optimization.
  - Token refresh and expiration handling.
  - Session auto-close background cron.
  - Pitch/yaw capture prompts in enrollment.
  - In-memory cache for attendance system settings.
- **P2 (Medium / Enhancements):**
  - PDF attendance statement generation for students.
  - Enhanced audit log search filters.
- **P3 (Low / Future Enhancements):**
  - WebSocket / SSE push streaming.
  - Multi-camera classroom kiosk mode.

