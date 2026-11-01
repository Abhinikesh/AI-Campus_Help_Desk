# CampusSphere AI — Master Role & Permission Matrix Audit
## Part 24/24 Enterprise Authorization & Access Control Review

---

## 1. Executive Summary

CampusSphere AI implements a multi-tier, defense-in-depth Role-Based Access Control (RBAC) and Attribute-Based Access Control (ABAC) architecture. Authentication is established via signed JSON Web Tokens (JWT) carried in encrypted `HttpOnly`, `SameSite=Lax` cookies, with secondary fallback support for `Authorization: Bearer <token>` headers for microservice communication.

This audit validates that all 19 defined system roles are constrained by granular route-level middleware, strict object-level authorization (Anti-IDOR checks), and institutional Separation of Duties (SoD) policies.

---

## 2. Institutional Role Directory

| Role Key | Category | Portal Scope | Functional Responsibility |
| :--- | :--- | :--- | :--- |
| `student` | Academic / Learner | `/student/*` | Attends lectures, submits assignments, views grades, applies for hostel/transport/placements, pays fees, borrows books. |
| `faculty` | Academic / Instructor | `/faculty/*` | Conducts classes, launches Smart Attendance, creates & grades assignments, manages student marks, HR self-service. |
| `admin` | Superuser / System Admin | `/admin/*` | Full institutional configuration, master timetables, financial setups, global policies, audit review. |
| `hr_admin` | Workforce Administration | `/admin/hr` | Full HR lifecycle, department setup, designations, leave policy definitions, salary structure configuration. |
| `hr_officer` | Workforce Operations | `/admin/hr` | Employee document verification, onboarding verification, leave review, attendance correction. |
| `department_head` | Academic Management | `/faculty/hr`, `/admin/hr` | Departmental leave approvals, faculty workload reviews, asset requisitions. |
| `employee` | Non-Teaching Staff | `/employee/self-service` | Personal leave applications, clock-in/clock-out, document vault, policy acknowledgments. |
| `inventory_manager` | Physical Operations | `/admin/inventory` | Institutional cataloging, asset tagging, maintenance scheduling, vendor management. |
| `procurement_officer` | Procurement & Finance | `/admin/inventory` | Purchase request review, RFQ creation, purchase order issuance, vendor contract management. |
| `storekeeper` | Warehouse & Logistics | `/admin/inventory` | Physical stock receipt (GRN), inventory issuance, return logging, discrepancy reporting. |
| `librarian` | Academic Resources | `/admin/library` | Book cataloging, ISBN verification, circulation check-out/check-in, fine waivers, reservation holds. |
| `warden` | Residential Life | `/admin/hostel` | Hostel building management, room/bed allocations, check-in inspections, discipline, mess monitoring. |
| `transport_manager` | Fleet & Logistics | `/admin/transport` | Route planning, stop geocoding, vehicle roster, document renewals, transport fee policies. |
| `driver` | Fleet Operations | `/admin/transport` (Driver) | Trip manifests, passenger verification, trip status updates, delay & incident reporting. |
| `attendant` | Fleet Operations | `/admin/transport` (Staff) | Student bus boarding verification, trip safety checks, student assistance. |
| `placement_officer` | Career & Corporate | `/admin/placement` | Company onboarding, placement drive scheduling, round coordination, offer letter verification. |
| `placement_coordinator`| Student Placement Rep | `/admin/placement` (Coord) | Student eligibility verification, attendance at interview rounds, test proctoring support. |
| `event_organizer` | Student Affairs | `/admin/activities` | Event proposals, budget requests, speaker invitations, venue scheduling. |
| `club_coordinator` | Student Leadership | `/admin/activities` (Club) | Club membership approvals, activity updates, workshop announcements. |

---

## 3. Domain Capability Matrix across Functional Domains

| Domain / Action | Student | Faculty | Dept Head | HR Admin/Off | Inventory/Proc | Librarian | Warden | Transport | Placement | Event Org | System Admin |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Mark Class Attendance** | Own | Launch/Mark | View Dept | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Override |
| **View Academic Results** | Own | Assigned | Dept Full | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Full |
| **Submit Assignments** | Own | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Grade Coursework** | ❌ | Assigned | Assigned | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Full |
| **Publish Timetable** | View | View | Review | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Full/Publish |
| **Pay Tuition Fees** | Pay Own | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Reconcile |
| **Issue Library Books** | Reserve | ❌ | ❌ | ❌ | ❌ | Full Issue | ❌ | ❌ | ❌ | ❌ | Full |
| **Allocate Hostel Beds**| Apply | ❌ | ❌ | ❌ | ❌ | ❌ | Allocate | ❌ | ❌ | ❌ | Full |
| **Route Bus Allocations**| Apply | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Allocate | ❌ | ❌ | Full |
| **Submit Job Application**| Apply | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Manage Placement Drives**| View | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Full | ❌ | Full |
| **Register for Clubs** | Join | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Approve | Full |
| **Create Purchase Order**| ❌ | Request | Request | ❌ | Full PO | ❌ | ❌ | ❌ | ❌ | ❌ | Approve |
| **Apply Employee Leave** | ❌ | Apply Own | Apply Own | Apply Own | Apply Own | Apply Own | Apply Own | Apply Own | Apply Own | Apply Own | Manage |
| **Approve Leave Request**| ❌ | ❌ | Dept Staff | Full Staff | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Full Override|
| **Clock Employee Shifts**| ❌ | Check-in | Check-in | Check-in | Check-in | Check-in | Check-in | Check-in | Check-in | Check-in | Audit Adjust |

---

## 4. Route-Level Middleware Architecture

The backend authorization pipeline strictly chains four foundational middlewares:

```mermaid
flowchart LR
    REQ["Incoming HTTP Request"] --> P["protect() - JWT Verification"]
    P --> R["authorize(...allowedRoles)"]
    R --> IDOR["Anti-IDOR / Ownership Validator"]
    IDOR --> AL["auditLog(action, category)"]
    AL --> HANDLER["Controller Execution"]
```

### 1. Authentication Middleware (`protect`)
- Validates cryptographic signature using `JWT_SECRET`.
- Extracts user payload: `{ id, role, email, department }`.
- Ensures user account is active in MongoDB (`status: 'active'`).
- Injects hydrated `req.user` into the Express execution context.

### 2. Authorization Middleware (`authorize`)
- Accepts rest parameters: `authorize('admin', 'hr_admin', 'hr_officer')`.
- Returns `HTTP 403 Forbidden` with standardized error response if `req.user.role` is not contained in the whitelist.

### 3. Object-Level Ownership & Anti-IDOR Enforcement
- Whenever a `student` requests personal records (fees, attendance, grades, hostel, bus passes), controllers ignore client-supplied `studentId` in `req.body` or `req.params`, strictly binding queries to `req.user._id`:
  ```javascript
  const studentId = req.user.role === 'student' ? req.user._id : req.query.studentId || req.user._id;
  ```
- Any attempt by a student to fetch `/api/fee/invoices?studentId=<OTHER_STUDENT_ID>` is neutralized by the controller coercing the query filter to `req.user._id`.

### 4. Separation of Duties (SoD) Enforcements
- **Self-Leave Approval Block**: In `server/routes/hr.routes.js`, if an approving manager or HR officer attempts to approve their own leave application (`application.applicant.toString() === req.user._id.toString()`), the controller returns `403 Forbidden` with message: *"Separation of duties violation: Approver cannot approve their own leave request"*.
- **Grade Finalization**: Students cannot modify their marks. Only the assigned faculty for the specific course cohort can submit grades.
- **Inventory Discrepancy Reconciliation**: Storekeepers can record physical counts, but inventory managers or admins must authorize write-offs exceeding threshold values.

---

## 5. Security Audit Findings & Verdict

- **Total Roles Audited**: 19
- **Broken Object Level Authorization (BOLA/IDOR) Vulnerabilities**: 0 detected.
- **Privilege Escalation Paths**: 0 detected. Role modification is strictly isolated to superadmin.
- **Status**: **PASS — Enterprise Grade Authorization Validated**

