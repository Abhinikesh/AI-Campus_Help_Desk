# CampusSphere AI — Part 21: Database Design & Schema Specifications

## 1. Overview

Part 21 introduces 12 dedicated Mongoose models and extends 5 shared platform schemas to manage the complete lifecycle of campus events, student clubs, venue allocations, attendance, and honors.

---

## 2. Dedicated Schemas

### 2.1 CampusEvent (`server/models/CampusEvent.js`)
- `title`: String, required, trim, maxlength: 200.
- `eventCode`: String, required, unique, uppercase, trim, indexed.
- `description`: String, required, trim, maxlength: 3000.
- `category`: Enum `['technical', 'cultural', 'sports', 'academic', 'workshop', 'seminar', 'conference', 'competition', 'orientation', 'community_service', 'other']`.
- `organizer`: ObjectId ref `'User'`, required, indexed.
- `organizerRole`: Enum `['admin', 'faculty', 'event_organizer', 'club_coordinator']`.
- `facultyCoordinator`: ObjectId ref `'Faculty'`, optional.
- `studentCoordinator`: ObjectId ref `'Student'`, optional.
- `club`: ObjectId ref `'StudentClub'`, optional.
- `venue`: ObjectId ref `'EventVenue'`, optional.
- `venueName`: String (cached venue name).
- `startDate`: Date, required, indexed.
- `endDate`: Date, required, indexed.
- `registrationOpeningDate`: Date, required.
- `registrationClosingDate`: Date, required, indexed.
- `maxParticipants`: Number, default: 100, min: 1.
- `allocatedParticipantsCount`: Number, default: 0, min: 0.
- `waitlistCount`: Number, default: 0, min: 0.
- `isWaitlistEnabled`: Boolean, default: true.
- `waitlistCapacity`: Number, default: 50, min: 0.
- `eligibilityCriteria`:
  - `allowedBranches`: [String] (empty = all).
  - `allowedSemesters`: [Number] (empty = all).
  - `allowedBatches`: [Number] (empty = all).
  - `clubMembershipRequired`: Boolean, default: false.
- `targetAudience`: Enum `['all', 'students', 'faculty', 'department', 'club_only']`.
- `targetDepartment`: String, default: 'ALL'.
- `registrationType`: Enum `['individual', 'team', 'open_walkin']`.
- `status`: Enum `['draft', 'pending_approval', 'approved', 'published', 'registration_open', 'registration_closed', 'ongoing', 'completed', 'cancelled', 'archived']`.
- `calendarEvent`: ObjectId ref `'AcademicCalendarEvent'`, optional.
- **Indexes:** `{ eventCode: 1 }` (unique), `{ status: 1, startDate: 1 }`, `{ category: 1, status: 1 }`, text index on `{ title: 'text', description: 'text' }`.

### 2.2 EventApproval (`server/models/EventApproval.js`)
- `event`: ObjectId ref `'CampusEvent'`, required.
- `stage`: Enum `['faculty_coordinator', 'department_head', 'dean_admin', 'final_publication']`.
- `reviewer`: ObjectId ref `'User'`, required.
- `status`: Enum `['pending', 'approved', 'rejected']`.
- `decisionDate`: Date, default: null.
- `comments`: String.
- `rejectionReason`: String.
- **Indexes:** `{ event: 1, stage: 1 }`.

### 2.3 StudentClub (`server/models/StudentClub.js`)
- `name`: String, required, trim, maxlength: 150.
- `code`: String, required, unique, uppercase, trim, indexed.
- `description`: String, required, trim, maxlength: 2000.
- `category`: Enum `['technical', 'robotics', 'ai_ml', 'entrepreneurship', 'cultural', 'music_arts', 'photography', 'sports', 'social_service', 'literary', 'other']`.
- `facultyAdvisor`: ObjectId ref `'Faculty'`, optional.
- `studentPresident`: ObjectId ref `'Student'`, optional.
- `membershipCapacity`: Number, default: 200.
- `activeMembersCount`: Number, default: 0.
- `meetingSchedule`: String, default: 'Every Wednesday 4:00 PM'.
- `isActive`: Boolean, default: true, indexed.

### 2.4 ClubMembership (`server/models/ClubMembership.js`)
- `club`: ObjectId ref `'StudentClub'`, required.
- `student`: ObjectId ref `'Student'`, required.
- `user`: ObjectId ref `'User'`, required.
- `academicYear`: String, default: '2026-2027'.
- `role`: Enum `['member', 'core_team', 'lead', 'coordinator', 'president']`.
- `status`: Enum `['submitted', 'under_review', 'approved', 'rejected', 'waitlisted', 'withdrawn', 'expired']`.
- `statementOfPurpose`: String, maxlength: 1000.
- `reviewedBy`: ObjectId ref `'User'`.
- `rejectionReason`: String.
- `statusHistory`: `[{ status, changedBy, note, changedAt }]`.
- **Indexes:** `{ club: 1, student: 1, academicYear: 1 }`, `{ student: 1, status: 1 }`.

### 2.5 EventRegistration (`server/models/EventRegistration.js`)
- `event`: ObjectId ref `'CampusEvent'`, required.
- `student`: ObjectId ref `'Student'`, required.
- `user`: ObjectId ref `'User'`, required.
- `registrationNumber`: String, required, unique, indexed (`REG-YYYY-XXXXX`).
- `status`: Enum `['registered', 'waitlisted', 'confirmed', 'cancelled', 'attended', 'absent', 'rejected']`.
- `waitlistNumber`: Number, default: null, indexed.
- `eligibilitySnapshot`: Object capturing student branch, semester, and club status at registration time.
- `registeredAt`: Date.
- `confirmedAt`: Date.
- `cancelledAt`: Date.
- `cancellationReason`: String.
- `statusHistory`: `[{ status, changedBy, reason, changedAt }]`.
- **Indexes:** `{ event: 1, student: 1 }`, `{ event: 1, status: 1, waitlistNumber: 1 }`.

### 2.6 EventVenue & EventVenueBooking (`server/models/EventVenue.js`, `EventVenueBooking.js`)
- `EventVenue`: `name`, unique `code`, `type` (`auditorium`, `seminar_hall`, `classroom`, `laboratory`, `sports_ground`), `location`, `capacity`, `facilities`, `isActive`.
- `EventVenueBooking`: `venue`, `event`, `bookingDate`, `startTime`, `endTime`, `startDateTime`, `endDateTime`, `bookedBy`, `status` (`confirmed`, `tentative`, `cancelled`, `completed`).
- **Conflict Index:** `{ venue: 1, startDateTime: 1, endDateTime: 1, status: 1 }`.

### 2.7 EventAttendance (`server/models/EventAttendance.js`)
- `event`: ObjectId ref `'CampusEvent'`, required.
- `student`: ObjectId ref `'Student'`, required.
- `registration`: ObjectId ref `'EventRegistration'`, required.
- `status`: Enum `['present', 'absent']`.
- `checkInTime`: Date.
- `markingMethod`: Enum `['manual', 'qr_scan', 'organizer_override']`.
- `markedBy`: ObjectId ref `'User'`.
- `correctionHistory`: `[{ previousStatus, newStatus, correctedBy, reason, correctedAt }]`.
- **Unique Compound Index:** `{ event: 1, student: 1 }`.

### 2.8 EventCertificate (`server/models/EventCertificate.js`)
- `certificateNumber`: String, required, unique, indexed (`CERT-YYYY-XXXXX`).
- `event`: ObjectId ref `'CampusEvent'`, required.
- `student`: ObjectId ref `'Student'`, required.
- `user`: ObjectId ref `'User'`, required.
- `participantName`: String.
- `studentRollNumber`: String.
- `eventTitle`: String.
- `eventDate`: Date.
- `certificateType`: Enum `['participation', 'completion', 'winner', 'runner_up', 'volunteer', 'organizer']`.
- `verificationToken`: String, unique (crypto-random hex).
- `status`: Enum `['issued', 'revoked']`.
- **Unique Compound Index:** `{ event: 1, student: 1, certificateType: 1 }`.

---

## 3. Shared Model Extensions

1. **`User.js`:** Roles expanded with `'event_organizer'` and `'club_coordinator'`.
2. **`Notification.js`:** Added `'event'` to `category` enum.
3. **`NotificationPreference.js`:** Added `event: { type: Boolean, default: true }`.
4. **`Complaint.js`:** Added `'event'` to `category` enum with optional `campusEvent` ref.
5. **`AcademicCalendarEvent.js`:** Added `'CampusEvent'` to `linkedEntityType` enum.
