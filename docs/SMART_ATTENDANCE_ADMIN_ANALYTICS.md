# CampusSphere AI — Administrator Attendance Analytics
## Part 10: Institutional Oversight, Department Analytics & Academic Risk Management

---

## 1. Executive Overview

The Administrator Attendance Oversight Center provides college deans, department heads, and academic registrars with institution-wide visibility into smart attendance operations across all campus departments, academic semesters, and course sessions.

---

## 2. Institutional KPI Monitoring

The administrator dashboard tracks university-wide metrics computed via `attendanceCalculationService.calculateAdminInstitutionOverview()`:

- **Total Active Students:** Distinct count of active enrolled students in the database.
- **Total Academic Departments:** Dynamically resolved from student and subject catalogs (e.g. CSE, IT, ECE, MECH, CIVIL, EE).
- **Total Active Curriculum Subjects:** Total active courses cataloged across all semesters.
- **Finalized Class Sessions:** Total attendance sessions with terminal status `finalized` or `completed`.
- **Campus Overall Attendance Rate:** Institution-wide percentage of attended academic units over total possible units.
- **Campus Students At Risk:** Count of students falling below the institutional policy threshold ($T = 75\%$).

---

## 3. Department-Level & Cohort Analytics

### 3.1 Department Attendance Breakdown
Aggregated per branch without hardcoded enumerations:
- Department name and active student count.
- Finalized sessions and total academic held units.
- Departmental attendance rate.
- Count of students in each department requiring attendance intervention.

### 3.2 Class-Wise Attendance Distribution
Dynamic class groupings (e.g. `CSE Semester 4`, `ECE Semester 6`):
- Enrolled cohort student count.
- Cohort average attendance percentage.
- Count of students in the cohort falling below the 75% threshold.

---

## 4. Campus Academic Risk Register

The Risk Register aggregates all students across the institution whose unrounded attendance is below the configured threshold:

$$\text{DeficitUnits} = \max\left(0, \left\lceil \frac{T \times \text{HeldUnits} - 100 \times \text{AttendedUnits}}{100} \right\rceil\right)$$

### Register Columns:
1. **Roll Number:** Student registration identifier.
2. **Student Name:** Full legal student name.
3. **Department:** Department / branch of study.
4. **Class:** Semester and section cohort.
5. **Units Held:** Total finalized academic units held across all enrolled courses.
6. **Units Attended:** Attended academic units.
7. **Percentage:** Current unrounded attendance rate.
8. **Deficit Units:** Exact integer deficit required to reach compliance.
9. **Risk Level:** `Critical Risk` ($< 60\%$) or `Warning Risk` ($60\% - 74\%$).

---

## 5. Manual Attendance Adjustment Audit Trail

Provides complete administrative transparency into manual corrections performed by faculty or administrators:
- **Timestamp:** Formatted in Asia/Kolkata (`YYYY-MM-DD HH:mm:ss IST`).
- **Student:** Target student name and roll number.
- **Subject & Period:** Course title, date, and period.
- **Status Change:** Previous status $\to$ Updated status.
- **Authorized Actor:** Name and role of the modifier.
- **Mandatory Justification:** Mandatory reason supplied.
- **Audit Immutability:** Audit records cannot be modified or deleted via UI or API.

---

## 6. Official 8-in-1 Report Export Center

An integrated export selector allowing administrators to generate and download all 8 practical academic report types:
1. `department_report` — Department-Wise Attendance Report
2. `low_attendance_report` — Low Attendance Student Risk Report
3. `faculty_report` — Faculty Performance Report
4. `semester_section_report` — Semester / Section Report
5. `manual_adjustment_report` — Manual Adjustment Audit Report
6. `subject_wise_report` — Subject-Wise Attendance Report
7. `session_wise_report` — Session-Wise Attendance Report
8. `student_report` — Student Attendance Report

Exports are formatted according to RFC-4180 with spreadsheet formula injection protection.

