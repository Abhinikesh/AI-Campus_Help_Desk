# CampusSphere AI — Part 23: Pre-Implementation Audit Report
## Institutional HR, Employee Records, Leave & Workforce Management Audit

**Audit Date**: November 2026  
**Auditor**: Senior Full-Stack Engineer, Node.js Backend Architect, Application Security Engineer  
**Scope**: Institutional HR, Employee Profiles, Department & Designation Management, Leave Ledger & Approvals, Employee Attendance, Work Schedules, and Document Management.

---

### 1. Existing Employee and Faculty Architecture

- **`User.js` (`server/models/User.js`)**:
  - Serves as the single source of authenticated identity (`loginId`, `email`, `passwordHash`, `role`, `isActive`).
  - Roles currently include academic, operational, and administrative staff: `faculty`, `admin`, `librarian`, `warden`, `transport_manager`, `driver`, `attendant`, `placement_officer`, `placement_coordinator`, `event_organizer`, `club_coordinator`, `inventory_manager`, `procurement_officer`, `storekeeper`.
- **`Faculty.js` (`server/models/Faculty.js`)**:
  - Contains academic faculty profile attributes: `user` (1:1 ObjectId ref User), `employeeId` (unique string), `department` (string), `designation` (string), and `phone`.
  - Academic workflows (Assignment evaluation, Exam grading, Timetable lecture scheduling) reference `Faculty` and `User`.
- **Critical Architectural Requirement (Zero Duplicate Identities)**:
  - Non-teaching staff, technicians, administrators, and drivers currently lack a unified employee record.
  - Rather than creating disjoint or duplicate user accounts, `EmployeeProfile.js` will serve as the canonical institutional HR record linked 1:1 to `User._id`. When an employee is also teaching faculty, `Faculty` and `EmployeeProfile` will share the same `user` ObjectId and `employeeId`, maintaining perfect referential integrity.

---

### 2. Existing User-Role Relationships & RBAC

- Roles are enforced via Express middleware: `authMiddleware` (validates JWT and attaches `req.user`), followed by `allowRoles(...roles)` from `role.middleware.js`.
- Frontend views enforce role access via `ProtectedRoute.jsx` with redirect maps in `ROLE_DASHBOARDS`.
- **Part 23 Role Additions**:
  - `hr_admin`: Institutional HR director with authority over policies, onboarding, workforce reports, and separation.
  - `hr_officer`: Day-to-day HR records, document verification, leave adjustments, and employee onboarding review.
  - `department_head`: Head of Department (HOD) managing departmental employee leave approvals and roster oversight.
  - `employee`: General employee self-service role for non-teaching staff.

---

### 3. Existing Attendance Infrastructure vs. Employee Attendance

- **Existing Student Attendance (`Attendance.js`, `AttendanceSession.js`)**:
  - Exclusively student-centric: captures student attendance per course, subject, timetable slot, and academic session.
  - Employs QR code challenges and facial recognition embeddings for student verification.
- **Strict Boundary Mandate**:
  - Employee attendance must be kept 100% separate from student attendance.
  - Do NOT modify `Attendance.js` or `AttendanceSession.js` for employees.
  - Implement a dedicated `EmployeeAttendance.js` collection supporting daily work check-ins/check-outs, work schedule shifts, approved leave integration (preventing false absence flags), and audited manual corrections.

---

### 4. Existing Department and Designation Structures

- Across existing models (`Faculty.js`, `Student.js`, `InventoryLocation.js`, `PurchaseRequest.js`, `PlacementOpportunity.js`), department is stored as a string or loose identifier.
- In `InventoryAudit.js`, `ref: 'Department'` was introduced.
- **Action for Part 23**:
  - Create a formal `Department.js` model (`name`, `code`, `type`, `headOfDepartment`, `isActive`).
  - Create a formal `Designation.js` model (`name`, `code`, `category`, `department`, `reportingLevel`, `isActive`) to standardize job titles and organizational hierarchy without corrupting historical records.

---

### 5. Existing Leave Functionality

- **Audit Result**: Zero leave models, services, or controllers currently exist in the repository.
- The only historical reference is the string `'on_leave'` in `TransportStaffRecord.js`.
- **Action for Part 23**:
  - Build `LeavePolicy.js` (configurable rules, entitlements, carry-forward, accrual).
  - Build `EmployeeLeaveBalance.js` & `LeaveLedgerEntry.js` (audited, double-entry style ledger preventing negative balances).
  - Build `EmployeeLeaveApplication.js` (date ranges, half-day vs full-day, attachments, multi-tier approvals with separation of duties).

---

### 6. Existing Financial or Payroll Functionality

- **Audit Result**: No employee payroll, salary disbursement, or payslip functionality exists in CampusSphere AI.
- The existing finance module (`Fee.js`, `FeeInvoice.js`, `PaymentTransaction.js`) handles student tuition fees, library fines, hostel accommodation fees, and transport passes.
- **Action for Part 23**:
  - Respect the strict payroll boundary: do NOT fabricate mock payslips or distort student fee tables for employee payroll.
  - Clearly document payroll as an external / future accounting integration point.

---

### 7. Reusable Infrastructure

- **Notification Engine (`server/services/notification.service.js`)**:
  - Reusable for leave approval alerts, onboarding updates, and HR notices.
  - Extensible with `'hr'` and `'leave'` categories in `Notification.js` and `NotificationPreference.js`.
- **Academic Calendar (`AcademicCalendarEvent.js`, `academicCalendar.service.js`)**:
  - Institutional holidays and non-instructional days are directly reusable for calculating working day intervals in leave requests.
- **File Storage (`uploads/`) & Multer**:
  - Reusable with dedicated `uploads/hr/` directory, mimetype validation, and path traversal protections.
- **Database Test Isolation Helper (`server/tests/helpers/testDatabase.js`)**:
  - Directly reusable for testing on `campus-erp-test-isolated` port 27018.

---

### 8. Missing Functionality to Implement in Part 23

1. Canonical Employee Profile & Directory (`EmployeeProfile.js`).
2. Department & Designation Catalog (`Department.js`, `Designation.js`).
3. Employment History & Administrative Audit Log (`EmploymentHistory.js`, `HRAuditLog.js`).
4. Configurable Leave Policies & Entitlements (`LeavePolicy.js`).
5. Audited Leave Balance Ledger (`EmployeeLeaveBalance.js`, `LeaveLedgerEntry.js`).
6. Multi-Tier Leave Requisitions & Approvals (`EmployeeLeaveApplication.js`).
7. Daily Employee Attendance & Correction Logging (`EmployeeAttendance.js`).
8. Work Schedules & Shifts (`EmployeeWorkSchedule.js`).
9. Employee Document Repository with Access Control (`EmployeeDocument.js`).
10. HR Targeted Announcements (`HRAnnouncement.js`).
11. Employee Training & Professional Development Records (`EmployeeTrainingRecord.js`).
12. HR Administration & Employee Self-Service Dashboards in React.
13. CWE-1236 CSV export sanitization for employee lists and leave reports.

---

### 9. Upstream Verification Status

- Part 10 (Attendance Analytics): Passing
- Part 12.1 (Notification Stabilization): Passing
- Part 13 (Assignments): Passing
- Part 14 (Exams & Marks): Passing
- Part 15 (Timetable & Calendar): Passing
- Part 16 (Fees & Finance): Passing
- Part 17 (Library Management): Passing
- Part 18 (Hostel Management): Passing
- Part 19 (Transport Management): Passing
- Part 20 (Placement Management): Passing
- Part 21 (Events & Clubs): Passing
- Part 22 (Inventory & Procurement): Passing (41/41 tests passing)
- Python AI Microservice Pytest Suite: 85/85 passing
- Client Production Build: 1876 modules compiled cleanly with 0 errors

---

### 10. Security & Data-Integrity Risks

1. **Separation of Duties**: Managers must never be allowed to approve their own leave applications (`applicant !== reviewer`).
2. **Leave Ledger Concurrency & Balance Drift**: Simultaneous leave approvals must be guarded with atomic conditional updates (`{ balance: { $gte: days } }`) to prevent negative balances or double deductions on network retries.
3. **Confidential HR Information Leakage**: Sensitive attributes (emergency contacts, disciplinary remarks, personal identity documents) must never be returned in public employee directory endpoints.
4. **CWE-1236 CSV Formula Injection**: Exported workforce lists and leave records must sanitize `=`, `+`, `-`, `@` characters.
5. **Path Traversal in Employee Document Downloads**: File retrieval must sanitize document paths using `path.basename` and verify root directory confinement.
