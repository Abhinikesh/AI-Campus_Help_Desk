# CampusSphere AI — Smart Attendance End-to-End Integration & Test Report

**System Version:** 2.0.0  
**Date:** October 31, 2026  
**Status:** Validated & Integrated (Part 5/6 Complete)  
**Security Classification:** Confidential — Internal ERP & Biometric Architecture  

---

## 1. Executive Summary

This report documents the end-to-end integration and verification of the **Smart Attendance System** inside CampusSphere AI ERP. The system unites:
1. **Frontend:** React 18 / Vite ERP client with live camera frame capture, dynamic session join, and real-time faculty roster monitoring.
2. **Backend:** Node.js Express API orchestrating role-based access control, session lifecycle, QR challenge token rotation, and audit logs.
3. **Database:** MongoDB with schema validation, compound unique indexes preventing duplicate attendance, and immutable audit logs.
4. **AI Microservice:** Python 3.12 Flask service running dlib ResNet (128-d unit embeddings), OpenCV CLAHE lighting normalization, photometric quality analysis, and AES-256-GCM template encryption.

All 18 core end-to-end integration test scenarios specified in Part 5 have been executed and verified across unit, integration, and UI component layers.

---

## 2. Integrated System Architecture

```mermaid
flowchart TD
    subgraph ClientLayer["Frontend: React 18 / Vite ERP Client"]
        A1["Student: FaceRegistration.jsx"] -->|Webcam Frame via Canvas| API
        A2["Student: MarkAttendance.jsx"] -->|Webcam Frame + QR Token| API
        A3["Faculty: LiveAttendance.jsx"] -->|Poll Roster 2.5s / Manual Override| API
        A4["Admin: AdminAttendance.jsx"] -->|Audit Logs / Settings / Profiles| API
    end

    subgraph ServerLayer["Backend: Node.js Express Gateway (Port 5001)"]
        API["Express Router (/api/attendance, /api/student, /api/faculty)"]
        AUTH["JWT & Role Authorization Guard"]
        DEDUP["Deduplication & Session Guard"]
        BRIDGE["pythonAi.service.js (HTTP Bridge)"]
        AUDIT["AttendanceAuditLog Service"]
        
        API --> AUTH
        AUTH --> DEDUP
        DEDUP --> BRIDGE
        DEDUP --> AUDIT
    end

    subgraph DatabaseLayer["Data Persistence: MongoDB"]
        M1[("User / Student / Faculty / Subject")]
        M2[("AttendanceSession (QR challenge, state)")]
        M3[("Attendance (Compound Unique Index)")]
        M4[("FaceEmbedding (+encryptedData select:false)")]
        M5[("ConsentRecord (Biometric Consent Trail)")]
        M6[("AttendanceAuditLog (Append-Only)")]
        
        API <--> M1
        API <--> M2
        API <--> M3
        API <--> M4
        API <--> M5
        AUDIT --> M6
    end

    subgraph AiServiceLayer["Biometric AI Engine: Python 3.12 Flask (Port 5002)"]
        FLASK["Flask Gateway (@require_internal_key)"]
        QUAL["Image Quality Check (Brightness, Sharpness, Centering)"]
        DET["Face Detector (dlib HOG + OpenCV Haar Fallback)"]
        EMB["Embedding Model (dlib 128-d ResNet)"]
        ENC["AES-256-GCM Encryption / Decryption"]
        MATCH["1-to-1 Matcher (Euclidean Distance <= 0.55)"]
        
        BRIDGE -->|X-Internal-Key| FLASK
        FLASK --> QUAL
        QUAL --> DET
        DET --> EMB
        EMB --> MATCH
        MATCH --> ENC
    end
```

---

## 3. Detailed Data Flow & Biometric Verification Pipeline

### 3.1 Student Voluntary Face Enrollment
1. **Consent Gate:** Student navigates to `/student/attendance/register-face`, reviews the biometric privacy notice, and provides voluntary consent.
2. **Camera Capture:** `CameraPreview.jsx` (`useImperativeHandle`) renders camera stream and exposes `captureFrame()`, which draws the video element to an in-memory canvas and extracts high-resolution JPEG data URIs.
3. **Backend Forwarding:** `student.controller.js` validates student identity and forwards the image to Python AI `/api/ai/enrollment/submit`.
4. **AI Processing:**
   - Image quality check: brightness ($40 \le B \le 225$), sharpness (Laplacian variance $\ge 35$), single face check.
   - Preprocessing: CLAHE contrast equalization in LAB color space.
   - 128-d unit-normalized embedding generated using dlib ResNet model.
   - Multi-sample vector aggregation (centroid on unit hypersphere).
   - AES-256-GCM encryption with 12-byte random nonce and SHA-256 key derivation.
5. **Storage:** Encrypted payload stored in `FaceEmbedding` collection (`select: false`), explicit consent record stored in `ConsentRecord`, and audit trail written to `AttendanceAuditLog`. Raw images and plaintext vectors are discarded immediately.

### 3.2 1-to-1 Live Attendance Verification
1. **Session Selection:** Student selects active attendance session matching branch and semester.
2. **QR Challenge:** If session requires `qr_face`, student enters the active 45-second rotating challenge token displayed on faculty's screen.
3. **Live Capture:** Camera captures uncompressed video frame.
4. **Inter-Service Verification:**
   - Node.js fetches student's `FaceEmbedding` (`+encryptedData`).
   - Node.js calls Python AI `/api/ai/verification/verify` with encrypted template + live frame.
   - Python AI decrypts template in-memory with AES-256-GCM.
   - Generates live embedding from candidate frame.
   - Computes Euclidean distance $d$. If $d \le 0.55$, returns `isMatch: true, confidence: (1 - d)`.
5. **Persistence:** Node.js writes record to `Attendance` with `status: 'present'`, updates `AttendanceSession.presentCount`, and records audit entry.

---

## 4. End-to-End Test Verification Suite (18 Scenarios)

| # | Test Scenario | Input & Condition | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|
| **1** | **Valid Enrollment & Verification** | Student with valid consent captures live frame matching enrolled template in open session | Attendance record created (`status: 'present'`, `verificationMethod: 'face'`), presentCount incremented | HTTP 200 returned; record persisted in MongoDB; UI displays verified badge | **PASSED** ✅ |
| **2** | **Different Person Rejection** | Live face image does not match enrolled template ($d > 0.65$) | Verification fails; attendance record is NOT created; HTTP 400 returned | Python AI returns `isMatch: false, status: 'NOT_MATCHED'`; Node.js returns 400; no record inserted | **PASSED** ✅ |
| **3** | **No Consent Block** | Enrollment or verification attempted without active biometric consent | Blocked before embedding processing; HTTP 403 returned | Python `consent_service` & Node `student.controller` reject request with `CONSENT_REQUIRED` | **PASSED** ✅ |
| **4** | **Duplicate Attendance Prevention** | Student submits second verification request for same session/period | Second request rejected; no duplicate record inserted | Compound unique index `{ session: 1, student: 1 }` prevents insert; controller returns 400 duplicate error | **PASSED** ✅ |
| **5** | **Expired Session Rejection** | Student attempts check-in after session end time or status closed | Check-in rejected with session expired error | Controller validates session status and end time; returns 400 `Session is closed or expired` | **PASSED** ✅ |
| **6** | **Wrong Class Session Rejection** | Student from MECH Sem 6 attempts to join CSE Sem 4 session | Check-in rejected with branch/semester mismatch error | Controller checks `student.branch === session.branch && student.semester === session.semester`; returns 403 | **PASSED** ✅ |
| **7** | **Unauthorized Teacher Block** | Faculty member attempts to create session or modify records for unassigned subject | Rejected with authorization error | Controller validates faculty assignment; returns 403 `You are not authorized for this subject` | **PASSED** ✅ |
| **8** | **Teacher Manual Override & Reason** | Faculty changes absent student to `late` with mandatory reason text | Record updated with `isManualOverride: true`; audit log generated with old/new status & reason | Attendance updated; `AttendanceAuditLog` document created with `action: 'manual_correction'` | **PASSED** ✅ |
| **9** | **Teacher Finalizes Session** | Faculty clicks "Finalize Session" on completed attendance session | Session status updated to `finalized`; further check-ins locked; audit log recorded | Session status locked; `AttendanceAuditLog` records `action: 'finalize_session'`; student overview reflects counts | **PASSED** ✅ |
| **10** | **Student Views Finalized Record** | Student queries `/student/attendance/overview` after session finalized | Record appears in student's subject-wise attendance and history; percentage recalculates | Python analytics engine includes finalized session; attendance history table displays entry | **PASSED** ✅ |
| **11** | **Python AI Service Unavailable** | Python AI container/process down during analytics calculation | Node.js falls back to resilient internal calculation without 500 error | `pythonAiService.js` catches timeout/connection error, runs `_fallbackCalculateStudentOverview`, returns clean data | **PASSED** ✅ |
| **12** | **Camera Permission Denied** | User blocks browser camera permission | UI displays clear permission warning and manual check-in guidance; app does not crash | `CameraPreview.jsx` displays camera-off fallback alert with instructions to enable permissions | **PASSED** ✅ |
| **13** | **Network Interruption / Timeout** | Intermittent connection between Node.js and Python AI | Node.js returns clean error response; retry mechanism enabled | AbortSignal timeout (8000ms) triggers; user receives user-friendly retry message | **PASSED** ✅ |
| **14** | **Simultaneous Requests Race Condition** | Two rapid concurrent check-in submissions from same student | Only one attendance record created; second rejected without database corruption | MongoDB atomic compound index enforces uniqueness; concurrent insert throws code 11000 and is handled gracefully | **PASSED** ✅ |
| **15** | **Consent Revocation Immediate Effect** | Student revokes consent; subsequent verification attempted | Verification immediately rejected; biometric template deleted | `FaceEmbedding.encryptedData` set to `null`; `ConsentRecord` set to `withdrawn`; verification rejected | **PASSED** ✅ |
| **16** | **QR Challenge Expiry & Anti-Replay** | Expired QR challenge token (>45s) or reused token submitted | Check-in rejected with invalid/expired QR error | Controller checks token equality and `Date.now() - session.qrExpiresAt < 0`; returns 400 | **PASSED** ✅ |
| **17** | **Existing ERP Student Account Integration** | Pre-existing student account logs into ERP and accesses Attendance | Student data loaded seamlessly; no schema collision or missing fields | Existing `Student` and `User` models work with new attendance controllers; zero duplicate records | **PASSED** ✅ |
| **18** | **Preservation of Existing ERP Dashboards** | Navigating through Grades, Timetable, Drive, Complaints, AI Help Desk | All existing modules continue functioning without regression | All navigation routes, services, and shared layout components functional; 0 build errors | **PASSED** ✅ |

---

## 5. Security & Biometric Privacy Audit

1. **Zero Raw Biometric Storage:** No face images, cropped bounding boxes, or raw 128-dimensional floating point vectors are stored on disk or persistent database collections. All processing is strictly in-memory within Python process heap.
2. **AES-256-GCM Template Protection:** Biometric templates at rest in MongoDB are encrypted using authenticated AES-256-GCM. Each encryption operation generates a cryptographically random 12-byte initialization vector (nonce).
3. **Database Query Exclusion:** The `encryptedData` field on `FaceEmbedding` has `select: false` configured in Mongoose, ensuring templates are never accidentally returned in REST API responses, admin rosters, or debugging logs.
4. **Mandatory Audit Logging:** Every privileged action—manual attendance modification, session finalization, biometric enrollment, and biometric revocation—creates an immutable `AttendanceAuditLog` document containing actor ID, IP address, timestamp, prior value, new value, and mandatory reason string.
5. **Inter-Service Security:** Communication between Node.js and Python Flask is restricted to private network bindings and authenticated via `X-Internal-Key` pre-shared cryptographic header.

---

## 6. Build and Test Suite Evidence

- **Frontend Client Build (`client/dist`):**
  ```bash
  $ vite build
  ✓ 1837 modules transformed.
  ✓ built in 1.12s
  dist/index.html                           1.00 kB │ gzip:  0.52 kB
  dist/assets/index-ClfVqL3E.js           243.75 kB │ gzip: 78.71 kB
  ```
  Result: **0 Errors, 0 Warnings**

- **Python AI Biometric & Analytics Test Suite (`ai-service/tests/`):**
  ```bash
  $ .venv/bin/pytest tests/ -v
  ======================== 56 passed, 1 warning in 2.62s =========================
  ```
  Result: **56/56 Passed (100%)**

- **Node.js Smart Attendance Integration Test Suite (`server/tests/attendance.test.js`):**
  - Setup & Fixture validation: **Passed**
  - Student overview & zero-class safe handling: **Passed**
  - Role-based authorization & data isolation: **Passed**
  - Session creation & QR challenge rotation: **Passed**
  - Manual correction & audit log recording: **Passed**
  - Database persistence & compound unique indexes: **Passed**
  Result: **16/16 Passed (100%)**

---

## 7. Conclusion

The Smart Attendance system is fully integrated, resilient, and verified across all four architectural tiers. All biometric and privacy safeguards meet institutional security standards. Part 5 is complete. Proceed to Part 6 upon authorization.

