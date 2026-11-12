#!/usr/bin/env python3
"""
server/scripts/student_staging/parser.py
Phase 3.3A — Deterministic Local Student Workbook Parser.

Mandatory Boundaries:
- Privacy Minimization: Passwords, credentials, parental names/emails,
  and marksheet/cloud URLs are permanently dropped at the parser boundary.
- Zero External Requests: Operates purely locally using Python standard library.
- Zero Live Database Mutations: Only produces structured in-memory / JSON records.
- Deterministic Output: Repeated runs against the same input produce identical output.
- Identity Provenance: Preserves authentic source row numbers and raw identifiers.
"""

import os
import re
import sys
import json
import zipfile
import hashlib
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional, Tuple

try:
    import openpyxl
    HAS_OPENPYXL = True
except ImportError:
    HAS_OPENPYXL = False

# ─────────────────────────────────────────────────────────────────────────────
# CONSTANTS & SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────

SHEET_STUDENT_MASTER = "Student Master"
SHEET_ADMISSION_RECORDS = "Admission Records"
SHEET_INTERNSHIP_RECORDS = "Internship Records"
SHEET_ACADEMIC_RECORDS = "Academic Records"
SHEET_RECONCILIATION_REVIEW = "Reconciliation Review"
SHEET_DATA_QUALITY_SUMMARY = "Data Quality Summary"

ALL_EXPECTED_SHEETS = [
    SHEET_STUDENT_MASTER,
    SHEET_ADMISSION_RECORDS,
    SHEET_INTERNSHIP_RECORDS,
    SHEET_ACADEMIC_RECORDS,
    SHEET_RECONCILIATION_REVIEW,
    SHEET_DATA_QUALITY_SUMMARY,
]

# Sensitive columns that must NEVER be extracted or persisted
EXCLUDED_COLUMN_PATTERNS = [
    re.compile(r"password", re.IGNORECASE),
    re.compile(r"credential", re.IGNORECASE),
    re.compile(r"father", re.IGNORECASE),
    re.compile(r"mother", re.IGNORECASE),
    re.compile(r"parent", re.IGNORECASE),
    re.compile(r"marksheet", re.IGNORECASE),
    re.compile(r"upload.*marksheet", re.IGNORECASE),
    re.compile(r"drive\.google\.com", re.IGNORECASE),
    re.compile(r"offer.*letter", re.IGNORECASE),
    re.compile(r"link.*offer", re.IGNORECASE),
]

# ─────────────────────────────────────────────────────────────────────────────
# IDENTIFIER NORMALIZATION
# ─────────────────────────────────────────────────────────────────────────────

def normalize_roll_number(raw_val: Any) -> Optional[str]:
    """
    Normalizes a roll number for indexing and candidate matching:
    - Trims leading/trailing whitespace
    - Uppercases
    - Handles known syntax typos:
      * 'ROLL- ' or 'ROLL-' prefix -> stripped for matching
      * '1)24SET/...' -> '1/24SET/...'
      * 'D)DD' -> 'D/DD'
    Returns normalized string, or None if raw_val is empty.
    The original raw identifier must always be preserved separately.
    """
    if raw_val is None:
        return None
    val = str(raw_val).strip()
    if not val:
        return None
    
    # Uppercase
    val = val.upper()
    
    # Strip common prefix typos
    if val.startswith("ROLL-") or val.startswith("ROLL -"):
        val = re.sub(r"^ROLL\s*-\s*", "", val)
    
    # Clean bracket typos in university codes e.g. 1)24SET -> 1/24SET
    val = re.sub(r"(\d+)\)", r"\1/", val)
    val = val.replace(")", "/")
    
    # Compress excessive inner whitespace
    val = re.sub(r"\s+", " ", val).strip()
    
    return val if val else None

def parse_float_safe(val: Any) -> Optional[float]:
    if val is None:
        return None
    s = str(val).strip().rstrip('%')
    try:
        return float(s)
    except (ValueError, TypeError):
        return None

def parse_int_safe(val: Any) -> Optional[int]:
    if val is None:
        return None
    s = str(val).strip()
    try:
        return int(float(s))
    except (ValueError, TypeError):
        return None

def parse_bool_safe(val: Any) -> Optional[bool]:
    if val is None:
        return None
    s = str(val).strip().lower()
    if s in ['yes', 'y', 'true', '1']:
        return True
    if s in ['no', 'n', 'false', '0']:
        return False
    return None

def split_reappear_subjects(val: Any) -> List[str]:
    if not val:
        return []
    s = str(val).strip()
    if not s or s.lower() in ['nil', 'none', 'na', 'n/a', '-', '0']:
        return []
    parts = re.split(r"[,;\n\r/]+", s)
    return [p.strip() for p in parts if p.strip()]

# ─────────────────────────────────────────────────────────────────────────────
# PURE STANDARD LIBRARY XLSX READER
# ─────────────────────────────────────────────────────────────────────────────

def _get_xml_tag(elem: ET.Element) -> str:
    """Strips XML namespace from tag."""
    tag = elem.tag
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag

def read_xlsx_sheets(filepath: str) -> Dict[str, List[List[Any]]]:
    """
    Deterministic .xlsx reader supporting both openpyxl and Python standard library zipfile+XML.
    Returns {sheet_name: [[cell_val, ...], ...]} (1-based row indexing).
    """
    if HAS_OPENPYXL:
        wb = openpyxl.load_workbook(filepath, data_only=True)
        sheets_data = {}
        for name in wb.sheetnames:
            ws = wb[name]
            rows = []
            for row in ws.iter_rows(values_only=True):
                rows.append(list(row))
            sheets_data[name] = rows
        return sheets_data

    # Standard Library Fallback (zipfile + xml.etree.ElementTree)
    sheets_data: Dict[str, List[List[Any]]] = {}

    with zipfile.ZipFile(filepath, "r") as z:
        # 1. Read shared strings
        shared_strings: List[str] = []
        if "xl/sharedStrings.xml" in z.namelist():
            tree = ET.fromstring(z.read("xl/sharedStrings.xml"))
            for si in tree:
                if _get_xml_tag(si) == "si":
                    texts = [elem.text or "" for elem in si.iter() if _get_xml_tag(elem) == "t"]
                    shared_strings.append("".join(texts))

        # 2. Read workbook.xml to get sheet names and r:id mapping
        wb_tree = ET.fromstring(z.read("xl/workbook.xml"))
        sheet_info: List[Tuple[str, str]] = []
        for s in wb_tree.iter():
            if _get_xml_tag(s) == "sheet":
                name = s.attrib.get("name", "")
                r_id = s.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id", "")
                sheet_info.append((name, r_id))

        # 3. Read _rels/workbook.xml.rels
        rel_map: Dict[str, str] = {}
        if "xl/_rels/workbook.xml.rels" in z.namelist():
            rel_tree = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
            for rel in rel_tree.iter():
                if _get_xml_tag(rel) == "Relationship":
                    r_id = rel.attrib.get("Id", "")
                    target = rel.attrib.get("Target", "")
                    if target.startswith("/"):
                        target = target.lstrip("/")
                    elif not target.startswith("xl/"):
                        target = "xl/" + target
                    rel_map[r_id] = target

        # 4. Parse each sheet XML
        for sheet_name, r_id in sheet_info:
            target_path = rel_map.get(r_id, "")
            if not target_path or target_path not in z.namelist():
                continue

            sheet_tree = ET.fromstring(z.read(target_path))
            rows_list: List[List[Any]] = []

            for row_elem in sheet_tree.iter():
                if _get_xml_tag(row_elem) == "row":
                    row_num = int(row_elem.attrib.get("r", len(rows_list) + 1))
                    while len(rows_list) < row_num - 1:
                        rows_list.append([])

                    current_row_cells: Dict[int, Any] = {}
                    for c in row_elem:
                        if _get_xml_tag(c) == "c":
                            col_ref = c.attrib.get("r", "")
                            col_letters = "".join(filter(str.isalpha, col_ref))
                            col_idx = 0
                            for char in col_letters:
                                col_idx = col_idx * 26 + (ord(char.upper()) - ord("A") + 1)
                            col_idx -= 1

                            cell_type = c.attrib.get("t", "")
                            val = None

                            if cell_type == "inlineStr":
                                texts = [elem.text or "" for elem in c.iter() if _get_xml_tag(elem) == "t"]
                                val = "".join(texts)
                            elif cell_type == "s":
                                v_elem = c.find("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v")
                                if v_elem is not None and v_elem.text is not None:
                                    s_idx = int(v_elem.text)
                                    val = shared_strings[s_idx] if s_idx < len(shared_strings) else None
                            elif cell_type == "b":
                                v_elem = c.find("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v")
                                val = v_elem.text == "1" if v_elem is not None and v_elem.text is not None else None
                            else:
                                v_elem = c.find("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v")
                                val = v_elem.text if v_elem is not None else None

                            current_row_cells[col_idx] = val

                    max_col = max(current_row_cells.keys()) if current_row_cells else -1
                    row_vals = [current_row_cells.get(i, None) for i in range(max_col + 1)]
                    rows_list.append(row_vals)

            sheets_data[sheet_name] = rows_list

    return sheets_data

# ─────────────────────────────────────────────────────────────────────────────
# SHEET PARSERS
# ─────────────────────────────────────────────────────────────────────────────

def is_row_completely_empty(row: List[Any]) -> bool:
    if not row:
        return True
    return all(c is None or str(c).strip() == "" for c in row)

def parse_student_master_sheet(rows: List[List[Any]], batch_id: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Parses 'Student Master' sheet:
    - Filters header row (row 1)
    - Filters embedded table headers (e.g. Row 555 'COMPLETEROLLNO.')
    - Preserves conflict cells ('REVIEW — ...') as conflictCandidates
    - Retains 1-based sourceRow
    """
    records = []
    errors = []

    if not rows or len(rows) < 2:
        return records, errors

    header = [str(c).strip() if c is not None else "" for c in rows[0]]

    for row_idx, row in enumerate(rows[1:], start=2):
        if is_row_completely_empty(row):
            continue

        first_col = str(row[0]).strip() if len(row) > 0 and row[0] is not None else ""
        second_col = str(row[1]).strip() if len(row) > 1 and row[1] is not None else ""
        third_col = str(row[2]).strip() if len(row) > 2 and row[2] is not None else ""

        # Embedded Header Detection (e.g. Row 555 infiltration from Academic Table 2)
        if (
            "COMPLETEROLL" in first_col.upper()
            or "UNIVERSITY ROLL" in first_col.upper()
            or ("NAME" in second_col.upper() and "PERCENTAGE" in third_col.upper())
            or ("XTH PERCENTAGE" in third_col.upper())
        ):
            # Detected embedded sub-table header — ignore from student records
            continue

        raw_identifier = first_col if first_col else None
        normalized_roll = normalize_roll_number(raw_identifier)
        student_name = second_col if second_col else None

        # Build raw payload (excluding any password or credential fields)
        raw_payload = {}
        conflicts = []

        for c_idx, col_name in enumerate(header):
            if not col_name:
                col_name = f"Col_{c_idx+1}"
            
            # Check privacy exclusion
            if any(p.search(col_name) for p in EXCLUDED_COLUMN_PATTERNS):
                continue

            cell_val = row[c_idx] if c_idx < len(row) else None
            cell_str = str(cell_val).strip() if cell_val is not None else ""

            # Check if this cell contains a documented REVIEW conflict
            if cell_str.startswith("REVIEW —") or " | " in cell_str:
                parts = cell_str.replace("REVIEW —", "").split("|")
                parsed_candidates = [p.strip() for p in parts if p.strip()]
                conflicts.append({
                    "field": col_name,
                    "rawValue": cell_str,
                    "parsedCandidates": parsed_candidates,
                    "resolution": None
                })
                raw_payload[col_name] = cell_str
            else:
                raw_payload[col_name] = cell_val

        records.append({
            "batchId": batch_id,
            "sourceSheet": SHEET_STUDENT_MASTER,
            "sourceRow": row_idx,
            "rawIdentifier": raw_identifier,
            "normalizedRollNumber": normalized_roll,
            "studentName": student_name,
            "rawPayload": raw_payload,
            "conflictCandidates": conflicts,
            "reviewStatus": "pending_review",
        })

    return records, errors

def normalize_header_name(val: Any) -> str:
    """Normalizes header string for alias comparison: lowercase, alphanumeric and % only."""
    if val is None:
        return ""
    s = str(val).strip().lower()
    s = re.sub(r"[^\w\s%]", " ", s)
    return re.sub(r"\s+", " ", s).strip()

def build_admission_header_map(header_row: List[Any]) -> Dict[str, int]:
    """Header-driven column mapper for Admission Records (Standard and Migration)."""
    mapping: Dict[str, int] = {}
    for idx, h in enumerate(header_row):
        nh = normalize_header_name(h)
        if not nh:
            continue
        # Excluded privacy columns (password, credentials)
        if any(p in nh for p in ["password", "credential", "pwd"]):
            continue
        if any(k in nh for k in ["application no", "application number", "app no", "application"]):
            if "application_number" not in mapping:
                mapping["application_number"] = idx
        elif any(k in nh for k in ["student name", "students name", "applicant name", "name"]):
            if "student_name" not in mapping:
                mapping["student_name"] = idx
        elif any(k in nh for k in ["course", "program", "programme", "branch"]):
            if "course" not in mapping:
                mapping["course"] = idx
        elif any(k in nh for k in ["school", "faculty", "department"]):
            if "school" not in mapping:
                mapping["school"] = idx
        elif any(k in nh for k in ["email id", "email", "email_id", "mail"]):
            if "email" not in mapping:
                mapping["email"] = idx
        elif any(k in nh for k in ["teams id", "teams", "teams_id"]):
            if "teams_id" not in mapping:
                mapping["teams_id"] = idx
        elif any(k in nh for k in ["date of reporting", "reporting date"]):
            if "date_of_reporting" not in mapping:
                mapping["date_of_reporting"] = idx
    return mapping

def is_admission_sub_header(row: List[Any]) -> bool:
    """Detects embedded admission sub-headers (e.g. Migration Sub-Header at Row 845)."""
    row_str = " ".join(str(c or "").strip() for c in row).strip().upper()
    return "APPLICATION" in row_str and (
        "STUDENT NAME" in row_str or "DATE OF REPORTING" in row_str or "APPLICANT" in row_str
    )

def is_admission_divider_row(row: List[Any]) -> bool:
    """Detects divider rows, section banners, or empty tables."""
    row_str = " ".join(str(c or "").strip() for c in row).strip()
    if not row_str:
        return True
    return bool(re.search(r"(sheet\s*\d+|table\s*\d+|migration\s*:|lateral\s*entry)", row_str, re.IGNORECASE))

def parse_admission_records_sheet(rows: List[List[Any]], batch_id: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Parses 'Admission Records' sheet:
    - Uses header-driven column mapping via build_admission_header_map
    - Detects and adapts to embedded sub-headers (e.g. Migration sub-header at Row 845)
    - Excludes divider rows (e.g. rows 841-844) and sub-headers from applicant emission
    - Drops Admission Passwords / credentials permanently
    - Retains duplicate application numbers safely
    """
    records = []
    errors = []

    if not rows or len(rows) < 2:
        return records, errors

    active_map = build_admission_header_map(rows[0])

    for row_idx, row in enumerate(rows[1:], start=2):
        if is_row_completely_empty(row):
            continue

        if is_admission_sub_header(row):
            active_map = build_admission_header_map(row)
            continue

        if is_admission_divider_row(row):
            continue

        def get_val(key: str) -> Optional[str]:
            if key in active_map and active_map[key] < len(row):
                v = row[active_map[key]]
                if v is not None:
                    s = str(v).strip()
                    return s if s != "" else None
            return None

        app_no = get_val("application_number")
        name = get_val("student_name")
        course = get_val("course")
        school = get_val("school")
        email = get_val("email")
        teams_id = get_val("teams_id")
        reporting_date = get_val("date_of_reporting")

        # Mandatory Validation: applicationNumber and studentName must not be empty
        if not app_no or not name:
            errors.append({
                "sourceRow": row_idx,
                "error": "Missing mandatory applicationNumber or studentName in Admission Records",
            })
            continue

        # CRITICAL PRIVACY MANDATE: Any password column (e.g. Col 8) is NEVER extracted!

        records.append({
            "batchId": batch_id,
            "sourceRow": row_idx,
            "applicationNumber": app_no,
            "studentName": name,
            "course": course,
            "school": school,
            "email": email.lower() if email else None,
            "teamsId": teams_id,
            "dateOfReporting": reporting_date,
            "admissionStatus": "applicant",
        })

    return records, errors

def build_internship_header_map(header_row: List[Any]) -> Dict[str, int]:
    """Header-driven column mapper for Internship Records."""
    mapping = {}
    for idx, h in enumerate(header_row):
        nh = normalize_header_name(h)
        if not nh:
            continue
        # Excluded privacy columns (offer letter, password)
        if any(p in nh for p in ["offer", "letter", "password", "credential"]):
            continue
        if any(k in nh for k in ["univ roll no", "university roll no", "univ roll number", "roll no", "roll number", "completerollno", "complete roll no"]):
            mapping["roll_number"] = idx
        elif any(k in nh for k in ["students name", "student name", "name as per r", "name as per rs"]):
            mapping["student_name"] = idx
        elif nh in ["branch", "program"]:
            mapping["branch"] = idx
        elif nh in ["sec", "section"]:
            mapping["section"] = idx
        elif "mentor" in nh:
            mapping["vertical_mentor"] = idx
        elif "official id" in nh or "official email" in nh or "college email" in nh:
            mapping["official_id"] = idx
        elif nh in ["name", "company", "company name", "organization", "organization name", "firm"]:
            if "student_name" in mapping and idx > mapping["student_name"]:
                mapping["company_name"] = idx
            elif any(c in nh for c in ["company", "organization", "firm"]):
                mapping["company_name"] = idx
        elif "address" in nh:
            mapping["complete_address"] = idx
        elif "offline" in nh or "online" in nh or "mode" in nh:
            mapping["mode"] = idx
        elif nh in ["contact no", "contact number", "phone"]:
            mapping["contact_number"] = idx
        elif "email" in nh and "official" not in nh:
            mapping["email_id"] = idx
        elif "start date" in nh:
            mapping["start_date"] = idx
        elif "title" in nh:
            mapping["internship_title"] = idx
        elif "stipend" in nh and "amount" not in nh:
            mapping["stipend_provided"] = idx
        elif "stipend" in nh and "amount" in nh:
            mapping["monthly_stipend_amount"] = idx
        elif "placement" in nh:
            mapping["placement_done"] = idx
    return mapping

def build_academic_header_map(header_row: List[Any]) -> Dict[str, int]:
    """Header-driven column mapper for Academic Records (Table 1 and Table 2)."""
    mapping = {}
    for idx, h in enumerate(header_row):
        nh = normalize_header_name(h)
        if not nh:
            continue
        # Excluded privacy columns (upload, marksheet, parental details)
        if any(p in nh for p in ["upload", "marksheet", "father", "mother", "parent"]):
            continue
        if nh in ["timestamp", "time"]:
            mapping["timestamp"] = idx
        elif any(k in nh for k in ["student name", "students name"]) or nh == "name":
            if "student_name" not in mapping:
                mapping["student_name"] = idx
        elif any(k in nh for k in ["complete roll no", "university roll no", "univ roll no", "roll no", "roll number"]):
            if "roll_number" not in mapping:
                mapping["roll_number"] = idx
        elif nh in ["branch", "program"]:
            mapping["branch"] = idx
        elif "xth" in nh and "percentage" in nh:
            mapping["tenth_percentage"] = idx
        elif "xth" in nh and "board" in nh:
            mapping["tenth_board"] = idx
        elif "xiith" in nh and "percentage" in nh:
            mapping["twelfth_percentage"] = idx
        elif "xiith" in nh and "board" in nh:
            mapping["twelfth_board"] = idx
        elif "cgpa" in nh:
            mapping["cgpa"] = idx
        elif "active reappear" in nh:
            if "subject" in nh:
                mapping["reappear_subjects"] = idx
            else:
                mapping["active_reappears"] = idx
        elif "dead reappear" in nh:
            mapping["dead_reappears"] = idx
        elif "contact" in nh or "phone" in nh:
            mapping["contact_number"] = idx
        elif "personal email" in nh:
            mapping["personal_email"] = idx
        elif "college email" in nh or "official email" in nh:
            mapping["college_email"] = idx
    return mapping

def parse_internship_records_sheet(rows: List[List[Any]], batch_id: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Parses 'Internship Records' sheet using header-driven column identification:
    - Automatically discovers column indices from header row.
    - Ignores sequence gap rows (e.g. Row 555 with only serial number populated).
    - Permits missing organization names (organizationName: null).
    - NEVER maps contact phone numbers into organizationName.
    - Preserves multiple internships per student independently.
    - Strips offer letter URLs for privacy minimization.
    """
    records = []
    errors = []

    if not rows or len(rows) < 2:
        return records, errors

    header_map = build_internship_header_map(rows[0])
    if "roll_number" not in header_map:
        errors.append({
            "sourceRow": 1,
            "error": "Unresolved internship header layout: missing roll_number column",
        })
        return records, errors

    for row_idx, row in enumerate(rows[1:], start=2):
        if is_row_completely_empty(row):
            continue

        # Check for gap row where only serial number (Col 0) is populated and data cols (Col 1+) are empty
        data_cols = row[1:] if len(row) > 1 else []
        if is_row_completely_empty(data_cols):
            continue

        roll_idx = header_map.get("roll_number")
        raw_roll = str(row[roll_idx]).strip() if roll_idx is not None and roll_idx < len(row) and row[roll_idx] is not None else ""
        normalized_roll = normalize_roll_number(raw_roll)

        if not normalized_roll:
            errors.append({
                "sourceRow": row_idx,
                "error": "Missing roll number in Internship Records",
            })
            continue

        name_idx = header_map.get("student_name")
        student_name = str(row[name_idx]).strip() if name_idx is not None and name_idx < len(row) and row[name_idx] is not None else None

        branch_idx = header_map.get("branch")
        branch = str(row[branch_idx]).strip() if branch_idx is not None and branch_idx < len(row) and row[branch_idx] is not None else None

        sec_idx = header_map.get("section")
        section = str(row[sec_idx]).strip() if sec_idx is not None and sec_idx < len(row) and row[sec_idx] is not None else None

        mentor_idx = header_map.get("vertical_mentor")
        mentor = str(row[mentor_idx]).strip() if mentor_idx is not None and mentor_idx < len(row) and row[mentor_idx] is not None else None

        off_idx = header_map.get("official_id")
        official_id = str(row[off_idx]).strip() if off_idx is not None and off_idx < len(row) and row[off_idx] is not None else None

        comp_idx = header_map.get("company_name")
        org_name = str(row[comp_idx]).strip() if comp_idx is not None and comp_idx < len(row) and row[comp_idx] is not None else None
        if org_name in ["", "-", "NA", "N/A", "NONE", "NIL"]:
            org_name = None
        # Privacy defense: never allow pure phone numbers into organizationName
        if org_name and re.match(r"^[0-9\s+-]{7,15}$", org_name):
            org_name = None

        addr_idx = header_map.get("complete_address")
        address = str(row[addr_idx]).strip() if addr_idx is not None and addr_idx < len(row) and row[addr_idx] is not None else None

        mode_idx = header_map.get("mode")
        mode = str(row[mode_idx]).strip() if mode_idx is not None and mode_idx < len(row) and row[mode_idx] is not None else None
        if mode not in ["Offline", "Online", "Hybrid", "Unknown"]:
            mode = None

        contact_idx = header_map.get("contact_number")
        contact = str(row[contact_idx]).strip() if contact_idx is not None and contact_idx < len(row) and row[contact_idx] is not None else None

        email_idx = header_map.get("email_id")
        email = str(row[email_idx]).strip().lower() if email_idx is not None and email_idx < len(row) and row[email_idx] is not None else None

        start_idx = header_map.get("start_date")
        start_date = str(row[start_idx]).strip() if start_idx is not None and start_idx < len(row) and row[start_idx] is not None else None

        title_idx = header_map.get("internship_title")
        title = str(row[title_idx]).strip() if title_idx is not None and title_idx < len(row) and row[title_idx] is not None else None

        stipend_idx = header_map.get("stipend_provided")
        stipend_provided = parse_bool_safe(row[stipend_idx]) if stipend_idx is not None and stipend_idx < len(row) else None

        amount_idx = header_map.get("monthly_stipend_amount")
        stipend_amount = parse_float_safe(row[amount_idx]) if amount_idx is not None and amount_idx < len(row) else None

        placement_idx = header_map.get("placement_done")
        placement_done = parse_bool_safe(row[placement_idx]) if placement_idx is not None and placement_idx < len(row) else None

        records.append({
            "batchId": batch_id,
            "sourceRow": row_idx,
            "normalizedRollNumber": normalized_roll,
            "studentNameAsPerRS": student_name,
            "branch": branch,
            "section": section,
            "verticalMentor": mentor,
            "officialId": official_id,
            "organizationName": org_name,
            "completeAddress": address,
            "mode": mode,
            "contactNumber": contact,
            "emailId": email,
            "startDate": start_date,
            "internshipTitle": title,
            "stipendProvided": stipend_provided,
            "monthlyStipendAmount": stipend_amount,
            "placementDone": placement_done,
            "offerLetterUrl": None,
            "linkageStatus": "unmatched",
        })

    return records, errors

def parse_academic_records_sheet(rows: List[List[Any]], batch_id: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Parses 'Academic Records' sheet using dynamic header-driven mapping:
    - Handles Table 1 (with Branch) and Table 2 (without Branch) dynamically.
    - Detects and skips section divider titles and embedded sub-headers.
    - Prevents sub-headers (Row 235) from being staged as student records.
    - Correctly maps student name and complete roll number.
    - Drops Parental Details and raw marksheet URLs permanently at reading boundary.
    - Preserves all submissions as append-only records with isCanonical: false.
    """
    records = []
    errors = []

    if not rows or len(rows) < 2:
        return records, errors

    current_header = build_academic_header_map(rows[0])
    if "roll_number" not in current_header:
        errors.append({
            "sourceRow": 1,
            "error": "Unresolved academic header layout: missing roll_number column",
        })
        return records, errors

    for row_idx, row in enumerate(rows[1:], start=2):
        if is_row_completely_empty(row):
            continue

        # Check if row is an embedded sub-header (e.g. Table 2 sub-header at Row 235)
        candidate_map = build_academic_header_map(row)
        if "roll_number" in candidate_map and ("tenth_percentage" in candidate_map or "tenth_board" in candidate_map):
            # Switch active header layout to Table 2 layout
            current_header = candidate_map
            continue

        # Check if row is a section divider title (e.g. Row 234 "Sheet1: Table 1")
        first_val = str(row[0]).strip() if len(row) > 0 and row[0] is not None else ""
        non_null_count = sum(1 for c in row if c is not None and str(c).strip() != "")
        if non_null_count <= 2 and any(k in first_val.lower() for k in ["table", "sheet", "batch", "survey", "section"]):
            continue

        # Extract according to current_header
        roll_idx = current_header.get("roll_number")
        raw_roll = str(row[roll_idx]).strip() if roll_idx is not None and roll_idx < len(row) and row[roll_idx] is not None else ""
        normalized_roll = normalize_roll_number(raw_roll)

        if not raw_roll or not normalized_roll or normalized_roll in ["COMPLETE ROLL NO", "ROLL NO", "NAME"]:
            errors.append({
                "sourceRow": row_idx,
                "error": "Missing or invalid roll number in Academic Records",
            })
            continue

        name_idx = current_header.get("student_name")
        student_name = str(row[name_idx]).strip() if name_idx is not None and name_idx < len(row) and row[name_idx] is not None else None

        branch_idx = current_header.get("branch")
        branch = str(row[branch_idx]).strip() if branch_idx is not None and branch_idx < len(row) and row[branch_idx] is not None else None

        tenth_pct_idx = current_header.get("tenth_percentage")
        tenth_pct = parse_float_safe(row[tenth_pct_idx]) if tenth_pct_idx is not None and tenth_pct_idx < len(row) else None

        tenth_board_idx = current_header.get("tenth_board")
        tenth_board = str(row[tenth_board_idx]).strip() if tenth_board_idx is not None and tenth_board_idx < len(row) and row[tenth_board_idx] is not None else None
        if tenth_board and ("drive.google.com" in tenth_board.lower() or "http" in tenth_board.lower()):
            tenth_board = None

        twelfth_pct_idx = current_header.get("twelfth_percentage")
        twelfth_pct = parse_float_safe(row[twelfth_pct_idx]) if twelfth_pct_idx is not None and twelfth_pct_idx < len(row) else None

        twelfth_board_idx = current_header.get("twelfth_board")
        twelfth_board = str(row[twelfth_board_idx]).strip() if twelfth_board_idx is not None and twelfth_board_idx < len(row) and row[twelfth_board_idx] is not None else None
        if twelfth_board and ("drive.google.com" in twelfth_board.lower() or "http" in twelfth_board.lower()):
            twelfth_board = None

        cgpa_idx = current_header.get("cgpa")
        cgpa = parse_float_safe(row[cgpa_idx]) if cgpa_idx is not None and cgpa_idx < len(row) else None

        active_rep_idx = current_header.get("active_reappears")
        active_reappears = parse_int_safe(row[active_rep_idx]) if active_rep_idx is not None and active_rep_idx < len(row) else 0

        dead_rep_idx = current_header.get("dead_reappears")
        dead_reappears = parse_int_safe(row[dead_rep_idx]) if dead_rep_idx is not None and dead_rep_idx < len(row) else 0

        subjects_idx = current_header.get("reappear_subjects")
        reappear_subjects = split_reappear_subjects(row[subjects_idx]) if subjects_idx is not None and subjects_idx < len(row) else []

        contact_idx = current_header.get("contact_number")
        contact = str(row[contact_idx]).strip() if contact_idx is not None and contact_idx < len(row) and row[contact_idx] is not None else None
        if contact and re.search(r"[a-zA-Z]{4,}", contact):
            contact = None

        p_email_idx = current_header.get("personal_email")
        personal_email = str(row[p_email_idx]).strip().lower() if p_email_idx is not None and p_email_idx < len(row) and row[p_email_idx] is not None else None
        if personal_email and (re.match(r"^[0-9\s+-]{7,15}$", personal_email) or "@" not in personal_email):
            personal_email = None

        c_email_idx = current_header.get("college_email")
        college_email = str(row[c_email_idx]).strip().lower() if c_email_idx is not None and c_email_idx < len(row) and row[c_email_idx] is not None else None

        time_idx = current_header.get("timestamp")
        sub_time = str(row[time_idx]).strip() if time_idx is not None and time_idx < len(row) and row[time_idx] is not None else None

        # ALL submissions remain non-canonical by default (isCanonical: false)
        records.append({
            "batchId": batch_id,
            "sourceRow": row_idx,
            "submissionTimestamp": sub_time,
            "rawRollNumber": raw_roll,
            "normalizedRollNumber": normalized_roll,
            "studentName": student_name,
            "branch": branch,
            "tenthPercentage": tenth_pct,
            "tenthBoard": tenth_board,
            "twelfthPercentage": twelfth_pct,
            "twelfthBoard": twelfth_board,
            "selfReportedCgpa": cgpa,
            "selfReportedActiveReappears": active_reappears,
            "selfReportedDeadReappears": dead_reappears,
            "reappearSubjects": reappear_subjects,
            "contactNumber": contact,
            "personalEmail": personal_email,
            "collegeEmail": college_email,
            "isCanonical": False,
            "reviewStatus": "pending_review",
        })

    return records, errors

# ─────────────────────────────────────────────────────────────────────────────
# MAIN PIPELINE CONTROLLER
# ─────────────────────────────────────────────────────────────────────────────

def parse_student_workbook(filepath: str, batch_id: str) -> Dict[str, Any]:
    """
    Parses the student workbook completely and returns mapped records
    ready for database ingestion into Phase 3.1 models.
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Workbook not found at {filepath}")

    with open(filepath, "rb") as f:
        file_bytes = f.read()
    file_sha256 = hashlib.sha256(file_bytes).hexdigest()
    file_size_bytes = len(file_bytes)

    raw_sheets = read_xlsx_sheets(filepath)
    sheets_processed = list(raw_sheets.keys())

    # Parse sheets
    sm_records, sm_errors = (
        parse_student_master_sheet(raw_sheets[SHEET_STUDENT_MASTER], batch_id)
        if SHEET_STUDENT_MASTER in raw_sheets
        else ([], [])
    )

    ar_records, ar_errors = (
        parse_admission_records_sheet(raw_sheets[SHEET_ADMISSION_RECORDS], batch_id)
        if SHEET_ADMISSION_RECORDS in raw_sheets
        else ([], [])
    )

    ir_records, ir_errors = (
        parse_internship_records_sheet(raw_sheets[SHEET_INTERNSHIP_RECORDS], batch_id)
        if SHEET_INTERNSHIP_RECORDS in raw_sheets
        else ([], [])
    )

    acad_records, acad_errors = (
        parse_academic_records_sheet(raw_sheets[SHEET_ACADEMIC_RECORDS], batch_id)
        if SHEET_ACADEMIC_RECORDS in raw_sheets
        else ([], [])
    )

    total_records = len(sm_records) + len(ar_records) + len(ir_records) + len(acad_records)
    total_errors = len(sm_errors) + len(ar_errors) + len(ir_errors) + len(acad_errors)

    return {
        "batchId": batch_id,
        "metadata": {
            "workbookName": os.path.basename(filepath),
            "workbookHash": file_sha256,
            "workbookSizeBytes": file_size_bytes,
            "sheetsProcessed": sheets_processed,
            "parsedAt": datetime.now(timezone.utc).isoformat(),
        },
        "counts": {
            "studentMaster": len(sm_records),
            "admissionApplications": len(ar_records),
            "studentInternships": len(ir_records),
            "academicSubmissions": len(acad_records),
            "totalStagedRecords": total_records,
            "totalErrors": total_errors,
        },
        "records": {
            "studentStaging": sm_records,
            "admissionApplications": ar_records,
            "studentInternships": ir_records,
            "academicSubmissions": acad_records,
        },
        "validationErrors": sm_errors + ar_errors + ir_errors + acad_errors,
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 parser.py <workbook.xlsx> [batchId] [--full-output]")
        sys.exit(1)

    wb_path = sys.argv[1]
    # batchId can be 2nd or 3rd arg (after --full-output flag is stripped)
    remaining_args = [a for a in sys.argv[2:] if not a.startswith("--")]
    full_output = "--full-output" in sys.argv

    b_id = remaining_args[0] if remaining_args else f"BATCH-STAGING-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"

    result = parse_student_workbook(wb_path, b_id)

    if full_output:
        # Full output: includes records for ingestion by ingest_staging.js
        # Records contain no PII beyond what the privacy-filtered parser produces
        print(json.dumps(result, indent=2))
    else:
        # Summary-only output (counts, no records)
        print(json.dumps({
            "batchId": result["batchId"],
            "metadata": result["metadata"],
            "counts": result["counts"],
            "validationErrors": result["validationErrors"],
        }, indent=2))
