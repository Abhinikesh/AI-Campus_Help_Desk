# CampusSphere AI — Part 21: Existing Campus Events & Student Activities Audit

## 1. Executive Summary

This pre-implementation audit inspects the current repository state of **CampusSphere AI** prior to engineering **Part 21: Campus Events, Clubs, Workshops & Student Activities Management**.

The audit confirms the operational integrity of previous modules (Parts 10 through 20), evaluates existing calendar, notification, and profile capabilities, identifies architectural reusable assets, and specifies the domain boundaries required for Part 21.

---

## 2. Upstream Verification & Previous Part Status

All prior ERP phases were audited and verified using automated test suites targeting the isolated MongoDB database (`campus-erp-test-isolated`):

| Subsystem / Phase | Test Suite | Tests Run | Result | Notes |
|---|---|:---:|:---:|---|
| **Part 20: Placement & Career System** | `server/tests/placement_management.test.js` | 37 | **PASS** | 0 failures, 100% pass |
| **Part 19: Transport Management** | `server/tests/transport_management.test.js` | 43 | **PASS** | 0 failures, 100% pass |
| **Part 18: Hostel Management** | `server/tests/hostel_management.test.js` | 39 | **PASS** | 0 failures, 100% pass |
| **Part 17: Library Management** | `server/tests/library_management.test.js` | 36 | **PASS** | 0 failures, 100% pass |
| **Part 16: Fee & Finance Management** | `server/tests/fee_finance_management.test.js` | 38 | **PASS** | 0 failures, 100% pass |
| **Part 15: Timetable & Calendar** | `server/tests/academic_calendar_timetable.test.js` | 30 | **PASS** | 0 failures, 100% pass |
| **Part 14: Examination Management** | `server/tests/examination_management.test.js` | 28 | **PASS** | 0 failures, 100% pass |
| **Part 13: Assignment Management** | `server/tests/assignment_management.test.js` | 23 | **PASS** | 0 failures, 100% pass |
| **Part 12.1: Notification Stabilization** | `server/tests/notification_stabilization_part12_1.test.js` | 23 | **PASS** | 0 failures, 100% pass |
| **Part 10: Smart Attendance Analytics** | `server/tests/attendance_analytics_and_reporting.test.js` | 27 | **PASS** | 0 failures, 100% pass |
| **Python AI Microservice** | `ai-service/tests/` | 85 | **PASS** | 0 failures, 100% pass |
| **Client Production Build** | Vite 8 + React 19 (`npm run build`) | 1870 modules | **PASS** | 0 errors, 0 warnings |

---

## 3. Existing Event & Activity Functionality Discovered

A comprehensive repository search for `event`, `club`, `activity`, `workshop`, `seminar`, `fest`, `competition`, `registration`, and `certificate` revealed:

1. **Academic Calendar Events (`server/models/AcademicCalendarEvent.js`):**
   - Implemented in Part 15 for college-wide scheduling.
   - Already provides `eventType` enums: `'college_event'`, `'workshop_seminar'`.
   - Supports range indexing (`{ academicYear: 1, startDate: 1, endDate: 1, status: 1 }`), department/semester scoping, and `linkedEntityType` (`['Exam', 'Assignment', 'None']`).
   - **Finding:** We should extend `linkedEntityType` to support `'CampusEvent'` to enable bidirectional synchronization between approved campus events and the institutional academic calendar.

2. **Absence of Dedicated Event & Club Models:**
   - No dedicated schemas exist for campus events, event approval workflows, student clubs, club memberships, event registrations, waitlists, venue bookings, event-specific attendance, or participation certificates.
   - **Finding:** Clean slate for Part 21 without conflicting legacy models or deprecated database tables.

3. **Centralized Notification Engine (`server/services/notification.service.js`):**
   - Robust SSE dispatch and in-app database persistence (`Notification.js`, `NotificationPreference.js`).
   - Supports categories including `academic`, `administrative`, `hostel`, `transport`, `placement`.
   - **Finding:** Easily extended with category `'event'` to support event submission alerts, approval notices, waitlist promotion broadcasts, and certificate issuance pings.

4. **User & Identity Model (`server/models/User.js`):**
   - Role-based access control with `allowRoles` middleware.
   - Existing roles include: `student`, `faculty`, `admin`, `librarian`, `warden`, `transport_manager`, `driver`, `attendant`, `placement_officer`, `placement_coordinator`.
   - **Finding:** Extend `role` enum with `'event_organizer'` and `'club_coordinator'` to support dedicated organizational accounts while preserving full administrative and faculty management capabilities.

5. **Grievance Management (`server/models/Complaint.js`):**
   - Supports categories `['academic', 'admin', 'hostel', 'transport', 'placement', 'infrastructure', 'other']`.
   - **Finding:** Add `'event'` category enum with optional `event` reference for campus activity grievances.

6. **File Storage Infrastructure:**
   - Multer is actively utilized for local disk storage with extension/MIME verification in `drive.controller.js`, `assignmentStorage.service.js`, and `placement.service.js`.
   - **Finding:** Reuse standard crypto-random disk storage for event posters, banners, attachments, and club logos.

---

## 4. Reusable Infrastructure

| Component | File Path | Reuse Strategy in Part 21 |
|---|---|---|
| **Calendar Event Sync** | `server/models/AcademicCalendarEvent.js` | Synchronize approved public/department events to calendar |
| **Notification Engine** | `server/services/notification.service.js` | Real-time SSE and in-app notifications (`category: 'event'`) |
| **Role-Based Access** | `server/middleware/role.middleware.js` | `allowRoles('admin', 'faculty', 'event_organizer', 'club_coordinator', 'student')` |
| **Student Profiles** | `server/models/Student.js` | Eligibility validation against branch, semester, admission year, batch |
| **Faculty Profiles** | `server/models/Faculty.js` | Faculty advisor assignment and coordinator routing |
| **Audit Trail Standard** | `PlacementAuditLog.js` pattern | Immutable event and club administrative audit trail (`EventAuditLog.js`) |
| **Formula Sanitization** | `placement.service.js` pattern | CWE-1236 spreadsheet defense across all CSV export endpoints |

---

## 5. Missing Features to be Built in Part 21

1. **Campus Event Directory & Lifecycle (`CampusEvent.js`):**
   - Full event metadata (title, unique code, category, organizer, faculty/student coordinators, start/end dates, registration windows, max capacity, eligibility rules, target audience, banner, status).
   - Complete status state machine: `draft` -> `pending_approval` -> `approved` -> `published` -> `registration_open` -> `registration_closed` -> `ongoing` -> `completed` -> `cancelled` -> `archived`.
2. **Configurable Event Approval Workflow (`EventApproval.js` / Event History):**
   - Tiered approval pipeline: Organizer submission -> Faculty coordinator review -> Department/Campus authority sign-off -> Publication.
   - Mandatory rejection rationale recording and complete approval audit trail.
3. **Student Club Management Directory (`StudentClub.js`):**
   - Club profiles, categories, faculty advisor, student president, active member counters, capacity, meeting schedules, club logo.
4. **Controlled Club Membership Workflow (`ClubMembership.js`):**
   - Multi-state workflow: `submitted` -> `under_review` -> `approved` -> `rejected` -> `waitlisted` -> `withdrawn` -> `expired`.
   - Capacity safeguards, duplicate prevention, and coordinator/advisor scoping.
5. **Event Registration & Concurrency-Safe Waitlisting (`EventRegistration.js`):**
   - Individual student registrations with backend eligibility verification.
   - Atomic participant count increments (`allocatedParticipantsCount`) with zero overselling.
   - Deterministic waitlist queuing (`waitlistNumber`) with automatic promotion upon confirmed cancellations.
6. **Event Venue & Conflict Prevention (`EventVenue.js`, `EventVenueBooking.js`):**
   - Resource directory (auditoriums, seminar halls, labs, grounds) with seating capacities and facilities.
   - Concurrency-safe overlap detection preventing double-booking of physical spaces.
7. **Event-Specific Attendance (`EventAttendance.js`):**
   - Distinct and completely decoupled from official academic course attendance (`Mark.js` / `AttendanceSession.js`).
   - Manual marking, correction history with mandatory reasons, and attendance summaries.
8. **Verifiable Participation Certificate System (`EventCertificate.js`):**
   - Unique certificate numbers (`CERT-YYYY-XXXXX`), secure download, and public verification endpoint (`/api/certificates/verify/:certificateId`).
   - Anti-IDOR protections ensuring privacy of student records.
9. **Event Announcements & Feedback (`EventAnnouncement.js`, `EventFeedback.js`):**
   - Targeted broadcasts (college, department, club, registered attendees).
   - Post-event attendee feedback ratings and feedback privacy protection.
10. **Modern Portals:**
    - Student Activities Portal (`/student/activities`): Discovery, live eligibility, 1-click registration, waitlist status, club memberships, certificates.
    - Admin/Organizer Activities Desk (`/admin/activities`): Analytics, approvals, club governance, venue bookings, attendance, certificate issuance, and formula-safe CSV exports.

---

## 6. Security and Data Integrity Considerations

1. **Academic Attendance Isolation:** Event attendance must **never** mutate official academic course attendance or exam attendance records.
2. **Concurrency on Final Available Seat:** Enforce MongoDB atomic updates (`$inc: { allocatedParticipants: 1 }` conditioned on `$lt: maxCapacity`) to eliminate race condition overselling during high-demand registrations.
3. **Deterministic Waitlist Promotion:** Promote the lowest `waitlistNumber` atomically when a confirmed attendee cancels.
4. **Venue Collision Prevention:** Disallow multiple confirmed venue bookings overlapping within `[startTime, endTime]`.
5. **Anti-IDOR:** Students cannot access other students' private registrations, attendance, membership submissions, or certificates.
6. **Anti-Path Traversal:** File downloads (posters, certificates) must resolve through strict base directory boundary checks.
7. **CWE-1236 Defense:** Neutralize dangerous formula characters (`=`, `+`, `-`, `@`, `\t`, `\r`) in participant and attendance CSV exports.

---

## 7. Conclusion

The ERP infrastructure is stable and fully prepared for Part 21. Proceeding to Phase B & C: Shared Model Extensions & Domain Model Architecture.
