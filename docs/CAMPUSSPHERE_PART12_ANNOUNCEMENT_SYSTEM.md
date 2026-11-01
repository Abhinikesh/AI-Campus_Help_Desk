# CampusSphere AI — Part 12 Campus Announcement System

## 1. Overview & Capabilities

The CampusSphere AI Announcement module empowers Administrators and Faculty to create, publish, target, and archive institutional communications with granular audience targeting.

Unlike unorganized notice boards, announcements are structured documents categorized by priority and department, accompanied by automated real-time notification dispatch upon publication.

---

## 2. Announcement Schema (`server/models/Announcement.js`)

```javascript
{
  title: { type: String, required: true, trim: true, maxlength: 200 },
  body: { type: String, required: true, trim: true, maxlength: 10000 },
  category: {
    type: String,
    enum: ['general', 'academic', 'examination', 'events', 'administrative', 'emergency'],
    default: 'general'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  audience: {
    type: String,
    enum: ['all', 'student', 'faculty', 'department', 'semester'],
    default: 'all'
  },
  targetBranches: [{ type: String, trim: true }],
  targetSemesters: [{ type: Number, min: 1, max: 12 }],
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'published'
  },
  createdBy: { type: ObjectId, ref: 'User', required: true },
  authorName: { type: String, trim: true },
  authorRole: { type: String, enum: ['admin', 'faculty'] },
  publishedAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null }
}
```

### Compatibility Alias
A virtual property `content` aliases `body` so legacy frontend components or scripts referencing `announcement.content` continue to render seamlessly.

---

## 3. Publication Lifecycle & State Transitions

Announcements progress through three distinct lifecycle states:

```
                  +-------------------+
                  |       Draft       | (Only author & admin can view/edit)
                  +-------------------+
                            |
                            | (POST /api/announcements/:id/publish)
                            v
                  +-------------------+
                  |     Published     | (Visible in public feed; triggers audience push)
                  +-------------------+
                            |
                            | (POST /api/announcements/:id/archive)
                            v
                  +-------------------+
                  |     Archived      | (Hidden from active feed; retained in records)
                  +-------------------+
```

1. **Draft**:
   - Allows authors to draft complex notices without prematurely notifying campus members.
   - Strictly excluded from public student and faculty feeds (`status: 'published'`).
2. **Published**:
   - `publishedAt` is stamped with the server's current UTC timestamp.
   - Instantly triggers audience recipient resolution and generates notifications for all matching active users.
   - Pushes real-time SSE alerts to currently connected students and faculty.
3. **Archived**:
   - Cleans the public feed while preserving audit logs, compliance records, and historical references.

---

## 4. Audience Scoping & Access Control Matrix

The announcement query engine evaluates the user's role, academic branch, and semester to determine visibility:

| Announcement Audience | Target Branches | Target Semesters | Visible to Students | Visible to Faculty | Visible to Admins |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `'all'` | (Any) | (Any) | Yes (All) | Yes (All) | Yes (All) |
| `'faculty'` | (Any) | (Any) | **No** | Yes (All) | Yes (All) |
| `'student'` | `['CSE']` | `[5]` | **CSE Sem 5 Only** | No | Yes (All) |
| `'department'` | `['ECE']` | (Any) | **ECE Students** | **ECE Faculty** | Yes (All) |
| `'semester'` | (Any) | `[1, 2]` | **Sem 1 & 2 Students**| No | Yes (All) |

---

## 5. Automated Audience Notification Dispatch

When an announcement transitions to `published`:

1. `resolveAudienceRecipients(announcement)` evaluates targeting rules against the database:
   - For `all`: Queries all `isActive: true` users.
   - For `faculty`: Queries faculty users.
   - For `department`: Queries students with matching branch and faculty members in the department.
   - For `student` / `semester`: Queries students matching the specific semester and branch filters.
2. `notificationService.createBulkNotifications` creates recipient documents with an idempotency prefix `ann_<id>`.
3. Notifications contain a direct target route (`/student/dashboard` or `/faculty/dashboard`), category `'announcement'`, and priority matching the announcement's priority.
4. Active users connected via Server-Sent Events immediately receive an unread badge update without page refresh.

