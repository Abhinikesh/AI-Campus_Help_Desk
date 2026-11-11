# CampusSphere AI — Real Data & Dashboard Audit Report
**Document ID:** `CAMPUSSPHERE_DASHBOARD_REAL_DATA_AUDIT.md`  
**Date:** November 11, 2026  
**Auditor:** Antigravity AI Engineering & Architecture Team  
**System Scope:** Admin Dashboard, Student Dashboard, Faculty Dashboard  
**Compliance Mandate:** Zero Fabricated Data, Truthful Metrics, Database-Backed Calculations, Explicit Empty States  

---

## 1. Executive Summary

CampusSphere AI dashboards serve as the primary operational command centers for Administrators, Faculty members, and Students. A rigorous, line-by-line audit of frontend rendering logic (`client/src/pages/*Dashboard/index.jsx`) and corresponding backend controllers (`server/controllers/*`) revealed that **multiple critical metrics, statistics, and tables are either fabricated, hardcoded, or silently fall back to synthetic placeholder data** when database records are missing.

Specifically:
- The **Admin Dashboard** displays hardcoded `4,536` students, `200` faculty, a static `"Rs. 42L"` fee collection figure, and renders a completely fabricated table of 5 fictitious students (`Arjun Sharma`, `Priya Mehta`, etc.).
- The **Student Dashboard** silently falls back to `88%` attendance, `8.6` CGPA, a fake 7-subject attendance table with `15/15` classes, and a static 5-course grid whenever a student has no real records.
- The **Faculty Dashboard** defaults to `8` assigned students and injects a 5-class fallback schedule (`CS501`–`CS505`) with interactive "Mark Attendance" buttons when the actual timetable is empty.

This report documents every metric, query, formula, hardcoded fallback, cross-module discrepancy, and provides the architectural blueprint to eliminate all fabricated figures in favor of truthful database calculations and standard empty states.

---

## 2. Dashboard Metric-by-Metric Audit

### 2.1 Admin Dashboard (`/admin/dashboard`)
- **Frontend Source:** `client/src/pages/AdminDashboard/index.jsx`
- **Backend Controller:** `server/controllers/admin.controller.js` (`getStats`, `getAllUsers`, `getAllComplaints`)

| UI Metric / Card | Frontend State / Line | Endpoint & Method | Backend Query & Model | Calculation / Logic | Status | Reconciliation with Detailed Module |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Total Students** | `stats?.totalStudents ?? 4536` (Line 134) | `GET /api/admin/stats` | `User.countDocuments({ role: 'student' })` | Counts users with student role in `User` collection. | **FABRICATED FALLBACK** | Diverges if `stats` is null or on error (shows `4536` vs real `8`). Also ignores `Student` collection count. |
| **Total Faculty** | `stats?.totalFaculty ?? 200` (Line 139) | `GET /api/admin/stats` | `User.countDocuments({ role: 'faculty' })` | Counts users with faculty role in `User` collection. | **FABRICATED FALLBACK** | Diverges on loading/error (shows `200` vs real `7`). |
| **Pending Complaints** | `stats?.pendingComplaints ?? complaints.filter(...).length` (Line 144) | `GET /api/admin/stats` & `GET /api/admin/complaints` | `Complaint.countDocuments({ status: 'pending' })` | Direct count from `Complaint` collection. | **REAL / ACCURATE** | Agrees with `/admin/activities` and `/complaints`. |
| **Fee Collection** | Hardcoded text `"Rs. 42L"` (Line 149) | **NONE** (No API call made) | `FeeInvoice` / `PaymentTransaction` | Static JSX string literal. | **COMPLETELY HARDCODED** | Total contradiction. `/api/fees/admin/metrics` computes real gross, collected, and outstanding in paise, but dashboard completely ignores it. |
| **Student Management Table** | `STUDENTS.map(...)` (Lines 99–105, 179–200) | **NONE** (No API call made) | `Student` / `User` | Static JavaScript array with 5 fake students: `CS301001` Arjun Sharma, `CS301002` Priya Mehta, etc. | **COMPLETELY HARDCODED** | Completely fabricated. Does not fetch real student documents from `GET /api/admin/users?role=student` or `Student` model. |
| **Complaints Table** | `complaints.map(...)` (Lines 270–305) | `GET /api/admin/complaints` | `Complaint.find().populate('raisedBy')` | Real database documents with status update handler. | **REAL / ACCURATE** | Agrees with backend state. |
| **Announcements Form** | Form submission (Lines 310–355) | `POST /api/admin/announcements` | `Announcement.create(...)` | Saves real announcement with target roles. | **REAL / ACCURATE** | Writes to database. |

---

### 2.2 Student Dashboard (`/student/dashboard`)
- **Frontend Source:** `client/src/pages/StudentDashboard/index.jsx`
- **Backend Controller:** `server/controllers/student.controller.js` (`getAttendance`, `getResults`, `getProfile`)

| UI Metric / Card | Frontend State / Line | Endpoint & Method | Backend Query & Model | Calculation / Logic | Status | Reconciliation with Detailed Module |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Overall Attendance** | `attendanceAvg` (Lines 93–99, 157) | `GET /api/student/attendance` | `AttendanceSession` & `Attendance` via `attendanceCalculationService` | Average of subject percentages. If `attendance.length === 0`, defaults to `88%`! | **FABRICATED FALLBACK** | If student has no attendance sessions held, displays fake `88%` instead of `"No attendance recorded"`. |
| **Courses Enrolled** | `displayAttendance.length` (Line 164) | `GET /api/student/attendance` | Subject count from attendance calculation | If `attendance.length === 0`, uses `fallbackAttendance.length` (`7`). | **FABRICATED FALLBACK** | Shows 7 courses when student may have 0 or different subjects assigned. |
| **Cumulative CGPA** | `cgpa` (Lines 101–103, 174, 301) | `GET /api/student/results` | `Mark.find({ student, status: 'published' })` | Crude formula: `sum(marks) / count / 10`. If `results.length === 0`, defaults to `'8.6'`! | **FABRICATED FALLBACK & FLAWED FORMULA** | 1. Hardcodes `'8.6'` on missing data.<br>2. Formula violates credit-weighting. Backend `examController.getStudentResults` already calculates true credit-weighted SGPA/CGPA via UGC 10-point scale. |
| **Attendance Overview Table** | `displayAttendance.slice(0, 7)` (Lines 114–124, 205–220) | `GET /api/student/attendance` | `Attendance` records | If `attendance.length === 0`, renders static `fallbackAttendance`: DAA (15/15), FLAT (14/15), AICA (15/15), etc. | **FABRICATED FALLBACK** | Fabricates perfect/near-perfect attendance records for new or unrecorded students. |
| **Enrolled Courses Grid** | `coursesList.map(...)` (Lines 106–112, 235–270) | **NONE** (No API call made) | `Subject` / `Timetable` | Hardcoded static array of 5 courses with fake professors (`Prof. Neha Singh`, `Prof. Poonam Nandal`), timings, and progress. | **COMPLETELY HARDCODED** | Completely ignores real student enrolled subjects in `Student.subjects` and `Timetable`. |
| **Recent Activity & Tasks** | `complaints` & notices (Lines 275–320) | `GET /api/student/complaints` & announcements | Real database queries | Real list of student complaints and notices. | **REAL / ACCURATE** | Reflects student actions. |

---

### 2.3 Faculty Dashboard (`/faculty/dashboard`)
- **Frontend Source:** `client/src/pages/FacultyDashboard/index.jsx`
- **Backend Controller:** `server/controllers/faculty.controller.js` (`getOverview`, `getTimetable`, `getProfile`)

| UI Metric / Card | Frontend State / Line | Endpoint & Method | Backend Query & Model | Calculation / Logic | Status | Reconciliation with Detailed Module |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Assigned Students** | `overview?.assignedStudentsCount ?? 8` (Line 156) | `GET /api/faculty/overview` | `Student.countDocuments(...)` in `calculateFacultyMetrics` | Counts students in faculty's assigned branch/semesters. If missing/null, defaults to `8`. | **FABRICATED FALLBACK** | Hardcodes `8` if overview service returns null or 0. |
| **Classes Today** | `overview?.classesToday ?? timetable.length ?? 0` (Line 161) | `GET /api/faculty/overview` & `GET /api/faculty/timetable` | `AttendanceSession.find({ faculty, date: todayStr })` | Backend counts sessions already created today, not scheduled slots in `Timetable`. | **STALE / MISLEADING** | Before a teacher opens a session, backend returns 0 sessions today. Frontend then falls back to `timetable.length`. |
| **Sessions Conducted** | `overview?.sessionsConducted ?? 0` (Line 166) | `GET /api/faculty/overview` | `AttendanceSession.find({ status: { $in: ['completed', 'finalized'] } })` | Real count of conducted attendance sessions. | **REAL / ACCURATE** | Database backed. |
| **Average Attendance** | `overview?.averageAttendance` (Lines 172–176) | `GET /api/faculty/overview` | Real session attendance percentage | Displays `—` when `!hasAttendanceData`. | **REAL / ACCURATE** | Truthful handling when data is missing. |
| **Today's Schedule Table** | `timetable.map(...)` vs fallback (Lines 185–240) | `GET /api/faculty/timetable` | `Timetable.find({ faculty: userId, day: today })` | If `timetable.length === 0`, renders 5 fake classes: `08:10–09:00 DAA`, `09:00–09:50 FLAT`, etc., with interactive Mark Attendance buttons! | **FABRICATED FALLBACK & INTERACTIVE DEFECT** | When a teacher has no classes scheduled for the current day, they see 5 fake classes and can click "Mark Attendance", opening attendance modals with dummy parameters! |

---

## 3. Discrepancy & Agreement Analysis Across Modules

### 3.1 Financial Metrics Discrepancy
- **Admin Dashboard:** Displays hardcoded `"Rs. 42L"`.
- **Admin Finance Module (`/admin/finance`):** Calls `/api/fees/admin/metrics`, which executes `FeeInvoice.aggregate` and returns exact, database-backed sums:
  - `totalPaidInPaise` (Real collected fees)
  - `totalOutstandingInPaise` (Real pending fees)
  - `totalNetPayableInPaise` (Real total receivables)
- **Reconciliation Fix:**
  Update `server/controllers/admin.controller.js:getStats` to run a read-only aggregation on `FeeInvoice`:
  ```javascript
  const [feeAgg] = await FeeInvoice.aggregate([
    { $match: { status: { $ne: 'cancelled' } } },
    { $group: { _id: null, totalCollectedInPaise: { $sum: '$amountPaidInPaise' } } },
  ]);
  const feeCollectionInRupees = feeAgg ? Math.round(feeAgg.totalCollectedInPaise / 100) : 0;
  ```
  And in `AdminDashboard/index.jsx`, render:
  ```jsx
  <div className="ds-stat-value">
    {stats?.feeCollection != null ? `₹${stats.feeCollection.toLocaleString('en-IN')}` : '₹0'}
  </div>
  ```

---

### 3.2 Student Management Table Discrepancy
- **Admin Dashboard:** Loops over static `STUDENTS` array (`Arjun Sharma`, `Priya Mehta`, `Rahul Gupta`, `Sneha Patel`, `Karan Singh`).
- **Admin Users Module (`/admin/users`):** Fetches real student users via `GET /api/admin/users?role=student` with pagination, text search, and real statuses.
- **Reconciliation Fix:**
  In `AdminDashboard/index.jsx`, fetch real students using `adminService.getUsers({ role: 'student', limit: 5 })`. Render real student names, roll numbers, branches, and statuses. If no students exist, render `.cs-empty-state`.

---

### 3.3 Student Academic CGPA Discrepancy
- **Student Dashboard:** Calculates `(results.reduce(...) / results.length / 10).toFixed(1)`, or falls back to `'8.6'`.
- **Student Results Module (`/student/results`):** Calls `/api/student/results`, where `exam.controller.js:calculateSemesterResult` calculates authoritative UGC credit-weighted grade points:
  $$\text{SGPA} = \frac{\sum (\text{Credits}_i \times \text{GradePoint}_i)}{\sum \text{Credits}_i}$$
- **Reconciliation Fix:**
  In `StudentDashboard/index.jsx`, consume `resRes.summary?.cgpa` or `resRes.summary?.sgpa` directly from the backend response. If no published marks exist, display `'—'` or `'N/A'` with a label `'Awaiting published results'` rather than fabricating `'8.6'`.

---

### 3.4 Student Enrolled Courses Discrepancy
- **Student Dashboard:** Renders static `coursesList` with fake teachers.
- **Student Profile / Timetable (`/student/timetable`):** Contains real scheduled subjects and faculty allocations from `Timetable` and `Subject` collections.
- **Reconciliation Fix:**
  Fetch the student's actual enrolled subjects via `studentService.getProfile()` (populated `student.subjects`) or `studentService.getTimetable()`. Display real course codes, subject titles, and assigned faculty names.

---

### 3.5 Faculty Timetable Fallback Discrepancy
- **Faculty Dashboard:** When `timetable.length === 0`, injects 5 fake classes with functional "Mark Attendance" buttons.
- **Faculty Timetable Module (`/faculty/timetable`):** Correctly shows empty periods when no classes are scheduled.
- **Reconciliation Fix:**
  Remove the fake 5-class fallback array completely. If `timetable.length === 0`, render:
  ```jsx
  <div className="cs-empty-state">
    <div className="cs-empty-icon"><CalendarCheck size={28} /></div>
    <div className="cs-empty-title">No Classes Scheduled Today</div>
    <div className="cs-empty-desc">You have no teaching periods scheduled for {currentDayName}.</div>
  </div>
  ```

---

## 4. Cache Invalidation and Data Refresh Lifecycle

| Workflow Action | Triggering Component / Page | Current Cache Behavior | Required Invalidation Target |
| :--- | :--- | :--- | :--- |
| **Mark Attendance** | `FacultyAttendance` / `FacultyDashboard` | Local component state update only. | Invalidate `GET /api/faculty/overview`, `GET /api/student/attendance`, and `GET /api/admin/attendance/overview`. |
| **Publish Marks** | `FacultyResults` | Local table update. | Invalidate `GET /api/student/results` and update student CGPA cache. |
| **Fee Payment / Verification** | `StudentFees` / `AdminFinance` | Updates transaction list in view. | Invalidate `GET /api/fees/admin/metrics`, `GET /api/admin/stats`, and student fee overview. |
| **Resolve Complaint** | `AdminDashboard` / `Complaints` | Optimistic local state update (`setComplaints`). | Re-fetch `/api/admin/stats` to synchronize `pendingComplaints` count. |
| **Update Timetable** | `AdminTimetable` | Local grid re-fetch. | Invalidate cached timetable queries in Student and Faculty dashboards. |

---

## 5. Explicit Empty & Unavailable State Design Rules

To ensure strict compliance with institutional transparency and truthfulness:

1. **Zero Silent Fallbacks:** Under no circumstances should an arithmetic or string default (`?? 4536`, `?? 88`, `?? '8.6'`, `?? 8`) mask missing database records.
2. **Explicit Null Representation:** When a metric has not been calculated or has zero records:
   - Attendance percentage: Display `—` (em dash) with caption `"No sessions recorded"`.
   - CGPA / SGPA: Display `—` with caption `"Pending examination evaluation"`.
   - Fee collection: Display `₹0` with caption `"No completed collections"`.
3. **Dedicated Empty State Components:** All lists and tables must use `.cs-empty-state` with an appropriate Lucide icon, headline, explanatory description, and optional actionable link.

---

## 6. Implementation Remediation Matrix

| Defect Code | Dashboard | Issue Description | Remediation Task | Effort |
| :--- | :--- | :--- | :--- | :--- |
| **DB-DATA-01** | Admin | Total Students & Total Faculty fallback to 4536 and 200. | Remove fallback values in `AdminDashboard/index.jsx:134,139`. Use loading skeleton or `0`. | 1 hr |
| **DB-DATA-02** | Admin | Fee Collection hardcoded to `"Rs. 42L"`. | Connect to `/api/fees/admin/metrics` aggregation and format real collection total. | 2 hrs |
| **DB-DATA-03** | Admin | 5 fake students hardcoded in student management table. | Replace `STUDENTS` array with real `adminService.getUsers({ role: 'student', limit: 5 })`. | 2 hrs |
| **DB-DATA-04** | Student | Attendance defaults to 88% and displays 7 fake fallback classes. | Remove `fallbackAttendance` and 88% default. Render `.cs-empty-state` when attendance is empty. | 2 hrs |
| **DB-DATA-05** | Student | CGPA defaults to '8.6' and uses crude `marks / 10` formula. | Consume authoritative credit-weighted `summary.cgpa` from `examController`. Display `—` if empty. | 2 hrs |
| **DB-DATA-06** | Student | Enrolled courses grid uses static 5-course array. | Fetch real student enrolled courses from profile or timetable. | 2 hrs |
| **DB-DATA-07** | Faculty | Assigned students count falls back to 8. | Remove `?? 8` in `FacultyDashboard/index.jsx:156`. Display real count or `0`. | 1 hr |
| **DB-DATA-08** | Faculty | 5 fake classes rendered with active Mark Attendance buttons when timetable is empty. | Remove fake timetable array. Render clean empty schedule illustration and message. | 1.5 hrs |
