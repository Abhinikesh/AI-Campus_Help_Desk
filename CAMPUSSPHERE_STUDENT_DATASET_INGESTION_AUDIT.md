# CampusSphere AI — Student Dataset Ingestion & Reconciliation Audit Report
**Document ID:** `CAMPUSSPHERE_STUDENT_DATASET_INGESTION_AUDIT.md`  
**Revision:** Phase 1.1 Corrected Edition  
**Date:** November 11, 2026  
**Auditor & Database Architect:** Antigravity AI Engineering & Architecture Team  
**Source Dataset:** `erp_Datasets_1.numbers` (Sheet: `LINKEDIN certificate`, Table: `Table 1`)  
**Compliance Mandate:** Zero Automatic Account Creation, Zero Unverified Roll Number Overwrites, Read-Only Reconciliation Preview  

---

## 1. Executive Summary & Critical Dataset Caveats

A rigorous read-only extraction and structural analysis of the uploaded Apple Numbers spreadsheet (`erp_Datasets_1.numbers`) was performed using `numbers-parser`. The file contains **64 rows of student names and roll numbers** located on a sheet specifically entitled **`LINKEDIN certificate`**.

### Critical Audit Correction (Phase 1.1 Mandate)
1. **Certificate List vs. Enrolled Student Roster:** The source sheet is an external certificate award list (`LINKEDIN certificate`). **It must NOT be assumed that all 64 records represent currently enrolled students** in the institution. Certificate rosters often include alumni, workshop participants, inter-college attendees, or prospective candidates.
2. **No Automatic Account Creation:** Unmatched rows from this certificate file must **never** be automatically onboarded as active ERP `Student` or `User` accounts without formal institutional enrollment verification (admission slips, fee payment receipts, or official registrar gazettes).
3. **No Automatic Mutation of Synthetic Roll Numbers:** The existing database contains synthetic roll numbers (`20240001`–`20240008`). These must **never be automatically overwritten or mutated** based solely on heuristics or name similarity.
4. **Name-Only Matches are Strictly Unverified:** Name similarity (e.g. `"Abhinikesh"` vs `"Abhinikesh Kumar"`) must be classified strictly as **`UNVERIFIED_AMBIGUOUS`**, requiring explicit administrative cross-verification of parentage, department, and registration records.
5. **Read-Only Reconciliation Preview:** All dataset operations must be restricted to generating an offline reconciliation preview without executing any database writes or updates.

---

## 2. Dataset Structure & Extraction Inventory

### 2.1 Technical Extraction Metrics
- **File Format:** Apple Numbers proprietary zipped protobuf package.
- **Extraction Method:** Parsed via `numbers-parser` into standardized records.
- **Sheet Title:** `LINKEDIN certificate`
- **Table Name:** `Table 1`
- **Header Structure:** Column A: Roll Number (`R.No`); Column B: Student Full Name (`Name`).
- **Total Rows:** 64 data rows (Row indices 1 through 64). Zero duplicate roll numbers detected within the file.

### 2.2 Complete 64-Row Extraction Inventory

| Row | University Roll Number | Student Name (Certificate) | Presumed Batch | Academic Programme | Verification Status |
| :---: | :--- | :--- | :---: | :--- | :--- |
| 1 | `1/24/SET/BCS/212` | Chirag | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 2 | `1/24/SET/BCS/213` | Yash Tyagi | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 3 | `1/24/SET/BCS/214` | Aryan Sharma | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 4 | `1/24/SET/BCS/215` | Srishti Gupta | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 5 | `1/24/SET/BCS/216` | Srijan Sengupta | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 6 | `1/24/SET/BCS/217` | Harsh Jaiswal | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 7 | `1/24/SET/BCS/218` | Anshul Sahu | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 8 | `1/24/SET/BCS/219` | Sakshi | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 9 | `1/24/SET/BCS/220` | Rituraj Pathak | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 10 | `1/24/SET/BCS/221` | Shourya | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 11 | `1/24/SET/BCS/222` | Abhigyan Verma | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 12 | `1/24/SET/BCS/223` | Abhigyan Verma | 2024 | B.Tech CSE (BCS) | Ambiguous (Duplicate Name) |
| 13 | `1/24/SET/BCS/224` | Jaskirat Singh | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 14 | `1/24/SET/BCS/225` | Akshit Sharma | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 15 | `1/24/SET/BCS/226` | Aryan | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 16 | `1/24/SET/BCS/227` | Abhishek Singh Chauhan | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 17 | `1/24/SET/BCS/228` | Ankit Kumar | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 18 | `1/24/SET/BCS/229` | Jatin | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 19 | `1/24/SET/BCS/230` | Yash | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| **20** | `1/24/SET/BCS/231` | **Abhinikesh Kumar** | 2024 | B.Tech CSE (BCS) | **Name Similarity (Pending Admin)** |
| 21 | `1/24/SET/BCS/232` | Garvit Kumar Jain | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 22 | `1/24/SET/BCS/233` | Vaibhav Kumar Singh | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 23 | `1/24/SET/BCS/234` | Keshav Shishodia | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 24 | `1/24/SET/BCS/235` | Garvit Pant | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 25 | `1/24/SET/BCS/236` | Aryan Sehgal | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 26 | `1/24/SET/BCS/237` | Ayush Kumar Patel | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 27 | `1/24/SET/BCS/238` | Samarth Kumar Gupta | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 28 | `1/24/SET/BCS/239` | Akshara Tiwari | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 29 | `1/24/SET/BCS/240` | Archit Gupta | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 30 | `1/24/SET/BCS/241` | Dhruv | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 31 | `1/24/SET/BCS/242` | Anshul | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 32 | `1/23/SET/BCS/095` | Arpit Sharma | 2023 | B.Tech CSE (BCS) | Senior Batch (2023 Admission) |
| 33 | `1/24/SET/BCS/243` | Aniket Kumar | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 34 | `1/24/SET/BCS/244` | Vanshika Singh | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 35 | `1/24/SET/BCS/245` | Abhay Saini | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 36 | `1/24/SET/BCS/246` | Harsh Vardhan Singh | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 37 | `1/24/SET/BCS/247` | Aayush Kumar | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 38 | `1/24/SET/BCS/248` | Shivansh Pandey | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 39 | `1/24/SET/BCS/249` | Tanishq | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 40 | `1/24/SET/BCS/250` | Aditya Jaiswal | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 41 | `1/24/SET/BCS/251` | Shorya Saini | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 42 | `1/24/SET/BCS/252` | Akshat Garg | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 43 | `1/24/SET/BCS/253` | Ayush Kumar | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 44 | `1/24/SET/BCS/254` | Priyanshu Maurya | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 45 | `1/24/SET/BCS/255` | Aman Kumar | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 46 | `1/24/SET/BCS/256` | Ashutosh Jha | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 47 | `1/24/SET/BCS/257` | Utkarsh Rai | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 48 | `1/24/SET/BCS/258` | Devansh Shrivastava | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 49 | `1/24/SET/BCS/259` | Ashmit Singh Rawat | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 50 | `1/24/SET/BCS/260` | Ashutosh Singh | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 51 | `1/24/SET/BCS/264` | Aditya Chaurasia | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 52 | `1/24/SET/BCS/265` | Shaurya Vardhan Tiwari | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 53 | `1/24/SET/BCS/266` | Adarsh Tripathi | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 54 | `1/24/SET/BCS/267` | Anshuman Shukla | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 55 | `1/24/SET/BCS/268` | Shreya Singh | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 56 | `1/24/SET/BCS/269` | Sakshi Singh | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 57 | `1/24/SET/BCS/270` | Shourya Rai | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 58 | `1/24/SET/BCS/271` | Ayush Singh | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 59 | `1/24/SET/BCS/272` | Aryan Tyagi | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 60 | `1/24/SET/BCS/273` | Priyanshu Sharma | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 61 | `1/24/SET/BCS/274` | Jishan | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 62 | `1/24/SET/BCS/275` | Naman Jain | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 63 | `1/24/SET/BCS/279` | Mayank Tyagi | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |
| 64 | `1/24/SET/BCS/588` | Aman Kumar | 2024 | B.Tech CSE (BCS) | Unverified Certificate Entry |

---

## 3. Strict Non-Destructive Reconciliation Protocol

```
                        INCOMING CERTIFICATE ROW
                                   │
                                   ▼
                   [Primary Key Check: Exact Roll Number]
                                   │
        ┌──────────────────────────┴──────────────────────────┐
        ▼                                                     ▼
     [MATCH FOUND IN DB]                               [NO ROLL MATCH IN DB]
        │                                                     │
        ▼                                                     ▼
 [VERIFIED LINK]                                     [Name Similarity Check]
• Zero profile mutation                                       │
• Maintain existing User/Student           ┌──────────────────┴──────────────────┐
• Log certificate award                    ▼                                     ▼
                                   [NAME MATCH DETECTED]                  [NO NAME MATCH]
                                   (e.g. Abhinikesh vs                    (63 records)
                                    Abhinikesh Kumar)                            │
                                           │                                     ▼
                                           ▼                              [UNMATCHED CERTIFICATE]
                                 [UNVERIFIED AMBIGUOUS]                   • Do NOT auto-create account
                                 • Flag for Administrator                 • Do NOT write to MongoDB
                                 • Never auto-overwrite                   • Retain in import staging
                                 • Retain synthetic roll                  • Await official registrar
                                   pending manual review                    enrollment roster
```

### 3.1 Discrepancy & Ambiguity Findings
1. **Duplicate Certificate Recipient Name:** Rows 11 and 12 both list `"Abhigyan Verma"`, but with distinct roll numbers `1/24/SET/BCS/222` and `1/24/SET/BCS/223`. This demonstrates that name-based matching without official institutional ID produces false-positive identity conflation.
2. **Senior Batch Record:** Row 32 lists `1/23/SET/BCS/095` (`Arpit Sharma`), an admission from the 2023 cohort (7th Semester), whereas the remaining 63 records belong to the 2024 cohort (5th Semester). Treating all records as a single classroom cohort would corrupt semester-wise curricular mapping.
3. **Synthetic Roll Number Integrity:** The 8 active students in the database (`20240001`–`20240008`) possess active foreign-key links across `Attendance`, `Mark`, `FeeInvoice`, and `FaceEmbedding`. Automatically modifying any student's roll number string in place without an administrative verification workflow risks breaking audit trails.

---

## 4. Reusable Ingestion Architecture (`server/data/imports/`)

To support genuine registrar datasets in the future while maintaining zero data loss:

1. **Isolation:** Files placed in `server/data/imports/` are permanently ignored by Git (`.gitignore`).
2. **Deterministic Dry-Run:** Ingestion scripts must output an interactive JSON/CLI preview categorizing records into:
   - `EXACT_MATCH_EXISTING` (0 records currently)
   - `AMBIGUOUS_NAME_SIMILARITY` (1 record: `Abhinikesh`)
   - `UNVERIFIED_EXTERNAL_CERTIFICATE` (63 records)
3. **Explicit Administrative Confirmation:** No database records are created or modified without an explicit administrative confirmation command (`--confirm-enrollment`).
4. **Lightweight Storage Rule:** MongoDB remains the authoritative operational record store. CSV and spreadsheet files serve strictly as transient import sources, not runtime duplicate stores.

---

## 5. Verification & Safety Test Protocols

| Check | Target | Expected Safety Outcome |
| :--- | :--- | :--- |
| **No Auto-Insert** | Execute dry-run on `erp_Datasets_1.numbers`. | `Student.countDocuments()` remains exactly 15 (8 active + 7 temp). Zero new records written. |
| **No Auto-Mutation** | Inspect `Student.findOne({ rollNumber: '20240002' })`. | Roll number remains `20240002`. Synthetic key is preserved. |
| **Name Ambiguity** | Check dry-run log for row 20. | Categorized as `UNVERIFIED_AMBIGUOUS`, requiring registrar document confirmation. |
