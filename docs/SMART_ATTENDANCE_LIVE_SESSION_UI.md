# Smart Attendance — Faculty Live Session UI & State Controls
**Module:** CampusSphere AI — Smart Campus Management ERP  
**Component:** Faculty Live Attendance Console & Roster Management  
**Version:** 1.0.0 (Part 7/24 Optimization)  
**Author:** Senior Frontend & Application Architect  

---

## 1. Faculty Live Console Capabilities

The Faculty Live Attendance console (`client/src/pages/FacultyAttendance/LiveAttendance.jsx`) provides real-time oversight of in-progress class attendance sessions.

### Key Console Features
1. **Dynamic State-Machine Controls:**
   - **Pause Check-in:** Temporarily freezes student submissions while keeping the session open.
   - **Resume Check-in:** Re-enables student submissions.
   - **Stop Session:** Closes the check-in window. Session transitions to `completed`.
   - **Finalize Attendance:** Permanently locks records, queries the academic roster, and writes absentee records for unmarked students.
2. **Rotating QR Challenge Console:**
   - Monospace token display with click-to-copy and high contrast for projector readability.
   - 45-second animated progress bar and auto-refresh timer.
   - Manual "Regenerate" trigger for immediate token rotation.
3. **Live Attendance Stream & Metrics:**
   - Live counter cards: Total Students, Present Count, Pending Count, Absent Count.
   - Real-time polling every 2.5 seconds during active and paused states.
   - Automatic cessation of polling when session reaches terminal states (`finalized`, `cancelled`).

---

## 2. Institutional Absentee Policy Enforcement

In strict compliance with college ERP audit requirements:
- **No Premature Absentees:** Students remaining in `pending` state while a class is active or paused are **never** labeled absent.
- **Absent Only Upon Finalization:** Absent records are created exclusively after the faculty member reviews the final roster and clicks **Finalize Attendance**.
- **Accurate Confirmation Dialogs:** Dialog warnings clearly state that stopping a session closes the check-in window, while finalization records unexcused absentees.

---

## 3. Manual Correction Workflow

Faculty retain the authority to manually adjust any student's status (e.g., in cases of approved on-duty leave or hardware incompatibility):
- Click on any student row in the live roster.
- Select target status (`present`, `absent`, `late`, `excused`).
- Provide mandatory justification note (minimum 5 characters).
- Changes are submitted via `attendanceService.updateStudentAttendance` and recorded in `AttendanceAuditLog`.

