# CampusSphere AI — Part 15: Timetable Publication & Versioning Workflow

## 1. Overview

CampusSphere AI enforces a formal publication and versioning state machine for all academic schedules. This prevents students and faculty from seeing preliminary scheduling drafts, guarantees forensic auditability for schedule changes, and dispatches automated notices when official schedules change.

---

## 2. Publication Lifecycle State Machine

```
[ Draft Slot Created ]
        |
        | (Faculty / Admin schedules classes during semester planning)
        v
[ Cohort Timetable In Draft ] ── (Strictly hidden from student timetables)
        |
        | (Admin clicks "Publish Timetable")
        v
[ Official Version Published ]
        |
        ├─► Transition slots to status: 'published'
        ├─► Create immutable snapshot in TimetableVersion collection
        ├─► Increment versionNumber (v1, v2, v3...)
        ├─► Deliver centralized notification to cohort students
        v
[ Active Semester Schedule ]
        |
        | (Schedule modified due to maintenance / faculty leave)
        v
[ Audited Slot Revision ]
        |
        ├─► Mandatory reason required (min 5 characters)
        ├─► Append previous slot & new slot to changeHistory[]
        ├─► Set slot status: 'updated'
        └─► Dispatch 'Class Rescheduled' alert to students
```

---

## 3. Immutability of Historical Versions (`TimetableVersion`)

When an administrator executes `POST /api/timetable/publish`:
1. All active slots for the cohort are queried and mapped into an `entriesSnapshot` array containing:
   - Timetable ID, Subject Code, Subject Name, Faculty Name, Day, Period, Start/End Time, Room, and Session Type.
2. The snapshot is saved to `TimetableVersion` along with `publishedBy`, `publishedAt`, and `notes`.
3. Historical versions are never modified or overwritten, allowing academic deans and auditors to inspect previous schedules at any time via `GET /api/timetable/versions`.

---

## 4. Student Timetable Privacy Invariant

- Student timetable queries (`GET /api/timetable/student`) strictly filter for `status: 'published'`.
- Any slot marked as `draft` or `archived` is omitted from the JSON payload.
- Cross-department students (e.g. MECH students) cannot query or inspect CSE cohort schedules.

