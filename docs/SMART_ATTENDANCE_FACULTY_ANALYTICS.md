# CampusSphere AI — Faculty Attendance Analytics
## Part 10: Faculty Reports, Class Metrics & Student Risk Detection

---

## 1. Overview

The Faculty Attendance Analytics system empowers course instructors and department professors to track student engagement across their teaching assignments, evaluate course-level attendance health, intervene early for students falling behind, and review manual attendance overrides with complete audit transparency.

---

## 2. Authorization Scoping & Security

### 2.1 Authorized Teaching Assignment Boundary
Faculty members are strictly authorized to view attendance statistics, session ledgers, and student records for courses they teach:
- Handled at the database level via `attendanceCalculationService.calculateFacultyDetailedReport({ facultyUserId })`.
- If a faculty member attempts to query an unauthorized subject ID or cohort via request parameters, the system raises an explicit `403 Forbidden` / `Unauthorized` error.

### 2.2 True Student Enrollment Accounting
Static or mock counters (such as hardcoded `124`) have been eliminated. Assigned student counts are dynamically derived by resolving the true distinct student count across the sections and semesters taught by the instructor.

---

## 3. Key Metrics & Visualizations

### 3.1 Faculty KPI Cards
1. **Class Attendance Average:** Weighted attendance percentage across all conducted course sessions.
2. **Monitored Courses:** Total count of active curriculum subjects assigned to the faculty member.
3. **Students At Risk (< 75%):** Count of enrolled students whose current attendance falls below the minimum institutional requirement.
4. **Monthly Trajectory:** Real aggregated monthly trend comparing attendance rates across the semester.

### 3.2 Subject-Wise Performance Breakdown
Presents a comparative progress bar for every course taught:
- Course title, catalog code, and semester.
- Total sessions conducted and total academic held units.
- Present records vs total roster entries.
- Unrounded attendance percentage and compliance badge.

### 3.3 Semester Monthly Trajectory Bar Chart
Visualizes month-by-month attendance performance computed in Indian Standard Time (`Asia/Kolkata`).

---

## 4. Low Attendance Warning Register with Academic Deficit

Students falling below the configured threshold ($T = 75\%$) are listed in the dedicated risk register:

| Field | Meaning |
|---|---|
| **Roll Number** | University student enrollment ID |
| **Student Name** | Student full name |
| **Total Classes** | Total academic units held across instructor's sessions |
| **Attended** | Attended academic units |
| **Current Percentage** | Actual attendance percentage |
| **Deficit Units** | Minimum additional units required to recover compliance: $\max\left(0, \left\lceil \frac{T \times \text{Held} - 100 \times \text{Attended}}{100} \right\rceil\right)$ |
| **Status** | `Warning` ($60\% - 74\%$) or `Critical` ($< 60\%$) |

---

## 5. Manual Attendance Adjustment Audit History

Any manual attendance override performed by the faculty or administrator creates an immutable append-only record in `AttendanceAuditLog`:
- **Timestamp (IST):** Exact date and time in Asia/Kolkata timezone.
- **Student:** Name and roll number of the student.
- **Subject & Session:** Course name, session date, and period.
- **Previous & Updated Status:** Transition (e.g. `absent` $\to$ `present`).
- **Authorized Actor:** Name and role of the faculty member or administrator.
- **Mandatory Justification:** Mandatory reason provided at time of correction (e.g. "Medical certificate verified by department head").

---

## 6. Report Filtering & Export Controls

- **Subject Selector:** Allows filtering all cards, registers, and adjustments by a specific assigned course.
- **Export CSV Button:** Directly triggers `GET /api/attendance/reports/export?reportType=faculty_report` or `low_attendance_report`, delivering an RFC-4180 compliant CSV protected against formula injection.

