# CampusSphere AI — Phase 3.3 Master Timetable Architecture & Schema Design Report

**Project:** CampusSphere AI — Enterprise Smart Campus Management Platform  
**Repository:** `/Users/abhinikesh/AI-Campus_Help_Desk`  
**Phase:** 3.3 (Architecture and Schema Design ONLY)  
**Status:** `DESIGN_COMPLETE`  
**Source Document:** `classWise-TT-21_OCT_2026.pdf` (Uploaded as `media_1794370819803_238c020d.pdf`)  
**Authentic Checksum:** `SHA-256: 8e296e026a4f1eaad3ab3103154663d758050d9cfe8c8ee98111d11d324d4cf0`  
**Design Directory:** `/tmp/campussphere-timetable-phase3_3-design/`  
**Database Mutation Status:** Zero Writes / Strictly Enforced Read-Only  
**Production Code Mutation Status:** Zero Modifications / Pure Architecture Specification  
**UI Theme Convention:** Permanent Light Mode  

---

## 1. Executive Summary & Design Status Classification

### Final Status: `DESIGN_COMPLETE`

Phase 3.3 has successfully developed a complete, fault-tolerant, production-ready timetable architecture for CampusSphere AI ERP. The architecture bridges the fundamental gap between the legacy single-room, single-teacher ERP model and the operational reality of the university’s 50-page institutional timetable.

The complete design accommodates:
- **50 Institutional Cohorts** spanning 6 degree tiers (B.Tech Core, Specializations AIML/DS/DFCS/GT, Integrated BAIML, BCA, MCA, MBA, M.Tech).
- **977 Extracted Timetable Sessions** expanded across **1,194 Occupied Period-Slots** via a strict mathematical schedule ($760 \times 1 + 217 \times 2$).
- **113 Faculty Abbreviations** representing **110 Physical Individuals** (18 verified active MongoDB faculty, 92 safely unprovisioned, and 3 confirmed legend aliases).
- **116 Subject Acronyms** (16 verified active curriculum courses, 100 safely unprovisioned).
- **173 Subgroup Laboratory & Tutorial Batches** normalized without fabricating student roster records.
- **105 Room Overlaps & 127 Faculty Overlaps** recognized as legitimate cross-cohort joint lectures via shared UUID clustering.
- **1 Authentic Faculty Double-Booking Conflict** (Instructor `SJ` on Wednesday Period 8 between Rooms `AS18` and `AS19`) established as an immutable, publication-blocking gatekeeper.
- **13-Stage Ingestion Pipeline** featuring SHA-256 idempotent staging, dry-run conflict audits, and atomic transactional publishing.
- **100% Backward Compatibility** ensuring zero downtime and zero disruption to downstream modules such as student attendance tracking.

---

## 2. Institutional Timetable Ground Truth & Mathematical Invariants

### 2.1 Authentic Source Identification
- **Source File:** `classWise-TT-21_OCT_2026.pdf` (Artifact: `media_1794370819803_238c020d.pdf`).
- **Verified SHA-256 Checksum:** `8e296e026a4f1eaad3ab3103154663d758050d9cfe8c8ee98111d11d324d4cf0`.
- **Pages / Cohorts:** Exactly 50 pages, exactly 50 distinct cohorts.

### 2.2 Canonical Bell Schedule & Period Spans
All 50 pages operate under a unified 10-period daily bell schedule from **08:10 to 16:30** (50 minutes per period) with zero gaps:
$$\text{Day Span: Monday through Friday (08:10 – 16:30)}$$

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
- Double-period blocks span any two consecutive periods across both odd-even and even-odd boundaries (e.g., P8–P9 has 37 sessions, P6–P7 has 33 sessions, P2–P3 has 12 sessions).

---

## 3. Reconciliation Architecture: Faculty & Curriculum Identity

### 3.1 Faculty Identity Reconciliation
- **18 Verified Faculty:** Verified accounts in MongoDB `users` (`FAC002` through `FAC019`), linked via `instructors: [ObjectId]` and `faculty: ObjectId`.
- **92 Unprovisioned Faculty:** Preserved safely without inserting synthetic user records. Stored in `instructorAbbreviations: [String]` with `faculty: null` and `isFacultyResolved: false`.
- **3 Legend Duplicate Aliases:**
  1. `OB` mapped to canonical `ROB` (Rohit Bathla, CSE).
  2. `KC` mapped to canonical `RKC` (Ravinder Kumar Chahar, CSE).
  3. `CH` mapped to canonical `RCH` (Rachna, Spanish).
- **Strict Disambiguation Invariant:**
  `PRA` (`PRATIMA MEHTA`), `PREMA` (`PREMA (CDC)`), and `PRIYA` (`PRIYA (CDC)`) are distinct individuals from `Dr. Priya Mehta` (`FAC001`). All three are strictly classified as `UNMATCHED_FACULTY`. Exactly 0 unauthorized ObjectIds assigned.

### 3.2 Multi-Instructor Co-Teaching
- 149 timetable entries feature multi-instructor co-teaching (147 dual-faculty, 2 triple-faculty).
- Modeled via `instructors: [{ type: ObjectId, ref: 'User' }]` and `instructorAbbreviations: [String]`.
- Backward compatibility: The primary instructor (`instructors[0]`) is synchronized to the scalar `faculty` field.

### 3.3 Curriculum Subject Reconciliation
- **16 Verified Subjects:** Linked to existing `subjects` collection.
- **100 Unprovisioned Subjects:** Preserved via `subjectAcronym` (e.g. `WPPH`, `DSA`, `FLAT`), with `subject: null` and `isSubjectResolved: false`.
- **Attendance Safety Invariant:** Downstream `AttendanceSession` creation enforces that both `faculty` and `subject` must be non-null. Sessions with unmapped resources cannot generate attendance roll calls until administrative reconciliation is completed.

---

## 4. Subgroup & Cohort Architecture

### 4.1 Subgroup Normalization (173 Entries)
- Raw lab tokens (`G1`, `G2`, `B1`, `B2`, `Batch-1`, `A1`, `G1+G2`) are normalized into a canonical `batch` string (`'G1'`, `'G2'`, `'B1'`, `'B2'`, or `'ALL'`).
- The unadulterated string is retained in `sourceGroupLabel`.
- **No Roster Fabrication:** Student records in MongoDB are NOT modified. If a student is unassigned to a batch, the frontend UI renders parallel labs with clear visual subgroup badges (`[G1]`, `[G2]`) in permanent light mode.

### 4.2 Cohort Taxonomy & Degree Tiers
Cohorts are uniquely structured across five dimensions:
$$\langle \text{Program}, \text{Department}, \text{Branch}, \text{Specialization}, \text{Semester}, \text{Section} \rangle$$
- Eliminates cross-program collisions (e.g., `B.Tech 3 CSE-A` vs `BCA 1 BCA-A` vs `M.Tech 1 M.TECH`).

---

## 5. Conflict Engine & Publication Gatekeeping

### 5.1 10-Tier Conflict Detection Engine
1. **Tier 1 (Faculty Double-Booking):** Detects multi-room instructor collisions $\implies$ `BLOCKER`.
2. **Tier 2 (Room Double-Booking):** Detects room collisions excluding whitelisted venues $\implies$ `BLOCKER`.
3. **Tier 3 (Cohort Section Collision):** Detects whole-class duplicate bookings $\implies$ `BLOCKER`.
4. **Tier 4 (Subgroup Incompatible Overlap):** Validates parallel labs while flagging subgroup double-bookings $\implies$ `BLOCKER`.
5. **Tier 5 (Joint Session Exemption Gate):** Recognizes sessions sharing `jointSessionId` $\implies$ `EXEMPTION (PASS)`.
6. **Tier 6 (Non-Exclusive Venue Bypass):** Bypasses `'Not Fixed'`, `'Ground'`, `'Sports'`, `'TBA'` $\implies$ `EXEMPTION (PASS)`.
7. **Tier 7 (Period Contiguity & Bell Boundary):** Validates 50m / 100m contiguous periods $\implies$ `BLOCKER`.
8. **Tier 8 (Unresolved Resource Gate):** Audits unmapped faculty and subjects $\implies$ `WARNING`.
9. **Tier 9 (Faculty Fatigue & Workload Limits):** Flags $> 3$ consecutive periods $\implies$ `WARNING`.
10. **Tier 10 (Academic Calendar Collision):** Compares against institutional holidays $\implies$ `WARNING`.

### 5.2 The SJ Conflict Publication Blocker
- **Ground Truth:** Instructor `SJ` (`SHELLY JAIN`, CSE) is double-booked on **Wednesday Period 8 (14:00–14:50)** across Room **`AS18`** (`5 CSE-B`, Page 8) and Room **`AS19`** (`5 CSE-C2`, Page 10).
- **Enforcement:** Recorded in `ConflictRecord` with `severity: 'BLOCKER'` and `resolutionStatus: 'OPEN'`.
- **Publication Invariant:** The publication API endpoint `POST /api/timetable/versions/:id/publish` strictly rejects promotion to `published` status while any blocker conflict remains open.

---

## 6. Mongoose Schema Architecture & Index Design

### 6.1 Deliverable Schemas in `proposed_mongoose_schemas.js`
1. **`TimetableSchema`:** Canonical schedule model with backward-compatible scalar `faculty`, array `instructors`, `periodNumbers`, `slotSpan`, `jointSessionId`, `batch`, and provenance tracking.
2. **`TimetableVersionSchema`:** Versioning model with extended unique index, immutable denormalized `entriesSnapshot`, validation metrics, and audit log.
3. **`TimetableStagingSchema`:** Isolated staging model with SHA-256 idempotency hash, raw extracted payload, and normalized data proposals.
4. **`TimetableAnomalySchema`:** Tracks the 41 token-splitting anomalies and legend alias mappings.
5. **`ConflictRecordSchema`:** Tracks active resource conflicts, severity levels, and dual-control administrative overrides.

### 6.2 Critical Unique Index Correction
```javascript
// Corrected Canonical Unique Index (Prevents Cross-Branch & Cross-Program Version Collisions):
TimetableVersionSchema.index(
  {
    academicYear: 1,
    program: 1,
    department: 1,
    branch: 1,
    specialization: 1,
    semester: 1,
    section: 1,
    versionNumber: 1
  },
  { unique: true, name: 'idx_unique_cohort_timetable_version' }
);
```

---

## 7. Ingestion Pipeline & Lifecycle Versioning

### 7.1 13-Stage Ingestion Pipeline
From PDF verification through deterministic bounding box extraction, token normalization, SHA-256 idempotent staging, joint session clustering, dry-run conflict auditing, administrative portal review, to atomic transactional insertion.

### 7.2 Immutable Snapshots & Forward Rollback
- Once approved and published, the version snapshot is frozen in `entriesSnapshot`.
- Rollbacks are enacted by generating a new forward version ($v_{n+1}$) initialized with historical snapshot data, preserving audit integrity.

---

## 8. Index of Phase 3.3 Design Deliverables

All 16 required deliverables have been authored and archived in `/tmp/campussphere-timetable-phase3_3-design/`:

| No. | File Name | Description / Topic | Status |
| :---: | :--- | :--- | :---: |
| 1 | `current_architecture_inventory.md` | Inventory of existing schemas, controllers, conflict engine, and failure modes. | Complete |
| 2 | `canonical_data_model.md` | Canonical data model specification, taxonomy, and period-slot durations. | Complete |
| 3 | `proposed_mongoose_schemas.js` | Executable Mongoose schemas for Timetable, Version, Staging, Anomaly, Conflict. | Complete |
| 4 | `entity_relationship_diagram.md` | Mermaid ER diagram and comprehensive data dictionary. | Complete |
| 5 | `index_and_constraint_design.md` | Indexing catalog, performance analysis, and unique constraint correction. | Complete |
| 6 | `conflict_detection_specification.md` | Algorithmic specification for 10-tier conflict engine and SJ blocker logic. | Complete |
| 7 | `faculty_subject_reconciliation_design.md` | Strategy for 18 mapped / 92 unmapped faculty, 16/100 subjects, and aliases. | Complete |
| 8 | `subgroup_and_cohort_design.md` | Subgroup normalization, 50-cohort taxonomy, and roster protection. | Complete |
| 9 | `timetable_versioning_design.md` | Lifecycle state machine, immutable snapshots, diffing, and forward revert. | Complete |
| 10 | `import_and_validation_workflow.md` | 13-stage ingestion pipeline, dry-run validation, and rollback procedures. | Complete |
| 11 | `api_contract_design.md` | REST API specifications, query filters, schemas, error codes, and RBAC. | Complete |
| 12 | `migration_and_backward_compatibility_plan.md` | Zero-downtime expand-and-contract strategy and attendance preservation. | Complete |
| 13 | `security_and_authorization_design.md` | RBAC matrix, departmental isolation, audit logs, and dual-control rules. | Complete |
| 14 | `test_strategy.md` | Test strategy spanning unit tests, 10 conflict cases, and pipeline simulation. | Complete |
| 15 | `implementation_roadmap.md` | Phased implementation roadmap for Phase 3.4+ with milestones and gates. | Complete |
| 16 | `PHASE3_3_FINAL_ARCHITECTURE_REPORT.md` | Master architectural synthesis report (this deliverable). | Complete |

---

## 9. Conclusion & Strict Stop Condition

The Phase 3.3 architecture and schema design is fully complete, structurally verified, and ready for review.

**Strict Governance Directive:**
- **Zero Database Operations:** No records in MongoDB `campus-erp` were created, modified, or deleted.
- **Zero Production Code Operations:** No production files in `server/` or `client/` were altered.
- **Stop Condition:** This phase terminates strictly with design delivery. Implementation shall commence exclusively in Phase 3.4 following explicit user authorization.

