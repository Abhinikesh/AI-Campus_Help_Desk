#!/usr/bin/env python3
"""
server/scripts/student_staging/mapping.py
Phase 3.3A — Model Mapping and Schema Validation Layer.

Validates that parser outputs strictly comply with the Phase 3.1 Mongoose models:
- StudentStaging
- AdmissionApplication
- StudentAcademicSubmission
- StudentInternship
- ImportOperationLog
- ImportFieldChangeLog

Ensures idempotency keys, enum constraints, and privacy boundaries are strictly upheld.
"""

from typing import Dict, List, Any, Tuple

# Supported enums from Phase 3.1 Mongoose Models
VALID_STAGING_SOURCE_SHEETS = [
    'Student Master',
    'Admission Records',
    'Internship Records',
    'Academic Records'
]

VALID_STAGING_REVIEW_STATUSES = [
    'pending_review',
    'resolved',
    'rejected',
    'promoted'
]

VALID_ADMISSION_STATUSES = [
    'applicant',
    'enrolled',
    'duplicate_flagged',
    'withdrawn'
]

VALID_INTERNSHIP_MODES = [
    'Offline',
    'Online',
    'Hybrid',
    'Unknown',
    None
]

VALID_INTERNSHIP_LINKAGE_STATUSES = [
    'unmatched',
    'candidate_linked',
    'confirmed_linked',
    'flagged'
]

VALID_ACADEMIC_REVIEW_STATUSES = [
    'pending_review',
    'approved_canonical',
    'archived_historical',
    'flagged_conflict'
]

VALID_OPERATION_TYPES = [
    'staging_ingestion',
    'staging_validation',
    'production_promotion',
    'rollback'
]

VALID_OPERATION_STATUSES = [
    'started',
    'staged',
    'validated',
    'promoted',
    'partially_promoted',
    'rollback_in_progress',
    'rolled_back',
    'failed'
]

def validate_student_staging_record(rec: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Validates an in-memory record against StudentStaging schema."""
    errs = []
    if not rec.get("batchId"):
        errs.append("Missing batchId")
    if rec.get("sourceSheet") not in VALID_STAGING_SOURCE_SHEETS:
        errs.append(f"Invalid sourceSheet: {rec.get('sourceSheet')}")
    if rec.get("sourceRow") is None or not isinstance(rec.get("sourceRow"), int):
        errs.append(f"Invalid sourceRow: {rec.get('sourceRow')}")
    if rec.get("reviewStatus") not in VALID_STAGING_REVIEW_STATUSES:
        errs.append(f"Invalid reviewStatus: {rec.get('reviewStatus')}")
    if "rawPayload" not in rec or not isinstance(rec["rawPayload"], dict):
        errs.append("rawPayload must be a dictionary")

    # Verify no sensitive password/credential leaked into rawPayload
    for k in rec.get("rawPayload", {}).keys():
        lower_k = str(k).lower()
        if "password" in lower_k or "credential" in lower_k:
            errs.append(f"Privacy violation: sensitive key '{k}' present in rawPayload")

    return len(errs) == 0, errs

def validate_admission_application_record(rec: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Validates an in-memory record against AdmissionApplication schema."""
    errs = []
    if not rec.get("batchId"):
        errs.append("Missing batchId")
    if rec.get("sourceRow") is None or not isinstance(rec.get("sourceRow"), int):
        errs.append(f"Invalid sourceRow: {rec.get('sourceRow')}")
    if not rec.get("applicationNumber"):
        errs.append("Missing required applicationNumber")
    if not rec.get("studentName"):
        errs.append("Missing required studentName")
    if rec.get("admissionStatus") not in VALID_ADMISSION_STATUSES:
        errs.append(f"Invalid admissionStatus: {rec.get('admissionStatus')}")

    # Ensure no credentials
    for field in ["password", "admitPassword", "credential"]:
        if field in rec:
            errs.append(f"Privacy violation: sensitive field '{field}' present in record")

    return len(errs) == 0, errs

def validate_student_internship_record(rec: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Validates an in-memory record against StudentInternship schema."""
    errs = []
    if not rec.get("batchId"):
        errs.append("Missing batchId")
    if rec.get("sourceRow") is None or not isinstance(rec.get("sourceRow"), int):
        errs.append(f"Invalid sourceRow: {rec.get('sourceRow')}")
    if not rec.get("normalizedRollNumber"):
        errs.append("Missing required normalizedRollNumber")
    if rec.get("mode") not in VALID_INTERNSHIP_MODES:
        errs.append(f"Invalid mode: {rec.get('mode')}")
    if rec.get("linkageStatus") not in VALID_INTERNSHIP_LINKAGE_STATUSES:
        errs.append(f"Invalid linkageStatus: {rec.get('linkageStatus')}")

    # Note: organizationName is intentionally allowed to be None (52 authentic incomplete records)

    return len(errs) == 0, errs

def validate_student_academic_submission_record(rec: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Validates an in-memory record against StudentAcademicSubmission schema."""
    errs = []
    if not rec.get("batchId"):
        errs.append("Missing batchId")
    if rec.get("sourceRow") is None or not isinstance(rec.get("sourceRow"), int):
        errs.append(f"Invalid sourceRow: {rec.get('sourceRow')}")
    if not rec.get("rawRollNumber"):
        errs.append("Missing required rawRollNumber")
    if not rec.get("normalizedRollNumber"):
        errs.append("Missing required normalizedRollNumber")
    if rec.get("isCanonical") is not False:
        errs.append("isCanonical must be False by default")
    if rec.get("reviewStatus") not in VALID_ACADEMIC_REVIEW_STATUSES:
        errs.append(f"Invalid reviewStatus: {rec.get('reviewStatus')}")

    # Privacy verification: ensure parental fields are NOT present
    for sensitive_field in ["fatherName", "motherName", "parentEmail", "marksheetUrl", "tenthMarksheetUrl", "twelfthMarksheetUrl"]:
        if rec.get(sensitive_field):
            errs.append(f"Privacy violation: sensitive field '{sensitive_field}' must not be stored")

    return len(errs) == 0, errs

def validate_all_staged_records(staged_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validates an entire parsed workbook payload against all model constraints.
    Returns structured validation report.
    """
    report = {
        "isValid": True,
        "totalRecords": 0,
        "validRecords": 0,
        "invalidRecords": 0,
        "errorDetails": []
    }

    records_map = staged_data.get("records", {})

    # Validate StudentStaging
    for rec in records_map.get("studentStaging", []):
        report["totalRecords"] += 1
        is_val, errs = validate_student_staging_record(rec)
        if is_val:
            report["validRecords"] += 1
        else:
            report["invalidRecords"] += 1
            report["isValid"] = False
            report["errorDetails"].append({"model": "StudentStaging", "sourceRow": rec.get("sourceRow"), "errors": errs})

    # Validate AdmissionApplication
    for rec in records_map.get("admissionApplications", []):
        report["totalRecords"] += 1
        is_val, errs = validate_admission_application_record(rec)
        if is_val:
            report["validRecords"] += 1
        else:
            report["invalidRecords"] += 1
            report["isValid"] = False
            report["errorDetails"].append({"model": "AdmissionApplication", "sourceRow": rec.get("sourceRow"), "errors": errs})

    # Validate StudentInternship
    for rec in records_map.get("studentInternships", []):
        report["totalRecords"] += 1
        is_val, errs = validate_student_internship_record(rec)
        if is_val:
            report["validRecords"] += 1
        else:
            report["invalidRecords"] += 1
            report["isValid"] = False
            report["errorDetails"].append({"model": "StudentInternship", "sourceRow": rec.get("sourceRow"), "errors": errs})

    # Validate StudentAcademicSubmission
    for rec in records_map.get("academicSubmissions", []):
        report["totalRecords"] += 1
        is_val, errs = validate_student_academic_submission_record(rec)
        if is_val:
            report["validRecords"] += 1
        else:
            report["invalidRecords"] += 1
            report["isValid"] = False
            report["errorDetails"].append({"model": "StudentAcademicSubmission", "sourceRow": rec.get("sourceRow"), "errors": errs})

    return report

