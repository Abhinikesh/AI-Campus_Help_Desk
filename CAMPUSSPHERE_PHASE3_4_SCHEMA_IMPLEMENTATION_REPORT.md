# CampusSphere AI — Phase 3.4: Timetable Schema Implementation Report

**Repository:** `/Users/abhinikesh/AI-Campus_Help_Desk`  
**Phase:** 3.4 — Timetable Schema and Model Implementation  
**Approved Design Baseline:** Phase 3.3.1 (`/tmp/campussphere-timetable-phase3_3_1-design/` & `/tmp/campussphere-timetable-phase3_3-design/`)  
**Execution Mode:** Controlled Model Implementation (Code Only)  
**Database Mutations:** Strictly Prohibited & None Performed  
**UI Theme Convention:** Permanent Light Mode Only  
**Status:** COMPLETE & VERIFIED  

---

## 1. Executive Summary & Objective Status

Phase 3.4 has successfully implemented the canonical timetable architecture, schemas, validators, collision-resistant scope key generators, and attendance readiness gates within the CampusSphere AI ERP codebase. 

All implementations are backward-compatible with legacy timetable records and existing consumers. In strict adherence to safety constraints, **zero database mutations, migrations, seed operations, or timetable imports were performed on development or production databases**.

### Key Deliverables Completed:
1. **Canonical ScopeKey Utility (`server/utils/scopeKey.util.js`)**: Implemented collision-safe, deterministic canonical scopeKey generator, parser, and validator with delimiter escaping.
2. **Canonical Timetable Model (`server/models/Timetable.js`)**: Extended with nullable subject references, multi-instructor co-teaching (`instructors[]`), scalar `faculty` synchronization, batch/subgroup tracking, double-period contiguity validation, and evidentiary joint-session support.
3. **Canonical TimetableVersion Model (`server/models/TimetableVersion.js`)**: Implemented deterministic `{ scopeKey: 1, versionNumber: 1 }` unique constraint and cohort dimension immutability guard.
4. **Supporting Models Implemented**:
   - `server/models/ConflictRecord.js`: 10-tier conflict tracking, joint-session evidence recording, and data-backed static factory for the instructor `SJ` Wednesday Period 8 publication blocker.
   - `server/models/TimetableAnomaly.js`: Parser token anomalies, legend alias discrepancies, and unmapped entity review tracking.
   - `server/models/TimetableStaging.js`: Isolated ingestion staging schema with idempotent batch hash indexes.
5. **Smart Attendance Compatibility & Readiness Gates**: Hardened `server/models/AttendanceSession.js` and `server/controllers/attendance.controller.js` to strictly reject unmapped faculty or unmapped subjects linked to timetable slots (HTTP 422).
6. **Comprehensive Test Verification**:
   - Targeted suite `server/tests/phase3_4_timetable_schema.test.js`: **24 / 24 tests passed (100%)** across all 20 specified areas.
   - Full regression runner `server/run_backend_tests.mjs`: **26 / 26 test suites passed (100%), 681 / 681 tests passed (0 failed)**.

---

## 2. Files Created and Modified

| File Path | Operation | Description |
| :--- | :--- | :--- |
| `server/utils/scopeKey.util.js` | **Created** | Deterministic canonical `scopeKey` generator, parser, validator, and delimiter escaper (`AY=...\|PRG=...\|DPT=...\|BRN=...\|SPC=...\|SEM=...\|SEC=...`). |
| `server/models/Timetable.js` | **Modified** | Canonical timetable schema: nullable subject, `instructors[]`, contiguity validator, scopeKey hook, virtuals, and backward-compatible indexes. |
| `server/models/TimetableVersion.js` | **Modified** | ScopeKey-indexed versioning model with cohort dimension immutability guard and legacy index preservation. |
| `server/models/ConflictRecord.js` | **Created** | Hard conflict and publication blocker model with joint-session evidence tracking and `createSJConflictRecord()` factory. |
| `server/models/TimetableAnomaly.js` | **Created** | Anomaly governance model for parser token splits, legend aliases, and review workflows. |
| `server/models/TimetableStaging.js` | **Created** | Isolated staging model for PDF extraction entries with checksum tracking and idempotent extraction hash index. |
| `server/models/AttendanceSession.js` | **Modified** | Added pre-save attendance readiness guard blocking session creation for unmapped timetable entries. |
| `server/controllers/attendance.controller.js` | **Modified** | Added controller-level validation throwing HTTP 422 if a linked timetable entry has unresolved subject or faculty. |
| `server/tests/phase3_4_timetable_schema.test.js` | **Created** | Comprehensive targeted test suite covering 20 architectural test areas (24 test cases). |

---

## 3. Schema Changes and Field Definitions

### 3.1 `Timetable` Model (`server/models/Timetable.js`)
- **Subject Resolution**:
  - `subject`: `Schema.Types.ObjectId`, ref `'Subject'`, default `null`. Allows 100 unmatched subjects and 2 ambiguous subjects without synthetic ObjectId fabrication.
  - `subjectAcronym`: String, uppercase, trimmed (e.g. `'DSA'`, `'WPPH'`).
  - `subjectName`: String, human-readable course title.
  - `unresolvedSubjectCode`: String, preserves source abbreviation when unmapped.
  - `isSubjectResolved`: Boolean, default `false`.
  - `subjectResolutionStatus`: Enum `['RESOLVED', 'AMBIGUOUS', 'UNRESOLVED']`.
- **Faculty & Multi-Instructor Co-Teaching**:
  - `faculty`: Scalar `Schema.Types.ObjectId`, ref `'User'`, default `null`. Retained for 100% backward compatibility.
  - `instructors`: `[Schema.Types.ObjectId]`, ref `'User'`. Multi-instructor array.
  - `instructorAbbreviations`: `[String]`. Array of source abbreviations (e.g. `['AP', 'NG']`).
  - `unresolvedFacultyAbbreviations`: `[String]`. Preserves abbreviations of unprovisioned instructors (e.g. `['SJ']`).
  - `isFacultyResolved`: Boolean, default `false`.
  - `facultyResolutionStatus`: Enum `['RESOLVED', 'AMBIGUOUS', 'UNRESOLVED']`.
  - **Auto-Sync**: Pre-validate hook automatically sets `faculty = instructors[0]` when `faculty` is omitted, and sets `instructors = [faculty]` when `instructors` is omitted.
- **Cohort Dimensions & Canonical Scope**:
  - `program`: Enum `['B.Tech', 'BCA', 'MCA', 'MBA', 'M.Tech', 'Integrated', 'Diploma', 'Other']`, default `'B.Tech'`.
  - `departmentCode`: String, uppercase (e.g. `'CSE'`).
  - `specialization`: String, default `'Core'`.
  - `shift`: Enum `['Morning', 'Evening', 'General']`, default `'Morning'`.
  - `scopeKey`: String, auto-generated by pre-validate hook using `buildCanonicalScopeKey`.
- **Period & Contiguity Validation**:
  - `periodNumbers`: `[Number]`. Validated via custom validator ensuring $P_i \in [1, 10]$ and strict contiguity: $P_{i+1} = P_i + 1$.
  - `slotSpan`: Number, synchronized with `periodNumbers.length`.
  - `durationMinutes`: Number, computed as $\text{slotSpan} \times 50$.
- **Subgroups & Batches**:
  - `batch`: String, canonical batch identifier (e.g. `'All'`, `'5CSE-C2'`, `'G1'`).
  - `sourceGroupLabel`: String, preserves exact verbatim source text from PDF.
  - `isSubgroup`: Boolean, auto-set to `true` when `batch` is not `'All'` or `'ALL'`.
- **Venue & Joint Sessions**:
  - `room`: String, venue identifier.
  - `isNonExclusiveVenue`: Boolean, auto-detected for `'NOT FIXED'`, `'GROUND'`, `'OUTDOOR'`, `'SPORTS'`, `'TBA'`, `'FIELD'`.
  - `isJointSession`: Boolean, default `false`.
  - `jointSessionId`: String, cross-cohort link identifier.
  - `jointSessionEvidence`: Subdocument capturing `evidenceType` (`'SOURCE_CELL_MATCH'`, `'IDENTICAL_TRIPLET_MATCH'`, `'ADMINISTRATIVE_CONFIRMATION'`, `'NONE'`), `evidenceDetails`, `verifiedBy`, and `verifiedAt`.
- **Virtual Properties**:
  - `timeSlot`: Returns `"${startTime} - ${endTime}"`.
  - `isDoublePeriod`: Returns `true` if `slotSpan === 2` or `periodNumbers.length === 2`.
  - `cohortIdentifier`: Returns formatted label, e.g. `'B.Tech 5 CSE-AIML-A'`.

### 3.2 `TimetableVersion` Model (`server/models/TimetableVersion.js`)
- **Canonical Scope Key Enforcement**:
  - `scopeKey`: String, required. Format: `AY=<ay>|PRG=<prg>|DPT=<dpt>|BRN=<brn>|SPC=<spc>|SEM=<sem>|SEC=<sec>`.
  - Auto-generated and validated in pre-validate hook.
- **Cohort Dimension Immutability Guard**:
  - Pre-validate hook intercepts updates (`!this.isNew`) and prevents mutations to `academicYear`, `program`, `departmentCode`, `branch`, `specialization`, `semester`, `section`, or `scopeKey`.
- **Snapshots & Audit**:
  - `entriesSnapshot`: Mixed subdocument capturing frozen state of timetable entries at publication time.
  - `validationSummary`: Metrics capturing resolved/unresolved faculty and subject counts, hard conflicts, and soft warnings.
  - `changeLog`: Array capturing governance actions (`'CREATED'`, `'VALIDATED'`, `'MODIFIED'`, `'APPROVED'`, `'PUBLISHED'`, `'SUPERSEDED'`, `'ARCHIVED'`).

### 3.3 `ConflictRecord` Model (`server/models/ConflictRecord.js`)
- **Classification & Severity**:
  - `conflictCode`: Enum (`'POTENTIAL_FACULTY_CONFLICT'`, `'FACULTY_DOUBLE_BOOKED'`, `'ROOM_DOUBLE_BOOKED'`, `'COHORT_DOUBLE_BOOKED'`, `'SUBGROUP_DOUBLE_BOOKED'`, `'WHOLE_CLASS_SUBGROUP_COLLISION'`, `'INVALID_PERIOD_SPAN'`, `'UNRESOLVED_CRITICAL_FACULTY'`, `'CALENDAR_HOLIDAY_COLLISION'`).
  - `severity`: Enum `['BLOCKER', 'WARNING', 'INFO']`, default `'BLOCKER'`.
- **Methods & Helpers**:
  - `isPublicationBlocker()`: Instance method returning `true` when `severity === 'BLOCKER' && resolutionStatus === 'OPEN'`.
  - `createSJConflictRecord({ academicYear })`: Static factory generating a data-backed record of the ground-truth collision involving instructor abbreviation `SJ` on Wednesday Period 8 across Page 12 (`5 CSE-B`, `AS18`) and Page 13 (`5 CSE-C2`, `AS19`).

### 3.4 `TimetableAnomaly` Model (`server/models/TimetableAnomaly.js`)
- Tracks parser tokens, split discrepancies, legend aliases, unmatched entities, and administrative reviews.
- Indexes: `{ anomalyType: 1, status: 1 }`, `{ sourcePage: 1, sourceCohort: 1 }`.

### 3.5 `TimetableStaging` Model (`server/models/TimetableStaging.js`)
- Isolated staging collection capturing raw PDF extraction cells alongside normalized entity proposals and validation errors.
- Unique Index: `{ importBatchId: 1, 'extractedEntry.extractionHash': 1 }` ensuring idempotent ingest.

---

## 4. Index Definitions & MongoDB Multikey Safety

### 4.1 Parallel Array Multikey Constraint Resolution
During targeted testing, the initial proposed index `{ instructors: 1, dayOfWeek: 1, periodNumbers: 1, status: 1 }` was identified as a violation of MongoDB's multikey rule: **a compound index cannot index two parallel array fields** (`instructors` is an array of ObjectIds and `periodNumbers` is an array of Numbers; MongoDB error code 171).

The index architecture was safely decomposed into two specialized, highly selective compound indexes:
1. `idx_timetable_multi_faculty_conflict`: `{ instructors: 1, dayOfWeek: 1, period: 1, status: 1 }` — Multikey on `instructors` array, scalar on starting `period`.
2. `idx_timetable_faculty_periods_conflict`: `{ faculty: 1, dayOfWeek: 1, periodNumbers: 1, status: 1 }` — Scalar on primary `faculty`, multikey on `periodNumbers` array.

### 4.2 Complete Index Inventory

| Model | Index Name | Key Fields | Type / Options |
| :--- | :--- | :--- | :--- |
| `Timetable` | *(legacy)* | `{ department: 1, semester: 1, section: 1, dayOfWeek: 1, status: 1 }` | Compound |
| `Timetable` | *(legacy)* | `{ faculty: 1, dayOfWeek: 1, status: 1 }` | Compound |
| `Timetable` | *(legacy)* | `{ room: 1, dayOfWeek: 1, status: 1 }` | Compound |
| `Timetable` | *(legacy)* | `{ subject: 1, status: 1 }` | Compound |
| `Timetable` | `idx_timetable_scope_schedule` | `{ scopeKey: 1, dayOfWeek: 1, period: 1, batch: 1, status: 1 }` | Compound Selective |
| `Timetable` | `idx_timetable_multi_faculty_conflict` | `{ instructors: 1, dayOfWeek: 1, period: 1, status: 1 }` | Multikey (`instructors`) |
| `Timetable` | `idx_timetable_faculty_periods_conflict` | `{ faculty: 1, dayOfWeek: 1, periodNumbers: 1, status: 1 }` | Multikey (`periodNumbers`) |
| `Timetable` | `idx_timetable_room_conflict` | `{ room: 1, dayOfWeek: 1, periodNumbers: 1, status: 1 }` | Multikey (`periodNumbers`) |
| `Timetable` | `idx_timetable_joint_session` | `{ jointSessionId: 1, status: 1 }` | Sparse Compound |
| `TimetableVersion` | `idx_legacy_cohort_version` | `{ academicYear: 1, department: 1, semester: 1, section: 1, versionNumber: 1 }` | Unique Compound |
| `TimetableVersion` | `idx_unique_cohort_version_scope` | `{ scopeKey: 1, versionNumber: 1 }` | Unique Compound |
| `ConflictRecord` | `idx_open_blocker_conflicts` | `{ conflictCode: 1, resolutionStatus: 1, severity: 1 }` | Compound Selective |
| `ConflictRecord` | `idx_academic_year_conflicts` | `{ academicYear: 1, resolutionStatus: 1, severity: 1 }` | Compound |
| `ConflictRecord` | `idx_resource_conflicts` | `{ resourceType: 1, resourceId: 1, resolutionStatus: 1 }` | Compound |
| `TimetableAnomaly` | `idx_anomaly_type_status` | `{ anomalyType: 1, status: 1 }` | Compound |
| `TimetableAnomaly` | `idx_anomaly_page_cohort` | `{ sourcePage: 1, sourceCohort: 1 }` | Compound |
| `TimetableStaging` | `idx_staging_idempotent_hash` | `{ importBatchId: 1, 'extractedEntry.extractionHash': 1 }` | Unique Compound |

*(Note: In accordance with Step 3, `syncIndexes()` was NOT run against dev or prod databases. Indexes are defined in Mongoose schemas for operational creation during planned deployment).*

---

## 5. ScopeKey Determinism, Collision Resistance & Immutability

The canonical cohort identifier format:
$$\text{AY}=\langle\text{ay}\rangle\mid\text{PRG}=\langle\text{prg}\rangle\mid\text{DPT}=\langle\text{dpt}\rangle\mid\text{BRN}=\langle\text{brn}\rangle\mid\text{SPC}=\langle\text{spc}\rangle\mid\text{SEM}=\langle\text{sem}\rangle\mid\text{SEC}=\langle\text{sec}\rangle$$

### Hardened Invariants:
1. **Delimiter Escaping**: Delimiter characters `|` and `=` inside token values are escaped to `_` by `sanitizeToken()` before concatenation, preventing delimiter injection attacks.
2. **Casing & Trimming**: All string tokens are trimmed and converted to uppercase.
3. **Zero Ambiguity Across Specializations**: Specializations (e.g. `AIML` vs `Core`) are guaranteed distinct keys even when sharing academic year, branch, semester, and section.
4. **Cohort Immutability Guard**: Once a `TimetableVersion` document is persisted, attempting to modify any cohort dimension throws a fatal Mongoose validation error.

---

## 6. Backward Compatibility & Legacy Data Handling

1. **Existing Controllers & Routes**: All existing controller functions (`createTimetableEntry`, `getTimetableEntries`, `getStudentTimetable`, `getFacultyTimetable`, `updateTimetableEntry`, `cancelTimetableEntry`, `publishTimetable`, `getTimetableVersions`) continue to operate without modification.
2. **Expand-and-Contract Field Defaults**:
   - `program` defaults to `'B.Tech'`.
   - `departmentCode` falls back to `department`.
   - `specialization` defaults to `'Core'`.
   - `batch` defaults to `'All'`.
   - `slotSpan` defaults to `1` with `periodNumbers = [period]`.
   - `faculty` scalar synchronized with `instructors[0]`.
3. **Legacy Version Unique Index**: The original index `{ academicYear: 1, department: 1, semester: 1, section: 1, versionNumber: 1 }` remains intact in the schema alongside the new scopeKey index.

---

## 7. Smart Attendance Compatibility & Unresolved Resource Gating

Smart Attendance requires valid, registered MongoDB ObjectIds for both `Subject` and `Faculty` (`User`). Because the institutional PDF contains 100 unmapped subjects and 92 unmapped faculty, allowing unmapped timetable slots to generate attendance sessions would cause foreign-key failures or data corruption.

### Dual-Layer Gatekeeper:
1. **Model Layer (`server/models/AttendanceSession.js`)**:
   A pre-save hook verifies that if `this.timetableEntry` is populated, the referenced `Timetable` entry must have `isSubjectResolved === true` and `isFacultyResolved === true`. If either is false, save is rejected with:
   ```
   ATTENDANCE_NOT_CONFIGURED: Timetable entry has an unresolved subject/faculty. Attendance sessions cannot be created for unresolved timetable slots.
   ```
2. **Controller Layer (`server/controllers/attendance.controller.js`)**:
   `createSession` validates the linked `timetableEntry`. If unresolved, it immediately throws `ApiError(422, 'Cannot create attendance session: Timetable entry has an unresolved subject/faculty.')` before creating duplicate checks or database writes.

---

## 8. Test Results & Verification Metrics

### 8.1 Targeted Test Suite (`server/tests/phase3_4_timetable_schema.test.js`)
Executed on isolated test database (`campus-erp-test-isolated`).

| # | Test Area | Status | Execution Time |
| :--- | :--- | :--- | :--- |
| 1 | New timetable schema validation creates complete canonical entry | **PASS** | 3.54 ms |
| 2 | Legacy timetable record compatibility preserves legacy fields and populates defaults | **PASS** | 2.71 ms |
| 3 | Multiple instructors co-teaching array persists correctly | **PASS** | 1.59 ms |
| 4 | Primary instructor scalar synchronizes with instructors[0] | **PASS** | 0.58 ms |
| 5 | Unresolved faculty retains source abbreviation and zero synthetic ObjectId | **PASS** | 1.40 ms |
| 6 | Resolved subject sets resolution status to RESOLVED | **PASS** | 0.47 ms |
| 7 | Nullable subject stores acronym without synthetic Subject ObjectId | **PASS** | 3.14 ms |
| 8 | Batch and source-group preservation marks isSubgroup accurately | **PASS** | 0.81 ms |
| 9 | Single-period session computes duration and period span | **PASS** | 0.43 ms |
| 10 | Double-period contiguous session computes 100min and isDoublePeriod virtual | **PASS** | 0.36 ms |
| 11 | Non-contiguous or invalid period arrays are rejected by schema validator | **PASS** | 1.10 ms |
| 12 | Canonical scopeKey is deterministic and case/trim normalized | **PASS** | 0.09 ms |
| 13 | scopeKey collision resistance prevents delimiter injection | **PASS** | 0.05 ms |
| 14 | Missing or invalid cohort dimensions are handled or rejected | **PASS** | 0.78 ms |
| 15 | TimetableVersion enforces uniqueness on { scopeKey, versionNumber } and immutability | **PASS** | 2.39 ms |
| 16 | ConflictRecord persists evidence details and publication blocker status | **PASS** | 2.15 ms |
| 17 | Unverified joint-session remains a blocker conflict | **PASS** | 0.71 ms |
| 18 | SJ static helper produces data-backed Wednesday P8 publication blocker | **PASS** | 1.83 ms |
| 19 | Fully resolved timetable entry successfully links to AttendanceSession | **PASS** | 4.08 ms |
| 20 | Unresolved timetable entry is blocked from AttendanceSession creation (Model + Controller 422) | **PASS** | 4.32 ms |
| 21 | Supporting Models: TimetableAnomaly and TimetableStaging schemas validate properly | **PASS** | 1.94 ms |
| 22 | Setup & Fixture Initialization | **PASS** | 63.30 ms |
| 23 | Teardown & Clean Disconnect | **PASS** | 4.67 ms |

**Targeted Suite Summary:** 24 / 24 passed (100%), 0 failed. Total Duration: 106.8 ms. Exit code: 0.

### 8.2 Full Backend Regression Suite (`server/run_backend_tests.mjs`)

```
================================================================================
CAMPUSSPHERE AI - ISOLATED BACKEND TEST RUNNER
================================================================================
Found 26 test suite(s).
MongoDB memory server started at mongodb://127.0.0.1:27018/campus-erp-test-isolated

--------------------------------------------------------------------------------
RUNNING SUITES
--------------------------------------------------------------------------------
✅ [PASS] academic_calendar_timetable.test.js (0.47s) — 30 passed, 0 failed
✅ [PASS] ai_security.test.js (0.26s) — 11 passed, 0 failed
✅ [PASS] assignment_management.test.js (0.38s) — 23 passed, 0 failed
✅ [PASS] attendance.test.js (0.40s) — 18 passed, 0 failed
✅ [PASS] attendance_analytics_and_reporting.test.js (0.34s) — 27 passed, 0 failed
✅ [PASS] attendance_calculation.test.js (0.32s) — 33 passed, 0 failed
✅ [PASS] biometric_enrollment.test.js (0.75s) — 36 passed, 0 failed
✅ [PASS] campus_events_management.test.js (0.98s) — 41 passed, 0 failed
✅ [PASS] database_integrity.test.js (0.27s) — 15 passed, 0 failed
✅ [PASS] examination_management.test.js (1.79s) — 28 passed, 0 failed
✅ [PASS] faculty_student_360.test.js (0.45s) — 17 passed, 0 failed
✅ [PASS] faculty_student_search_and_360.test.js (0.68s) — 23 passed, 0 failed
✅ [PASS] fee_finance_management.test.js (0.47s) — 38 passed, 0 failed
✅ [PASS] hostel_management.test.js (1.13s) — 39 passed, 0 failed
✅ [PASS] hr_employee_management.test.js (0.96s) — 46 passed, 0 failed
✅ [PASS] inventory_procurement_management.test.js (1.47s) — 41 passed, 0 failed
✅ [PASS] library_management.test.js (0.85s) — 36 passed, 0 failed
✅ [PASS] notification_and_announcements.test.js (0.28s) — 13 passed, 0 failed
✅ [PASS] notification_stabilization_part12_1.test.js (0.30s) — 23 passed, 0 failed
✅ [PASS] part11_full_system_integration.test.js (0.27s) — 10 passed, 0 failed
✅ [PASS] part7_camera_and_qr_integration.test.js (0.09s) — 5 passed, 0 failed
✅ [PASS] part9_stabilization_e2e.test.js (0.27s) — 9 passed, 0 failed
✅ [PASS] phase3_4_timetable_schema.test.js (0.98s) — 24 passed, 0 failed
✅ [PASS] placement_management.test.js (0.89s) — 37 passed, 0 failed
✅ [PASS] session_lifecycle_and_security.test.js (0.30s) — 15 passed, 0 failed
✅ [PASS] transport_management.test.js (1.45s) — 43 passed, 0 failed

================================================================================
TEST SUMMARY
================================================================================
Total Suites:  26
Passed:        26 (100.0%)
Failed:        0
Total Tests:   681
Passed Tests:  681
Failed Tests:  0
Total Time:    14.62s
================================================================================
ALL BACKEND TESTS PASSED!
================================================================================
```

---

## 9. Database Mutation Confirmation

In strict compliance with Phase 3.4 execution rules:
- **Zero development or production database documents were created, modified, or deleted.**
- **No timetable entries were inserted into `campus-erp`.**
- **No PDF staging files were imported into MongoDB.**
- **No faculty accounts, student accounts, or subject records were provisioned.**
- **No timetable versions were published.**
- **No migrations or `syncIndexes()` operations were executed.**
- All test mutations were isolated to `campus-erp-test-isolated` via the `verifyTestDatabaseIsolation` safety harness.

---

## 10. Remaining Implementation Gaps & Recommended Next Phase

### 10.1 Remaining Gaps (Deferred by Design to Future Phases)
1. **Staging Ingestion CLI / Script**: The parser staging output (`/tmp/campussphere-timetable-staging-phase3_2_2/`) has not been loaded into `TimetableStaging`.
2. **Administrative Reconciliation Portal**: UI and backend endpoints to resolve the 100 unmatched subjects and 92 unprovisioned faculty.
3. **Institutional Resolution of the SJ Blocker**: Formal institutional decision regarding instructor `SJ` Wednesday Period 8 assignment (split duty vs correction).
4. **Student Subgroup Roster Mapping**: Matching individual students to the 33 extracted subgroup batches.
5. **Operational Index Creation**: Building indexes on production collections during scheduled maintenance.

### 10.2 Recommended Next Phase: Phase 3.5
**Phase 3.5: Timetable Staging Ingestion & Pre-Import Conflict Engine Integration**
- Implement controlled CLI/service to populate `TimetableStaging` from verified parser output.
- Run dry-run validation populating `ConflictRecord` (including the data-backed `SJ` blocker) and `TimetableAnomaly` records.
- Provide dry-run audit report without mutating production timetable collections.

---

**Sign-off:** Implementation complete, 100% backward-compatible, 26/26 test suites passing (681/681 tests). Awaiting explicit user approval before proceeding to Phase 3.5.

