# CampusSphere AI — Part 15: Existing Scheduling, Timetable & Calendar Audit

## 1. Executive Summary

This document presents the Phase A discovery audit for **CampusSphere AI — Part 15: Academic Calendar, Timetable Management & Scheduling Integration**.

The audit inspected existing backend models (`Timetable.js`, `AttendanceSession.js`, `Subject.js`, `Faculty.js`, `Student.js`, `Exam.js`, `Assignment.js`, `Notification.js`), backend controllers and routes (`faculty.controller.js`, `attendance.controller.js`, `student.controller.js`, `admin.routes.js`), and frontend client pages (`pages/FacultyTimetable/`, `pages/FacultyDashboard/`, `pages/StudentDashboard/`, `pages/AdminDashboard/`).

---

## 2. Detailed Findings by Subsystem

### 2.1. Backend Models

1. **`Timetable.js` (`server/models/Timetable.js`):**
   - **Current State:** A minimal 40-line stub created during initial repository setup. It contains only:
     - `subject` (ref: `Subject`, required)
     - `dayOfWeek` (Number 0–6, required)
     - `startTime` (String, required)
     - `endTime` (String, required)
     - `room` (String, default: `'TBA'`)
   - **Critical Gaps:**
     - Missing academic cohort scoping (`academicYear`, `semester`, `department`/`branch`, `section`, `batch`).
     - Missing faculty assignment (`faculty`: ref `User`/`Faculty`).
     - Missing period tracking (`periodNumber` / `periodCount` for multi-period labs).
     - Missing publication state machine (`status`: `draft`, `published`, `archived`, `cancelled`).
     - Missing versioning (`versionNumber`, `versionId`).
     - Missing effective date range (`effectiveStartDate`, `effectiveEndDate`).
     - Missing audit trail (`changeHistory`: previous slot, new slot, changedBy, reason, timestamp).
     - Missing compound indexes for faculty conflict checks, room conflict checks, and cohort conflict checks.

2. **`AttendanceSession.js` (`server/models/AttendanceSession.js`):**
   - **Confirmed Capability:** Contains `timetableEntry: { type: ObjectId, ref: 'Timetable', default: null }`.
   - **Current State:** `createAttendanceSession` in `attendance.controller.js` accepts `req.body.timetableEntry`.
   - **Integration Boundary:** Attendance is strictly derived from verified facial/QR attendance sessions. Timetable entries represent *scheduled expectations*, while attendance sessions represent *conducted reality*. This boundary must be preserved without coupling calculation logic to raw timetable slots.

3. **`AcademicCalendarEvent` (Missing):**
   - **Current State:** No dedicated calendar event model exists in `server/models/`.
   - **Gaps:** Institutional events (semester start/end, holidays, examination periods, sports days, symposiums, assignment deadlines) cannot currently be stored or queried in a unified academic calendar.

4. **`Exam.js` (Part 14) & `Assignment.js` (Part 13):**
   - **Confirmed Capability:**
     - `Exam.js` contains `title`, `examinationType`, `academicYear`, `department`, `semester`, `section`, `subject`, `faculty`, `date`, `startTime`, `endTime`, `room`, `status`.
     - `Assignment.js` contains `title`, `subject`, `faculty`, `department`, `semester`, `section`, `dueDate`, `status`.
   - **Architectural Requirement:** The centralized calendar must dynamically resolve or link to these existing records as authoritative sources rather than duplicating exam dates and assignment deadlines into disconnected event rows.

5. **`Notification.js` & `NotificationPreference.js` (Part 12 / 12.1):**
   - **Confirmed Capability:** Both models already include `'timetable'` in their category enums and preferences (`timetable: { type: Boolean, default: true }`).
   - **Gaps:** No scheduling controller currently dispatches notifications upon timetable publication, rescheduling, or class cancellation.

---

### 2.2. Backend Controllers & API Endpoints

1. **`faculty.controller.js` (`getTimetable`):**
   - **Current Implementation:** Queries `Timetable.find({ subject: { $in: subjectIds } })`.
   - **Defect/Gap:** Contains a hardcoded fallback returning static Monday–Friday classes if no DB records are found.
   - **Remediation:** Remove static fallback. Return genuine database-backed schedules with proper empty-state responses.

2. **`student.controller.js`:**
   - **Current Implementation:** Has routes for `profile`, `attendance`, `exams`, `results`, `complaints`, `fees`.
   - **Defect/Gap:** Has NO timetable or academic calendar endpoint for students. Students have no way to retrieve their weekly class schedule.

3. **`admin.controller.js` & `admin.routes.js`:**
   - **Current Implementation:** Admin has endpoints for attendance audits, biometric purges, and complaints.
   - **Defect/Gap:** Has NO timetable authoring, conflict checking, calendar creation, or publication endpoints.

---

### 2.3. Frontend Components & User Portals

1. **`FacultyTimetable/index.jsx` (`client/src/pages/FacultyTimetable/`):**
   - Renders a read-only table for faculty with days, times, subjects, and rooms.
   - Has a "Start Attendance" link pointing to `/faculty/attendance`.
   - Lacks daily view, schedule filtering, calendar integration, or cancellation/rescheduling notices.

2. **`FacultyDashboard/index.jsx` (`client/src/pages/FacultyDashboard/`):**
   - Has a "Today's Schedule" card rendering `timetable`.
   - Needs direct action to launch Smart Attendance with prepopulated timetable metadata.

3. **`StudentDashboard/index.jsx` & Navigation:**
   - Sidebar does not currently feature a "Timetable & Calendar" link for students.
   - Students cannot view upcoming holidays, lecture schedules, or assignment deadlines on a unified calendar.

4. **`AdminDashboard/index.jsx` & Navigation:**
   - Admin currently lacks a Timetable & Academic Calendar management portal to create events, configure class slots, run conflict analysis, and publish versions.

---

## 3. Duplication & Architecture Risks

| Risk Area | Risk Description | Architectural Rule to Prevent |
| :--- | :--- | :--- |
| **Duplicate Timetable Pages** | Creating separate pages for students vs faculty vs admins instead of unified/reusable components. | Maintain `/faculty/timetable`, add `/student/timetable`, and add `/admin/timetable` with shared calendar/table subcomponents. |
| **Exam & Assignment Duplication** | Storing duplicates of exams or assignment deadlines in the calendar collection. | The Academic Calendar query aggregation must dynamically union `AcademicCalendarEvent`, published `Exam` records, and published `Assignment` deadlines. |
| **Attendance Desynchronization** | Attempting to calculate student attendance percentages from timetable slots. | Timetable entries only supply reference metadata to `AttendanceSession`. Real attendance is solely calculated from finalized `AttendanceRecord` documents. |
| **Frontend-Only Conflict Checks** | Relying on UI client logic to prevent double bookings. | Backend services must strictly enforce overlap checks across faculty, room, and student cohorts before creating or updating any timetable entry. |
| **Timezone Drift (IST vs UTC)** | Inconsistent string vs UTC date conversions shifting all-day calendar events or periods. | Standardize on `Asia/Kolkata` (UTC+5:30) date boundaries and ISO-8601 UTC timestamps. |

