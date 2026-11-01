# CampusSphere AI — Part 21: Event Attendance & Academic Decoupling

## 1. Strict Isolation from Academic Attendance

Campus event attendance is managed through `server/models/EventAttendance.js` and is **strictly decoupled** from official course lecture and laboratory attendance (`Mark.js`, `AttendanceSession.js`):
- Marking an event attendee `present` or `absent` never alters a student's course attendance percentages, academic warning thresholds, or examination eligibility registers.
- Official academic marks and SGPA/CGPA calculations remain completely untouched.

---

## 2. Event Attendance Workflow

1. **Marking Attendance:**
   - Event organizers or coordinators open the event attendance desk.
   - For each registered participant, attendance is logged via `POST /api/events/:id/attendance` with `status: 'present'` or `'absent'` and `markingMethod: 'manual'` (or `'qr_scan'`).
   - The corresponding `EventRegistration` status updates to `attended` or `absent`.
2. **Audited Attendance Corrections:**
   - If an error was made during physical check-in, organizers modify the record via `PATCH /api/events/:id/attendance/:attendanceId`.
   - Corrections strictly require an audit rationale of at least 5 characters.
   - The previous status, new status, modifier user ID, and timestamp are appended to `correctionHistory`.

