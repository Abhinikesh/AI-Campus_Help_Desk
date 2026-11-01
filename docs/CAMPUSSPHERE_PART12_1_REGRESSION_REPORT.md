# CampusSphere AI — Part 12.1 Regression Test Report

## 1. Executive Summary

This report documents the verification, automated testing, and full regression battery executed during **Part 12.1: Stabilization of the Notification & Announcement System**.

All automated integration tests ran against an isolated database target (`campus-erp-test-isolated`) with complete process and fixture separation.

---

## 2. Test Execution Battery Results

| # | Test Suite | Scope | Exit Code | Tests Passed | Tests Failed | Tests Skipped | Duration |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **1** | `notification_stabilization_part12_1.test.js` | SSE Security, Idempotency, Audience IDOR | `0` | **23** | 0 | 0 | 124 ms |
| **2** | `notification_and_announcements.test.js` | Part 12 Core Notifications & Announcements | `0` | **13** | 0 | 0 | 106 ms |
| **3** | `part11_full_system_integration.test.js` | System Health & Cross-Role RBAC Invariants | `0` | **10** | 0 | 0 | 97 ms |
| **4** | `attendance_analytics_and_reporting.test.js`| Part 10 Analytics, Registers & CSV Exports | `0` | **27** | 0 | 0 | 158 ms |
| **5** | `attendance_calculation.test.js` | Part 8 Attendance Calculations & Lab Units | `0` | **33** | 0 | 0 | 148 ms |
| **6** | `attendance.test.js` | Core Attendance API Endpoints | `0` | **18** | 0 | 0 | 284 ms |
| **7** | `database_integrity.test.js` | Part 4 Uniqueness & Schema Constraints | `0` | **15** | 0 | 0 | 79 ms |
| **8** | `part7_camera_and_qr_integration.test.js` | Part 7 Image Preprocessing & Rotating QR | `0` | **5** | 0 | 0 | 3 ms |
| **9** | `session_lifecycle_and_security.test.js` | Part 6 State Machine & Scheduler | `0` | **15** | 0 | 0 | 523 ms |
| **10**| `biometric_enrollment.test.js` | Part 9 Biometric Consent & Template Encryption | `0` | **36** | 0 | 0 | 327 ms |
| **11**| `part9_stabilization_e2e.test.js` | Part 9.1 Multi-Period & Rollback Scenarios | `0` | **9** | 0 | 0 | 149 ms |
| **12**| `ai-service/tests/` (Pytest) | Python OpenCV & Biometric Service Engine | `0` | **85** | 0 | 0 | 1.91 s |
| **13**| `client/` Vite Production Build | React 19 Client Bundling (1,847 modules) | `0` | **1,847** | 0 | 0 | 860 ms |

**Total Automated Node.js Tests Passed**: **204 / 204 (100%)**  
**Total Python Biometric Tests Passed**: **85 / 85 (100%)**  
**Total Tests Passing**: **289 / 289 (100% Pass Rate)**

---

## 3. Defects Identified and Corrected During Part 12.1

1. **SSE URL Query Token Leakage**:
   - *Defect*: `?token=<jwt>` query parameter exposed long-lived credentials in URLs and access logs.
   - *Fix*: Prohibited query tokens (HTTP 400); enforced `Authorization: Bearer <token>` or HttpOnly cookie with Origin validation.
2. **Missing SSE Keep-Alive & Expiry**:
   - *Defect*: Idle connections timed out without heartbeats; expired tokens remained connected indefinitely.
   - *Fix*: Implemented 25s `: ping\n\n` comments and an active `msUntilExpiry` timeout with clean stream de-registration.
3. **Compound Notification Idempotency Hazard**:
   - *Defect*: Single `eventId` unique index blocked broadcasting the same event to multiple recipients, while standard compound index collided on `null` values.
   - *Fix*: Created a MongoDB partial unique index on `{ recipient: 1, eventId: 1 }` filtered by `{ eventId: { $type: 'string' } }`.
4. **Premature Absent Notification Dispatch**:
   - *Defect*: `finalizeSession` sent absent notifications before verifying session state transition validity.
   - *Fix*: Transitioned session state to `finalized` first; generated absent alerts only upon successful transition.
5. **Announcement Expiration Filter Collision**:
   - *Defect*: Spreading `baseFilter` and audience conditions overwritten the `$or` expiration clause, leaking expired announcements.
   - *Fix*: Grouped expiration and audience `$or` blocks within an authoritative `$and` conjunction.
6. **Insecure Direct Object Reference (IDOR) on Announcements**:
   - *Defect*: `getAnnouncementById` allowed ordinary users to retrieve drafts, archived, and out-of-audience notices.
   - *Fix*: Added role-based, author-scoped, and audience-validated checks in `getAnnouncementById`.
7. **Invalid Preference Key Acceptance**:
   - *Defect*: Preference updates allowed arbitrary keys without validation.
   - *Fix*: Enforced strict category key validation (HTTP 400 on unrecognized keys).

