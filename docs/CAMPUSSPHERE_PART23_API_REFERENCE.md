# CampusSphere AI — Part 23/24 API Reference
## RESTful Endpoints for Institutional HR, Leaves, Attendance & Documents

---

## 1. Authentication & Base URL
- **Base URL**: `/api/hr`
- **Authentication**: JWT Bearer token in `Authorization` header (`Bearer <token>`) or `campus_token` HTTP-only cookie.
- **Allowed Roles**: `admin`, `hr_admin`, `hr_officer`, `department_head`, `faculty`, `employee`.
- **Blocked Roles**: `student` (`HTTP 403 Forbidden`).

---

## 2. Department & Designation Endpoints

### `GET /api/hr/departments`
Lists academic and administrative departments.
- **Query Params**: `type` (optional), `isActive` (optional)
- **Response**: `200 OK` `{ success: true, count: 5, data: [...] }`

### `POST /api/hr/departments`
Creates a department.
- **Roles**: `admin`, `hr_admin`
- **Body**: `{ name: string, code: string, type: string, description?: string, headOfDepartment?: ObjectId }`
- **Response**: `201 Created`

### `GET /api/hr/designations`
Lists designations filtered by department or category.
- **Query Params**: `department` (optional), `category` (optional)
- **Response**: `200 OK`

### `POST /api/hr/designations`
Creates a job designation.
- **Roles**: `admin`, `hr_admin`
- **Body**: `{ title: string, code: string, category: string, department?: ObjectId, reportingLevel?: number }`
- **Response**: `201 Created`

---

## 3. Employee Directory & Profiles

### `GET /api/hr/employees`
Lists employees with pagination, search, and filtering.
- **Roles**: `admin`, `hr_admin`, `hr_officer`, `department_head`
- **Query Params**: `search`, `department`, `designation`, `category`, `employmentStatus`, `page`, `limit`
- **Response**: `200 OK` `{ success: true, data: [...], total: 120, totalPages: 3 }`

### `GET /api/hr/employees/me`
Retrieves authenticated user's linked employee profile.
- **Roles**: `faculty`, `employee`, `admin`, `hr_admin`, `hr_officer`
- **Response**: `200 OK` `{ success: true, data: EmployeeProfile }`

### `POST /api/hr/employees`
Onboards an employee.
- **Roles**: `admin`, `hr_admin`, `hr_officer`
- **Body**:
  ```json
  {
    "user": "optional User ObjectId (links existing faculty)",
    "firstName": "Jane",
    "lastName": "Hopper",
    "officialEmail": "jane.hopper@campussphere.edu",
    "employeeCategory": "teaching_faculty",
    "department": "ObjectId",
    "designation": "ObjectId",
    "joiningDate": "2026-01-15",
    "employmentType": "permanent",
    "employmentStatus": "active"
  }
  ```
- **Response**: `201 Created`

### `PATCH /api/hr/employees/:id/verify-onboarding`
Verifies employee onboarding credentials.
- **Roles**: `admin`, `hr_admin`, `hr_officer`
- **Response**: `200 OK`

### `PATCH /api/hr/employees/:id/confirm-probation`
Confirms employee probation.
- **Roles**: `admin`, `hr_admin`, `hr_officer`
- **Body**: `{ reason?: string }`
- **Response**: `200 OK`

### `PATCH /api/hr/employees/:id/transfer`
Transfers department or promotes designation.
- **Roles**: `admin`, `hr_admin`, `hr_officer`
- **Body**: `{ newDepartment?: ObjectId, newDesignation?: ObjectId, reason: string }`
- **Response**: `200 OK`

### `PATCH /api/hr/employees/:id/separate`
Processes employee resignation or termination.
- **Roles**: `admin`, `hr_admin`, `hr_officer`
- **Body**: `{ separationType: "resigned"|"retired"|"terminated", reason: string }`
- **Response**: `200 OK`

---

## 4. Leave Policies & Balances

### `GET /api/hr/leave-policies`
Lists active leave policies.
- **Response**: `200 OK`

### `POST /api/hr/leave-policies`
Creates a leave policy.
- **Roles**: `admin`, `hr_admin`
- **Body**: `{ name, code, annualEntitlement, maxConsecutiveDays, minNoticeDays, allowNegativeBalance }`
- **Response**: `201 Created`

### `GET /api/hr/leaves/my-balances`
Retrieves employee's own leave balances.
- **Response**: `200 OK` `{ year: 2026, count: 3, data: [...] }`

### `POST /api/hr/leaves/adjust-balance`
Administrative balance correction with ledger tracking.
- **Roles**: `admin`, `hr_admin`
- **Body**: `{ employeeId, policyId, year, adjustmentDays, reason }`
- **Response**: `200 OK`

---

## 5. Leave Applications & Workflow

### `POST /api/hr/leaves/apply`
Submits leave application.
- **Body**: `{ policy: ObjectId, startDate: Date, endDate: Date, isHalfDay?: boolean, reason: string }`
- **Response**: `201 Created`

### `PATCH /api/hr/leaves/applications/:id/review`
Reviews leave application (Separation of duties enforced).
- **Roles**: `admin`, `hr_admin`, `hr_officer`, `department_head`
- **Body**: `{ action: "approve"|"reject", comments?: string, rejectionReason?: string }`
- **Response**: `200 OK`

### `PATCH /api/hr/leaves/applications/:id/cancel`
Cancels leave application (refunds balance if approved).
- **Response**: `200 OK`

---

## 6. Employee Attendance & Shifts

### `POST /api/hr/attendance/check-in`
Daily employee check-in (computes `present` or `late`).
- **Response**: `200 OK`

### `POST /api/hr/attendance/check-out`
Daily check-out (computes `workingHours`).
- **Response**: `200 OK`

### `GET /api/hr/attendance/roster`
Lists daily attendance roster.
- **Roles**: `admin`, `hr_admin`, `hr_officer`, `department_head`
- **Query Params**: `date`, `department`, `status`
- **Response**: `200 OK`

### `PATCH /api/hr/attendance/:id/correct`
Administrative correction of attendance record with mandatory audit reason.
- **Roles**: `admin`, `hr_admin`, `hr_officer`, `department_head`
- **Body**: `{ status: string, reason: string }`
- **Response**: `200 OK`

---

## 7. Employee Documents Vault

### `POST /api/hr/documents/upload`
Uploads document (Multipart/form-data, max 10MB).
- **Body**: `employeeId`, `documentType`, `title`, `notes`, `file`
- **Response**: `201 Created`

### `GET /api/hr/documents/:id/download`
Downloads document with path traversal and confidentiality protection.
- **Response**: File download stream

---

## 8. Dashboard Metrics & CSV Exports

### `GET /api/hr/dashboard/metrics`
Aggregates workforce, leave, and attendance KPIs.
- **Response**: `200 OK`

### `GET /api/hr/export/employees`
Downloads sanitized employee directory CSV.
- **Response**: `text/csv` attachment

### `GET /api/hr/export/leaves`
Downloads sanitized leave applications CSV.
- **Response**: `text/csv` attachment
