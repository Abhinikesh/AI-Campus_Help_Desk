# Smart Attendance Biometric Deletion & Data Retention Policy
## Project: CampusSphere AI — Smart Campus Management ERP

**Document Version:** 1.0.0  
**Phase:** Part 9 of 24 — Biometric Enrollment, Consent Management & Student Face Registration Reliability  
**Date:** November 1, 2026  
**Auditor / Policy Author:** Senior Data Protection Specialist & Backend Architect  

---

## 1. Purpose & Scope

This policy governs the cryptographic purging, revocation, and lifecycle termination of facial biometric templates in the CampusSphere AI ERP. It defines the technical procedures for:
1. Student-initiated self-service consent withdrawal.
2. Administrator individual template purge.
3. Administrator cohort/bulk purge.
4. Permanent preservation of historical academic attendance records.

---

## 2. Cryptographic Purge Protocol

When a biometric template is revoked or purged, CampusSphere AI executes a **Cryptographic Purge**. This guarantees that no biometric ciphertext remains in the operational database.

### 2.1 Technical Purge Sequence
Upon receipt of a valid revocation or purge request:
1. `encryptedData` is set to `null`.
2. `templateReference` is set to `null`.
3. `isActive` is set to `false`.
4. `status` transitions to `'revoked'` (for student-initiated) or `'deleted'` (for admin purge).
5. `enrollmentStatus` transitions to `'consent_withdrawn'` or `'deleted'`.
6. Associated `ConsentRecord` is marked `consentStatus = 'withdrawn'`.
7. An immutable audit record is committed to `AttendanceAuditLog`.

```javascript
// Example Server Purge Implementation
await FaceEmbedding.updateOne(
  { student: studentId },
  {
    $set: {
      encryptedData: null,
      templateReference: null,
      isActive: false,
      status: 'deleted',
      enrollmentStatus: 'deleted',
      consentStatus: 'withdrawn',
      revokedAt: new Date()
    }
  }
);
```

Once executed, future biometric verification is impossible. The student cannot check into sessions using facial recognition unless a completely fresh consent and registration lifecycle is completed.

### 2.2 Backup Retention & Physical Erasure Limitations

> [!WARNING]
> **Operational Boundary: Active Collections vs. Disaster-Recovery Backups**
>
> Setting `encryptedData: null` in MongoDB guarantees that biometric ciphertext is permanently purged from **active operational collections** and that future verification attempts cannot access the template.
>
> However, **this does not physically overwrite or sanitize historical database dumps, journal files (WAL), or offline disaster-recovery backup snapshots** created prior to the purge request. In typical institutional deployments, point-in-time recovery archives retain data until overwritten by backup retention schedules (typically 14 to 30 days). Institutions must implement automated backup lifecycle expiration policies to ensure complete lifecycle retirement.

---

## 3. Strict Preservation of Historical Academic Attendance Records

> [!IMPORTANT]
> **Academic Integrity Mandate: Biometric Purge Does NOT Delete Attendance History**
>
> In university ERP systems, verified classroom attendance records (`Attendance` collection in MongoDB) constitute permanent academic credentials. They are required for semester grade calculation, minimum attendance eligibility verification (e.g., 75% rule), and accreditation auditing by regulatory boards.
>
> Therefore, **purging a student's biometric template NEVER deletes, modifies, or recalculates their past attendance records.**

### 3.1 Data Separation Architecture

| Entity | Collection | Fate Upon Biometric Purge | Justification |
|---|---|---|---|
| **Biometric Ciphertext** | `FaceEmbedding` | **Nullified / Purged** (`encryptedData: null`) | Data minimization; sensitive biometric data must not persist without active consent. |
| **Consent Record** | `ConsentRecord` | **Preserved as Withdrawn** (`status: 'withdrawn'`) | Required as historical proof that consent existed when prior sessions were recorded. |
| **Audit Logs** | `AttendanceAuditLog` | **Appended Immutably** | Legal non-repudiation and traceability of the purge event. |
| **Past Attendance Marks** | `Attendance` | **Preserved Intact** (`status: 'present'`, etc.) | Academic transcript and grade audit validity. Past sessions were legitimately attended and verified. |

---

## 4. Student Self-Service Withdrawal vs. Administrative Purge

### 4.1 Student Self-Service Revocation (`POST /api/student/face/revoke`)
- **Trigger:** Student clicks "Revoke Consent & Delete Face Profile" in the Student Portal.
- **Scope:** Student's own template only.
- **Authorization:** Enforced by JWT (`req.user._id`).
- **Audit Action:** Logs `consent_withdrawn` and `revoke_biometric` with `actor: studentId, targetStudent: studentId`.
- **Alternative:** Student is immediately notified that future attendance must be recorded manually by faculty.

### 4.2 Administrator Individual Purge (`DELETE /api/admin/attendance/face-enrollments/:studentId`)
- **Trigger:** Student transfers, leaves college, or requests formal GDPR/DPDP right-to-erasure.
- **Scope:** Specified student ID.
- **Authorization:** Admin role required (`req.user.role === 'admin'`).
- **Mandatory Field:** `reason` (non-empty string explaining administrative justification).
- **Audit Action:** Logs `admin_purge_biometric` with `actor: adminId, targetStudent: studentId, reason`.

### 4.3 Administrator Bulk Purge (`POST /api/admin/attendance/face-enrollments/purge-bulk`)
- **Trigger:** Graduating batch completion or end-of-program cohort cleanup.
- **Scope:** Array of student IDs (`studentIds: [...]`).
- **Safeguard:** Requires `confirm: true` in request body.
- **Audit Action:** Logs single comprehensive audit entry with `affectedCount: studentIds.length, reason: reason`.

---

## 5. Audit Logging Specifications for Purge Events

All purge operations write an immutable entry to `AttendanceAuditLog` with one of the following standardized actions:

| Action | Actor | Context Captured |
|---|---|---|
| `consent_withdrawn` | Student | Target student, timestamp, IP/User-Agent. |
| `revoke_biometric` | Student | Target student, previous status, timestamp. |
| `admin_purge_biometric` | Admin | Admin ID, target student(s), affected scope count, mandatory reason. |
| `delete_biometric` | System / Admin | Target student, deletion timestamp. |
| `deletion_failed` | System | Target student, error message, stack trace summary. |

Audit records are append-only; MongoDB write permissions for `AttendanceAuditLog` prohibit update and delete operations.

---

## 6. Retention Guidelines & Institutional Decisions Required

While CampusSphere AI provides the technical mechanism for instantaneous cryptographic purging, the institution must formalize the following policy rules:

1. **Alumni Retention Schedule:** Define whether biometric templates for graduating students are purged immediately upon the end of semester exams, on convocation day, or after a 30-day grace period.
2. **Transfer / Dropout Purge Automation:** Define whether an admin status change (e.g., student marked "Withdrawn" or "Expelled" in ERP) should automatically trigger a biometric template purge via background job.
3. **Backup Sanitization:** Define institutional protocol regarding database backup retention (e.g., automated deletion of backup archives older than 30 days so purged templates do not linger in legacy backup snapshots).

