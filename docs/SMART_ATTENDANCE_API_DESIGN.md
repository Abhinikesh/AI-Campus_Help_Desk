# Smart Attendance API Design & Interface Contracts
## Project: CampusSphere AI — Smart Campus Management Platform

**Document Version:** 3.0.0  
**Phase:** Part 3 of 24 — Complete System Architecture & Technical Design  
**Date:** November 1, 2026  
**Auditor / Architect:** Senior Software Architect, Full-Stack Engineer & API Architect  

---

## 1. API Architecture & Standards

- **Base URL:** `/api/attendance` (with student/faculty shortcuts in `/api/student/*` and `/api/faculty/*`)
- **Transport:** HTTPS with JSON request/response bodies (max payload: 10 MB)
- **Authentication:** Bearer JWT in `Authorization` header (`Bearer <token>`) or `campus_token` HTTP-only cookie
- **Authorization:** Server-enforced via `auth.middleware.js` and `role.middleware.js`
- **Standard Response Envelope:**
```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully",
  "timestamp": "2026-11-01T00:00:00.000Z"
}
```
- **Standard Error Envelope:**
```json
{
  "success": false,
  "status": "ERROR_CODE",
  "message": "Human-readable description of error with actionable advice",
  "timestamp": "2026-11-01T00:00:00.000Z"
}
```

---

## 2. Student Attendance API Endpoints

### 2.1 `GET /api/attendance/student/overview`
- **Role Required:** `student`
- **Description:** Returns aggregate attendance metrics and subject-wise breakdown for the authenticated student.
- **Response `200 OK`:**
```json
{
  "success": true,
  "summary": {
    "overallPercentage": 84.5,
    "totalClasses": 25,
    "classesAttended": 21,
    "classesMissed": 4,
    "minimumThreshold": 75.0,
    "status": "On Track",
    "activeSessions": [
      {
        "_id": "672401a0e10b42f4c9a81001",
        "subject": "Design Analysis of Algorithms",
        "code": "CS501",
        "faculty": "Prof. Neha Singh",
        "period": 1,
        "date": "2026-11-01",
        "startTime": "09:00 AM",
        "endTime": "10:00 AM",
        "isJoined": false,
        "status": "open"
      }
    ]
  },
  "data": [
    {
      "_id": "672401a0e10b42f4c9a82001",
      "subject": "Design Analysis of Algorithms",
      "code": "CS501",
      "facultyName": "Prof. Neha Singh",
      "total": 6,
      "attended": 5,
      "missed": 1,
      "percentage": 83.3,
      "status": "Good"
    }
  ]
}
```

### 2.2 `POST /api/attendance/student/:sessionId/attendance`
- **Role Required:** `student`
- **Description:** Submit live webcam frame for 1:1 facial biometric verification against student's enrolled vector.
- **Request Body:**
```json
{
  "liveImageData": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
  "sessionChallenge": "ch_7a8f9b2c3d4e",
  "qrChallengeToken": "optional_qr_token_if_required"
}
```
- **Response `200 OK` (Verified):**
```json
{
  "success": true,
  "status": "present",
  "verificationMethod": "face",
  "confidence": 0.92,
  "message": "Attendance successfully verified and recorded 🚀",
  "recordId": "672401a0e10b42f4c9a83001"
}
```
- **Response `400 Bad Request` (Quality / Single Face Failure):**
```json
{
  "success": false,
  "status": "NO_FACE_DETECTED",
  "message": "No face detected in the frame. Please look directly at the camera under good lighting."
}
```
- **Response `409 Conflict` (Duplicate Attendance Attempt):**
```json
{
  "success": false,
  "status": "DUPLICATE_ATTENDANCE",
  "message": "Attendance has already been recorded for this class session."
}
```

### 2.3 `POST /api/student/face/enroll`
- **Role Required:** `student`
- **Description:** Submits consent and face samples to enroll biometric template.
- **Request Body:**
```json
{
  "imageData": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...",
  "consentGiven": true,
  "consentVersion": "v1.0"
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "enrollmentStatus": "enrolled",
  "imageQualityScore": 89.2,
  "samplesCaptured": 1,
  "message": "Face biometrics registered successfully."
}
```

### 2.4 `POST /api/student/face/revoke`
- **Role Required:** `student`
- **Description:** Revokes biometric consent and immediately purges encrypted template from database.
- **Response `200 OK`:**
```json
{
  "success": true,
  "enrollmentStatus": "not_enrolled",
  "message": "Biometric consent revoked and facial templates permanently deleted."
}
```

---

## 3. Faculty Attendance API Endpoints

### 3.1 `POST /api/attendance/sessions`
- **Role Required:** `faculty`, `admin`
- **Description:** Creates and opens a new live attendance session.
- **Request Body:**
```json
{
  "subjectId": "672401a0e10b42f4c9a82001",
  "date": "2026-11-01",
  "period": 1,
  "startTime": "09:00 AM",
  "endTime": "10:00 AM",
  "sessionType": "regular",
  "attendanceMethod": "face",
  "branch": "CSE",
  "semester": 5,
  "section": "A"
}
```
- **Response `201 Created`:**
```json
{
  "success": true,
  "data": {
    "_id": "672401a0e10b42f4c9a81001",
    "subject": "CS501",
    "period": 1,
    "status": "open",
    "qrChallengeToken": "A9X2B7"
  },
  "message": "Attendance session opened successfully."
}
```

### 3.2 `GET /api/attendance/sessions/:sessionId/qr-challenge`
- **Role Required:** `faculty`, `admin`
- **Description:** Returns the active rotating QR challenge token (refreshed every 30s).
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "token": "A9X2B7",
    "expiresAt": "2026-11-01T09:15:30.000Z",
    "refreshIntervalSeconds": 30
  }
}
```

### 3.3 `GET /api/attendance/faculty/sessions/:sessionId/students`
- **Role Required:** `faculty`, `admin`
- **Description:** Live roster status polling endpoint for `LiveAttendance.jsx`.
- **Response `200 OK`:**
```json
{
  "success": true,
  "stats": {
    "totalStudents": 8,
    "present": 6,
    "pending": 2,
    "absent": 0,
    "needsReview": 0
  },
  "roster": [
    {
      "studentId": "672401a0e10b42f4c9a84001",
      "rollNumber": "20240001",
      "fullName": "Arjun Sharma",
      "status": "present",
      "verificationMethod": "face",
      "confidence": 0.94,
      "markedAt": "2026-11-01T09:04:12.000Z",
      "isManualOverride": false
    }
  ]
}
```

### 3.4 `PATCH /api/attendance/faculty/records/:attendanceId`
- **Role Required:** `faculty`, `admin`
- **Description:** Controlled manual override of a student's attendance record with mandatory justification.
- **Request Body:**
```json
{
  "targetStatus": "present",
  "reason": "Camera hardware failure in classroom; student presence confirmed verbally."
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Attendance status overridden successfully.",
  "record": {
    "_id": "672401a0e10b42f4c9a83001",
    "status": "present",
    "isManualOverride": true,
    "correctedAt": "2026-11-01T09:12:00.000Z"
  }
}
```

### 3.5 `POST /api/attendance/sessions/:sessionId/finalize`
- **Role Required:** `faculty`, `admin`
- **Description:** Freezes attendance session, marks remaining unverified students as `absent`, and locks records.
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Session finalized. All remaining unverified students marked absent.",
  "data": {
    "sessionId": "672401a0e10b42f4c9a81001",
    "status": "finalized",
    "totalPresent": 7,
    "totalAbsent": 1
  }
}
```

---

## 4. Admin Attendance API Endpoints

### 4.1 `GET /api/attendance/admin/overview`
- **Role Required:** `admin`
- **Description:** Institutional compliance metrics, system-wide attendance averages, and shortage counts.

### 4.2 `PUT /api/attendance/admin/settings`
- **Role Required:** `admin`
- **Description:** Updates institutional policy parameters.
- **Request Body:**
```json
{
  "minAttendancePercent": 75,
  "defaultSessionDurationMinutes": 60,
  "verificationRetryLimit": 3,
  "faceConfidenceThreshold": 0.65,
  "allowManualOverride": true,
  "biometricRetentionDays": 365
}
```

### 4.3 `DELETE /api/attendance/admin/face-profiles/:studentId`
- **Role Required:** `admin`
- **Description:** Administrative biometric template erasure (GDPR/DPDP compliance).

---

## 5. Internal Node-to-Python AI Service Contracts

*Internal interface listening on `127.0.0.1:5002`. Never exposed to public internet. Requires header `X-Internal-Key: <SECRET>`.*

### 5.1 `POST /api/ai/verification/verify`
- **Request:**
```json
{
  "encryptedEnrolledData": "gAAAAABnh...",
  "liveImageData": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "hasConsent": true,
  "customThreshold": 0.55
}
```
- **Response `200 OK` (Match):**
```json
{
  "success": true,
  "isMatch": true,
  "status": "VERIFIED",
  "confidence": 0.93,
  "euclideanDistance": 0.384,
  "cosineSimilarity": 0.942
}
```
- **Response `200 OK` (No Match):**
```json
{
  "success": true,
  "isMatch": false,
  "status": "NOT_MATCHED",
  "confidence": 0.42,
  "euclideanDistance": 0.721,
  "cosineSimilarity": 0.612
}
```

### 5.2 `POST /api/ai/enrollment/submit`
- **Request:**
```json
{
  "studentId": "20240001",
  "imageSamples": ["data:image/jpeg;base64,/9j/4AAQSkZJRg..."],
  "consentGiven": true
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "status": "ENROLLED",
  "encryptedTemplate": "gAAAAABnh...",
  "templateReference": "sha256_e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "qualityScore": 88.5,
  "samplesProcessed": 1
}
```

### 5.3 `POST /api/internal/analytics/calculate-student`
- **Request:**
```json
{
  "studentId": "672401a0e10b42f4c9a84001",
  "sessions": [...],
  "records": [...],
  "subjectsCatalog": [...],
  "countExcusedAsPresent": false
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "hasData": true,
    "overallPercentage": 84.5,
    "totalClasses": 25,
    "classesAttended": 21,
    "classesMissed": 4,
    "minimumThreshold": 75.0,
    "status": "On Track",
    "subjectWise": [...]
  }
}
```

