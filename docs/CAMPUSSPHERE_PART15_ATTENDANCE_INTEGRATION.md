# CampusSphere AI — Part 15: Timetable & Smart Attendance Integration

## 1. Overview

The Timetable module integrates directly with the existing **Smart Attendance System** (Parts 6, 7, 8, 9, 10) to streamline lecture attendance initiation while strictly preserving academic calculation invariants.

---

## 2. Integration Boundary Principles

1. **Scheduled Expectations vs. Conducted Reality:**
   - A timetable slot is an *expectation* that a class will occur.
   - Attendance calculations (percentage, held units, attended units, deficit) are derived *exclusively* from finalized `AttendanceSession` and `AttendanceRecord` documents.
   - Timetable entries never confer attendance credit directly.

2. **One-Click Attendance Launch:**
   - On `/faculty/timetable`, faculty can click **Launch Smart Attendance** next to any scheduled class.
   - The frontend routes to `/faculty/attendance` with query parameters pre-populating:
     - `timetableEntry` (Timetable ObjectId)
     - `subjectId`
     - `period`
     - `room`
     - `branch`, `semester`, `section`

3. **Duplicate Session Prevention:**
   - To prevent an instructor from inadvertently starting two duplicate attendance sessions for the same scheduled class on the same day, `createSession` in `server/controllers/attendance.controller.js` checks:
     ```javascript
     if (req.body.timetableEntry) {
       const ttConflict = await AttendanceSession.findOne({
         timetableEntry: req.body.timetableEntry,
         date,
         status: { $in: ['open', 'active', 'scheduled', 'completed', 'finalized'] }
       });
       if (ttConflict) {
         throw new ApiError(409, `An attendance session has already been created for this scheduled timetable slot on ${date}`);
       }
     }
     ```
   - Attempting to start a duplicate session is rejected with HTTP 409.

4. **Preservation of Historical Attendance during Rescheduling:**
   - If a class slot is rescheduled or cancelled, existing completed attendance sessions retain their original `timetableEntry` ID and date stamps, preventing historical attendance calculation regressions.

