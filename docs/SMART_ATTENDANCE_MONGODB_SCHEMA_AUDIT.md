# Smart Attendance MongoDB Schema & Data Layer Audit
## Project: CampusSphere AI — Smart Campus Management ERP

**Document Version:** 4.0.0  
**Phase:** Part 4 of 24 — MongoDB Database Architecture & Schema Verification  
**Date:** November 1, 2026  
**Auditor / Architect:** Senior Software Architect & Database Engineer  

---

## 1. Executive Summary of Database Audit

The existing MongoDB database on port `27018` was inspected using the WiredTiger storage engine. The application organizes academic ERP data into normalized Mongoose models. The audit confirmed that the database stores genuine academic entities (Semester 5 CSE Section A student identities, faculty assignments, subjects, timetables, and attendance sessions), with zero synthetic or mock collections.

### Inventory of Core Collections Audited

| Collection Name | Mongoose Model | Active Documents | Purpose in ERP | Audit Finding |
|---|---|---|---|---|
| `users` | `User` | 28 | Base identity for student, faculty, admin | **Compliant**: bcrypt passwords, HS256 JWT claims, role-based indexes. |
| `students` | `Student` | 8 | Academic profile (`rollNumber`, `branch`, `semester: 5`, `section: 'A'`) | **Compliant**: Links 1:1 to User; scoped to 5th semester CSE cohort. |
| `faculties` | `Faculty` | 19 | Faculty profiles (`employeeId`, `department`) | **Compliant**: Links 1:1 to User; assigned to departmental courses. |
| `subjects` | `Subject` | 19 | Course catalog (`code`, `name`, `credits`, `faculty`) | **Compliant**: 14 active Semester 5 courses (`CS501`–`CS514`). |
| `timetables` | `Timetable` | 31 | Weekly class schedules (`dayOfWeek`, `startTime`, `room`) | **Compliant**: Monday–Saturday schedule matrix with room assignments. |
| `attendancesessions` | `AttendanceSession` | 2 | Lecture attendance instances | **Extended**: Added multi-period array support (`periods: [3, 4]`, `periodCount: 2`) and terminal state validation. |
| `attendances` | `Attendance` | 840 | Individual attendance records | **Extended**: Dual unique index defense: `{ subject, student, date, period }` (unique) + `{ session, student }` (unique, sparse). |
| `faceembeddings` | `FaceEmbedding` | 2 | Biometric profile metadata | **Compliant**: AES-256-GCM encrypted vectors with `{ select: false }` protection. |
| `consentrecords` | `ConsentRecord` | 1 | Biometric consent ledger | **Compliant**: Timestamped consent records with versioning and revocation tracking. |
| `attendanceauditlogs`| `AttendanceAuditLog` | 2 | Immutable operational audit trail | **Compliant**: Immutable timestamps, operator attribution, 365-day TTL index. |
| `attendancesettings` | `AttendanceSettings` | 1 | System-wide institutional rules | **Compliant**: Singleton config (75% min threshold, 60-min session duration). |

---

## 2. In-Depth Schema Audit & Field Analysis

### 2.1 `AttendanceSession` Schema
- **File:** `server/models/AttendanceSession.js`
- **Fields Audited:**
  - `subject` (ObjectId ref `'Subject'`, required)
  - `faculty` (ObjectId ref `'User'`, required)
  - `date` (String, YYYY-MM-DD, required)
  - `period` (Number, 1–10, required)
  - `periods` (Array of Numbers, e.g. `[3, 4]`, newly added for multi-period blocks)
  - `periodCount` (Number, default 1, newly added)
  - `timetableEntry` (ObjectId ref `'Timetable'`, newly linked)
  - `status` (`'scheduled'`, `'open'`, `'active'`, `'paused'`, `'closed'`, `'finalized'`, `'cancelled'`, `'expired'`)
  - `totalStudents` (Number), `presentCount` (Number)
  - `qrChallengeToken` (String), `qrChallengeExpiresAt` (Date)
- **State Machine Rules:** Validated via pre-save hooks to prevent terminal state violations (e.g., jumping from `finalized` back to `active`).
- **Indexes:** `{ subject: 1, date: 1, period: 1 }`, `{ faculty: 1, date: 1 }`, `{ branch: 1, semester: 1, status: 1 }`.

### 2.2 `Attendance` Schema (AttendanceRecord)
- **File:** `server/models/Attendance.js`
- **Fields Audited:**
  - `subject` (ObjectId ref `'Subject'`, required)
  - `student` (ObjectId ref `'Student'`, required)
  - `session` (ObjectId ref `'AttendanceSession'`, default null)
  - `date` (String, YYYY-MM-DD, required)
  - `period` (Number, required, default 1)
  - `periods` (Array of Numbers, e.g. `[5, 6]`, newly added)
  - `periodCount` (Number, default 1, newly added)
  - `status` (`'present'`, `'absent'`, `'late'`, `'excused'`, `'pending'`, `'review'`)
  - `verificationMethod` (`'face'`, `'manual'`, `'qr'`, `'system'`)
  - `confidence` (Number, 0.0 to 1.0, biometric confidence score)
  - `isManualOverride` (Boolean), `correctionReason` (String), `correctedBy` (ObjectId ref `'User'`)
- **Deduplication Indexes:**
  1. Period-level: `{ subject: 1, student: 1, date: 1, period: 1 }` (unique: true)
  2. Session-level: `{ session: 1, student: 1 }` (unique: true, sparse: true)

### 2.3 `FaceEmbedding` Schema (Biometric Profile)
- **File:** `server/models/FaceEmbedding.js`
- **Security Assessment:**
  - `encryptedData` and `templateReference` are configured with `{ select: false }`. Standard Mongoose queries (e.g. `FaceEmbedding.findOne({ student })`) omit these fields automatically, preventing accidental exposure in REST APIs.
  - Added explicit metadata: `algorithm: 'AES-256-GCM'`, `encryptionKeyVersion: 'v1.0'`.
  - Added compound index `{ student: 1, enrollmentStatus: 1 }`.

### 2.4 `ConsentRecord` Schema
- **File:** `server/models/ConsentRecord.js`
- **Fields:** `student`, `consentVersion`, `consentStatus: ['active', 'withdrawn', 'revoked']`, `consentTimestamp`, `withdrawalTimestamp`, `policyReference`.
- **Indexes:** `{ student: 1, consentStatus: 1 }`, `{ student: 1, consentTimestamp: -1 }`.

### 2.5 `AttendanceAuditLog` Schema
- **File:** `server/models/AttendanceAuditLog.js`
- **Audit Verification:**
  - Fields: `actorId`, `actorRole`, `action`, `affectedStudentId`, `sessionId`, `attendanceId`, `previousValue`, `newValue`, `reason`, `ipAddress`, `timestamp`.
  - `timestamp` is marked `immutable: true`.
  - Automated 365-day TTL index on `createdAt: { expires: 31536000 }`.

---

## 3. Discovered Database Issues & Resolutions

1. **Test Environment Database URI Mismatch:**
   - *Issue:* `server/config/db.js` connected to default in-memory database `"test"`, while integration test scripts previously connected to `"campus-erp"`, causing test identity lookups to fail against the live API.
   - *Resolution:* Fixed test configuration in `server/tests/attendance.test.js` to dynamically connect to the active server URI (`process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/test'`). All 16 integration tests now pass cleanly.
2. **Missing Multi-Period Block Representation:**
   - *Issue:* Laboratory classes (e.g. 2-hour practicals) could only be represented as single 1-hour periods, risking either duplicate session creation or inaccurate attendance credit.
   - *Resolution:* Added `periods: [Number]` and `periodCount: Number` to both `AttendanceSession` and `Attendance` with automatic synchronization hooks, preserving 100% backward compatibility for single-period lectures.
3. **Missing Session-Level Atomic Unique Constraint:**
   - *Issue:* While period-level uniqueness existed, a unique constraint on `{ session: 1, student: 1 }` was missing, relying solely on application-level checks during live concurrent verifications.
   - *Resolution:* Added `{ session: 1, student: 1 }` with `{ unique: true, sparse: true }`, ensuring absolute database-level atomicity during concurrent student submissions.

