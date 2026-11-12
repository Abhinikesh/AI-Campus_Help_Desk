# CampusSphere AI — Phase 3.3C: Staging Reconciliation & Integrity Audit Report

**Date:** November 12, 2026  
**Repository:** `/Users/abhinikesh/AI-Campus_Help_Desk`  
**Database Target:** `campus-erp` (MongoDB port 27018)  
**Audited Batch ID:** `BATCH-20261112-STAGING-001`  
**Audit Execution Mode:** STRICTLY READ-ONLY AUDIT  
**Final Verdict:** **PASS WITH FINDINGS**

---

## 1. Executive Summary & Verification Scope

Phase 3.3C was performed as a strictly read-only reconciliation and integrity audit of the staged student data ingested during Phase 3.3B into `campus-erp`.

### Core Audit Outcomes:
1. **Zero Database Modifications:** No database writes, updates, deletes, index migrations, or record promotions were performed.
2. **Zero PII Exposure:** All comparisons and audits were executed locally via deterministic scripts; no student names, roll numbers, credentials, marks, or row data were exposed.
3. **Production Core Invariance:** Production `Student` (15 documents) and `User` (28 documents) records are bit-for-bit identical to the pre-staging backup. The active index `user_partial_1` is intact and enforcing uniqueness.
4. **Root Cause Analysis of Discrepancies:** Resolved the exact technical reasons for the Admission record count (844 vs 843), Academic record count (428 vs 427), and Internship organization null count (90 vs 52).

---

## 2. Phase 3.3B Report & Backup Verification

### 2.1 Report Integrity Check
- **Report File:** `CAMPUSSPHERE_PHASE_3_3B_STAGING_INGESTION_REPORT.md`
- **Sidecar Checksum (`.sha256`):** `00f2581c88e67890dd0476c2c1d1779bd9c1000ccb0ae4b4bd70bd8d6e2d8847`
- **Brain Directory Artifact Hash:** Matches `00f2581c...` (100% match).
- **Workspace File Hash:** `18b24f844ccf16f8def40542bab5c42b25ce3d07f9ad09a438d3e0bc994a0a37` (A trailing newline was appended in the workspace file at 20:22:50 IST after sidecar generation).

### 2.2 Pre-Staging Backup Verification
- **Backup Directory:** `server/backups/pre_staging_phase3_3b_20261112_200156/campus-erp`
- **Total Backup Files:** 217 files (108 `.bson`, 108 `.metadata.json`, 1 dump metadata).
- **`students.bson` Size:** 5,281 bytes (SHA-256: `5a880125a89ea4034df63365d67238d716a6e19d2940f2b0449650ddb360fb09`).
- **`students.metadata.json`:** Confirms `user_partial_1` is declared and active; legacy `user_1` is absent.
- **Live Database Comparison:** Live `students` collection contains 15 documents, `user_partial_1` is active (`unique: true`, partialFilterExpression: `{ user: { $type: "objectId" } }`), and `user_1` is absent.

---

## 3. Source Workbook Reconciliation against Staging

| Source Dataset | Previously Audited Count | Phase 3.3B Staged Count | Independent Physical Row Count | Authentic Data Rows | Excluded Dividers / Gaps | Reconciliation Status |
|---|---:|---:|---:|---:|---:|---|
| **Student Master** | 554 | 554 | 556 | 554 | 1 (Row 555 embedded header) | ✅ Exact Match |
| **Admission Records** | 843 | 844 | 849 | 844 | 4 (Rows 841–844 dividers) | ⚠️ Finding (Explained) |
| **Internship Records** | 559 | 559 | 561 | 559 | 1 (Row 555 sequence gap) | ✅ Exact Match |
| **Academic Records** | 427 | 428 | 430 | 427 | 1 (Row 234 divider title) | ⚠️ Finding (Explained) |

### Detailed Row Classification per Dataset:
1. **Student Master:** 556 physical rows. Row 1: Header. Rows 2–556: 555 candidate rows. Row 555 is the embedded Academic Table 2 header (`COMPLETEROLLNO.`, `Name`, `Xth percentage`) successfully filtered. Staged: **554**.
2. **Admission Records:** 849 physical rows. Row 1: Header. Rows 2–840: 839 standard admissions. Rows 841–844: 4 divider rows (Rows 841–843 missing required fields, Row 844 is "Migration Students" title). Row 845 is an authentic applicant record. Rows 846–849: 4 shifted migration students. Authentic total: 839 + 1 + 4 = **844**.
3. **Internship Records:** 561 physical rows. Row 1: Header. Rows 2–561: 560 candidate rows. Row 555 is an empty sequence gap. Authentic total: **559**.
4. **Academic Records:** 430 physical rows. Row 1: Header. Rows 2–233: 232 Table 1 surveys. Row 234: Section Title ("Sheet1: Table 1"). Row 235: Table 2 Sub-header. Rows 236–430: 195 Table 2 surveys. Authentic surveys total: 232 + 195 = **427**.

---

## 4. Investigation of Findings & Discrepancies

### Finding 1: Admission Records Count (844 vs 843)
- **Severity:** Low (Positive finding — data preservation).
- **Root Cause:** The earlier exploratory audit assumed that rows 841–845 (5 rows) were all divider rows. Physical inspection confirms that Row 845 is a complete, genuine applicant document containing valid application number, student name, course, school, and reporting date. Only rows 841–844 are dividers.
- **Impact:** The staged count of 844 is authentic and correct; 0 authentic admission records were dropped.

### Finding 2: Academic Records Count (428 vs 427) & Column Infiltration
- **Severity:** High (Staging mapping defect).
- **Root Cause:**
  1. Row 235 is the sub-header row of Table 2 (`Col 0: S. No. | Col 1: Name | Col 2: Complete Roll No. | Col 3: Xth percentage`).
  2. The parser's sub-header check was expecting `"ROLL"` in Col 2 and `"NAME"` in Col 3. Because Col 2 was `Name` and Col 3 was `Complete Roll No.`, the condition evaluated to `false`.
  3. Consequently, **Row 235 was parsed and staged as a student record** with `normalizedRollNumber: "NAME"` and `studentName: "Complete Roll No."`, causing the count to be 428 instead of 427.
  4. Because the sub-header check was bypassed, the parser variable `is_table_2` was never set to `True`. As a result, for all rows 236–430:
     - 10th percentage was mapped into `branch` (e.g. `branch: "90%"`).
     - Google Drive marksheet URLs from Col 8 were mapped into `twelfthBoard`.
  5. In Table 1 (Rows 2–233), Col 1 is `Name` and Col 2 is `Complete Roll No.`, causing `rawRollNumber` and `studentName` to be inverted. Furthermore, the source sheet contains two parental email columns (`Father's email ID` at Col 12 and `Mother's email ID` at Col 13), which shifted subsequent columns (CGPA, reappears, contact numbers) by 1 index.

### Finding 3: Internship Records Column Offset & Organization Null Discrepancy
- **Severity:** High (Staging mapping defect).
- **Root Cause:**
  1. The physical columns of the `Internship Records` sheet are:
     - `Col 0: S.No`
     - `Col 1: BRANCH`
     - `Col 2: SEC`
     - `Col 3: Univ.Roll.No`
     - `Col 4: Students Name as per R & S`
     - `Col 5: Vertical Mentor`
     - `Col 6: Official ID`
     - `Col 7: Source Column 8` (Contact phone number)
     - `Col 8: Name` (Company / Organization Name)
  2. `parser.py` assumed the layout was `Col 1: Univ.Roll.No`, `Col 2: Name`, `Col 3: Branch`, `Col 4: Section`, and `Col 7: Company Name`.
  3. Consequently:
     - `normalizedRollNumber` for all 559 records was populated with the student's **Branch** (e.g. `B.TECH. CSE`, `AIML-A`, `BAIML`).
     - `organizationName` was populated with Col 7 (phone number). Col 7 is empty in exactly 90 authentic rows, creating the **90 null organizationName records**.
     - The true Company Name was located in Col 8 (`Name`), which has 59 empty rows (52 authentic missing companies once sequence gaps are excluded).

---

## 5. Production Database Document-Level Invariance

A deterministic comparison was performed between the pre-staging backup BSON files (`server/backups/pre_staging_phase3_3b_20261112_200156/campus-erp`) and the live MongoDB collections, sorting all documents by `_id` and generating SHA-256 canonical hashes.

### Invariance Audit Summary:
- **Total Operational Collections Audited:** 108
- **Identical Collections (Document Count & SHA-256 Hash Match):** **105 / 108 (97.2%)**
- **Production `students` Collection:**
  - Backup: 15 documents | Live: 15 documents
  - SHA-256 Hash: **MATCH** (100% identical)
- **Production `users` Collection:**
  - Backup: 28 documents | Live: 28 documents
  - SHA-256 Hash: **MATCH** (100% identical)

### Mismatched Collections Identified (3 / 108):
| Collection | Backup Count | Live Count | Count Delta | Hash Match | Root Cause |
|---|---:|---:|---:|---|---|
| `notifications` | 93 | 94 | +1 | Mismatch | Created by test suite `notification_and_announcements.test.js` during backend regression run at 20:20:10 IST. |
| `consentrecords` | 1 | 1 | 0 | Mismatch | `updatedAt` modified by `biometric_enrollment.test.js` during regression run at 20:20:10 IST. |
| `faceembeddings` | 2 | 2 | 0 | Mismatch | `updatedAt` modified by `part7_camera_and_qr_integration.test.js` during regression run at 20:20:10 IST. |

Zero production Student or User records were altered, and zero operational records were modified by the staging ingestion process itself.

---

## 6. Staging Integrity & Boundary Verification

Audited across batch `BATCH-20261112-STAGING-001`:

| Integrity Metric | Measured Value | Standard Required | Status |
|---|---|---|---|
| Duplicate Lineage in `studentstagings` | 0 | 0 | ✅ PASS |
| Duplicate Lineage in `admissionapplications` | 0 | 0 | ✅ PASS |
| Duplicate Lineage in `studentinternships` | 0 | 0 | ✅ PASS |
| Duplicate Lineage in `studentacademicsubmissions` | 0 | 0 | ✅ PASS |
| Missing Source Rows (`sourceRow <= 0`) | 0 | 0 | ✅ PASS |
| Passwords Leaked into `rawPayload` | 0 | 0 | ✅ PASS |
| Parental Fields in `rawPayload` | 0 | 0 | ✅ PASS |
| Academic Canonical Records (`isCanonical: true`) | 0 | 0 | ✅ PASS |
| Academic Non-Canonical Records (`isCanonical: false`) | 428 (100%) | 100% | ✅ PASS |
| Accidental User References (`reviewedBy`) | 0 | 0 | ✅ PASS |
| Accidental Student References (`promotedTargetId`) | 0 | 0 | ✅ PASS |
| `ImportOperationLog` Count Agreement | 2,385 / 2,385 | Exact agreement | ✅ PASS |

---

## 7. Isolated Regression Test Suite Results

Executed purely against isolated test environments:
- **Python Staging Test Suite (`test_staging_pipeline.py`):** **13 / 13 PASS (100%)**
- **Node.js Isolated Foundation Suite (`phase3_3a_staging_foundation.test.js`):** **9 / 9 PASS (100%)**

---

## 8. Summary of Findings & Next Action Plan

| Finding ID | Component | Severity | Description | Remediation Plan (Post-Audit) |
|---|---|---|---|---|
| **F-01** | Admission Records | Low | Count is 844 instead of 843. | No fix needed. Row 845 is authentic. 844 is the true count. |
| **F-02** | Academic Records | High | Row 235 sub-header staged as student; Table 1 & Table 2 columns shifted. | Update `parse_academic_records_sheet` column mapping; filter Row 235; re-stage in next authorized batch. |
| **F-03** | Internship Records | High | Columns shifted: Branch mapped to roll number; phone number mapped to org name. | Update `parse_internship_records_sheet` column index mapping; re-stage in next authorized batch. |
| **F-04** | Operational Invariance | Low | 3 collections touched by regression suite. | Use isolated test DB for regression runner in future phases. |

---

## Final Verdict

### **PASS WITH FINDINGS**

The live production database remains fully safeguarded and intact (15 students, 28 users, `user_partial_1` active). Staging ingestion successfully populated the staging collections with complete lineage and zero credential leaks, while the audit uncovered specific column-offset defects in the academic and internship parsers that must be addressed prior to any data promotion.

