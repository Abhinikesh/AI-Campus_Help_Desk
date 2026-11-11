# CampusSphere AI — Phase 3.5: Timetable Staging Ingestion & Pre-Import Conflict Report

**Repository:** `/Users/abhinikesh/AI-Campus_Help_Desk`  
**Phase:** 3.5 — Timetable Staging Ingestion, Entity Reconciliation & Pre-Import Conflict Engine  
**Previous Phase:** Phase 3.4 (Schema & Model Implementation)  
**Approved Design Baseline:** Phase 3.3.1 (`/tmp/campussphere-timetable-phase3_3_1-design/`)  
**Parser Baseline:** Phase 3.2.3 (`/tmp/campussphere-timetable-staging-phase3_2_3/`)  
**Source Document:** `classWise-TT-21_OCT_2026.pdf`  
**Execution Mode:** Controlled Staging Ingestion & Conflict Engine Dry Run  
**Database Mutations:** STRICTLY CONFINED TO ISOLATED TEST/STAGING DB — ZERO DEV/PROD MUTATIONS  
**UI Convention:** Permanent Light Mode Only  
**Status:** COMPLETE & VERIFIED  

---

## 1. Executive Summary & Objective Status

Phase 3.5 has successfully executed the controlled, idempotent ingestion of all **977 extracted timetable entries** into an isolated staging environment using the Phase 3.4 `TimetableStaging` model.

Following ingestion, entity reconciliation baselines and the 10-tier pre-import conflict engine were executed. Crucially, the **ground-truth instructor `SJ` collision on Wednesday Period 8 across Room AS18 (5 CSE-B) and Room AS19 (5 CSE-C2)** was identified, preserved, and instantiated as an active publication blocker using the `ConflictRecord` model.

**Zero database mutations, migrations, seed scripts, or timetable imports were executed against the live development (`campus-erp`) or production database.** All operations and tests were strictly executed on an isolated MongoDB instance (`mongodb://127.0.0.1:27018/campus-erp-test-isolated`) guarded by automated safety checks.

---

## 2. Source and Staging Artifact Checksum Verification

### 2.1 Physical Source Document Verification
- **Source File Path:** `/Users/abhinikesh/.gemini/antigravity/brain/fa54af9b-a3ec-4155-b2de-927994afd217/.user_uploaded/media_1794370819803_238c020d.pdf`
- **Expected SHA-256:** `8e296e026a4f1eaad3ab3103154663d758050d9cfe8c8ee98111d11d324d4cf0`
- **Computed SHA-256:** `8e296e026a4f1eaad3ab3103154663d758050d9cfe8c8ee98111d11d324d4cf0`
- **Verification Status:** **100% MATCH (VERIFIED)**

### 2.2 Phase 3.2.3 Staging Directory Manifest Verification
All 7 files in `/tmp/campussphere-timetable-staging-phase3_2_3/` were verified against `checksums.sha256`:

| File Name | SHA-256 Checksum | Verification Status |
| :--- | :--- | :--- |
| `source_identity_reconciliation.json` | `31d6e6d20c7edcb38b501db8af085f6c1207e3fe0247bf43c37f758df046953a` | **OK** |
| `period_timing_reconciliation.json` | `07cc897f4fd3d3d6ba3907ff16e52c3673a84d4d6a0f5d49680f4046573f9cc3` | **OK** |
| `faculty_reconciliation_final.json` | `e9e54f26276b06f51e02bcfd6a328ce25127b0347e27724e65fd37ef7bf65588` | **OK** |
| `source_verification_assessment.json` | `d88a150d114e90f55c17dfe28c4b0fa731d4656e5b8668bad7d4ce4509bca71f` | **OK** |
| `conflict_evidence_reconciliation.json` | `1be705fce3ef5b6b5e0063550eea0254b6cb79751634de6da71faad9bd7b3d5d` | **OK** |
| `count_consistency_report.json` | `129f96c7f37b5dab998b244656468e565c757156357f9e99a5e5defbe96fc05c` | **OK** |
| `final_audit_report.md` | `d93aa9289b8066a38dc2091537db58650316ae0dc0c5ae02bf7a2f55d19b6078` | **OK** |

---

## 3. Extracted Entries Validation & Master Counts

Validation of the 977 entries in `/tmp/campussphere-timetable-staging-phase3_2_1/staging_timetable.json` confirmed 100% mathematical consistency with Phase 3.2.3:

| Metric | Verified Count | Target Consistency |
| :--- | :--- | :--- |
| **Total Extracted Entries** | **977** | Exact match |
| **Source PDF Pages** | **50** | Pages 1 to 50 |
| **Institutional Cohorts** | **50** | 1 cohort per page |
| **Single-Period Sessions (50 min)** | **760** | Exact match |
| **Double-Period Sessions (100 min)** | **217** | Exact match |
| **Total Occupied Period Slots** | **1,194** | $760 + (217 \times 2) = 1,194$ |
| **Source Subgroup Entries** | **226** | 130 lab + 24 elective + 72 language |
| **Distinct Subgroup Batches** | **33** | Documented in Section 7 |
| **Cohorts with Subgroups** | **19** | Documented in Section 7 |
| **Distinct Physical Rooms** | **47** | Plus 1 special venue (`NOT FIXED`) |
| **Faculty Abbreviations in Grid** | **113** | 110 deduplicated physical individuals |
| **Subject Abbreviations in Grid** | **116** | 106 unique course titles |
| **Corrupted / Incomplete Entries** | **0** | Zero missing page, day, or period |
| **Token-Split Cell Discrepancies** | **44** | Quarantined language track splits |

---

## 4. Controlled Staging Ingestion & Idempotency

### 4.1 Ingestion Specifications
- **Model Used:** [`server/models/TimetableStaging.js`](file:///Users/abhinikesh/AI-Campus_Help_Desk/server/models/TimetableStaging.js)
- **Import Batch ID:** `BATCH-2026-10-21-PHASE3_5-001`
- **Target Collection:** `timetablestagings` in `campus-erp-test-isolated`
- **Hash Generation Formula:**
  $$\text{SHA256}(\text{page} \mid \text{cohort} \mid \text{day} \mid \text{period} \mid \text{count} \mid \text{subj} \mid \text{insts} \mid \text{room} \mid \text{batch} \mid \text{cellText})$$
- **Total Unique Extraction Hashes:** **977 / 977 (100% unique, 0 collisions)**

### 4.2 Idempotency Verification
The ingestion engine was executed in two consecutive passes on the staging dataset:
- **Pass 1 (Fresh Ingest):**
  - Read: 977
  - Upserted: 977
  - Duplicates Prevented: 0
  - Total in Collection: 977
- **Pass 2 (Re-execution of identical batch):**
  - Read: 977
  - Upserted: 0
  - Duplicates Prevented: 977
  - Total in Collection: 977
- **Result:** **100% Idempotent. Re-running the batch creates zero duplicate records.**

---

## 5. Faculty Reconciliation Results

In strict adherence to the locked Phase 3.3.1 design:
- **Zero synthetic User accounts or ObjectIds were created.**
- Abbreviations without ERP matches remain unprovisioned.

### 5.1 Reconciliation Breakdown
- **Total Faculty Abbreviations:** 113
- **Deduplicated Physical Individuals:** 110
- **Verified ERP Faculty (18):**
  1. `MS` $\rightarrow$ `FAC002` (MEETA SINGH)
  2. `PN` $\rightarrow$ `FAC003` (POONAM NANDAL)
  3. `SH` $\rightarrow$ `FAC004` (SWATI HANS)
  4. `GS` $\rightarrow$ `FAC005` (GINNI SEHGAL)
  5. `AP` $\rightarrow$ `FAC006` (AMAN PRASAD)
  6. `AC` $\rightarrow$ `FAC007` (AVISHEK CHOUDHURI)
  7. `MEGH` $\rightarrow$ `FAC008` (MEGHA MAKAN - FRENCH)
  8. `AG` $\rightarrow$ `FAC009` (ARUSHI GUPTA)
  9. `NID` $\rightarrow$ `FAC010` (NIDHI .)
  10. `ANM` $\rightarrow$ `FAC011` (ANISHA MAHTO)
  11. `RM` $\rightarrow$ `FAC012` (ROSY MADAAN)
  12. `TD` $\rightarrow$ `FAC013` (TANU DUA)
  13. `RB` $\rightarrow$ `FAC014` (RACHNA BEHL)
  14. `ROB` $\rightarrow$ `FAC015` (ROHIT BATHLA)
  15. `PB` $\rightarrow$ `FAC016` (PRITY BHARDWAJ)
  16. `TARA` $\rightarrow$ `FAC017` (TARA - GERMAN)
  17. `VIP` $\rightarrow$ `FAC018` (VIPIN - CDC)
  18. `SHV` $\rightarrow$ `FAC019` (SHIVANGEE - CDC)
- **Confirmed Legend Aliases (3):**
  - `OB` $\rightarrow$ Canonical `ROB` (`FAC015`, ROHIT BATHLA)
  - `KC` $\rightarrow$ Canonical `RKC` (RAVINDER KUMAR CHAHAR)
  - `CH` $\rightarrow$ Canonical `RCH` (RACHNA - SPANISH)
- **Unmatched Physical Faculty (92):** Retained verbatim abbreviations in `unresolvedFacultyAbbreviations`.
- **Identity Isolation:** `PRA`, `PREMA`, and `PRIYA` are verified as distinct individuals and not merged with `FAC001` or each other.
- **Instructor `SJ` Status:** `SJ` is printed in PDF legend as `SRISHTY JINDAL`, has no account in MongoDB `users`, and remains classified as `UNMATCHED`.

---

## 6. Subject Reconciliation Results

- **Total Subject Abbreviations:** 116
- **Unique Institutional Course Titles:** 106
- **Verified ERP Subjects (14):**
  1. `DAA` $\rightarrow$ `CS501` (Design Analysis of Algorithms)
  2. `FLAT` $\rightarrow$ `CS502` (Formal Languages Automata Theory)
  3. `AICA` $\rightarrow$ `CS503` (Artificial Intelligence Concepts and its Applications)
  4. `CG` $\rightarrow$ `CS504` (Computer Graphics)
  5. `SDP` $\rightarrow$ `CS505` (Software Development Processes)
  6. `DTI-III` $\rightarrow$ `CS506` (Design Thinking and Innovation - III)
  7. `ES` $\rightarrow$ `CS507` (Entrepreneurship and Startups)
  8. `DAA Lab` $\rightarrow$ `CS508L` (Design Analysis of Algorithms Lab)
  9. `AICA LAB` $\rightarrow$ `CS509L` (Artificial Intelligence Concepts and its Applications Lab)
  10. `CG Lab` $\rightarrow$ `CS510L` (Computer Graphics Lab)
  11. `SDP Lab` $\rightarrow$ `CS511L` (Software Development Processes Lab)
  12. `5QA-APT` $\rightarrow$ `CS512` (QA Aptitude)
  13. `5QA-Tech` $\rightarrow$ `CS513` (QA Technical)
  14. `5QA-VERB` $\rightarrow$ `CS514` (QA Verbal)
- **Ambiguous Subjects (2):**
  - `DSA` & `DSA Lab`: Curricular semester disparity (Semester 3 in PDF vs Semester 4 / CS201 in ERP catalog). Cannot be equated without institutional approval. Staged with `matchingStatus: 'AMBIGUOUS'`.
- **Unmatched Subject Abbreviations (100):** Stored with `subject: null`, `subjectAcronym`, and `isSubjectResolved: false`. Zero synthetic Subject ObjectIds created.

---

## 7. Cohort and Subgroup Validation

The 226 subgroup entries represent 94 parallel laboratory and elective sessions across 19 cohorts and 33 distinct batch identifiers:

### 7.1 Inventory of 33 Distinct Subgroup Batches
```
3AIML-A1, 3AIML-A2, 3AIML-B1, 3AIML-B2, 3CSE-A1, 3CSE-A2, 3CSE-B1, 3CSE-B2, 
3CSE-C1, 3CSE-C2, 5AIML-A1, 5AIML-A2, 5AIML-B1, 5AIML-B2, 5BAIML-C1, 5BAIML-C2, 
5CSA1, 5CSA2, 5CSB1, 5CSB2, 5CSE-C1, 5CSE-C2, 5CSE-D1, 5CSE-D2, 5CSE-E1, 5CSE-E2, 
C1, C2, FR1, GR1, Group 1, Group 2, S1
```

### 7.2 Cohorts with Subgroups (19 Cohorts)
| # | Cohort Label | Page | Subgroup Batches Scheduled |
| :--- | :--- | :--- | :--- |
| 1 | `3 CSE-A` | Page 1 | `3CSE-A1`, `3CSE-A2`, `Group 1`, `Group 2` |
| 2 | `3 CSE-B` | Page 2 | `3CSE-B1`, `3CSE-B2`, `Group 1`, `Group 2` |
| 3 | `3 CSE-C` | Page 3 | `3CSE-C1`, `3CSE-C2`, `Group 1`, `Group 2` |
| 4 | `3 AIML-A` | Page 4 | `3AIML-A1`, `3AIML-A2` |
| 5 | `3 AIML-B` | Page 5 | `3AIML-B1`, `3AIML-B2` |
| 6 | `3 BAIML-C`| Page 6 | `C1`, `C2` |
| 7 | `5 CSE-A` | Page 11 | `5CSA1`, `5CSA2`, `FR1`, `GR1`, `S1` |
| 8 | `5 CSE-B` | Page 12 | `5CSB1`, `5CSB2`, `FR1`, `GR1`, `S1` |
| 9 | `5 CSE-C` | Page 13 | `5CSE-C1`, `5CSE-C2`, `FR1`, `GR1`, `S1` |
| 10 | `5 CSE-D` | Page 14 | `5CSE-D1`, `5CSE-D2`, `FR1`, `GR1`, `S1` |
| 11 | `5 CSE-E` | Page 15 | `5CSE-E1`, `5CSE-E2`, `FR1`, `GR1`, `S1` |
| 12 | `5 AIML-A` | Page 16 | `5AIML-A1`, `5AIML-A2`, `FR1`, `GR1`, `S1` |
| 13 | `5 AIML-B` | Page 17 | `5AIML-B1`, `5AIML-B2`, `FR1`, `GR1`, `S1` |
| 14 | `5 BAIML-C`| Page 18 | `5BAIML-C1`, `5BAIML-C2`, `FR1`, `GR1`, `S1` |
| 15 | `5 DFCS` | Page 19 | `FR1`, `GR1`, `S1` |
| 16 | `5 DS` | Page 20 | `FR1`, `GR1`, `S1` |
| 17 | `5 CC` | Page 21 | `FR1`, `GR1`, `S1` |
| 18 | `5 GT` | Page 22 | `FR1`, `GR1`, `S1` |
| 19 | `1 M.TECH` | Page 49 | `Group 1`, `Group 2` |

---

## 8. Conflict Engine Classification & Evidentiary Gate

The conflict engine evaluated all 977 staged entries against the 10-tier specification.

### 8.1 Room Overlaps & Joint-Session Verification Gate
- **Total Room Overlapping Slots:** 107
- **Evidentiary Joint-Session Exemptions (`IDENTICAL_TRIPLET_MATCH`):** **100 slots**
  - All participating entries share identical physical room, identical subject acronym, and identical instructor abbreviations at the identical day & period.
- **Non-Exclusive Venue Policy Exemptions:** **2 slots** (`NOT FIXED` outdoor sports/yoga)
- **Unverified Room Collisions:** **5 slots**
  - Language track elective slots on Pages 16–22 in `AG-25`, `AG-22`, `AF14`, and `AF15` where parser token splits caused subject acronym mismatches (e.g. `'G'` vs `''` or `'S G'` vs `'G S'`).
  - In strict compliance with Step 6, because these lack an identical triplet match and lack written administrative confirmation, **they are not automatically approved and remain flagged as conflicts**.

### 8.2 Faculty Overlaps & True Collisions
- **Total Faculty Overlapping Slots:** 129
- **Verified Joint Session Exemptions:** **124 slots** (Same teacher in same room with same subject across combined sections)
- **Faculty Collisions / Discrepancies:** **5 slots**
  - 1 ground-truth scheduling conflict: **Instructor `SJ` on Wednesday Period 8**
  - 4 token-split discrepancies where language teachers were mapped across mismatched cell tokens in `AG-25`, `AG-22`, `AF14`.

---

## 9. Ground-Truth Instructor `SJ` Conflict & Active Blocker Status

Reconciliation confirms an authentic, institutional scheduling collision in the source PDF:

```
+----------------------------------------------------------------------------------------------------+
|                                    INSTRUCTOR SJ COLLISION                                         |
+----------------------------------------------------------------------------------------------------+
| Day & Period:    Wednesday, Period 8 (14:00 – 14:50)                                               |
| Instructor:      SJ (printed in PDF legend as SRISHTY JINDAL; unprovisioned in MongoDB)             |
|                                                                                                    |
| Assignment 1:    Page 12 | Cohort: 5 CSE-B        | Subject: AICA | Room: AS18 | Cell: AICA AS18 SJ|
| Assignment 2:    Page 13 | Cohort: 5 CSE-C (C2)   | Subject: FLAT | Room: AS19 | Cell: FLAT AS19 SJ|
|                                                                                                    |
| Nature:          Simultaneous assignment of a single physical teacher to two different rooms       |
|                  teaching two completely different subjects.                                       |
| Classification:  POTENTIAL_FACULTY_CONFLICT -> SEVERITY: BLOCKER                                   |
| Resolution:      OPEN (Unresolved publication blocker in isolated staging database)                 |
+----------------------------------------------------------------------------------------------------+
```

### Blocker Persistence
The conflict was instantiated in the isolated staging database via `ConflictRecord`:
```javascript
{
  conflictCode: 'POTENTIAL_FACULTY_CONFLICT',
  severity: 'BLOCKER',
  academicYear: '2026-2027',
  dayOfWeek: 'Wednesday',
  periodNumbers: [8],
  resourceType: 'FACULTY',
  resourceId: 'SJ',
  resolutionStatus: 'OPEN',
  isPublicationBlocker: true
}
```
**Publication Gatekeeper:** Any attempt to publish the 2026-2027 timetable is strictly blocked until an authorized institutional resolution is recorded.

---

## 10. Smart Attendance Readiness Assessment

Evaluating all 977 staged entries against the Dual-Layer Attendance Gate yielded:

| Readiness Tier | Count | Percentage | Operational Meaning |
| :--- | :--- | :--- | :--- |
| **READY** | **49** | 5.0% | Both faculty and subject verified in ERP catalog; valid periods; zero conflicts. Eligible for attendance generation upon import. |
| **REQUIRES_REVIEW** | **47** | 4.8% | Ambiguous subjects (`DSA` / `DSA Lab`). Blocked from attendance until semester mapping is approved. |
| **BLOCKED** | **2** | 0.2% | Entries involved in the `SJ` Wednesday Period 8 collision (Page 12 and Page 13). Strictly blocked. |
| **NOT_CONFIGURED** | **879** | 90.0% | Unmatched faculty (92) or unmatched subject (100). Blocked from attendance creation by model/controller gates. |
| **Total Evaluated** | **977** | **100.0%** | **Zero attendance sessions created; existing attendance intact.** |

---

## 11. Student Roster Boundary

Personalized timetable delivery for students requires verified institutional roster data:
1. **50 Cohorts Audited**: Students can only receive cohort-wide whole-class sessions based on their verified academic branch, semester, and section.
2. **19 Cohorts with Subgroups (33 Batches)**: The 226 laboratory, tutorial, and language elective entries cannot be assigned to individual students until lab section rosters (e.g. `5CSA1` vs `5CSA2`) and language elective choices (`FR1`, `GR1`, `S1`) are uploaded and approved.
3. **Safety Guarantee**: In this phase, **zero student documents were created, modified, or assigned to batches**.

---

## 12. Database Safety & Isolation Evidence

- **Database Used:** `mongodb://127.0.0.1:27018/campus-erp-test-isolated`
- **Application Database (`campus-erp`):** **Zero documents created, updated, or deleted.**
- **Live `Timetable` Collection:** **Zero entries imported or published.**
- **Live `Users` & `Subjects` Collections:** **Zero accounts provisioned.**
- **Isolated Safety Harness:** The `assertIsolatedDatabase()` guard actively verifies every connection string and rejects any connection targeting `campus-erp`, `production`, `prod`, `development`, or `admin`.

---

## 13. Test Results & Regression Verification

### 13.1 Phase 3.5 Targeted Test Suite (`server/tests/phase3_5_staging_and_conflict.test.js`)
All 26 test assertions passed on the isolated test database:

| # | Test Area | Status | Execution Time |
| :--- | :--- | :--- | :--- |
| 1 | Source PDF checksum strictly matches authentic hash | **PASS** | 0.71 ms |
| 2 | Phase 3.2.3 staging directory manifest verifies all 7 audit files | **PASS** | 2.40 ms |
| 3 | Artifact verification rejects tampered or mismatched source checksum | **PASS** | 0.23 ms |
| 4 | Extracted entries validation verifies all master institutional counts | **PASS** | 2.43 ms |
| 5 | Extraction hash is deterministic and collision-free (977 unique hashes) | **PASS** | 1.19 ms |
| 6 | Staging database safety guard blocks dev/prod database URIs | **PASS** | 0.12 ms |
| 7 | Controlled staging ingestion inserts all 977 entries into TimetableStaging | **PASS** | 460.14 ms |
| 8 | Staging ingestion is strictly idempotent (re-run creates 0 duplicates) | **PASS** | 371.90 ms |
| 9 | Faculty reconciliation conforms to approved 18 verified + 92 unmatched + 3 aliases | **PASS** | 0.13 ms |
| 10 | PRA, PREMA, and PRIYA remain distinct from FAC001 with zero improper merging | **PASS** | 0.05 ms |
| 11 | Instructor SJ remains associated with source legend name and unprovisioned | **PASS** | 0.03 ms |
| 12 | Subject reconciliation conforms to 14 verified, 2 ambiguous, 100 unmatched | **PASS** | 0.04 ms |
| 13 | DSA and DSA Lab are preserved as ambiguous without mapping to CS201 | **PASS** | 0.10 ms |
| 14 | Conflict engine separates room overlaps into triplets, venue exempt, and collisions | **PASS** | 61.45 ms |
| 15 | Overlap alone is rejected; unverified room overlaps are flagged as blockers | **PASS** | 66.34 ms |
| 16 | Conflict engine separates faculty overlaps into joint sessions and collisions | **PASS** | 49.80 ms |
| 17 | SJ Wednesday Period 8 collision across AS18 and AS19 is accurately detected | **PASS** | 57.67 ms |
| 18 | SJ blocker is persisted in staging DB as an active publication blocker | **PASS** | 3.23 ms |
| 19 | Attendance readiness classifies all 977 entries across 4 canonical tiers | **PASS** | 44.50 ms |
| 20 | AttendanceSession pre-save hook blocks unmapped staged entries | **PASS** | 5.12 ms |
| 21 | Valid resolved timetable entry successfully creates AttendanceSession | **PASS** | 8.82 ms |
| 22 | Student roster boundary accounts for 50 cohorts, 33 subgroup batches, and 0 student mutations | **PASS** | 53.57 ms |
| 23 | Confirms zero live timetable entries imported and zero dev/prod mutations | **PASS** | 2.21 ms |
| 24 | Setup & Test DB Fixture Initialization | **PASS** | 32.65 ms |
| 25 | Teardown & Clean Disconnect | **PASS** | 8.46 ms |

**Targeted Suite Summary:** 26 / 26 passed (100%), 0 failed. Total Duration: 1.24s. Exit code: 0.

### 13.2 Full Backend Regression Suite (`server/run_backend_tests.mjs`)
Executed across all 27 backend test suites:
- **Suites Executed:** **27 / 27 passed (100%)**
- **Total Tests Executed:** **707 / 707 passed (0 failed)**
- **Total Execution Time:** 15.02s
- **Exit Code:** 0

---

## 14. Remaining Institutional Decisions & Recommendations

Before any draft or published timetable can be imported into the live ERP collection, three administrative decisions are required:

1. **Resolution of Instructor `SJ` Wednesday Period 8 Collision**:
   - Institutional authority must decide whether `AICA` in `AS18` or `FLAT` in `AS19` is reassigned to another teacher, or whether a split-duty co-teacher will take one of the sections.
2. **Curricular Resolution of `DSA` and `DSA Lab`**:
   - Determine whether Semester 3 `DSA` maps to existing course `CS201` or requires a distinct course code in the catalog.
3. **Faculty & Subject Provisioning**:
   - Provision ERP accounts for the 92 unmapped physical faculty and catalog records for the 100 unmapped subjects so that their classes can become attendance-ready (`READY`).

---

**Sign-off:** Phase 3.5 execution is complete. All 977 entries staged in isolation, conflict engine operational, `SJ` blocker active, zero live database mutations. Awaiting explicit user instruction before proceeding to Phase 3.6.

