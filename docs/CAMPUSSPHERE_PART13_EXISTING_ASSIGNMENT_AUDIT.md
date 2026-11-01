# CampusSphere AI — Part 13 Existing Assignment & Academic System Audit

## 1. Audit Overview & Objectives

In accordance with Phase A of Part 13, this document provides a comprehensive audit of existing academic structures, file storage services, data models, routes, and UI components in CampusSphere AI. 

The audit establishes the foundation for integrating a production-grade **Assignment Management, Student Submission & Faculty Evaluation System** without duplicating or disrupting existing ERP features.

---

## 2. Existing Data Models & Academic Relationships

### 2.1 Academic Structure
- **`Subject` (`server/models/Subject.js`)**:
  - Contains `code`, `name`, `credits`, `branch`, `semester`, and `faculty` (`ObjectId` ref to `User`).
  - Represents the authoritative curriculum unit taught by faculty and taken by enrolled students.
- **`Student` (`server/models/Student.js`)**:
  - Contains `user` (`ObjectId` ref to `User`), `rollNumber`, `branch`, `semester`, `section`, `admissionYear`.
  - Determines student class enrollment: a student is enrolled in subjects matching their `branch` and `semester`.
- **`Faculty` (`server/models/Faculty.js`)**:
  - Contains `user` (`ObjectId` ref to `User`), `employeeId`, `department`, `designation`.
  - Determines teaching authority: a faculty member teaches subjects where `subject.faculty === faculty.user`.
- **`Mark` (`server/models/Mark.js`)**:
  - Dedicated exclusively to end-of-semester examination marks (`internal: max 30`, `external: max 70`).
  - Not designed for continuous assignment evaluation, rubric grading, or multi-version student submissions.

### 2.2 File Storage Infrastructure
- **Academic Drive (`server/models/Drive.js`, `server/controllers/drive.controller.js`)**:
  - Utilizes `multer.diskStorage` to store curriculum documents in `server/uploads/drive`.
  - Generates collision-resistant filenames: `Date.now() + '-' + Math.round(Math.random() * 1e9) + ext`.
  - Restricts extensions to `['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.zip', '.txt', '.jpg', '.png', '.jpeg']`.
  - File download is served via protected route with `res.download(filePath, originalName)`.
  - **Limitation**: Academic Drive is an open resource repository for course materials. It does not handle student submission files, private grading files, or submission versioning.

---

## 3. Gap Analysis: What is Missing

| Academic Capability | Existing State | Requirement for Part 13 |
| :--- | :--- | :--- |
| **Assignment Definition** | None | Dedicated `Assignment` model linking subject, faculty, class, deadlines, and attachments. |
| **Student Submissions** | None | Dedicated `Submission` model with multi-version history, late tracking, and secure file references. |
| **Secure Submission Storage** | General Drive only | Isolated storage directory (`server/uploads/assignments`) with access-controlled downloads. |
| **Faculty Evaluation** | Semester marks only | Continuous grading interface: marks awarded, max marks snapshot, and faculty feedback. |
| **Deadline Enforcement** | None | Server-side UTC deadline evaluation with Asia/Kolkata timezone presentation and late policies. |
| **Real-time Notifications** | Part 12 SSE engine | Hooks triggering `assignment` notifications on publication, submission, and grading. |
| **Faculty & Student Portals** | Dashboards present | Dedicated `Assignments` tabs and pages for both student submission and faculty grading. |

---

## 4. Reusable Components & Infrastructure

1. **Authentication & RBAC Middleware**:
   - `authMiddleware` in `server/middleware/auth.middleware.js` extracts verified JWT identity from Bearer token or HttpOnly cookie.
   - `allowRoles('faculty', 'student', 'admin')` in `server/middleware/role.middleware.js`.
2. **Notification Service (`server/services/notification.service.js`)**:
   - Centralized real-time SSE push and MongoDB notification persistence.
   - Idempotent deduplication via compound unique index `{ recipient: 1, eventId: 1 }`.
   - Category `'assignment'` is already configured in `Notification.js` and `NotificationPreference.js`.
3. **File Storage Pipeline (`multer`)**:
   - Multer disk storage engine can be extended with dedicated assignment upload folders (`uploads/assignments/attachments` and `uploads/assignments/submissions`).
4. **UI Design System & Shell**:
   - Responsive `Sidebar.jsx`, `Navbar.jsx` with notification bell, card grids, badges, tabs, and modals.

---

## 5. Architectural Decisions for Part 13

1. **Model Separation**:
   - Keep `Assignment` (curriculum task) and `Submission` (student work) separate to allow scalable 1-to-many relationships, independent indexing, and clean auditing.
2. **Resubmission Version History**:
   - Rather than discarding previous attempts, each `Submission` document maintains a `previousVersions` array storing `{ version, files, textResponse, submittedAt }`.
3. **Storage Security**:
   - Files are stored on disk with randomized safe filenames.
   - Raw file paths are NEVER exposed to the public. All downloads are proxied through authenticated authorization-checked routes.
4. **Timezone Policy**:
   - All database records store ISO UTC timestamps.
   - Frontend and formatters convert timestamps to Indian Standard Time (`Asia/Kolkata`, UTC+5:30).

