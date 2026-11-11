# CampusSphere AI — Phase 3.3 Master Timetable Architecture & Schema Design Report (Phase 3.3.1 Corrected & Locked)

**Project:** CampusSphere AI — Enterprise Smart Campus Management Platform  
**Repository:** `/Users/abhinikesh/AI-Campus_Help_Desk`  
**Phase:** 3.3.1 (Targeted Architecture Design Corrections)  
**Status:** `DESIGN_COMPLETE_WITH_DOCUMENTED_CONDITIONS`  
**Source Document:** `classWise-TT-21_OCT_2026.pdf` (Uploaded as `media_1794370819803_238c020d.pdf`)  
**Authentic Checksum:** `SHA-256: 8e296e026a4f1eaad3ab3103154663d758050d9cfe8c8ee98111d11d324d4cf0`  
**Design Directory:** `/tmp/campussphere-timetable-phase3_3-design/`  
**Database Mutation Status:** Zero Writes / Strictly Enforced Read-Only  
**Production Code Mutation Status:** Zero Modifications / Pure Architecture Specification  
**UI Theme Convention:** Permanent Light Mode  

---

## 1. Executive Summary & Design Status Classification

### Final Status: `DESIGN_COMPLETE_WITH_DOCUMENTED_CONDITIONS`

Phase 3.3 and Phase 3.3.1 have successfully developed and locked the canonical timetable architecture for CampusSphere AI ERP. The architecture bridges the fundamental gap between the legacy single-room, single-teacher ERP model and the operational reality of the university’s 50-page institutional timetable.

### Ground-Truth Reconciled Metrics:
- **50 Institutional Cohorts** across 6 degree tiers (B.Tech Core, Specializations AIML/DS/DFCS/GT, Integrated BAIML, BCA, MCA, MBA, M.Tech).
- **977 Extracted Timetable Sessions** expanded across **1,194 Occupied Period-Slots** via a strict mathematical schedule ($760 \times 1 + 217 \times 2$).
- **113 Faculty Abbreviations** representing **110 Physical Individuals** (18 verified active MongoDB faculty, 92 safely unprovisioned, and 3 confirmed legend aliases).
- **116 Subject Abbreviations (106 Course Titles):** Exactly **14 verified ERP subjects** (`CS501`–`CS514`), **2 ambiguous subjects** (`DSA` and `DSA Lab`), and **100 unmatched subjects**.
- **226 Source Subgroup Entries** (130 lab practical, 24 generic elective, 72 language elective) across **33 distinct batches** and **94 parallel time slots**. (The previously reported count of "173" is documented as an erroneous subset count).
- **105 Room Overlaps & 127 Faculty Overlaps** recognized as legitimate cross-cohort joint lectures via evidentiary clustering (`jointSessionEvidence`).
- **1 Authentic Faculty Collision:** Instructor abbreviation **`SJ`** (printed in PDF legend as **`SRISHTY JINDAL`**, unprovisioned in MongoDB) on **Wednesday Period 8 (14:00–14:50)** between **Room AS18 (Page 12, 5 CSE-B)** and **Room AS19 (Page 13, 5 CSE-C2)**, established as a strict, publication-blocking gatekeeper.
- **Canonical `scopeKey` Version Uniqueness:** Required deterministic string `academicYear:program:departmentCode:branch:specialization:semester:section` with unique index `{ scopeKey: 1, versionNumber: 1 }`, eliminating MongoDB null-indexing collisions.
- **100% Backward Compatibility:** Safeguarding downstream consumers like `AttendanceSession` via nullable foreign keys and scalar primary instructor synchronization.

---

## 2. Institutional Timetable Ground Truth & Mathematical Invariants

### 2.1 Authentic Source Identification
- **Source File:** `classWise-TT-21_OCT_2026.pdf` (Artifact: `media_1794370819803_238c020d.pdf`).
- **Verified SHA-256 Checksum:** `8e296e026a4f1eaad3ab3103154663d758050d9cfe8c8ee98111d11d324d4cf0`.
- **Pages / Cohorts:** Exactly 50 pages, exactly 50 distinct cohorts.

### 2.2 Canonical Bell Schedule & Period Spans
All 50 pages operate under a unified 10-period daily bell schedule from **08:10 to 16:30** (50 minutes per period) with zero gaps:

| Period | Start Time | End Time | Duration | Session Types |
| :---: | :---: | :---: | :---: | :--- |
| **P1** | 08:10 | 09:00 | 50 min | Single Lecture |
| **P2** | 09:00 | 09:50 | 50 min | Single Lecture / Double Block Start |
| **P3** | 09:50 | 10:40 | 50 min | Single Lecture / Double Block End |
| **P4** | 10:40 | 11:30 | 50 min | Single Lecture / Double Block Start |
| **P5** | 11:30 | 12:20 | 50 min | Single Lecture / Double Block End |
| **P6** | 12:20 | 13:10 | 50 min | Single Lecture / Double Block Start |
| **P7** | 13:10 | 14:00 | 50 min | Single Lecture / Double Block End |
| **P8** | 14:00 | 14:50 | 50 min | Single Lecture / Double Block Start |
| **P9** | 14:50 | 15:40 | 50 min | Single Lecture / Double Block End |
| **P10**| 15:40 | 16:30 | 50 min | Single Lecture |

### 2.3 Mathematical Period-Slot Proof
- **Single-Period Sessions (50 min):** Exactly 760 entries ($760 \times 1 = 760$ period-slots).
- **Double-Period Sessions (100 min):** Exactly 217 entries ($217 \times 2 = 434$ period-slots).
- **Total Occupied Period-Slots:**
  $$760 + 434 = 1,194 \text{ period-slots across all 50 cohorts.}$$

---

## 3. Reconciliation Architecture: Faculty & Curriculum Identity

### 3.1 Faculty Identity Reconciliation
- **18 Verified Faculty:** Verified accounts in MongoDB `users` (`FAC002` through `FAC019`), linked via `instructors: [ObjectId]` and `faculty: ObjectId`.
- **92 Unprovisioned Faculty:** Preserved safely without inserting synthetic user records. Stored in `instructorAbbreviations: [String]` with `faculty: null` and `isFacultyResolved: false`.
- **3 Confirmed Legend Aliases:** `OB` $\rightarrow$ `ROB`, `KC` $\rightarrow$ `RKC`, `CH` $\rightarrow$ `RCH` (all appear in 0 grid cells).
- **Strict Disambiguation:** `PRA` (`PRATIMA MEHTA`), `PREMA` (`PREMA (CDC)`), and `PRIYA` (`PRIYA (CDC)`) are distinct individuals from `Dr. Priya Mehta` (`FAC001`). All three are strictly classified as `UNMATCHED_FACULTY`. Exactly 0 unauthorized ObjectIds assigned.
- **Instructor `SJ`:** Abbreviation `SJ`, PDF legend name `SRISHTY JINDAL` (status: `UNMATCHED`, no MongoDB account). Involved in the publication-blocking Wednesday Period 8 collision across Page 12 and Page 13.

### 3.2 Curriculum Subject Reconciliation
- **14 Verified Subjects:** Exactly matched to official Semester 5 CSE curriculum subjects in MongoDB (`CS501` through `CS514`).
- **2 Ambiguous Subjects (`DSA` and `DSA Lab`):** In MongoDB, `CS201` is designated as Semester 4. In the institutional timetable, `DSA` and `DSA Lab` are scheduled for Semester 3 cohorts (`3 CSE`, `3 AIML`, `3 DS`). Curricular semester disparity requires academic syllabus confirmation before mapping; stored with `subject: null`.
- **100 Unmatched Subjects:** Stored with `subject: null` and `subjectAcronym: [acronym]`.
- **Attendance Safety Invariant:** Downstream `AttendanceSession` creation enforces that both `faculty` and `subject` must be non-null. Sessions with unmapped resources cannot generate attendance roll calls until administrative reconciliation is completed.

---

## 4. Subgroup & Cohort Architecture

### 4.1 Subgroup Normalization (226 Source Entries)
- Exactly **226 source subgroup entries** (130 lab practical entries, 24 generic elective entries, 72 language elective entries) across **33 distinct batches** and **94 parallel slots**.
- The previously reported count of "173" was an erroneous subset count (omitting 53 language-track elective entries).
- Normalized into canonical `batch` string (`'FR1'`, `'GR1'`, `'S1'`, `'GROUP 1'`, `'3CSE-A1'`, etc.) while preserving raw text in `sourceGroupLabel`.
- **Zero Student Roster Fabrication:** Student records in MongoDB are NOT modified. If a student is unassigned to a batch, the frontend UI renders parallel labs with clear visual subgroup badges in permanent light mode.

### 4.2 Cohort Taxonomy & Canonical `scopeKey`
- Replaced fragile multi-field compound unique index with canonical `scopeKey`:
  $$\text{scopeKey} = \text{academicYear} + \text{":"} + \text{program} + \text{":"} + \text{departmentCode} + \text{":"} + \text{branch} + \text{":"} + \text{specialization} + \text{":"} + \text{semester} + \text{":"} + \text{section}$$
- Unique Index: `{ scopeKey: 1, versionNumber: 1 }` (unique: true).
- 100% immune to MongoDB null/missing-field compound index collisions.

---

## 5. Conflict Engine & Publication Gatekeeping

### 5.1 10-Tier Conflict Detection Engine
1. **Tier 1 (Faculty Double-Booking):** Multi-room instructor collision $\implies$ `BLOCKER`.
2. **Tier 2 (Room Double-Booking):** Non-whitelisted room collision $\implies$ `BLOCKER`.
3. **Tier 3 (Cohort Whole-Class Double-Booking):** Duplicate whole-class booking $\implies$ `BLOCKER`.
4. **Tier 4 (Subgroup Incompatible Overlap):** Validates parallel labs while flagging subgroup double-bookings $\implies$ `BLOCKER`.
5. **Tier 5 (Hardened Joint Session Evidentiary Gate):** Bypasses double-booking only upon verified evidence (`IDENTICAL_TRIPLET_MATCH`, `SOURCE_CELL_MATCH`, or `ADMINISTRATIVE_CONFIRMATION`). Overlaps without evidence remain conflicts.
6. **Tier 6 (Non-Exclusive Venue Bypass):** Bypasses `'Not Fixed'`, `'Ground'`, `'Sports'`, `'TBA'` $\implies$ `EXEMPTION (PASS)`.
7. **Tier 7 (Period Contiguity & Bell Boundary):** Validates 50m / 100m contiguous periods $\implies$ `BLOCKER`.
8. **Tier 8 (Unresolved Resource Gate):** Audits unmapped faculty and subjects $\implies$ `WARNING`.
9. **Tier 9 (Faculty Fatigue & Workload Limits):** Flags $> 3$ consecutive periods $\implies$ `WARNING`.
10. **Tier 10 (Academic Calendar Collision):** Compares against institutional holidays $\implies$ `WARNING`.

### 5.2 The SJ Conflict Publication Blocker
- **Ground Truth:** Instructor `SJ` (`SRISHTY JINDAL`, unprovisioned) is double-booked on **Wednesday Period 8 (14:00–14:50)** across Room **`AS18`** (**Page 12**, `5 CSE-B`, Subject `AICA`) and Room **`AS19`** (**Page 13**, `5 CSE-C2`, Subject `FLAT`).
- **Enforcement:** Recorded in `ConflictRecord` with `severity: 'BLOCKER'` and `resolutionStatus: 'OPEN'`.
- **Publication Invariant:** Publication API endpoint `POST /api/timetable/versions/:id/publish` strictly rejects promotion to `published` status while this blocker remains open.

---

## 6. Documented Prerequisites for Phase 3.4 Implementation

Before proceeding to Phase 3.4.6 (live publication of the 50 cohorts), the following administrative decisions must be fulfilled:
1. **SJ Conflict Resolution:** Institutional decision to reassign the instructor or adjust the period slot for either Assignment 1 (Page 12) or Assignment 2 (Page 13).
2. **Curriculum Subject Provisioning:** Administrative onboarding of the 100 unmatched subject codes and curricular clarification of the 2 ambiguous DSA courses.
3. **Faculty Account Creation:** HR onboarding of active user accounts for unprovisioned faculty (including Srishty Jindal / `SJ`) to unlock downstream attendance tracking.
4. **Joint Session Administrative Review:** Verification of the 105 joint session clusters during dry-run staging review.
