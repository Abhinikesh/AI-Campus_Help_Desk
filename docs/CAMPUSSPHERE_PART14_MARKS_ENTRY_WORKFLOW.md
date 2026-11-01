# CampusSphere AI — Part 14: Faculty Marks Entry Workflow

## 1. Overview

The Marks Entry Hub provides an intuitive, high-integrity interface for faculty members to enter, validate, draft, submit, and manage student evaluation records. It prevents grading errors, catches numerical outliers at the input stage, and safeguards student privacy before final institutional authorization.

---

## 2. End-to-End Workflow Stages

```
+--------------------------------------------------------------------------------+
| Stage 1: Roster Loading & Cohort Resolution                                    |
|   Faculty selects assigned examination -> System queries enrolled students     |
|   matching Subject, Department, Semester, and Section.                         |
+--------------------------------------------------------------------------------+
                                       |
                                       v
+--------------------------------------------------------------------------------+
| Stage 2: Inline Marks Entry & Absenteeism Toggle                               |
|   - Real-time client-side bounds checking: 0 <= marksObtained <= maxMarks.     |
|   - Toggle Absent status (locks input and automatically zeroes marks).         |
|   - Optional descriptive remarks for individual students.                      |
+--------------------------------------------------------------------------------+
                                       |
                                       v
+--------------------------------------------------------------------------------+
| Stage 3: Draft Persistence                                                     |
|   - Click "Save Draft": bulk upsert to database with status: 'draft'.          |
|   - Draft marks are strictly invisible to students.                            |
|   - Faculty can pause and resume grading at any time.                          |
+--------------------------------------------------------------------------------+
                                       |
                                       v
+--------------------------------------------------------------------------------+
| Stage 4: Submission for Review                                                 |
|   - Verification check: all roster students have valid scores or absent flags. |
|   - Click "Submit for Review": locks marks against further faculty edits.      |
|   - Exam evaluationStatus moves to 'submitted_for_review'.                     |
+--------------------------------------------------------------------------------+
                                       |
                                       v
+--------------------------------------------------------------------------------+
| Stage 5: Administrative Approval & Publication                                 |
|   - Independent reviewer or Admin inspects grade distributions and anomalies.  |
|   - Admin approves roster -> marks transition to 'approved'.                   |
|   - Publish results -> marks transition to 'published', notifications sent.    |
+--------------------------------------------------------------------------------+
```

---

## 3. Detailed Step-by-Step Walkthrough

### Step 1: Accessing the Examination Hub
- Navigate to the **Examinations & Results** module (`/faculty/results`).
- The dashboard displays active teaching assignments and scheduled examinations.
- Click **Manage Marks** on an examination card to open the grading roster.

### Step 2: Roster Population & Eligibility
- The server dynamically retrieves all students belonging to the exam cohort via `GET /api/exams/:id/roster`.
- Existing marks or saved drafts are joined with the student profile:
  - Roll Number
  - Student Name
  - Current Marks Obtained
  - Absent Status
  - Calculated Percentage & Letter Grade Preview
  - Individual Remarks

### Step 3: Input Validation Rules
- **Negative Marks:** Immediate rejection (`marksObtained >= 0`).
- **Score Exceeding Maximum:** Immediate rejection (`marksObtained <= maximumMarks`).
- **Absentee Handling:** Selecting the "Absent" checkbox sets `isAbsent = true`, resets `marksObtained = 0`, and displays an "ABSENT" status badge.
- **Decimal Precision:** Allows up to two decimal places for practical or fractional marking schemes.

### Step 4: Saving Drafts vs Submitting
- **Save Draft:**
  - Persists student records to the MongoDB database with `status: 'draft'`.
  - Enables faculty to grade large cohorts in multiple sessions.
  - Generates zero student notifications and prevents any leak to student portals.
- **Submit for Review:**
  - Performs complete cohort coverage validation (warns if any student has unentered scores).
  - Submits the batch for departmental or administrative verification.
  - Updates exam `evaluationStatus` to `submitted_for_review`.

---

## 4. UI Implementation Features (`client/src/pages/FacultyResults/index.jsx`)

1. **Roster Metrics Bar:** Displays total cohort size, number of graded students, pending evaluations, and absent count in real-time.
2. **Inline Calculation:** Dynamically renders the UGC letter grade (`O`, `A+`, `A`, `B+`, etc.) beside each student's score input as the faculty types.
3. **Audited Correction Modal:** Allows faculty to initiate a correction request after publication, requiring a mandatory detailed reason.
4. **Export Capabilities:** Option to export marks entries as standardized tabular records for physical archiving.

