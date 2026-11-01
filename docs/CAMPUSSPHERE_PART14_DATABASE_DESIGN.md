# CampusSphere AI — Part 14: Examination & Marks Database Design

## 1. Executive Summary

This document details the MongoDB schema design, indexing strategies, validation constraints, and referential integrity mechanisms implemented in **CampusSphere AI — Part 14** for the `Exam` and `Mark` collections.

---

## 2. Schema Specifications

### 2.1. `Exam` Collection (`server/models/Exam.js`)

The `Exam` model defines individual assessment instances (e.g. Mid-Semester, End-Semester, Lab Practicals, Quizzes).

```javascript
{
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120
  },
  examType: {
    type: String,
    enum: ['mid-sem', 'end-sem', 'lab', 'quiz', 'assignment', 'other'],
    default: 'mid-sem'
  },
  subject: {
    type: Schema.Types.ObjectId,
    ref: 'Subject',
    required: true,
    index: true
  },
  faculty: {
    type: Schema.Types.ObjectId,
    ref: 'Faculty',
    required: true,
    index: true
  },
  academicYear: {
    type: String,
    required: true,
    trim: true // e.g., '2025-2026'
  },
  department: {
    type: String,
    required: true,
    trim: true
  },
  semester: {
    type: Number,
    required: true,
    min: 1,
    max: 8
  },
  section: {
    type: String,
    trim: true // Optional section targeting (e.g., 'A', 'B')
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  startTime: {
    type: String,
    required: true,
    trim: true // Format: 'HH:mm'
  },
  endTime: {
    type: String,
    required: true,
    trim: true // Format: 'HH:mm'
  },
  durationMinutes: {
    type: Number,
    required: true,
    min: 15,
    max: 360,
    default: 180
  },
  room: {
    type: String,
    required: true,
    trim: true // Examination Hall / Room identifier
  },
  maximumMarks: {
    type: Number,
    required: true,
    min: 1,
    default: 100
  },
  passingMarks: {
    type: Number,
    required: true,
    min: 0,
    default: 40
  },
  instructions: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'ongoing', 'completed', 'cancelled', 'archived'],
    default: 'scheduled',
    index: true
  },
  evaluationStatus: {
    type: String,
    enum: ['marks_pending', 'submitted_for_review', 'approved', 'published', 'correction_requested'],
    default: 'marks_pending',
    index: true
  },
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  publishedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  publishedAt: {
    type: Date
  }
}
```

#### Compound Indexes for `Exam`:
1. `{ department: 1, semester: 1, date: 1 }`: Fast retrieval of cohort-specific timetables and conflict checks.
2. `{ room: 1, date: 1, startTime: 1 }`: Accelerated room booking conflict detection.
3. `{ faculty: 1, status: 1 }`: Optimization of faculty examination hub dashboard.

---

### 2.2. `Mark` Collection (`server/models/Mark.js`)

The `Mark` model records student assessment scores with full lifecycle tracking and immutable revision auditing.

```javascript
{
  student: {
    type: Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
    index: true
  },
  subject: {
    type: Schema.Types.ObjectId,
    ref: 'Subject',
    required: true,
    index: true
  },
  exam: {
    type: Schema.Types.ObjectId,
    ref: 'Exam',
    index: true
  },
  marksObtained: {
    type: Number,
    min: 0,
    default: 0
  },
  maxMarks: {
    type: Number,
    required: true,
    min: 1,
    default: 100
  },
  passingMarks: {
    type: Number,
    min: 0,
    default: 40
  },
  isAbsent: {
    type: Boolean,
    default: false
  },
  isWithheld: {
    type: Boolean,
    default: false
  },
  remarks: {
    type: String,
    trim: true,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'approved', 'published', 'correction_requested'],
    default: 'draft',
    index: true
  },
  evaluatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  evaluatedAt: {
    type: Date
  },
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  publishedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  publishedAt: {
    type: Date
  },
  correctionHistory: [
    {
      previousMarks: { type: Number, required: true },
      newMarks: { type: Number, required: true },
      reason: { type: String, required: true, trim: true },
      requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      correctedAt: { type: Date, default: Date.now }
    }
  ]
}
```

#### Indexing Strategy:
- **Compound Unique Index for Exam Marks:**
  ```javascript
  markSchema.index(
    { student: 1, exam: 1 },
    {
      unique: true,
      partialFilterExpression: { exam: { $type: 'objectId' } }
    }
  );
  ```
  *Technical Note on Partial Index:* In MongoDB, partial index expressions cannot use `$ne` or `$not`. Using `{ exam: { $type: 'objectId' } }` ensures uniqueness only for modern assessment records referencing an `Exam`, while safely accommodating legacy documents without `exam` fields.
- **Legacy Unique Index:**
  ```javascript
  markSchema.index(
    { student: 1, subject: 1 },
    {
      unique: true,
      partialFilterExpression: { exam: { $exists: false } }
    }
  );
  ```

---

## 3. Virtual Fields & Computed Properties

Virtual getters are registered on `markSchema` to guarantee consistent grading calculations across the application:

1. **`percentage`:**
   ```javascript
   markSchema.virtual('percentage').get(function() {
     if (this.isAbsent) return 0;
     const max = this.maxMarks || (this.exam && this.exam.maximumMarks) || 100;
     if (!max || max <= 0) return 0;
     const obtained = this.marksObtained !== undefined ? this.marksObtained : (this.total || 0);
     return Math.round(((obtained / max) * 100) * 100) / 100;
   });
   ```

2. **`grade`:**
   Maps the computed percentage to the UGC 10-point letter grade (`O`, `A+`, `A`, `B+`, `B`, `C`, `P`, `F`).

3. **`isPassed`:**
   Evaluates `!this.isAbsent && this.marksObtained >= this.passingMarks`.

---

## 4. Referential Integrity Guarantees

1. **Cascade Verification:** Prior to exam scheduling, the service verifies that the `subject` exists, the `faculty` is assigned to teach that subject, and no conflicting examination occupies the same `room` or `department/semester` cohort.
2. **Atomic Upgrades:** Bulk draft marks saving utilizes MongoDB upsert operations (`Mark.findOneAndUpdate({ student, exam }, { ... }, { upsert: true, new: true })`), preventing race conditions and race-corrupted duplicate entries.
3. **Immutability of Historical Corrections:** Marks corrections append new entries to the `correctionHistory` sub-array rather than overwriting previous values in place, providing a complete forensic audit log.

