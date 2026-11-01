# Smart Attendance — Backend Integration Audit
**Module:** CampusSphere AI — Smart Campus Management ERP  
**Component:** Node.js/Express Backend & Python AI Microservice Integration  
**Version:** 1.0.0 (Part 6/24 Hardening)  
**Author:** Senior Backend & Application Security Engineer  

---

## 1. Executive Summary

This document presents the complete architectural audit and integration verification of the Node.js/Express Smart Attendance backend within **CampusSphere AI**. 

In accordance with institutional security guidelines:
- **Node.js/Express** serves as the **sole authoritative application layer**, managing authentication, session state transitions, academic authorization, attendance record mutations, and immutable audit logs.
- **Python AI Microservice** (`ai-service/`) operates strictly as an **internal computational oracle** for biometric feature extraction and 1:1 Euclidean distance verification. It holds zero direct access to the MongoDB database and possesses no authority to create, mutate, or finalize attendance records.
- **MongoDB** enforces data consistency and multi-period uniqueness via compound indexes, schema constraints, and atomic conditional transitions.

---

## 2. Attendance Routes, Controllers, and Middleware Map

All attendance endpoints are rooted under `/api/attendance` and guarded by role-based access control (RBAC).

| Method | Endpoint | Authorized Roles | Controller Method | Purpose |
|---|---|---|---|---|
| `POST` | `/api/attendance/sessions` | `faculty`, `admin` | `createSession` | Create a scheduled/open session with multi-period support and conflict validation |
| `GET` | `/api/attendance/sessions` | `faculty`, `admin` | `getSessions` | List faculty-owned or departmental attendance sessions |
| `GET` | `/api/attendance/sessions/:sessionId` | `faculty`, `student`, `admin` | `getSessionById` | Retrieve session metadata and real-time live attendance stats |
| `POST` | `/api/attendance/sessions/:sessionId/start` | `faculty`, `admin` | `startSession` | Transition session from `scheduled` to `open`/`active` |
| `POST` | `/api/attendance/sessions/:sessionId/pause` | `faculty`, `admin` | `pauseSession` | Temporarily halt check-in submissions (`open`/`active` → `paused`) |
| `POST` | `/api/attendance/sessions/:sessionId/resume` | `faculty`, `admin` | `resumeSession` | Resume student check-ins (`paused` → `active`) |
| `POST` | `/api/attendance/sessions/:sessionId/end` | `faculty`, `admin` | `endSession` | Close check-in window (`active`/`paused` → `completed`) |
| `POST` | `/api/attendance/sessions/:sessionId/finalize` | `faculty`, `admin` | `finalizeSession` | Lock session permanently and record absentees for eligible students |
| `POST` | `/api/attendance/sessions/:sessionId/cancel` | `faculty`, `admin` | `cancelSession` | Cancel an erroneous session and exclude records from percentage calculations |
| `GET` | `/api/attendance/sessions/:sessionId/qr-challenge`| `faculty`, `admin` | `getQrChallenge` | Generate time-bounded HMAC-SHA256 rotating QR challenge |
| `POST` | `/api/attendance/student/:sessionId/join` | `student` | `joinSession` | Verify eligibility, active biometric enrollment, and session window |
| `POST` | `/api/attendance/student/:sessionId/record` | `student` | `recordStudentAttendance` | Enforce QR challenge, forward live camera image to Python, and record attendance |
| `GET` | `/api/attendance/student` | `student` | `getStudentAttendance` | Calculate aggregated subject-wise percentages and low-attendance warnings |
| `GET` | `/api/attendance/student/history` | `student` | `getStudentAttendanceHistory`| Paginated list of student's verified attendance events |
| `PATCH`| `/api/attendance/records/:attendanceId/override`| `faculty`, `admin` | `manualAttendanceOverride`| Correct attendance status with mandatory justification and audit trail |
| `GET` | `/api/attendance/reports/department` | `faculty`, `admin` | `getDepartmentReport` | Aggregate departmental attendance analytics and defalcation lists |

---

## 3. End-to-End Data Flow

```
[Student Device / React Client]
       │
       │ 1. POST /api/attendance/student/:sessionId/record
       │    Headers: Authorization: Bearer <Student JWT>
       │    Body: { capturedImage: "data:image/jpeg;base64,...", qrToken: "..." }
       ▼
[Node.js / Express Gateway]
       │
       ├── 2. Authenticate Student via JWT & RBAC Middleware
       ├── 3. Validate Session State (must be 'open' or 'active')
       ├── 4. Validate Rotating QR Challenge (HMAC-SHA256 freshness < 45s)
       ├── 5. Verify Academic Eligibility (Branch, Semester, Section match)
       ├── 6. Check Active Biometric Enrollment & Informed Consent
       ├── 7. Retrieve Encrypted Face Template Reference from MongoDB
       │
       │ 8. Internal HTTP POST /api/v1/verify
       │    Body: { image_base64: "...", encrypted_template: "..." }
       ▼
[Python AI Microservice (:5002)]
       │
       ├── 9. Validate Image Quality (Resolution, Blur, Contrast, Illumination)
       ├── 10. Detect Exactly One Frontal Face (dlib HOG/CNN)
       ├── 11. Extract 128-d Vector & Decrypt Enrolled Template (AES-256-GCM)
       ├── 12. Compute Euclidean Distance (Threshold ≤ 0.55)
       │
       │ 13. Return Biometric Result
       │     { success: true, is_match: true, distance: 0.38, confidence: 0.94 }
       ▼
[Node.js / Express Gateway]
       │
       ├── 14. Validate Python Response Structure & Match Result
       ├── 15. Create Attendance Record in MongoDB (Handling E11000 duplicate idempotency)
       ├── 16. Record Audit Log Event (action: 'mark_attendance')
       │
       ▼
[Response to Student: 201 Created / Attendance Verified]
```

---

## 4. Identified and Resolved Backend Defects

During the Part 6 hardening phase, several critical architectural defects were identified and systematically resolved:

1. **Session State Race Conditions:**  
   *Problem:* Direct property mutation and `session.save()` allowed concurrent status updates (e.g. concurrent `finalize` and `cancel` requests) to overwrite each other without validation.  
   *Resolution:* Implemented `sessionStateMachine.service.js` which executes atomic conditional updates using MongoDB `findOneAndUpdate({ _id: sessionId, status: currentStatus })`.

2. **Indiscriminate Background Expiration:**  
   *Problem:* Early scheduler designs marked all students as absent whenever a session timed out, regardless of faculty review.  
   *Resolution:* Implemented `sessionScheduler.service.js` with injectable clock support. The scheduler transitions expired sessions to `completed` without tampering with individual student records. Absentee marking is restricted strictly to faculty-authorized `finalizeSession`.

3. **Rotating QR Token Replay:**  
   *Problem:* Static QR codes or simple timestamps could be screenshotted and redistributed via messaging apps.  
   *Resolution:* Built `qrChallenge.service.js` implementing HMAC-SHA256 signatures with nonce, millisecond timestamps, and a strict 45-second sliding window bound strictly to the session ID.

4. **Multi-Period Lab Session Integrity:**  
   *Problem:* Laboratory classes spanning 2 to 3 periods could only record a single period number, leaving subsequent periods unaccounted for in semester attendance calculations.  
   *Resolution:* Added `periods: [Number]` and `periodCount` support to `AttendanceSession` and `Attendance` models, backed by compound index `{ student: 1, session: 1, period: 1 }`.

