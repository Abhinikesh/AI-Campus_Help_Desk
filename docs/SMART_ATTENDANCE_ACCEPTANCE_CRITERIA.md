# Smart Attendance Testable Acceptance Criteria

**System Name:** CampusSphere AI Smart Attendance Module  
**Audit Date:** November 1, 2026  
**Auditor:** Senior Software Architect & Technical Auditor  
**Format:** Gherkin Given-When-Then testable specifications mapped to Functional Requirements.

---

## 1. Student Attendance Workflows

### AC-STU-01: Viewing Attendance Overview
- **Requirement:** FR-STU-01 (P0)
- **Scenario:** Enrolled student views calculated attendance metrics
  - **Given** an authenticated student `20240001` with 15 conducted classes and 15 attended classes in Semester 5
  - **When** the student navigates to `/student/attendance`
  - **Then** the page displays:
    - Overall Attendance: `100%`
    - Total Classes: `15`
    - Classes Attended: `15`
    - Classes Missed: `0`
    - Status Badge: `✓ On Track` (green)
  - **And** the Subject-Wise Breakdown table lists all 14 active Semester 5 courses with matching individual statistics.

### AC-STU-02: Voluntary Biometric Enrollment
- **Requirement:** FR-BIO-01 (P0)
- **Scenario:** Student completes face registration with consent
  - **Given** an authenticated student who has not yet enrolled biometric data
  - **When** the student navigates to `/student/attendance/face-registration`
  - **And** checks the mandatory consent box and clicks "Enable Camera"
  - **And** positions their face within the oval guide under adequate lighting
  - **And** clicks "Capture & Save Biometric Face ID"
  - **Then** the Python AI service validates single face presence and acceptable image quality
  - **And** generates a 128-dimensional embedding vector, encrypts it with AES-256-GCM, and persists it to `FaceEmbedding`
  - **And** the UI transitions to Step 3 showing "Face Biometrics Registered Successfully".

### AC-STU-03: Voluntary Biometric Verification
- **Requirement:** FR-BIO-02 (P0)
- **Scenario:** Student marks attendance via 1:1 face verification during an active class
  - **Given** an active `AttendanceSession` open for `CS501` (Semester 5, Section A)
  - **And** student `20240001` has an active enrolled biometric profile
  - **When** the student navigates to `/student/attendance/mark` and selects the `CS501` session
  - **And** allows camera access and clicks "Verify Attendance"
  - **Then** the client captures a webcam frame and sends it to `POST /api/student/:sessionId/attendance`
  - **And** the backend retrieves the student's encrypted vector and compares it via Python dlib ResNet
  - **And** the Euclidean distance $d$ is $\le 0.55$
  - **Then** an `Attendance` record is created with `status: 'present'`, `verificationMethod: 'face'`, and `confidence: >= 0.85`
  - **And** the student UI displays a green success confirmation checkmark.

### AC-STU-04: Duplicate Attendance Prevention
- **Requirement:** FR-SYS-01 (P0)
- **Scenario:** Student attempts to submit attendance twice for the same class session
  - **Given** student `20240001` has already been recorded as `present` for session `SESS001`
  - **When** the student attempts to click "Verify Attendance" again or calls the API concurrently
  - **Then** the backend returns HTTP `409 Conflict` with message `"Attendance already marked for this session"`
  - **And** no duplicate record is created in the database.

---

## 2. Faculty Attendance Workflows

### AC-FAC-01: Session Creation from Timetable
- **Requirement:** FR-FAC-01 (P0)
- **Scenario:** Faculty member opens an attendance session
  - **Given** authenticated faculty `FAC001` assigned to `CS501`
  - **When** the faculty member navigates to `/faculty/attendance` and clicks "Take Attendance" on today's scheduled slot
  - **And** specifies duration `60 minutes` and clicks "Launch Session"
  - **Then** a new `AttendanceSession` is created in MongoDB with `status: 'open'`, `date: Today`, and `period: 1`
  - **And** the faculty view automatically navigates to `/faculty/attendance/live/:sessionId`.

### AC-FAC-02: Real-time Live Roster Monitoring
- **Requirement:** FR-FAC-02 (P1)
- **Scenario:** Faculty monitors incoming student verifications
  - **Given** an open attendance session with 8 enrolled students
  - **When** student `20240001` successfully verifies their face
  - **Then** within 3 seconds, the faculty live console updates:
    - Present count increments from `0` to `1`
    - Student `20240001` row changes from `Pending` (gray) to `Present` (green) with verification pill `Face ID`.

### AC-FAC-03: Controlled Manual Override
- **Requirement:** FR-FAC-03 (P0)
- **Scenario:** Faculty manually marks a student present with a justification note
  - **Given** student `20240002` experienced a camera hardware malfunction
  - **When** the faculty clicks on student `20240002` in the live roster table
  - **And** selects "Manual Override Status -> Present"
  - **And** enters the mandatory reason `"Camera device error verified in classroom"`
  - **And** confirms the override dialog
  - **Then** an `Attendance` record is created or updated with:
    - `status: 'present'`
    - `verificationMethod: 'manual'`
    - `isManualOverride: true`
    - `overrideReason: 'Camera device error verified in classroom'`
    - `markedBy: facultyUserId`
  - **And** an entry is appended to `AttendanceAuditLog`.

### AC-FAC-04: Session Finalization
- **Requirement:** FR-FAC-04 (P0)
- **Scenario:** Faculty finalizes the class attendance session
  - **Given** an active session with 5 present students and 3 pending students
  - **When** faculty clicks "Finalize Session" and confirms the modal
  - **Then** the session status transitions to `finalized`
  - **And** the 3 pending students are automatically assigned `status: 'absent'`, `verificationMethod: 'system'`
  - **And** the rotating QR challenge token is invalidated
  - **And** all records for this session are frozen against further student verification.

---

## 3. Administrator Governance Workflows

### AC-ADM-01: Institutional Policy Configuration
- **Requirement:** FR-ADM-01 (P1)
- **Scenario:** Administrator adjusts minimum attendance threshold
  - **Given** authenticated admin `ADMIN001`
  - **When** admin navigates to `/admin/attendance`, selects the "Settings" tab
  - **And** changes `Minimum Attendance Threshold` from `75%` to `80%` and clicks "Save Changes"
  - **Then** the updated value is saved to `AttendanceSettings`
  - **And** all student overview dashboards immediately reflect the new `80%` threshold for shortage alerts.

### AC-ADM-02: Biometric Profile Erasure (GDPR / DPDP Compliance)
- **Requirement:** FR-ADM-02 (P0)
- **Scenario:** Administrator processes a biometric data deletion request
  - **Given** student `20240008` submits a formal biometric consent withdrawal
  - **When** admin navigates to `/admin/attendance`, selects "Biometric Profiles"
  - **And** clicks "Purge Biometrics" for student `20240008` and confirms the security prompt
  - **Then** the student's `FaceEmbedding` record is purged from MongoDB
  - **And** `ConsentRecord` is updated to `status: 'revoked'` with timestamp
  - **And** all subsequent face verification attempts for this student are blocked until re-enrolled.

