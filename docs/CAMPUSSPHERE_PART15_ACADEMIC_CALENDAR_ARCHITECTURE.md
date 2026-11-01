# CampusSphere AI — Part 15: Academic Calendar & Timetable Architecture

## 1. Executive Summary

The Academic Calendar, Timetable Management & Scheduling subsystem of CampusSphere AI provides an enterprise-grade academic planning, conflict detection, versioning, and unified event aggregation infrastructure.

It bridges regular recurring lecture periods, multi-period laboratory blocks, institutional holidays, Examination Management (Part 14), Assignment Deadlines (Part 13), Smart Attendance (Part 6–8), and the Centralized Notification Engine (Part 12.1).

---

## 2. Architectural Pillars

```
+---------------------------------------------------------------------------------------------------+
|                                            ACTORS                                                 |
|    +--------------------+       +----------------------+       +-----------------------------+    |
|    |      STUDENT       |       |       FACULTY        |       |        ADMINISTRATOR        |    |
|    +--------------------+       +----------------------+       +-----------------------------+    |
+--------------|-----------------------------|----------------------------------|-------------------+
               |                             |                                  |
               v                             v                                  v
+---------------------------------------------------------------------------------------------------+
|                                 FRONTEND INTERFACE LAYER (React 19)                               |
|  - /student/timetable (Lectures & Calendar) - /faculty/timetable (Teaching Hub) - /admin/timetable|
|  - Day filters, Category toggles            - Direct Smart Attendance launch    - Conflict Alerts |
+----------------------------------------------|----------------------------------------------------+
                                               | REST / JSON
                                               v
+---------------------------------------------------------------------------------------------------+
|                                 BACKEND API ROUTING & ACCESS CONTROL                              |
|  - /api/timetable (Student, Faculty, Admin)                                                      |
|  - /api/calendar  (Events, Upcoming Widgets)                                                      |
|  - Middlewares: authMiddleware, allowRoles(['student', 'faculty', 'admin'])                       |
+----------------------------------------------|----------------------------------------------------+
                                               |
                     +-------------------------+-------------------------+
                     |                                                   |
                     v                                                   v
+-----------------------------------------------+       +-------------------------------------------+
|               CORE SERVICES                   |       |              DATA ENTITIES                |
|  - schedulingConflict.service.js              |       |  - Timetable.js (Weekly recurring)        |
|    (Faculty, Class, Room, Holiday, Exam)     |       |  - AcademicCalendarEvent.js (Institutional)|
|  - academicCalendar.service.js                |       |  - TimetableVersion.js (Audited snapshots)|
|    (Dynamic Union of Events, Exams, Asgns)    |       |  - AttendanceSession.js (Linkage)         |
|  - notification.service.js (Alert dispatch)   |       |  - Exam.js & Assignment.js (Integrations) |
+-----------------------------------------------+       +-------------------------------------------+
```

---

## 3. Subsystem Separation & Principles

1. **Separation of Scheduling from Attendance Calculation:**
   - Timetable slots define *planned academic expectations*.
   - Attendance sessions and attendance calculations represent *verified physical reality*.
   - Timetable entries provide reference metadata (`timetableEntry: ObjectId`), but zero attendance credit is ever inferred from a timetable slot without verified biometric or faculty-finalized attendance records.

2. **Zero Duplicate Source of Truth:**
   - Examinations (Part 14) are authored and managed in `Exam.js`. The calendar aggregates exams dynamically via `academicCalendar.service.js` rather than copying exam records into calendar event rows.
   - Assignment deadlines (Part 13) are authored in `Assignment.js`. The calendar reads published `dueDate` records dynamically.

3. **Backend-Enforced Conflict Invariant:**
   - Client-side validation assists user experience, but all overlap checks (faculty, class cohort, classroom, holidays, and examination collisions) are strictly enforced server-side before persisting records.

4. **Multi-Tier Audience Boundaries:**
   - Institutional events are visible to all students and faculty.
   - Department- or semester-scoped events are only visible to students and faculty belonging to that cohort.
   - Faculty senate meetings and administrative deliberations are strictly invisible to students.

