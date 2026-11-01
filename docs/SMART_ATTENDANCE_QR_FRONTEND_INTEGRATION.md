# Smart Attendance — QR Frontend Integration & Token Rotation
**Module:** CampusSphere AI — Smart Campus Management ERP  
**Component:** Frontend Challenge Synchronization, Countdown & Validation  
**Version:** 1.0.0 (Part 7/24 Optimization)  
**Author:** Application Security & Frontend Engineer  

---

## 1. Challenge Synchronization Lifecycle

To prevent proxy attendance via static image forwarding, CampusSphere AI utilizes a dynamic rotating QR token architecture. The frontend components synchronize with this protocol as follows:

```
[Faculty Screen / LiveAttendance]
       │
       ├── 1. On Mount: fetchQrChallenge(sessionId)
       ├── 2. Start 45-Second Countdown Timer
       │      - Decrements every 1,000 ms
       │      - Visual countdown progress bar
       ├── 3. At 1s remaining: Automatically fetch fresh token
       │      - Reset countdown to 45s
       └── 4. On Session Pause: Retain current token but display pause alert
       │
       ▼ Projected on Classroom Wall
[Token: 19a4e21b8.40f81d830b5...b2a4]
       │
       ▼ Scanned or Entered by Students in Lecture Hall
[Student Device / MarkAttendance]
       │
       ├── 1. Student inputs/scans 45-second token
       ├── 2. Captures normalized face frame (640×480)
       ├── 3. Submits { liveImageData, qrChallengeToken }
       │
       ▼
[Backend Validation]
       ├── Valid (< 45s & HMAC matches sessionId)? ──► Verified (201 Created)
       └── Expired (> 45s)? ──► 400 Bad Request ("QR code has expired")
```

---

## 2. Classroom Concurrency & Replay Semantics

### The Multi-Student Classroom Reality
In a college lecture hall, a single token is projected onto a central screen. During its 45-second validity window, dozens of students simultaneously submit attendance.

- **Non-Global Consumption:** The token is valid for multiple submissions within the classroom session during its active 45-second window.
- **Single Submission per Student:** Duplicate submissions by the same student are blocked by the database unique index `{ student: 1, session: 1 }`.
- **Session Isolation:** A token generated for Session A will fail signature validation if submitted to Session B.
- **Strict Time Boundary:** The backend grants a 5-second network latency allowance. Tokens older than 50 seconds are rejected unconditionally.

---

## 3. Frontend Error Recovery

When a student submits an expired challenge token:
1. Backend responds with `HTTP 400: "QR code has expired. Please scan current code."`
2. Frontend displays an inline alert: *"QR code has expired. Look at the faculty projector and enter the current rotating code."*
3. The submission lock (`isSubmittingRef`) is released, allowing immediate retry without page reload.

