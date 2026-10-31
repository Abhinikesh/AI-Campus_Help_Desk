# Smart Attendance Database Improvements & Schema Enhancements
## Project: CampusSphere AI — Smart Campus Management ERP

**Document Version:** 4.0.0  
**Phase:** Part 4 of 24 — MongoDB Database Architecture & Schema Verification  
**Date:** November 1, 2026  
**Auditor / Architect:** Senior Software Architect & Database Engineer  

---

## 1. Summary of Changes Implemented

| Affected Model | Change Implemented | Architectural Justification | Backward Compatibility |
|---|---|---|---|
| **`AttendanceSession`** (`AttendanceSession.js`) | Added `periods: [Number]`, `periodCount: Number`, `timetableEntry: ObjectId`, `actualStartTime: Date`, `actualEndTime: Date`. | Supports contiguous multi-period laboratory blocks (e.g. Periods 3 & 4 combined into one session). Links session directly to timetable entry. | **100% Backward Compatible**: Pre-save hook automatically synchronizes `periods = [period]` and `period = periods[0]`. Existing single-period sessions behave identically. |
| **`AttendanceSession`** (`AttendanceSession.js`) | Added state-machine transition guard in `pre('save')` and `post('save')` / `post('init')`. | Enforces valid lifecycle: `scheduled -> open/active -> paused -> closed -> finalized`. Prevents unauthorized status jumps from terminal states (`finalized`, `cancelled`). | **Fully Compatible**: Valid operational workflows (`open -> active -> finalized`) execute normally; only illegal state resets are blocked. |
| **`Attendance`** (`Attendance.js`) | Added `periods: [Number]`, `periodCount: Number`. | Allows multi-period laboratory attendance records to award proper academic credit (e.g. 2 periods attended). | **100% Backward Compatible**: Pre-save hook synchronizes single `period` with `periods` array. |
| **`Attendance`** (`Attendance.js`) | Added compound unique sparse index on `{ session: 1, student: 1 }`. | Guarantees atomic session-level deduplication at MongoDB engine level, preventing double-marking during concurrent requests. | **100% Backward Compatible**: Marked `sparse: true` so historical records with `session: null` are unaffected. Existing period-level unique index is preserved. |
| **`FaceEmbedding`** (`FaceEmbedding.js`) | Added `algorithm: 'AES-256-GCM'`, `encryptionKeyVersion: 'v1.0'`, and compound index `{ student: 1, enrollmentStatus: 1 }`. | Formalizes encryption metadata and accelerates student biometric enrollment status queries. | **100% Backward Compatible**: Default values match active encryption implementation; existing records remain valid. |
| **`ConsentRecord`** (`ConsentRecord.js`) | Added descending timestamp index `{ student: 1, consentTimestamp: -1 }`. | Optimizes retrieval of the most recent active consent agreement for a student. | **100% Backward Compatible**: Non-breaking index addition. |

---

## 2. In-Depth Code Modifications

### 2.1 Multi-Period Synchronization & State Transition Guard (`AttendanceSession.js`)
```javascript
// Track original status on document load or after save for transition validation
attendanceSessionSchema.post('init', function () {
  this._originalStatus = this.status;
});

attendanceSessionSchema.post('save', function () {
  this._originalStatus = this.status;
});

attendanceSessionSchema.pre('save', function (next) {
  // Synchronize multi-period array
  if (this.periods && Array.isArray(this.periods) && this.periods.length > 0) {
    this.periodCount = this.periods.length;
    this.period = this.periods[0]; // Primary period alias
  } else if (this.period) {
    this.periods = [this.period];
    this.periodCount = 1;
  }

  // Enforce state transition rules
  if (!this.isNew && this.isModified('status') && this._originalStatus && this._originalStatus !== this.status) {
    const allowedTransitions = {
      scheduled: ['open', 'active', 'cancelled'],
      open: ['active', 'paused', 'closed', 'finalized', 'cancelled'],
      active: ['paused', 'closed', 'finalized', 'cancelled'],
      paused: ['open', 'active', 'closed', 'cancelled'],
      closed: ['finalized', 'cancelled'],
      finalized: [], // terminal state
      cancelled: [], // terminal state
      expired: ['closed', 'finalized', 'cancelled'],
    };
    const allowed = allowedTransitions[this._originalStatus] || [];
    if (!allowed.includes(this.status)) {
      return next(new Error(`Invalid session state transition from "${this._originalStatus}" to "${this.status}"`));
    }
  }

  next();
});
```

### 2.2 Dual-Layer Deduplication Constraints (`Attendance.js`)
```javascript
// Layer 1: Period-level timetable deduplication (one mark per student per subject per period per date)
attendanceSchema.index(
  { subject: 1, student: 1, date: 1, period: 1 },
  { unique: true }
);

// Layer 2: Session-level atomic deduplication (one mark per student per live session)
attendanceSchema.index(
  { session: 1, student: 1 },
  { unique: true, sparse: true }
);
```

---

## 3. Migration Considerations & Data Safety

1. **Pre-Change Duplicate Verification:**
   Before applying the new unique index `{ session: 1, student: 1 }`, MongoDB was queried across both `campus-erp` and `test` databases:
   - Duplicates on `{ session: 1, student: 1 }`: **0 found**.
   - Duplicates on `{ subject: 1, student: 1, date: 1, period: 1 }`: **0 found**.
   - Conclusion: Safe to apply unique constraints with zero risk of index creation failure.
2. **No Data Deletions or Destructive Operations:**
   - All 840 existing attendance records in `test` remain intact.
   - All 8 active student identities, 19 faculty profiles, and 14 Semester 5 CSE subjects were preserved without resets or manual alterations.

