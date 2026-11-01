# CampusSphere AI — Part 15: Timetable & Calendar Database Design

## 1. Overview

This document specifies the MongoDB collections, schema definitions, compound indexes, and referential integrity constraints implemented for **CampusSphere AI — Part 15: Academic Calendar, Timetable Management & Scheduling Integration**.

---

## 2. Schema Specifications

### 2.1. `Timetable` Collection (`server/models/Timetable.js`)

Defines authoritative weekly recurring class periods, lecture halls, and laboratory blocks.

```javascript
{
  subject: {
    type: Schema.Types.ObjectId,
    ref: 'Subject',
    required: true,
    index: true
  },
  faculty: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  academicYear: {
    type: String,
    default: '2026-2027',
    trim: true,
    required: true
  },
  department: {
    type: String,
    default: 'CSE',
    trim: true,
    required: true
  },
  branch: {
    type: String,
    default: 'CSE',
    trim: true
  },
  semester: {
    type: Number,
    default: 5,
    min: 1,
    max: 10
  },
  section: {
    type: String,
    default: 'A',
    trim: true
  },
  batch: {
    type: String,
    default: 'All',
    trim: true
  },
  dayOfWeek: {
    type: Number,
    required: true,
    min: 0,
    max: 6 // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  },
  dayName: {
    type: String,
    trim: true
  },
  period: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  },
  periodCount: {
    type: Number,
    default: 1,
    min: 1,
    max: 6
  },
  startTime: {
    type: String,
    required: true,
    trim: true // e.g., '09:00'
  },
  endTime: {
    type: String,
    required: true,
    trim: true // e.g., '10:00'
  },
  room: {
    type: String,
    default: 'TBA',
    trim: true
  },
  sessionType: {
    type: String,
    enum: ['Lecture', 'Lab', 'Tutorial', 'Seminar', 'Other'],
    default: 'Lecture'
  },
  effectiveStartDate: {
    type: Date,
    default: null
  },
  effectiveEndDate: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'updated', 'cancelled', 'archived'],
    default: 'draft',
    index: true
  },
  versionNumber: {
    type: Number,
    default: 1
  },
  changeHistory: [
    {
      previousValue: Schema.Types.Mixed,
      newValue: Schema.Types.Mixed,
      changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      changedAt: { type: Date, default: Date.now },
      reason: { type: String, required: true, trim: true, minlength: 5 }
    }
  ]
}
```

#### Compound Indexes for `Timetable`:
1. `{ department: 1, semester: 1, section: 1, dayOfWeek: 1, status: 1 }`: Fast retrieval of cohort weekly schedules and student view isolation.
2. `{ faculty: 1, dayOfWeek: 1, status: 1 }`: Faculty teaching schedule lookups and collision checks.
3. `{ room: 1, dayOfWeek: 1, status: 1 }`: Classroom double-booking prevention.
4. `{ subject: 1, status: 1 }`: Subject-specific schedule queries.

---

### 2.2. `AcademicCalendarEvent` Collection (`server/models/AcademicCalendarEvent.js`)

Stores institutional events, holidays, recess periods, symposiums, and administrative milestones.

```javascript
{
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    default: '',
    trim: true,
    maxlength: 2000
  },
  eventType: {
    type: String,
    enum: [
      'semester_start', 'semester_end',
      'holiday_academic', 'holiday_national', 'holiday_college',
      'examination_period', 'internal_assessment_period', 'practical_exam_period',
      'assignment_deadline', 'college_event', 'workshop_seminar',
      'faculty_meeting', 'registration_period', 'result_publication', 'other'
    ],
    default: 'college_event',
    required: true,
    index: true
  },
  startDate: {
    type: Date,
    required: true,
    index: true
  },
  endDate: {
    type: Date,
    required: true,
    index: true
  },
  isAllDay: {
    type: Boolean,
    default: true
  },
  academicYear: {
    type: String,
    default: '2026-2027',
    trim: true,
    required: true
  },
  department: {
    type: String,
    default: 'ALL',
    trim: true
  },
  branch: {
    type: String,
    default: 'ALL',
    trim: true
  },
  semester: {
    type: Number,
    default: 0, // 0 = all semesters
    min: 0,
    max: 10
  },
  section: {
    type: String,
    default: 'ALL',
    trim: true
  },
  audience: {
    type: String,
    enum: ['all', 'students', 'faculty', 'department', 'semester', 'admin'],
    default: 'all',
    index: true
  },
  venue: {
    type: String,
    default: 'Campus Wide',
    trim: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'cancelled', 'archived'],
    default: 'published',
    index: true
  }
}
```

#### Compound Indexes for `AcademicCalendarEvent`:
1. `{ academicYear: 1, startDate: 1, endDate: 1, status: 1 }`: Accelerated date-window queries for month and week calendar grids.
2. `{ audience: 1, department: 1, semester: 1 }`: Role-based event permission scoping.

---

### 2.3. `TimetableVersion` Collection (`server/models/TimetableVersion.js`)

Maintains immutable historical snapshots of published timetables.

```javascript
{
  academicYear: { type: String, required: true },
  department: { type: String, required: true },
  semester: { type: Number, required: true },
  section: { type: String, default: 'A' },
  versionNumber: { type: Number, required: true, default: 1 },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'published' },
  entryCount: { type: Number, default: 0 },
  entriesSnapshot: [
    {
      timetableId: Schema.Types.ObjectId,
      subjectId: Schema.Types.ObjectId,
      subjectCode: String,
      subjectName: String,
      facultyId: Schema.Types.ObjectId,
      facultyName: String,
      dayOfWeek: Number,
      dayName: String,
      period: Number,
      startTime: String,
      endTime: String,
      room: String,
      sessionType: String
    }
  ],
  publishedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  publishedAt: { type: Date, default: Date.now },
  notes: { type: String, default: '' }
}
```

#### Compound Unique Index:
`{ academicYear: 1, department: 1, semester: 1, section: 1, versionNumber: 1 }` (unique) ensures tamper-proof version sequence progression.

