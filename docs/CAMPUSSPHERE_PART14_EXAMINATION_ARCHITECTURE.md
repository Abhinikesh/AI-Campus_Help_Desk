# CampusSphere AI — Part 14: Examination Architecture

## 1. Executive Summary

The Examination Management, Marks Entry & Result Publication subsystem of CampusSphere AI provides an enterprise-grade academic evaluation infrastructure. It unifies examination scheduling, room allocation, cohort eligibility, faculty marks entry, multi-tier review and approval, secure result publication, and tamper-evident audited corrections.

The architecture strictly adheres to Indian University Grants Commission (UGC) 10-point grading standards, enforces anti-self-approval mechanisms for evaluation integrity, ensures complete data isolation across student cohorts, and integrates directly with the Part 12 centralized notification system.

---

## 2. Architectural Pillars

```
+-----------------------------------------------------------------------------------+
|                                 USER PERSONAS                                     |
|    +--------------------+    +--------------------+    +---------------------+    |
|    |      STUDENT       |    |      FACULTY       |    |        ADMIN        |    |
|    +--------------------+    +--------------------+    +---------------------+    |
+--------------|--------------------------|-------------------------|---------------+
               |                          |                         |
               v                          v                         v
+-----------------------------------------------------------------------------------+
|                           FRONTEND REACT APPLICATION                              |
|  - /student/exams (Timetable)  - /faculty/results (Hub)  - /admin/exams (Metrics) |
|  - /student/results (Grades)   - Marks Entry & Roster    - Approval & Audits      |
+-----------------------------------------|-----------------------------------------+
                                          | REST / JSON
                                          v
+-----------------------------------------------------------------------------------+
|                             BACKEND API LAYER                                     |
|  Routes: /api/exams/*                                                             |
|  Controllers: exam.controller.js, student.controller.js                           |
|  Middlewares: authMiddleware, requireRole(['faculty', 'admin', 'student'])        |
+-----------------------------------------|-----------------------------------------+
                                          |
                 +------------------------+------------------------+
                 |                                                 |
                 v                                                 v
+----------------------------------+     +------------------------------------------+
|       BUSINESS SERVICES          |     |          DATA PERSISTENCE                |
|  - resultCalculation.service.js  |     |  - Exam Model (server/models/Exam.js)    |
|  - notification.service.js       |     |  - Mark Model (server/models/Mark.js)    |
|  - Validation & Conflict Engines |     |  - Compound Indexes & Constraints        |
+----------------------------------+     +------------------------------------------+
```

### 2.1. Separation of Responsibilities

1. **Faculty Operations:**
   - Schedule examinations for assigned subjects within their academic department.
   - Retrieve enrolled cohort rosters dynamically based on subject, branch, and semester.
   - Enter marks in draft state with real-time numeric bounds validation.
   - Submit completed evaluation rosters for institutional review.
   - Request post-publication marks corrections with mandatory justifications.

2. **Admin Operations:**
   - Oversee institution-wide examination schedules and room bookings.
   - Review and approve faculty-submitted evaluation rosters.
   - Enforce anti-self-approval invariants (instructors cannot approve their own submissions unless acting under verified administrative oversight).
   - Authorize and execute audited post-publication mark corrections.
   - Publish approved examination results institutional-wide.

3. **Student Operations:**
   - View scheduled upcoming examinations filtered strictly by department, semester, and enrolled subjects.
   - View published academic performance (marks obtained, maximum marks, percentage, UGC letter grade, and credit points).
   - Calculate semester GPA and cumulative CGPA across published courses.
   - Complete masking of unapproved, draft, or pending evaluation data.

---

## 3. Examination Lifecycle State Machine

An examination progresses through two parallel state machines: **Scheduling Lifecycle** and **Evaluation Lifecycle**.

### 3.1. Scheduling Lifecycle

```
    [ Draft ]
        |
        v
  [ Scheduled ]  <--->  [ Cancelled ]
        |
        v
   [ Ongoing ]
        |
        v
  [ Completed ]
        |
        v
  [ Archived ]
```

- **`draft`**: Examination is drafted by faculty or admin; invisible to students.
- **`scheduled`**: Examination is finalized and published on student timetables.
- **`ongoing`**: Examination date and window is actively in progress.
- **`completed`**: Examination window has elapsed; eligible for marks entry.
- **`cancelled`**: Examination aborted due to scheduling conflict or emergency; excluded from timetables.
- **`archived`**: Historical record preserved for institutional compliance.

### 3.2. Evaluation Lifecycle

```
[ marks_pending ]
        |
        | (Faculty enters scores & saves draft)
        v
[ marks_pending (draft saved) ]
        |
        | (Faculty submits roster for review)
        v
[ submitted_for_review ]
        |
        | (Admin or independent reviewer verifies)
        v
    [ approved ]
        |
        | (Faculty / Admin publishes)
        v
   [ published ]  <--->  [ correction_requested ]  ---> [ Audited Correction ]
```

- **`marks_pending`**: Default state upon exam completion. Marks may be saved as drafts (`status: draft`).
- **`submitted_for_review`**: Faculty finalizes marks entry and submits the roster. Marks are locked against further faculty modification.
- **`approved`**: Independent reviewer or Admin verifies the submitted marks.
- **`published`**: Marks are finalized and visible to students. Notifications dispatched.
- **`correction_requested`**: Flagged when an anomaly, re-evaluation request, or clerical error is identified post-publication.

---

## 4. Integration with Core ERP Subsystems

### 4.1. Centralized Notification Integration (Part 12)
- **Exam Scheduling:** When an examination is scheduled, all enrolled students in the cohort receive an `examination` category notification containing date, time, venue, and subject.
- **Result Publication:** Upon publication, all enrolled students receive high-priority alerts notifying them of their results.
- **Marks Correction:** When an audited mark correction is executed, the affected student receives an immediate alert detailing the revised score and administrative reason.

### 4.2. Academic Integrity & Grading Service
- Evaluates scores against the standardized UGC 10-point scale:
  - `90% - 100%`: **O** (Outstanding, 10.0 Grade Point)
  - `80% - 89.99%`: **A+** (Excellent, 9.0 Grade Point)
  - `70% - 79.99%`: **A** (Very Good, 8.0 Grade Point)
  - `60% - 69.99%`: **B+** (Good, 7.0 Grade Point)
  - `55% - 59.99%`: **B** (Above Average, 6.0 Grade Point)
  - `50% - 54.99%`: **C** (Average, 5.0 Grade Point)
  - `40% - 49.99%`: **P** (Pass, 4.0 Grade Point)
  - `< 40%`: **F** (Fail, 0.0 Grade Point)
- Absenteeism (`isAbsent: true`) automatically records 0 marks, 'F' grade, and failure status.

---

## 5. Security & Isolation Architecture

1. **Role-Based Access Control (RBAC):** Middleware checks `req.user.role` on all mutating routes.
2. **Cohort Scoping:** Students can only query examinations and results matching their enrolled `department`, `semester`, and `section`.
3. **Draft Score Masking:** Student endpoints filter out any records where `status !== 'published'`.
4. **Anti-Self-Approval:** A faculty member who created or submitted draft marks cannot approve their own submission (`req.user._id.toString() !== exam.faculty.toString()`). Only administrators can override this check.
5. **Audited History:** Marks corrections never delete historical data; all revisions append to `correctionHistory` with previous marks, new marks, actor ID, and mandatory rationale.

