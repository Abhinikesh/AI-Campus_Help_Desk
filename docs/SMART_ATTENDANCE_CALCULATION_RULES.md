# Smart Attendance Calculation Rules & Institutional Policy

**System Name:** CampusSphere AI Smart Attendance Module  
**Scope:** Part 8/24 — Academic Calculations, Data Consistency & Accuracy  
**Authoritative Service:** `server/services/attendanceCalculation.service.js`  
**Standard Timezone:** Indian Standard Time (`Asia/Kolkata`, UTC+5:30)

---

## 1. Executive Summary

This specification establishes the single, authoritative calculation methodology for academic attendance across all student, faculty, and administrator surfaces within CampusSphere AI. Prior to Part 8, attendance calculations suffered from session-count flattening (ignoring laboratory block lengths), improper zero-class penalty assignments, and client-side hardcoded statistics.

Under the new unified model:
1. Every class is evaluated in terms of **Academic Units** (periods).
2. The fundamental calculation is:
   $$\text{Attendance Percentage} = \left(\frac{\text{Attended Academic Units}}{\text{Eligible Held Academic Units}}\right) \times 100$$
3. Compliance decisions are evaluated against unrounded numbers, preventing false promotion (e.g., 74.999% fails a 75.0% threshold).
4. Insufficient data states (zero eligible held units) are cleanly separated from zero attendance.

---

## 2. Core Calculation Rules

### Rule 1: Authoritative Academic Unit Definition
- A standard lecture period represents **1 Academic Unit**.
- A multi-period laboratory session spanning $N$ timetable periods represents **$N$ Academic Units** ($N \ge 1$).
- When a student is verified present or late for an $N$-period session, they receive **$N$ Attended Units**.
- If a student is absent from an $N$-period session, they incur **$N$ Missed Units**.

### Rule 2: Session Eligibility Scoping
Only sessions meeting all of the following conditions are included in the denominator ($\text{Eligible Held Units}$):
- `status` is either `completed` or `finalized`.
- `status` is NOT `cancelled`.
- Scheduled date $\le$ current date in Indian Standard Time (`Asia/Kolkata`).
- Matches the student's enrolled semester and branch.

### Rule 3: Session State Lifecycle Exclusions
| Session State | Included in Completed Held Units? | Reason |
|:---|:---:|:---|
| `scheduled` | **No** | Future or unstarted session. |
| `open` | **No** | Session is currently admitting check-ins; not yet finalized. |
| `active` | **No** | Live session ongoing; late check-ins may occur. |
| `paused` | **No** | Temporary halt during class; incomplete. |
| `closed` | **No** (unless finalized) | Window closed, awaiting faculty final roster review. |
| `completed` | **Yes** | Faculty completed session. |
| `finalized` | **Yes** | Immutable finalized record; all absentees marked. |
| `cancelled` | **Strictly No** | Cancelled class carries zero academic liability. |

### Rule 4: Handling Zero Classes Held (No Data State)
When zero sessions have been conducted for an enrolled subject:
- `heldUnits = 0`
- `attendedUnits = 0`
- `rawPercentage = null`
- `displayPercentage = null`
- `hasData = false`
- `complianceStatus = 'No Data'`
- UI Badge: Displays neutral status without triggering alerts.
- Divisor Integrity: Zero-class subjects are omitted from the cross-course percentage divisor.

### Rule 5: Strict Threshold Resolution & Compliance Classification
- The minimum attendance threshold $T_{min}$ is dynamically resolved from `AttendanceSettings` (default $75.0\%$).
- Status classification:
  - **Good (On Track):** $\text{Raw Percentage} \ge T_{min}$
  - **Warning:** $T_{min} - 15.0\% \le \text{Raw Percentage} < T_{min}$ (e.g. $[60.0\%, 75.0\%)$)
  - **Critical:** $\text{Raw Percentage} < T_{min} - 15.0\%$ (e.g. $< 60.0\%$)
  - **No Data:** `hasData == false`
- **Rounding Guard:** Rounding for display (e.g. `Math.round()`) is restricted to presentation text. The compliance logic compares unrounded raw floating-point numbers. A student with $74.99\%$ receives `Warning`, never `Good`.

### Rule 6: Controlled Manual Overrides and Corrections
- Manual corrections require an authenticated faculty or administrator session and a non-empty audit justification string.
- When an override transitions a record:
  - `absent` $\rightarrow$ `present`: Attended units increase by the session's unit count.
  - `present` $\rightarrow$ `absent`: Attended units decrease by the session's unit count.
  - `present` $\rightarrow$ `late`: Attended units are preserved (late carries full presence credit).
- Overrides append an append-only entry to `AttendanceAuditLog` with `action: 'manual_correction'`.

