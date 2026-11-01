# CampusSphere AI — Part 12 Centralized Notification Architecture

## 1. System Overview

CampusSphere AI requires a robust, privacy-respecting, database-backed notification system that delivers targeted, high-fidelity alerts across students, faculty, and administrators. 

The architecture bridges transactional ERP events (academic attendance, security updates, administrative announcements, and grievance tickets) directly into real-time user experiences through native HTTP Server-Sent Events (SSE) and persistent MongoDB records.

```
+-----------------------------------------------------------------------------------+
|                            CampusSphere ERP Event Sources                         |
|  - Attendance Session Finalization (Mark Absent)                                  |
|  - Manual Attendance Corrections (Faculty justification)                          |
|  - Biometric Consent & Face Registration / Revocation                             |
|  - Grievance / Complaint Resolution Status Changes                                |
|  - Administrative & Faculty Campus Announcements                                 |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                        notificationService (Singleton Engine)                     |
|  - Idempotency validation (eventId deduplication)                                 |
|  - Recipient preference verification (opt-out filters with mandatory bypass)       |
|  - MongoDB Atomic Persistence (Notification & NotificationPreference collections)  |
|  - Real-Time Dispatcher (SSE active stream registry + fallback buffering)        |
+-----------------------------------------------------------------------------------+
                                          |
                     +--------------------+--------------------+
                     |                                         |
                     v                                         v
+---------------------------------------+   +---------------------------------------+
|        Real-Time Push Stream          |   |          Polling / REST API           |
|  - HTTP SSE: /api/notifications/stream|   |  - GET /api/notifications             |
|  - Browser EventSource connection     |   |  - GET /api/notifications/unread-count|
|  - Zero client reload latency         |   |  - 30-second background sync fallback |
+---------------------------------------+   +---------------------------------------+
                     \                                         /
                      \                                       /
                       v                                     v
+-----------------------------------------------------------------------------------+
|                             Frontend User Experience                              |
|  - Header NotificationBell: animated badge, live counter & quick dropdown         |
|  - Notification Center (/notifications): tabs, search, filters, actions           |
|  - Preferences Modal: user control over non-essential alert categories            |
+-----------------------------------------------------------------------------------+
```

---

## 2. Core Data Models

### 2.1 Notification Model (`server/models/Notification.js`)

Each notification is an isolated, recipient-scoped document containing:

- **`recipient`**: Reference to `User` (`ObjectId`, required, indexed).
- **`title`**: Concise notification headline (max 200 chars).
- **`message`**: Detailed notification body (max 2000 chars).
- **`category`**: Enum `['academic', 'attendance', 'examination', 'assignment', 'timetable', 'announcement', 'administrative', 'system']`.
- **`priority`**: Enum `['low', 'normal', 'high', 'urgent']` (defaults to `'normal'`).
- **`relatedEntityType`**: Polymorphic reference (e.g. `'AttendanceSession'`, `'Announcement'`, `'Complaint'`).
- **`relatedEntityId`**: Associated document `ObjectId`.
- **`targetRoute`**: In-app deep link for one-click navigation (e.g. `'/student/attendance'`, `'/student/dashboard'`).
- **`isRead`**: Boolean read state flag (defaults to `false`, indexed).
- **`readAt`**: Timestamp of read acknowledgement.
- **`actor`**: `ObjectId` of the user who triggered the event.
- **`actorName`**: Cached display name of the actor.
- **`actorRole`**: Cached role of the actor.
- **`eventId`**: Unique idempotency token preventing duplicate notifications.
- **`expiresAt`**: Optional TTL expiration date.

#### Compound Indexes for Performance
1. `{ recipient: 1, isRead: 1, createdAt: -1 }`: Optimizes unread count queries and inbox retrieval.
2. `{ recipient: 1, category: 1, createdAt: -1 }`: Accelerates category tab filtering.
3. `{ eventId: 1 }`: Sparse unique index guaranteeing at-most-once delivery per event.

### 2.2 NotificationPreference Model (`server/models/NotificationPreference.js`)

User preferences model allows configuring granular notification channels while enforcing strict platform safety:

```javascript
{
  user: { type: ObjectId, ref: 'User', unique: true },
  categories: {
    academic: { type: Boolean, default: true },
    attendance: { type: Boolean, default: true },
    examination: { type: Boolean, default: true },
    assignment: { type: Boolean, default: true },
    timetable: { type: Boolean, default: true },
    announcement: { type: Boolean, default: true },
    administrative: { type: Boolean, default: true },
    system: { type: Boolean, default: true, immutable: true } // MANDATORY
  },
  channels: {
    inApp: { type: Boolean, default: true },
    email: { type: Boolean, default: false }
  }
}
```

> **Mandatory Protection Invariant**: `categories.system` is immutable. Critical security alerts (biometric changes, administrative lockouts, disciplinary actions) and `urgent` priority notifications always bypass category opt-outs.

---

## 3. Idempotency & Duplicate Prevention

To prevent spam or repeated notifications when retrying transactional operations, the `notificationService` enforces an `eventId` check:

1. When generating bulk or single notifications, callers can supply an `eventIdPrefix` or explicit `eventId`.
2. For instance, when session `654a...` is finalized, absent student notifications use `eventId: 'session_absent_654a..._<studentId>'`.
3. If the finalization endpoint is called repeatedly or concurrent workers trigger the event, MongoDB's unique index on `eventId` safely drops duplicates without error (`E11000` is trapped and ignored).

---

## 4. ERP Event Integration Hooks

The notification engine is linked to authentic core ERP state transitions:

| Event Source | Triggering Method | Generated Notification Category | Target Recipients |
| :--- | :--- | :--- | :--- |
| **Attendance Finalization** | `attendanceController.finalizeSession` | `attendance` (urgent if critical) | Absent roster students |
| **Attendance Correction** | `attendanceController.correctAttendanceRecord` | `attendance` (normal) | Affected student |
| **Biometric Enrollment** | `studentController.enrollFace` | `system` (high) | Enrolled student |
| **Biometric Revocation** | `studentController.revokeFace` | `system` (urgent) | Student withdrawing consent |
| **Complaint Resolved** | `adminController.updateComplaintStatus` | `administrative` (normal) | Complaint submitter |
| **Announcement Publish** | `announcementController.publishAnnouncement` | `announcement` (priority-matched) | Audience-targeted cohort |

---

## 5. Architectural Invariants

1. **Strict Recipient Scoping**: No user can read, query, mark, or delete another user's notifications. All database queries bind `recipient: req.user.userId`.
2. **Zero In-Memory Drift**: All notification states (`isRead`, `readAt`) reside in MongoDB with write confirmation before SSE push.
3. **Graceful SSE Fallback**: If an SSE stream disconnects, notifications accumulate in MongoDB and are picked up via unread polling every 30 seconds.

