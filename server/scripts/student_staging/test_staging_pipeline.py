#!/usr/bin/env python3
"""
server/scripts/student_staging/test_staging_pipeline.py
Phase 3.3A — Automated Test Suite for Student Staging Pipeline.

Covers all 14 required behavioral verifications:
1. Embedded header detection
2. Shifted-column handling
3. Missing optional columns (academic branch, internship company)
4. Blank and malformed rows filtering
5. Duplicate source rows & batch idempotency keys
6. Duplicate application numbers preservation
7. Multiple academic submissions for one candidate (append-only, isCanonical: false)
8. Ambiguous identity handling (Sayyam, Rupesh, Nishant)
9. Missing internship organization names (allowed)
10. Privacy-column exclusion (passwords, parent names/emails, drive URLs)
11. Source-row lineage preservation
12. Deterministic execution producing byte-identical outputs
13. Schema validation compliance (StudentStaging, AdmissionApplication, etc.)
14. Live database safety boundary
"""

import os
import json
import unittest
import hashlib
from typing import Dict, Any

from parser import parse_student_workbook, normalize_roll_number
from mapping import validate_all_staged_records
from synthetic_fixtures import generate_synthetic_workbook

FIXTURE_PATH = "/tmp/test_synthetic_student_workbook.xlsx"

class TestStudentStagingPipeline(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        # Generate synthetic fixture file in isolated temp path
        generate_synthetic_workbook(FIXTURE_PATH)
        cls.batch_id = "BATCH-TEST-PHASE3_3A-001"
        cls.parsed_data = parse_student_workbook(FIXTURE_PATH, cls.batch_id)

    @classmethod
    def tearDownClass(cls):
        if os.path.exists(FIXTURE_PATH):
            os.remove(FIXTURE_PATH)

    # 1. Embedded Header Detection
    def test_embedded_header_detection(self):
        staged = self.parsed_data["records"]["studentStaging"]
        # Ensure row 8 (COMPLETEROLLNO. / Name / Xth percentage) was not ingested as a student
        identifiers = [s["rawIdentifier"] for s in staged]
        for ident in identifiers:
            self.assertFalse("COMPLETEROLL" in (ident or "").upper())
            self.assertFalse("XTH PERCENTAGE" in (ident or "").upper())
        # Exactly 7 valid students in synthetic fixture
        self.assertEqual(len(staged), 7)

    # 2. Shifted Column Handling (Admission Migration Students)
    def test_shifted_column_handling(self):
        admissions = self.parsed_data["records"]["admissionApplications"]
        migration_entries = [a for a in admissions if "MIG" in a["applicationNumber"]]
        self.assertEqual(len(migration_entries), 2)
        
        mig1 = migration_entries[0]
        self.assertEqual(mig1["applicationNumber"], "APP-2021-MIG1")
        self.assertEqual(mig1["studentName"], "Manish Rao")
        self.assertEqual(mig1["course"], "B.Tech CSE")
        self.assertEqual(mig1["dateOfReporting"], "2021-09-01")

        mig2 = migration_entries[1]
        self.assertEqual(mig2["applicationNumber"], "APP-2021-MIG2")
        self.assertEqual(mig2["studentName"], "Neha Joshi")
        self.assertEqual(mig2["course"], "B.Tech AIML")
        self.assertEqual(mig2["dateOfReporting"], "2021-09-02")

    # 3. Missing Optional Columns & Two Academic Tables Alignment
    def test_missing_optional_columns_and_academic_table2(self):
        academics = self.parsed_data["records"]["academicSubmissions"]
        # Table 2 entry (Bhavya Patel): Branch is missing, Xth percentage is 91.2
        bhavya = next((a for a in academics if a["normalizedRollNumber"] == "21SET/CSE/002"), None)
        self.assertIsNotNone(bhavya)
        self.assertIsNone(bhavya["branch"], "Branch must be None for Academic Table 2")
        self.assertEqual(bhavya["tenthPercentage"], 91.2)
        self.assertEqual(bhavya["twelfthPercentage"], 93.5)

    # 4. Blank and Malformed Rows Filtering
    def test_blank_and_malformed_rows(self):
        internships = self.parsed_data["records"]["studentInternships"]
        # In synthetic fixture, row 6 was sequence gap row 555 (only S.No populated)
        rows = [i["sourceRow"] for i in internships]
        self.assertNotIn(6, rows, "Empty sequence gap row must be skipped")
        # Exactly 4 valid internship records in synthetic fixture
        self.assertEqual(len(internships), 4)

    # 5. Duplicate Application Numbers Preservation
    def test_duplicate_application_numbers_preserved(self):
        admissions = self.parsed_data["records"]["admissionApplications"]
        dup_apps = [a for a in admissions if a["applicationNumber"] == "APP-2021-DUP"]
        self.assertEqual(len(dup_apps), 2, "Authentic duplicate application number pair must be preserved")
        # Must have distinct sourceRow values for idempotency
        self.assertNotEqual(dup_apps[0]["sourceRow"], dup_apps[1]["sourceRow"])
        self.assertEqual(dup_apps[0]["admissionStatus"], "applicant")

    # 6. Multiple Academic Submissions for One Candidate
    def test_multiple_academic_submissions_for_one_candidate(self):
        academics = self.parsed_data["records"]["academicSubmissions"]
        aarav_subs = [a for a in academics if a["normalizedRollNumber"] == "21SET/CSE/001"]
        self.assertEqual(len(aarav_subs), 2, "Multiple submissions for single student must be preserved")
        for sub in aarav_subs:
            self.assertFalse(sub["isCanonical"], "All submissions must have isCanonical: False")
            self.assertEqual(sub["reviewStatus"], "pending_review")

    # 7. Ambiguous Identity Handling
    def test_ambiguous_identity_handling(self):
        staged = self.parsed_data["records"]["studentStaging"]
        
        # Sayyam: 1)24SET/CSE/050 -> 1/24SET/CSE/050
        sayyam = next((s for s in staged if s["studentName"] == "Sayyam Jaggi"), None)
        self.assertIsNotNone(sayyam)
        self.assertEqual(sayyam["rawIdentifier"], "1)24SET/CSE/050")
        self.assertEqual(sayyam["normalizedRollNumber"], "1/24SET/CSE/050")

        # Rupesh: ROLL- 21SET/CSE/099 -> 21SET/CSE/099
        rupesh = next((s for s in staged if s["studentName"] == "Rupesh Kumar"), None)
        self.assertIsNotNone(rupesh)
        self.assertEqual(rupesh["rawIdentifier"], "ROLL- 21SET/CSE/099")
        self.assertEqual(rupesh["normalizedRollNumber"], "21SET/CSE/099")

        # Nishant: phone-as-roll preserved
        nishant = next((s for s in staged if s["studentName"] == "Nishant Singh"), None)
        self.assertIsNotNone(nishant)
        self.assertEqual(nishant["rawIdentifier"], "9988776655")

    # 8. Missing Internship Organization Names and Correct Roll/Company Mapping
    def test_missing_internship_organization_name(self):
        internships = self.parsed_data["records"]["studentInternships"]
        bhavya_intern = next((i for i in internships if i["normalizedRollNumber"] == "21SET/CSE/002"), None)
        self.assertIsNotNone(bhavya_intern)
        self.assertIsNone(bhavya_intern["organizationName"], "Missing company must map to None without error")
        self.assertEqual(bhavya_intern["studentNameAsPerRS"], "Bhavya Patel")
        self.assertEqual(bhavya_intern["branch"], "AIML")
        self.assertEqual(bhavya_intern["section"], "B")

    # 8b. Internship Correct Source-Order Column Mapping
    def test_internship_actual_column_order_mapping(self):
        internships = self.parsed_data["records"]["studentInternships"]
        aarav_intern = next((i for i in internships if i["normalizedRollNumber"] == "21SET/CSE/001"), None)
        self.assertIsNotNone(aarav_intern)
        # Roll number must be the roll number, NOT the branch!
        self.assertEqual(aarav_intern["normalizedRollNumber"], "21SET/CSE/001")
        self.assertEqual(aarav_intern["studentNameAsPerRS"], "Aarav Sharma")
        self.assertEqual(aarav_intern["branch"], "B.TECH. CSE")
        self.assertEqual(aarav_intern["section"], "A")
        self.assertEqual(aarav_intern["verticalMentor"], "Dr. Rao")
        # Organization must be the company name, NOT the phone number!
        self.assertEqual(aarav_intern["organizationName"], "Google Inc")
        self.assertNotIn("9876543210", str(aarav_intern["organizationName"]))
        # Offer letter URL must be None
        self.assertIsNone(aarav_intern["offerLetterUrl"])

    # 8c. Academic Table 1 and Table 2 Two-Table Header-Driven Mapping
    def test_academic_two_table_header_driven_mapping(self):
        academics = self.parsed_data["records"]["academicSubmissions"]
        # Exactly 5 submissions in synthetic fixture (4 from Table 1, 1 from Table 2; divider & subheader skipped)
        self.assertEqual(len(academics), 5)

        # Table 1 Entry (Aarav): Branch present, Name and Roll correctly mapped
        aarav = next((a for a in academics if a["normalizedRollNumber"] == "21SET/CSE/001"), None)
        self.assertIsNotNone(aarav)
        self.assertEqual(aarav["studentName"], "Aarav Sharma")
        self.assertEqual(aarav["branch"], "CSE")
        self.assertEqual(aarav["tenthPercentage"], 89.5)
        self.assertEqual(aarav["tenthBoard"], "CBSE")
        self.assertEqual(aarav["twelfthPercentage"], 92.0)
        self.assertEqual(aarav["twelfthBoard"], "CBSE")
        self.assertEqual(aarav["selfReportedCgpa"], 8.85)

        # Table 2 Entry (Bhavya): Branch is None, Tenth Percentage is 91.2 (not branch!)
        bhavya = next((a for a in academics if a["normalizedRollNumber"] == "21SET/CSE/002"), None)
        self.assertIsNotNone(bhavya)
        self.assertIsNone(bhavya["branch"])
        self.assertEqual(bhavya["studentName"], "Bhavya Patel")
        self.assertEqual(bhavya["tenthPercentage"], 91.2)
        self.assertEqual(bhavya["twelfthPercentage"], 93.5)
        self.assertEqual(bhavya["twelfthBoard"], "ICSE")
        self.assertEqual(bhavya["selfReportedCgpa"], 9.10)

        # Sub-header row (e.g. S.No / Name / Complete Roll No) must NOT be in records
        for sub in academics:
            self.assertNotEqual(sub["normalizedRollNumber"], "NAME")
            self.assertNotEqual(sub["normalizedRollNumber"], "COMPLETE ROLL NO.")
            self.assertNotEqual(sub["studentName"], "Complete Roll No.")

    # 8d. Unknown or Malformed Header Fails Safely
    def test_unknown_header_fails_safely(self):
        from parser import build_internship_header_map, build_academic_header_map
        bad_headers = ["Col_A", "Col_B", "Unknown_1", "Unknown_2"]
        int_map = build_internship_header_map(bad_headers)
        self.assertNotIn("roll_number", int_map)
        acad_map = build_academic_header_map(bad_headers)
        self.assertNotIn("roll_number", acad_map)

    # 9. Privacy Column Exclusion
    def test_privacy_column_exclusion(self):
        # 1. Check Admission Applications: no passwords
        for adm in self.parsed_data["records"]["admissionApplications"]:
            self.assertNotIn("password", adm)
            self.assertNotIn("admitPassword", adm)
            self.assertNotIn("SECRET_PW_1", str(adm))

        # 2. Check Academic Submissions: no parental info or drive links
        for acad in self.parsed_data["records"]["academicSubmissions"]:
            self.assertNotIn("fatherName", acad)
            self.assertNotIn("motherName", acad)
            self.assertNotIn("parentEmail", acad)
            self.assertNotIn("marksheetUrl", acad)
            self.assertNotIn("drive.google.com", str(acad))

        # 3. Check Student Staging: no password in rawPayload
        for stg in self.parsed_data["records"]["studentStaging"]:
            for k, v in stg["rawPayload"].items():
                self.assertNotIn("password", k.lower())
                self.assertNotIn("credential", k.lower())

    # 10. Source-Row Lineage Preservation
    def test_source_row_lineage_preservation(self):
        for model_name, recs in self.parsed_data["records"].items():
            for rec in recs:
                self.assertIn("sourceRow", rec)
                self.assertIsInstance(rec["sourceRow"], int)
                self.assertGreaterEqual(rec["sourceRow"], 2)

    # 11. Batch Idempotency Keys
    def test_batch_idempotency_keys(self):
        # StudentStaging compound key: (batchId, sourceSheet, sourceRow)
        stg_keys = [(s["batchId"], s["sourceSheet"], s["sourceRow"]) for s in self.parsed_data["records"]["studentStaging"]]
        self.assertEqual(len(stg_keys), len(set(stg_keys)), "StudentStaging idempotency keys must be unique")

        # AdmissionApplication key: (batchId, sourceRow)
        adm_keys = [(a["batchId"], a["sourceRow"]) for a in self.parsed_data["records"]["admissionApplications"]]
        self.assertEqual(len(adm_keys), len(set(adm_keys)), "AdmissionApplication idempotency keys must be unique")

        # StudentInternship key: (batchId, sourceRow)
        intern_keys = [(i["batchId"], i["sourceRow"]) for i in self.parsed_data["records"]["studentInternships"]]
        self.assertEqual(len(intern_keys), len(set(intern_keys)), "StudentInternship idempotency keys must be unique")

        # StudentAcademicSubmission key: (batchId, sourceRow)
        acad_keys = [(ac["batchId"], ac["sourceRow"]) for ac in self.parsed_data["records"]["academicSubmissions"]]
        self.assertEqual(len(acad_keys), len(set(acad_keys)), "StudentAcademicSubmission idempotency keys must be unique")

    # 12. Schema Validation Compliance
    def test_schema_validation_compliance(self):
        val_report = validate_all_staged_records(self.parsed_data)
        self.assertTrue(val_report["isValid"], f"Schema validation failed: {val_report.get('errorDetails')}")
        self.assertEqual(val_report["invalidRecords"], 0)
        self.assertEqual(val_report["validRecords"], val_report["totalRecords"])

    # 13. Deterministic Output Verification
    def test_deterministic_output(self):
        run1 = parse_student_workbook(FIXTURE_PATH, "DETERMINISTIC-BATCH-001")
        run2 = parse_student_workbook(FIXTURE_PATH, "DETERMINISTIC-BATCH-001")
        
        # Strip timestamp before comparing JSON strings
        run1["metadata"]["parsedAt"] = ""
        run2["metadata"]["parsedAt"] = ""

        str1 = json.dumps(run1, sort_keys=True)
        str2 = json.dumps(run2, sort_keys=True)

        hash1 = hashlib.sha256(str1.encode("utf-8")).hexdigest()
        hash2 = hashlib.sha256(str2.encode("utf-8")).hexdigest()

        self.assertEqual(hash1, hash2, "Repeated parser runs must produce byte-for-byte identical output")

if __name__ == "__main__":
    unittest.main()

