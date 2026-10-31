# CampusSphere AI — Smart Attendance API & Architecture Documentation

## Architecture Overview

The Smart Attendance module follows a secure, high-performance polyglot architecture:

```
[ Frontend Client (Vite React @ 5173) ]
             │
             ▼ (JWT Cookie or Bearer Auth)
[ Node.js / Express Gateway & Business Engine @ 5001 ]
     │                                     │
     ▼ (Mongoose Connection)               ▼ (Internal HMAC / API Key: X-Internal-Key)
[ MongoDB (Port 27018) ]       [ Python / Flask AI Service @ 5002 ]
- Single Source of Truth        - Analytics & Calculation Engine
- AttendanceSession             - AES-256-GCM Biometric Crypto
- AttendanceRecord (Indexed)    - Face Quality Assessment & Verification
- AttendanceAuditLog            - Faculty & Class Report Generator
- ConsentRecord
- FaceProfile (Encrypted)
```

---

## 1. Authentication & Security Policy

- **Authentication**: All client requests require either an HTTP-only cookie (`campus_token`) or an `Authorization: Bearer <JWT>` header.
- **Role Enforcement**: Strict middleware checks enforce roles: `student`, `faculty`, and `admin`.
- **Biometric Protection**: Biometric templates are stored as AES-256-GCM encrypted blobs and are **never** returned in plaintext through user or admin APIs (`select: false`).
- **Audit Trails**: All session status changes, manual overrides, and biometric operations automatically write append-only records to `AttendanceAuditLog`.

---

## 2. Attendance Session APIs

### 2.1 Create Attendance Session
- **Endpoint**: `POST /api/attendance/sessions`
- **Auth**: `faculty`, `admin`
- **Description**: Creates a new attendance session for an assigned class. Verifies that the faculty member is assigned to the course and that no conflicting session exists for the same period and date.
- **Request Body**:
```json
{
  "subjectId": "6ae466a3116bc0d3c75ce834",
  "date": "2026-05-15",
  "period": 2,
  "startTime": "10:00 AM",
  "endTime": "11:00 AM",
  "sessionType": "regular",
  "attendanceMethod": "face",
  "branch": "CSE",
  "semester": 4,
  "section": "A",
  "status": "open"
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "_id": "6ae484fe33ec3feced5107ee",
    "sessionId": "6ae484fe33ec3feced5107ee",
    "subject": { "_id": "...", "code": "CS201", "name": "Data Structures & Algorithms" },
    "faculty": { "_id": "...", "name": "Dr. Priya Mehta" },
    "date": "2026-05-15",
    "period": 2,
    "status": "open",
    "totalStudents": 8,
    "presentCount": 0
  },
  "message": "Attendance session created successfully"
}
```
- **Error Codes**: `400` (Missing fields or Period > 10), `403` (Faculty not assigned to subject), `409` (Conflicting session exists).

---

### 2.2 Get Active Sessions
- **Endpoint**: `GET /api/attendance/sessions/active`
- **Auth**: Authenticated User (`student` or `faculty`)
- **Description**: Returns live/open sessions. For students, filters strictly to their enrolled semester and branch and decorates each session with `isAlreadyMarked`.
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "6ae484fe33ec3feced5107ee",
      "subject": { "name": "Data Structures & Algorithms", "code": "CS201" },
      "faculty": { "name": "Dr. Priya Mehta" },
      "date": "2026-05-15",
      "period": 2,
      "startTime": "10:00 AM",
      "endTime": "11:00 AM",
      "status": "open",
      "isAlreadyMarked": false
    }
  ]
}
```

---

### 2.3 Session Lifecycle Controls
- `POST /api/attendance/sessions/:sessionId/start` — Transition scheduled session to `open`.
- `POST /api/attendance/sessions/:sessionId/end` — Close session and transition to `completed`.
- `POST /api/attendance/sessions/:sessionId/finalize` — Finalize session, calculate attendance, and mark non-attending students as `absent`.
- `POST /api/attendance/sessions/:sessionId/cancel` — Mark session as `cancelled` with reason; excluded from all percentage calculations.
- `GET /api/attendance/sessions/:sessionId/qr-challenge` — Generate short-lived (45-second) challenge token for rotating QR self-check-in.

---

## 3. Student Attendance APIs

### 3.1 Student Overview (Calculated via Python Engine)
- **Endpoint**: `GET /api/attendance/student/overview`
- **Auth**: `student`
- **Description**: Returns attendance overview computed by Python calculation engine. Excludes cancelled, future, and unfinalized sessions. If zero classes exist, returns `hasRecords: false` and `status: "No Data"`.
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "subjectId": "6ae466a3116bc0d3c75ce834",
      "subjectCode": "CS201",
      "subjectName": "Data Structures & Algorithms",
      "attended": 18,
      "missed": 2,
      "total": 20,
      "percentage": 90.0,
      "status": "On Track"
    }
  ],
  "summary": {
    "overall": 88.5,
    "totalClasses": 40,
    "totalAttended": 35,
    "totalMissed": 5,
    "minThreshold": 75,
    "status": "On Track",
    "hasRecords": true,
    "activeSessions": [],
    "recentHistory": [...]
  }
}
```

---

### 3.2 Join Active Session
- **Endpoint**: `POST /api/attendance/student/:sessionId/join`
- **Auth**: `student`
- **Description**: Validates that student is enrolled in the session's branch and semester and that the session is active.
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "sessionId": "6ae484fe33ec3feced5107ee",
    "subject": "Data Structures & Algorithms",
    "code": "CS201",
    "attendanceMethod": "face",
    "isAlreadyMarked": false,
    "verificationRequired": true
  },
  "message": "Session eligibility verified. Ready for verification."
}
```

---

### 3.3 Verify & Record Attendance
- **Endpoint**: `POST /api/attendance/student/:sessionId/attendance`
- **Auth**: `student`
- **Description**: Verifies biometric / QR challenge and creates or updates attendance record. Prevents duplicate marking atomically.
- **Request Body**:
```json
{
  "verificationMethod": "face",
  "confidence": 0.94,
  "liveImageData": "data:image/jpeg;base64,..."
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "attendanceId": "6ae486a3116bc0d3c75ce999",
    "studentName": "Arjun Sharma",
    "rollNumber": "20240001",
    "subject": "Data Structures & Algorithms",
    "code": "CS201",
    "status": "present",
    "verificationStatus": "verified",
    "confidence": 0.94
  },
  "message": "Attendance verified and marked successfully! 🎓"
}
```

---

### 3.4 Get Specific Student Attendance Record
- **Endpoint**: `GET /api/attendance/student/:attendanceId`
- **Auth**: `student`
- **Ownership Check**: Student can only access their own records. Cross-student access returns `403 Forbidden`.

---

## 4. Faculty Attendance APIs

### 4.1 Faculty Overview
- **Endpoint**: `GET /api/attendance/faculty/overview`
- **Auth**: `faculty`
- **Response**: Assigned subjects count, classes scheduled today, sessions conducted, and average class attendance percentage.

### 4.2 Session Roster & Live Students
- **Endpoint**: `GET /api/attendance/faculty/sessions/:sessionId/students`
- **Auth**: `faculty`, `admin`
- **Response**: List of all enrolled students for the class with real-time marking status, verification method, confidence score, and manual override flags.

### 4.3 Manual Attendance Correction
- **Endpoint**: `PATCH /api/attendance/faculty/records/:attendanceId`
- **Auth**: `faculty`, `admin`
- **Description**: Controlled manual override. Requires mandatory non-empty reason. Records previous status, new status, actor, and reason into `AttendanceAuditLog`.
- **Request Body**:
```json
{
  "status": "late",
  "reason": "Student arrived 5 minutes late due to medical room visit"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "_id": "6ae486a3116bc0d3c75ce999",
    "status": "late",
    "attendanceStatus": "late",
    "isManualOverride": true,
    "correctionReason": "Student arrived 5 minutes late due to medical room visit",
    "correctedAt": "2026-10-30T17:20:00.000Z"
  },
  "message": "Attendance record updated and audit log recorded"
}
```

### 4.4 Faculty Reports
- **Endpoint**: `GET /api/attendance/faculty/reports?semester=4&branch=CSE`
- **Auth**: `faculty`, `admin`
- **Description**: Generates class-level and student breakdown analytics calculated by Python AI service.

---

## 5. Admin Attendance APIs

- `GET /api/attendance/admin/overview`: Institutional analytics (total sessions, records, biometric adoption rate).
- `GET /api/attendance/admin/sessions`: Paginated session explorer with department, branch, semester, and date filters.
- `GET /api/attendance/admin/records`: Paginated attendance records with search and status filters.
- `GET /api/attendance/admin/audit-logs`: Append-only immutable log viewer with actor, action, and timestamp filters.
- `GET /api/attendance/admin/face-profiles`: Lists biometric enrollment status and timestamps. (Embeddings strictly omitted).
- `DELETE /api/attendance/admin/face-profiles/:studentId`: Permanently deletes biometric template and revokes consent record upon student request.
- `GET /api/attendance/admin/settings` & `PUT /api/attendance/admin/settings`: Configures institutional attendance policies (e.g. minimum attendance threshold, late grace periods).

---

## 6. Internal Python AI Service (Port 5002)

All inter-service requests require `X-Internal-Key: <INTERNAL_API_KEY>`.

- `POST /api/internal/analytics/calculate-student`: Calculates student attendance metrics, excluding cancelled/unfinalized sessions and safely handling zero-class scenarios.
- `POST /api/internal/analytics/faculty-report`: Aggregates faculty class-level attendance stats.
- `POST /api/internal/biometrics/validate-quality`: Evaluates image resolution, size, sharpness, and illumination.
- `POST /api/internal/biometrics/enroll`: Extracts biometric template signature and returns AES-256-GCM encrypted blob with SHA3 fingerprint.
- `POST /api/internal/biometrics/verify`: Decrypts enrolled template and evaluates similarity against live capture.
