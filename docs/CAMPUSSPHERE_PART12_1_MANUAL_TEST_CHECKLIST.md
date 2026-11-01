# CampusSphere AI — Part 12.1 Manual Test Checklist

This manual test protocol guides QA engineers in validating the security, user experience, and real-time communication behaviors stabilized in Part 12.1.

---

## 1. Environment Readiness

1. Verify backend server is running on `http://localhost:5001`.
2. Verify Python AI service is running on `http://localhost:5002`.
3. Verify Vite frontend server is running on `http://localhost:5173`.
4. Open browser Developer Tools (`Network` and `Console` tabs).

---

## 2. Security & SSE Authentication Checklist

| # | Test Action | Expected Result | Verified |
| :- | :--- | :--- | :---: |
| **1.1** | In browser console, attempt: `new EventSource('/api/notifications/stream?token=xyz')` | Network tab shows HTTP `400 Bad Request` with message: *"Passing authentication tokens in URL query parameters is prohibited for security"*. | [ ] |
| **1.2** | In browser console, attempt `fetch('/api/notifications/stream')` without auth headers | Returns HTTP `401 Unauthorized`. | [ ] |
| **1.3** | Log in as Student via `/login`. Inspect Network tab for `GET /api/notifications/stream` | Stream opens via authenticated fetch with `Authorization: Bearer <token>` and `credentials: 'include'`. Response is HTTP `200` with `Content-Type: text/event-stream`. | [ ] |
| **1.4** | Inspect stream chunks over 30 seconds | Observe `: ping\n\n` comments arriving every 25 seconds without throwing console errors. | [ ] |
| **1.5** | Close the student browser tab | Verify in server console that `req.on('close')` fires and stream is de-registered without memory leak. | [ ] |

---

## 3. Student User Journey

1. **Login & Notification Discovery**:
   - Log in as Student (Roll Number: `CSE-2026-001` or any active student).
   - Observe header: notification bell displays accurate unread badge count.
   - Click bell: dropdown opens showing recent notifications with category icons and relative timestamps.
2. **Notification Mutations**:
   - Click "Mark all as read" in dropdown: badge count immediately transitions to 0.
   - Click "View all in Notification Center": navigates smoothly to `/notifications`.
   - Toggle individual notification checkmark: alternates read and unread status.
   - Delete a notification: card fades out and item is removed from database.
3. **Preferences Enforcement**:
   - In `/notifications`, click "Preferences".
   - Notice "System & Security Alerts" toggle is locked with "Mandatory" badge.
   - Toggle "Assignment Deadlines" off and click "Save Preferences".
   - Refresh page: verify saved preference remains toggled off.

---

## 4. Faculty & Administrative Journey

1. **Faculty Announcement Scoping**:
   - Log in as Faculty (Department: CSE).
   - Navigate to announcements authoring.
   - Attempt to select "Entire Faculty" as audience: verify UI/API blocks broadcast with permission notice.
   - Create draft announcement for "Department: CSE".
   - Verify student in ECE cannot see this draft in their feed or via direct URL.
2. **Session Finalization & Absentee Alerts**:
   - Faculty opens an attendance session for a theory class.
   - Verify that while session is in `open` or `paused` state, no absent notifications exist.
   - Mark Student A present, leave Student B unmarked.
   - Faculty finalizes the session.
   - Student B immediately receives an absent notification via real-time stream.
   - Faculty retries finalization: verify Student B does NOT receive a duplicate absent notification.
3. **Manual Attendance Correction**:
   - Faculty edits Student B's attendance status to "Present" with reason: "Approved university sports duty".
   - Student B instantly receives notification stating: *"Attendance Record Updated: Adjusted to PRESENT. Reason: Approved university sports duty"*.
   - Verify no other student receives this alert.

---

## 5. Audience Authorization & IDOR Defense

1. **Draft Invisibility**:
   - Create an announcement as Admin with `status: 'draft'`. Note the announcement ID `_id`.
   - Log in as Student and attempt to open `http://localhost:5173/announcements/<draftId>` (or call `GET /api/announcements/<draftId>`).
   - Verify server returns HTTP `404 Not Found`.
2. **Expired Announcement Invisibility**:
   - As Admin, create an announcement with `expiresAt` set to 5 minutes ago.
   - As Student, verify this announcement does not appear in the public notice feed.
   - Direct fetch by ID returns HTTP `404 Announcement has expired`.
3. **Cross-Department Scoping**:
   - Create an announcement targeted to `targetBranches: ['ECE']`.
   - As a CSE student, verify it does not appear in the notice feed, and direct ID lookup returns HTTP `403 Access Denied`.

