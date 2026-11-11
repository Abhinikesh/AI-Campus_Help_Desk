"""
CampusSphere AI — Phase 3.2.1 Timetable Parser & Reconciliation Test Suite
==========================================================================
Automated test suite verifying:
- Exact faculty identity matching with authentic MongoDB records.
- Prevention of false faculty mappings (similar names remaining unresolved).
- Exact subject identity matching.
- Curricular semester disparity handling (DSA in Sem 3 remaining ambiguous vs CS201).
- Duplicate legend entry reconciliation (dual abbreviations for same person).
- Transparent count reconciliation (111 people vs 113 abbreviations; 108 titles vs 116 abbreviations).
- Source provenance retention.
- Subgroup preservation (Batch A1/A2, Group 1/2).
- Co-instructor preservation in co-taught labs.
- Multi-period session integrity (100 min duration).
- Special venue handling (Not Fixed).
- Full 50-page regression without errors.

Offline execution: Does not contact MongoDB or external services.
"""

import hashlib
import json
import os
import sys
import unittest
from collections import defaultdict

# Ensure current directory is in PYTHONPATH
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from pdf_extractor import PDFExtractor, DEFAULT_PDF_PATH
from cohort_parser import CohortParser
from legend_parser import LegendParser
from grid_parser import GridParser
from normalizer import (
    Normalizer,
    VERIFIED_FACULTY_MAP,
    AMBIGUOUS_FACULTY_ABBRS,
    VERIFIED_SUBJECT_MAP,
    AMBIGUOUS_SUBJECT_ABBRS,
)
from validator import TimetableValidator


class TestTimetableParserPhase321(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        """Extract words from PDF once for all tests."""
        cls.extractor = PDFExtractor(DEFAULT_PDF_PATH)
        cls.metadata = cls.extractor.get_document_identity()
        cls.words_by_page = {
            p: cls.extractor.get_page_words(p)
            for p in range(1, 51)
        }

    def test_01_pdf_metadata_and_integrity(self):
        """Verify PDF SHA-256 hash, page count, and dimensions."""
        self.assertEqual(self.metadata["pages"], 50)
        self.assertEqual(
            self.metadata["sha256"],
            "8e296e026a4f1eaad3ab3103154663d758050d9cfe8c8ee98111d11d324d4cf0"
        )
        self.assertEqual(len(self.words_by_page), 50)
        self.assertGreater(len(self.words_by_page[1]), 200)

    def test_02_cohort_header_parsing(self):
        """Verify cohort header parsing across representative pages."""
        # Page 1: 3 CSE-A (3rd Semester)
        c1 = CohortParser.parse_header(self.words_by_page[1], 1)
        self.assertIn("3", c1["rawCohortLabel"])
        self.assertIn("CSE-A", c1["rawCohortLabel"])
        self.assertEqual(c1["department"], "CSE")
        self.assertEqual(c1["semester"], 3)
        self.assertEqual(c1["section"], "A")
        self.assertEqual(c1["semesterType"], "Odd")
        self.assertEqual(c1["academicYear"], "2026-2027")

        # Page 11: 5 CSE-A (5th Semester)
        c11 = CohortParser.parse_header(self.words_by_page[11], 11)
        self.assertIn("5", c11["rawCohortLabel"])
        self.assertIn("CSE-A", c11["rawCohortLabel"])
        self.assertEqual(c11["semester"], 5)
        self.assertEqual(c11["section"], "A")

        # Page 21: 5 CC (5th Semester Cloud Computing)
        c21 = CohortParser.parse_header(self.words_by_page[21], 21)
        self.assertEqual(c21["rawCohortLabel"], "5 CC")
        self.assertEqual(c21["semester"], 5)
        self.assertEqual(c21["specialization"], "CC")

        # Page 23: 7CSE-A (7th Semester)
        c23 = CohortParser.parse_header(self.words_by_page[23], 23)
        self.assertEqual(c23["rawCohortLabel"], "7CSE-A")
        self.assertEqual(c23["semester"], 7)
        self.assertEqual(c23["section"], "A")

        # Page 38: 1-A (1st Semester Core Section A)
        c38 = CohortParser.parse_header(self.words_by_page[38], 38)
        self.assertEqual(c38["rawCohortLabel"], "1-A")
        self.assertEqual(c38["semester"], 1)
        self.assertEqual(c38["section"], "A")

        # Page 50: 5 ECE (5th Semester ECE)
        c50 = CohortParser.parse_header(self.words_by_page[50], 50)
        self.assertEqual(c50["rawCohortLabel"], "5 ECE")
        self.assertEqual(c50["semester"], 5)
        self.assertEqual(c50["department"], "ECE")

        # Verify all 50 pages parse valid cohort objects
        for p in range(1, 51):
            cohort = CohortParser.parse_header(self.words_by_page[p], p)
            self.assertIsNotNone(cohort)
            self.assertIn("rawCohortLabel", cohort)
            self.assertIn("semester", cohort)

    def test_03_exact_faculty_identity_matching(self):
        """Verify that genuine verified faculty match exact MongoDB records without fabrication."""
        # AG must map to Arushi Gupta (FAC009), NOT Dr. Aarti Gupta
        self.assertIn("AG", VERIFIED_FACULTY_MAP)
        self.assertEqual(VERIFIED_FACULTY_MAP["AG"]["name"], "Arushi Gupta")
        self.assertEqual(VERIFIED_FACULTY_MAP["AG"]["loginId"], "FAC009")

        # ANM must map to Anisha Mahto (FAC011), NOT Dr. Anjali Mehta
        self.assertIn("ANM", VERIFIED_FACULTY_MAP)
        self.assertEqual(VERIFIED_FACULTY_MAP["ANM"]["name"], "Anisha Mahto")
        self.assertEqual(VERIFIED_FACULTY_MAP["ANM"]["loginId"], "FAC011")

        # AP must map to Aman Prasad (FAC006), NOT Dr. Anil Patil
        self.assertIn("AP", VERIFIED_FACULTY_MAP)
        self.assertEqual(VERIFIED_FACULTY_MAP["AP"]["name"], "Aman Prasad")
        self.assertEqual(VERIFIED_FACULTY_MAP["AP"]["loginId"], "FAC006")

        # MS must map to Meeta Singh (FAC002), NOT Dr. Meera Sharma
        self.assertIn("MS", VERIFIED_FACULTY_MAP)
        self.assertEqual(VERIFIED_FACULTY_MAP["MS"]["name"], "Meeta Singh")
        self.assertEqual(VERIFIED_FACULTY_MAP["MS"]["loginId"], "FAC002")

        # VIP must map to Vipin (CDC) (FAC018), NOT Dr. Vivek Paul
        self.assertIn("VIP", VERIFIED_FACULTY_MAP)
        self.assertEqual(VERIFIED_FACULTY_MAP["VIP"]["name"], "Vipin (CDC)")
        self.assertEqual(VERIFIED_FACULTY_MAP["VIP"]["loginId"], "FAC018")

        # Check all 18 verified mappings exist and have valid loginIds
        self.assertEqual(len(VERIFIED_FACULTY_MAP), 18)
        for abbr, info in VERIFIED_FACULTY_MAP.items():
            self.assertTrue(info["loginId"].startswith("FAC0"))
            self.assertNotIn("Dr.", info["name"])  # Real seeded names do not have Dr. prefix

    def test_04_similar_but_different_faculty_unresolved(self):
        """Verify similar but distinct faculty names are NOT mapped to FAC001 Dr. Priya Mehta."""
        # PRA (Pratima Mehta), PREMA (Prema CDC), and PRIYA (Priya CDC) must be AMBIGUOUS
        self.assertIn("PRA", AMBIGUOUS_FACULTY_ABBRS)
        self.assertIn("PREMA", AMBIGUOUS_FACULTY_ABBRS)
        self.assertIn("PRIYA", AMBIGUOUS_FACULTY_ABBRS)

        # None of them should be in VERIFIED_FACULTY_MAP
        self.assertNotIn("PRA", VERIFIED_FACULTY_MAP)
        self.assertNotIn("PREMA", VERIFIED_FACULTY_MAP)
        self.assertNotIn("PRIYA", VERIFIED_FACULTY_MAP)

        # Test normalization assigns AMBIGUOUS status
        cohort = CohortParser.parse_header(self.words_by_page[1], 1)
        teachers, subjects = LegendParser.parse_page_legends(self.words_by_page[1])
        raw_session = {
            "sourcePage": 1,
            "dayOfWeek": 5,
            "dayName": "Friday",
            "period": 5,
            "periodCount": 2,
            "startTime": "11:30",
            "endTime": "13:10",
            "subjectAcronym": "DEC lab",
            "room": "AS11",
            "batch": "3CSE-A2",
            "sourceGroupLabel": "3CSE-A2",
            "instructors": ["PRA", "NAM"],
            "rawCellText": "DEC lab AS11 PRA, NAM",
        }
        entry = Normalizer.normalize_session(raw_session, cohort, teachers, subjects)
        pra_inst = [i for i in entry["instructors"] if i["abbreviation"] == "PRA"][0]
        self.assertEqual(pra_inst["matchingStatus"], "AMBIGUOUS")
        self.assertIsNone(pra_inst["erpLoginId"])

        # Unmatched faculty like NAM must remain UNMATCHED
        nam_inst = [i for i in entry["instructors"] if i["abbreviation"] == "NAM"][0]
        self.assertEqual(nam_inst["matchingStatus"], "UNMATCHED")

    def test_05_exact_subject_identity_matching(self):
        """Verify exact subject matching against Sem 5 catalog records."""
        self.assertIn("DAA", VERIFIED_SUBJECT_MAP)
        self.assertEqual(VERIFIED_SUBJECT_MAP["DAA"]["code"], "CS501")
        self.assertEqual(VERIFIED_SUBJECT_MAP["FLAT"]["code"], "CS502")
        self.assertEqual(VERIFIED_SUBJECT_MAP["AICA"]["code"], "CS503")
        self.assertEqual(VERIFIED_SUBJECT_MAP["5QA-Tech"]["code"], "CS513")
        self.assertEqual(VERIFIED_SUBJECT_MAP["5QA-APT"]["code"], "CS512")
        self.assertEqual(VERIFIED_SUBJECT_MAP["5QA-VERB"]["code"], "CS514")
        self.assertEqual(len(VERIFIED_SUBJECT_MAP), 14)

    def test_06_similar_subject_names_unresolved(self):
        """Verify that DSA (Semester 3) is classified as AMBIGUOUS against CS201 (Semester 4)."""
        self.assertIn("DSA", AMBIGUOUS_SUBJECT_ABBRS)
        self.assertNotIn("DSA", VERIFIED_SUBJECT_MAP)

        cohort = CohortParser.parse_header(self.words_by_page[1], 1)
        teachers, subjects = LegendParser.parse_page_legends(self.words_by_page[1])
        raw_session = {
            "sourcePage": 1,
            "dayOfWeek": 1,
            "dayName": "Monday",
            "period": 8,
            "periodCount": 1,
            "startTime": "14:00",
            "endTime": "14:50",
            "subjectAcronym": "DSA",
            "room": "AF13",
            "batch": "All",
            "sourceGroupLabel": None,
            "instructors": ["AP"],
            "rawCellText": "DSA AF13 AP",
        }
        entry = Normalizer.normalize_session(raw_session, cohort, teachers, subjects)
        self.assertEqual(entry["subject"]["matchingStatus"], "AMBIGUOUS")
        self.assertIsNone(entry["subject"]["code"])

    def test_07_duplicate_legend_entries_reconciliation(self):
        """Verify detection of dual abbreviations for the same individual and shared titles."""
        all_teachers = {}
        all_subjects = {}
        for p in range(1, 51):
            t_leg, s_leg = LegendParser.parse_page_legends(self.words_by_page[p])
            all_teachers.update(t_leg)
            all_subjects.update(s_leg)

        # Faculty: 113 abbreviations mapping to 110 unique physical people
        self.assertEqual(len(all_teachers), 113)
        name_to_abbrs = defaultdict(list)
        for abbr, name in all_teachers.items():
            name_to_abbrs[name.upper().strip()].append(abbr)
        self.assertEqual(len(name_to_abbrs), 110)
        self.assertEqual(sorted(name_to_abbrs["ROHIT BATHLA"]), ["OB", "ROB"])
        self.assertEqual(sorted(name_to_abbrs["RAVINDER KUMAR CHAHAR"]), ["KC", "RKC"])
        self.assertEqual(sorted(name_to_abbrs["RACHNA (SPANISH)"]), ["CH", "RCH"])

        # Subjects: 116 abbreviations mapping to 106 unique course titles
        self.assertEqual(len(all_subjects), 116)
        s_name_map = defaultdict(list)
        for code, title in all_subjects.items():
            s_name_map[title.upper().strip()].append(code)
        self.assertEqual(len(s_name_map), 106)
        # Verify theory/lab duplicates
        self.assertIn("AICA", s_name_map["ARTIFICIAL INTELLIGENCE CONCEPTS AND ITS APPLICATIONS"])
        self.assertIn("AICA LAB", s_name_map["ARTIFICIAL INTELLIGENCE CONCEPTS AND ITS APPLICATIONS"])

    def test_08_source_provenance_retention(self):
        """Verify that every normalized entry preserves source document, page, and cell text."""
        cohort = CohortParser.parse_header(self.words_by_page[1], 1)
        teachers, subjects = LegendParser.parse_page_legends(self.words_by_page[1])
        raw_sessions = GridParser.extract_sessions(self.words_by_page[1], 1, teachers, subjects)
        entries = [Normalizer.normalize_session(s, cohort, teachers, subjects) for s in raw_sessions]

        for e in entries:
            self.assertEqual(e["sourceDocument"], "classWise-TT-21_OCT_2026.pdf")
            self.assertEqual(e["sourcePage"], 1)
            self.assertIsNotNone(e["sourceCellText"])
            self.assertGreater(len(e["sourceCellText"]), 0)
            self.assertIn(e["dayOfWeek"], range(1, 6))
            self.assertIn(e["period"], range(1, 11))

    def test_09_subgroup_preservation(self):
        """Verify parallel subgroup sessions (Batch A1/A2 and Group 1/Group 2) are isolated."""
        cohort = CohortParser.parse_header(self.words_by_page[1], 1)
        teachers, subjects = LegendParser.parse_page_legends(self.words_by_page[1])
        raw_sessions = GridParser.extract_sessions(self.words_by_page[1], 1, teachers, subjects)
        entries = [Normalizer.normalize_session(s, cohort, teachers, subjects) for s in raw_sessions]

        # Monday P4: A1 / A2
        mon_p4 = [e for e in entries if e["dayName"] == "Monday" and e["period"] == 4]
        self.assertEqual(len(mon_p4), 2)
        batches = {e["batch"] for e in mon_p4}
        self.assertEqual(batches, {"3CSE-A1", "3CSE-A2"})
        rooms = {e["room"] for e in mon_p4}
        self.assertEqual(rooms, {"AF13", "AF23"})

        # Monday P9: Group 1 / Group 2
        mon_p9 = [e for e in entries if e["dayName"] == "Monday" and e["period"] == 9]
        self.assertEqual(len(mon_p9), 2)
        batches_p9 = {e["batch"] for e in mon_p9}
        self.assertEqual(batches_p9, {"Group 1", "Group 2"})
        subjects_p9 = {e["subject"]["acronym"] for e in mon_p9}
        self.assertEqual(subjects_p9, {"WPPH", "IQC"})

    def test_10_co_instructor_and_multi_period_preservation(self):
        """Verify co-taught multi-period labs retain multiple instructors and span 100 minutes."""
        cohort = CohortParser.parse_header(self.words_by_page[1], 1)
        teachers, subjects = LegendParser.parse_page_legends(self.words_by_page[1])
        raw_sessions = GridParser.extract_sessions(self.words_by_page[1], 1, teachers, subjects)
        entries = [Normalizer.normalize_session(s, cohort, teachers, subjects) for s in raw_sessions]

        # Wednesday P2: OOP Lab
        oop_lab = [e for e in entries if e["dayName"] == "Wednesday" and e["period"] == 2 and "OOP Lab" in e["subject"]["acronym"]][0]
        self.assertEqual(oop_lab["periodCount"], 2)
        self.assertEqual(oop_lab["startTime"], "09:00")
        self.assertEqual(oop_lab["endTime"], "10:40")
        self.assertEqual(oop_lab["room"], "AF-9")
        self.assertEqual(len(oop_lab["instructors"]), 2)
        abbrs = {i["abbreviation"] for i in oop_lab["instructors"]}
        self.assertEqual(abbrs, {"KAS", "AM"})

    def test_11_special_venue_handling(self):
        """Verify special venue 'Not Fixed' for Sports & Yoga spanning 2 periods."""
        cohort = CohortParser.parse_header(self.words_by_page[1], 1)
        teachers, subjects = LegendParser.parse_page_legends(self.words_by_page[1])
        raw_sessions = GridParser.extract_sessions(self.words_by_page[1], 1, teachers, subjects)
        entries = [Normalizer.normalize_session(s, cohort, teachers, subjects) for s in raw_sessions]

        sy = [e for e in entries if e["dayName"] == "Monday" and e["period"] == 5 and "SY" in e["subject"]["acronym"]][0]
        self.assertEqual(sy["room"], "Not Fixed")
        self.assertEqual(sy["periodCount"], 2)
        self.assertEqual(sy["startTime"], "11:30")
        self.assertEqual(sy["endTime"], "13:10")

    def test_12_full_50_page_staging_regression(self):
        """Full 50-page regression test ensuring all 50 cohorts produce 977 validated entries."""
        all_entries = []
        all_pages_summary = []
        global_teachers = {}
        global_subjects = {}

        for p in range(1, 51):
            c = CohortParser.parse_header(self.words_by_page[p], p)
            t_leg, s_leg = LegendParser.parse_page_legends(self.words_by_page[p])
            global_teachers.update(t_leg)
            global_subjects.update(s_leg)

            raw = GridParser.extract_sessions(self.words_by_page[p], p, t_leg, s_leg)
            page_entries = [Normalizer.normalize_session(s, c, t_leg, s_leg) for s in raw]
            all_entries.extend(page_entries)

            all_pages_summary.append({
                "sourcePage": p,
                "cohort": c,
                "sessionsExtracted": len(page_entries),
                "teachersCount": len(t_leg),
                "subjectsCount": len(s_leg),
                "teachersLegend": t_leg,
                "subjectsLegend": s_leg,
            })

        self.assertEqual(len(all_pages_summary), 50)
        self.assertEqual(len(all_entries), 977)

        # Validator check
        validator = TimetableValidator()
        val_res = validator.validate(
            self.metadata,
            all_pages_summary,
            all_entries,
            global_teachers,
            global_subjects,
        )
        self.assertTrue(val_res["allRulesPassed"])
        self.assertEqual(val_res["errorCount"], 0)


class TestPhase3_2_2AuditArtifacts(unittest.TestCase):
    """Verifies that all 10 Phase 3.2.2 audit artifacts are structurally sound, concordant, and valid."""
    STAGING_DIR = "/tmp/campussphere-timetable-staging-phase3_2_2"

    def test_all_10_artifacts_exist_and_non_empty(self):
        artifacts = [
            "full_source_verification.json",
            "entry_integrity_report.json",
            "faculty_integrity_report.json",
            "subject_integrity_report.json",
            "subgroup_integrity_report.json",
            "multi_period_integrity_report.json",
            "conflict_simulation_report.json",
            "erp_compatibility_report.json",
            "import_readiness_report.md",
            "checksums.sha256",
        ]
        for art in artifacts:
            fpath = os.path.join(self.STAGING_DIR, art)
            self.assertTrue(os.path.exists(fpath), f"Artifact missing: {art}")
            self.assertGreater(os.path.getsize(fpath), 0, f"Artifact empty: {art}")

    def test_checksums_integrity(self):
        csum_path = os.path.join(self.STAGING_DIR, "checksums.sha256")
        with open(csum_path) as f:
            lines = f.readlines()
        self.assertEqual(len(lines), 9)

        for line in lines:
            parts = line.strip().split()
            self.assertEqual(len(parts), 2)
            expected_hash, fname = parts[0], parts[1]
            fpath = os.path.join(self.STAGING_DIR, fname)
            h = hashlib.sha256()
            with open(fpath, "rb") as f:
                while chunk := f.read(65536):
                    h.update(chunk)
            self.assertEqual(h.hexdigest(), expected_hash, f"SHA-256 mismatch for {fname}")

    def test_period_slot_math_integrity(self):
        with open(os.path.join(self.STAGING_DIR, "entry_integrity_report.json")) as f:
            data = json.load(f)
        math_data = data["periodSlotMathematicalIdentity"]
        self.assertEqual(math_data["totalEntries"], 977)
        self.assertEqual(math_data["singlePeriodSessions"]["count"], 760)
        self.assertEqual(math_data["doublePeriodSessions"]["count"], 217)
        self.assertEqual(math_data["totalOccupiedPeriodSlots"], 1194)
        self.assertEqual(760 * 1 + 217 * 2, 1194)

    def test_entity_reconciliation_integrity(self):
        with open(os.path.join(self.STAGING_DIR, "faculty_integrity_report.json")) as f:
            fac = json.load(f)
        self.assertEqual(fac["summary"]["verifiedCount"], 18)
        self.assertEqual(fac["summary"]["ambiguousCount"], 4)
        self.assertEqual(fac["summary"]["unmatchedCount"], 91)
        self.assertTrue(fac["summary"]["zeroUnauthorizedAssignmentsConfirmed"])

        with open(os.path.join(self.STAGING_DIR, "subject_integrity_report.json")) as f:
            subj = json.load(f)
        self.assertEqual(subj["summary"]["verifiedCount"], 14)
        self.assertEqual(subj["summary"]["ambiguousCount"], 2)
        self.assertEqual(subj["summary"]["unmatchedCount"], 100)
        self.assertTrue(subj["summary"]["zeroUnauthorizedAssignmentsConfirmed"])

    def test_conflict_simulation_integrity(self):
        with open(os.path.join(self.STAGING_DIR, "conflict_simulation_report.json")) as f:
            conf = json.load(f)
        self.assertEqual(conf["findingsClassification"]["definiteConflictsCount"], 0)
        self.assertEqual(conf["detailedBreakdown"]["cohortOverlaps"]["definiteCohortClashes"], 0)
        self.assertEqual(conf["detailedBreakdown"]["cohortOverlaps"]["totalOverlappingSlots"], 119)
        self.assertEqual(conf["detailedBreakdown"]["roomOverlaps"]["physicalRoomOverlappingSlots"], 105)
        self.assertEqual(conf["detailedBreakdown"]["facultyOverlaps"]["facultyOverlappingSlots"], 129)

    def test_full_source_verification_integrity(self):
        with open(os.path.join(self.STAGING_DIR, "full_source_verification.json")) as f:
            src = json.load(f)
        self.assertEqual(src["summary"]["totalEntriesChecked"], 977)
        self.assertEqual(src["summary"]["totalVerified"], 977)
        self.assertEqual(src["summary"]["totalIncorrect"], 0)
        self.assertEqual(src["summary"]["totalPagesAudited"], 50)
        self.assertEqual(src["summary"]["totalPagesWithDiscrepancies"], 0)
        self.assertEqual(len(src["benchmarkManualSamples"]), 10)


if __name__ == "__main__":
    unittest.main()
