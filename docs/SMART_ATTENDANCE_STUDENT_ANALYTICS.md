# CampusSphere AI — Student Attendance Analytics
## Part 10: Student Dashboard, Attendance Trends & Progress Tracking

---

## 1. Overview

The Student Attendance portal provides students with clear, real-time insight into their academic attendance records, compliance standing, and trajectory over time. All figures derive strictly from finalized and completed sessions computed by the authoritative calculation engine in Indian Standard Time (`Asia/Kolkata`).

---

## 2. Information Architecture & Key Displays

### 2.1 Executive Summary Cards
Located at the top of the student dashboard, four KPI cards summarize the student's current academic position:

| Card | Computation | Meaning / Policy Context |
|---|---|---|
| **Overall Attendance** | $\frac{\sum \text{Attended Units}}{\sum \text{Held Units}} \times 100$ | Color-coded: Green ($\ge 75\%$), Red ($< 75\%$). Flags exam debarment risk if below 75%. |
| **Total Classes Held** | $\sum \text{Finalized Academic Units}$ | Excludes unfinalized, cancelled, and scheduled sessions. Multi-period labs count their full unit count. |
| **Classes Attended** | $\sum \text{Present or Late Units}$ | Confirmed units verified via Face Recognition or authorized manual overrides. |
| **Classes Missed** | $\text{Held Units} - \text{Attended Units}$ | Absences recorded across all enrolled curriculum courses. |

### 2.2 Attendance Alert Banner
Displayed dynamically if and only if:
1. Academic classes have actually been held (`summary.hasRecords === true`), AND
2. The overall unrounded attendance falls below the institutional threshold (e.g. $< 75\%$).
*Notice:* If 0 classes have been held, no false alarm is triggered.

---

## 3. Subject-Wise Attendance Breakdown Table

For every subject in the student's enrolled semester and branch curriculum:

| Column | Data Source | Invariant / Display Rule |
|---|---|---|
| **Subject Name** | `Subject.name` | Bold title of the academic course |
| **Code** | `Subject.code` | Course catalog code (e.g. `CS401`) |
| **Faculty** | `Subject.faculty.name` | Assigned faculty member |
| **Total Classes** | `HeldUnits` | Total finalized eligible academic units |
| **Attended** | `AttendedUnits` | Attended units |
| **Missed** | `MissedUnits` | $\max(0, \text{Held} - \text{Attended})$ |
| **Progress** | Visual Progress Bar | Color-coded: green ($\ge 75\%$), amber ($60\% - 74\%$), red ($< 60\%$) |
| **Percentage** | Display Percentage | Unrounded raw calculation formatted as integer or `—` if 0 held |
| **Requirement** | Institutional Policy | Dynamic threshold from `AttendanceSettings` (75%) |
| **Status** | Compliance Status | `Good` ($\ge 75\%$), `Warning` ($60\% - 74\%$), `Critical` ($< 60\%$), `No Data` (0 held) |

---

## 4. Finalized Attendance Trend Visualization

The dashboard includes a dedicated Attendance Trajectory Card displaying student progression over time.

### 4.1 Trajectory Controls
- **Weekly View:** Groups sessions by calendar week (Monday to Sunday) in `Asia/Kolkata` time.
- **Monthly View:** Groups sessions by calendar month (e.g., `2026-04`).

### 4.2 Chart Properties
- Visual bar heights proportional to attendance percentage.
- Color gradient based on compliance standing.
- Explicit tooltips indicating held vs attended unit breakdown.
- Distinct rendering for **0% attendance** (classes held but student missed all) vs **No Data / Unavailable** (no classes scheduled or held).

---

## 5. Live Smart Attendance Check-in Banner

When faculty starts a live smart attendance session for the student's cohort, an interactive blue banner appears with pulsing indicator:
- Displays subject name, code, instructor, period, and scheduled time window.
- Provides one-click **"Join & Verify Face"** action routing directly to the camera face-verification console.
- If already marked present, displays a confirmed checkmark badge: `✓ Attendance Marked Present`.

---

## 6. Export Functionality

Students can export their verified academic attendance ledger:
- Action: **Export Report** button located in the header right.
- Format: Sanitized RFC-4180 CSV via `GET /api/attendance/reports/export?reportType=student_report`.
- Security: Strictly scoped to the authenticated student's user ID.

