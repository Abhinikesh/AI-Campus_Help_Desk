"""
parse_timetable_pdf.py
Master standalone CLI for parsing institutional timetable PDF into normalized staging files.
Executes the full pipeline:
  1. PDF Verification & Extraction
  2. Header & Cohort Classification
  3. Legend Decomposition (Teachers & Subjects)
  4. Grid Decomposition (Days, Periods, Subgroups, Multi-Period Spans)
  5. Normalization & Entity Matching
  6. Automated Validation
  7. Staging Output Generation (/tmp/campussphere-timetable-staging/)
"""
import argparse
import json
import os
import sys
from datetime import datetime, timezone
from typing import Dict, List, Any

# Ensure local imports work regardless of working directory
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from pdf_extractor import PDFExtractor, DEFAULT_PDF_PATH
from cohort_parser import CohortParser
from legend_parser import LegendParser
from grid_parser import GridParser
from normalizer import Normalizer, VERIFIED_FACULTY_MAP, VERIFIED_SUBJECT_MAP, AMBIGUOUS_FACULTY_ABBRS
from validator import TimetableValidator

DEFAULT_OUT_DIR = "/tmp/campussphere-timetable-staging"


def parse_and_stage_timetable(pdf_path: str = DEFAULT_PDF_PATH, out_dir: str = DEFAULT_OUT_DIR) -> Dict[str, Any]:
    print("=" * 70)
    print("CAMPUSSPHERE AI — STANDALONE TIMETABLE PDF PARSER (PHASE 3.2)")
    print("=" * 70)

    # 1. Verify PDF
    extractor = PDFExtractor(pdf_path)
    doc_meta = extractor.get_document_identity()
    print(f"Verified Source PDF: {doc_meta['filename']}")
    print(f"SHA-256: {doc_meta['sha256']}")
    print(f"Total Pages: {doc_meta['pages']} | Size: {doc_meta['fileSize']} bytes")

    # 2. Extract and parse all 50 pages
    all_pages_summary: List[Dict[str, Any]] = []
    all_normalized_entries: List[Dict[str, Any]] = []
    global_teachers: Dict[str, str] = {}
    global_subjects: Dict[str, str] = {}
    global_rooms: set = set()

    single_period_count = 0
    multi_period_count = 0
    subgroup_sessions_count = 0
    multi_instructor_count = 0

    print(f"\nProcessing all {doc_meta['pages']} pages deterministically...")

    for page_num in range(1, doc_meta["pages"] + 1):
        words = extractor.get_page_words(page_num)
        cohort = CohortParser.parse_header(words, page_num)
        teachers_legend, subjects_legend = LegendParser.parse_page_legends(words)

        global_teachers.update(teachers_legend)
        global_subjects.update(subjects_legend)

        raw_sessions = GridParser.extract_sessions(words, page_num, teachers_legend, subjects_legend)

        page_entries: List[Dict[str, Any]] = []
        for raw_s in raw_sessions:
            norm_entry = Normalizer.normalize_session(raw_s, cohort, teachers_legend, subjects_legend)
            page_entries.append(norm_entry)
            all_normalized_entries.append(norm_entry)

            if norm_entry["room"] and norm_entry["room"] != "TBA":
                global_rooms.add(norm_entry["room"])

            if norm_entry["periodCount"] == 1:
                single_period_count += 1
            else:
                multi_period_count += 1

            if norm_entry["batch"] != "All":
                subgroup_sessions_count += 1

            if len(norm_entry["instructors"]) > 1:
                multi_instructor_count += 1

        all_pages_summary.append({
            "sourcePage": page_num,
            "cohort": cohort,
            "sessionsExtracted": len(page_entries),
            "teachersCount": len(teachers_legend),
            "subjectsCount": len(subjects_legend),
            "teachersLegend": teachers_legend,
            "subjectsLegend": subjects_legend,
        })

    print(f"Extraction complete! Total raw sessions extracted: {len(all_normalized_entries)}")

    # 3. Validation
    validator = TimetableValidator()
    val_report = validator.validate(
        doc_meta,
        all_pages_summary,
        all_normalized_entries,
        global_teachers,
        global_subjects,
    )

    print(f"Validation finished: All rules passed = {val_report['allRulesPassed']}")
    if val_report["errorCount"] > 0:
        print(f"Validation ERRORS ({val_report['errorCount']}):")
        for err in val_report["errors"]:
            print(f"  ❌ {err}")
    if val_report["warningCount"] > 0:
        print(f"Validation WARNINGS ({val_report['warningCount']}):")
        for warn in val_report["warnings"]:
            print(f"  ⚠️ {warn}")

    # 4. Generate Unresolved Mappings
    unresolved_instructors = {}
    matched_instructors = {}
    ambiguous_instructors = {}

    for abbr, name in global_teachers.items():
        if abbr in VERIFIED_FACULTY_MAP:
            matched_instructors[abbr] = {
                "name": name,
                "loginId": VERIFIED_FACULTY_MAP[abbr]["loginId"],
                "erpName": VERIFIED_FACULTY_MAP[abbr]["name"],
            }
        elif abbr in AMBIGUOUS_FACULTY_ABBRS:
            ambiguous_instructors[abbr] = {
                "name": name,
                "reason": "Name similarity with FAC001 Dr. Priya Mehta vs Pratima Mehta / Prema (CDC) / Priya (CDC)",
            }
        else:
            occurrences = sum(1 for e in all_normalized_entries for ins in e["instructors"] if ins["abbreviation"] == abbr)
            unresolved_instructors[abbr] = {
                "name": name,
                "occurrencesInTimetable": occurrences,
            }

    unresolved_subjects = {}
    matched_subjects = {}
    for code, title in global_subjects.items():
        matched_db = None
        for k, info in VERIFIED_SUBJECT_MAP.items():
            if k.lower() == code.lower() or info["name"].lower() == title.lower():
                matched_db = info
                break
        if matched_db:
            matched_subjects[code] = {
                "title": title,
                "erpCode": matched_db["code"],
                "erpName": matched_db["name"],
                "semester": matched_db["semester"],
            }
        else:
            occurrences = sum(1 for e in all_normalized_entries if e["subject"]["acronym"] == code)
            unresolved_subjects[code] = {
                "title": title,
                "occurrencesInTimetable": occurrences,
            }

    # 5. Output Generation
    os.makedirs(out_dir, exist_ok=True)

    staging_path = os.path.join(out_dir, "staging_timetable.json")
    summary_path = os.path.join(out_dir, "extraction_summary.json")
    unresolved_path = os.path.join(out_dir, "unresolved_mappings.json")
    val_md_path = os.path.join(out_dir, "validation_report.md")

    # Staging Timetable JSON
    staging_payload = {
        "metadata": {
            "document": doc_meta,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "generator": "CampusSphere Standalone Timetable PDF Parser v1.0.0",
            "validationPassed": val_report["allRulesPassed"],
        },
        "academicSession": {
            "academicYear": "2026-2027",
            "semesterType": "Odd",
            "effectiveStartDate": "2026-10-21",
            "effectiveEndDate": None,
        },
        "pages": all_pages_summary,
        "entries": all_normalized_entries,
    }
    with open(staging_path, "w", encoding="utf-8") as f:
        json.dump(staging_payload, f, indent=2, ensure_ascii=False)

    # Extraction Summary JSON
    summary_payload = {
        "documentIdentity": doc_meta,
        "metrics": {
            "totalPagesProcessed": doc_meta["pages"],
            "uniqueCohorts": len(all_pages_summary),
            "totalTimetableEntries": len(all_normalized_entries),
            "singlePeriodSessions": single_period_count,
            "multiPeriodSessions": multi_period_count,
            "subgroupSessions": subgroup_sessions_count,
            "multiInstructorSessions": multi_instructor_count,
            "uniqueTeachersInLegends": len(global_teachers),
            "uniqueSubjectsInLegends": len(global_subjects),
            "uniqueRoomsIdentified": len(global_rooms),
            "matchedFacultyCount": len(matched_instructors),
            "ambiguousFacultyCount": len(ambiguous_instructors),
            "unmatchedFacultyCount": len(unresolved_instructors),
            "matchedSubjectCount": len(matched_subjects),
            "unmatchedSubjectCount": len(unresolved_subjects),
        },
        "roomCatalog": sorted(list(global_rooms)),
        "validationOverview": val_report,
    }
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary_payload, f, indent=2, ensure_ascii=False)

    # Unresolved Mappings JSON
    unresolved_payload = {
        "unmatchedFaculty": unresolved_instructors,
        "ambiguousFaculty": ambiguous_instructors,
        "matchedFaculty": matched_instructors,
        "unmatchedSubjects": unresolved_subjects,
        "matchedSubjects": matched_subjects,
    }
    with open(unresolved_path, "w", encoding="utf-8") as f:
        json.dump(unresolved_payload, f, indent=2, ensure_ascii=False)

    # Validation Report MD
    with open(val_md_path, "w", encoding="utf-8") as f:
        f.write("# CampusSphere AI — Phase 3.2 Timetable Parser Validation Report\n\n")
        f.write(f"- **Generated At:** {datetime.now(timezone.utc).isoformat()}\n")
        f.write(f"- **Source PDF:** `{doc_meta['filename']}` (SHA-256: `{doc_meta['sha256']}`)\n")
        f.write(f"- **Overall Validation Status:** {'✅ PASSED (100%)' if val_report['allRulesPassed'] else '❌ FAILED'}\n\n")
        f.write("## 1. Rule-by-Rule Compliance Summary\n\n")
        f.write("| Rule ID | Description | Status |\n")
        f.write("| :--- | :--- | :--- |\n")
        for r_name, r_val in val_report["rulesSummary"].items():
            f.write(f"| `{r_name}` | {r_name.replace('_', ' ').capitalize()} | {'✅ PASS' if r_val else '❌ FAIL'} |\n")
        f.write("\n## 2. Quantitative Extraction Metrics\n\n")
        f.write(f"- **Total PDF Pages Processed:** {doc_meta['pages']}\n")
        f.write(f"- **Total Cohorts Extracted:** {len(all_pages_summary)}\n")
        f.write(f"- **Total Timetable Entries:** {len(all_normalized_entries)}\n")
        f.write(f"- **Single-Period Sessions (1 hr):** {single_period_count}\n")
        f.write(f"- **Multi-Period Sessions (2 hrs):** {multi_period_count}\n")
        f.write(f"- **Subgroup Sessions (Batch A1/A2, Group 1/2, Language):** {subgroup_sessions_count}\n")
        f.write(f"- **Multi-Instructor Co-Taught Sessions:** {multi_instructor_count}\n")
        f.write(f"- **Unique Teachers in PDF Legends:** {len(global_teachers)}\n")
        f.write(f"- **Unique Subjects in PDF Legends:** {len(global_subjects)}\n")
        f.write(f"- **Unique Rooms Identified:** {len(global_rooms)}\n\n")
        f.write("## 3. Entity Reconciliation Status\n\n")
        f.write(f"- **Faculty Exactly Matched:** {len(matched_instructors)} / 19 DB Faculty\n")
        f.write(f"- **Faculty Ambiguous:** {len(ambiguous_instructors)} (PRA, PREMA, PRIYA)\n")
        f.write(f"- **Faculty Unmatched in ERP:** {len(unresolved_instructors)} (Require administrative onboarding)\n")
        f.write(f"- **Subjects Exactly Matched:** {len(matched_subjects)} / 25 DB Subjects\n")
        f.write(f"- **Subjects Unmatched in ERP:** {len(unresolved_subjects)} (Require catalog onboarding)\n\n")
        f.write("## 4. Errors & Warnings\n\n")
        if val_report["errors"]:
            f.write("### Errors\n")
            for e in val_report["errors"]:
                f.write(f"- ❌ {e}\n")
        else:
            f.write("- **Zero validation errors detected.**\n")
        if val_report["warnings"]:
            f.write("### Warnings\n")
            for w in val_report["warnings"]:
                f.write(f"- ⚠️ {w}\n")
        else:
            f.write("- **Zero warnings detected.**\n")

    print("\nStaging files successfully generated:")
    print(f"  1. {staging_path} ({os.path.getsize(staging_path)} bytes)")
    print(f"  2. {summary_path} ({os.path.getsize(summary_path)} bytes)")
    print(f"  3. {unresolved_path} ({os.path.getsize(unresolved_path)} bytes)")
    print(f"  4. {val_md_path} ({os.path.getsize(val_md_path)} bytes)")
    print("=" * 70)

    return {
        "metadata": doc_meta,
        "metrics": summary_payload["metrics"],
        "validation": val_report,
        "stagingFiles": {
            "stagingTimetable": staging_path,
            "extractionSummary": summary_path,
            "unresolvedMappings": unresolved_path,
            "validationReport": val_md_path,
        },
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CampusSphere Timetable PDF Parser")
    parser.add_argument("--pdf", default=DEFAULT_PDF_PATH, help="Path to classWise-TT-21_OCT_2026.pdf")
    parser.add_argument("--out-dir", default=DEFAULT_OUT_DIR, help="Output directory for staging files")
    args = parser.parse_args()

    parse_and_stage_timetable(args.pdf, args.out_dir)
