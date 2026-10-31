# Smart Attendance Technical Issues & Risk Register

**System Name:** CampusSphere AI Smart Attendance Module  
**Audit Date:** November 1, 2026  
**Auditor:** Senior Software Architect & Technical Auditor  
**Purpose:** Formal tracking of confirmed defects, architectural inconsistencies, dependencies, and institutional decisions requiring stakeholder sign-off.

---

## 1. Confirmed Bugs & Remediation Status

| Issue ID | Severity | Category | Description | Root Cause | Impact | Remediation Status |
|---|---|---|---|---|---|---|
| **ISSUE-01** | High | Frontend Runtime | `TypeError: Importing a module script failed` intermittently displayed in Safari/WebKit on lazy route navigation. | Vite chunk cache mismatch when dev server rebuilds or dynamic import experiences network latency. `<ErrorBoundary>` caught it and rendered generic error. | User sees crash boundary on route navigation until hard refresh. | **Analyzed & Mitigated**: Need auto-reload retry logic on chunk load failures in `App.jsx` lazy wrapper. |
| **ISSUE-02** | Medium | UI Inconsistency | Faculty Dashboard card displays static `124` for "Total Students" while Smart Attendance shows `8`. | Hardcoded static JSX `<div className="ds-stat-value">124</div>` in `FacultyDashboard/index.jsx:158`. | Confuses faculty; contradicts actual 8 enrolled students in Semester 5 Section A. | **Identified**: Must be bound dynamically to `GET /api/faculty/students` (`students.length`). |
| **ISSUE-03** | Medium | Dev Environment | Node.js integration tests in `server/tests/attendance.test.js` failed with `Student profile not found`. | In-memory `mongodb-memory-server` defaults to database `"test"`, while test runner hardcoded connection to `"campus-erp"`. | Server and tests pointed to different DB instances during standalone test execution. | **Identified**: Need unified DB connection URI across `server/config/db.js` and test fixtures. |
| **ISSUE-04** | Low | UI Redundancy | Redundant circular progress rings and duplicate bar blocks cluttered Student Attendance and Dashboard pages. | Vestigial SVG circular progress components from early prototype. | Cluttered page hierarchy; user explicitly requested removal in prompt attachments. | **Resolved**: Pruned from `StudentDashboard/index.jsx` and `Attendance/index.jsx`. |

---

## 2. Suspected Bugs & Watchlist Items

| Item ID | Category | Description | Investigation Detail | Recommended Action |
|---|---|---|---|---|
| **WATCH-01** | Webhook / Polling | Live attendance roster polling at 3-second intervals may accumulate network chatter on large campus deployments (e.g., 50 simultaneous classes). | Current HTTP polling is simple and reliable for local testing, but scales linearly with active faculty browsers ($50 \times 20 = 1000\text{ req/min}$). | Implement Server-Sent Events (SSE) or WebSocket push for live attendance rooms in Part 4. |
| **WATCH-02** | Payload Size | Uncompressed Base64 webcam frames from 1080p cameras can exceed 1.5 MB per verification request. | High bandwidth consumption on mobile or congested college Wi-Fi networks. | Add HTML5 canvas downscaling to max $640\times 480$ JPEG (quality 0.85) in `CameraPreview.jsx` before upload. |
| **WATCH-03** | Auto-Close Cron | If a faculty member forgets to click "Finalize Session", the session may remain `open` indefinitely. | Unclosed sessions allow students to mark attendance hours after the class has adjourned. | Implement a server-side cleanup check that automatically finalizes sessions when `Date.now() > session.openedAt + durationMinutes + 15`. |

---

## 3. Technical Dependencies & Constraints

1. **Python Virtual Environment (`.venv`):**
   - The computer-vision pipeline relies strictly on Python 3.12 with pre-compiled wheels for `dlib`, `face_recognition`, and `opencv-python-headless`.
   - Global system Python must **never** be modified or targeted.
2. **MongoDB Replica Set / Transaction Support:**
   - Multi-document transactions for atomic session finalization require a replica set or standalone WiredTiger storage engine (already provisioned via local storage at `server/.data/db`).
3. **Internal Inter-Service Key Synchronization:**
   - Communication between Node.js (`server/services/pythonAi.service.js`) and Python (`ai-service/app/security/auth.py`) requires an exact match on `INTERNAL_API_KEY`.

---

## 4. Institutional Policy Decisions Requiring Confirmation

| Decision ID | Policy Area | Current Assumption | Options for Institutional Leadership |
|---|---|---|---|
| **POL-01** | **Attendance Shortage Threshold** | Default minimum threshold is set to **75%**. | Confirm whether 75% is the universal institutional standard or if specific clinical/lab courses require 80% or 85%. |
| **POL-02** | **Tardiness Grace Period** | Default grace period is **10 minutes** past scheduled start time; after which attendance is marked `late`. | Confirm whether "Late" status contributes partial attendance credit (e.g., 0.5 class) or zero credit towards examination eligibility. |
| **POL-03** | **Biometric Data Retention Lifespan** | Templates are retained for **365 days** (academic year) before mandatory re-consent and re-enrollment. | Confirm institutional retention policy: annual purge vs. graduation-based purge. |
| **POL-04** | **Excused Absence Crediting** | Medical and official extracurricular leaves (`excused`) are logged but not counted as present by default. | Confirm whether authorized medical leave excuses count toward the 75% statutory requirement. |
| **POL-05** | **Biometric Refusal Policy** | Students who withhold biometric consent use faculty manual override or physical rotating QR codes without academic penalty. | Confirm institution approves voluntary biometric policy with guaranteed non-biometric parity. |

