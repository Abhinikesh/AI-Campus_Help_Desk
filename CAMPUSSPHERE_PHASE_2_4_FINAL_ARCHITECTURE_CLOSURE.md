# CampusSphere AI — Phase 2.4: Final Architecture Closure & Phase 3.1 Implementation Boundary

**Repository:** `/Users/abhinikesh/AI-Campus_Help_Desk`  
**Phase:** 2.4 — Final Architecture Closure & Phase 3.1 Implementation Boundary  
**Previous Reports:**
- `CAMPUSSPHERE_PHASE_2_2_FINAL_IMPORT_ARCHITECTURE.md`
- `CAMPUSSPHERE_PHASE_2_3_ARCHITECTURE_SAFETY_REVIEW.md`  
**Execution Mode:** Strictly Read-Only Architecture Inspection & Verification  
**Database Modification:** **STRICTLY ZERO (0) LIVE WRITES OR MUTATIONS**  
**UI Standard:** Permanent Light Mode Preserved  
**Status:** **READY FOR PHASE 3.1 CODE-ONLY IMPLEMENTATION — AFTER EXPLICIT USER AUTHORIZATION**

---

## Executive Summary

Phase 2.4 establishes the final architectural closure and implementation boundary for the CampusSphere AI institutional student dataset import. All previous statistical discrepancies, index behaviors, privacy rules, rollback mechanics, and model relationships have been verified and reconciled.

### Key Decisions Finalized in Phase 2.4

1. **Reconciliation of Student Master Arithmetic:**  
   Resolved the arithmetic contradiction regarding 554 vs 555 rows:
   * The sheet contains **556 total rows** (1 header row + 555 populated data rows).
   * **Row 555 is an invalid non-student row** (the sub-table header `COMPLETEROLLNO.`, `Name`, `Xth percentage` from Academic Records Table 2).
   * Excluding Row 555 yields exactly **554 authentic student rows**.
   * Among the 554 authentic rows, there are exactly **554 distinct raw roll strings** (0 raw duplicates). The historical figure of "555 distinct strings" counted the invalid header row string `COMPLETEROLLNO.` ($554 + 1 = 555$).
   * Under safe syntax normalization, there are exactly **552 distinct normalized roll keys** (2 duplicate pairs: Sayyam Jaggi in rows 2/309 and Rupesh Singh in rows 125/556).
   * There are **551 unique candidate human identities** if an administrator affirms that Row 554 (`9389818925`, phone number entered as roll) links to Row 267 (`1/24/SET/BCS/272`, Nishant Thakurela).
2. **Strict Code-Only Boundary for Phase 3.1:**  
   Phase 3.1 is strictly restricted to code-only model and schema authoring in the repository. It must **not** execute index migrations on the live MongoDB database. In `Student.js`, `autoIndex: false` is configured so that server startup in development or production never drops or alters existing live indexes. Index migrations are isolated into an independent, manually authorized administrative script.
3. **Complete Exclusion of Parental Information & Credentials (Privacy Minimization):**  
   Parental names, parental phone numbers, parental email addresses, admission passwords, and external credentials are permanently dropped at the parser boundary. They are **not** stored in `StudentStaging`, `StudentAcademicSubmission`, or `Student`.
4. **Decoupled `StudentInternship` Model:**  
   `StudentInternship.studentId` is confirmed optional (`required: false, default: null`), guaranteeing that all 559 authentic internship records are preserved even if student linkage is unresolved. Synthetic defaults (`mode: 'Offline'`, `stipendProvided: false`, `monthlyStipendAmount: 0`, `placementDone: false`) have been eliminated in favor of explicit `null`/unverified states.
5. **Standardized Batch Idempotency Keys:**  
   Every staging and import entity is keyed on `{ batchId: 1, sourceRow: 1 }` (and `sourceSheet` for staging), guaranteeing that re-running imports is deterministic and that row numbers across different batches or sheets never collide.
6. **Surgical Field-Level Rollback Engine:**  
   Rollback no longer depends exclusively on `updatedAt`. It executes field-level expected-value comparisons (`currentValue === changeLog.afterValue`), allowing safe reversal of import fields without overwriting subsequent legitimate edits or blocking rollbacks due to unrelated document updates.

---

## 1. Corrected Student Master Arithmetic Reconciliation

The following breakdown provides the mathematical derivation and proof for every figure in `Student Master`:

```
====================================================================================================
                        STUDENT MASTER ARITHMETIC RECONCILIATION PROOF
====================================================================================================

1. PHYSICAL EXCEL ROW ACCOUNTING
   - Total Sheet Rows: 556
   - Header Row: Row 1 (['University Roll Number', 'Student Name', 'Branch', ...])
   - Total Populated Data Rows: 555 (Rows 2 through 556)
   - Invalid Non-Student Infiltration: Exactly 1 row
     * Row 555: Col 1='COMPLETEROLLNO.', Col 2='Name', Col 3='Xth percentage'
     * Root Cause: Embedded header from Academic Records Table 2 inserted during manual consolidation.
   - AUTHENTIC STUDENT ROWS: 555 - 1 = 554

2. PRIMARY IDENTIFIER COUNTING (COL 1: UNIVERSITY ROLL NUMBER)
   - Blank / Empty Roll Cells: Exactly 0
   - Non-Empty Roll Cells: 555 (554 authentic student rows + 1 embedded header row)
   - Raw Distinct Strings Across ALL Data Rows: 555 (counting Row 555 string 'COMPLETEROLLNO.')
   - RAW DISTINCT STRINGS AMONG AUTHENTIC ROWS: 554 (100% distinct raw strings; 0 raw duplicates)

3. SYNTAX NORMALIZATION (WHITESPACE, CASING, SLASHES)
   - Distinct Normalized Keys (Basic Syntax): 554
     * '1)24SET/BCS/319' (parenthesis typo) remains distinct from '1/24/SET/BCS/319'
     * 'ROLL-1/24/SET/BCS/117' (prefix typo) remains distinct from '1/24/SET/BCS/117'
     * '9389818925' (phone number) remains distinct from '1/24/SET/BCS/272'

4. TYPO-CORRECTED SYNTAX NORMALIZATION (RESOLVING ')' -> '/' AND STRIPPING 'ROLL-')
   - Resolved Pair 1 (Sayyam Jaggi):
     * Row 2: Raw='1)24SET/BCS/319' -> Normalizes to '1/24/SET/BCS/319'
     * Row 309: Raw='1/24/SET/BCS/319' -> Normalizes to '1/24/SET/BCS/319'
     * Both share Application Number 'MRIIRS24/38670'. (1 duplicate pair -> -1 key)
   - Resolved Pair 2 (Rupesh Singh):
     * Row 125: Raw='1/24/SET/BCS/117' -> Normalizes to '1/24/SET/BCS/117'
     * Row 556: Raw='ROLL-1/24/SET/BCS/117' -> Normalizes to '1/24/SET/BCS/117'
     * Both represent Rupesh Singh. (1 duplicate pair -> -1 key)
   - DISTINCT SAFELY NORMALIZED IDENTIFIERS: 554 - 2 = 552

5. HUMAN IDENTITY RECONCILIATION & AMBIGUOUS PHONE ROLL
   - Case 3 (Nishant Thakurela):
     * Row 267: Roll='1/24/SET/BCS/272', App='MRIIRS24/27621', Name='Nishant Thakurela'
     * Row 554: Roll='9389818925' (Phone), App='MRIIRS24/27621', Name='Nishant Thakurela'
     * Strict Rule: Phone number is NOT a valid roll number and cannot auto-merge.
     * Algorithmic Count (Automated): 552 distinct normalized keys.
     * Human Student Identities (Post-Admin Confirmation): 552 - 1 = 551 human students.

====================================================================================================
SUMMARY ARITHMETIC TABLE:
  Total Populated Excel Data Rows:               555
  Minus Embedded Header Row (Row 555):           - 1
  --------------------------------------------------
  Authentic Student Records:                     554
  Raw Distinct Roll Strings (Authentic):         554
  Minus Syntax Typo Duplicates (Sayyam, Rupesh): - 2
  --------------------------------------------------
  Safely Normalized Roll Identifiers:            552
  Minus Ambiguous Phone-Roll Identity (Nishant): - 1 (Subject to Admin Approval)
  --------------------------------------------------
  Unique Confirmed Human Students:               551
====================================================================================================
```

---

## 2. Code-Only Phase 3.1 vs. Database Migration Boundary

To guarantee that implementation does not inadvertently mutate the live database, the project lifecycle is strictly segregated into four sequential stages:

```
+──────────────────────────────────────────────────────────────────────────────────────────────────+
|                                    PROJECT LIFECYCLE BOUNDARIES                                  |
+─────────────────────────+────────────────────────────────────────────────────────────────────────+
| Stage                   | Scope & Authorization Gates                                            |
+─────────────────────────+────────────────────────────────────────────────────────────────────────+
| Phase 3.1 (Code-Only)   | Author models, schemas, validators, and unit tests in Git repository.  |
|                         | ZERO live database writes. ZERO index migrations. Tests run on         |
|                         | isolated MongoMemoryServer. autoIndex: false set on Student.           |
+─────────────────────────+────────────────────────────────────────────────────────────────────────+
| Phase 3.2 (DB Migration)| Standalone script executed during authorized maintenance window:       |
|                         | Replaces user_1 unique index with partialFilterExpression index.       |
|                         | Pre-flight checks, backup snapshot, verification, and rollback ready.  |
+─────────────────────────+────────────────────────────────────────────────────────────────────────+
| Phase 3.3 (Data Staging)| Deterministic ingestion of Excel sheets into isolated staging tables   |
|                         | (StudentStaging, AdmissionApplication, etc.) with batchId.             |
|                         | Live students collection remains 100% untouched.                       |
+─────────────────────────+────────────────────────────────────────────────────────────────────────+
| Phase 3.4 (Promotion)   | Selective promotion of validated records into live collections.        |
|                         | Field-level change logging, admin review approval, atomic rollback.    |
+─────────────────────────+────────────────────────────────────────────────────────────────────────+
```

### 2.1 Mongoose `autoIndex` Configuration in Phase 3.1
In Mongoose, `autoIndex` defaults to `true`. If a model definition changes, Mongoose attempts to send `createIndex` commands to MongoDB upon boot. If options conflict with an existing index (e.g. `partialFilterExpression` on `user_1`), MongoDB throws an error.

**Phase 3.1 Safety Rule:**  
In `server/models/Student.js`, the schema options must explicitly specify:
```javascript
const studentSchema = new mongoose.Schema(
  { /* fields */ },
  {
    timestamps: true,
    autoIndex: false, // PREVENTS AUTOMATIC INDEX MUTATION ON SERVER BOOT
  }
);
```
This guarantees that server startup in development, test runners, or production will **never** alter existing indexes on the live `students` collection.

### 2.2 Independent Database Migration Specification (`user_1` Index)
The index migration is isolated into a standalone administrative script (`server/scripts/migrations/migrate_student_user_partial_index.js`) to be executed only after Phase 3.1 code verification:

1. **Pre-Migration Index Snapshot:** Captures all current index specifications from `db.collection('students').indexes()`.
2. **Validation of Existing Documents:**
   * Confirms that all existing documents with `user != null` have a valid BSON `ObjectId`.
   * Confirms that no duplicate `user` ObjectIds exist.
3. **Atomic Replacement:**
   ```javascript
   // 1. Drop existing non-partial unique index
   await collection.dropIndex('user_1');
   // 2. Build partial unique index
   await collection.createIndex(
     { user: 1 },
     {
       unique: true,
       partialFilterExpression: { user: { $type: 'objectId' } },
       name: 'user_1',
       background: true,
     }
   );
   ```
4. **Post-Migration Verification:**
   * Inserts two temporary test documents with `{ user: null }` to verify duplicate `null` acceptance.
   * Inserts duplicate `ObjectId` to verify strict uniqueness enforcement.
   * Cleans up test documents.
5. **Rollback Plan:**
   * If rollback is triggered, verifies that no documents have `user: null`. If offline students exist, migration aborts with an alert. If clear, drops the partial index and restores `{ unique: true, name: 'user_1' }`.

---

## 3. Final Model & Index Specifications

### 3.1 `Student.js` (Core Model Extension)

```javascript
/**
 * server/models/Student.js
 */
const studentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      default: null,
    },
    rollNumber: {
      type: String,
      required: [true, 'Roll number is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    branch: {
      type: String,
      trim: true,
      default: null, // NO DEFAULT
    },
    program: {
      type: String,
      trim: true,
      default: null, // NO DEFAULT
    },
    semester: {
      type: Number,
      min: 1,
      max: 10,
      default: null, // NO DEFAULT
    },
    section: {
      type: String,
      trim: true,
      default: null, // NO DEFAULT
    },
    admissionYear: {
      type: Number,
      default: null, // Derived from roll prefix (e.g. 2024), NO DEFAULT
    },
    school: {
      type: String,
      trim: true,
      default: null, // NO DEFAULT
    },
    admissionApplicationNumber: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    teamsId: {
      type: String,
      trim: true,
      default: null,
    },
    accountStatus: {
      type: String,
      enum: ['enrolled_offline', 'account_pending', 'active_user', 'graduated', 'withdrawn'],
      default: 'enrolled_offline',
      index: true,
    },
    // Pre-University Academic Details (Populated ONLY upon authorized promotion)
    academicDetails: {
      tenthPercentage: { type: Number, default: null },
      tenthBoard: { type: String, trim: true, default: null },
      twelfthPercentage: { type: Number, default: null },
      twelfthBoard: { type: String, trim: true, default: null },
      selfReportedCgpa: { type: Number, default: null },
      selfReportedActiveReappears: { type: Number, default: null },
      selfReportedDeadReappears: { type: Number, default: null },
      reappearSubjects: [{ type: String, trim: true }],
      promotedFromSubmissionId: { type: mongoose.Schema.Types.ObjectId, default: null },
      promotedAt: { type: Date, default: null },
      promotedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      promotionStatus: {
        type: String,
        enum: ['unpromoted', 'promoted', 'revised', 'withdrawn'],
        default: 'unpromoted',
      },
    },
    academicHistoryAudit: [
      {
        fieldPath: { type: String, required: true },
        oldValue: { type: mongoose.Schema.Types.Mixed },
        newValue: { type: mongoose.Schema.Types.Mixed },
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reason: { type: String },
      },
    ],
    sourceBatchId: {
      type: String,
      default: null,
      index: true,
    },
    importSourceRow: {
      type: Number,
      default: null,
    },
    hasUnresolvedConflicts: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    autoIndex: false, // SAFE FOR PHASE 3.1
  }
);

// Indexes
studentSchema.index(
  { user: 1 },
  { unique: true, partialFilterExpression: { user: { $type: 'objectId' } }, name: 'user_1' }
);
studentSchema.index({ rollNumber: 1 }, { unique: true });
studentSchema.index({ branch: 1, semester: 1, section: 1 });
studentSchema.index({ admissionApplicationNumber: 1 });
```

### 3.2 `StudentInternship.js` (Decoupled & Cleaned)

```javascript
/**
 * server/models/StudentInternship.js
 */
const studentInternshipSchema = new mongoose.Schema(
  {
    batchId: {
      type: String,
      required: true,
      index: true,
    },
    sourceRow: {
      type: Number,
      required: true,
    },
    normalizedRollNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    // OPTIONAL FOREIGN KEY: Allows preservation of unmatched/ambiguous records
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: false,
      default: null,
      index: true,
    },
    studentNameAsPerRS: { type: String, trim: true, default: null },
    branch: { type: String, trim: true, default: null },
    section: { type: String, trim: true, default: null },
    verticalMentor: { type: String, trim: true, default: null },
    officialId: { type: String, trim: true, default: null },
    organizationName: { type: String, required: true, trim: true },
    completeAddress: { type: String, trim: true, default: null },
    // NO SYNTHETIC DEFAULTS: Explicit nulls
    mode: {
      type: String,
      enum: ['Offline', 'Online', 'Hybrid', 'Unknown', null],
      default: null,
    },
    contactNumber: { type: String, trim: true, default: null },
    emailId: { type: String, trim: true, lowercase: true, default: null },
    startDate: { type: String, trim: true, default: null },
    internshipTitle: { type: String, trim: true, default: null },
    stipendProvided: { type: Boolean, default: null },
    monthlyStipendAmount: { type: Number, default: null },
    placementDone: { type: Boolean, default: null },
    offerLetterUrl: { type: String, trim: true, default: null },
    linkageStatus: {
      type: String,
      enum: ['unmatched', 'candidate_linked', 'confirmed_linked', 'flagged'],
      default: 'unmatched',
      index: true,
    },
  },
  { timestamps: true }
);

// STANDARDIZED BATCH IDEMPOTENCY INDEX
studentInternshipSchema.index({ batchId: 1, sourceRow: 1 }, { unique: true });
```

### 3.3 `StudentAcademicSubmission.js` (Privacy-Minimized)

```javascript
/**
 * server/models/StudentAcademicSubmission.js
 */
const studentAcademicSubmissionSchema = new mongoose.Schema(
  {
    batchId: {
      type: String,
      required: true,
      index: true,
    },
    sourceRow: {
      type: Number,
      required: true,
    },
    submissionTimestamp: {
      type: Date,
      default: null,
    },
    rawRollNumber: {
      type: String,
      required: true,
      trim: true,
    },
    normalizedRollNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
      index: true,
    },
    studentName: { type: String, trim: true, default: null },
    branch: { type: String, trim: true, default: null },
    tenthPercentage: { type: Number, default: null },
    tenthBoard: { type: String, trim: true, default: null },
    twelfthPercentage: { type: Number, default: null },
    twelfthBoard: { type: String, trim: true, default: null },
    selfReportedCgpa: { type: Number, default: null },
    selfReportedActiveReappears: { type: Number, default: null },
    selfReportedDeadReappears: { type: Number, default: null },
    reappearSubjects: [{ type: String, trim: true }],
    contactNumber: { type: String, trim: true, default: null },
    personalEmail: { type: String, trim: true, lowercase: true, default: null },
    collegeEmail: { type: String, trim: true, lowercase: true, default: null },
    // NO AUTOMATIC CANONICAL FLAG
    isCanonical: {
      type: Boolean,
      default: false,
    },
    reviewStatus: {
      type: String,
      enum: ['pending_review', 'approved_canonical', 'archived_historical', 'flagged_conflict'],
      default: 'pending_review',
      index: true,
    },
    // NOTE: ALL PARENTAL FIELDS (FATHER/MOTHER NAME, PHONE, EMAIL) ARE PERMANENTLY EXCLUDED
  },
  { timestamps: true }
);

// STANDARDIZED BATCH IDEMPOTENCY INDEX
studentAcademicSubmissionSchema.index({ batchId: 1, sourceRow: 1 }, { unique: true });
```

### 3.4 `AdmissionApplication.js`

```javascript
/**
 * server/models/AdmissionApplication.js
 */
const admissionApplicationSchema = new mongoose.Schema(
  {
    batchId: {
      type: String,
      required: true,
      index: true,
    },
    sourceRow: {
      type: Number,
      required: true,
    },
    applicationNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    studentName: {
      type: String,
      required: true,
      trim: true,
    },
    course: { type: String, trim: true, default: null },
    school: { type: String, trim: true, default: null },
    email: { type: String, trim: true, lowercase: true, default: null },
    teamsId: { type: String, trim: true, default: null },
    dateOfReporting: { type: String, trim: true, default: null },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
      index: true,
    },
    admissionStatus: {
      type: String,
      enum: ['applicant', 'enrolled', 'duplicate_flagged', 'withdrawn'],
      default: 'applicant',
      index: true,
    },
  },
  { timestamps: true }
);

// STANDARDIZED BATCH IDEMPOTENCY INDEX
admissionApplicationSchema.index({ batchId: 1, sourceRow: 1 }, { unique: true });
```

### 3.5 `StudentStaging.js`

```javascript
/**
 * server/models/StudentStaging.js
 */
const studentStagingSchema = new mongoose.Schema(
  {
    batchId: {
      type: String,
      required: true,
      index: true,
    },
    sourceSheet: {
      type: String,
      required: true,
      enum: ['Student Master', 'Admission Records', 'Internship Records', 'Academic Records'],
      index: true,
    },
    sourceRow: {
      type: Number,
      required: true,
    },
    rawIdentifier: { type: String, trim: true },
    normalizedRollNumber: { type: String, trim: true, uppercase: true, index: true },
    studentName: { type: String, trim: true },
    // Sanitized Verbatim Payload (Credentials and Parental Data Filtered at Parser)
    rawPayload: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      required: true,
    },
    conflictCandidates: [
      {
        field: { type: String, required: true },
        rawValue: { type: String, required: true },
        parsedCandidates: [{ type: String }],
        resolution: { type: String, default: null },
      },
    ],
    reviewStatus: {
      type: String,
      enum: ['pending_review', 'resolved', 'rejected', 'promoted'],
      default: 'pending_review',
      index: true,
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewNotes: { type: String, default: '' },
    promotedTargetId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

// STANDARDIZED BATCH IDEMPOTENCY INDEX
studentStagingSchema.index({ batchId: 1, sourceSheet: 1, sourceRow: 1 }, { unique: true });
```

---

## 4. Batch Idempotency Matrix

The table below defines the exact idempotency guarantees across all entities:

| Model | Idempotency Key (Unique Index) | Rerun Behavior (Same Workbook & Batch) | Rerun Behavior (New Batch ID) | Collision Risk Across Batches |
| :--- | :--- | :--- | :--- | :---: |
| **`StudentStaging`** | `{ batchId: 1, sourceSheet: 1, sourceRow: 1 }` | `bulkWrite` with `upsert: true` updates existing staging rows; 0 duplicates. | Inserts new isolated staging set under new `batchId`. | **ZERO** (scoped by `batchId` & `sourceSheet`) |
| **`AdmissionApplication`** | `{ batchId: 1, sourceRow: 1 }` | Updates application record in-place; 0 duplicate rows created. | Creates new batch applications; duplicate app numbers preserved per row. | **ZERO** (scoped by `batchId`) |
| **`StudentAcademicSubmission`** | `{ batchId: 1, sourceRow: 1 }` | Updates submission record in-place; 0 duplicate submissions created. | Retains historical audit sets across batches cleanly. | **ZERO** (scoped by `batchId`) |
| **`StudentInternship`** | `{ batchId: 1, sourceRow: 1 }` | Updates internship record in-place; preserves multiple internships per student. | Retains separate internship batch audits cleanly. | **ZERO** (scoped by `batchId`) |
| **`Student` (Core)** | `{ rollNumber: 1 }` | Promotion performs `$set` updates only on approved fields; roll number is unique. | Duplicate roll number throws `E11000` duplicate key; requires explicit update. | **ZERO** (global unique roll) |

---

## 5. Final Privacy-Minimized Schema & Access Governance

### 5.1 Permanent Parser-Boundary Redactions
The parser ingestion boundary strips and discards the following columns before constructing payloads:
* **Admission Passwords & Test Portal Credentials:** Discarded immediately. Never saved in memory or database.
* **Parental PII:** `Father's Name`, `Mother's name`, `Father's email ID`, `Mother's email ID` are dropped. They are **not** stored in `StudentStaging`, `StudentAcademicSubmission`, or `Student`.
* **Raw Cloud Storage / Marksheet URLs:** Marksheet Google Drive URLs are omitted from public student profiles.

### 5.2 Institutional Data Classification & RBAC Matrix

```
+──────────────────────────────────────────────────────────────────────────────────────────────────+
|                                  INSTITUTIONAL RBAC ACCESS MATRIX                                |
+───────────────────────+────────────────────────+────────────────────────+────────────────────────+
| Data Category         | Student (Self)         | Faculty (Assigned Class)| Admin / Registrar / Dean|
+───────────────────────+────────────────────────+────────────────────────+────────────────────────+
| Public Directory      | Full Access            | Full Access            | Full Access            |
| (Roll, Name, Section) |                        |                        |                        |
+───────────────────────+────────────────────────+────────────────────────+────────────────────────+
| Official Contact      | Full Access            | Full Access            | Full Access            |
| (College Email)       |                        |                        |                        |
+───────────────────────+────────────────────────+────────────────────────+────────────────────────+
| Restricted Contact    | Full Access            | Masked in UI           | Full Access            |
| (Phone, Personal Mail)|                        | (+91 98765*****)       |                        |
+───────────────────────+────────────────────────+────────────────────────+────────────────────────+
| Pre-University Scores | Full Access            | Hidden                 | Academic Counseling    |
| (10th/12th Marks)     |                        |                        | & Accreditation Only   |
+───────────────────────+────────────────────────+────────────────────────+────────────────────────+
| Evaluative Metrics    | Self (Released Marks)  | Section Grading Only   | Institution-wide Audit |
| (CGPA, Reappears)     |                        |                        |                        |
+───────────────────────+────────────────────────+────────────────────────+────────────────────────+
| Parental Details      | REDACTED AT PARSER     | REDACTED AT PARSER     | REDACTED AT PARSER     |
+───────────────────────+────────────────────────+────────────────────────+────────────────────────+
| Account Credentials   | REDACTED AT PARSER     | REDACTED AT PARSER     | REDACTED AT PARSER     |
+───────────────────────+────────────────────────+────────────────────────+────────────────────────+
```

---

## 6. Comprehensive Student Compatibility Inventory (33 Referencing Models)

All 33 referencing models in `server/models/` and their respective controllers/services were audited to guarantee zero breakage under the Phase 3.1 schema extension:

```
+───────────────────────────────────────────────────────────────────────────────────────────────────+
|                           INVENTORY OF ALL 33 REFERENCING MODELS IN ERP                           |
+───────────────────+───────────────────────+───────────────────────────────────────────────────────+
| Referencing Model | File Path             | Consumer Logic & Backward Compatibility Assessment    |
+───────────────────+───────────────────────+───────────────────────────────────────────────────────+
| 1. Attendance     | models/Attendance.js  | student: Ref Student. Attendance rosters query by     |
|                   |                       | { branch, semester, section }. Institutional students |
|                   |                       | are included immediately. Zero compatibility impact.  |
+───────────────────+───────────────────────+───────────────────────────────────────────────────────+
| 2. AttendAuditLog | models/Attendance...  | student: Ref Student. Direct audit log linkage. Safe. |
+───────────────────+───────────────────────+───────────────────────────────────────────────────────+
| 3. Mark           | models/Mark.js        | student: Ref Student. Exam scoring uses Student._id.  |
|                   |                       | Insulated from pre-uni survey scores. Safe.           |
+───────────────────+───────────────────────+───────────────────────────────────────────────────────+
| 4. PlacementProf  | models/Placement...   | student: Ref Student (unique). 1-to-1 profile created |
|                   |                       | on enrollment. Internships projected cleanly. Safe.   |
+───────────────────+───────────────────────+───────────────────────────────────────────────────────+
| 5. PlacementOffer | models/Placement...   | student: Ref Student. Tracks job offers. Safe.        |
+───────────────────+───────────────────────+───────────────────────────────────────────────────────+
| 6. PlacementApp   | models/Placement...   | student: Ref Student. Tracks drive applications. Safe.|
+───────────────────+───────────────────────+───────────────────────────────────────────────────────+
| 7. PlacementStage | models/Placement...   | student: Ref Student. Tracks selection rounds. Safe.  |
+───────────────────+───────────────────────+───────────────────────────────────────────────────────+
| 8. Fee            | models/Fee.js         | student: Ref Student. Student fee balances. Safe.     |
+───────────────────+───────────────────────+───────────────────────────────────────────────────────+
| 9. FeeInvoice     | models/FeeInvoice.js  | student: Ref Student. Invoices billed to Student._id. |
+───────────────────+───────────────────────+───────────────────────────────────────────────────────+
| 10. FeeAdjustment | models/FeeAdjust...   | student: Ref Student. Concessions & waivers. Safe.    |
+───────────────────+───────────────────────+───────────────────────────────────────────────────────+
| 11. PaymentTxn    | models/PaymentTxn.js  | student: Ref Student. Payment ledger tracking. Safe.  |
+───────────────────+───────────────────────+───────────────────────────────────────────────────────+
| 12. HostelAlloc   | models/HostelAlloc... | student: Ref Student. Hostel room assignments. Safe.  |
+───────────────────+───────────────────────+───────────────────────────────────────────────────────+
| 13. HostelApp     | models/HostelApp...   | student: Ref Student. Hostel applications. Safe.      |
+───────────────────+───────────────────────+───────────────────────────────────────────────────────+
| 14. HostelBed     | models/HostelBed.js   | student: Ref Student. Bed occupancy mapping. Safe.    |
+───────────────────+───────────────────────+───────────────────────────────────────────────────────+
| 15. HostelOccup   | models/HostelOccup... | student: Ref Student. Historical occupancy logs. Safe.|
+───────────────────+───────────────────────+───────────────────────────────────────────────────────+
| 16. HostelTransf  | models/HostelTrans... | student: Ref Student. Room transfer requests. Safe.   |
+───────────────────+───────────────────────+───────────────────────────────────────────────────────+
| 17. TransportAlloc| models/Transport...   | student: Ref Student. Bus route allocations. Safe.    |
+───────────────────+───────────────────────+───────────────────────────────────────────────────────+
| 18. TransportApp  | models/Transport...   | student: Ref Student. Bus service applications. Safe. |
+───────────────────+───────────────────────+───────────────────────────────────────────────────────+
| 19. LibraryLoan   | models/LibraryLoan.js | student: Ref Student. Book circulation records. Safe. |
+───────────────────+───────────────────────+───────────────────────────────────────────────────────+
| 20. BookReserv    | models/BookReserv...  | student: Ref Student. Book holds and reserves. Safe.  |
+───────────────────+───────────────────────+───────────────────────────────────────────────────────+
| 21. LibraryFine   | models/LibraryFine.js | student: Ref Student. Overdue fines tracking. Safe.   |
+───────────────────+───────────────────────+───────────────────────────────────────────────────────+
| 22. Submission    | models/Submission.js  | student: Ref Student. LMS assignment submissions. Safe|
+───────────────────+───────────────────────+───────────────────────────────────────────────────────+
| 23. CampusEvent   | models/CampusEvent.js | registeredStudents.student: Ref Student. Safe.        |
+───────────────────+───────────────────────+───────────────────────────────────────────────────────+
| 24. EventReg      | models/EventReg.js    | student: Ref Student. Event registrations. Safe.      |
+───────────────────+───────────────────────+───────────────────────────────────────────────────────+
| 25. EventAttend   | models/EventAttend.js | student: Ref Student. Event check-in tracking. Safe.  |
+───────────────────+───────────────────────+───────────────────────────────────────────────────────+
| 26. EventFeedback | models/EventFeed...   | student: Ref Student. Post-event surveys. Safe.       |
+───────────────────+───────────────────────+───────────────────────────────────────────────────────+
| 27. EventCert     | models/EventCert.js   | student: Ref Student. Issued event certificates. Safe.|
+───────────────────+───────────────────────+───────────────────────────────────────────────────────+
| 28. ConsentRecord | models/Consent...     | student: Ref Student. Digital policy consents. Safe.  |
+───────────────────+───────────────────────+───────────────────────────────────────────────────────+
| 29. FaceEmbedding | models/FaceEmbed...   | student: Ref Student. AI facial recognition vectors.  |
+───────────────────+───────────────────────+───────────────────────────────────────────────────────+
| 30. ClubMember    | models/ClubMember.js  | student: Ref Student. Student club memberships. Safe. |
+───────────────────+───────────────────────+───────────────────────────────────────────────────────+
| 31. StudentClub   | models/StudentClub.js | leaders & members: Ref Student. Safe.                 |
+───────────────────+───────────────────────+───────────────────────────────────────────────────────+
| 32. Notification  | models/Notification.js| recipient: User/Student polymorphic ID. Safe.         |
+───────────────────+───────────────────────+───────────────────────────────────────────────────────+
| 33. NotifPref     | models/NotifPref.js   | user / student reference. Safe.                       |
+───────────────────+───────────────────────+───────────────────────────────────────────────────────+
```

### 2.3 Required Defensive Coding Rule in Controllers
When controllers serialize student profiles or rosters, they must use defensive optional chaining:
```javascript
// DEFENSIVE SERIALIZATION PATTERN:
const studentEmail = student.user?.email || student.email || null;
const studentName  = student.user?.name || student.fullName;
```
This guarantees that offline institutional students (`user: null`) render cleanly without runtime `TypeError` exceptions.

---

## 7. Academic History Safeguards & Revision Mechanism

All 427 authentic submissions remain permanent, immutable audit records in `StudentAcademicSubmission`.

### 7.1 Multi-Submission Review & Revision Protocol
1. **Zero Auto-Promotion:** No survey values are promoted to `Student.academicDetails` automatically.
2. **Side-by-Side Review UI:** The registrar inspects all submissions for a student (e.g. 2 submissions for Rupesh Singh), reviewing differences in board percentages or self-reported CGPA.
3. **Atomic Field Promotion:** When an administrator approves a submission, values are written to `Student.academicDetails` along with:
   * `promotedFromSubmissionId`
   * `promotedAt`
   * `promotedBy`
4. **Revising or Withdrawing Promoted Values:**
   * If a student subsequently provides an updated official marksheet, the administrator selects "Revise Academic Details" or "Withdraw Values".
   * The action records an immutable entry in `Student.academicHistoryAudit`:
     ```javascript
     student.academicHistoryAudit.push({
       fieldPath: 'academicDetails.tenthPercentage',
       oldValue: 73.0,
       newValue: 74.5,
       changedAt: new Date(),
       changedBy: adminUserId,
       reason: 'Official verified CBSE marksheet submitted to registrar office',
     });
     ```
   * The original `StudentAcademicSubmission` documents remain completely untouched, preserving the exact history of what the student originally declared.

---

## 8. Surgical Rollback Architecture & Conflict Detection

Rollback must not indiscriminately wipe records using `deleteMany({ sourceBatchId })`. It executes field-level expected-value comparisons.

### 8.1 Rollback Execution Mechanics

```javascript
/**
 * Surgical Rollback Algorithm for Batch
 */
async function rollbackBatch(batchId, performedBy) {
  const changeLogs = await ImportFieldChangeLog.find({ batchId }).sort({ createdAt: -1 });

  for (const log of changeLogs) {
    const Model = mongoose.model(log.collectionName);
    const doc = await Model.findById(log.documentId);

    if (!doc) continue; // Already deleted or handled

    if (log.operation === 'INSERT') {
      // Check if document was referenced by subsequent live actions (e.g. attendance marked)
      const isReferenced = await checkDocumentReferences(log.collectionName, log.documentId);
      if (isReferenced) {
        throw new Error(`Rollback halted: ${log.collectionName} ${log.documentId} has active references.`);
      }
      await Model.findByIdAndDelete(log.documentId);
    } 
    else if (log.operation === 'UPDATE') {
      // SURGICAL FIELD-LEVEL CONFLICT CHECK
      const currentVal = lodash.get(doc, log.fieldPath);
      
      // If currentVal matches afterValue, field was untouched since import -> safe to revert!
      if (lodash.isEqual(currentVal, log.afterValue)) {
        lodash.set(doc, log.fieldPath, log.beforeValue);
        await doc.save();
      } else {
        // Genuine field-level conflict detected!
        await logConflict(batchId, log.documentId, log.fieldPath, currentVal, log.afterValue);
      }
    }
  }

  await ImportOperationLog.updateOne({ batchId }, { status: 'rolled_back' });
}
```

---

## 9. Remaining Institutional Approvals Prior to Phase 3.4 Promotion

The following four institutional governance policies must be signed off by the Academic Council or Dean of Student Affairs prior to Phase 3.4 live data promotion:

1. **Resolution of 543 Non-Branch Conflict Cells:**
   * Policy Decision: Designate official Admission records as authoritative for legal names and primary contact information; survey entries remain archived in `StudentAcademicSubmission`.
2. **Duplicate Admission Application Adjudication:**
   * Policy Decision: Keep duplicate application pairs (`MRIIRS24/22870`, `28752`, `37687`) flagged under `admissionStatus: 'duplicate_flagged'` until Admissions Office verification.
3. **Parental Contact Re-Inclusion Policy:**
   * Policy Decision: Reaffirm permanent exclusion of parental contact data from production schemas unless a formal welfare/emergency notification policy is authorized in writing.
4. **Student Portal Activation Workflow:**
   * Policy Decision: Adopt self-service student email verification links; reject bulk synthetic account provisioning.

---

## 10. Exact Implementation Sequence (Phase 3 Roadmap)

```
====================================================================================================
                                PHASE 3 IMPLEMENTATION ROADMAP
====================================================================================================

PHASE 3.1: Code-Only Models, Schemas, & Validators (Git Repository Only)
  ├── 1. Author server/models/StudentStaging.js
  ├── 2. Author server/models/AdmissionApplication.js (optional studentId, batchId idempotency)
  ├── 3. Author server/models/StudentAcademicSubmission.js (privacy-minimized, no parental PII)
  ├── 4. Author server/models/StudentInternship.js (optional studentId, explicit null defaults)
  ├── 5. Author server/models/ImportOperationLog.js & ImportFieldChangeLog.js
  ├── 6. Update server/models/Student.js (nullable user, autoIndex: false, no unverified defaults)
  └── 7. Run unit test suite in isolated MongoMemoryServer environment (ZERO live DB writes).

PHASE 3.2: Standalone MongoDB user_1 Partial Index Migration (Maintenance Window)
  ├── 1. Take pre-migration index snapshot.
  ├── 2. Validate all live students have valid user ObjectIds.
  ├── 3. Execute migrate_student_user_partial_index.js: drop user_1, build partialFilterExpression.
  └── 4. Verify duplicate null acceptance and unique ObjectId enforcement.

PHASE 3.3: Deterministic Staging Ingestion Pipeline (Dry-Run & Staging Tables)
  ├── 1. Implement parser with boundary privacy filters (strip passwords & parental data).
  ├── 2. Implement Table 2 column-shift auto-correction and divider row filters.
  ├── 3. Ingest 843 admissions, 559 internships, 427 submissions into staging with batchId.
  └── 4. Verify 100% staging record preservation without touching live students.

PHASE 3.4: Reconciliation UI & Reversible Production Promotion
  ├── 1. Expose read-only conflict review APIs and Admin side-by-side comparison UI.
  ├── 2. Promote confirmed student profiles with field-level change logging in ImportFieldChangeLog.
  ├── 3. Run full regression test suite (Backend 28/28 suites + Frontend production build).
  └── 4. Validate atomic rollback engine under simulated conflict conditions.
====================================================================================================
```

---

## Phase 2.4 Final Outcome

```
================================================================================
                    FINAL PHASE 2.4 ARCHITECTURAL DECISION
================================================================================

   STATUS: READY FOR PHASE 3.1 CODE-ONLY IMPLEMENTATION — AFTER EXPLICIT USER AUTHORIZATION

  - Student Master arithmetic contradictions resolved with mathematical proof.
  - Implementation divided into strict code-only vs database migration boundaries.
  - Mongoose autoIndex: false specified on Student to protect live indexes.
  - StudentInternship and StudentAcademicSubmission schemas finalized and decoupled.
  - Standardized batch idempotency keys { batchId, sourceRow } verified across all models.
  - Complete privacy minimization enforced: parental PII and credentials permanently excluded.
  - 33 referencing ERP models audited with 100% backward compatibility confirmed.
  - Surgical field-level rollback with conflict detection specified.
  - STRICT PROHIBITION: DO NOT START IMPLEMENTATION AUTOMATICALLY. Await user prompt.

================================================================================
```
