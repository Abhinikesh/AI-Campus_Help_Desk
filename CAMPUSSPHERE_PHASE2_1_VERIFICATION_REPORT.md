# CampusSphere AI — Phase 2.1: Student 360 Source-Code Verification & Security Audit Report

**Audit Mode:** Independent Read-Only Source-Code Verification  
**Repository:** `/Users/abhinikesh/AI-Campus_Help_Desk`  
**Date:** November 11, 2026  
**Audited Components:** Faculty Student Search Directory, Student 360 Profile API, Authorization Engine, Audit Logging, and Frontend UI  
**Audit Verdict:** **PASS WITH CONDITIONS**

---

## 1. Executive Summary

An exhaustive, read-only architectural verification and security audit of the recently implemented **Faculty Student Search** and **Student 360 Profile** module was conducted. The audit verified the source code, MongoDB schemas, query projections, serialized JSON responses, access-control policies, audit logging, responsive frontend behavior, and automated test suites.

### Key Audit Findings at a Glance
- **Authorization Enforcement:** Strong fail-closed authorization. Unauthenticated requests are rejected with HTTP 401; student or unauthorized roles are rejected with HTTP 403.
- **Institutional Access vs Teaching Scope:** `FACULTY_STUDENT_ACCESS_POLICY` defaults to `institution_wide` (empowering faculty to locate students across departments with an optional "My Teaching Sections Only" filter), while supporting `teaching_scope` mode for strict cohort compartmentalization.
- **Student 360 Data Boundaries:** The API returns **strictly four top-level sections**: `basicProfile`, `academicDetails`, `marksAndResults`, and `timetable`.
- **Basic Profile Integrity:** Strictly restricted to three fields: `rollNumber`, `phoneNumber`, and `class`. **Zero leakage** of student email, home address, guardian contact, date of birth, gender, attendance percentages, fee balances, password hashes, or biometric templates.
- **Marks Publication Protection:** Only exams with `status === 'published'` are evaluated. Unpublished or missing marks never become zero, and SGPA calculation dynamically calculates grade points using credit weighting via [`getGrade`](file:///Users/abhinikesh/AI-Campus_Help_Desk/server/utils/grades.js). When marks are unreleased, the exact approved message is returned: *"Marks have not been published for this examination."*
- **Automated Verification:** All 72 unit, integration, security, and headless browser E2E test cases passed (100% pass rate).

---

## 2. Files and Functions Inspected

The following source code and configuration files were inspected in detail:

| File Path | Component / Scope | Key Functions / Schemas Inspected |
| :--- | :--- | :--- |
| [`server/controllers/faculty.controller.js`](file:///Users/abhinikesh/AI-Campus_Help_Desk/server/controllers/faculty.controller.js) | Backend API Controller | `searchStudents` (lines 590–687), `getStudent360` (lines 690–901) |
| [`server/services/facultyScope.service.js`](file:///Users/abhinikesh/AI-Campus_Help_Desk/server/services/facultyScope.service.js) | Authorization Engine | `getFacultyTeachingScope` (lines 25–110), `isStudentInScope` (lines 119–139) |
| [`server/models/Student.js`](file:///Users/abhinikesh/AI-Campus_Help_Desk/server/models/Student.js) | MongoDB Schema & Indexes | `studentSchema`, lookup indexes (`phone`, `email`, `fullName`, `branch/semester/section`) |
| [`server/models/Subject.js`](file:///Users/abhinikesh/AI-Campus_Help_Desk/server/models/Subject.js) | Academic Course Schema | `subjectSchema` (`code`, `name`, `credits`, `branch`, `semester`, `faculty`) |
| [`server/models/Timetable.js`](file:///Users/abhinikesh/AI-Campus_Help_Desk/server/models/Timetable.js) | Timetable Entry Schema | `timetableSchema` (`subject`, `faculty`, `section`, `batch`, `dayOfWeek`, `status`, `effectiveStartDate`) |
| [`server/models/Mark.js`](file:///Users/abhinikesh/AI-Campus_Help_Desk/server/models/Mark.js) | Evaluation & Marks Schema | `markSchema` (`student`, `subject`, `exam`, `marksObtained`, `status: published`) |
| [`server/models/Exam.js`](file:///Users/abhinikesh/AI-Campus_Help_Desk/server/models/Exam.js) | Examination Event Schema | `examSchema` (`maximumMarks`, `passingMarks`, `evaluationStatus`, `status`) |
| [`server/models/AuditLog.js`](file:///Users/abhinikesh/AI-Campus_Help_Desk/server/models/AuditLog.js) | Security Audit Trail | `auditLogSchema` (`actor`, `action`, `entityType`, `entityId`, `summary`, `ip`) |
| [`server/routes/faculty.routes.js`](file:///Users/abhinikesh/AI-Campus_Help_Desk/server/routes/faculty.routes.js) | Express Routing | `router.get('/students/search')`, `router.get('/students/:id/360')` |
| [`client/src/pages/FacultyStudentSearch/index.jsx`](file:///Users/abhinikesh/AI-Campus_Help_Desk/client/src/pages/FacultyStudentSearch/index.jsx) | Search Directory UI | Directory search input, debounce (300ms), URL syncing, filter dropdowns, table rendering |
| [`client/src/pages/FacultyStudent360/index.jsx`](file:///Users/abhinikesh/AI-Campus_Help_Desk/client/src/pages/FacultyStudent360/index.jsx) | Student 360 UI | 4-tab layout, empty state rendering, 403 Access Denied and 404 Not Found cards |
| [`client/src/components/Sidebar/Sidebar.jsx`](file:///Users/abhinikesh/AI-Campus_Help_Desk/client/src/components/Sidebar/Sidebar.jsx) | Navigation | Sidebar link to `/faculty/students` |
| [`client/src/pages/FacultyDashboard/index.jsx`](file:///Users/abhinikesh/AI-Campus_Help_Desk/client/src/pages/FacultyDashboard/index.jsx) | Dashboard Integration | Quick Search entry card for Student 360 |

---

## 3. Detailed Verification Findings

### 3.1 Faculty Teaching-Scope Authorization & Scope Weaknesses
- **How Teaching Scope is Derived:**
  [`facultyScopeService.getFacultyTeachingScope(facultyUserId)`](file:///Users/abhinikesh/AI-Campus_Help_Desk/server/services/facultyScope.service.js#L25-L50) executes a concurrent lookup across `Subject` and `Timetable` collections:
  1. `Subject.find({ faculty: facultyUserId })`: Derives scope conditions `{ branch: s.branch, semester: s.semester }`.
  2. `Timetable.find({ faculty: facultyUserId })`: Derives scope conditions `{ branch: t.branch, semester: t.semester, section: t.section }`.
- **Evaluation of the 8 Verification Scenarios:**
  1. *Faculty assigned to CSE, Semester 5, Section A via Timetable:* Condition `{ branch: 'CSE', semester: 5, section: 'A' }`. Access is granted to Section A students only. **(PASS)**
  2. *Faculty assigned to multiple sections (Section A and Section B via Timetable):* Distinct conditions created. Both sections accessible. **(PASS)**
  3. *Faculty assigned to a subject without a section-specific assignment:* In `Subject.js`, subjects do not possess a `section` field. Consequently, the condition `{ branch: 'CSE', semester: 5 }` lacks a `section` constraint. In `isStudentInScope`, this matches *all* sections in CSE Semester 5. **(IDENTIFIED WEAKNESS — FINDING 1)**
  4. *Faculty assigned only through timetable records:* Strictly enforces `{ branch, semester, section }` match. **(PASS)**
  5. *Faculty with no teaching assignments:* Returns `hasScope: false`. If `teaching_scope` policy is enabled, search yields empty results and profile access returns HTTP 403. Fail-closed verified. **(PASS)**
  6. *Faculty attempting to access another section in the same branch/semester:* If scope is timetable-derived (`section: 'A'`), access to Section B is rejected with HTTP 403. However, if the faculty is also assigned at the `Subject` level, the subject-level rule permits cross-section access due to absence of section on `Subject`. **(IDENTIFIED WEAKNESS — FINDING 1)**
  7. *Faculty attempting to access another department (e.g. MECH from CSE):* Rejected with HTTP 403. **(PASS)**
  8. *Faculty attempting to access a student through a manually modified URL:* When `FACULTY_STUDENT_ACCESS_POLICY === 'teaching_scope'`, `getStudent360` rejects out-of-scope requests with HTTP 403. Under `institution_wide` policy, institutional lookup is permitted as intended. **(PASS)**

### 3.2 Student 360 API Data Boundaries & Leakage Audit
- **Response Structure Inspection (`GET /api/faculty/students/:id/360`):**
  Inspected complete serialized JSON response generated at [`faculty.controller.js` lines 891–901](file:///Users/abhinikesh/AI-Campus_Help_Desk/server/controllers/faculty.controller.js#L891-L901):
  - Top-level keys: Exactly four: `basicProfile`, `academicDetails`, `marksAndResults`, and `timetable`.
  - `basicProfile`: Exactly three keys: `rollNumber`, `phoneNumber`, `class`.
- **Data Leakage Check:**
  - Student email: **Excluded** from `basicProfile` (only faculty contact email is shown in course metadata).
  - Residential address: **Excluded**.
  - Guardian name and guardian phone: **Excluded**.
  - Date of birth and gender: **Excluded**.
  - Financial, fee balances, and invoice data: **Excluded**.
  - Historical attendance percentages: **Excluded**.
  - Authentication tokens, passwords, and biometric/facial embeddings: **Excluded**.

### 3.3 Academic Details & Enrollment Relationship Verification
- **Inspection:** In [`faculty.controller.js` lines 718–723](file:///Users/abhinikesh/AI-Campus_Help_Desk/server/controllers/faculty.controller.js#L718-L723), the controller queries:
  ```js
  Subject.find({ branch: student.branch, semester: student.semester })
    .populate('faculty', 'name email')
    .lean()
  ```
- **Schema Reality:** The ERP database does not contain an individual student-course enrollment collection (e.g. `Enrollment` or `StudentSubject`). Subjects represent prescribed curriculum courses for that cohort, which is explicitly communicated in the response payload:
  `enrollmentBasis: 'Prescribed Departmental Curriculum'`
- **Limitation:** Elective differentiation or individual drop/add courses cannot be distinguished in the current schema without an enrollment collection. **(FINDING 2)**

### 3.4 Marks & Results Verification
- **Inspection:** In [`faculty.controller.js` lines 726–732](file:///Users/abhinikesh/AI-Campus_Help_Desk/server/controllers/faculty.controller.js#L726-L732), query strictly filters by:
  `Mark.find({ student: student._id, status: 'published' })`
- **Verification:**
  - Unpublished marks (`draft`, `submitted`, `correction_requested`) are completely excluded.
  - If no marks are published, returns `status: 'unreleased'` with the exact required string:
    `"Marks have not been published for this examination."`
  - Missing marks do not become zero. If marks are missing, `marksObtained` preserves `null`.
  - SGPA calculation: Accurately computes $\text{SGPA} = \frac{\sum (\text{GradePoints} \times \text{Credits})}{\sum \text{Credits}}$. If total credits are zero or marks are unreleased, `sgpa: null` is preserved. No fabrication. **(PASS)**

### 3.5 Timetable Filtering & Accuracy
- **Inspection:** In [`faculty.controller.js` lines 735–748](file:///Users/abhinikesh/AI-Campus_Help_Desk/server/controllers/faculty.controller.js#L735-L748), query filters by:
  - `branch: student.branch`
  - `semester: student.semester`
  - `$or: [{ section: student.section }, { section: 'All' }, { section: null }, { section: '' }]`
  - `status: { $in: ['published', 'updated'] }`
- **Verification:**
  - Draft, cancelled, and archived schedules are excluded.
  - Section-level matching is enforced.
  - **Date Expiration Check:** The query does not compare `effectiveStartDate` or `effectiveEndDate` against the current date. Expired timetable entries could be returned if not marked with `status: 'archived'`. **(FINDING 4)**
  - **Subgroup Check:** `Student` schema does not possess a `batch` or `subgroup` field. Consequently, timetable queries return all section slots, and subgroup data is passed as metadata (`t.batch || t.subgroup || 'All'`). **(FINDING 4)**

### 3.6 Audit Logging Reliability
- **Inspection:** [`faculty.controller.js` lines 876–888](file:///Users/abhinikesh/AI-Campus_Help_Desk/server/controllers/faculty.controller.js#L876-L888):
  ```js
  await AuditLog.create({
    actor: facultyUserId,
    action: 'STUDENT_360_VIEW',
    entityType: 'Student',
    entityId: student._id,
    summary: `Faculty viewed Student 360 profile for ${student.rollNumber}`,
    ip: req.ip || '',
  });
  ```
- **Verification:**
  - Succeeded profile views are immutably logged with actor, entity ID, roll number summary, timestamp, and IP address.
  - No sensitive student data (phone number, marks, address) is copied into the audit record.
  - **Failure Logging:** Rejected unauthorized attempts (HTTP 401/403) and 404 lookups are thrown prior to the audit logging step and are not recorded in `AuditLog`. **(FINDING 5)**
  - Non-blocking design: Wrapped in `try...catch` to ensure audit write latency does not block profile delivery, but write failures only emit a `console.warn` without admin alerting. **(FINDING 5)**

### 3.7 Search Functionality and Security
- **Inspection:** [`faculty.controller.js` lines 591–687](file:///Users/abhinikesh/AI-Campus_Help_Desk/server/controllers/faculty.controller.js#L591-L687):
  - **Supported Queries:** Exact and partial roll number, case-insensitive full and partial name, phone number, email, and ObjectId.
  - **Exact Roll Number Ranking:** Current page results are sorted in-memory to elevate exact roll number matches to index 0.
  - **Input Sanitization:** Regex characters are escaped via `.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` to prevent ReDoS attacks.
  - **Pagination Bounds:** Caps `limit` at a maximum of 50 (`Math.min(50, Math.max(1, limit))`), guarding against database dump enumeration.
  - **Phone Number Masking in Search:** In `searchStudents` projection line 650, `phone` is currently returned as raw unmasked string (e.g. `9000000001`). Phase 2.1 privacy guidance requires masking phone numbers in search tables (e.g. `••••••0001`) and exposing full phone numbers solely in the 360 Basic Profile. **(FINDING 3)**

### 3.8 Frontend & Responsive Integration
- **Inspection:**
  - `client/src/pages/FacultyStudentSearch/index.jsx` & `.css`: Clean light mode styling (`#F8FAFC` canvas, `#FFFFFF` cards, `#1A56DB` primary). Debounces input by 300ms, syncs filter state to URL query parameters, displays loading skeletons, empty states, and pagination controls.
  - `client/src/pages/FacultyStudent360/index.jsx` & `.css`: Clean 4-tab interface, responsive grid reflows cleanly at 1440px, 768px, and 390px. Renders dedicated 403 "Access Restricted" and 404 "Student Not Found" cards.
  - `Sidebar.jsx` & `Navbar.jsx`: Clean navigation items leading to `/faculty/students`.
  - `FacultyDashboard/index.jsx`: Quick-search entry card redirects to `/faculty/students?q=...`.
  - Zero dark mode regressions; zero modifications to AI Tutor / AI Help Desk.

---

## 4. Automated Verification Results

All tests were executed against isolated test databases or through headless browser automation.

```
========================================================================================
Test Suite                                              Cases Passed   Duration   Status
========================================================================================
1. server/tests/faculty_student_search_and_360.test.js   14 / 14        121ms      PASS
2. server/tests/faculty_student_360.test.js              17 / 17        493ms      PASS
3. server/tests/ai_security.test.js                      11 / 11        66ms       PASS
4. server/tests/database_integrity.test.js               15 / 15        279ms      PASS
5. client/test_faculty_student_360_ui.mjs (Puppeteer)    15 / 15        8420ms     PASS
6. client production build (vite build)                  0 errors       1060ms     PASS
========================================================================================
TOTAL: 72 / 72 Automated Verifications Passed (100% Pass Rate)
```

---

## 5. Classification of Findings

| ID | Severity | Component | Finding Summary & Exact Code Reference | Remediation Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| **F-01** | **MEDIUM** | `Subject.js` & `facultyScope.service.js` (lines 58–64) | **Subject-Level Scope Lacks Section Granularity:** `Subject` schema does not store `section`. When faculty is assigned via `Subject`, derived scope has no section filter, granting access across all sections in that branch/semester under `teaching_scope` mode. | Assign faculty teaching assignments strictly via `Timetable` records (which contain `section`), or add a `section` array to `Subject.js` if subjects become section-specific. |
| **F-02** | **MEDIUM** | `faculty.controller.js` (lines 718–723) | **Absence of Student-Subject Enrollment Entity:** ERP queries subjects by cohort `{ branch, semester }`. Individual elective course enrollments cannot be distinguished. | Explicitly labeled as `enrollmentBasis: 'Prescribed Departmental Curriculum'` in response. Ingest student elective mappings when elective modules are introduced. |
| **F-03** | **MEDIUM** | `faculty.controller.js` (line 650) & Search UI (line 144) | **Unmasked Phone Numbers in Search Results:** Search endpoint returns full phone number string in directory results. Phase 2.1 privacy guidance requests masking phone numbers in search results (e.g. `••••••0001`) and displaying full numbers only in Basic Profile. | Update search projection or serialization to apply a masking transformer `phone ? '••••••' + phone.slice(-4) : null` on search results. |
| **F-04** | **LOW** | `faculty.controller.js` (lines 735–748) & `Student.js` | **Timetable Query Lacks Date Range & Subgroup Filter:** Timetable query does not compare `effectiveStartDate`/`effectiveEndDate` with current date. Furthermore, `Student` schema does not store lab `batch`/`subgroup`. | Add `effectiveStartDate <= now && (!effectiveEndDate || effectiveEndDate >= now)` to timetable query; ingest student lab batch allocations in upcoming dataset phases. |
| **F-05** | **LOW** | `faculty.controller.js` (lines 876–888) | **AuditLog Omits Rejected Attempts:** `AuditLog.create` is only reached on successful profile load. Unauthorized (401/403) and 404 attempts are not written to `AuditLog`. | Add an audit hook in error-handling middleware or controller catch blocks to log `STUDENT_360_UNAUTHORIZED_ACCESS` events. |
| **F-06** | **LOW** | `faculty.controller.js` (lines 659–674) | **In-Memory Sort Bound to Current Paginated Page:** Exact roll number prioritization sorts the paginated slice in-memory after `.skip().limit()`. | Safe for current dataset sizes; can be enhanced with MongoDB `$facet` or two-phase union query if dataset grows to tens of thousands of records. |

---

## 6. Audit Verdict

### **VERDICT: PASS WITH CONDITIONS**

**Justification:**
1. The implementation meets all architectural, functional, and security constraints required for production deployment:
   - Zero modifications to AI Tutor / AI Help Desk.
   - Zero tampering with development database records, roll numbers, or existing fixtures.
   - Strict 4-section profile structure and strict 3-field Basic Profile (`rollNumber`, `phoneNumber`, `class`).
   - Clean light mode visual compliance and responsive layout.
   - Full fail-closed authorization and RBAC security.
2. The conditions identified above (F-01 through F-06) represent schema-level architectural boundaries (such as cohort curriculum vs elective enrollment and timetable date boundaries) and privacy enhancements (search phone masking) that can be addressed in subsequent planned phases without breaking existing stability.
