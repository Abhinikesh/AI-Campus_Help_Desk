# Smart Attendance Authoritative Calculation Service

**Service Path:** `server/services/attendanceCalculation.service.js`  
**Integration Status:** Complete & Active across Node.js Controllers, Python AI microservice, and React Frontend  
**Test Suite:** `server/tests/attendance_calculation.test.js` (33 passing tests)

---

## 1. Architectural Role

`attendanceCalculationService` is the single source of truth for all attendance calculations across the CampusSphere AI ecosystem. It replaces scattered, inconsistent ad-hoc computations previously embedded in individual Express route handlers and client React components.

```
       ┌───────────────────────────────┐
       │   React Client (Vite 8)       │
       │  /student/attendance          │
       │  /faculty/dashboard           │
       └───────────────┬───────────────┘
                       │ HTTP REST
                       ▼
       ┌───────────────────────────────┐
       │  Express Controllers          │
       │  student.controller.js        │
       │  faculty.controller.js        │
       │  attendance.controller.js     │
       └───────────────┬───────────────┘
                       │
                       ▼
       ┌─────────────────────────────────────────────────────────────┐
       │      AttendanceCalculationService (Authoritative)           │
       │                                                             │
       │  • getAcademicUnits(sessionOrRecord)                        │
       │  • getIndianAcademicDate(date)                              │
       │  • resolveSettings()                                        │
       │  • calculateStudentSubjectAttendance()                      │
       │  • calculateStudentOverview()                               │
       │  • calculateFacultyMetrics()                                │
       │  • calculateDepartmentAnalytics()                           │
       └──────────────┬──────────────────────────────┬───────────────┘
                      │                              │
                      ▼                              ▼
             ┌─────────────────┐           ┌──────────────────┐
             │ MongoDB Models  │           │ Python AI Engine │
             │ (Mongoose 8)    │           │ (ai-service:5002)│
             └─────────────────┘           └──────────────────┘
```

---

## 2. API Reference

### 2.1 `getAcademicUnits(item: Object): number`
Calculates the number of academic periods represented by a session or attendance record.
- Inspects `item.periodCount` (if positive integer).
- Inspects `item.periods.length` (if array).
- Defaults to `1`.

### 2.2 `getIndianAcademicDate(date?: Date): string`
Formats any `Date` instance into the canonical academic calendar date (`YYYY-MM-DD`) in `Asia/Kolkata` (UTC+5:30), preventing UTC cross-midnight date boundary mismatches.

### 2.3 `calculateStudentSubjectAttendance(params): Promise<SubjectMetrics>`
**Parameters:**
- `studentId`: ObjectId | string
- `subjectId`: ObjectId | string
- `startDate`: string (`YYYY-MM-DD`, optional)
- `endDate`: string (`YYYY-MM-DD`, optional)
- `includeUnfinalized`: boolean (default `false`)

**Returns:**
```json
{
  "subjectId": "6ae484fe33ec3feced5107ee",
  "hasData": true,
  "heldUnits": 10,
  "attendedUnits": 8,
  "missedUnits": 2,
  "excusedUnits": 0,
  "rawPercentage": 80.0,
  "displayPercentage": 80,
  "percentage": 80,
  "complianceStatus": "Good",
  "minThreshold": 75,
  "meetsRequirement": true
}
```

### 2.4 `calculateStudentOverview(params): Promise<StudentOverview>`
Aggregates subject-level calculations across all enrolled courses for the student's branch and semester. Excludes zero-held subjects from overall divisor calculations while presenting them clearly in the subject breakdown with `hasData: false` and `status: 'No Data'`.

### 2.5 `calculateFacultyMetrics(facultyUserId): Promise<FacultyMetrics>`
Computes real-time, non-fabricated metrics for faculty dashboards:
- `assignedStudentsCount`: True count of distinct students enrolled in sections taught by this instructor (eliminates hardcoded 124).
- `classesToday`: Sessions scheduled on current Indian academic date.
- `sessionsConducted`: Number of completed/finalized sessions.
- `averageAttendance`: Weighted average attendance across all conducted classes.
- `hasAttendanceData`: Boolean indicator for clean zero-state display.

