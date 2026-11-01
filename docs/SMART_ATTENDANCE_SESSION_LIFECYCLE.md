# Smart Attendance — Session Lifecycle & State Machine Specification
**Module:** CampusSphere AI — Smart Campus Management ERP  
**Component:** Attendance Session State Machine & Concurrency Control  
**Version:** 1.0.0 (Part 6/24 Hardening)  
**Author:** Senior Backend & Architecture Engineer  

---

## 1. State Machine Definition

Smart Attendance sessions transition through a formally defined finite state machine. Transitions outside this graph are strictly prohibited and return HTTP 400 Bad Request.

```
       [ scheduled ]
             │
             ▼
     ┌──►[  open   ]◄──┐
     │       │   ▲     │
     │       ▼   │     │
     └───[ paused  ]   │ (resume)
             │   │     │
             ▼   └─────┘
     ┌──►[ active  ]
     │       │
     │       ▼
     └───[completed] / [expired]
             │
             ├──► [finalized] (Terminal: Locked, Absentees Recorded)
             └──► [cancelled] (Terminal: Discarded, Zero Credit)
```

---

## 2. Formal Transition Matrix

The table below enumerates all allowed transitions and the operational side effects executed during each phase:

| Source State | Target State | Triggering Actor | Description & Preconditions | Atomic Mutex Condition |
|---|---|---|---|---|
| `scheduled` | `open` / `active` | Faculty (owner) / Admin | Session is opened for attendance. `openedAt` is recorded. | `{ _id, status: 'scheduled' }` |
| `open` / `active`| `paused` | Faculty (owner) / Admin | Check-in window paused. Student submissions blocked. | `{ _id, status: { $in: ['open', 'active'] } }` |
| `paused` | `active` / `open` | Faculty (owner) / Admin | Check-in window resumed. Students can submit again. | `{ _id, status: 'paused' }` |
| `open` / `active`| `completed` / `closed`| Faculty (owner) / Admin | Faculty formally closes check-in window. | `{ _id, status: { $in: ['open', 'active'] } }` |
| `paused` | `completed` / `closed`| Faculty (owner) / Admin | Paused session is closed without resuming. | `{ _id, status: 'paused' }` |
| `open` / `active`| `completed` (`autoExpired: true`)| System Scheduler | Session exceeded scheduled duration + 15 min grace. | `{ _id, status: { $in: ['open', 'active', 'paused'] } }` |
| `completed` / `closed` | `finalized` | Faculty (owner) / Admin | Faculty verifies roster. All unmarked students marked absent. Session locked. | `{ _id, status: { $in: ['completed', 'closed'] } }` |
| `*` (non-finalized)| `cancelled` | Faculty (owner) / Admin | Session marked void. Records excluded from percentage stats. | `{ _id, status: { $ne: 'finalized' } }` |
| `finalized` | ANY | REJECTED | Terminal state. No further mutations permitted. | Throws 400 Conflict |

---

## 3. Concurrency Protection & Atomic Updates

In high-concurrency campus environments where hundreds of students submit attendance concurrently while faculty may pause, close, or finalize a session, naive read-modify-save patterns cause race conditions.

CampusSphere AI enforces atomic concurrency via `sessionStateMachine.service.js`:

```javascript
const updatedSession = await AttendanceSession.findOneAndUpdate(
  {
    _id: sessionId,
    status: currentStatus // Enforce that status has not changed between read and write
  },
  {
    $set: {
      status: targetState,
      sessionStatus: targetState,
      ...extraFields
    }
  },
  { new: true, runValidators: true }
);

if (!updatedSession) {
  throw new ApiError(
    409,
    `Concurrent session state transition conflict. The session status changed while processing.`
  );
}
```

This guarantees that:
1. If two conflicting status changes are dispatched simultaneously, only one succeeds; the second receives an explicit HTTP 409 Conflict error.
2. An append-only audit log entry in `AttendanceAuditLog` is created atomically following successful transition.

---

## 4. Role-Based Access Control (RBAC) Rules

1. **Faculty Ownership Scoping:**  
   Faculty users may only transition sessions where `session.faculty.toString() === req.user.userId.toString()`. Attempts to transition another faculty member's session are rejected with HTTP 403 Forbidden.
2. **Administrative Override:**  
   System Administrators (`role: 'admin'`) hold universal authority to transition sessions across any department, with mandatory audit logging capturing their `actorId` and `actorRole`.
3. **Student Restriction:**  
   Student roles cannot trigger state transitions under any circumstance.

