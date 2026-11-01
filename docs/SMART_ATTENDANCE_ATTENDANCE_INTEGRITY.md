# Smart Attendance — Attendance Integrity & Multi-Period Policy
**Module:** CampusSphere AI — Smart Campus Management ERP  
**Component:** Attendance Record Integrity, Multi-Period Labs, and Auditing  
**Version:** 1.0.0 (Part 6/24 Hardening)  
**Author:** Senior Database Architect & Backend Engineer  

---

## 1. Multi-Period Laboratory Block Sessions

College timetables routinely feature practical laboratory and workshop sessions spanning 2 to 3 consecutive class periods (e.g., Periods 3 and 4 for Algorithms Lab).

### Schema Design & Support
- `AttendanceSession` models support both scalar `period` and array `periods`:
  - `period`: Primary period number (e.g. `3`).
  - `periods`: Full array of periods included in the block (e.g. `[3, 4]`).
  - `periodCount`: Total count of periods (e.g. `2`).
- When students check into a multi-period session, `Attendance` records reflect the full period block:
  - `period`: Primary period.
  - `periods`: Full period array.
  - `periodCount`: Number of lecture credits conferred.

### Uniqueness & Conflict Prevention
1. **Faculty Timetable Conflict Guard:** When creating a session, the backend checks for overlapping sessions on the same date and faculty or classroom.
2. **Student Unique Constraints:** MongoDB compound indexes prevent duplicate check-ins:
   - `{ student: 1, session: 1 }`: Unique index preventing multiple records for the same session.
   - `{ student: 1, date: 1, period: 1 }`: Unique index preventing double-booking periods across different classes.

---

## 2. Idempotent Check-In Handling

When high network latency causes a student's mobile browser to retry attendance submission:
1. The backend performs an initial check:
   ```javascript
   let attendance = await Attendance.findOne({ session: session._id, student: student._id });
   if (attendance && ['present', 'late'].includes(attendance.status)) {
     return res.status(200).json({
       success: true,
       data: { attendanceId: attendance._id, status: attendance.status, alreadyMarked: true },
       message: 'Attendance was already marked for this session'
     });
   }
   ```
2. If concurrent race conditions bypass the check, MongoDB's unique index throws an `E11000` duplicate key error. The controller safely catches error code `11000` and returns the existing record idempotently with HTTP 200 rather than crashing or throwing an unhandled 500 error.

---

## 3. Controlled Session Finalization & Absentee Marking

Indiscriminate background absentee marking is strictly prohibited. Absentee generation is executed exclusively when faculty or administrator explicitly finalizes the session via `POST /api/attendance/sessions/:sessionId/finalize`:

1. **Verify Session Status:** Session must be in `completed` or `closed` state.
2. **Fetch Enrolled Student Roster:** Queries all active students matching the session's `branch`, `semester`, and `section`.
3. **Identify Unmarked Students:** Compares enrolled roster against existing `Attendance` records for that session.
4. **Bulk Insert Absent Records:** Generates records with:
   - `status: 'absent'`
   - `verificationMethod: 'manual'`
   - `verificationStatus: 'unverified'`
   - `remarks: 'Marked absent upon session finalization'`
5. **Lock Session:** Transitions status to `finalized` and sets `finalizedAt: new Date()`.

---

## 4. Manual Corrections & Immutable Audit Logging

Institutional policy allows faculty to correct attendance (e.g., student had approved medical excuse, or camera malfunctioned):

- **Mandatory Justification:** Every override request (`PATCH /api/attendance/records/:attendanceId/override`) requires a non-empty `reason` string (minimum 5 characters).
- **Audit Log Trail:** An immutable entry is written to `AttendanceAuditLog`:
  - `action: 'manual_correction'`
  - `actorId`: User ID of faculty or administrator
  - `actorRole`: `'faculty'` or `'admin'`
  - `affectedStudentId`: Student whose record was altered
  - `previousValue`: Prior status and verification details
  - `newValue`: New status and override metadata
  - `reason`: Justification provided by faculty
  - `timestamp`: Server-generated timestamp

