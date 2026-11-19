# CampusSphere AI — Part 1: 2024 BCS Roll Number Reconciliation Report (READ-ONLY)

**Document ID:** `CAMPUSSPHERE_PART_1_2024_BCS_ROLL_RECONCILIATION_REPORT.md`  
**Execution Mode:** STRICTLY READ-ONLY AUDIT (Zero DB writes, Zero roll mutations, Zero account creations)  
**Date:** November 19, 2026  
**Official Target Format:** `1/24/SET/BCS/XXX`  
**Source Dataset:** `/Users/abhinikesh/AI-Campus_Help_Desk/erp_Datasets_1.numbers`  
**Sheet / Table:** Sheet: `LINKEDIN certificate` | Table: `Table 1` (64 data entries)  
**Database Target:** MongoDB (`campus-erp`, port 27018) — Collection: `students`  
**Compliance Standard:** Institutional Registrar Integrity Mandate — External certificate records do not constitute authoritative enrollment proof.  

---

## 1. Executive Summary & Reconciliation Metrics

A rigorous cross-reconciliation between the external certificate dataset (`erp_Datasets_1.numbers`, Sheet: `LINKEDIN certificate`, 64 entries) and the authoritative MongoDB `students` collection in `campus-erp` was performed.

### Core Census & Matching Findings:
- **Total Source Certificate Entries:** **64**
- **Total Existing 2024 BCS Student Records in DB:** **545** (535 canonical, 1 typo, 8 synthetic, 1 mobile phone)
- **Exact Matches (Exact Roll & Exact Normalized Name):** **23** (35.9%)
- **Possible Matches Requiring Verification (Name Variations):** **31** (48.4%) — Names match primary component of records carrying staging review formatting (`REVIEW — <Name> | <Name>`)
- **Name Discrepancies / Conflicts (Ambiguous):** **10** (15.6%) — Roll matches, but student name on certificate differs from database (omitted middle names, father names, patronymics)
- **Unmatched Source Entries:** **0** (0.0%) — 100% of the 64 source roll numbers exist in MongoDB
- **Duplicate / Conflicting Identities Identified:** **2** major collisions (Sayyam Jaggi duplicate roll `319`, Abhinikesh dual synthetic vs. canonical record) plus 7 cross-roll name collisions
- **Existing Roll Numbers Requiring Official Verification:** **25** records (8 synthetic, 1 phone, 1 typo, 11 2023 cohort, 4 lateral-entry, 1 temporary MECH)

---

## 2. Source Dataset Analysis (`erp_Datasets_1.numbers`)

### 2.1 File Structure & Extraction Inventory
- **Source File:** `/Users/abhinikesh/AI-Campus_Help_Desk/erp_Datasets_1.numbers`
- **Sheet Name:** `LINKEDIN certificate` | **Table:** `Table 1`
- **Total Valid Data Rows:** **64 rows** (Row 1 through Row 64)
- **Internal Duplicate Roll Numbers:** **0** (All 64 roll numbers are unique within the spreadsheet)
- **Batch Composition:**
  - **62 entries** conform to 2024 format `1/24/SET/BCS/XXX` (Rows 3 through 64)
  - **2 entries** belong to the 2023 academic batch: `1/23/SET/BCS/095` (Kunal Bhargava, Row 1) and `1/23/SET/BCS/243` (MAYANK SOAM, Row 2)

> [!IMPORTANT]
> **Enrollment Evidence Caveat:** `erp_Datasets_1.numbers` is an external list of LinkedIn certificate recipients, **not** an authoritative college enrollment roster or registrar fee register. It cannot be used alone to prove official student enrollment.

---

## 3. MongoDB Database Census (`students` Collection)

A complete census of the `students` collection in `campus-erp` (561 total documents) establishes the following distribution:

| Roll Number Category | Format Pattern | Count | Cohort Description |
| :--- | :--- | :---: | :--- |
| **Canonical 2024 BCS** | `1/24/SET/BCS/XXX` | **535** | Official 2024 B.Tech CSE cohort enrolled via Batch 003 real dataset. |
| **Typo 2024 BCS** | `1/24SET/BCS/319` | **1** | Missing forward slash between 24 and SET (Sayyam Jaggi duplicate). |
| **Synthetic 8-Digit Rolls** | `20240001`–`20240008` | **8** | Development seed fixtures with 2024 placement. |
| **Mobile Phone Identifier** | `9389818925` | **1** | Malformed student record where a 10-digit mobile number served as roll number. |
| **Total 2024 BCS Cohort** | — | **545** | Total 2024 BCS records in database. |
| **Legacy 2023 BCS** | `1/23/SET/BCS/XXX` | **11** | 2023 academic batch students present in database. |
| **2025 Lateral Entry / Non-BCS** | `25/SET/BCML...`, `25/SET/BCSE...` | **4** | Diploma-to-degree lateral entry students. |
| **Temporary Placeholder** | `TEMP56839` | **1** | Staging placeholder student in Mechanical branch. |
| **Total Database Records** | — | **561** | Full student census in `campus-erp`. |

---

## 4. Reconciliation Categories & Match Types

### 4.1 Match Classification Breakdown
| Match Classification | Count | % of Source | Operational Status | Description |
| :--- | :---: | :---: | :--- | :--- |
| **EXACT_ROLL_AND_NAME** | 23 | 35.9% | `VERIFIED_MATCH` | Roll number and normalized student name match database record perfectly. |
| **EXACT_ROLL_NAME_VARIATION** | 31 | 48.4% | `REQUIRES_ADMIN_NAME_CLEANUP` | Roll number matches; certificate name matches core name in DB record carrying staging review prefix (`REVIEW — ...`). |
| **EXACT_ROLL_NAME_CONFLICT** | 10 | 15.6% | `UNVERIFIED_AMBIGUOUS_NAME_DISCREPANCY` | Roll number matches, but name differs (omitted middle name, patronymic, or compound surname). |
| **UNMATCHED_SOURCE_ENTRY** | 0 | 0.0% | `UNVERIFIED_NOT_IN_DATABASE` | Roll number does not exist in MongoDB. |
| **Total** | **64** | **100.0%** | — | — |

### 4.2 Audit of the 10 Name Discrepancy Records
Per strict institutional audit rules, discrepancies in names cannot be resolved automatically or by phone/email matching alone. They are classified as `UNVERIFIED_AMBIGUOUS_NAME_DISCREPANCY`:

| # | Source Roll | Source Certificate Name | Existing Database Full Name | Database Email | Database Phone | App No | Discrepancy Details |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **9** | `1/24/SET/BCS/219` | Raj Sah | `REVIEW — Raj kumar sah | RAJ KUMAR SAH` | `RAJ_SAH24@MANAVRACHNA.NET` | `7543088678` | — | Certificate omits middle name "Kumar". Official email matches "Raj Sah". |
| **10** | `1/24/SET/BCS/220` | OMKESH CHATURBEDI | `REVIEW — Omkesh kumar chaturbedi | OMKESH KUMAR CHATURBEDI` | `omkeshkumar600@gmail.com` | `9262615491` | `MRIIRS24/33192` | Certificate omits middle name "Kumar". |
| **32** | `1/24/SET/BCS/242` | PASAM REDDY | `REVIEW — Pasam rakesh reddy | PASAM RAKESH REDDY` | `pasamrakeshreddy77@gmail.com` | `8328517554` | — | Certificate omits middle name "Rakesh". |
| **34** | `1/24/SET/BCS/244` | RAYAPU CHARAN SIMHA REDDY | `REVIEW — RAYAPU REDDY CHARAN SIMHA REDDY | Rayapureddy charan simha reddy` | `charansimhareddyrayapureddy@gmail.com` | `8919614137` | `MRIIRS24/30909` | Certificate omits redundant prefix "Reddy". |
| **36** | `1/24/SET/BCS/246` | Mishra Ritesh Kumar Kumar | `REVIEW — MISHRA RITESH KUMAR NAGENDRA KUMAR | Ritesh Mishra | Ritesh nagendra mishra` | `riteshmishra6143@gmail.com` | `8097158105` | `MRIIRS24/21012` | Certificate duplicates "Kumar", DB contains father name "Nagendra Kumar". |
| **41** | `1/24/SET/BCS/251` | RAMIREDDY SUDARSHAN RDDY | `RAMIREDDY GANGA SUDARSHAN RDDY` | `trinathreddyramireddy@gmail.com` | — | `MRIIRS24/26954` | Certificate omits middle patronymic "Ganga". Typo "RDDY" present on both. |
| **45** | `1/24/SET/BCS/257` | Tanishk Sharma | `REVIEW — Tanishk | TANISHK MANOJ SHARMA` | `Tanishk_sharma24@manavrachna.net` | `8307888812` | — | Certificate omits father name "Manoj". Official email confirms "Tanishk Sharma". |
| **50** | `1/24/SET/BCS/263` | SHARVAN CHAUDHARY | `REVIEW — Sharvan Kumar Chaudhary | SHARVAN KUMAR CHAUDHARY` | `sharvankumarchaudhary2004@gmail.com` | `8789689396` | `MRIIRS24/31407` | Certificate omits middle name "Kumar". |
| **51** | `1/24/SET/BCS/264` | Aditya Chaurasia | `REVIEW — ADITYA KUMAR CHAURASIA | Aditya Kumar Chaurasia` | `adityachaurasiya442@gmail.com` | `8081622968` | — | Certificate omits middle name "Kumar". |
| **53** | `1/24/SET/BCS/266` | Akram Khan | `AKRAM PARVEZ KHAN` | `gufranjsr786@gmail.com` | `9848925128` | `MRIIRS24/25595` | Certificate omits middle name "Parvez". |

---

## 5. Duplicate and Conflicting Identities in MongoDB

### 5.1 Dual Identity Conflict: Synthetic vs. Canonical (Abhinikesh)
- **Synthetic Record:** ID `6ae46faf9e9e56f71ecccdd9`, Roll: `20240002`, Name: `Abhinikesh`, linked to active User account `6ae46faf9e9e56f71ecccdd7`.
- **Canonical Record:** ID `6afa10459131ed3bfbd66b25`, Roll: `1/24/SET/BCS/231`, Name: `ABHINIKESH KUMAR`, offline enrolled (`user: null`). Corresponds to Row 21 of the certificate list.
- *Adjudication:* Both records represent the identical student. Administrative adjudication must re-link the active user account to canonical record `1/24/SET/BCS/231` before retiring synthetic record `20240002`.

### 5.2 Formatting Typo Duplicate: Sayyam Jaggi
- **Typo Record:** ID `6afa10459131ed3bfbd66a43`, Roll: `1/24SET/BCS/319` (missing forward slash).
- **Canonical Record:** ID `6afa10459131ed3bfbd66b75`, Roll: `1/24/SET/BCS/319` (official format).
- *Adjudication:* Two separate documents exist for Sayyam Jaggi. Typo record must be merged into canonical record.

### 5.3 Cross-Roll Name Collisions
Several student names appear across multiple distinct roll numbers in the database:
- **Karan Singh:** Roll `1/24/SET/BCS/181` and Roll `1/24/SET/BCS/274` (Row 59 of certificate)
- **Priyanshu Kumar:** Roll `1/24/SET/BCS/054`, Roll `1/24/SET/BCS/225` (Row 15 of certificate), and Roll `1/24/SET/BCS/483`
- **Aryan Gupta:** Roll `1/24/SET/BCS/024` and Roll `1/24/SET/BCS/123`
- **Gaurav .:** Roll `1/24/SET/BCS/391` and Roll `1/24/SET/BCS/526`
- **Varun .:** Roll `1/24/SET/BCS/203` and Roll `1/24/SET/BCS/572`
- **Himanshu Chauhan:** Roll `1/24/SET/BCS/140` and Roll `1/24/SET/BCS/581`

> [!NOTE]
> These collisions demonstrate why matching students by name alone is hazardous. Each roll number is unique and represents an independent student identity.

---

## 6. Existing Roll Numbers Requiring Official Verification (25 Records)

1. **Synthetic 8-Digit Rolls (8 records):** `20240001` through `20240008` — require official registrar records to verify authentic university roll numbers.
2. **Mobile Phone Identifier (1 record):** `9389818925` (Nishant Thakurela) — phone number stored in rollNumber field.
3. **Typo Roll Number (1 record):** `1/24SET/BCS/319` (Sayyam Jaggi) — missing forward slash.
4. **Legacy 2023 Cohort (11 records):** `1/23/SET/BCS/078`, `079`, `095`, `104`, `149`, `162`, `182`, `243`, `482`, `509`, `563` — must retain 2023 academic batch.
5. **Lateral Entry / Specialized Branches (4 records):** `25/SET/BCML(L//001`, `004`, `25/SET/BCSE(L//001`, `004`.

---

## 7. Proposed Reconciliation Mapping Table (All 64 Source Entries)

| # | Source Roll | Student Name (Certificate) | Existing DB Record ID | Existing DB Student Name | Current Roll Number | Proposed Official Roll Number | Match Type | Verification Status |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `1/23/SET/BCS/095` | Kunal Bhargava | `6afa10459131ed3bfbd66a46` | KUNAL BHARGAVA | `1/23/SET/BCS/095` | `1/23/SET/BCS/095` | `EXACT_ROLL_AND_NAME` | `VERIFIED_MATCH` |
| 2 | `1/23/SET/BCS/243` | MAYANK SOAM | `6afa10459131ed3bfbd66a4b` | MAYANK SOAM | `1/23/SET/BCS/243` | `1/23/SET/BCS/243` | `EXACT_ROLL_AND_NAME` | `VERIFIED_MATCH` |
| 3 | `1/24/SET/BCS/212` | Aditya Raj | `6afa10459131ed3bfbd66b13` | ADITYA RAJ | `1/24/SET/BCS/212` | `1/24/SET/BCS/212` | `EXACT_ROLL_AND_NAME` | `VERIFIED_MATCH` |
| 4 | `1/24/SET/BCS/213` | SARTHAK SHRIVASTAVA | `6afa10459131ed3bfbd66b14` | REVIEW — SARTHAK SHRIVASTAVA | Sarthak Shrivastava | `1/24/SET/BCS/213` | `1/24/SET/BCS/213` | `EXACT_ROLL_NAME_VARIATION` | `REQUIRES_ADMIN_NAME_CLEANUP` |
| 5 | `1/24/SET/BCS/214` | Mrinal Chowdhary | `6afa10459131ed3bfbd66b15` | REVIEW — MRINAL CHOWDHARY | Mrinal Chowdhary | `1/24/SET/BCS/214` | `1/24/SET/BCS/214` | `EXACT_ROLL_NAME_VARIATION` | `REQUIRES_ADMIN_NAME_CLEANUP` |
| 6 | `1/24/SET/BCS/215` | Divyanjali Dinkar | `6afa10459131ed3bfbd66b16` | DIVYANJALI DINKAR | `1/24/SET/BCS/215` | `1/24/SET/BCS/215` | `EXACT_ROLL_AND_NAME` | `VERIFIED_MATCH` |
| 7 | `1/24/SET/BCS/216` | PREETI SHARMA | `6afa10459131ed3bfbd66b17` | REVIEW — PREETI SHARMA | Preeti Sharma | `1/24/SET/BCS/216` | `1/24/SET/BCS/216` | `EXACT_ROLL_NAME_VARIATION` | `REQUIRES_ADMIN_NAME_CLEANUP` |
| 8 | `1/24/SET/BCS/217` | YERRAGOLLA NARENDRA | `6afa10459131ed3bfbd66b18` | REVIEW — Yerragolla Narendra | YERRAGOLLA NARENDRA | `1/24/SET/BCS/217` | `1/24/SET/BCS/217` | `EXACT_ROLL_NAME_VARIATION` | `REQUIRES_ADMIN_NAME_CLEANUP` |
| 9 | `1/24/SET/BCS/219` | Raj Sah | `6afa10459131ed3bfbd66b19` | REVIEW — Raj kumar sah | RAJ KUMAR SAH<br>*(Note: Certificate: 'Raj Sah' vs DB: 'REVIEW — Raj kumar sah | RAJ KUMAR SAH')* | `1/24/SET/BCS/219` | `1/24/SET/BCS/219` | `EXACT_ROLL_NAME_CONFLICT` | `UNVERIFIED_AMBIGUOUS_NAME_DISCREPANCY` |
| 10 | `1/24/SET/BCS/220` | OMKESH CHATURBEDI | `6afa10459131ed3bfbd66b1a` | REVIEW — Omkesh kumar chaturbedi | OMKESH KUMAR CHATURBEDI<br>*(Note: Certificate: 'OMKESH CHATURBEDI' vs DB: 'REVIEW — Omkesh kumar chaturbedi | OMKESH KUMAR CHATURBEDI')* | `1/24/SET/BCS/220` | `1/24/SET/BCS/220` | `EXACT_ROLL_NAME_CONFLICT` | `UNVERIFIED_AMBIGUOUS_NAME_DISCREPANCY` |
| 11 | `1/24/SET/BCS/221` | Anshika Aggarwal | `6afa10459131ed3bfbd66b1b` | REVIEW — ANSHIKA AGGARWAL | Anshika Aggarwal | `1/24/SET/BCS/221` | `1/24/SET/BCS/221` | `EXACT_ROLL_NAME_VARIATION` | `REQUIRES_ADMIN_NAME_CLEANUP` |
| 12 | `1/24/SET/BCS/222` | Shivam Mishra | `6afa10459131ed3bfbd66b1c` | REVIEW — SHIVAM MISHRA | Shivam Mishra | `1/24/SET/BCS/222` | `1/24/SET/BCS/222` | `EXACT_ROLL_NAME_VARIATION` | `REQUIRES_ADMIN_NAME_CLEANUP` |
| 13 | `1/24/SET/BCS/223` | Anish Kumar | `6afa10459131ed3bfbd66b1d` | ANISH KUMAR | `1/24/SET/BCS/223` | `1/24/SET/BCS/223` | `EXACT_ROLL_AND_NAME` | `VERIFIED_MATCH` |
| 14 | `1/24/SET/BCS/224` | Ansh Yadav | `6afa10459131ed3bfbd66b1e` | REVIEW — Ansh Yadav | ANSH YADAV | `1/24/SET/BCS/224` | `1/24/SET/BCS/224` | `EXACT_ROLL_NAME_VARIATION` | `REQUIRES_ADMIN_NAME_CLEANUP` |
| 15 | `1/24/SET/BCS/225` | Priyanshu Kumar | `6afa10459131ed3bfbd66b1f` | REVIEW — PRIYANSHU KUMAR | Priyanshu Kumar | `1/24/SET/BCS/225` | `1/24/SET/BCS/225` | `EXACT_ROLL_NAME_VARIATION` | `REQUIRES_ADMIN_NAME_CLEANUP` |
| 16 | `1/24/SET/BCS/226` | ADITYA SHARMA | `6afa10459131ed3bfbd66b20` | ADITYA SHARMA | `1/24/SET/BCS/226` | `1/24/SET/BCS/226` | `EXACT_ROLL_AND_NAME` | `VERIFIED_MATCH` |
| 17 | `1/24/SET/BCS/227` | CHANCHAL | `6afa10459131ed3bfbd66b21` | REVIEW — Chanchal | CHANCHAL . | `1/24/SET/BCS/227` | `1/24/SET/BCS/227` | `EXACT_ROLL_NAME_VARIATION` | `REQUIRES_ADMIN_NAME_CLEANUP` |
| 18 | `1/24/SET/BCS/228` | Jatin Arora | `6afa10459131ed3bfbd66b22` | REVIEW — JATIN ARORA | Jatin Arora | `1/24/SET/BCS/228` | `1/24/SET/BCS/228` | `EXACT_ROLL_NAME_VARIATION` | `REQUIRES_ADMIN_NAME_CLEANUP` |
| 19 | `1/24/SET/BCS/229` | Lakshey | `6afa10459131ed3bfbd66b23` | LAKSHEY | `1/24/SET/BCS/229` | `1/24/SET/BCS/229` | `EXACT_ROLL_AND_NAME` | `VERIFIED_MATCH` |
| 20 | `1/24/SET/BCS/230` | Shivang Gupta | `6afa10459131ed3bfbd66b24` | SHIVANG GUPTA | `1/24/SET/BCS/230` | `1/24/SET/BCS/230` | `EXACT_ROLL_AND_NAME` | `VERIFIED_MATCH` |
| 21 | `1/24/SET/BCS/231` | Abhinikesh Kumar | `6afa10459131ed3bfbd66b25` | ABHINIKESH KUMAR<br>*(Note: Dual Identity Collision: Synthetic 20240002 linked to active User account)* | `1/24/SET/BCS/231` | `1/24/SET/BCS/231` | `EXACT_ROLL_AND_NAME` | `VERIFIED_MATCH` |
| 22 | `1/24/SET/BCS/232` | Kasvi Sharma | `6afa10459131ed3bfbd66b26` | KASVI SHARMA | `1/24/SET/BCS/232` | `1/24/SET/BCS/232` | `EXACT_ROLL_AND_NAME` | `VERIFIED_MATCH` |
| 23 | `1/24/SET/BCS/233` | Ayush Parasher | `6afa10459131ed3bfbd66b27` | AYUSH PARASHER | `1/24/SET/BCS/233` | `1/24/SET/BCS/233` | `EXACT_ROLL_AND_NAME` | `VERIFIED_MATCH` |
| 24 | `1/24/SET/BCS/234` | Harsh Singh | `6afa10459131ed3bfbd66b28` | HARSH SINGH | `1/24/SET/BCS/234` | `1/24/SET/BCS/234` | `EXACT_ROLL_AND_NAME` | `VERIFIED_MATCH` |
| 25 | `1/24/SET/BCS/235` | ABHINAV KUMAR | `6afa10459131ed3bfbd66b29` | REVIEW — Abhinav Kumar | ABHINAV KUMAR | `1/24/SET/BCS/235` | `1/24/SET/BCS/235` | `EXACT_ROLL_NAME_VARIATION` | `REQUIRES_ADMIN_NAME_CLEANUP` |
| 26 | `1/24/SET/BCS/236` | Himanshu Garg | `6afa10459131ed3bfbd66b2a` | REVIEW — Himanshu Garg | HIMANSHU GARG | `1/24/SET/BCS/236` | `1/24/SET/BCS/236` | `EXACT_ROLL_NAME_VARIATION` | `REQUIRES_ADMIN_NAME_CLEANUP` |
| 27 | `1/24/SET/BCS/237` | Ayush Thakur | `6afa10459131ed3bfbd66b2b` | AYUSH THAKUR | `1/24/SET/BCS/237` | `1/24/SET/BCS/237` | `EXACT_ROLL_AND_NAME` | `VERIFIED_MATCH` |
| 28 | `1/24/SET/BCS/238` | Sobit Parashar | `6afa10459131ed3bfbd66b2c` | SOBIT PARASHAR | `1/24/SET/BCS/238` | `1/24/SET/BCS/238` | `EXACT_ROLL_AND_NAME` | `VERIFIED_MATCH` |
| 29 | `1/24/SET/BCS/239` | Onkar Shukla | `6afa10459131ed3bfbd66b2d` | REVIEW — ONKAR SHUKLA | Onkar shukla | `1/24/SET/BCS/239` | `1/24/SET/BCS/239` | `EXACT_ROLL_NAME_VARIATION` | `REQUIRES_ADMIN_NAME_CLEANUP` |
| 30 | `1/24/SET/BCS/240` | Pragam Dubey | `6afa10459131ed3bfbd66b2e` | PRAGAM DUBEY | `1/24/SET/BCS/240` | `1/24/SET/BCS/240` | `EXACT_ROLL_AND_NAME` | `VERIFIED_MATCH` |
| 31 | `1/24/SET/BCS/241` | VIDIT DUBEY | `6afa10459131ed3bfbd66b2f` | REVIEW — VIDIT DUBEY | Vidit Dubey | `1/24/SET/BCS/241` | `1/24/SET/BCS/241` | `EXACT_ROLL_NAME_VARIATION` | `REQUIRES_ADMIN_NAME_CLEANUP` |
| 32 | `1/24/SET/BCS/242` | PASAM REDDY | `6afa10459131ed3bfbd66b30` | REVIEW — Pasam rakesh reddy | PASAM RAKESH REDDY<br>*(Note: Certificate: 'PASAM REDDY' vs DB: 'REVIEW — Pasam rakesh reddy | PASAM RAKESH REDDY')* | `1/24/SET/BCS/242` | `1/24/SET/BCS/242` | `EXACT_ROLL_NAME_CONFLICT` | `UNVERIFIED_AMBIGUOUS_NAME_DISCREPANCY` |
| 33 | `1/24/SET/BCS/243` | Priyanshu . | `6afa10459131ed3bfbd66b31` | REVIEW — PRIYANSHU | Priyanshu | `1/24/SET/BCS/243` | `1/24/SET/BCS/243` | `EXACT_ROLL_NAME_VARIATION` | `REQUIRES_ADMIN_NAME_CLEANUP` |
| 34 | `1/24/SET/BCS/244` | RAYAPU CHARAN SIMHA REDDY | `6afa10459131ed3bfbd66b32` | REVIEW — RAYAPU REDDY CHARAN SIMHA REDDY | Rayapureddy charan simha reddy<br>*(Note: Certificate: 'RAYAPU CHARAN SIMHA REDDY' vs DB: 'REVIEW — RAYAPU REDDY CHARAN SIMHA REDDY | Rayapureddy charan simha reddy')* | `1/24/SET/BCS/244` | `1/24/SET/BCS/244` | `EXACT_ROLL_NAME_CONFLICT` | `UNVERIFIED_AMBIGUOUS_NAME_DISCREPANCY` |
| 35 | `1/24/SET/BCS/245` | Prarthna Singh | `6afa10459131ed3bfbd66b33` | REVIEW — Prarthna Singh | PRARTHNA SINGH | `1/24/SET/BCS/245` | `1/24/SET/BCS/245` | `EXACT_ROLL_NAME_VARIATION` | `REQUIRES_ADMIN_NAME_CLEANUP` |
| 36 | `1/24/SET/BCS/246` | Mishra Ritesh Kumar Kumar | `6afa10459131ed3bfbd66b34` | REVIEW — MISHRA RITESH KUMAR NAGENDRA KUMAR | Ritesh Mishra | Ritesh nagendra mishra<br>*(Note: Certificate: 'Mishra Ritesh Kumar Kumar' vs DB: 'REVIEW — MISHRA RITESH KUMAR NAGENDRA KUMAR | Ritesh Mishra | Ritesh nagendra mishra')* | `1/24/SET/BCS/246` | `1/24/SET/BCS/246` | `EXACT_ROLL_NAME_CONFLICT` | `UNVERIFIED_AMBIGUOUS_NAME_DISCREPANCY` |
| 37 | `1/24/SET/BCS/247` | GRANTH CHUGH | `6afa10459131ed3bfbd66b35` | REVIEW — Granth | GRANTH CHUGH | `1/24/SET/BCS/247` | `1/24/SET/BCS/247` | `EXACT_ROLL_NAME_VARIATION` | `REQUIRES_ADMIN_NAME_CLEANUP` |
| 38 | `1/24/SET/BCS/248` | MOHD SADAF | `6afa10459131ed3bfbd66b36` | MOHD SADAF | `1/24/SET/BCS/248` | `1/24/SET/BCS/248` | `EXACT_ROLL_AND_NAME` | `VERIFIED_MATCH` |
| 39 | `1/24/SET/BCS/249` | Teena . | `6afa10459131ed3bfbd66b37` | REVIEW — Teena | TEENA . | `1/24/SET/BCS/249` | `1/24/SET/BCS/249` | `EXACT_ROLL_NAME_VARIATION` | `REQUIRES_ADMIN_NAME_CLEANUP` |
| 40 | `1/24/SET/BCS/250` | Shreya Doha | `6afa10459131ed3bfbd66b38` | SHREYA DOHA | `1/24/SET/BCS/250` | `1/24/SET/BCS/250` | `EXACT_ROLL_AND_NAME` | `VERIFIED_MATCH` |
| 41 | `1/24/SET/BCS/251` | RAMIREDDY SUDARSHAN RDDY | `6afa10459131ed3bfbd66b39` | RAMIREDDY GANGA SUDARSHAN RDDY<br>*(Note: Certificate: 'RAMIREDDY SUDARSHAN RDDY' vs DB: 'RAMIREDDY GANGA SUDARSHAN RDDY')* | `1/24/SET/BCS/251` | `1/24/SET/BCS/251` | `EXACT_ROLL_NAME_CONFLICT` | `UNVERIFIED_AMBIGUOUS_NAME_DISCREPANCY` |
| 42 | `1/24/SET/BCS/252` | SHOBHIT MISHRA | `6afa10459131ed3bfbd66b3a` | REVIEW — Shobhit Mishra | SHOBHIT MISHRA | `1/24/SET/BCS/252` | `1/24/SET/BCS/252` | `EXACT_ROLL_NAME_VARIATION` | `REQUIRES_ADMIN_NAME_CLEANUP` |
| 43 | `1/24/SET/BCS/253` | MD SAHIL | `6afa10459131ed3bfbd66b3b` | MD SAHIL | `1/24/SET/BCS/253` | `1/24/SET/BCS/253` | `EXACT_ROLL_AND_NAME` | `VERIFIED_MATCH` |
| 44 | `1/24/SET/BCS/254` | Ishika Goyal | `6afa10459131ed3bfbd66b3c` | REVIEW — ISHIKA GOYAL | Ishika Goyal | `1/24/SET/BCS/254` | `1/24/SET/BCS/254` | `EXACT_ROLL_NAME_VARIATION` | `REQUIRES_ADMIN_NAME_CLEANUP` |
| 45 | `1/24/SET/BCS/257` | Tanishk Sharma | `6afa10459131ed3bfbd66b3d` | REVIEW — Tanishk | TANISHK MANOJ SHARMA<br>*(Note: Certificate: 'Tanishk Sharma' vs DB: 'REVIEW — Tanishk | TANISHK MANOJ SHARMA')* | `1/24/SET/BCS/257` | `1/24/SET/BCS/257` | `EXACT_ROLL_NAME_CONFLICT` | `UNVERIFIED_AMBIGUOUS_NAME_DISCREPANCY` |
| 46 | `1/24/SET/BCS/259` | Lucky | `6afa10459131ed3bfbd66b3e` | LUCKY | `1/24/SET/BCS/259` | `1/24/SET/BCS/259` | `EXACT_ROLL_AND_NAME` | `VERIFIED_MATCH` |
| 47 | `1/24/SET/BCS/260` | Puneet Dalal | `6afa10459131ed3bfbd66b3f` | REVIEW — Puneet | PUNEET DALAL | `1/24/SET/BCS/260` | `1/24/SET/BCS/260` | `EXACT_ROLL_NAME_VARIATION` | `REQUIRES_ADMIN_NAME_CLEANUP` |
| 48 | `1/24/SET/BCS/261` | Shimesh Gupta | `6afa10459131ed3bfbd66b40` | REVIEW — SHIMESH GUPTA | Shimesh Gupta | `1/24/SET/BCS/261` | `1/24/SET/BCS/261` | `EXACT_ROLL_NAME_VARIATION` | `REQUIRES_ADMIN_NAME_CLEANUP` |
| 49 | `1/24/SET/BCS/262` | Kritika Sah | `6afa10459131ed3bfbd66b41` | KRITIKA SAH | `1/24/SET/BCS/262` | `1/24/SET/BCS/262` | `EXACT_ROLL_AND_NAME` | `VERIFIED_MATCH` |
| 50 | `1/24/SET/BCS/263` | SHARVAN CHAUDHARY | `6afa10459131ed3bfbd66b42` | REVIEW — Sharvan Kumar Chaudhary | SHARVAN KUMAR CHAUDHARY<br>*(Note: Certificate: 'SHARVAN CHAUDHARY' vs DB: 'REVIEW — Sharvan Kumar Chaudhary | SHARVAN KUMAR CHAUDHARY')* | `1/24/SET/BCS/263` | `1/24/SET/BCS/263` | `EXACT_ROLL_NAME_CONFLICT` | `UNVERIFIED_AMBIGUOUS_NAME_DISCREPANCY` |
| 51 | `1/24/SET/BCS/264` | Aditya Chaurasia | `6afa10459131ed3bfbd66b43` | REVIEW — ADITYA KUMAR CHAURASIA | Aditya Kumar Chaurasia<br>*(Note: Certificate: 'Aditya Chaurasia' vs DB: 'REVIEW — ADITYA KUMAR CHAURASIA | Aditya Kumar Chaurasia')* | `1/24/SET/BCS/264` | `1/24/SET/BCS/264` | `EXACT_ROLL_NAME_CONFLICT` | `UNVERIFIED_AMBIGUOUS_NAME_DISCREPANCY` |
| 52 | `1/24/SET/BCS/265` | Mohit Mamgain | `6afa10459131ed3bfbd66b44` | REVIEW — Mohit Mamgain | MOHIT MAMGAIN | `1/24/SET/BCS/265` | `1/24/SET/BCS/265` | `EXACT_ROLL_NAME_VARIATION` | `REQUIRES_ADMIN_NAME_CLEANUP` |
| 53 | `1/24/SET/BCS/266` | Akram Khan | `6afa10459131ed3bfbd66b45` | AKRAM PARVEZ KHAN<br>*(Note: Certificate: 'Akram Khan' vs DB: 'AKRAM PARVEZ KHAN')* | `1/24/SET/BCS/266` | `1/24/SET/BCS/266` | `EXACT_ROLL_NAME_CONFLICT` | `UNVERIFIED_AMBIGUOUS_NAME_DISCREPANCY` |
| 54 | `1/24/SET/BCS/267` | Hamza Baksh | `6afa10459131ed3bfbd66b46` | REVIEW — HAMZA BAKSH | Hamza baksh | `1/24/SET/BCS/267` | `1/24/SET/BCS/267` | `EXACT_ROLL_NAME_VARIATION` | `REQUIRES_ADMIN_NAME_CLEANUP` |
| 55 | `1/24/SET/BCS/268` | Ankit Tiwari | `6afa10459131ed3bfbd66b47` | ANKIT TIWARI | `1/24/SET/BCS/268` | `1/24/SET/BCS/268` | `EXACT_ROLL_AND_NAME` | `VERIFIED_MATCH` |
| 56 | `1/24/SET/BCS/269` | Vanshika | `6afa10459131ed3bfbd66b48` | REVIEW — Vanshika | VANSHIKA | `1/24/SET/BCS/269` | `1/24/SET/BCS/269` | `EXACT_ROLL_NAME_VARIATION` | `REQUIRES_ADMIN_NAME_CLEANUP` |
| 57 | `1/24/SET/BCS/270` | Vanshika Gupta | `6afa10459131ed3bfbd66b49` | REVIEW — Vanshika Gupta | VANSHIKA GUPTA | `1/24/SET/BCS/270` | `1/24/SET/BCS/270` | `EXACT_ROLL_NAME_VARIATION` | `REQUIRES_ADMIN_NAME_CLEANUP` |
| 58 | `1/24/SET/BCS/271` | Devender Kashyap | `6afa10459131ed3bfbd66b4a` | DEVENDER KASHYAP | `1/24/SET/BCS/271` | `1/24/SET/BCS/271` | `EXACT_ROLL_AND_NAME` | `VERIFIED_MATCH` |
| 59 | `1/24/SET/BCS/274` | KARAN SINGH | `6afa10459131ed3bfbd66b4d` | REVIEW — KARAN SINGH | Karan singh | `1/24/SET/BCS/274` | `1/24/SET/BCS/274` | `EXACT_ROLL_NAME_VARIATION` | `REQUIRES_ADMIN_NAME_CLEANUP` |
| 60 | `1/24/SET/BCS/275` | PRANJAL NAGAR | `6afa10459131ed3bfbd66b4e` | REVIEW — Pranjal Nagar | PRANJAL NAGAR | `1/24/SET/BCS/275` | `1/24/SET/BCS/275` | `EXACT_ROLL_NAME_VARIATION` | `REQUIRES_ADMIN_NAME_CLEANUP` |
| 61 | `1/24/SET/BCS/277` | PRABAL JOSHI | `6afa10459131ed3bfbd66b50` | REVIEW — Prabal joshi | PRABAL JOSHI | `1/24/SET/BCS/277` | `1/24/SET/BCS/277` | `EXACT_ROLL_NAME_VARIATION` | `REQUIRES_ADMIN_NAME_CLEANUP` |
| 62 | `1/24/SET/BCS/278` | Khalid Sarfraz | `6afa10459131ed3bfbd66b51` | KHALID SARFRAZ | `1/24/SET/BCS/278` | `1/24/SET/BCS/278` | `EXACT_ROLL_AND_NAME` | `VERIFIED_MATCH` |
| 63 | `1/24/SET/BCS/279` | Shreyash Maurya | `6afa10459131ed3bfbd66b52` | REVIEW — SHREYASH MAURYA | Shreyash maurya | `1/24/SET/BCS/279` | `1/24/SET/BCS/279` | `EXACT_ROLL_NAME_VARIATION` | `REQUIRES_ADMIN_NAME_CLEANUP` |
| 64 | `1/24/SET/BCS/588` | Aman Kumar | `6afa10459131ed3bfbd66c64` | REVIEW — AMAN KUMAR | Aman kumar | `1/24/SET/BCS/588` | `1/24/SET/BCS/588` | `EXACT_ROLL_NAME_VARIATION` | `REQUIRES_ADMIN_NAME_CLEANUP` |

---

## 8. Conclusion & Recommended Action Plan

1. **No Database Writes Performed:** This audit adhered strictly to read-only constraints.
2. **Batch Preservation:** Rows 1 and 2 of the certificate list (`1/23/SET/BCS/095` and `1/23/SET/BCS/243`) are verified 2023 batch records and are preserved as 2023.
3. **Name Cleanup Authorization:** Admin approval is recommended to sanitize the 31 staging names carrying `REVIEW — ...` formatting in MongoDB to official names.
4. **Adjudication for 10 Name Discrepancies:** Cross-verify the 10 flagged student identities against registrar admission slips or photo ID cards before updating.
5. **Merge Sayyam Jaggi Duplicate:** Merge `1/24SET/BCS/319` into canonical `1/24/SET/BCS/319`.
6. **Re-link Abhinikesh User Account:** Re-link active user account from synthetic `20240002` to canonical `1/24/SET/BCS/231`.