# Smart Attendance Database Design & Data Architecture
## Project: CampusSphere AI — Smart Campus Management Platform

**Document Version:** 3.0.0  
**Phase:** Part 3 of 24 — Complete System Architecture & Technical Design  
**Date:** November 1, 2026  
**Auditor / Architect:** Senior Software Architect, Full-Stack Engineer & Database Architect  

---

## 1. Database Overview & Technology Selection

- **Database Engine:** MongoDB 7.0+ (WiredTiger Storage Engine)
- **Object Data Modeling (ODM):** Mongoose `8.23.0`
- **Data Architecture Strategy:** Normalized relational design within MongoDB document collections. Academic entities (`User`, `Student`, `Faculty`, `Subject`, `Timetable`) are reused directly from the existing ERP to maintain absolute institutional consistency. Attendance-specific documents (`AttendanceSession`, `Attendance`, `FaceEmbedding`, `ConsentRecord`, `AttendanceSettings`, `AttendanceAuditLog`) link to core entities via strict `ObjectId` references.

---

## 2. Model Reuse & Schema Definitions

### 2.1 Reused Existing Core ERP Models

#### A. `User` Collection (`server/models/User.js`)
*Root authentication identity for all institutional actors.*
```javascript
{
  _id: ObjectId,
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  loginId: { type: String, required: true, unique: true, trim: true }, // Roll number / Employee ID
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['student', 'faculty', 'admin'], required: true },
  isActive: { type: Boolean, default: true },
  lastLoginAt: { type: Date, default: null },
  createdAt: Date,
  updatedAt: Date
}
```
- **Indexes:** `{ loginId: 1 }` (unique), `{ email: 1 }` (unique), `{ name: 'text', email: 'text', loginId: 'text' }`.

#### B. `Student` Collection (`server/models/Student.js`)
*Academic student profile linked 1:1 to User.*
```javascript
{
  _id: ObjectId,
  user: { type: ObjectId, ref: 'User', required: true, unique: true },
  rollNumber: { type: String, required: true, unique: true, trim: true },
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true },
  phone: { type: String, default: '' },
  branch: { type: String, required: true, default: 'CSE' },
  program: { type: String, default: 'B.Tech' },
  semester: { type: Number, required: true, min: 1, max: 10, default: 5 },
  section: { type: String, required: true, default: 'A' },
  admissionYear: { type: Number, default: 2024 },
  status: { type: String, enum: ['active', 'alumni', 'suspended', 'withdrawn'], default: 'active' },
  createdAt: Date,
  updatedAt: Date
}
```
- **Indexes:** `{ user: 1 }` (unique), `{ rollNumber: 1 }` (unique), `{ branch: 1, semester: 1, section: 1 }`.

#### C. `Faculty` Collection (`server/models/Faculty.js`)
*Faculty profile linked 1:1 to User.*
```javascript
{
  _id: ObjectId,
  user: { type: ObjectId, ref: 'User', required: true, unique: true },
  employeeId: { type: String, required: true, unique: true, trim: true },
  department: { type: String, default: 'Computer Science & Engineering' },
  designation: { type: String, default: 'Assistant Professor' },
  phone: { type: String, default: '' },
  createdAt: Date,
  updatedAt: Date
}
```
- **Indexes:** `{ user: 1 }` (unique), `{ employeeId: 1 }` (unique).

#### D. `Subject` Collection (`server/models/Subject.js`)
*Academic course catalog entry.*
```javascript
{
  _id: ObjectId,
  code: { type: String, required: true, unique: true, uppercase: true, trim: true }, // e.g. "CS501"
  name: { type: String, required: true, trim: true }, // e.g. "Design Analysis of Algorithms"
  credits: { type: Number, required: true, min: 0 },
  branch: { type: String, default: 'CSE' },
  semester: { type: Number, required: true, min: 1, max: 10, default: 5 },
  faculty: { type: ObjectId, ref: 'User', default: null }, // Assigned faculty member
  createdAt: Date,
  updatedAt: Date
}
```
- **Indexes:** `{ code: 1 }` (unique), `{ branch: 1, semester: 1 }`, `{ faculty: 1 }`.

#### E. `Timetable` Collection (`server/models/Timetable.js`)
*Weekly recurring timetable schedule.*
```javascript
{
  _id: ObjectId,
  subject: { type: ObjectId, ref: 'Subject', required: true },
  dayOfWeek: { type: Number, required: true, min: 0, max: 6 }, // 1 = Monday ... 6 = Saturday
  startTime: { type: String, required: true }, // "09:00 AM"
  endTime: { type: String, required: true },   // "10:00 AM"
  room: { type: String, default: 'TBA', trim: true },
  createdAt: Date,
  updatedAt: Date
}
```
- **Indexes:** `{ subject: 1, dayOfWeek: 1 }`, `{ dayOfWeek: 1, startTime: 1 }`.

---

### 2.2 Attendance & Biometric Entities

#### A. `AttendanceSession` Collection (`server/models/AttendanceSession.js`)
*A specific lecture attendance instance created by faculty.*
```javascript
{
  _id: ObjectId,
  sessionId: { type: String, unique: true, sparse: true },
  subject: { type: ObjectId, ref: 'Subject', required: true },
  faculty: { type: ObjectId, ref: 'User', required: true },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // "2026-11-01"
  period: { type: Number, required: true, min: 1, max: 10, default: 1 },
  startTime: { type: String, default: '09:00 AM' },
  endTime: { type: String, default: '10:00 AM' },
  academicYear: { type: String, default: '2026-2027' },
  sessionType: { type: String, enum: ['regular', 'makeup', 'lab', 'tutorial'], default: 'regular' },
  attendanceMethod: { type: String, enum: ['face', 'qr_face', 'manual'], default: 'face' },
  status: { 
    type: String, 
    enum: ['scheduled', 'open', 'active', 'paused', 'closed', 'finalized', 'cancelled', 'expired'], 
    default: 'open' 
  },
  branch: { type: String, required: true, default: 'CSE' },
  semester: { type: Number, required: true, default: 5 },
  section: { type: String, required: true, default: 'A' },
  openedAt: { type: Date, default: Date.now },
  closedAt: { type: Date, default: null },
  finalizedAt: { type: Date, default: null },
  totalStudents: { type: Number, default: 0 },
  presentCount: { type: Number, default: 0 },
  qrChallengeToken: { type: String, default: null },
  qrChallengeExpiresAt: { type: Date, default: null },
  createdAt: Date,
  updatedAt: Date
}
```
- **Indexes:**
  - `{ subject: 1, date: 1, period: 1 }` (Index for duplicate session prevention)
  - `{ branch: 1, semester: 1, section: 1, status: 1 }` (Compound index for student active session discovery)
  - `{ faculty: 1, date: 1 }` (Index for faculty session listing)

#### B. `Attendance` Collection (`server/models/Attendance.js`)
*Individual student attendance record for a specific subject class period.*
```javascript
{
  _id: ObjectId,
  attendanceId: { type: String, sparse: true },
  subject: { type: ObjectId, ref: 'Subject', required: true },
  student: { type: ObjectId, ref: 'Student', required: true },
  session: { type: ObjectId, ref: 'AttendanceSession', default: null },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  period: { type: Number, required: true, min: 1, default: 1 },
  status: { 
    type: String, 
    enum: ['present', 'absent', 'late', 'excused', 'pending', 'review'], 
    required: true, 
    default: 'absent' 
  },
  verificationMethod: { type: String, enum: ['face', 'manual', 'qr', 'system'], default: 'manual' },
  verificationStatus: { type: String, enum: ['verified', 'manual', 'pending_review', 'rejected'], default: 'verified' },
  confidence: { type: Number, default: null, min: 0, max: 1 }, // Biometric confidence (e.g. 0.92)
  markedAt: { type: Date, default: Date.now },
  verifiedAt: { type: Date, default: Date.now },
  isManualOverride: { type: Boolean, default: false },
  correctedAt: { type: Date, default: null },
  correctedBy: { type: ObjectId, ref: 'User', default: null },
  correctionReason: { type: String, default: '' },
  markedBy: { type: ObjectId, ref: 'User', default: null },
  createdAt: Date,
  updatedAt: Date
}
```
- **Indexes:**
  - **PRIMARY UNIQUE CONSTRAINT:** `{ subject: 1, student: 1, date: 1, period: 1 }` (unique: true)
  - `{ session: 1, student: 1 }` (Unique query lookup per session)
  - `{ student: 1, status: 1 }` (Aggregate calculation index)
  - `{ session: 1, status: 1 }` (Live console aggregation index)

#### C. `FaceEmbedding` Collection (`server/models/FaceEmbedding.js`)
*Secure biometric profile metadata and encrypted feature vector.*
```javascript
{
  _id: ObjectId,
  student: { type: ObjectId, ref: 'Student', required: true, unique: true },
  enrollmentStatus: { type: String, enum: ['not_enrolled', 'enrolled', 'revoked'], default: 'not_enrolled' },
  consentStatus: { type: String, enum: ['active', 'withdrawn', 'none'], default: 'none' },
  consentGiven: { type: Boolean, default: false },
  consentVersion: { type: String, default: 'v1.0' },
  consentTimestamp: { type: Date, default: null },
  enrolledAt: { type: Date, default: null },
  isActive: { type: Boolean, default: false },
  templateReference: { type: String, select: false }, // SHA-256 fingerprint (select: false)
  encryptedData: { type: String, select: false },     // AES-256-GCM encrypted vector ciphertext (select: false)
  samplesCaptured: { type: Number, default: 0 },
  imageQualityScore: { type: Number, default: null }, // e.g. 88.5
  deletionRequestedAt: { type: Date, default: null },
  deletionCompletedAt: { type: Date, default: null },
  enrolledBy: { type: String, enum: ['self', 'admin'], default: 'self' },
  createdAt: Date,
  updatedAt: Date
}
```
- **Indexes:** `{ student: 1 }` (unique: true), `{ enrollmentStatus: 1 }`.
- **Security Rule:** `encryptedData` and `templateReference` have `{ select: false }` enabled, ensuring they are NEVER returned in REST API queries unless explicitly requested with `.select('+encryptedData')` inside the trusted Node-to-Python bridge.

#### D. `ConsentRecord` Collection (`server/models/ConsentRecord.js`)
*Immutable legal ledger for biometric consent history.*
```javascript
{
  _id: ObjectId,
  student: { type: ObjectId, ref: 'Student', required: true },
  consentVersion: { type: String, default: 'v1.0', required: true },
  consentStatus: { type: String, enum: ['active', 'withdrawn', 'revoked'], default: 'active', required: true },
  consentTimestamp: { type: Date, default: Date.now, required: true },
  withdrawalTimestamp: { type: Date, default: null },
  policyReference: { type: String, default: 'CAMPUS-BIO-PRIVACY-v1.0' },
  ipAddress: { type: String, default: '' },
  createdAt: Date,
  updatedAt: Date
}
```
- **Indexes:** `{ student: 1, consentStatus: 1 }`, `{ consentTimestamp: 1 }`.

#### E. `AttendanceSettings` Collection (`server/models/AttendanceSettings.js`)
*Singleton configuration for institutional attendance policies.*
```javascript
{
  _id: ObjectId,
  minAttendancePercent: { type: Number, default: 75, min: 0, max: 100 },
  defaultSessionDurationMinutes: { type: Number, default: 60, min: 15, max: 180 },
  verificationRetryLimit: { type: Number, default: 3, min: 1, max: 10 },
  faceConfidenceThreshold: { type: Number, default: 0.65, min: 0.4, max: 0.95 },
  allowManualOverride: { type: Boolean, default: true },
  biometricRetentionDays: { type: Number, default: 365 },
  createdAt: Date,
  updatedAt: Date
}
```

#### F. `AttendanceAuditLog` Collection (`server/models/AttendanceAuditLog.js`)
*Append-only immutable record of all attendance modifications.*
```javascript
{
  _id: ObjectId,
  action: { 
    type: String, 
    enum: [
      'session_created', 'session_started', 'session_closed', 'session_finalized', 'session_cancelled',
      'student_verified', 'manual_override', 'record_corrected',
      'face_enrolled', 'face_revoked', 'face_purged', 'settings_updated'
    ], 
    required: true 
  },
  operator: { type: ObjectId, ref: 'User', required: true },
  operatorRole: { type: String, required: true },
  targetStudent: { type: ObjectId, ref: 'Student', default: null },
  targetSession: { type: ObjectId, ref: 'AttendanceSession', default: null },
  targetRecord: { type: ObjectId, ref: 'Attendance', default: null },
  previousStatus: { type: String, default: null },
  newStatus: { type: String, default: null },
  reason: { type: String, default: '' },
  ipAddress: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now, expires: 31536000 } // Retained for 1 year
}
```
- **Indexes:** `{ action: 1, createdAt: -1 }`, `{ operator: 1 }`, `{ targetSession: 1 }`, `{ targetStudent: 1 }`.

---

## 3. Data Integrity & Concurrency Protections

1. **Composite Unique Index Guarantee:**
   The unique index `{ subject: 1, student: 1, date: 1, period: 1 }` guarantees that even under extreme network race conditions (e.g., student double-clicking submit or using concurrent tabs), the MongoDB WiredTiger engine rejects the duplicate write with duplicate key error `E11000`.
2. **Atomic Session Finalization:**
   When finalization executes, a bulk write upserts unverified students to `status: 'absent'`. The session status is atomically updated using `{ status: { $ne: 'finalized' } }` in the query condition to guarantee that finalization cannot run twice.
3. **Data Retention & Purge Rules:**
   - Attendance records (`Attendance`): Retained permanently for academic transcript integrity.
   - Audit logs (`AttendanceAuditLog`): Automatically pruned after 365 days via MongoDB TTL index.
   - Biometric embeddings (`FaceEmbedding`): Purged upon student revocation or after 365 days of inactivity.

