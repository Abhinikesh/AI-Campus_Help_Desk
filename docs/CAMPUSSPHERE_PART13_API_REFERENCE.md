# CampusSphere AI — Part 13: API Reference

All routes are mounted under `/api/assignments` and `/api/submissions` and require a valid JWT token via `Authorization: Bearer <token>`.

---

## 1. Faculty Assignment Endpoints

### 1.1. Create Assignment
- **Route:** `POST /api/assignments`
- **Roles:** `faculty`, `admin`
- **Content-Type:** `multipart/form-data`
- **Body:**
  - `title` (String, required)
  - `description` (String, required)
  - `subject` (ObjectId, required)
  - `department` (String, default: `CSE`)
  - `semester` (Number, default: 4)
  - `section` (String, default: `All`)
  - `maximumMarks` (Number, default: 100)
  - `assignmentType` (enum: `homework`, `project`, `lab_report`, `quiz_takehome`, `case_study`)
  - `dueDate` (ISO 8601 String, required)
  - `latePolicy` (enum: `none`, `allowed`, `grace_period`)
  - `gracePeriodMinutes` (Number, optional)
  - `status` (enum: `draft`, `published`)
  - `attachments` (File binary, max 5 files, 25MB each)
- **Response:** `201 Created`

### 1.2. Get Faculty Assignments List
- **Route:** `GET /api/assignments/faculty`
- **Roles:** `faculty`, `admin`
- **Query Params:** `status` (`draft` | `published` | `closed`), `subject`, `search`
- **Response:** `200 OK`

### 1.3. Get Faculty Dashboard Metrics
- **Route:** `GET /api/assignments/faculty/dashboard`
- **Roles:** `faculty`, `admin`
- **Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "totalAssignments": 6,
    "publishedAssignments": 4,
    "draftAssignments": 1,
    "activeAssignments": 3,
    "closedAssignments": 1,
    "totalSubmissionsReceived": 45,
    "totalLateSubmissions": 3,
    "totalEvaluated": 38,
    "pendingEvaluations": 7
  }
}
```

### 1.4. Update Assignment
- **Route:** `PATCH /api/assignments/:id`
- **Roles:** `faculty`, `admin`
- **Body:** Any mutable assignment fields.
- **Response:** `200 OK`

### 1.5. Publish Assignment
- **Route:** `POST /api/assignments/:id/publish`
- **Roles:** `faculty`, `admin`
- **Response:** `200 OK`

### 1.6. Close Assignment
- **Route:** `POST /api/assignments/:id/close`
- **Roles:** `faculty`, `admin`
- **Response:** `200 OK`

---

## 2. Evaluation & Grading Endpoints

### 2.1. View Assignment Submissions
- **Route:** `GET /api/assignments/:id/submissions`
- **Roles:** `faculty`, `admin`
- **Response:** `200 OK` (Array of student submissions with populated student name and roll number).

### 2.2. Evaluate Submission
- **Route:** `POST /api/assignments/submissions/:id/evaluate` (or `POST /api/submissions/:id/evaluate`)
- **Roles:** `faculty`, `admin`
- **Body:**
  - `marksAwarded` (Number, 0 to `maximumMarks`, required)
  - `feedback` (String, optional)
- **Response:** `200 OK`

### 2.3. Publish Evaluation Result
- **Route:** `POST /api/assignments/submissions/:id/publish-result` (or `POST /api/submissions/:id/publish-result`)
- **Roles:** `faculty`, `admin`
- **Response:** `200 OK` (Sets `isResultPublished: true` and dispatches notification to student).

---

## 3. Student Endpoints

### 3.1. Get Student Coursework List
- **Route:** `GET /api/assignments/student`
- **Roles:** `student`
- **Query Params:** `filter` (`pending` | `submitted` | `evaluated`), `search`
- **Response:** `200 OK` (Scored results only contain grades if published).

### 3.2. Get Student Assignment Details
- **Route:** `GET /api/assignments/student/:id`
- **Roles:** `student`
- **Response:** `200 OK` (Assignment description, attachments, and student's own submission).

### 3.3. Submit Coursework
- **Route:** `POST /api/assignments/:id/submit`
- **Roles:** `student`
- **Content-Type:** `multipart/form-data`
- **Body:**
  - `textResponse` (String, optional)
  - `files` (Binary files, max 5, up to 25MB each)
- **Response:** `201 Created` (Initial submission) or `200 OK` (Resubmission version increment).

---

## 4. Secure File Transfer Endpoints

### 4.1. Download Assignment Attachment
- **Route:** `GET /api/assignments/:assignmentId/attachments/:attachmentId`
- **Access:** Authenticated students enrolled in class, assigned faculty, or admin.
- **Response:** Binary file stream with `Content-Disposition: attachment; filename="<original_name>"`.

### 4.2. Download Student Submission File
- **Route:** `GET /api/submissions/:submissionId/files/:fileId`
- **Access:** Submitting student owner, assigned faculty instructor, or admin.
- **Response:** Binary file stream. Cross-student requests return `403 Forbidden`.

---

## 5. Administrator Overview

### 5.1. Institutional Assignment Metrics
- **Route:** `GET /api/assignments/admin/overview`
- **Roles:** `admin`
- **Query Params:** `department`, `semester`
- **Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "totalAssignments": 24,
    "publishedAssignments": 20,
    "draftAssignments": 2,
    "closedAssignments": 2,
    "totalSubmissions": 480,
    "evaluatedSubmissions": 450
  }
}
```

