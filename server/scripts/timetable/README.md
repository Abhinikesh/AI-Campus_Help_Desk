# CampusSphere AI — Standalone Timetable PDF Parser (Phase 3.2)

Deterministic, offline parser and staging pipeline for the institutional timetable PDF (`classWise-TT-21_OCT_2026.pdf` / `media_1794370819803_238c020d.pdf`).

> **CRITICAL ARCHITECTURAL BOUNDARY:**
> This parser is strictly read-only with respect to the MongoDB database and ERP backend. All parsed data is staged to `/tmp/campussphere-timetable-staging/`. Database mutations, collection updates, and seed imports are strictly deferred to **Phase 3.3** after administrative review.

---

## 1. Overview & Purpose

The institutional timetable PDF is a 50-page, landscape-oriented document exported from **aSc Timetables** (`Microsoft: Print To PDF`) containing weekly schedules across 50 class cohorts for the Odd semester of Academic Year 2026-2027 (effective w.e.f. `2026-10-21`).

The standalone parser deterministically:
1. Validates the PDF SHA-256 checksum and page count (50 pages).
2. Extracts word bounding boxes using Poppler utilities (`pdftotext -tsv`) without relying on OCR or external vision models.
3. Classifies cohort metadata from page headers (program, department, semester, section, specialization).
4. Decomposes footer legends to extract teacher abbreviations (`abbr -> full name`) and subject acronyms (`acronym -> full title`).
5. Analyzes the 5x10 day-period schedule grid (Days: Monday–Friday; Periods: 1–10 from 08:10 to 16:30).
6. Disentangles parallel subgroups (e.g. `3CSE-A1` / `3CSE-A2`, `Group 1` / `Group 2`), language tracks (`FR1`, `GR1`, `S1`), multi-period spans (e.g. 2-hour labs), and multi-instructor co-teaching assignments.
7. Normalizes entries into canonical ERP timetable formats and links them with verified MongoDB records.
8. Enforces 12 strict validation rules and exports staging artifacts to `/tmp/campussphere-timetable-staging/`.

---

## 2. Architecture & Module Breakdown

The parser is structured into modular, decoupled Python components inside `server/scripts/timetable/`:

| Module | Description |
| :--- | :--- |
| `pdf_extractor.py` | Extracts word-level bounding boxes and metadata using Poppler `pdftotext -tsv` and `pdfinfo`. Computes SHA-256 document identity. |
| `cohort_parser.py` | Parses header region coordinates (`top <= 100`) to extract cohort label, department, program, semester, section, specialization, and effective date. |
| `legend_parser.py` | Parses footer region coordinates (`top >= 465`) across 4 sub-columns to extract teacher abbreviations and subject descriptions. |
| `grid_parser.py` | Maps 5x10 cell grid (`y: 125.0..459.0`, `x: 88.5..766.5`), handles vertical subgroup splits, horizontal period spans, and merges split subgroup lab periods. |
| `normalizer.py` | Canonicalizes period timings, session types (`Lecture`, `Lab`, `Tutorial`, `Other`), subgroup batches, and reconciles entities against verified MongoDB faculty and subjects. |
| `validator.py` | Automated validator enforcing all 12 validation rules (50 pages, valid intervals, multi-period alignment, parallel subgroup isolation, duplicate detection, etc.). |
| `parse_timetable_pdf.py` | Master orchestrator CLI driving the extraction pipeline and outputting staging JSON and Markdown reports. |
| `test_parser.py` | Unit and regression test suite covering single/multi-period sessions, subgroup isolation, language tracks, special venues, and 50-page regression. |

---

## 3. CLI Usage & Arguments

To run the master parser with default settings:
```bash
python3 server/scripts/timetable/parse_timetable_pdf.py
```

### Optional Arguments
```bash
python3 server/scripts/timetable/parse_timetable_pdf.py \
  --pdf /path/to/timetable.pdf \
  --out-dir /tmp/campussphere-timetable-staging
```

- `--pdf`: Path to the source timetable PDF (defaults to the verified artifact PDF).
- `--out-dir`: Destination directory for staging files (defaults to `/tmp/campussphere-timetable-staging/`).

---

## 4. Staging Output Files

The parser produces four artifacts in `/tmp/campussphere-timetable-staging/`:

1. **`staging_timetable.json`** (~1.2 MB):
   - Canonical JSON document containing document metadata, academic session details, page summaries, and **977 normalized timetable entries**.
2. **`extraction_summary.json`** (~2.5 KB):
   - Machine-readable summary of extraction metrics: total pages (50), total entries (977), single-period vs multi-period breakdown, room catalog (47 unique rooms), and entity match counts.
3. **`unresolved_mappings.json`** (~23 KB):
   - Full catalog of unmapped and ambiguous entities:
     - 3 Ambiguous Faculty (`PRA`, `PREMA`, `PRIYA`).
     - 92 Unmatched Faculty in the PDF lacking MongoDB accounts.
     - 104 Unmatched Subjects in the PDF lacking MongoDB catalog records.
4. **`validation_report.md`** (~2.2 KB):
   - Human-readable compliance report certifying 100% pass rate across all 12 validation rules.

---

## 5. Entity Reconciliation Summary

Reconciliation of entities between the institutional PDF and the active MongoDB database (`campus-erp`):

### Faculty (113 in PDF Legends vs 19 in MongoDB)
- **18 Exact Matches (Verified):**
  - `AG` (FAC005: Dr. Aarti Gupta), `ANM` (FAC009: Dr. Anjali Mehta), `AP` (FAC006: Dr. Anil Patil), `MS` (FAC002: Dr. Meera Sharma), `VIP` (FAC018: Dr. Vivek Paul), `NID` (FAC016: Dr. Neha Sharma), `RM` (FAC007: Dr. Rajesh Kumar), `SH` (FAC010: Dr. Sneha Reddy), `ROB` (FAC017: Dr. Rohit Verma), `GS` (FAC014: Dr. Gaurav Sharma), `SHV` (FAC011: Dr. Shweta Joshi), `TD` (FAC019: Dr. Tushar Deshmukh), `AC` (FAC012: Dr. Ananya Chatterjee), `PB` (FAC003: Dr. Pooja Bhatia), `RB` (FAC013: Dr. Rakesh Bansal), `PN` (FAC015: Dr. Pooja Nair), `MEGH` (FAC004: Dr. Meena Roy), `TARA` (FAC008: Dr. Tarun Sen).
- **3 Ambiguous Cases (Flagged):**
  - `PRA` (PRATIMA MEHTA), `PREMA` (PREMA CDC), `PRIYA` (PRIYA CDC) vs DB `FAC001 Dr. Priya Mehta`.
- **92 Unmatched Faculty:**
  - Instructors in PDF legends (e.g. `AM: ASHOK MADAAN`, `TC: TANVI CHAWLA`, `KAS: KAMLESH SHARMA`) who require administrative user onboarding in Phase 3.3.

### Subjects (118 in PDF Legends vs 25 in MongoDB)
- **14 Exact Matches (Verified):**
  - `DAA`, `FLAT`, `AICA`, `CG`, `SDP`, `DTI-III`, `ES`, `DAA Lab`, `AICA LAB`, `CG Lab`, `SDP Lab`, `5QA-Tech`, `CT`, `COI`.
- **104 Unmatched Subjects:**
  - Lower-semester, elective, and specialized subjects (e.g. `CLE`, `OOP`, `WPPH`, `IQC`, `FR1`, `GR1`, `S1`) to be cataloged in Phase 3.3.

---

## 6. Running Tests Offline

Run the offline automated test suite:
```bash
python3 server/scripts/timetable/test_parser.py
```

All 11 unit tests execute in < 1.0 second with 0 network calls and 0 database access.

---

## 7. Next Steps & Scope Notice

Database writes, MongoDB schema updates, API endpoints, and ERP frontend integration are strictly prohibited during Phase 3.2 and are reserved for **Phase 3.3** after institutional sign-off.

