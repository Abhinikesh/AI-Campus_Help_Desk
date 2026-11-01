# CampusSphere AI — Part 13: Manual Validation & Verification Runbook

## 1. Prerequisites & Environment Verification

Verify services are running:
- Node.js backend: `http://localhost:5001` (`GET /api/health` returns `200 OK`)
- Python AI microservice: `http://localhost:5002` (`GET /health` returns `200 OK`)
- Vite dev server: `http://localhost:5173`

---

## 2. End-to-End Verification Steps

### Step 1: Faculty Assignment Creation
1. Log in to the ERP as Faculty (`loginId: FAC01`, or standard faculty credential).
2. Click **Assignments** in the sidebar (`/faculty/assignments`).
3. Click the **Create Assignment** button.
4. Fill in:
   - **Title:** `Lab 5: B-Tree Indexes & Query Optimization`
   - **Subject:** Select assigned subject (e.g. `CS401 - Database Management Systems`)
   - **Department / Semester:** `CSE`, `Semester 4`
   - **Maximum Marks:** `50`
   - **Due Date:** Choose a future date/time.
   - **Late Policy:** `Allowed (Marked Late)`
   - Attach sample PDF rubric or reference file.
5. Choose **Publish immediately** and submit.
6. Verify the assignment card appears in the list with `PUBLISHED` status.

### Step 2: Student Submission
1. In another browser tab/window, log in as a Student in CSE Sem 4.
2. Click **Assignments** in the sidebar (`/student/assignments`).
3. Verify the published `Lab 5` assignment appears under **All Tasks** and **Pending**.
4. Click **View & Submit**.
5. Upload a file (e.g. `submission.pdf` or `.docx`) and add remarks: `Completed queries 1 through 5.`
6. Click **Submit Coursework**.
7. Verify toast notification confirms submission.
8. Status updates to `Submitted v1 (On-Time)`.

### Step 3: Student Resubmission (Audit Versioning)
1. Within the student portal, click **View / Resubmit** on the same assignment.
2. Observe that previous submission details and file link are visible.
3. Attach an updated file and remarks: `Updated query 4 optimization plan.`
4. Click **Submit New Version**.
5. Verify version increments to `v2` and earlier submission is safely preserved in history.

### Step 4: Faculty Evaluation & Grade Publishing
1. Return to the Faculty portal (`/faculty/assignments`).
2. Click **Submissions & Evaluation** on the assignment card.
3. Observe the student's submission row:
   - Student name and roll number.
   - Version tag `v2`.
   - On-time status.
   - Attached files with working download buttons.
   - Student remarks.
4. Click **Grade Submission**.
5. Enter **Marks:** `48` (out of 50) and **Feedback:** `Excellent performance. Well explained execution plan.`
6. Click **Save Evaluation**.
7. Observe status is `Draft (Unpublished)`.
8. Check the student portal: Verify that marks and feedback are **NOT** visible yet to the student.
9. Return to the faculty portal and click **Publish Result**.
10. Check the student portal: Student receives real-time notification alert and sees **Score: 48 / 50** with faculty feedback.

### Step 5: Security & Authorization Boundary Checks
1. Attempt cross-student submission download:
   - Copy file download link from Student A.
   - Attempt to access it authenticated as Student B.
   - Verify server returns `403 Forbidden` (`Access denied`).
2. Attempt path traversal on download route:
   - Pass traversal target in file ID or path.
   - Verify server blocks with `403 Forbidden` (`Path traversal detected`).

