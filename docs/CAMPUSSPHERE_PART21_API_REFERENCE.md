# CampusSphere AI — Part 21: REST API Endpoint Reference

## Base URL: `/api/events`

All endpoints (except public certificate verification) require an authenticated session (`Bearer <token>` or HttpOnly cookie).

---

### 1. Events

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `POST` | `/api/events` | admin, faculty, event_organizer | Propose a new campus event |
| `GET` | `/api/events` | all authenticated | List paginated events with role filters |
| `GET` | `/api/events/:id` | all authenticated | Get event details with live eligibility evaluation |
| `PATCH` | `/api/events/:id` | admin, faculty, event_organizer | Update event parameters |
| `POST` | `/api/events/:id/submit` | admin, faculty, event_organizer | Submit draft event for formal approval |
| `PATCH` | `/api/events/:id/approval` | admin, faculty | Review (approve/reject) event proposal |
| `POST` | `/api/events/:id/publish` | admin, faculty | Publish approved event and sync to calendar |
| `POST` | `/api/events/:id/cancel` | admin, faculty, event_organizer | Cancel event, release venues, notify attendees |
| `GET` | `/api/events/:id/export-participants` | admin, faculty, event_organizer | Download sanitized participant CSV |

---

### 2. Registrations & Waitlist

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `POST` | `/api/events/:id/register` | student | Register for event or join waitlist |
| `PATCH` | `/api/events/:id/registrations/:regId/cancel` | student, admin | Cancel registration and promote next waitlisted candidate |
| `GET` | `/api/events/my-registrations` | student | Get student's registrations and waitlist statuses |
| `GET` | `/api/events/:id/registrations` | admin, faculty, organizer | Get all event registrations with status filters |

---

### 3. Student Clubs & Memberships

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `POST` | `/api/events/clubs` | admin, faculty, club_coordinator | Register a new student club |
| `GET` | `/api/events/clubs` | all authenticated | Browse active student clubs |
| `GET` | `/api/events/clubs/:id` | all authenticated | Get club details and current membership status |
| `POST` | `/api/events/clubs/:id/membership` | student | Apply for club membership |
| `PATCH` | `/api/events/clubs/:clubId/membership/:memId` | admin, faculty, coordinator | Review (approve/reject) club membership |
| `GET` | `/api/events/clubs/my-memberships` | student | List student's approved and pending memberships |

---

### 4. Venues & Scheduling

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `POST` | `/api/events/venues` | admin | Create physical campus venue |
| `GET` | `/api/events/venues` | all authenticated | List active campus venues |
| `POST` | `/api/events/venues/bookings` | admin, faculty, organizer | Book venue with overlap detection |

---

### 5. Attendance & Certificates

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `POST` | `/api/events/:id/attendance` | admin, faculty, organizer | Record participant attendance (present/absent) |
| `PATCH` | `/api/events/:id/attendance/:attendanceId` | admin, faculty, organizer | Audited attendance correction with reason |
| `GET` | `/api/events/:id/attendance` | admin, faculty, organizer | View attendance summaries and records |
| `POST` | `/api/events/:id/certificates/issue` | admin, faculty, organizer | Issue verifiable certificate to verified attendee |
| `GET` | `/api/events/my-certificates` | student | Retrieve student's issued certificates |
| `GET` | `/api/certificates/verify/:identifier` | **PUBLIC** | Verify authenticity of certificate number or token |

---

### 6. Announcements, Feedback & Analytics

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `POST` | `/api/events/announcements` | admin, faculty, organizer | Post targeted event or club announcement |
| `GET` | `/api/events/announcements` | all authenticated | List published announcements |
| `POST` | `/api/events/:id/feedback` | student | Submit post-event ratings and feedback |
| `GET` | `/api/events/reports/overview` | admin, faculty, organizer | Direct database aggregation metrics |
