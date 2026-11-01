# CampusSphere AI — Part 15: Timetable & Calendar Security Review

## 1. Executive Summary

This document reviews the authorization boundaries, role-based access controls (RBAC), data isolation guarantees, and injection prevention implemented for **CampusSphere AI — Part 15: Academic Calendar, Timetable Management & Scheduling Integration**.

---

## 2. Threat Modeling & Mitigation Matrix

| Threat Category | Potential Attack Vector | Implemented Mitigation | Verification Status |
| :--- | :--- | :--- | :---: |
| **Insecure Direct Object Reference (IDOR)** | Student queries another branch's unpublished timetable or private faculty meeting. | Server enforces student enrollment filters (`department`, `semester`, `section`) and filters `status: 'published'`. | Verified |
| **Unauthorized Schedule Modification** | Faculty member modifies or cancels another instructor's class slot. | Controller verifies slot ownership (`entry.faculty.toString() === req.user._id.toString()`) unless role is `admin`. | Verified |
| **Privilege Escalation** | Student or unauthorized faculty creates college-wide holidays or publishes timetables. | `allowRoles('admin')` middleware blocks unauthorized attempts with HTTP 403. | Verified |
| **Silent Schedule Overwrite** | Modifying published class times without student notification or audit logs. | Published slot updates require mandatory reason (min 5 chars) and write previous/new values to `changeHistory`. | Verified |
| **Date Timezone Shift (UTC vs IST)** | All-day events shifting to adjacent day due to UTC conversion in Indian college environment. | Uses ISO-8601 timestamps with standardized Asia/Kolkata boundary handling. | Verified |
| **Denial of Service / Double Booking** | Simultaneous concurrent requests attempting to book the same room or faculty. | Centralized conflict engine checks active database state and rejects collisions with HTTP 409. | Verified |

---

## 3. Role-Based Access Control (RBAC) Matrix

| Endpoint | Student | Faculty (Assigned) | Faculty (Other) | Admin |
| :--- | :---: | :---: | :---: | :---: |
| `GET /api/timetable/student` | ✅ Enrolled Only | ❌ 403 | ❌ 403 | ✅ Allowed |
| `GET /api/timetable/faculty` | ❌ 403 | ✅ Assigned | ❌ Filtered | ✅ Allowed (All) |
| `POST /api/timetable` | ❌ 403 | ✅ Self Only | ❌ 403 | ✅ Allowed |
| `PUT /api/timetable/:id` | ❌ 403 | ✅ Assigned | ❌ 403 | ✅ Allowed |
| `DELETE /api/timetable/:id` | ❌ 403 | ✅ Assigned | ❌ 403 | ✅ Allowed |
| `POST /api/timetable/publish` | ❌ 403 | ❌ 403 | ❌ 403 | ✅ Allowed |
| `GET /api/timetable/versions` | ❌ 403 | ❌ 403 | ❌ 403 | ✅ Allowed |
| `GET /api/calendar/events` | ✅ Audience Filtered | ✅ Audience Filtered | ✅ Audience Filtered | ✅ Full Access |
| `POST /api/calendar/events` | ❌ 403 | ❌ 403 | ❌ 403 | ✅ Allowed |
| `PUT /api/calendar/events/:id` | ❌ 403 | ❌ 403 | ❌ 403 | ✅ Allowed |
| `DELETE /api/calendar/events/:id`| ❌ 403 | ❌ 403 | ❌ 403 | ✅ Allowed |

