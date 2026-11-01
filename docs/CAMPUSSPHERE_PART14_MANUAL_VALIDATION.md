# CampusSphere AI — Part 14: Manual Validation & Verification Guide

## 1. Overview

This guide provides test scenarios, credentials, and step-by-step reproduction instructions for peer reviewers, QA engineers, and administrators to manually validate the **Examination Management, Marks Entry & Result Publication** workflows in CampusSphere AI.

---

## 2. Test Environment Setup

Ensure the development daemons are active:
- **Backend API:** `http://localhost:5001`
- **Frontend Client:** `http://localhost:5173`
- **Python AI Microservice:** `http://localhost:5002`
- **MongoDB:** `mongodb://127.0.0.1:27018/campus-erp`

---

## 3. Step-by-Step Validation Scenarios

### Scenario 1: Faculty Examination Scheduling
1. **Login:** Access `http://localhost:5173/login` as Faculty (`prof.sharma@campussphere.edu` / `Faculty@123`).
2. **Navigate:** Open the sidebar and click **Examinations & Results** (`/faculty/results`).
3. **Action:** Click the **+ Schedule Exam** button.
4. **Fill Form:**
   - Subject: Select an assigned subject (e.g. *Database Management Systems*).
   - Exam Title: "Mid-Semester Examination 2025".
   - Type: `mid-sem`.
   - Date: Select an upcoming date (e.g. 7 days in the future).
   - Start Time: `10:00`, End Time: `12:00` (120 mins).
   - Venue / Room: `Hall A-201`.
   - Maximum Marks: `100`, Passing Marks: `40`.
5. **Submit:** Click **Create Examination**.
6. **Verification:**
   - Toast confirms "Examination scheduled successfully".
   - The exam card appears under "Scheduled Examinations" with status `scheduled`.

---

### Scenario 2: Student Examination Timetable
1. **Login:** In an incognito tab, login as an enrolled Student in the same department/semester (`student.rahul@campussphere.edu` / `Student@123`).
2. **Navigate:** Click **Exams** (`/student/exams`) in the navigation bar.
3. **Verification:**
   - The newly scheduled exam "Mid-Semester Examination 2025" appears in the timetable card view.
   - Date, timing (`10:00 - 12:00`), venue (`Hall A-201`), and subject code match.
   - Status badge shows `scheduled`.
4. **Negative Test:** Login as a student from an unrelated branch (e.g. *Mechanical Engineering*). Verify that the CSE exam does NOT appear on their timetable.

---

### Scenario 3: Marks Entry, Absenteeism & Draft Saving
1. **Return:** In the Faculty session, locate the exam card and click **Manage Marks**.
2. **Roster Display:** The student cohort roster loads with Roll Number, Student Name, and input fields.
3. **Data Entry:**
   - For Student 1: Enter `88`. Notice the live badge updates to **A+ (88%)**.
   - For Student 2: Check the **Absent** checkbox. Notice the score input is disabled, reset to `0`, and shows an **ABSENT** badge.
   - For Student 3: Try entering `105` (exceeding 100). Verify validation flags the field in red. Change to `74`.
4. **Save Draft:** Click **Save Draft**.
5. **Privacy Check:** Switch to Student Rahul's session (`/student/results`).
   - Verify that Rahul's results table remains empty or shows "No results published yet".
   - Confirm draft scores are completely hidden.

---

### Scenario 4: Submission & Anti-Self-Approval
1. **Submit:** In the Faculty session, click **Submit for Review**.
2. **Status Change:** Confirm the exam status updates to `submitted_for_review`.
3. **Anti-Self-Approval Attempt:**
   - Click the **Approve Marks** button while logged in as the submitting faculty member.
   - Verify the operation is rejected with the message: *"Instructors cannot self-approve their own submitted marks."*

---

### Scenario 5: Administrative Approval & Result Publication
1. **Login:** Log in as Administrator (`admin@campussphere.edu` / `Admin@123`).
2. **Navigate:** Open the Examinations Hub or Results Review console.
3. **Action:**
   - Locate the submitted exam.
   - Click **Approve Marks**. Verify status changes to `approved`.
   - Click **Publish Results**. Confirm confirmation dialog.
4. **Verification:**
   - Status updates to `published`.
   - Centralized notifications are dispatched to all enrolled cohort students.

---

### Scenario 6: Student Result Inspection & GPA Verification
1. **Student View:** Switch to Student Rahul's session (`/student/results`).
2. **Verification:**
   - Refresh or check notifications: Notification bell rings with "Results Published: Mid-Semester Examination 2025".
   - Rahul's score card displays:
     - Marks: `88 / 100`
     - Percentage: `88.00%`
     - UGC Letter Grade: `A+`
     - Grade Points: `9.0`
     - Status: `Passed`
   - Academic Summary Card displays Semester SGPA and earned credits accurately.

---

### Scenario 7: Audited Marks Correction
1. **Admin Console:** In the Admin view, select Rahul's mark and click **Request Correction / Correct Mark**.
2. **Input:**
   - New Marks: `92`
   - Mandatory Reason: "Verified question 4 re-evaluation: +4 marks awarded".
3. **Submit:** Click **Apply Correction**.
4. **Audit Verification:**
   - Open mark details: `correctionHistory` displays the previous mark (`88`), new mark (`92`), the administrative reason, and timestamp.
   - Rahul's portal immediately updates to `92 / 100` with letter grade **O (10.0)**.
   - Rahul receives a priority notification alerting him of the audited score adjustment.

