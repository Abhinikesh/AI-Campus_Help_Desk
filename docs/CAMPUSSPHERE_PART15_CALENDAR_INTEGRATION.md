# CampusSphere AI — Part 15: Academic Calendar Integration

## 1. Overview

The Centralized Academic Calendar dynamically aggregates academic data from multiple independent ERP modules into a single, cohesive calendar feed for students, faculty, and administrators.

---

## 2. Dynamic Source Aggregation Architecture

Rather than copying and maintaining redundant event rows across multiple database collections, `server/services/academicCalendar.service.js` executes a unified real-time aggregation across three primary authoritative sources:

```
+-----------------------------------------------------------------------------------+
|                        CENTRALIZED CALENDAR AGGREGATOR                            |
+-----------------------------------------------------------------------------------+
        |                                   |                                   |
        v                                   v                                   v
+-----------------------+       +-----------------------+       +-------------------+
| AcademicCalendarEvent |       |    Exam (Part 14)     |       |Assignment (Part13)|
| - College Holidays    |       | - Mid-Semester Exams  |       | - Project Due Date|
| - Semester Milestones |       | - End-Semester Exams  |       | - Homework Due    |
| - Symposiums/Recesses |       | - Practical Exams     |       | - Lab Submissions |
+-----------------------+       +-----------------------+       +-------------------+
        │                                   │                                   │
        └───────────────────────────────────┼───────────────────────────────────┘
                                            │
                                            ▼
                        +---------------------------------------+
                        | Aggregated Chronological Calendar Feed|
                        |   (Filtered by Role, Dept, & Sem)     |
                        +---------------------------------------+
```

---

## 3. Data Transformation & Normalization

Each source document is mapped into a normalized calendar event object:

| Normalized Property | AcademicCalendarEvent | Exam (Part 14) | Assignment (Part 13) |
| :--- | :--- | :--- | :--- |
| `id` | `_id` | `exam-${_id}` | `asg-${_id}` |
| `title` | `title` | `Exam: ${title} (${subject.code})` | `Due: ${title} (${subject.code})` |
| `eventType` | `eventType` (holiday, etc.) | `'examination_period'` | `'assignment_deadline'` |
| `category` | `'institutional'` | `'examination'` | `'assignment'` |
| `startDate` | `startDate` | `date` | `dueDate` |
| `endDate` | `endDate` | `date` | `dueDate` |
| `venue` | `venue` | `room || venue` | `'Online Submission Portal'` |
| `isAllDay` | `isAllDay` (true/false) | `false` | `false` |
| `source` | `'calendar_event'` | `'exam_record'` | `'assignment_record'` |

---

## 4. Audience Scoping & Privacy Enforcement

- **Students:** See institutional events, events for their enrolled department and semester, published examinations for their cohort, and published assignments for their cohort. Private faculty or admin events are excluded.
- **Faculty:** See institutional events, faculty senate meetings, assignments they created or assigned to their department, and examinations they are assigned to invigilate or evaluate.
- **Admins:** Full visibility across all institutional, departmental, faculty, examination, and assignment events.

