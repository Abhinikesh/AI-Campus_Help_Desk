# CampusSphere AI — Part 20: Placement Database Design & Schema Specifications

## 1. Overview & Data Architecture

The Part 20 Placement & Career Development subsystem introduces 11 dedicated MongoDB collections and extends 4 shared institutional models. All schemas adhere to strict Mongoose data validation, compound unique indexing for race-condition prevention, soft foreign keys, and integer paise currency storage.

---

## 2. Shared Model Extensions

### 2.1 User (`server/models/User.js`)
- Added `'placement_officer'` (TPO) and `'placement_coordinator'` to the allowed user role enum.
  ```javascript
  enum: [
    'student', 'faculty', 'admin', 'librarian', 'warden',
    'transport_manager', 'driver', 'attendant',
    'placement_officer', 'placement_coordinator'
  ]
  ```

### 2.2 Notification (`server/models/Notification.js`)
- Added `'placement'` to the notification category enum.

### 2.3 NotificationPreference (`server/models/NotificationPreference.js`)
- Added `placement: { type: Boolean, default: true }`.

### 2.4 Complaint (`server/models/Complaint.js`)
- Added `'placement'` to complaint categories, and added optional references `company` and `drive`.

---

## 3. Dedicated Placement Collections

### 3.1 Company (`server/models/Company.js`)
Master registry of corporate recruiters and enterprise employers.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `name` | String | Required, Trim, Text Index | Legal enterprise name |
| `companyCode` | String | Required, Unique, Trim, Uppercase | Normalized identifier (e.g. `TEST-CMP-GOOG`) |
| `industry` | String | Required, Trim, Text Index | Industry sector |
| `website` | String | Trim | Corporate website URL |
| `description` | String | Trim | Company overview |
| `location` | String | Trim, Text Index | Corporate / recruitment office location |
| `recruiterName` | String | Trim | HR point of contact |
| `recruiterEmail` | String | Trim, Lowercase | HR contact email |
| `recruiterPhone` | String | Trim | HR contact phone |
| `tier` | String | Enum: `['tier_1', 'tier_2', 'tier_3', 'mass_recruiter', 'dream', 'super_dream']` | Institutional recruitment tier |
| `verificationStatus` | String | Enum: `['verified', 'pending', 'rejected']` | Institutional clearance status |
| `status` | String | Enum: `['active', 'inactive']` | Operational status |

**Indexes:** Unique `{ companyCode: 1 }`, Text `{ name: 'text', industry: 'text', location: 'text' }`.

---

### 3.2 PlacementProfile (`server/models/PlacementProfile.js`)
Student career preferences, skills, resume pointer, and readiness scoring.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `student` | ObjectId | Required, Unique, Ref: `Student` | Student reference |
| `user` | ObjectId | Required, Unique, Ref: `User` | User reference |
| `registrationStatus` | String | Enum: `['registered', 'not_registered', 'opted_out', 'debarred']` | Placement cell registration |
| `resumeUrl` | String | Default: null | Stored file name |
| `resumeOriginalName` | String | Default: null | Original client file name |
| `resumeUploadedAt` | Date | Default: null | Resume upload timestamp |
| `careerInterests` | [String] | Array of strings | Target industries / domains |
| `preferredJobRoles` | [String] | Array of strings | Target designations |
| `technicalSkills` | [String] | Array of strings | Programming languages & tools |
| `projects` | [Object] | Array of project sub-docs | Academic & personal projects |
| `internships` | [Object] | Array of internship sub-docs | Prior work experience |
| `certifications` | [Object] | Array of cert sub-docs | Verified credentials |
| `profileCompletionScore` | Number | Min: 0, Max: 100 | Percentage profile completion |
| `profileStatus` | String | Enum: `['incomplete', 'complete', 'verified', 'needs_update']` | Readiness state |

**Indexes:** Unique `{ student: 1 }`, Unique `{ user: 1 }`, Index `{ registrationStatus: 1 }`.

---

### 3.3 PlacementOpportunity (`server/models/PlacementOpportunity.js`)
Job vacancies and internship positions posted by companies.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `opportunityCode` | String | Required, Unique, Uppercase, Trim | Unique job vacancy code |
| `company` | ObjectId | Required, Ref: `Company` | Sponsoring company |
| `title` | String | Required, Trim | Job title |
| `description` | String | Required, Trim | Detailed JD |
| `opportunityType` | String | Enum: `['full_time', 'internship', 'apprenticeship', 'graduate_trainee']` | Employment type |
| `eligibleDepartments` | [String] | Array of uppercase strings | Eligible academic departments |
| `eligibleBranches` | [String] | Array of uppercase strings | Eligible engineering branches |
| `eligibleBatches` | [Number] | Array of integers | Eligible graduation batches |
| `minimumCgpa` | Number | Default: 0, Min: 0, Max: 10 | Minimum CGPA threshold |
| `maximumBacklogs` | Number | Default: 0, Min: 0 | Permissible active backlogs |
| `workLocation` | String | Required, Trim | Physical / base location |
| `workMode` | String | Enum: `['on_site', 'hybrid', 'remote']` | Work model |
| `compensationPaise` | Number | Default: 0, Min: 0 | Annual CTC in integer paise |
| `stipendPaise` | Number | Default: 0, Min: 0 | Monthly stipend in integer paise |
| `compensationDisplay` | String | Trim | Display package (e.g. `14 - 18 LPA`) |
| `applicationOpeningDate` | Date | Required | Applications start date |
| `applicationDeadline` | Date | Required, Index | Hard deadline for submissions |
| `status` | String | Enum: `['draft', 'pending_approval', 'published', 'applications_closed', 'completed', 'archived']` | Opportunity lifecycle state |

**Indexes:** Unique `{ opportunityCode: 1 }`, Index `{ company: 1, status: 1 }`, Index `{ applicationDeadline: 1 }`.

---

### 3.4 PlacementDrive (`server/models/PlacementDrive.js`)
Recruitment drive scheduling, venue, and assigned coordinators.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `driveCode` | String | Required, Unique, Uppercase, Trim | Drive identifier |
| `driveName` | String | Required, Trim | Drive title |
| `company` | ObjectId | Required, Ref: `Company` | Participating company |
| `opportunity` | ObjectId | Required, Ref: `PlacementOpportunity` | Linked vacancy |
| `academicYear` | String | Required, Trim | Academic session (e.g. `2025-2026`) |
| `registrationStartDate` | Date | Required | Student registration opens |
| `registrationEndDate` | Date | Required, Index | Student registration closes |
| `venue` | String | Trim | Hall / MS Teams link |
| `coordinators` | [ObjectId] | Ref: `User` | Assigned placement coordinators |
| `status` | String | Enum: `['draft', 'scheduled', 'registration_open', 'registration_closed', 'ongoing', 'completed', 'cancelled']` | Drive state |
| `calendarEvent` | ObjectId | Ref: `AcademicCalendarEvent` | Linked institutional calendar event |

**Indexes:** Unique `{ driveCode: 1 }`, Index `{ coordinators: 1 }`, Index `{ status: 1 }`.

---

### 3.5 PlacementSelectionStage (`server/models/PlacementSelectionStage.js`)
Ordered interview and assessment rounds.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `drive` | ObjectId | Required, Ref: `PlacementDrive` | Drive parent |
| `stageName` | String | Required, Trim | Round title |
| `stageType` | String | Enum: `['resume_screening', 'online_assessment', 'technical_interview', 'coding_interview', 'group_discussion', 'hr_interview', 'final_selection']` | Classification |
| `sequence` | Number | Required, Min: 1 | Ordered sequence (1, 2, 3...) |
| `scheduledDate` | Date | Default: null | Assessment / interview date |
| `venueOrLink` | String | Trim | Meeting details |
| `status` | String | Enum: `['scheduled', 'in_progress', 'completed', 'cancelled']` | Stage state |

**Indexes:** Compound Unique `{ drive: 1, sequence: 1 }`.

---

### 3.6 PlacementApplication (`server/models/PlacementApplication.js`)
Student candidate application with historical status transitions and snapshot.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `applicationNumber` | String | Required, Unique, Uppercase, Trim | e.g. `PL-APP-2026-0001` |
| `student` | ObjectId | Required, Ref: `Student` | Applicant |
| `opportunity` | ObjectId | Required, Ref: `PlacementOpportunity` | Targeted job |
| `drive` | ObjectId | Ref: `PlacementDrive` | Linked drive |
| `resumeUrl` | String | Required | Versioned resume document |
| `eligibilitySnapshot` | Object | Sub-document | Evaluated CGPA, backlogs, branch at submission time |
| `status` | String | Enum: `['submitted', 'under_review', 'shortlisted', 'assessment_scheduled', 'interview_scheduled', 'selected', 'offered', 'offer_accepted', 'offer_declined', 'rejected', 'withdrawn', 'on_hold']` | Current status |
| `statusHistory` | [Object] | Array of history items | Immutable state audit trail |

**Indexes:** Compound Unique `{ student: 1, opportunity: 1 }`, Index `{ opportunity: 1, status: 1 }`.

---

### 3.7 PlacementOffer (`server/models/PlacementOffer.js`)
Corporate employment offer with package in integer paise and student response.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `offerNumber` | String | Required, Unique, Uppercase, Trim | e.g. `OFF-2026-0001` |
| `application` | ObjectId | Required, Ref: `PlacementApplication` | Originating application |
| `student` | ObjectId | Required, Ref: `Student` | Hired student |
| `company` | ObjectId | Required, Ref: `Company` | Employer |
| `opportunity` | ObjectId | Required, Ref: `PlacementOpportunity` | Job position |
| `compensationPaise` | Number | Default: 0, Min: 0 | Annual CTC in integer paise |
| `compensationDisplay` | String | Trim | e.g. `16.5 LPA` |
| `offerLetterUrl` | String | Default: null | Stored offer letter document |
| `status` | String | Enum: `['draft', 'issued', 'accepted', 'declined', 'withdrawn', 'expired', 'revoked']` | Lifecycle state |
| `studentResponse` | String | Enum: `['pending', 'accepted', 'declined']` | Student formal decision |
| `isPlacementVerified` | Boolean | Default: false | TPO official verification |

**Indexes:** Unique `{ offerNumber: 1 }`, Compound Unique `{ student: 1, opportunity: 1 }`, Index `{ isPlacementVerified: 1 }`.

