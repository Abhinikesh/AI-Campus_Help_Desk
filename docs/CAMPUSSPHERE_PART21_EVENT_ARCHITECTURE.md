# CampusSphere AI — Part 21: Event Architecture & System Principles

## 1. Architectural Overview

The Campus Events, Clubs, Workshops & Student Activities Management System provides an end-to-end framework for extracurricular and co-curricular campus governance:
$$\text{Event Proposal} \longrightarrow \text{Faculty/Admin Review} \longrightarrow \text{Calendar Sync \& Publishing} \longrightarrow \text{Atomic Registration / Waitlisting} \longrightarrow \text{Event Attendance} \longrightarrow \text{Verifiable Honors}$$

The subsystem is integrated natively into the Node.js/Express backend, Mongoose/MongoDB data tier, and React 19 frontend of CampusSphere AI.

```
       ┌────────────────────────────────────────────────────────┐
       │                   Student Portal                       │
       │    (/student/activities - Events, Clubs, Certs)        │
       └───────────────────────────┬────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          Express Router                                 │
│          /api/events  ·  /api/clubs  ·  /api/certificates               │
│               (Auth & Role RBAC Middleware: allowRoles)                 │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Event Controller & Services                        │
│   · event.controller.js              · event.service.js                 │
│     - Proposal / Approval Workflow     - Concurrency-safe seat claims   │
│     - Club Directory & Memberships     - Deterministic waitlist queuing │
│     - Venue booking & conflict checks  - Calendar synchronization       │
│     - Isolated Event Attendance        - CWE-1236 CSV Sanitization      │
│     - Cryptographic Certificates       - Real-time SSE Notifications    │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          MongoDB Layer                                  │
│   CampusEvent        EventApproval        StudentClub     ClubMembership│
│   EventRegistration  EventVenue           EventBooking    EventAttendance
│   EventCertificate   EventAnnouncement    EventFeedback   EventAuditLog │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Design Principles

### 2.1 Academic Attendance Decoupling
- Event attendance tracked in `EventAttendance.js` is **strictly isolated** from course lecture and laboratory attendance (`Mark.js`, `AttendanceSession.js`).
- Marking an event attendee present or absent has zero side-effects on academic grade points, eligibility thresholds, or UGC credits.

### 2.2 Concurrency-Safe Seat Claims & Zero Overselling
- High-demand events (e.g. annual technical fests, hackathons, celebrity lectures) experience race conditions when multiple students click "Register" simultaneously.
- Seats are claimed using atomic MongoDB conditional increments:
  ```javascript
  CampusEvent.findOneAndUpdate(
    { _id: eventId, $expr: { $lt: ['$allocatedParticipantsCount', '$maxParticipants'] } },
    { $inc: { allocatedParticipantsCount: 1 } },
    { new: true }
  );
  ```
- If capacity is exhausted and waitlisting is enabled, registrations enter the waitlist queue atomically without overselling.

### 2.3 Deterministic Waitlist Queuing & Automatic Promotion
- Waitlisted students are assigned an incremental `waitlistNumber`.
- When an active confirmed registration is cancelled:
  1. The event's `allocatedParticipantsCount` is decremented.
  2. `eventService.promoteNextWaitlistedParticipant(eventId)` queries the lowest `waitlistNumber`.
  3. The waitlisted student is atomically transitioned to `status: 'confirmed'`, clearing their waitlist number and sending a high-priority SSE notification.

### 2.4 Venue Conflict Prevention
- Physical spaces (auditoriums, seminar halls, computer labs) cannot be double-booked.
- Overlap detection checks if any confirmed booking exists where `startDateTime < newEnd` and `endDateTime > newStart`.

### 2.5 Verifiable Cryptographic Certificates
- Certificates generated for verified attendees or prize winners feature a unique certificate identifier (`CERT-YYYY-XXXXX`) and a crypto-random hex verification token (`crypto.randomBytes(16)`).
- Public verification is exposed at `/api/certificates/verify/:identifier`, displaying authenticity status without leaking student private emails, phone numbers, or academic marks.
