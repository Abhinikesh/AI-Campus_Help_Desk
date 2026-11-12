#!/usr/bin/env python3
"""
server/scripts/student_staging/synthetic_fixtures.py
Phase 3.3A — Synthetic Test Fixtures Generator.

Generates synthetic, deterministic .xlsx workbooks containing all documented
edge cases, structural anomalies, shifted columns, embedded headers, and privacy
fields without using any real student data.
"""

import os
import openpyxl

def generate_synthetic_workbook(output_path: str) -> str:
    """
    Generates a comprehensive synthetic Excel workbook containing all 6 sheets
    and every documented edge case from Phases 2.1 - 3.2.
    """
    wb = openpyxl.Workbook()

    # ─────────────────────────────────────────────────────────────────────────
    # Sheet 1: Student Master
    # ─────────────────────────────────────────────────────────────────────────
    ws_master = wb.active
    ws_master.title = "Student Master"

    master_headers = [
        "University Roll Number",
        "Student Name",
        "Branch",
        "Section",
        "Phone Number",
        "Personal Email",
        "College / Official Email",
        "Admission Application No",
        "Course",
        "School",
        "Teams ID",
        "Internship Records",
        "Academic Submissions",
        "Identity Match Status"
    ]
    ws_master.append(master_headers)

    # 1. Clean student
    ws_master.append([
        "21SET/CSE/001", "Aarav Sharma", "CSE", "A", "9876543210",
        "aarav@example.com", "aarav.21cse@college.edu", "APP-2021-001",
        "B.Tech - Computer Science & Engineering", "SCHOOL OF ENGINEERING AND TECHNOLOGY",
        "aarav.teams@college.edu", 1, 2, "Matched by unique exact academic email + name"
    ])

    # 2. Student with Review conflict in Name
    ws_master.append([
        "21SET/CSE/002", "REVIEW — Bhavya Patel | Bhavya K Patel", "AIML", "B", "9876543211",
        "bhavya@example.com", "bhavya.21cse@college.edu", "APP-2021-002",
        "B.Tech", "SCHOOL OF ENGINEERING AND TECHNOLOGY",
        "bhavya.teams@college.edu", 1, 2, "Matched by unique exact academic email + name"
    ])

    # 3. Student with Review conflict in Branch & Phone
    ws_master.append([
        "21SET/CSE/003", "Chirag Verma", "REVIEW — CSE | AIML", "A",
        "REVIEW — 9876543212 | 9123456789", "chirag@example.com",
        "chirag.21cse@college.edu", "APP-2021-003",
        "B.Tech", "SCHOOL OF ENGINEERING AND TECHNOLOGY",
        "chirag.teams@college.edu", 1, 1, "Matched by unique exact academic email + name"
    ])

    # 4. Sayyam documented roll-number formatting discrepancy
    ws_master.append([
        "1)24SET/CSE/050", "Sayyam Jaggi", "CSE", "A", "9876543213",
        "sayyam@example.com", "sayyam@college.edu", "APP-2024-050",
        "B.Tech", "SCHOOL OF ENGINEERING AND TECHNOLOGY",
        "sayyam@college.edu", 1, 2, "Matched by unique exact academic email + name"
    ])

    # 5. Rupesh 'ROLL-' prefix discrepancy
    ws_master.append([
        "ROLL- 21SET/CSE/099", "Rupesh Kumar", "CSE", "C", "9876543214",
        "rupesh@example.com", "rupesh@college.edu", "APP-2021-099",
        "B.Tech", "SCHOOL OF ENGINEERING AND TECHNOLOGY",
        "rupesh@college.edu", 1, 1, "Matched"
    ])

    # 6. Nishant ambiguous phone-as-roll record
    ws_master.append([
        "9988776655", "Nishant Singh", "CSE", "D", "9988776655",
        "nishant@example.com", "nishant@college.edu", "APP-2021-125",
        "B.Tech", "SCHOOL OF ENGINEERING AND TECHNOLOGY",
        "nishant@college.edu", 1, 1, "Matched"
    ])

    # 7. EMBEDDED TABLE HEADER (Row 8 in synthetic sheet, simulating Row 555 in authentic workbook)
    ws_master.append([
        "COMPLETEROLLNO.", "Name", "Xth percentage", "upload marksheet (Xth)",
        "Xth Board", "XIIth Percentage", "XIIth Board", None, None, None, None, None, None, None
    ])

    # 8. Clean student after embedded header
    ws_master.append([
        "21SET/CSE/100", "Zoya Khan", "DS", "A", "9876543215",
        "zoya@example.com", "zoya@college.edu", "APP-2021-100",
        "B.Tech", "SCHOOL OF ENGINEERING AND TECHNOLOGY",
        "zoya@college.edu", 0, 0, "No high-confidence admission match"
    ])

    # ─────────────────────────────────────────────────────────────────────────
    # Sheet 2: Admission Records (Authentic Multi-Column Layout)
    # ─────────────────────────────────────────────────────────────────────────
    ws_adm = wb.create_sheet("Admission Records")
    adm_headers = [
        "S.no", "Application No", "Student Name", "Course", "SCHOOL",
        "Email Id", "Teams -id", "Admit Password"
    ]
    ws_adm.append(adm_headers)

    # Standard clean records
    ws_adm.append([1, "APP-2021-001", "Aarav Sharma", "B.Tech CSE", "SOET", "aarav@adm.edu", "aarav@teams.edu", "SECRET_PW_1"])
    ws_adm.append([2, "APP-2021-002", "Bhavya Patel", "B.Tech AIML", "SOET", "bhavya@adm.edu", "bhavya@teams.edu", "SECRET_PW_2"])

    # Duplicate Application Number Pair (preserves authentic duplicates)
    ws_adm.append([3, "APP-2021-DUP", "Deepak Gupta (Entry 1)", "B.Tech CSE", "SOET", "deepak1@adm.edu", "deepak@teams.edu", "SECRET_PW_3"])
    ws_adm.append([4, "APP-2021-DUP", "Deepak Gupta (Entry 2)", "B.Tech CSE", "SOET", "deepak2@adm.edu", "deepak@teams.edu", "SECRET_PW_4"])

    # Divider Rows (simulating rows 841-844 in authentic workbook)
    ws_adm.append(["Sheet5: Table 1", None, None, None, None, None, None, None])
    ws_adm.append(["Migration: Table 1", None, None, None, None, None, None, None])

    # Migration Sub-Header Row (simulating Row 845 in authentic workbook)
    ws_adm.append(["S.no", "Date of Reporting", "Application No", "Student Name", "Course", "SCHOOL", "Email Id", "Source Row"])

    # Shifted Column Rows for Migration Students (simulating rows 846-849)
    # Col 0 is S.no, Col 1 is Date of Reporting, Col 2 is Application No, Col 3 is Student Name...
    ws_adm.append([
        1, "2021-09-01", "APP-2021-MIG1", "Manish Rao", "B.Tech CSE", "SOET", "manish@adm.edu", "manish@teams.edu"
    ])
    ws_adm.append([
        2, "2021-09-02", "APP-2021-MIG2", "Neha Joshi", "B.Tech AIML", "SOET", "neha@adm.edu", "neha@teams.edu"
    ])

    # ─────────────────────────────────────────────────────────────────────────
    # Sheet 3: Internship Records (Actual Multi-Column Layout)
    # ─────────────────────────────────────────────────────────────────────────
    ws_intern = wb.create_sheet("Internship Records")
    intern_headers = [
        "Source Column 1", "BRANCH", "SEC", "Univ.Roll.No", "Students Name as per R & S",
        "Vertical Mentor", "Official ID", "Source Column 8", "Name", "Complete Address",
        "Offline / online intermship", "Name (column 12)", "Contact No.", "EMAIL ID",
        "Start Date", "Source Column 16", "Title of Internship", "Stipend (YES/NO)",
        "Monthly Stipend Amount (if applicable)", "Placement done(Yes/No)", "Link of Offer letter", "Source Row"
    ]
    ws_intern.append(intern_headers)

    # 1. Standard clean internship
    ws_intern.append([
        "1", "B.TECH. CSE", "A", "21SET/CSE/001", "Aarav Sharma",
        "Dr. Rao", "OFF-001", "9876543210", "Google Inc", "Mountain View, CA",
        "Hybrid", None, "011-2345678", "contact@google.com",
        "2023-06-01", None, "SWE Intern", "YES",
        50000, "Yes", "https://drive.google.com/offer1", "2"
    ])

    # 2. Missing organization name (Col 8 is empty, Col 7 has student phone)
    ws_intern.append([
        "2", "AIML", "B", "21SET/CSE/002", "Bhavya Patel",
        "Dr. Rao", "OFF-002", "9876543211", "", "Bangalore",
        "Offline", None, None, "bhavya@corp.com",
        "2023-06-15", None, "Research Intern", "NO",
        0, "No", "https://drive.google.com/offer2", "3"
    ])

    # 3. Student with Multiple Internships (Entry 1 and Entry 2 for 21SET/CSE/003)
    ws_intern.append([
        "3", "B.TECH. CSE", "A", "21SET/CSE/003", "Chirag Verma",
        "Dr. Mehta", "OFF-003", "9876543212", "Microsoft", "Redmond, WA",
        "Online", None, "011-9876543", "hr@microsoft.com",
        "2023-01-10", None, "Intern 1", "YES",
        45000, "No", "https://drive.google.com/offer3", "4"
    ])
    ws_intern.append([
        "4", "B.TECH. CSE", "A", "21SET/CSE/003", "Chirag Verma",
        "Dr. Mehta", "OFF-003", "9876543212", "Amazon", "Seattle, WA",
        "Offline", None, None, "hr@amazon.com",
        "2023-07-01", None, "Intern 2", "YES",
        60000, "Yes", "https://drive.google.com/offer4", "5"
    ])

    # 5. Gap row (simulating Row 555 in authentic workbook: only S.No populated, rest empty)
    ws_intern.append([
        "555", None, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None
    ])

    # ─────────────────────────────────────────────────────────────────────────
    # Sheet 4: Academic Records (Actual Table 1 and Table 2 Concatenated Layout)
    # ─────────────────────────────────────────────────────────────────────────
    ws_acad = wb.create_sheet("Academic Records")
    acad_headers_t1 = [
        "Timestamp", "Name", "Complete Roll No.", "Branch", "Xth percentage",
        "upload marksheet (Xth)", "Xth Board", "XIIth Percentage", "XIIth Board",
        "Upload XII th Marksheet", "Father's Name", "Mother's name", "Father's email ID",
        "Mother's email ID", "CGPA in B.Tech (till now)", "No. Of Active reappears",
        "No. Of Dead reappears (Cleared Now)", "Subjects in which you have active reappear",
        "Contact No.", "Personal EmailID", "College EmailID", "Source Row"
    ]
    ws_acad.append(acad_headers_t1)

    # Table 1: Standard entries with Branch
    ws_acad.append([
        "2023-09-01T10:00:00Z", "Aarav Sharma", "21SET/CSE/001", "CSE", 89.5,
        "https://drive.google.com/xth_marksheet", "CBSE", 92.0, "CBSE",
        "https://drive.google.com/xiith_marksheet", "Father Sharma", "Mother Sharma", "father@home.com",
        "mother@home.com", 8.85, 0, 0,
        "None", "9876543210", "aarav@gmail.com", "aarav@college.edu", "2"
    ])

    # Duplicate academic submission for same student (submission 2)
    ws_acad.append([
        "2023-09-05T12:00:00Z", "Aarav Sharma", "21SET/CSE/001", "CSE", 89.5,
        "https://drive.google.com/xth_marksheet_v2", "CBSE", 92.0, "CBSE",
        "https://drive.google.com/xiith_marksheet_v2", "Father Sharma", "Mother Sharma", "father@home.com",
        "mother@home.com", 8.90, 0, 0,
        "None", "9876543210", "aarav@gmail.com", "aarav@college.edu", "3"
    ])

    # Ambiguous syntax roll numbers
    ws_acad.append([
        "2023-09-02T11:00:00Z", "Rupesh Kumar", "ROLL- 21SET/CSE/099", "CSE", 75.0,
        "https://drive.google.com/rupesh_x", "State", 78.5, "State",
        "https://drive.google.com/rupesh_xii", "Father Kumar", "Mother Kumar", "father_k@home.com",
        "mother_k@home.com", 7.4, 1, 0,
        "Data Structures", "9876543214", "rupesh@gmail.com", "rupesh@college.edu", "4"
    ])
    ws_acad.append([
        "2023-09-03T11:00:00Z", "Sayyam Jaggi", "1)24SET/CSE/050", "CSE", 82.0,
        "https://drive.google.com/sayyam_x", "CBSE", 84.0, "CBSE",
        "https://drive.google.com/sayyam_xii", "Father Jaggi", "Mother Jaggi", "father_j@home.com",
        "mother_j@home.com", 8.1, 0, 0,
        "None", "9876543213", "sayyam@gmail.com", "sayyam@college.edu", "5"
    ])

    # Table 1 Divider / Title (simulating row 234 "Sheet1: Table 1")
    ws_acad.append([
        "Sheet1: Table 1", None, None, None, None,
        None, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None
    ])

    # Table 2 Sub-header: NOTICE 'Branch' is MISSING! (simulating row 235)
    acad_headers_t2 = [
        "S. No.", "Name", "Complete Roll No.", "Xth percentage",
        "upload marksheet (Xth)", "Xth Board", "XIIth Percentage", "XIIth Board",
        "Upload XII th Marksheet", "Father's Name", "Mother's name", "Father's email ID",
        "Mother's email ID", "CGPA in B.Tech (till now)", "No. Of Active reappears",
        "No. Of Dead reappears (Cleared Now)", "Subjects in which you have active reappear",
        "Contact No.", "Personal EmailID", "College EmailID", None, "Original CSV row 237"
    ]
    ws_acad.append(acad_headers_t2)

    # Table 2 Entry (simulating rows 236-430: branch is absent, Col 3 is Xth percentage)
    ws_acad.append([
        "1", "Bhavya Patel", "21SET/CSE/002", 91.2,
        "https://drive.google.com/bhavya_x", "ICSE", 93.5, "ICSE",
        "https://drive.google.com/bhavya_xii", "Father Patel", "Mother Patel", "father_p@home.com",
        "mother_p@home.com", 9.10, 0, 0,
        "None", "9876543211", "bhavya@gmail.com", "bhavya@college.edu", None, "236"
    ])

    # ─────────────────────────────────────────────────────────────────────────
    # Sheet 5: Reconciliation Review
    # ─────────────────────────────────────────────────────────────────────────
    ws_recon = wb.create_sheet("Reconciliation Review")
    ws_recon.append(["Record Reference", "Conflict Type", "Details", "Proposed Resolution"])
    ws_recon.append(["21SET/CSE/002", "Name Discrepancy", "REVIEW — Bhavya Patel | Bhavya K Patel", "Pending"])
    ws_recon.append(["21SET/CSE/003", "Branch Discrepancy", "REVIEW — CSE | AIML", "Pending"])

    # ─────────────────────────────────────────────────────────────────────────
    # Sheet 6: Data Quality Summary
    # ─────────────────────────────────────────────────────────────────────────
    ws_summary = wb.create_sheet("Data Quality Summary")
    ws_summary.append(["Metric", "Value", "Notes"])
    ws_summary.append(["Total Expected Students", 554, "Authentic Master"])
    ws_summary.append(["Total Expected Applications", 843, "Authentic Admissions"])
    ws_summary.append(["Total Expected Internships", 559, "Authentic Internships"])
    ws_summary.append(["Total Expected Submissions", 427, "Authentic Academic Surveys"])

    # Ensure parent dir exists and save
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    wb.save(output_path)
    return output_path

if __name__ == "__main__":
    test_path = "/Users/abhinikesh/AI-Campus_Help_Desk/server/scripts/student_staging/fixtures/synthetic_student_workbook.xlsx"
    p = generate_synthetic_workbook(test_path)
    print(f"✅ Generated synthetic workbook fixture at: {p}")

