# CampusSphere AI — Part 14: Examination & Results API Reference

## 1. Overview

The Examination & Results API is mounted at `/api/exams`. All routes require authentication (`authMiddleware`). Specific actions require role-based permissions (`requireRole(['faculty', 'admin', 'student'])`).

---

## 2. Examination Scheduling Endpoints

### 2.1. Create Examination
- **Method & Path:** `POST /api/exams`
- **Access:** `faculty`, `admin`
- **Request Body:**
  ```json
  {
    "title": "Mid-Semester Examination 2025",
    "examType": "mid-sem",
    "subject": "60d0fe4f5311236168a109ca",
    "academicYear": "2025-2026",
    "department": "Computer Science",
    "semester": 5,
    "section": "A",
    "date": "2025-11-20T00:00:00.000Z",
    "startTime": "09:30",
    "endTime": "12:30",
    "durationMinutes": 180,
    "room": "LH-101",
    "maximumMarks": 100,
    "passingMarks": 40,
    "instructions": "Standard college examination rules apply."
  }
  ```
- **Responses:**
  - `201 Created`: Exam created successfully. Returns the populated `Exam` document.
  - `400 Bad Request`: Validation failure (invalid dates, negative marks, passing marks > max marks).
  - `403 Forbidden`: Faculty member is not assigned to the specified subject.
  - `409 Conflict`: Room booking conflict or student cohort schedule conflict.

---

### 2.2. Get Faculty Examinations
- **Method & Path:** `GET /api/exams/faculty`
- **Access:** `faculty`, `admin`
- **Query Parameters:** `status` (optional), `academicYear` (optional), `semester` (optional).
- **Response:**
  - `200 OK`: Array of examinations created by or assigned to the authenticated faculty member.

---

### 2.3. Get Single Examination
- **Method & Path:** `GET /api/exams/:id`
- **Access:** `faculty`, `admin`, `student`
- **Response:**
  - `200 OK`: Full examination details populated with subject and faculty information.
  - `404 Not Found`: Examination ID not found.

---

### 2.4. Update Examination
- **Method & Path:** `PUT /api/exams/:id`
- **Access:** Assigned `faculty`, `admin`
- **Behavior:** Updates exam timing, venue, instructions, or maximum marks. Prohibits updating if marks evaluation has already commenced.
- **Responses:**
  - `200 OK`: Updated examination document.
  - `400 Bad Request`: Illegal modification attempt on locked examination.
  - `403 Forbidden`: User is neither the exam creator nor an administrator.

---

### 2.5. Cancel Examination
- **Method & Path:** `DELETE /api/exams/:id`
- **Access:** Assigned `faculty`, `admin`
- **Behavior:** Sets exam status to `cancelled`. Automatically triggers notifications to enrolled cohort.
- **Response:**
  - `200 OK`: `{ "message": "Examination cancelled successfully" }`

---

## 3. Marks Entry & Evaluation Endpoints

### 3.1. Get Examination Roster
- **Method & Path:** `GET /api/exams/:id/roster`
- **Access:** Assigned `faculty`, `admin`
- **Response:**
  - `200 OK`: Returns the list of enrolled students for the exam cohort alongside any saved draft or existing marks records.
  ```json
  {
    "exam": { "_id": "...", "title": "...", "maximumMarks": 100 },
    "roster": [
      {
        "student": {
          "_id": "60d0fe4f5311236168a109cb",
          "name": "Jane Doe",
          "rollNumber": "CS-2023-01"
        },
        "mark": {
          "_id": "60d0fe4f5311236168a109cc",
          "marksObtained": 85,
          "maxMarks": 100,
          "isAbsent": false,
          "status": "draft"
        }
      }
    ]
  }
  ```

---

### 3.2. Save Draft Marks
- **Method & Path:** `POST /api/exams/:id/marks/draft`
- **Access:** Assigned `faculty`, `admin`
- **Request Body:**
  ```json
  {
    "marks": [
      {
        "student": "60d0fe4f5311236168a109cb",
        "marksObtained": 88,
        "isAbsent": false,
        "remarks": "Solid performance"
      },
      {
        "student": "60d0fe4f5311236168a109cc",
        "marksObtained": 0,
        "isAbsent": true,
        "remarks": "Absent with prior medical notice"
      }
    ]
  }
  ```
- **Responses:**
  - `200 OK`: Marks saved as drafts. Marks remain invisible to students.
  - `400 Bad Request`: Negative marks or marks exceeding `maximumMarks`.

---

### 3.3. Submit Marks for Review
- **Method & Path:** `POST /api/exams/:id/marks/submit`
- **Access:** Assigned `faculty`, `admin`
- **Request Body:** Empty or optional validation payload.
- **Behavior:** Transitions all draft marks for this exam to `submitted` and sets exam `evaluationStatus` to `submitted_for_review`.
- **Response:**
  - `200 OK`: `{ "message": "Marks submitted for administrative review" }`

---

### 3.4. Review & Approve Marks
- **Method & Path:** `POST /api/exams/:id/marks/approve`
- **Access:** Independent `faculty`, `admin`
- **Constraint (Anti-Self-Approval):** An instructor who entered or submitted the marks cannot approve their own marks unless they have the `admin` role.
- **Response:**
  - `200 OK`: Transitions marks to `approved` and exam `evaluationStatus` to `approved`.
  - `403 Forbidden`: Instructor self-approval violation.

---

### 3.5. Publish Exam Results
- **Method & Path:** `POST /api/exams/:id/publish`
- **Access:** Assigned `faculty`, `admin`
- **Behavior:** Transitions all approved marks to `published` and sets exam `evaluationStatus` to `published`. Automatically broadcasts real-time academic notifications to all enrolled students.
- **Response:**
  - `200 OK`: `{ "message": "Examination results published successfully" }`

---

## 4. Audited Corrections Endpoints

### 4.1. Request Marks Correction
- **Method & Path:** `POST /api/exams/:id/marks/:markId/request-correction`
- **Access:** `faculty`, `admin`
- **Request Body:**
  ```json
  {
    "reason": "Re-evaluation of Question 4 identified clerical addition error."
  }
  ```
- **Response:**
  - `200 OK`: Flags exam with `correction_requested`.

---

### 4.2. Apply Audited Correction
- **Method & Path:** `POST /api/exams/:id/marks/:markId/correct`
- **Access:** `admin` (or authorized examination officer)
- **Request Body:**
  ```json
  {
    "newMarks": 92,
    "reason": "Verified clerical error in section B. Score revised from 85 to 92."
  }
  ```
- **Response:**
  - `200 OK`: Appends previous marks, new marks, reason, and actor ID to `correctionHistory`. Dispatches priority notification to the student informing them of the revised score.

---

## 5. Student & Administrative Portals

### 5.1. Get Student Examination Schedule
- **Method & Path:** `GET /api/exams/student/schedule`
- **Access:** `student`
- **Response:**
  - `200 OK`: Returns scheduled and upcoming examinations strictly filtered to the student's department, semester, and enrolled subjects.

---

### 5.2. Get Student Results & GPA
- **Method & Path:** `GET /api/exams/student/results`
- **Access:** `student`
- **Behavior:** Filters strictly for `status: 'published'`. Computes percentage, UGC letter grade, grade points, and semester GPA.
- **Response:**
  - `200 OK`:
  ```json
  {
    "results": [ ... ],
    "summary": {
      "totalCredits": 22,
      "earnedCredits": 22,
      "gpa": 8.75,
      "cgpa": 8.60
    }
  }
  ```

---

### 5.3. Get Admin Examination Overview
- **Method & Path:** `GET /api/exams/admin/overview`
- **Access:** `admin`
- **Response:**
  - `200 OK`: Real-time institutional KPIs (total exams scheduled, ongoing, pending review, published, total results processed, pass rate percentage).

