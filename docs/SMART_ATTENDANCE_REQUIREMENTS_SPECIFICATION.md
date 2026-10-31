# Smart Attendance Requirements Specification & Functional Design
## Project: CampusSphere AI — Smart Campus Management Platform

**Document Version:** 2.0.0  
**Phase:** Part 2 of 24 — Detailed Requirements Analysis & Functional Specification  
**Status:** Approved for Implementation Planning  
**Auditor / Architect:** Senior Software Architect, Full-Stack Engineer & Technical Auditor  
**Date:** November 1, 2026  

---

## 1. Project Context & Objectives

### 1.1 Context
CampusSphere AI is an operational higher-education Enterprise Resource Planning (ERP) platform. The Smart Attendance System is being integrated as a native academic module inside the existing ERP architecture. It operates directly upon genuine ERP data—student identities, faculty assignments, branches, semesters, sections, subjects, and timetable schedules.

### 1.2 Core Objectives
1. **Voluntary, Student-Initiated Face Verification:** Replace slow, error-prone manual roll calls with voluntary 1-to-1 biometric face verification executed on student personal devices or supervised class kiosks.
2. **Absolute Elimination of Duplicate Records:** Enforce database-level uniqueness on class period attendances (`{ subject, student, date, period }`).
3. **Privacy by Design:** Zero storage of raw facial photographs; all facial feature vectors (128-dimensional floating point embeddings) are encrypted at rest with AES-256-GCM / Fernet.
4. **Seamless Non-Biometric Alternative:** Provide guaranteed fallback workflows (faculty manual override with mandatory audit reasons, dynamic rotating QR challenge) so no student is disenfranchised or penalized for camera or technical failures.
5. **Integrated Academic Analytics:** Deliver real-time attendance calculations, shortage alerts (<75% institutional threshold), and tamper-evident audit logs across Student, Faculty, and Admin portals.

---

## 2. User Roles & Personas

The platform defines three strictly segregated user roles governed by JWT authentication and server-side Role-Based Access Control (RBAC):

1. **Student (`role: 'student'`):**
   - Enrolled in an academic program, branch, semester, and section.
   - Authorized to manage personal biometric consent and enrollment.
   - Authorized to view personal attendance percentages, course breakdowns, and active eligible class sessions.
   - Authorized to initiate 1:1 face verification during active sessions.
   - Strictly forbidden from viewing or marking attendance for other students.

2. **Faculty (`role: 'faculty'`):**
   - Assigned to specific departmental courses and timetable periods.
   - Authorized to launch, monitor, pause, close, and finalize attendance sessions for assigned subjects.
   - Authorized to view real-time live attendance rosters and active countdown timers.
   - Authorized to perform controlled manual overrides with mandatory justification notes.
   - Strictly forbidden from viewing raw biometric data or modifying records outside assigned classes.

3. **Administrator (`role: 'admin'`):**
   - Institutional authority over ERP configuration, users, and audit compliance.
   - Authorized to inspect campus-wide attendance health, departmental defaulter rates, and session logs.
   - Authorized to configure institutional policies (minimum attendance threshold, session timeout, retry limits, retention period).
   - Authorized to process biometric data erasure requests.
   - Strictly forbidden from viewing decrypted biometric templates.

---

## 3. End-to-End User Experience & Functional Workflows

### 3.1 Complete Student Experience

#### A. Attendance Overview (`/student/attendance`)
- **Metric Cards:**
  - Overall Attendance Percentage (calculated as $\frac{\text{Classes Attended}}{\text{Total Classes Conducted}} \times 100$).
  - Total Classes Conducted (count of completed/finalized sessions for enrolled subjects).
  - Classes Attended (count of sessions with status `present` or `late`).
  - Classes Missed (count of sessions with status `absent`).
- **Shortage Warning:** Prominently highlights courses below the institutional threshold (75%) in crimson with an estimate of upcoming consecutive classes required to reach compliance.
- **Active Session Banner:** When a faculty member opens an attendance session matching the student's branch and semester, an "Active Live Session" card appears with subject code, faculty name, period, and a one-click button to launch verification.
- **Subject-Wise Breakdown Table:** Tabular listing of all courses in the current semester displaying course code, faculty name, total classes, attended, missed, visual progress bar, percentage, and status pill (`Good`, `Warning`, `Critical`).

#### B. Voluntary Biometric Enrollment (`/student/attendance/face-registration`)
1. **Consent Stage:** Displays plain-language disclosure stating:
   - What data is captured: 128-dimensional mathematical facial coordinates.
   - Storage method: Encrypted with AES-256-GCM; raw images are immediately discarded from memory.
   - Voluntary nature: Clear notification of non-biometric manual alternatives.
   - Student must check the explicit agreement box before the camera can be activated.
2. **Webcam Capture & Quality Check:**
   - Client opens the user's camera stream inside a centered oval guide.
   - Frame is inspected for photometric quality: brightness (40–230), contrast (>0.20), and sharpness (Laplacian variance >60.0).
   - Enforces single-face detection constraint; rejects frames with 0 or >1 face.
3. **Template Generation & Encryption:**
   - Python AI service generates a 128-d vector via dlib ResNet, computes SHA-256 fingerprint, encrypts the vector, and stores the encrypted blob in MongoDB (`FaceEmbedding`).
   - A timestamped audit entry is written to `ConsentRecord`.
4. **Revocation & Deletion:**
   - Student can revoke consent at any time, immediately invalidating the biometric template and switching profile to non-biometric status.

#### C. Live Attendance Verification (`/student/attendance/mark`)
1. Student navigates to the verification screen for an open class session.
2. System validates student eligibility (branch, semester, and section match).
3. Client captures a live video frame and submits it to Node.js backend (`POST /api/student/:sessionId/attendance`).
4. Node.js backend retrieves the student's encrypted template and sends both to Python AI service (`POST /api/ai/verification/verify`).
5. Python validates single face, extracts live 128-d vector, decrypts enrolled template in RAM, and computes Euclidean distance.
6. If distance $\le 0.55$, the match is verified. Node.js records status `present`, method `face`, confidence score, and timestamp.
7. Student receives an immediate green confirmation checkmark with session details.

---

### 3.2 Complete Faculty Experience

#### A. Faculty Attendance Dashboard (`/faculty/attendance`)
- Displays Assigned Students count, Scheduled Classes Today, Conducted Sessions, and Average Class Attendance.
- Lists today's timetable periods with a direct "Start Attendance Session" button.
- Displays past session history with status tags (`active`, `closed`, `finalized`).

#### B. Session Creation & Launch
- Faculty selects subject, date, period (1–8), and session duration (15–180 minutes).
- Pre-fills branch, semester, and section from the timetable catalog.
- Generates an active `AttendanceSession` document in MongoDB.

#### C. Live Attendance Console (`/faculty/attendance/live/:sessionId`)
- **Live Counters:** Real-time counters showing Total Eligible, Marked Present, Pending, and Absent.
- **Active Timer:** Displays elapsed session time and countdown to auto-close.
- **Dynamic Rotating QR Code:** Generates a short-lived HMAC token refreshed every 30 seconds for combined QR-verification or physical classroom proximity validation.
- **Roster Grid:** Real-time table of all students in the section with roll number, student name, current status, verification method, and timestamp.
- **Controlled Manual Override:** Faculty can click any student to adjust status (`present`, `absent`, `excused`, `late`). Prompts for a mandatory justification reason and creates an immutable `AttendanceAuditLog` entry.
- **Finalize Session Action:** Finalizing the session permanently freezes the roster, marks all remaining unverified students as `absent`, locks records from student modification, and triggers attendance analytics calculations.

---

### 3.3 Complete Administrator Experience

#### A. Admin Attendance Hub (`/admin/attendance`)
- **Institutional Overview:** Aggregated attendance statistics across all branches, total active sessions, system-wide average attendance, and critical shortage alerts.
- **Session Explorer:** Filterable audit table of all campus sessions with status, faculty creator, timestamps, and enrolled vs. attended counts.
- **Biometric Governance:** Dashboard displaying enrollment percentage per branch, pending enrollments, and student consent statuses. Never exposes raw face images or embedding vectors.
- **Audit Log Inspector:** Complete searchable log of all session creations, status corrections, manual overrides, and biometric revocations.
- **System Configuration:** Interface to adjust institutional rules:
  - Minimum attendance percentage threshold (default: 75%).
  - Default session duration (default: 60 minutes).
  - Verification retry limit (default: 3 attempts).
  - Biometric retention lifespan (default: 365 days).
  - Face matching distance threshold (default: 0.55).

---

## 4. Attendance Rules & Business Logic Specification

### 4.1 Session Eligibility & Scoping
1. A session can only be created by an authenticated faculty member assigned to the subject or by an authorized departmental administrator.
2. A student can only view and join sessions where:
   $$\text{Session.branch} == \text{Student.branch} \quad \land \quad \text{Session.semester} == \text{Student.semester} \quad \land \quad \text{Session.section} == \text{Student.section}$$
3. Attendance can only be submitted while the session state is `open` or `active`.

### 4.2 Duplicate Prevention & Concurrency Protection
1. **Database Constraint:** MongoDB enforces uniqueness on the composite index:
   $$\text{unique}(\text{subject}, \text{student}, \text{date}, \text{period})$$
2. **Application Guard:** `Attendance.findOne({ session: sessionId, student: studentId })` executes before any biometric verification call to reject repeat attempts with `409 Conflict`.
3. **Atomic Writes:** Mongoose `findOneAndUpdate` with upsert locks ensure concurrent browser tabs cannot generate parallel records.

### 4.3 Session Finalization Logic
When a session is finalized:
1. Session status transitions permanently from `active` $\rightarrow$ `finalized`.
2. Any eligible student in the roster without a recorded attendance is automatically backfilled with:
   $$\text{status} = \text{'absent'}, \quad \text{verificationMethod} = \text{'system'}, \quad \text{isManualOverride} = \text{false}$$
3. The rotating QR challenge token is invalidated immediately.
4. Python `AttendanceEngine` runs aggregate calculations to update subject-level totals and student percentages.

---

## 5. Face-Verification & Biometric Requirements

### 5.1 Architecture & Modality
- **Modality:** Voluntary, student-initiated, one-to-one (1:1) facial verification.
- **Engine:** Python 3.12, OpenCV 4.13, dlib 19.24.6 ResNet model (`face_recognition` 1.3.0).
- **Embedding Format:** 128-dimensional normalized floating point vector ($\|\mathbf{v}\|_2 = 1.0$).

### 5.2 Distance & Matching Thresholds
Given live embedding $\mathbf{v}_{\text{live}}$ and enrolled embedding $\mathbf{v}_{\text{enrolled}}$, the Euclidean distance $d$ is:
$$d = \|\mathbf{v}_{\text{live}} - \mathbf{v}_{\text{enrolled}}\|_2 = \sqrt{\sum_{i=1}^{128} (v_{\text{live}, i} - v_{\text{enrolled}, i})^2}$$

The matching decisions are defined as:
| Euclidean Distance $d$ | Decision | Confidence Score | Action |
|---|---|---|---|
| $d \le 0.55$ | **VERIFIED (Match)** | $\ge 85\%$ | Attendance marked `present` |
| $0.55 < d \le 0.65$ | **REQUIRES_REVIEW** | $65\% - 84\%$ | Marked `review`; flagged for faculty confirmation |
| $d > 0.65$ | **NOT_MATCHED** | $< 65\%$ | Verification rejected; retry permitted up to limit |

*Note: The system explicitly distinguishes facial verification from hardware liveness detection. Anti-spoofing is evaluated via challenge-response and session time-bounding.*

---

## 6. Privacy, Security & Compliance Requirements

1. **Informed Consent (SEC-01):** Biometric capture must be preceded by active, recorded consent (`ConsentRecord`).
2. **Ephemeral Image Processing (SEC-02):** Raw image data exists solely in volatile server RAM for vector computation and is garbage-collected immediately. No image files are written to disk.
3. **Encryption at Rest (SEC-03):** All 128-d vectors are encrypted using Fernet (AES-256-GCM) with secret keys stored strictly in `.env`.
4. **Access Control (SEC-04):** Face templates have `{ select: false }` in Mongoose schemas, preventing accidental leakage in REST API payloads.
5. **Right to Erasure (SEC-05):** Students or administrators can invoke `/api/student/face/revoke` or `/api/admin/attendance/face-enrollments/:id` to permanently erase biometric data.
6. **Immutable Audit Trails (SEC-06):** Every privileged action (override, deletion, session finalize) writes an unalterable log in `AttendanceAuditLog`.

---

## 7. Non-Biometric Fallback Specification

A non-biometric alternative is mandatory to accommodate technical failures, hardware limitations, or withheld consent:

1. **Faculty Manual Override:**
   - In `LiveAttendance.jsx`, faculty can manually mark any enrolled student as `present`, `late`, or `excused`.
   - Requires a mandatory textual reason (e.g., "Webcam hardware failure", "Consent withheld", "Medical leave").
   - Status is recorded with `verificationMethod = 'manual'`, `isManualOverride = true`, and `markedBy = facultyUserId`.
2. **Rotating QR Proximity Attendance:**
   - For students with camera issues or non-biometric status, faculty displays the rotating QR code on the classroom screen.
   - Student scans the code or enters the 6-character short code within the 30-second window to confirm physical presence.

