# CampusSphere AI — Part 15: Scheduling Conflict Detection Engine

## 1. Overview

The Centralized Scheduling Conflict Detection Engine (`server/services/schedulingConflict.service.js`) guarantees that all academic timetables, room bookings, and examinations are mathematically and logically collision-free prior to persistence.

---

## 2. Core Conflict Rules & Algorithmic Logic

### 2.1. Time Interval Normalization
Time intervals are converted from human strings (`HH:mm` or `HH:mm AM/PM`) into integer minutes from midnight $[0, 1439]$.
An interval is valid if and only if:
$$\text{startMinutes} < \text{endMinutes}$$

### 2.2. Interval Overlap Formula
Two time intervals $[S_1, E_1]$ and $[S_2, E_2]$ overlap on the same day if and only if:
$$S_1 < E_2 \quad \text{and} \quad E_1 > S_2$$

---

## 3. Conflict Categories & Rejections

| Conflict Type | Description | Rejection Message Format | HTTP Code |
| :--- | :--- | :--- | :---: |
| **Faculty Double-Booking** | The assigned instructor already has another class scheduled on the same day and overlapping time. | `Faculty Conflict: Professor [Name] is already scheduled to teach [Subject] in room "[Room]" from [Start] to [End].` | **409** |
| **Class Cohort Double-Booking** | The same student cohort (`Department` + `Semester` + `Section` + `Batch`) has another class scheduled during that time. | `Class Cohort Conflict: [Dept] Semester [Sem] Section [Sec] already has [Subject] scheduled from [Start] to [End].` | **409** |
| **Classroom Collision** | The assigned room (when not `'TBA'`) is occupied by another course or department during that time. | `Classroom Conflict: Room "[Room]" is already allocated to [Subject] ([Dept] Sem [Sem]) from [Start] to [End].` | **409** |
| **Institutional Holiday Collision** | A scheduled class falls on a date officially designated as a college, academic, or national holiday in `AcademicCalendarEvent`. | `Holiday Conflict: Cannot schedule class on [Date] due to published holiday "[Title]".` | **409** |
| **Examination Collision** | An examination (Part 14) is actively scheduled for the same student cohort during the requested time window. | `Examination Conflict: [Dept] Sem [Sem] has an examination scheduled: "[Title]" ([Subject]) from [Start] to [End].` | **409** |
| **Invalid Time Bounds** | Start time is identical to or after the end time. | `Invalid time interval: Start time ([Start]) must be strictly before end time ([End]).` | **409** |

---

## 4. Concurrency Protection & Atomic Checks

To prevent race conditions where two simultaneous API calls attempt to book the same room or faculty slot:
1. `detectSchedulingConflicts` queries the active database state directly within transaction scope.
2. In-memory check compares existing entries and immediately returns with conflict details.
3. Compound indexes on `{ faculty: 1, dayOfWeek: 1, status: 1 }` and `{ room: 1, dayOfWeek: 1, status: 1 }` ensure index-assisted query performance during peak administrative scheduling periods.

