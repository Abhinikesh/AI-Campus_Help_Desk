# CampusSphere AI — Part 20: Manual Validation Guide

This step-by-step walkthrough enables quality engineers, system administrators, and institutional stakeholders to verify the Part 20 Placement and Career Development Management System through the UI and REST API.

---

## 1. Prerequisites & Environment Check

1. **Backend Server Running:** Confirm `http://localhost:5001` responds.
2. **Frontend Running:** Confirm Vite client is available at `http://localhost:5173`.
3. **Database Available:** MongoDB active on `localhost:27018` or configured URI.
4. **User Accounts:**
   - **Admin:** `admin@campussphere.edu`
   - **Placement Officer (TPO):** `tpo@campussphere.edu`
   - **Placement Coordinator:** `coordinator@campussphere.edu`
   - **Student (Eligible):** `rahul.student@campussphere.edu`

---

## 2. End-to-End Verification Scenarios

### Scenario 1: Corporate Partner Registration
1. Log in as **Placement Officer** (`tpo@campussphere.edu`) or **Admin** and navigate to **Placement Administration** (`/admin/placement`).
2. Switch to the **Company Directory** tab.
3. Click **Add Company** and submit:
   - Company Name: `Google India Pvt Ltd`
   - Company Code: `COMP-GOOG-01`
   - Industry: `Technology / Software Engineering`
   - Website: `https://careers.google.com`
   - Primary Recruiter Name: `Pooja Sharma`
   - Recruiter Email: `pooja.sharma@example.com`
   - Recruiter Phone: `+91-9876543210`
   - Office Address: `Bangalore Tech Park, Bengaluru`
   - Tier: `tier_1`
4. **Verification:** The company appears in the directory table with `Tier 1` badge and `Active` status. Recruiter contact information is visible to the administrator.

---

### Scenario 2: Student Placement Profile & Resume Upload
1. Log in as **Student** (`rahul.student@campussphere.edu`) and navigate to **Career & Placements** (`/student/placement`).
2. Observe the **Profile Readiness** progress bar.
3. Switch to the **My Profile** tab:
   - Enter Headline: `Aspiring Cloud & Distributed Systems Engineer`
   - Add Technical Skills: `Node.js, React, MongoDB, Python, Docker, Kubernetes`
   - Add GitHub: `https://github.com/rahul-student`
   - Add LinkedIn: `https://linkedin.com/in/rahul-student`
   - Select Preferred Job Types: `Full-time`, `Internship`
   - Select Preferred Locations: `Bengaluru, Hyderabad, Remote`
4. Upload a sample Resume in PDF format.
5. Save the profile.
6. **Verification:** Profile completeness score increases (e.g. to 100%), and the uploaded resume shows a verified download button. The student's live CGPA and active backlogs are automatically shown directly from their official academic marks.

---

### Scenario 3: Opportunity Creation & Eligibility Verification
1. Log in as **Placement Officer** on the **Placement Desk** (`/admin/placement`).
2. Switch to the **Opportunities** tab.
3. Click **Create Opportunity** and fill in:
   - Select Company: `Google India Pvt Ltd`
   - Title: `Software Development Engineer - 2026`
   - Opportunity Code: `JOB-GOOG-SDE-01`
   - Job Type: `full_time`
   - Location: `Bengaluru`
   - Work Mode: `hybrid`
   - Minimum CGPA Required: `7.50`
   - Maximum Backlogs Allowed: `0`
   - Allowed Branches: `CSE, IT, ECE`
   - Target Batches: `2026`
   - CTC (Annual): `₹24,00,000` (stored as `240000000` integer paise)
   - Application Deadline: Set to 14 days in the future.
4. Initially save as `draft`.
5. Log in as Student and check the **Job Opportunities** tab.
   - **Verification:** The draft opportunity is **NOT visible** to students.
6. Switch back to Placement Officer, click **Publish Opportunity**.
7. Refresh the Student portal.
   - **Verification:** The opportunity is now visible. Click **Check Eligibility**:
   - A modal displays a green checkmark: *"You are eligible to apply!"* with a detailed breakdown of Student CGPA vs. Required CGPA, Backlogs, Branch, and Batch.

---

### Scenario 4: Placement Drive Scheduling & Stage Setup
1. On the Placement Officer desk, switch to the **Placement Drives** tab.
2. Click **Create Drive**:
   - Drive Name: `Google Campus Recruitment Drive 2026`
   - Drive Code: `DRIVE-GOOG-2026`
   - Link Opportunity: `JOB-GOOG-SDE-01`
   - Start Date: 5 days from today
   - End Date: 7 days from today
   - Venue: `Main Auditorium & Online Assessment Lab`
   - Assign Coordinators: `coordinator@campussphere.edu`
3. Click the Drive to expand Selection Stages:
   - Stage 1: `Online Coding Assessment` (Type: `written_test`, Sequence: `1`)
   - Stage 2: `Technical Interview 1` (Type: `technical_interview`, Sequence: `2`)
   - Stage 3: `System Design & HR` (Type: `hr_interview`, Sequence: `3`)
4. **Verification:** Selection stages are created in strict sequence order without duplicates.

---

### Scenario 5: Application Submission & Snapshot Freezing
1. Log in as Student. Open the published opportunity `JOB-GOOG-SDE-01`.
2. Click **Apply Now**. Confirm current resume submission.
3. **Verification:**
   - Application status is set to `applied`.
   - The application snapshot captures the student's current CGPA and academic status immutably.
   - The student cannot submit a duplicate application (the button becomes `Applied` and disabled).

---

### Scenario 6: Selection Stage Progression & Interview Result
1. Log in as **Placement Coordinator** (`coordinator@campussphere.edu`).
2. Navigate to **Placement Desk** (`/admin/placement`) -> **Applications & Rounds**.
3. Locate student Rahul's application for `Google SDE 2026`.
4. Click **Record Stage Result**:
   - Stage: `Stage 1: Online Coding Assessment`
   - Status: `shortlisted`
   - Marks Obtained: `95 / 100`
   - Feedback: `Excellent problem solving in Graph algorithms and Dynamic Programming.`
5. Save the result.
6. Advance the overall application status to `shortlisted`.
7. **Verification:** Student Rahul receives a real-time placement notification informing him of shortlisting for the next round.

---

### Scenario 7: Employment Offer Issuance & Student Acceptance
1. On the Placement Officer desk, navigate to **Offers & Verifications**.
2. Click **Issue Offer**:
   - Select Candidate: `Rahul Sharma`
   - Opportunity: `JOB-GOOG-SDE-01`
   - Offer Number: `OFFER-GOOG-2026-001`
   - Annual CTC (LPA): `₹24,00,000`
   - Base Salary: `₹18,00,000`
   - Joining Date: 6 months from today
   - Acceptance Deadline: 10 days from today
3. Log in as Student. Navigate to the **My Offers** section.
4. **Verification:** The offer card displays `Google India Pvt Ltd — SDE`, `₹24,00,000 / year`, with `Accept` and `Reject` buttons.
5. Click **Accept Offer**.
6. **Verification:** Offer status changes to `accepted`. Application status updates to `placed`.

---

### Scenario 8: Placement Verification & Audit Log
1. Log in as **Placement Officer**.
2. Open the verified offer record for Rahul Sharma.
3. Click **Verify Official Placement**:
   - Check verified checkbox: `true`
   - Verification Remarks: `Verified with signed offer letter received from Google India HR.`
4. Switch to the **Analytics & Reports** tab.
5. **Verification:**
   - Total Placed Students increments by 1.
   - Highest Package updates to ₹24.00 LPA.
   - Placement Percentage dynamically recalculates against eligible final-year candidates.
   - Click **Export Placed Students (CSV)**. Inspect downloaded file in a text editor to confirm all cells containing `=`, `+`, `-`, `@` are safely sanitized against formula injection (CWE-1236).

---

## 3. Security & Boundary Verification

1. **Anti-IDOR:** Attempting to retrieve another student's resume or application via REST API returns `403 Forbidden`.
2. **Recruiter Privacy:** Calling `/api/placement/opportunities` as a student strips recruiter emails and direct phone numbers.
3. **Coordinator Boundary:** A coordinator assigned only to Drive A cannot enter interview scores for Drive B.
4. **Academic Mark Integrity:** Verify in the database that `Mark` records are untouched by any placement stage or offer activity.

