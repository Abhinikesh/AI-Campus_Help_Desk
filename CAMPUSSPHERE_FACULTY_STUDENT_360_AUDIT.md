# CampusSphere AI — Faculty Student Search & Student 360 Architecture Audit
**Document ID:** `CAMPUSSPHERE_FACULTY_STUDENT_360_AUDIT.md`  
**Revision:** Phase 1.1 Corrected Edition  
**Date:** November 11, 2026  
**Auditor & Lead Architect:** Antigravity AI Engineering & Architecture Team  
**Scope:** Faculty Portal Student Search & 4-Section Student 360 Profile  
**Compliance Mandate:** Exact 4 Sections, Strict Field Limits, Fail-Closed Authorization, Zero Fabricated Fallbacks  

---

## 1. Executive Summary & Mandatory Scope Corrections

This corrected audit establishes the definitive architectural specification for the **Faculty Student Search** and **Student 360 Profile** within CampusSphere AI ERP.

### Mandatory Phase 1.1 Scope Corrections:
1. **Strict 4-Section Layout:** The profile must contain **EXACTLY** four sections:
   - Section 1: **Basic Profile**
   - Section 2: **Academic Details**
   - Section 3: **Marks & Results**
   - Section 4: **Timetable**
   *(Explicitly excluding Attendance, Assignments, Certificates, and Learning Progress).*
2. **Basic Profile — Strict Field Restrictions:**
   The Basic Profile section must display **ONLY**:
   - **Roll Number** (`student.rollNumber`)
   - **Phone Number** (`student.phone`)
   - **Class** (Derived from `student.semester`, `student.branch`, `student.section`, e.g. `"5 CSE-A"`)
   *Do NOT display email, date of birth, address, guardian details, gender, attendance, fees, or unverified demographic fields.*
3. **Elimination of All Proposed Hardcoded Defaults:**
   Remove all hardcoded fallbacks previously suggested (e.g. defaulting batch to `'2024-2028'`, programme to `'B.Tech'`, academic session to `'2026-2027'`, grade to `'A'`, grade point to `8`, max marks to `100`). All fields must be real database values or display an explicit empty/unavailable state.
4. **Fail-Closed Backend Teaching Scope Authorization:**
   Branch and semester matching alone must NOT grant unrestricted access. Faculty search and profile access must strictly derive from verified teaching assignments (`Subject.find({ faculty: facultyUserId })` and `Timetable.find({ faculty: facultyUserId })`). If teaching scope cannot be verified, the backend must fail closed and return zero students.

---

## 2. Faculty Teaching-Scope Authorization Architecture

### 2.1 The Vulnerability in Existing `getStudents`
In `server/controllers/faculty.controller.js` (lines 566–574):
```javascript
const getStudents = asyncHandler(async (req, res) => {
  const { branch, semester } = req.query;
  const filter = {};
  if (branch) filter.branch = branch;
  if (semester) filter.semester = Number(semester);

  const students = await Student.find(filter)...
```
When `branch` and `semester` are omitted, `filter = {}`, returning **every student in the database** across all branches. This violates institutional privacy and student data governance.

### 2.2 Grounded Teaching Scope Derivation
The faculty member's authorized teaching scope is derived dynamically from verified database records:

```
                            AUTHENTICATED FACULTY USER
                                       │
                                       ▼
                       [Query 1: Assigned Subjects]
                   Subject.find({ faculty: req.user.userId })
                                       │
                                       ▼
                       [Query 2: Assigned Timetable]
                  Timetable.find({ faculty: req.user.userId })
                                       │
                                       ▼
                   [Compile Teaching Jurisdiction Scope]
               • Authorized Semesters: [ s.semester, ... ]
               • Authorized Branches:  [ s.branch, ... ]
               • Authorized Sections:  [ slot.section, ... ]
                                       │
                    ┌──────────────────┴──────────────────┐
                    ▼                                     ▼
          [Scope IS Established]               [Scope IS EMPTY (0 subjects)]
                    │                                     │
                    ▼                                     ▼
     Query Student within Scope:                   [FAIL CLOSED]
     { branch: { $in: branches },                  • Search: return [] (0 results)
       semester: { $in: semesters } }              • Profile: return 403 Forbidden
```

### 2.3 Strict Authorization Rules
1. **Backend Enforcement:** Authorization is enforced in backend controllers and middleware, never solely in frontend UI.
2. **Double Verification:** Scope is verified during search (`/api/faculty/students/search`) AND re-verified upon opening a Student 360 profile (`/api/faculty/students/:id/360`).
3. **Fail-Closed Principle:** If a faculty member has no assigned subjects or timetable slots, the system fails closed (returns 0 search results; rejects profile access with HTTP 403).
4. **URL Tampering Protection:** Manually typing an unauthorized student ID in the URL `/faculty/students/:id` produces a safe, generic unauthorized message without revealing whether the student exists.
5. **No Data Leakage:** Responses must never expose password hashes, biometric data, consent records, or financial ledgers.
6. **Audit Trail:** Every Student 360 profile access is logged via `AuditLog.create({ actor: facultyUserId, action: 'STUDENT_360_VIEW', entityType: 'Student', entityId: studentId })`.

---

## 3. Four-Section Data Requirements & Field Mapping

```
┌────────────────────────────────────────────────────────────────────────┐
│                   FACULTY STUDENT 360 PROFILE SECTIONS                 │
├───────────────────────────────────┬────────────────────────────────────┤
│ 1. Basic Profile (STRICT LIMIT)   │ 2. Academic Details                │
│ • Roll Number (student.rollNumber)│ • Academic Session (real/null)     │
│ • Phone Number (student.phone)    │ • Programme & Department (real)    │
│ • Class (e.g. "5 CSE-A")          │ • Semester & Section (real)        │
│                                   │ • Enrolled Subjects (catalog)      │
│ ✗ No email, address, DOB, fees    │ • Subject Codes & Credits (real)   │
├───────────────────────────────────┼────────────────────────────────────┤
│ 3. Marks & Results                │ 4. Timetable                       │
│ • Real Published Marks only       │ • Published Timetable slots only   │
│ • Subject-Wise Evaluation         │ • Day of Week & Period Number      │
│ • Internal & External Marks (real)│ • Start & End Times                │
│ • Total & Maximum Marks           │ • Subject, Room & Assigned Faculty │
│ • Explicit "Pending Evaluation"   │ • Group / Batch Filter (real)      │
│   if unpublished; zero hardcoding │ • "No schedule published" state    │
└───────────────────────────────────┴────────────────────────────────────┘
```

### Section 1: Basic Profile (Strict Field Limits)
```json
{
  "basicProfile": {
    "rollNumber": "20240001",
    "phoneNumber": "9876543210",
    "class": "5 CSE-A"
  }
}
```
*Note: If `phone` is empty in the database, it returns `null` and the UI renders `"Not provided"`.*

### Section 2: Academic Details
- Fetches real curriculum data matching student's branch and semester from `Subject`.
- Displays `code`, `name`, `credits`, `semester`, and assigned faculty name if mapped.
- If curriculum records do not exist for the student's cohort, returns an empty array with explicit state `"No enrolled subjects found"`.

### Section 3: Marks & Results
- Fetches only persisted records from `Mark.find({ student: studentId, status: 'published' })`.
- Displays real `internal`, `external`, `marksObtained`, `maxMarks`, and `grade`.
- **Zero Fabrication:** If marks are unreleased, displays:
  > *"Marks have not been published for this examination."*
- SGPA/CGPA is only calculated when backed by complete, published results; otherwise displays `null` and UI shows `"Evaluation in progress"`.

### Section 4: Timetable
- Fetches verified weekly schedule from `Timetable.find({ branch: student.branch, semester: student.semester, section: student.section, status: 'published' })`.
- Sorted by `dayOfWeek` (Monday to Friday) and `period` (1 to 10).
- If no timetable is published, renders `.cs-empty-state` with `"No published timetable available"`.

---

## 4. API Endpoints Specification

### 4.1 Search Endpoint
- **Route:** `GET /api/faculty/students/search`
- **Headers:** `Authorization: Bearer <token>`
- **Query Parameters:**
  - `q`: Search string (roll number prefix, partial name).
  - `page`: Page number (default: 1).
  - `limit`: Results per page (default: 20, max: 50).
- **Processing Logic:**
  1. Authenticate user; verify `role === 'faculty'`.
  2. Derive teaching scope from `Subject` and `Timetable`.
  3. If scope is empty, return `{ success: true, data: [], total: 0 }`.
  4. Query `Student` constrained by scope + sanitized search regex on `fullName` and `rollNumber`.
  5. Project only: `_id`, `fullName`, `rollNumber`, `branch`, `semester`, `section`.

### 4.2 Student 360 Profile Endpoint
- **Route:** `GET /api/faculty/students/:id/360`
- **Headers:** `Authorization: Bearer <token>`
- **Processing Logic:**
  1. Authenticate faculty.
  2. Fetch target student by `_id`. If not found, return 404.
  3. Verify student's `branch` and `semester` fall within faculty's derived teaching scope. If not, return HTTP 403 Forbidden.
  4. Query Sections 1, 2, 3, and 4 in parallel using `Promise.all`.
  5. Log audit trail to `AuditLog`.
  6. Return structured 4-section payload.

---

## 5. UI/UX & Frontend Integration

1. **New Route:** `/faculty/students` (Student Search Directory) and `/faculty/students/:id` (Student 360 Profile).
2. **Sidebar Entry:** Add "Student 360" with `Users` icon under Faculty navigation in [`Sidebar.jsx`](file:///Users/abhinikesh/AI-Campus_Help_Desk/client/src/components/Sidebar/Sidebar.jsx).
3. **Faculty Dashboard Quick Action:** Compact search bar in [`FacultyDashboard/index.jsx`](file:///Users/abhinikesh/AI-Campus_Help_Desk/client/src/pages/FacultyDashboard/index.jsx) allowing faculty to search and jump directly to a student's profile.
4. **Visual Design:** Permanent light mode, white cards (`#FFFFFF`), subtle slate borders (`#E2E8F0`), four accessible tabs, `.cs-empty-state` for unavailable data.

---

## 6. Verification Test Protocols

| Test ID | Test Category | Execution Action | Expected Result |
| :--- | :--- | :--- | :--- |
| **TEST-AUTH-01** | Authorization (Negative) | Non-faculty user requests `/api/faculty/students/search`. | HTTP 403 Forbidden. |
| **TEST-AUTH-02** | Authorization (Negative) | Faculty with 0 assigned subjects executes search. | Returns empty array `[]` (fails closed). |
| **TEST-AUTH-03** | Authorization (Negative) | CSE faculty attempts direct URL access to MECH student profile. | HTTP 403 Forbidden. Zero student data returned. |
| **TEST-AUTH-04** | Authorization (Positive) | Dr. Priya Mehta (teaches CSE Sem 5) searches `"Arjun"`. | Returns `Arjun Sharma` (Roll: `20240001`). |
| **TEST-AUTH-05** | Authorization (Positive) | Dr. Priya Mehta opens Student 360 for Arjun Sharma. | HTTP 200 OK. Returns 4 sections. |
| **TEST-DATA-01** | Scope Integrity | Inspect `basicProfile` in response. | Contains **ONLY** `rollNumber`, `phoneNumber`, and `class`. |
| **TEST-DATA-02** | Marks Truthfulness | Inspect student with no published marks. | Returns empty array. Zero hardcoded grades or GPA. |
| **TEST-AUDIT-01** | Audit Logging | Inspect `AuditLog` collection after opening profile. | Entry recorded with `actor: facultyUserId`, `action: 'STUDENT_360_VIEW'`. |
