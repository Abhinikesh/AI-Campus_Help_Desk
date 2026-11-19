# CampusSphere AI — Part 2.1: Student Database Integrity & Pre-Migration Verification Report

**Report Identifier:** `CAMPUSSPHERE_PART_2_1_PRE_MIGRATION_INTEGRITY_REPORT.md`  
**Audit Date:** November 19, 2026  
**Auditor Mode:** Strictly Read-Only / Pre-Migration Verification  
**Target Environment:** MongoDB `campus-erp` (Port 27018) | Core B.Tech CSE 2024 Batch  
**Authoritative Source:** Consolidated Student Master Workbook (`Internship Records` Sheet)  

---

## 1. Executive Summary & Reconciliation Re-Check

An independent, strictly read-only pre-migration integrity audit was performed on the official 2024 B.Tech Computer Science (BCS) student roster to establish an unassailable baseline before the Semester 5 transition.

Every entry from the authoritative official roster (326 total records) was cross-referenced against MongoDB `campus-erp`.

### High-Level Classification Summary

| Classification Category | Record Count | Percentage | Operational Meaning |
|---|:---:|:---:|---|
| **READY_FOR_SEMESTER_5** | **311** | **95.4%** | Unambiguous 2024 BCS records ready for 5th-semester progression |
| **REQUIRES_ADMIN_VERIFICATION** | **5** | **1.5%** | Records with roster duplicates, DB collisions, or absent entities |
| **NOT_ELIGIBLE_OR_OUT_OF_SCOPE** | **10** | **3.1%** | 2023 re-appear students (8) and 2025 lateral-entry students (2) |
| **TOTAL OFFICIAL ROSTER ENTRIES** | **326** | **100.0%** | **Perfect Mathematical Reconciliation** |

> **Audit Safeguard Confirmation:** Zero database writes were executed. Zero student records, roll numbers, sections, or user accounts were modified. The database remains in an identical state.

---

## 2. Phase 1 — Official Roster Verification

The official roster was extracted from `data/student_import/CampusSphere_AI_Consolidated_Student_Data.xlsx` (Sheet: `Internship Records`), filtering for Core B.Tech CSE sections A–E.

### Section Distribution

| Previous Section | Academic Term | Target Semester | Target Section | Official Roster Count | Verified Ready Count |
|:---:|:---:|:---:|:---:|:---:|:---:|
| **3CSA** | Semester 3 | 5 | **5CSA** | 68 | 68 |
| **3CSB** | Semester 3 | 5 | **5CSB** | 64 | 64 |
| **3CSC** | Semester 3 | 5 | **5CSC** | 66 | 64 |
| **3CSD** | Semester 3 | 5 | **5CSD** | 66 | 61 |
| **3CSE** | Semester 3 | 5 | **5CSE** | 62 | 54 |
| **TOTAL** | | | | **326** | **311** |

### Roster Data Quality Observations

1. **Section Count Balance:** Section sizes range between 62 and 68 students in the official roster.

2. **Duplicate Roster Entry:** Roll `1/24/SET/BCS/213` appears twice in the roster: Row 204 (Section D, `SARTHAK SHRIVASTAVA`) and Row 441 (Section D, `Sarthak Shrivastava`).

3. **Missing Student Name in Roster:** Row 189 lists roll `1/24/SET/BCS/197` in Section C with empty student name; column 9 contains the company string `'Alpha Forage Industrial Training & Internship'`.

---

## 3. Phase 2 — Independent MongoDB Reconciliation vs Part 2

In the Part 2 report (`CAMPUSSPHERE_2024_BCS_ROSTER_RECONCILIATION.md`), the summary reported:

- **Official Roster:** 326
- **Verified Matches:** 315
- **Missing from DB:** 11


### Reconciliation of Part 2 vs Part 2.1 Findings

When strictly evaluating the **2024 BCS canonical set (`1/24/SET/BCS/XXX`)**:

1. **The 11 'Missing from DB' records in Part 2 consist of:**

   - **8 Cross-Batch 2023 Students (`1/23/SET/BCS/XXX`):** Found in MongoDB under their 2023 roll numbers (`AKASH KUMAR VERMA`, `SANKIT OJHA`, etc.). They were excluded from canonical 2024 BCS matches because their degree program started in 2023.

   - **2 Lateral-Entry Students (`25/SET/BCSE(L)/XXX`):** Sandeep Kumar Singh (`001`) and Prakash Giri (`004`). In MongoDB, these records exist with a minor typo in their roll prefix: `25/SET/BCSE(L//001` and `25/SET/BCSE(L//004` (stored with double slashes).

   - **1 Genuinely Missing Record (`1/24/SET/BCS/197`):** Has no record in MongoDB under any roll number.

2. **The shift from 315 to 311 in `READY_FOR_SEMESTER_5`:**

   - Part 2 listed 315 verified matches by matching raw rolls to the database.

   - This pre-migration audit strictly enforces the safeguard: *'A record with unresolved identity, enrollment or section conflicts must not be marked ready.'*

   - Therefore, the 4 records with unresolved database or roster duplication:

     - `1/24/SET/BCS/319` (Sayyam Jaggi: duplicate DB record `1/24SET/BCS/319`)

     - `1/24/SET/BCS/272` (Nishant Thakurela: duplicate DB record `9389818925`)

     - `1/24/SET/BCS/213` (Sarthak Shrivastava: duplicate roster rows 204 and 441)

   were moved from Ready into `REQUIRES_ADMIN_VERIFICATION` (315 - 4 = 311).

---

## 4. Phase 3 — Academic Record Integrity Findings

Inspection of matched student documents in MongoDB revealed:

1. **Semester Value:** All 323 matched database student records currently carry `semester: 5`. (The database previously underwent initial semester field tagging).

2. **Section Value:** All 311 ready students match their previous section letter in MongoDB (`A`, `B`, `C`, `D`, `E`). Zero section mismatches exist.

3. **Enrollment & Account Status:** All canonical students have `status: 'active'` and `accountStatus: 'enrolled_offline'`.

4. **User Linkage:** All 311 ready students have `user: null`, safely enforcing that unprovisioned students cannot authenticate until officially activated.

---

## 5. Phase 4 — Identity and Dependency Verification

The 8 specific edge cases highlighted in the audit mandate were inspected across all MongoDB collections:


### 1. Eight Synthetic Records (`20240001`–`20240008`)

- **Student Records:** 8 documents (`Arjun Sharma`, `Abhinikesh`, `Rohan Verma`, `Sneha Patel`, `Ananya Rao`, `Aditya Nair`, `Meera Iyer`, `Kabir Singh`).

- **User Accounts:** 8 linked User documents with emails like `20240001@campus.edu`.

- **Dependencies:** Linked to 847 historical test attendance records (105–112 records each) and 2 face embeddings.

- **Conclusion:** Synthetic demo records. **Must be preserved** for offline testing and demo integrity; isolated from canonical BCS migration.


### 2. Sayyam Jaggi Duplicate Suffix `319`

- **Record A:** `_id: 6afa10459131ed3bfbd66b75`, Roll: `1/24/SET/BCS/319`, Section: `E`, Status: `active`.

- **Record B:** `_id: 6afa10459131ed3bfbd66a43`, Roll: `1/24SET/BCS/319` (missing first slash), Section: `null`.

- **Dependencies:** Zero attendance or face records on either.

- **Recommendation:** Administrator must delete or merge orphan Record B (`1/24SET/BCS/319`) before migrating Record A.


### 3. Nishant Thakurela Phone-Number Roll

- **Record A:** `_id: 6afa10459131ed3bfbd66b4b`, Roll: `1/24/SET/BCS/272`, Section: `E`, Phone: `9389818925`.

- **Record B:** `_id: 6afa10459131ed3bfbd66c6a`, Roll: `9389818925` (phone number stored as roll), Section: `null`.

- **Dependencies:** Zero attendance or face records on Record B.

- **Recommendation:** Administrator must remove duplicate Record B (`9389818925`) and retain Record A.


### 4. `TEMP56839`

- **Student Record:** `_id: 6afa21236d40659eaef67935`, Roll: `TEMP56839`, Name: `Temp Student`, Section: `null`.

- **Dependencies:** 0 attendance, 0 face embeddings.

- **Conclusion:** Staging test artifact. Outside 2024 BCS scope.


### 5. Six Cross-Roll Name Collisions

- Verified that distinct students sharing common first names (e.g. `Kunal Yadav` vs `Kunal Majumdar`, `Sagar` vs `Sagar Gupta`, `Nishant Ranjan` vs `Nishant Kodan`) have unique roll numbers and separate database record IDs. Zero identity cross-contamination exists.


### 6. Eight Cross-Batch Records Using `1/23/SET/BCS/XXX`

- 8 students from the 2023 admission cohort are listed in the roster under sections C, D, and E:

  - `1/23/SET/BCS/182` (SANKIT OJHA — Sec C)

  - `1/23/SET/BCS/095` (KUNAL BHARGAVA — Sec D)

  - `1/23/SET/BCS/104` (AYUSH KUMAR SINGH — Sec D)

  - `1/23/SET/BCS/243` (MAYANK SOAM — Sec D)

  - `1/23/SET/BCS/078` (AKASH KUMAR VERMA — Sec E)

  - `1/23/SET/BCS/079` (UJJAWAL PRAKASH SINGH — Sec E)

  - `1/23/SET/BCS/149` (PRIYANSHU SINHA — Sec E)

  - `1/23/SET/BCS/162` (ROHAN CHAUDHARY — Sec E)

- **Conclusion:** Classified as `NOT_ELIGIBLE_OR_OUT_OF_SCOPE` for the 2024 BCS promotion; require separate 2023-batch academic progression review.


### 7. Two Lateral-Entry Records

- `25/SET/BCSE(L)/001` (SANDEEP KUMAR SINGH) & `25/SET/BCSE(L)/004` (PRAKASH GIRI).

- Both exist in MongoDB under IDs `6afa10459131ed3bfbd66c68` and `6afa10459131ed3bfbd66c69` with roll typo `(L//001` and `(L//004`.

- **Conclusion:** Out of scope for 2024 BCS canonical progression; requires administrative roll format normalization.


### 8. Roll `1/24/SET/BCS/197` (Alpha Forage)

- Roster Row 189 lists `1/24/SET/BCS/197` with name `Alpha Forage Industrial Training & Internship`.

- Genuinely absent from MongoDB.

- **Conclusion:** Classified as `REQUIRES_ADMIN_VERIFICATION`.

---

## 6. Phase 5 & 6 — Transition Preview (READY_FOR_SEMESTER_5)

The following **311 students** meet all academic, identity, and enrollment criteria without ambiguity and are confirmed **READY_FOR_SEMESTER_5**.


| # | Student Name | Official Roll Number | Previous Semester | Previous Section | Target Semester | Target Section | Database Record ID | Verification Status |
|:---:|---|---|:---:|:---:|:---:|:---:|---|:---:|
| 1 | HARSHIT SINGH RAJPUT | `1/24/SET/BCS/001` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a4f` | **VERIFIED** |
| 2 | KUNAL MAJUMDAR | `1/24/SET/BCS/002` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a50` | **VERIFIED** |
| 3 | SOHIL | `1/24/SET/BCS/003` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a51` | **VERIFIED** |
| 4 | SANGAM KUMAR MISHRA | `1/24/SET/BCS/004` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a52` | **VERIFIED** |
| 5 | TAVISHA BUDHIRAJA | `1/24/SET/BCS/005` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a53` | **VERIFIED** |
| 6 | DIVYANSH MAYANK | `1/24/SET/BCS/006` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a54` | **VERIFIED** |
| 7 | NISHANT RANJAN | `1/24/SET/BCS/007` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a55` | **VERIFIED** |
| 8 | V VISHNU | `1/24/SET/BCS/008` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a56` | **VERIFIED** |
| 9 | ADARSH | `1/24/SET/BCS/009` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a57` | **VERIFIED** |
| 10 | KUNAL | `1/24/SET/BCS/010` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a58` | **VERIFIED** |
| 11 | RAUNAK RAJ | `1/24/SET/BCS/011` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a59` | **VERIFIED** |
| 12 | PANKAJ SINGH | `1/24/SET/BCS/012` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a5a` | **VERIFIED** |
| 13 | ROHIT KUMAR | `1/24/SET/BCS/013` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a5b` | **VERIFIED** |
| 14 | SIDDHARTH DAGAR | `1/24/SET/BCS/015` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a5c` | **VERIFIED** |
| 15 | KRISHNA SHARMA | `1/24/SET/BCS/016` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a5d` | **VERIFIED** |
| 16 | SAUMAY SHASHANK | `1/24/SET/BCS/017` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a5e` | **VERIFIED** |
| 17 | VAISHNAVI | `1/24/SET/BCS/018` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a5f` | **VERIFIED** |
| 18 | KRITIKA GARG | `1/24/SET/BCS/019` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a60` | **VERIFIED** |
| 19 | NISHANT | `1/24/SET/BCS/020` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a61` | **VERIFIED** |
| 20 | Grisha Bhatia | `1/24/SET/BCS/021` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a62` | **VERIFIED** |
| 21 | ADITYA PAWARIA | `1/24/SET/BCS/022` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a63` | **VERIFIED** |
| 22 | JATIN . | `1/24/SET/BCS/023` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a64` | **VERIFIED** |
| 23 | ARYAN GUPTA | `1/24/SET/BCS/024` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a65` | **VERIFIED** |
| 24 | ANISH . | `1/24/SET/BCS/025` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a66` | **VERIFIED** |
| 25 | MAYANK RATH | `1/24/SET/BCS/026` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a67` | **VERIFIED** |
| 26 | SAGAR | `1/24/SET/BCS/027` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a68` | **VERIFIED** |
| 27 | SAMEER KUMAR | `1/24/SET/BCS/028` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a69` | **VERIFIED** |
| 28 | JATIN KUMAR | `1/24/SET/BCS/029` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a6a` | **VERIFIED** |
| 29 | ARCHIT VASHISTH | `1/24/SET/BCS/030` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a6b` | **VERIFIED** |
| 30 | ANANT PATHAK | `1/24/SET/BCS/031` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a6c` | **VERIFIED** |
| 31 | SANJOY GOSWAMI JOTIRMOY | `1/24/SET/BCS/032` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a6d` | **VERIFIED** |
| 32 | ANURAG BATHAM | `1/24/SET/BCS/033` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a6e` | **VERIFIED** |
| 33 | VANSHIKA | `1/24/SET/BCS/034` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a6f` | **VERIFIED** |
| 34 | DHEEMANT SETIA | `1/24/SET/BCS/035` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a70` | **VERIFIED** |
| 35 | ANSH . | `1/24/SET/BCS/036` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a71` | **VERIFIED** |
| 36 | UJJAWAL MISHRA | `1/24/SET/BCS/037` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a72` | **VERIFIED** |
| 37 | TANISH CHAUHAN | `1/24/SET/BCS/038` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a73` | **VERIFIED** |
| 38 | KOUSHAL SHARMA | `1/24/SET/BCS/039` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a74` | **VERIFIED** |
| 39 | ANURAG PANDEY | `1/24/SET/BCS/040` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a75` | **VERIFIED** |
| 40 | SHIVANSH SHOURYA | `1/24/SET/BCS/041` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a76` | **VERIFIED** |
| 41 | DHEERAJ NANDA | `1/24/SET/BCS/042` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a77` | **VERIFIED** |
| 42 | PUNEET VASHISTH | `1/24/SET/BCS/043` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a78` | **VERIFIED** |
| 43 | SOHIL KR SINGH | `1/24/SET/BCS/044` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a79` | **VERIFIED** |
| 44 | TANMAY ZUTSHI | `1/24/SET/BCS/045` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a7a` | **VERIFIED** |
| 45 | IMRAN ALI | `1/24/SET/BCS/046` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a7b` | **VERIFIED** |
| 46 | ROHIT RAWAT | `1/24/SET/BCS/047` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a7c` | **VERIFIED** |
| 47 | KESHAV SINGH | `1/24/SET/BCS/048` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a7d` | **VERIFIED** |
| 48 | SHIVAM BISHT | `1/24/SET/BCS/049` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a7e` | **VERIFIED** |
| 49 | KUNAL . | `1/24/SET/BCS/050` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a7f` | **VERIFIED** |
| 50 | NIDHI SHARMA | `1/24/SET/BCS/051` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a80` | **VERIFIED** |
| 51 | TANAY PARASHAR | `1/24/SET/BCS/052` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a81` | **VERIFIED** |
| 52 | ANSHUL KUMAR | `1/24/SET/BCS/053` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a82` | **VERIFIED** |
| 53 | PRIYANSHU KUMAR | `1/24/SET/BCS/054` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a83` | **VERIFIED** |
| 54 | SAKSHAM JAIN | `1/24/SET/BCS/055` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a84` | **VERIFIED** |
| 55 | RAGHAV PARASHAR | `1/24/SET/BCS/056` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a85` | **VERIFIED** |
| 56 | DARSHAN R H | `1/24/SET/BCS/057` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a86` | **VERIFIED** |
| 57 | HARSH | `1/24/SET/BCS/058` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a87` | **VERIFIED** |
| 58 | TANISHQ KHANDELWAL | `1/24/SET/BCS/059` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a88` | **VERIFIED** |
| 59 | SAMRAT | `1/24/SET/BCS/060` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a89` | **VERIFIED** |
| 60 | PRINCE KUMAR SINGH | `1/24/SET/BCS/061` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a8a` | **VERIFIED** |
| 61 | ADITYA PATHAK | `1/24/SET/BCS/062` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a8b` | **VERIFIED** |
| 62 | RAGHAV PANDEY | `1/24/SET/BCS/063` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a8c` | **VERIFIED** |
| 63 | SUMIT | `1/24/SET/BCS/064` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a8d` | **VERIFIED** |
| 64 | LAKSHIT KUMAR | `1/24/SET/BCS/065` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a8e` | **VERIFIED** |
| 65 | MAYANK CHOUDHARY | `1/24/SET/BCS/066` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a8f` | **VERIFIED** |
| 66 | VANSH RAWAT | `1/24/SET/BCS/067` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a90` | **VERIFIED** |
| 67 | SINGU SHHYAAM KUMAR | `1/24/SET/BCS/068` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66a91` | **VERIFIED** |
| 68 | BHAVYA | `1/24/SET/BCS/527` | 3 | 3CSA | 5 | 5CSA | `6afa10459131ed3bfbd66c32` | **VERIFIED** |
| 69 | MAYANK GUPTA | `1/24/SET/BCS/070` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66a92` | **VERIFIED** |
| 70 | SHAZEEN HAIDER | `1/24/SET/BCS/072` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66a93` | **VERIFIED** |
| 71 | ABHEY SUNDRIYAL | `1/24/SET/BCS/073` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66a94` | **VERIFIED** |
| 72 | VIVEK . | `1/24/SET/BCS/074` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66a95` | **VERIFIED** |
| 73 | BHARAT BHANDARI | `1/24/SET/BCS/075` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66a96` | **VERIFIED** |
| 74 | BHUMIKA KAMBOJ | `1/24/SET/BCS/076` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66a97` | **VERIFIED** |
| 75 | JATIN SHARMA | `1/24/SET/BCS/077` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66a98` | **VERIFIED** |
| 76 | MUSTAK .. | `1/24/SET/BCS/080` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66a9b` | **VERIFIED** |
| 77 | SIDHANT KUMAR SINGH | `1/24/SET/BCS/081` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66a9c` | **VERIFIED** |
| 78 | MD MEHRAB ALAM | `1/24/SET/BCS/082` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66a9d` | **VERIFIED** |
| 79 | AKSHIT SHARMA | `1/24/SET/BCS/083` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66a9e` | **VERIFIED** |
| 80 | CHINMAY KUMAR PANDEY | `1/24/SET/BCS/084` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66a9f` | **VERIFIED** |
| 81 | YES CHANDRA | `1/24/SET/BCS/085` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66aa0` | **VERIFIED** |
| 82 | HARIOM PRASAD KANU | `1/24/SET/BCS/086` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66aa1` | **VERIFIED** |
| 83 | NAVYA SHARMA | `1/24/SET/BCS/087` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66aa2` | **VERIFIED** |
| 84 | JAY PRAKASH JHA | `1/24/SET/BCS/089` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66aa3` | **VERIFIED** |
| 85 | SHIVAM JHA | `1/24/SET/BCS/090` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66aa4` | **VERIFIED** |
| 86 | DEEPENDRA SINGH CHAUHAN | `1/24/SET/BCS/091` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66aa5` | **VERIFIED** |
| 87 | YASH . | `1/24/SET/BCS/092` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66aa6` | **VERIFIED** |
| 88 | ANISHA PRAVIN | `1/24/SET/BCS/093` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66aa7` | **VERIFIED** |
| 89 | SURESH JOSHI | `1/24/SET/BCS/094` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66aa8` | **VERIFIED** |
| 90 | AMAN BANGARI | `1/24/SET/BCS/095` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66aa9` | **VERIFIED** |
| 91 | RAJAT PANDEY | `1/24/SET/BCS/096` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66aaa` | **VERIFIED** |
| 92 | SPARSH JAIN | `1/24/SET/BCS/097` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66aab` | **VERIFIED** |
| 93 | SACHIN KUMAR | `1/24/SET/BCS/098` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66aac` | **VERIFIED** |
| 94 | AVINASH KUMAR | `1/24/SET/BCS/099` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66aad` | **VERIFIED** |
| 95 | KEISHA SHARMA | `1/24/SET/BCS/100` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66aae` | **VERIFIED** |
| 96 | VIBHUTI AGGARWAL | `1/24/SET/BCS/101` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66aaf` | **VERIFIED** |
| 97 | PALAK VASHIST | `1/24/SET/BCS/102` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66ab0` | **VERIFIED** |
| 98 | CHAHAT SHARMA | `1/24/SET/BCS/103` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66ab1` | **VERIFIED** |
| 99 | ASHWANI DWIVEDI | `1/24/SET/BCS/104` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66ab2` | **VERIFIED** |
| 100 | SHIVAM YADAV | `1/24/SET/BCS/105` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66ab3` | **VERIFIED** |
| 101 | KOMAL KUMARI | `1/24/SET/BCS/106` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66ab4` | **VERIFIED** |
| 102 | PANKAJ KUMAR | `1/24/SET/BCS/108` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66ab5` | **VERIFIED** |
| 103 | ARUN | `1/24/SET/BCS/109` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66ab6` | **VERIFIED** |
| 104 | Chandesh Patwari | `1/24/SET/BCS/110` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66ab7` | **VERIFIED** |
| 105 | VIVEK TAWAR | `1/24/SET/BCS/111` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66ab8` | **VERIFIED** |
| 106 | SOUMITRA JANA | `1/24/SET/BCS/112` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66ab9` | **VERIFIED** |
| 107 | AYUSH KUMAR CHAUHAN | `1/24/SET/BCS/113` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66aba` | **VERIFIED** |
| 108 | YASH GOYAL | `1/24/SET/BCS/114` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66abb` | **VERIFIED** |
| 109 | ONKAR NATH SINGH | `1/24/SET/BCS/115` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66abc` | **VERIFIED** |
| 110 | PRIBHASH KASHYAP | `1/24/SET/BCS/116` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66abd` | **VERIFIED** |
| 111 | RUPESH SINGH | `1/24/SET/BCS/117` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66abe` | **VERIFIED** |
| 112 | SATYAM . | `1/24/SET/BCS/118` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66abf` | **VERIFIED** |
| 113 | AMAN RATHEE | `1/24/SET/BCS/119` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66ac0` | **VERIFIED** |
| 114 | NAVYA PANDEY | `1/24/SET/BCS/120` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66ac1` | **VERIFIED** |
| 115 | DEEPANSHU GOYAL | `1/24/SET/BCS/122` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66ac2` | **VERIFIED** |
| 116 | ARYAN GUPTA | `1/24/SET/BCS/123` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66ac3` | **VERIFIED** |
| 117 | ADAR CHOWDHURY ABHURA | `1/24/SET/BCS/124` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66ac4` | **VERIFIED** |
| 118 | VINEET SHUKLA | `1/24/SET/BCS/126` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66ac5` | **VERIFIED** |
| 119 | VISHWANATH THAKUR | `1/24/SET/BCS/128` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66ac6` | **VERIFIED** |
| 120 | CHIRAG GARG | `1/24/SET/BCS/129` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66ac7` | **VERIFIED** |
| 121 | PHALGUNI . | `1/24/SET/BCS/130` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66ac8` | **VERIFIED** |
| 122 | KUSHAL BHARATI | `1/24/SET/BCS/131` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66ac9` | **VERIFIED** |
| 123 | AANAYA | `1/24/SET/BCS/132` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66aca` | **VERIFIED** |
| 124 | KIRTI SINGH | `1/24/SET/BCS/133` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66acb` | **VERIFIED** |
| 125 | YATIN SINGH | `1/24/SET/BCS/134` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66acc` | **VERIFIED** |
| 126 | ANIRUDH RATURI | `1/24/SET/BCS/135` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66acd` | **VERIFIED** |
| 127 | INDRAJEET KUMAR | `1/24/SET/BCS/136` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66ace` | **VERIFIED** |
| 128 | KRISH ADHIKARI | `1/24/SET/BCS/137` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66acf` | **VERIFIED** |
| 129 | NARENDRA MALLAH | `1/24/SET/BCS/139` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66ad1` | **VERIFIED** |
| 130 | HIMANSHU CHAUHAN | `1/24/SET/BCS/140` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66ad2` | **VERIFIED** |
| 131 | BHUMI CHOUDHARY | `1/24/SET/BCS/205` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66b0e` | **VERIFIED** |
| 132 | SIDH BHATIA | `1/24/SET/BCS/437` | 3 | 3CSB | 5 | 5CSB | `6afa10459131ed3bfbd66bdb` | **VERIFIED** |
| 133 | VINMRA SHARMA | `1/24/SET/BCS/138` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66ad0` | **VERIFIED** |
| 134 | NIKHIL KUMAR BAGHEL | `1/24/SET/BCS/141` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66ad3` | **VERIFIED** |
| 135 | PRIYANSHU ROY | `1/24/SET/BCS/142` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66ad4` | **VERIFIED** |
| 136 | DIVAKAR | `1/24/SET/BCS/143` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66ad5` | **VERIFIED** |
| 137 | NISHANT KODAN | `1/24/SET/BCS/144` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66ad6` | **VERIFIED** |
| 138 | DEV KAUSHIK | `1/24/SET/BCS/145` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66ad7` | **VERIFIED** |
| 139 | SHIVAM MISSRA | `1/24/SET/BCS/146` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66ad8` | **VERIFIED** |
| 140 | TUSHAR . | `1/24/SET/BCS/147` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66ad9` | **VERIFIED** |
| 141 | NIKHIL KUMAR | `1/24/SET/BCS/148` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66ada` | **VERIFIED** |
| 142 | HEERAL SHARMA | `1/24/SET/BCS/149` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66adb` | **VERIFIED** |
| 143 | MANISH RANJAN | `1/24/SET/BCS/150` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66adc` | **VERIFIED** |
| 144 | PRANAY GAUR | `1/24/SET/BCS/151` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66add` | **VERIFIED** |
| 145 | SUHANI SINGH | `1/24/SET/BCS/152` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66ade` | **VERIFIED** |
| 146 | RAJESH KUMAR GUPTA | `1/24/SET/BCS/153` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66adf` | **VERIFIED** |
| 147 | SAMEER KUMAR SINGH | `1/24/SET/BCS/154` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66ae0` | **VERIFIED** |
| 148 | NAVED KHAN | `1/24/SET/BCS/155` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66ae1` | **VERIFIED** |
| 149 | ABHAY NAUTIYAL | `1/24/SET/BCS/157` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66ae2` | **VERIFIED** |
| 150 | ABHAY ARORA | `1/24/SET/BCS/158` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66ae3` | **VERIFIED** |
| 151 | SHIVAM KUMAR SHIVAM | `1/24/SET/BCS/159` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66ae4` | **VERIFIED** |
| 152 | RITIKA | `1/24/SET/BCS/161` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66ae5` | **VERIFIED** |
| 153 | ANURAG KAUSHIK | `1/24/SET/BCS/162` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66ae6` | **VERIFIED** |
| 154 | ANKITA MISHRA | `1/24/SET/BCS/163` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66ae7` | **VERIFIED** |
| 155 | KHUSHANT MITTAL | `1/24/SET/BCS/164` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66ae8` | **VERIFIED** |
| 156 | DEEPAK KUMAR THAKUR | `1/24/SET/BCS/165` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66ae9` | **VERIFIED** |
| 157 | RUDRA PRATAP SINGH | `1/24/SET/BCS/166` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66aea` | **VERIFIED** |
| 158 | BHAVISHYA | `1/24/SET/BCS/168` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66aeb` | **VERIFIED** |
| 159 | DISHA GARG | `1/24/SET/BCS/169` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66aec` | **VERIFIED** |
| 160 | MANAV AWANA | `1/24/SET/BCS/170` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66aed` | **VERIFIED** |
| 161 | SHREYA KANTHAL | `1/24/SET/BCS/171` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66aee` | **VERIFIED** |
| 162 | YASHASHVA RAWAT | `1/24/SET/BCS/172` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66aef` | **VERIFIED** |
| 163 | VIVEK YADAV | `1/24/SET/BCS/173` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66af0` | **VERIFIED** |
| 164 | ADITYA JAIN | `1/24/SET/BCS/174` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66af1` | **VERIFIED** |
| 165 | KUNAL ARYA | `1/24/SET/BCS/175` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66af2` | **VERIFIED** |
| 166 | JIVESH KUMAR | `1/24/SET/BCS/176` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66af3` | **VERIFIED** |
| 167 | YASH DAGAR | `1/24/SET/BCS/177` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66af4` | **VERIFIED** |
| 168 | ANKUL RAJ | `1/24/SET/BCS/178` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66af5` | **VERIFIED** |
| 169 | AMIT KUMAR | `1/24/SET/BCS/179` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66af6` | **VERIFIED** |
| 170 | SHAGUN GOYAL | `1/24/SET/BCS/180` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66af7` | **VERIFIED** |
| 171 | KARAN SINGH | `1/24/SET/BCS/181` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66af8` | **VERIFIED** |
| 172 | ATIN KUMAR | `1/24/SET/BCS/182` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66af9` | **VERIFIED** |
| 173 | SAKSHAM PRUTHI | `1/24/SET/BCS/183` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66afa` | **VERIFIED** |
| 174 | PARISI VERMA | `1/24/SET/BCS/184` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66afb` | **VERIFIED** |
| 175 | MAYANK PANDEY | `1/24/SET/BCS/185` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66afc` | **VERIFIED** |
| 176 | TAHAM AAWEZ | `1/24/SET/BCS/186` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66afd` | **VERIFIED** |
| 177 | VINEET KUMAR | `1/24/SET/BCS/187` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66afe` | **VERIFIED** |
| 178 | SHIVAM SINGH | `1/24/SET/BCS/188` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66aff` | **VERIFIED** |
| 179 | ATUL | `1/24/SET/BCS/189` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66b00` | **VERIFIED** |
| 180 | VIDHI JAIN | `1/24/SET/BCS/190` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66b01` | **VERIFIED** |
| 181 | HARSHIT SHARMA | `1/24/SET/BCS/191` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66b02` | **VERIFIED** |
| 182 | MAYANK NIRWAN | `1/24/SET/BCS/192` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66b03` | **VERIFIED** |
| 183 | LUCKY KUMAR | `1/24/SET/BCS/193` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66b04` | **VERIFIED** |
| 184 | ARNAV PANWAR | `1/24/SET/BCS/194` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66b05` | **VERIFIED** |
| 185 | MEHAK . | `1/24/SET/BCS/195` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66b06` | **VERIFIED** |
| 186 | JAIYANT GARG | `1/24/SET/BCS/196` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66b07` | **VERIFIED** |
| 187 | ANANYA NAYAK | `1/24/SET/BCS/198` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66b08` | **VERIFIED** |
| 188 | ANUBHAV DUBEY | `1/24/SET/BCS/199` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66b09` | **VERIFIED** |
| 189 | PRASANJEET BARICK | `1/24/SET/BCS/200` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66b0a` | **VERIFIED** |
| 190 | YASHASHVI . | `1/24/SET/BCS/202` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66b0b` | **VERIFIED** |
| 191 | VARUN . | `1/24/SET/BCS/203` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66b0c` | **VERIFIED** |
| 192 | RISHI RANJAN | `1/24/SET/BCS/204` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66b0d` | **VERIFIED** |
| 193 | KARTIK MALIK | `1/24/SET/BCS/207` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66b0f` | **VERIFIED** |
| 194 | LALITA | `1/24/SET/BCS/208` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66b10` | **VERIFIED** |
| 195 | ANANYA VERMA | `1/24/SET/BCS/210` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66b11` | **VERIFIED** |
| 196 | DAKSH DEV | `1/24/SET/BCS/211` | 3 | 3CSC | 5 | 5CSC | `6afa10459131ed3bfbd66b12` | **VERIFIED** |
| 197 | ADITYA RAJ | `1/24/SET/BCS/212` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b13` | **VERIFIED** |
| 198 | MRINAL CHOWDHARY | `1/24/SET/BCS/214` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b15` | **VERIFIED** |
| 199 | DIVYANJALI DINKAR | `1/24/SET/BCS/215` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b16` | **VERIFIED** |
| 200 | PREETI SHARMA | `1/24/SET/BCS/216` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b17` | **VERIFIED** |
| 201 | YERRAGOLLA NARENDRA | `1/24/SET/BCS/217` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b18` | **VERIFIED** |
| 202 | RAJ KUMAR SAH | `1/24/SET/BCS/219` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b19` | **VERIFIED** |
| 203 | OMKESH KUMAR CHATURBEDI | `1/24/SET/BCS/220` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b1a` | **VERIFIED** |
| 204 | ANSHIKA AGGARWAL | `1/24/SET/BCS/221` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b1b` | **VERIFIED** |
| 205 | SHIVAM MISHRA | `1/24/SET/BCS/222` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b1c` | **VERIFIED** |
| 206 | ANISH KUMAR | `1/24/SET/BCS/223` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b1d` | **VERIFIED** |
| 207 | ANSH YADAV | `1/24/SET/BCS/224` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b1e` | **VERIFIED** |
| 208 | PRIYANSHU KUMAR | `1/24/SET/BCS/225` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b1f` | **VERIFIED** |
| 209 | ADITYA SHARMA | `1/24/SET/BCS/226` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b20` | **VERIFIED** |
| 210 | CHANCHAL . | `1/24/SET/BCS/227` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b21` | **VERIFIED** |
| 211 | JATIN ARORA | `1/24/SET/BCS/228` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b22` | **VERIFIED** |
| 212 | LAKSHEY | `1/24/SET/BCS/229` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b23` | **VERIFIED** |
| 213 | SHIVANG GUPTA | `1/24/SET/BCS/230` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b24` | **VERIFIED** |
| 214 | ABHINIKESH KUMAR | `1/24/SET/BCS/231` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b25` | **VERIFIED** |
| 215 | KASVI SHARMA | `1/24/SET/BCS/232` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b26` | **VERIFIED** |
| 216 | AYUSH PARASHER | `1/24/SET/BCS/233` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b27` | **VERIFIED** |
| 217 | HARSH SINGH | `1/24/SET/BCS/234` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b28` | **VERIFIED** |
| 218 | ABHINAV KUMAR | `1/24/SET/BCS/235` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b29` | **VERIFIED** |
| 219 | HIMANSHU GARG | `1/24/SET/BCS/236` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b2a` | **VERIFIED** |
| 220 | AYUSH THAKUR | `1/24/SET/BCS/237` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b2b` | **VERIFIED** |
| 221 | SOBIT PARASHAR | `1/24/SET/BCS/238` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b2c` | **VERIFIED** |
| 222 | ONKAR SHUKLA | `1/24/SET/BCS/239` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b2d` | **VERIFIED** |
| 223 | PRAGAM DUBEY | `1/24/SET/BCS/240` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b2e` | **VERIFIED** |
| 224 | VIDIT DUBEY | `1/24/SET/BCS/241` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b2f` | **VERIFIED** |
| 225 | PASAM RAKESH REDDY | `1/24/SET/BCS/242` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b30` | **VERIFIED** |
| 226 | PRIYANSHU | `1/24/SET/BCS/243` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b31` | **VERIFIED** |
| 227 | RAYAPU REDDY CHARAN SIMHA REDDY | `1/24/SET/BCS/244` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b32` | **VERIFIED** |
| 228 | PRARTHNA SINGH | `1/24/SET/BCS/245` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b33` | **VERIFIED** |
| 229 | MISHRA RITESH KUMAR NAGENDRA KUMAR | `1/24/SET/BCS/246` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b34` | **VERIFIED** |
| 230 | GRANTH CHUGH | `1/24/SET/BCS/247` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b35` | **VERIFIED** |
| 231 | MOHD SADAF | `1/24/SET/BCS/248` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b36` | **VERIFIED** |
| 232 | TEENA . | `1/24/SET/BCS/249` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b37` | **VERIFIED** |
| 233 | SHREYA DOHA | `1/24/SET/BCS/250` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b38` | **VERIFIED** |
| 234 | RAMIREDDY GANGA SUDARSHAN RDDY | `1/24/SET/BCS/251` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b39` | **VERIFIED** |
| 235 | SHOBHIT MISHRA | `1/24/SET/BCS/252` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b3a` | **VERIFIED** |
| 236 | MD SAHIL | `1/24/SET/BCS/253` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b3b` | **VERIFIED** |
| 237 | ISHIKA GOYAL | `1/24/SET/BCS/254` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b3c` | **VERIFIED** |
| 238 | TANISHK MANOJ SHARMA | `1/24/SET/BCS/257` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b3d` | **VERIFIED** |
| 239 | LUCKY | `1/24/SET/BCS/259` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b3e` | **VERIFIED** |
| 240 | PUNEET DALAL | `1/24/SET/BCS/260` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b3f` | **VERIFIED** |
| 241 | SHIMESH GUPTA | `1/24/SET/BCS/261` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b40` | **VERIFIED** |
| 242 | KRITIKA SAH | `1/24/SET/BCS/262` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b41` | **VERIFIED** |
| 243 | SHARVAN KUMAR CHAUDHARY | `1/24/SET/BCS/263` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b42` | **VERIFIED** |
| 244 | ADITYA KUMAR CHAURASIA | `1/24/SET/BCS/264` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b43` | **VERIFIED** |
| 245 | MOHIT MAMGAIN | `1/24/SET/BCS/265` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b44` | **VERIFIED** |
| 246 | AKRAM PARVEZ KHAN | `1/24/SET/BCS/266` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b45` | **VERIFIED** |
| 247 | HAMZA BAKSH | `1/24/SET/BCS/267` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b46` | **VERIFIED** |
| 248 | ANKIT TIWARI | `1/24/SET/BCS/268` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b47` | **VERIFIED** |
| 249 | VANSHIKA | `1/24/SET/BCS/269` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b48` | **VERIFIED** |
| 250 | VANSHIKA GUPTA | `1/24/SET/BCS/270` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b49` | **VERIFIED** |
| 251 | DEVENDER KASHYAP | `1/24/SET/BCS/271` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b4a` | **VERIFIED** |
| 252 | KARAN SINGH | `1/24/SET/BCS/274` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b4d` | **VERIFIED** |
| 253 | PRANJAL NAGAR | `1/24/SET/BCS/275` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b4e` | **VERIFIED** |
| 254 | PRABAL JOSHI | `1/24/SET/BCS/277` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b50` | **VERIFIED** |
| 255 | KHALID SARFRAZ | `1/24/SET/BCS/278` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b51` | **VERIFIED** |
| 256 | SHREYASH MAURYA | `1/24/SET/BCS/279` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66b52` | **VERIFIED** |
| 257 | AMAN KUMAR | `1/24/SET/BCS/588` | 3 | 3CSD | 5 | 5CSD | `6afa10459131ed3bfbd66c64` | **VERIFIED** |
| 258 | ADITYA VATS | `1/24/SET/BCS/273` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b4c` | **VERIFIED** |
| 259 | PRATYUSH SINGHAL | `1/24/SET/BCS/276` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b4f` | **VERIFIED** |
| 260 | ANUBHAV MISHRA | `1/24/SET/BCS/280` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b53` | **VERIFIED** |
| 261 | MAYANK KASHYAP | `1/24/SET/BCS/281` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b54` | **VERIFIED** |
| 262 | CHIRAG KASHYAP | `1/24/SET/BCS/282` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b55` | **VERIFIED** |
| 263 | DEVANSHU AGNIHOTRI | `1/24/SET/BCS/283` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b56` | **VERIFIED** |
| 264 | GAURI SINGH | `1/24/SET/BCS/285` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b57` | **VERIFIED** |
| 265 | MANAN SHEKHAWAT | `1/24/SET/BCS/286` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b58` | **VERIFIED** |
| 266 | HARSH VERMA | `1/24/SET/BCS/287` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b59` | **VERIFIED** |
| 267 | JAI SURYA XESS | `1/24/SET/BCS/288` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b5a` | **VERIFIED** |
| 268 | TANISHA . | `1/24/SET/BCS/289` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b5b` | **VERIFIED** |
| 269 | MOHD AHAD ALI | `1/24/SET/BCS/290` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b5c` | **VERIFIED** |
| 270 | AKSHITA RAWAT | `1/24/SET/BCS/291` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b5d` | **VERIFIED** |
| 271 | ABHISHEK . | `1/24/SET/BCS/292` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b5e` | **VERIFIED** |
| 272 | VANSHIKA . | `1/24/SET/BCS/293` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b5f` | **VERIFIED** |
| 273 | UTPAL KANT | `1/24/SET/BCS/294` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b60` | **VERIFIED** |
| 274 | KIRANJEET KAUR | `1/24/SET/BCS/295` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b61` | **VERIFIED** |
| 275 | YUSUF ANSARI | `1/24/SET/BCS/297` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b62` | **VERIFIED** |
| 276 | DRISHTI PARASHAR | `1/24/SET/BCS/298` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b63` | **VERIFIED** |
| 277 | DHRUV DABRAL | `1/24/SET/BCS/299` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b64` | **VERIFIED** |
| 278 | LAKSHIYTA SURI | `1/24/SET/BCS/300` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b65` | **VERIFIED** |
| 279 | RACHIT TEWATIA | `1/24/SET/BCS/301` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b66` | **VERIFIED** |
| 280 | ASHISH RAJ | `1/24/SET/BCS/302` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b67` | **VERIFIED** |
| 281 | KHUSHI . | `1/24/SET/BCS/303` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b68` | **VERIFIED** |
| 282 | PARTH BAREJA | `1/24/SET/BCS/304` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b69` | **VERIFIED** |
| 283 | MAANYATA KANTH | `1/24/SET/BCS/305` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b6a` | **VERIFIED** |
| 284 | DIPANSHU KUSHWAHA | `1/24/SET/BCS/306` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b6b` | **VERIFIED** |
| 285 | SIMRA FATIMA | `1/24/SET/BCS/307` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b6c` | **VERIFIED** |
| 286 | KRISHNA AHUJA | `1/24/SET/BCS/308` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b6d` | **VERIFIED** |
| 287 | MANTHAN S PRAKASH | `1/24/SET/BCS/309` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b6e` | **VERIFIED** |
| 288 | RUDRAKSH TYAGI | `1/24/SET/BCS/312` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b6f` | **VERIFIED** |
| 289 | SAHIL KUMAR | `1/24/SET/BCS/314` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b70` | **VERIFIED** |
| 290 | MOHIT CHHOKER | `1/24/SET/BCS/315` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b71` | **VERIFIED** |
| 291 | MAYANK CHHOKER | `1/24/SET/BCS/316` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b72` | **VERIFIED** |
| 292 | SAGAR GUPTA | `1/24/SET/BCS/317` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b73` | **VERIFIED** |
| 293 | SHAURYA ADHANA | `1/24/SET/BCS/318` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b74` | **VERIFIED** |
| 294 | PRABHANKER VERMA | `1/24/SET/BCS/320` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b76` | **VERIFIED** |
| 295 | ARINJAY GAUR | `1/24/SET/BCS/321` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b77` | **VERIFIED** |
| 296 | HARSH YADAV | `1/24/SET/BCS/322` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b78` | **VERIFIED** |
| 297 | HARSHIT BAWA | `1/24/SET/BCS/323` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b79` | **VERIFIED** |
| 298 | SOUMYADIP BHUNIA | `1/24/SET/BCS/328` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b7a` | **VERIFIED** |
| 299 | MEDHAVI THAKUR | `1/24/SET/BCS/329` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b7b` | **VERIFIED** |
| 300 | MAJID ANSARI | `1/24/SET/BCS/331` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66b7c` | **VERIFIED** |
| 301 | GARGI CHATURVEDI | `1/24/SET/BCS/400` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66bbd` | **VERIFIED** |
| 302 | AYUSH CHAUHAN | `1/24/SET/BCS/569` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66c56` | **VERIFIED** |
| 303 | VARUN . | `1/24/SET/BCS/572` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66c57` | **VERIFIED** |
| 304 | TONMOY DAS | `1/24/SET/BCS/573` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66c58` | **VERIFIED** |
| 305 | KAUSHIK | `1/24/SET/BCS/576` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66c5b` | **VERIFIED** |
| 306 | ANIK CHANDRA BARMAN | `1/24/SET/BCS/578` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66c5c` | **VERIFIED** |
| 307 | JOY DEY | `1/24/SET/BCS/579` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66c5d` | **VERIFIED** |
| 308 | PALAKSH SHARMA | `1/24/SET/BCS/580` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66c5e` | **VERIFIED** |
| 309 | BHUMI . | `1/24/SET/BCS/582` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66c60` | **VERIFIED** |
| 310 | BHAVUK . | `1/24/SET/BCS/583` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66c61` | **VERIFIED** |
| 311 | ROSHAN KUMAR SINGH | `1/24/SET/BCS/584` | 3 | 3CSE | 5 | 5CSE | `6afa10459131ed3bfbd66c62` | **VERIFIED** |

---

## 7. Actionable Records Requiring Administrator Decision

### 7.1. Records in Official Roster Requiring Verification (5 Records)

| Row | Student Name | Roll Number | Section | Specific Issue Identified | Recommended Administrator Action |
|:---:|---|---|:---:|---|---|
| 189 | *(Blank / Alpha Forage)* | `1/24/SET/BCS/197` | C | Roster name is Alpha Forage and record is missing from DB | Review official admission record; resolve DB duplication before migration. |
| 204 | SARTHAK SHRIVASTAVA | `1/24/SET/BCS/213` | D | Sarthak Shrivastava has duplicate entry in roster | Review official admission record; resolve DB duplication before migration. |
| 269 | NISHANT THAKURELA | `1/24/SET/BCS/272` | E | Nishant Thakurela has secondary phone-number roll (9389818925) in DB | Review official admission record; resolve DB duplication before migration. |
| 306 | SAYYAM JAGGI | `1/24/SET/BCS/319` | E | Sayyam Jaggi has duplicate record (1/24SET/BCS/319) in DB | Review official admission record; resolve DB duplication before migration. |
| 441 | Sarthak Shrivastava | `1/24/SET/BCS/213` | D | Duplicate roster entry for roll 1/24/SET/BCS/213 (Row 441) | Review official admission record; resolve DB duplication before migration. |

### 7.2. Out-of-Scope Entries in Roster (10 Records)

| Row | Student Name | Roll Number | Section | Batch / Category | Handling Recommendation |
|:---:|---|---|:---:|---|---|
| 134 | SANKIT OJHA | `1/23/SET/BCS/182` | C | Cross-batch 2023 student in roster | Exclude from 2024 BCS transition; handle in separate 2023 or Lateral workflow. |
| 200 | KUNAL BHARGAVA | `1/23/SET/BCS/095` | D | Cross-batch 2023 student in roster | Exclude from 2024 BCS transition; handle in separate 2023 or Lateral workflow. |
| 201 | AYUSH KUMAR SINGH | `1/23/SET/BCS/104` | D | Cross-batch 2023 student in roster | Exclude from 2024 BCS transition; handle in separate 2023 or Lateral workflow. |
| 202 | MAYANK SOAM | `1/23/SET/BCS/243` | D | Cross-batch 2023 student in roster | Exclude from 2024 BCS transition; handle in separate 2023 or Lateral workflow. |
| 265 | AKASH KUMAR VERMA | `1/23/SET/BCS/078` | E | Cross-batch 2023 student in roster | Exclude from 2024 BCS transition; handle in separate 2023 or Lateral workflow. |
| 266 | UJJAWAL PRAKASH SINGH | `1/23/SET/BCS/079` | E | Cross-batch 2023 student in roster | Exclude from 2024 BCS transition; handle in separate 2023 or Lateral workflow. |
| 267 | PRIYANSHU SINHA | `1/23/SET/BCS/149` | E | Cross-batch 2023 student in roster | Exclude from 2024 BCS transition; handle in separate 2023 or Lateral workflow. |
| 268 | ROHAN CHAUDHARY | `1/23/SET/BCS/162` | E | Cross-batch 2023 student in roster | Exclude from 2024 BCS transition; handle in separate 2023 or Lateral workflow. |
| 325 | SANDEEP KUMAR SINGH | `25/SET/BCSE(L)/001` | E | Lateral entry student in roster | Exclude from 2024 BCS transition; handle in separate 2023 or Lateral workflow. |
| 326 | PRAKASH GIRI | `25/SET/BCSE(L)/004` | E | Lateral entry student in roster | Exclude from 2024 BCS transition; handle in separate 2023 or Lateral workflow. |

---

## 8. Final Integrity & Safeguard Attestation

It is formally certified that:

1. **Zero database writes occurred.** Database collection counts (`students: 561`, `users: 28`, `attendances: 847`, `faceembeddings: 2`) are completely unchanged.

2. **Zero student records or roll numbers were modified.**

3. **All 326 official roster entries were accounted for** with complete mathematical reconciliation (311 Ready + 5 Admin Review + 10 Out of Scope = 326).

4. **The Semester 5 migration was NOT executed.**

5. All temporary diagnostic scripts have been cleaned up.
