# Smart Attendance — Background Session Scheduler Report
**Module:** CampusSphere AI — Smart Campus Management ERP  
**Component:** Automatic Session Expiration Background Scheduler  
**Version:** 1.0.0 (Part 6/24 Hardening)  
**Author:** Senior Reliability & Systems Engineer  

---

## 1. Scheduler Architecture & Design

The background session scheduler (`server/services/sessionScheduler.service.js`) ensures that forgotten, abandoned, or overdue attendance sessions do not remain open indefinitely.

### Architectural Principles
1. **Singleton Lifecycle:** Running as an in-process singleton within Node.js, initialized on HTTP server listen and cleanly terminated on `SIGTERM` / `SIGINT`.
2. **Injectable Clock for Deterministic Testing:** The core sweep method `checkAndExpireSessions(now = new Date(), options = {})` accepts an injectable `now` timestamp, enabling rigorous test automation without sleeping or wall-clock dependencies.
3. **Overlapping Execution Mutex:** An in-memory execution guard (`this.isExecuting`) prevents concurrent sweeps if a database query experiences transient delays.
4. **Zero Indiscriminate Absentees:** The scheduler **only** transitions session status from `open`/`active` to `completed` (`autoExpired: true`). It **never** mutates student records or marks absentees.

---

## 2. Deadline Calculation Algorithm

The deadline for an active session is calculated using `calculateSessionDeadline`:

1. **Scheduled End Time:** If `session.date` (e.g. `'2026-11-01'`) and `session.endTime` (e.g. `'10:00 AM'`) are present, they are parsed into an absolute UTC timestamp.
2. **Grace Period Addition:** An institutional grace period (default 15 minutes, configurable via `AttendanceSettings.lateGracePeriodMinutes`) is added to the scheduled end time.
3. **Fallback Calculation:** If `endTime` is unavailable or malformed, the deadline defaults to `session.openedAt + defaultDurationMinutes + gracePeriodMinutes`.

$$\text{Deadline} = \text{SessionEndTime} + \text{GracePeriodMinutes}$$

If $\text{CurrentTime} > \text{Deadline}$, the session is eligible for expiration.

---

## 3. Atomic State Claim & Concurrency

When an overdue session is identified, the scheduler issues a conditional atomic update:

```javascript
const updated = await AttendanceSession.findOneAndUpdate(
  {
    _id: session._id,
    status: session.status // Must match the queried status ('open', 'active', or 'paused')
  },
  {
    $set: {
      status: 'completed',
      sessionStatus: 'completed',
      closedAt: now,
      actualEndTime: now,
      autoExpired: true
    }
  },
  { new: true }
);
```

If a faculty member simultaneously ended or finalized the session, the conditional update matches zero documents and cleanly aborts, preventing double-closing or overwriting manual finalizations.

---

## 4. Audit Logging & Verification

Every automatically expired session generates a system-attributed audit log in `AttendanceAuditLog`:
- `action`: `'auto_expire_session'`
- `actorRole`: `'system'`
- `actorId`: Faculty ID or Session ID
- `previousValue`: `{ status: 'active' }`
- `newValue`: `{ status: 'completed', autoExpired: true, closedAt: <timestamp> }`
- `reason`: `"Session automatically closed after exceeding scheduled duration and 15-minute grace period"`

