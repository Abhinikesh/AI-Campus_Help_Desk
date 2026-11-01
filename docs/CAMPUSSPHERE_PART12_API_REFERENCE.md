# CampusSphere AI — Part 12 API Reference

This document catalogs the RESTful and Server-Sent Events (SSE) API contracts implemented for Part 12.

---

## 1. Notification API (`/api/notifications`)

All notification endpoints require a valid JWT token (`Authorization: Bearer <token>`).

### 1.1 List User Notifications
- **Method**: `GET`
- **Path**: `/api/notifications`
- **Query Parameters**:
  - `category` *(optional)*: Filter by category (`academic`, `attendance`, `examination`, `assignment`, `timetable`, `announcement`, `administrative`, `system`).
  - `priority` *(optional)*: Filter by priority (`low`, `normal`, `high`, `urgent`).
  - `isRead` *(optional)*: `true` or `false`.
  - `page` *(optional, default 1)*: Page number.
  - `limit` *(optional, default 20)*: Page limit.
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "673f8a...",
      "title": "Attendance Alert: Missed Lecture",
      "message": "You were marked absent in CS301 Database Systems on 2026-11-01.",
      "category": "attendance",
      "priority": "high",
      "targetRoute": "/student/attendance",
      "isRead": false,
      "createdAt": "2026-11-01T10:15:00.000Z"
    }
  ],
  "pagination": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 },
  "unreadCount": 1,
  "message": "Notifications retrieved successfully"
}
```

### 1.2 Get Unread Count
- **Method**: `GET`
- **Path**: `/api/notifications/unread-count`
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "data": { "unreadCount": 3 },
  "message": "Unread count retrieved"
}
```

### 1.3 Real-Time SSE Stream
- **Method**: `GET`
- **Path**: `/api/notifications/stream`
- **Headers**:
  - `Accept: text/event-stream`
  - `Authorization: Bearer <token>` (or `?token=<jwt>` query param for EventSource)
- **Response**: Keep-alive HTTP chunked event stream (`text/event-stream`).
- **Events**:
  - `connected`: Emitted upon connection establishment with current unread count.
  - `notification`: Emitted in real time when a new notification is generated for this user.
  - `unreadCount`: Emitted when unread count changes.
  - `ping`: Periodic heartbeat every 25 seconds.

### 1.4 Mark Notification as Read
- **Method**: `PATCH`
- **Path**: `/api/notifications/:id/read`
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "data": { "_id": "673f8a...", "isRead": true, "readAt": "2026-11-01T10:20:00.000Z" },
  "message": "Notification marked as read"
}
```

### 1.5 Mark All as Read
- **Method**: `PATCH`
- **Path**: `/api/notifications/read-all`
- **Body**: `{ "category": "attendance" }` *(optional filter)*
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "data": { "modifiedCount": 3 },
  "message": "All notifications marked as read"
}
```

### 1.6 Mark Notification as Unread
- **Method**: `PATCH`
- **Path**: `/api/notifications/:id/unread`
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "data": { "_id": "673f8a...", "isRead": false, "readAt": null },
  "message": "Notification marked as unread"
}
```

### 1.7 Delete Notification
- **Method**: `DELETE`
- **Path**: `/api/notifications/:id`
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Notification deleted successfully"
}
```

### 1.8 Get Notification Preferences
- **Method**: `GET`
- **Path**: `/api/notifications/preferences`
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "categories": {
      "academic": true,
      "attendance": true,
      "examination": true,
      "assignment": true,
      "timetable": true,
      "announcement": true,
      "administrative": true,
      "system": true
    },
    "channels": { "inApp": true, "email": false }
  }
}
```

### 1.9 Update Notification Preferences
- **Method**: `PATCH`
- **Path**: `/api/notifications/preferences`
- **Body**:
```json
{
  "categories": { "assignment": false },
  "channels": { "email": false }
}
```
*(Attempts to disable `system` are safely ignored by the backend).*

---

## 2. Announcement API (`/api/announcements`)

### 2.1 Get Visible Announcements
- **Method**: `GET`
- **Path**: `/api/announcements`
- **Access**: All authenticated users (Student, Faculty, Admin).
- **Query Parameters**: `category`, `search`, `page`, `limit`.
- **Response**: Filtered announcements list strictly based on the user's role, branch, and semester.

### 2.2 Create Announcement
- **Method**: `POST`
- **Path**: `/api/announcements`
- **Access**: Faculty, Admin.
- **Body**:
```json
{
  "title": "Semester Examination Fee Deadline",
  "body": "The last date to submit examination fee without late fee is November 20.",
  "category": "examination",
  "priority": "high",
  "audience": "student",
  "targetBranches": ["CSE", "ECE"],
  "targetSemesters": [3, 5, 7],
  "status": "published"
}
```
- **Response (201 Created)**: Returns the created announcement and dispatches notifications if `status === 'published'`.

### 2.3 Publish Draft Announcement
- **Method**: `POST`
- **Path**: `/api/announcements/:id/publish`
- **Access**: Announcement Author or Admin.
- **Success Response (200 OK)**: Transitions `status` to `published`, stamps `publishedAt`, and triggers audience notifications.

### 2.4 Archive Announcement
- **Method**: `POST`
- **Path**: `/api/announcements/:id/archive`
- **Access**: Announcement Author or Admin.
- **Success Response (200 OK)**: Transitions `status` to `archived`.

### 2.5 Admin List All Announcements
- **Method**: `GET`
- **Path**: `/api/announcements/admin/all`
- **Access**: Admin only.
- **Query Parameters**: `status`, `audience`, `category`, `page`, `limit`.
- **Success Response (200 OK)**: Unrestricted institutional announcement ledger including drafts and archived notices.

