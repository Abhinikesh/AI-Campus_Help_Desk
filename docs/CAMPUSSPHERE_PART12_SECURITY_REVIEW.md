# CampusSphere AI — Part 12 Security Review

## 1. Threat Modeling & Scope

The Part 12 notification and announcement system handles sensitive academic, attendance, and administrative communications. This security review evaluates confidentiality, integrity, authorization, and denial-of-service vectors.

---

## 2. Threat Vectors & Mitigations

### 2.1 Cross-User Data Exposure (IDOR / BOLA)
- **Threat**: An authenticated student attempts to view, mark as read, or delete notifications addressed to another student or faculty member.
- **Mitigation**:
  - All read endpoints (`getNotifications`, `getUnreadCount`) strictly bind the database query to `recipient: req.user.userId`.
  - Mutation endpoints (`markAsRead`, `markAsUnread`, `deleteNotification`) execute atomic updates with both `_id: req.params.id` and `recipient: req.user.userId`. If a document does not match both conditions, a `404 Not Found or Access Denied` error is returned.
  - Test 5 in `tests/notification_and_announcements.test.js` formally verifies that student B cannot query or mutate student A's private notifications.

### 2.2 Announcement Audience Spoofing & Information Leakage
- **Threat**: A student crafts an announcement or attempts to access internal faculty-only / department-only announcements.
- **Mitigation**:
  - `POST /api/announcements` and lifecycle endpoints (`publish`, `archive`) require `requireRole('faculty', 'admin')`.
  - Non-admin users cannot broadcast to `'faculty'`.
  - The public feed `GET /api/announcements` inspects the requester's authenticated session, branch, and semester in MongoDB, filtering out unpublished drafts and unassigned department announcements.

### 2.3 System Alert Suppression (Preference Tampering)
- **Threat**: A malicious user or rogue script disables system notifications to avoid receiving disciplinary, attendance shortage, or biometric change warnings.
- **Mitigation**:
  - In `NotificationPreference`, `categories.system` is configured as mandatory.
  - The update preferences handler in `notification.service.js` forces `categories.system = true` regardless of client input.
  - Test 4 in `tests/notification_and_announcements.test.js` asserts that attempting to update `{ categories: { system: false } }` preserves `categories.system: true`.

### 2.4 Server-Sent Events (SSE) Authentication & Resource Exhaustion
- **Threat**: An attacker opens thousands of unauthenticated or zombie SSE connections to exhaust server memory or file descriptors.
- **Mitigation**:
  - The stream endpoint (`GET /api/notifications/stream`) verifies the JWT before establishing the keep-alive stream.
  - Connection close events (`req.on('close')`) immediately de-register the stream from memory and garbage collect orphaned sockets.
  - Streams are capped per user; heartbeat pings detect dead TCP connections.

### 2.5 Cross-Site Scripting (XSS) in Notifications & Announcements
- **Threat**: Stored XSS injected via announcement titles or grievance notification bodies.
- **Mitigation**:
  - React 19 JSX auto-escapes all strings rendered in notifications, dropdowns, and announcements.
  - Schema constraints enforce strict trimming, string types, and character length limits (`title`: 200 chars, `message`: 2000 chars, `body`: 10000 chars).
  - No `dangerouslySetInnerHTML` is used in notification rendering.

---

## 3. Compliance & Auditability

1. **Biometric Security Notifications**: In accordance with biometric data privacy principles established in Part 9, any face enrollment or template revocation automatically generates an immutable audit notification to the user's account (`system` category).
2. **Attendance Transparency**: When faculty manually override attendance records, the mandatory justification reason is included in the notification dispatched to the affected student, maintaining clear transparency and preventing arbitrary tampering.

