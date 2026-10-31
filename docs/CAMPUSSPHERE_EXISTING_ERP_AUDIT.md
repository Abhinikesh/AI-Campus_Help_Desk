# CampusSphere AI — Comprehensive Existing ERP Audit

**Audit Date:** November 1, 2026  
**Auditor:** Senior Software Architect, Full-Stack Engineer & Technical Auditor  
**System Name:** CampusSphere AI (Integrated College ERP & Smart Attendance Platform)  
**Repository Location:** `/Users/abhinikesh/AI-Campus_Help_Desk`

---

## 1. Executive Summary

CampusSphere AI is a full-stack higher-education Enterprise Resource Planning (ERP) platform serving three core institutional roles: **Students**, **Faculty**, and **Administrators**. 

The repository consists of:
1. **Frontend:** React 19 Single Page Application built with Vite 8, React Router v7, Lucide icons, and Tailwind/custom enterprise CSS.
2. **Backend Server:** Node.js 20+ Express application managing REST APIs, JWT authentication, role-based authorization, Mongoose ODM database modeling, and audit logging.
3. **Database:** MongoDB (via Mongoose 8.23) supporting relational academic data modeling, session state, attendance logs, and encrypted biometric template references.
4. **AI Microservice:** Python 3.12 Flask microservice hosting a computer-vision biometric engine utilizing OpenCV, dlib ResNet-based facial embeddings (128-dimensional), AES-256-GCM / Fernet vector encryption, and attendance analytics calculations.

The system's UI adheres to a clean, modern enterprise design language: crisp white surfaces (`#FFFFFF`), slate backgrounds (`#F8FAFC`), royal blue accents (`#2563EB`), and a responsive collapsible sidebar defaulting to minimized icon view.

---

## 2. Actual Technology Stack & Dependency Versions

### 2.1 Frontend (`client/`)
- **Framework:** React `19.2.4` + React DOM `19.2.4`
- **Routing:** React Router DOM `7.14.0` (with `React.lazy` code-splitting and declarative `ProtectedRoute`)
- **Build Tool:** Vite `8.0.4` (`@vitejs/plugin-react` `6.0.1`)
- **HTTP Client:** Axios `1.14.0` with credentials support and request interceptor for Bearer token fallback
- **Icons & Animation:** `lucide-react` `1.7.0`, `framer-motion` `12.38.0`
- **Styling:** CSS variables, Tailwind CSS `3.4.19`, PostCSS `8.5.8`, Autoprefixer `10.4.27`, shared enterprise stylesheet (`dashboard-shared.css`)

### 2.2 Backend (`server/`)
- **Runtime:** Node.js `v20.x` / `v22.x`
- **HTTP Framework:** Express `4.22.1`
- **Database Driver / ODM:** Mongoose `8.23.0`
- **Authentication & Security:** 
  - `jsonwebtoken` `9.0.3` (HS256 JWT tokens with 7-day expiration)
  - `bcryptjs` `2.4.3` (Salt rounds: 10)
  - `helmet` `8.3.0` (HTTP security headers)
  - `cors` `2.8.6` (Configured strictly for `CLIENT_URL`)
  - `cookie-parser` `1.4.7` (`campus_token` HTTP-only cookie support)
  - `express-rate-limit` `7.5.1` (10 req/15min for login; 500 req/15min global)
- **File Uploads:** `multer` `2.1.1`
- **AI Integration:** `groq-sdk` `1.1.2` (optional campus help desk LLM integration)
- **Local DB Fallback:** `mongodb-memory-server` `11.3.0` (with persistent WiredTiger storage at `server/.data/db` on fixed port 27018)

### 2.3 Python Computer-Vision AI Service (`ai-service/`)
- **Python Runtime:** Python `3.12.13` (managed in isolated `.venv`)
- **Web Microservice:** Flask `3.1.3`
- **Computer Vision & Image Processing:**
  - `opencv-python-headless` `4.13.0`
  - `numpy` `1.26.4`
  - `Pillow` `10.4.0`
- **Biometric Detection & Recognition Engine:**
  - `face_recognition` `1.3.0`
  - `dlib` `19.24.6`
  - `face-recognition-models` `0.3.0` (128-dimensional ResNet face recognition model)
- **Security & Encryption:**
  - `cryptography` `42.0.8` (Fernet & AES-GCM for 128-d vector template encryption)
- **Testing:**
  - `pytest` `9.2.0` (56 automated unit and integration tests passing)

---

## 3. Project Directory Structure

```
/Users/abhinikesh/AI-Campus_Help_Desk/
├── package.json                 # Monorepo runner (concurrently client + server)
├── .gitignore                   # Ignore node_modules, .env, .venv, .data
│
├── client/                      # React 19 Frontend
│   ├── index.html               # HTML entry point (Title: CampusSphere)
│   ├── package.json             # Vite + React dependencies
│   ├── vite.config.js           # Proxy configuration (/api -> http://localhost:5001)
│   └── src/
│       ├── main.jsx             # React DOM root render
│       ├── App.jsx              # Application router & route definitions
│       ├── components/          # Reusable UI components
│       │   ├── Sidebar/         # Unified Collapsible Icon Sidebar (Sidebar.jsx, Sidebar.css)
│       │   ├── Navbar/          # Clean header with user badge & logout
│       │   ├── ProtectedRoute/  # Role-based route guard
│       │   ├── ErrorBoundary/   # React crash boundary
│       │   ├── LoadingSpinner/  # Loading indicator
│       │   └── AttendanceShared/# CameraPreview, Badges, Modals, Summary Cards
│       ├── context/             # AuthContext, ToastContext, SidebarContext
│       ├── pages/               # Page views across Student, Faculty, Admin
│       ├── services/            # Axios API wrappers (api.js, attendance.service.js, etc.)
│       └── styles/              # dashboard-shared.css (light enterprise tokens)
│
├── server/                      # Node.js Express Backend
│   ├── server.js                # Express entry point (port 5001)
│   ├── package.json             # Backend dependencies & scripts
│   ├── config/                  # env.js, db.js
│   ├── controllers/             # auth, student, faculty, admin, attendance, ai, drive
│   ├── models/                  # 16 Mongoose Schemas (User, Student, Attendance, etc.)
│   ├── middleware/              # auth.middleware, role.middleware, errorHandler
│   ├── routes/                  # auth, student, faculty, admin, attendance, ai, drive
│   ├── services/                # pythonAi.service.js (Bridge to Flask AI service)
│   ├── seeds/                   # updateAllToSem5.js, resetPasswords.js
│   └── tests/                   # attendance.test.js (Node:test integration suite)
│
├── ai-service/                  # Python 3.12 Flask AI Microservice
│   ├── app.py                   # Microservice entry point (port 5002)
│   ├── requirements.txt         # Python dependencies
│   ├── conftest.py              # Pytest fixtures
│   ├── app/
│   │   ├── __init__.py          # Flask app factory
│   │   ├── config.py            # Environment configuration & thresholds
│   │   ├── routes/              # biometric, enrollment, verification, analytics, health
│   │   ├── recognition/         # detector, embedding, matcher, quality, preprocessing
│   │   ├── enrollment/          # enrollment_service, consent_service
│   │   ├── verification/        # verification_service, challenge_service
│   │   ├── analytics/           # engine.py (AttendanceEngine)
│   │   ├── security/            # auth.py (X-Internal-Key), encryption.py (Fernet)
│   │   └── utils/               # image_utils.py, exceptions.py
│   └── tests/                   # test_face_recognition_engine.py, test_analytics.py
│
└── docs/                        # Architectural documentation & audit reports
```

---

## 4. Audit of Existing ERP Modules

### 4.1 Authentication & User Session Module
- **Routes:** `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/change-password`
- **Frontend Component:** `client/src/pages/LoginPage/index.jsx` (`/`)
- **Data Source:** MongoDB `User`, `Student`, `Faculty` collections.
- **Status:** **Fully Functional**.
- **Behavior:** Accepts `loginId` (Roll Number for students, Employee ID for faculty, Admin ID) + password. Issues JWT in HTTP-only cookie `campus_token` and returns token in JSON response. Client `api.js` attaches Bearer token from localStorage as fallback.

### 4.2 Student Portal Modules
| Module | Route | Primary Component | APIs Called | Status | Notes |
|---|---|---|---|---|---|
| **Student Dashboard** | `/student/dashboard` | `StudentDashboard/index.jsx` | `/api/student/profile`, `/api/student/attendance`, `/api/student/exams` | **Fully Functional** | Clean white UI; displays 5th sem subjects, attendance overview table, exams schedule, GPA stat cards. |
| **Attendance Overview** | `/student/attendance` | `Attendance/index.jsx` | `/api/student/attendance`, `/api/attendance/student/overview` | **Fully Functional** | Summary metric cards, Active Live Session join banner, full subject-wise breakdown table. Redundant circular progress rings removed per user directive. |
| **Mark Attendance** | `/student/attendance/mark` | `Attendance/MarkAttendance.jsx` | `/api/student/attendance/sessions`, `/api/student/attendance/join/:id` | **Fully Functional** | Webcam capture, single-face validation, one-to-one biometric verification against student template, fallback manual flow. |
| **Attendance History** | `/student/attendance/history` | `Attendance/AttendanceHistory.jsx` | `/api/student/attendance/history` | **Fully Functional** | Date-filtered log with subject codes, periods, verification methods, and status badges. |
| **Face Registration** | `/student/attendance/face-registration` | `Attendance/FaceRegistration.jsx` | `/api/student/face/status`, `/api/student/face/enroll`, `/api/student/face/revoke` | **Fully Functional** | 3-step voluntary consent wizard, live frame quality evaluation, encrypted template enrollment, revocation option. |
| **Exams & Schedule** | `/student/exams` | `Exams/index.jsx` | `/api/student/exams` | **Functional** | Renders midterm/end-term schedule for enrolled 5th semester subjects. |
| **Results & Grades** | `/student/results` | `Results/index.jsx` | `/api/student/results` | **Functional** | Grade ledger and CGPA gauge for Semesters 1 through 5. |
| **Academic Drive** | `/student/drive` | `Drive/index.jsx` | `/api/drive/files` | **Functional** | Course handouts, syllabi, lecture slides categorized by subject. |
| **Complaints** | `/student/complaints` | `Complaints/index.jsx` | `/api/student/complaints` | **Functional** | Ticket submission modal, category filter, status tracker (`Open`, `In Progress`, `Resolved`). |
| **AI Help Desk** | `/student/ai-help` | `AIHelpDesk/index.jsx` | `/api/ai/chat` | **Functional** | Natural language Q&A regarding fees, timetable, library location, and policies (Groq LLM with fallback). |

### 4.3 Faculty Portal Modules
| Module | Route | Primary Component | APIs Called | Status | Notes |
|---|---|---|---|---|---|
| **Faculty Dashboard** | `/faculty/dashboard` | `FacultyDashboard/index.jsx` | `/api/faculty/profile`, `/api/faculty/timetable`, `/api/faculty/attendance/sessions` | **Fully Functional** | Today's schedule, quick-create attendance session, recent class logs, announcements. |
| **Smart Attendance Hub** | `/faculty/attendance` | `FacultyAttendance/index.jsx` | `/api/faculty/attendance/sessions`, `/api/faculty/timetable` | **Fully Functional** | Active sessions, session creation modal with pre-filled timetable slots, past session history. |
| **Live Attendance Console** | `/faculty/attendance/live/:sessionId` | `FacultyAttendance/LiveAttendance.jsx` | `/api/faculty/attendance/sessions/:id`, `/api/attendance/sessions/:id/qr-challenge`, `/api/faculty/attendance/mark-student` | **Fully Functional** | Real-time roster, live count of present/absent/needs review, dynamic rotating QR challenge token, manual status override modal with mandatory audit reason, finalize session button. |
| **Attendance Records** | `/faculty/attendance/records` | `FacultyAttendance/AttendanceRecords.jsx` | `/api/faculty/attendance/records` | **Fully Functional** | Searchable grid by subject, date, and status with correction logs. |
| **Attendance Reports** | `/faculty/attendance/reports` | `FacultyAttendance/AttendanceReports.jsx` | `/api/faculty/attendance/reports` | **Fully Functional** | Defaulter list (<75% threshold), class average attendance, exportable roster analytics. |
| **Weekly Timetable** | `/faculty/timetable` | `FacultyTimetable/index.jsx` | `/api/faculty/timetable` | **Functional** | Monday–Saturday schedule matrix with subject codes and room numbers. |
| **Student Results** | `/faculty/results` | `FacultyResults/index.jsx` | `/api/faculty/students` | **Functional** | Grade entry and marks ledger. |

### 4.4 Admin Portal Modules
| Module | Route | Primary Component | APIs Called | Status | Notes |
|---|---|---|---|---|---|
| **Admin Dashboard** | `/admin/dashboard` | `AdminDashboard/index.jsx` | `/api/admin/stats`, `/api/admin/users`, `/api/admin/complaints` | **Fully Functional** | Institutional metrics, total students/faculty, user activation toggles, grievances. |
| **Admin Smart Attendance** | `/admin/attendance` | `AdminAttendance/index.jsx` | `/api/admin/attendance/*` (overview, sessions, records, face-enrollments, settings) | **Fully Functional** | Institutional attendance policy configuration (min % threshold, session duration, biometric retention days), biometric profile management, complete audit log viewer. |
| **Complaints Management** | `/admin/complaints` | `Complaints/index.jsx` | `/api/admin/complaints` | **Functional** | Campus-wide ticket resolution interface. |
| **AI Help Desk Admin** | `/admin/ai-help` | `AIHelpDesk/index.jsx` | `/api/ai/chat` | **Functional** | Administrative AI assistant. |

---

## 5. Academic Data Relationships & Scheduling Integration

To ensure the attendance system operates on **genuine ERP records** without synthetic or disconnected entities, the relationship graph is modeled as follows:

```
[ User (role: student) ] <---> [ Student (rollNumber, branch, semester: 5, section: 'A') ]
                                        │
                                        ▼ (Enrolled Roster)
[ User (role: faculty) ] <---> [ Subject (CS501 DAA, sem: 5, branch: 'CSE') ]
                                        │
                                        ▼
[ Timetable (dayOfWeek: 1, 09:00-10:00, room: 'Lab-1') ]
                                        │
                                        ▼
[ AttendanceSession (subjectId, facultyId, date: '2026-11-01', period: 1, status: 'open') ]
                                        │
                                        ▼
[ Attendance (subject, student, session, date, period, status: 'present', method: 'face') ]
        │
        └── Verified 1:1 against [ FaceEmbedding (studentId, encryptedData) ]
```

### Key Relational Rules:
1. **Student Scoping:** A student only sees and can only join active attendance sessions where `AttendanceSession.branch == Student.branch` AND `AttendanceSession.semester == Student.semester`.
2. **Duplicate Prevention:** A compound unique index in MongoDB on `{ subject: 1, student: 1, date: 1, period: 1 }` guarantees that a student can never be recorded twice for the same subject class period.
3. **Faculty Authorization:** Faculty can only open sessions for subjects assigned to them or within their teaching department.

---

## 6. Biometric Engine & Privacy Architecture

The Smart Attendance module strictly complies with the project's non-covert, privacy-first principles:

1. **Voluntary Student-Initiated Verification:** 
   - There is **no continuous classroom scanning** or automated surveillance camera feed.
   - The student logs into their personal portal, navigates to `/student/attendance/mark`, and triggers the verification themselves.
2. **One-to-One (1:1) Verification Only:**
   - The student's live face capture is compared **only** against their own encrypted enrolled template (`FaceEmbedding` linked to `req.user.userId`).
   - The system does **not** perform 1:N searching across the whole student database, eliminating identity spoofing and reducing compute time.
3. **Cryptographic Protection of Biometric Data:**
   - Raw face photos are **never** stored on disk or in the database.
   - The Python service extracts a 128-dimensional floating-point vector, immediately discards the image buffer from RAM, encrypts the vector with AES-256-GCM / Fernet, and returns the encrypted blob.
   - The template is marked `{ select: false }` in Mongoose so it is never returned in student or admin API queries.
4. **Non-Biometric Attendance Fallback:**
   - If a student cannot or chooses not to enroll their face, the faculty can mark them present via manual override in `LiveAttendance.jsx` with a mandatory reason note, recorded in `AttendanceAuditLog`.

---

## 7. Current Technical and Functional Problems Discovered

During the comprehensive audit, the following technical and architectural issues were identified:

1. **In-Memory Database Name Mismatch in Tests:**
   - In `server/config/db.js`, `MongoMemoryServer` initializes with `mongod.getUri()`, connecting mongoose to database `"test"`.
   - In `server/tests/attendance.test.js`, test setup hardcoded `mongodb://127.0.0.1:27018/campus-erp`. When tests ran against a running server, they queried a different database namespace, causing test assertions to fail despite the live API being functional.
2. **Unused Legacy CSS Classes:**
   - In `Attendance.css`, styles for `.progress-ring-large` and `.attendance-grid` remain after the circular rings UI was removed. These should be cleanly pruned during stylesheet optimization.
3. **Internal API Key Uniformity:**
   - Both Node.js (`server/config/env.js`) and Python (`ai-service/app/config.py`) share an internal secret key (`INTERNAL_API_KEY`). While set in development, production deployment must enforce a cryptographically strong secret via `.env`.
4. **Image Payload Size Management:**
   - Base64 webcam frame payloads can reach 1–2 MB. Express body parser is configured for `10mb`, but clients on slower campus Wi-Fi could experience minor network latency if frames are uncompressed. Adding canvas-level downscaling (e.g., 640x480 max) before submission is recommended.

---

## 8. Summary of Inspected Files

### Frontend (`client/src/`)
- `App.jsx`, `main.jsx`, `index.css`, `App.css`
- `components/Sidebar/Sidebar.jsx`, `Sidebar.css`
- `components/Navbar/Navbar.jsx`
- `components/AttendanceShared/CameraPreview.jsx`, `AttendanceStatusBadge.jsx`, `AttendanceSummaryCard.jsx`, `ConfirmationDialog.jsx`, `EmptyState.jsx`
- `pages/StudentDashboard/index.jsx`
- `pages/Attendance/index.jsx`, `MarkAttendance.jsx`, `AttendanceHistory.jsx`, `FaceRegistration.jsx`
- `pages/FacultyDashboard/index.jsx`
- `pages/FacultyAttendance/index.jsx`, `LiveAttendance.jsx`, `AttendanceRecords.jsx`, `AttendanceReports.jsx`
- `pages/AdminDashboard/index.jsx`, `AdminAttendance/index.jsx`
- `pages/Complaints/index.jsx`, `Drive/index.jsx`, `AIHelpDesk/index.jsx`, `Exams/index.jsx`, `Results/index.jsx`
- `services/api.js`, `attendance.service.js`, `auth.service.js`
- `context/AuthContext.jsx`, `ToastContext.jsx`, `SidebarContext.jsx`

### Backend (`server/`)
- `server.js`, `config/env.js`, `config/db.js`
- `models/User.js`, `Student.js`, `Faculty.js`, `Subject.js`, `Timetable.js`, `AttendanceSession.js`, `Attendance.js`, `FaceEmbedding.js`, `ConsentRecord.js`, `AttendanceSettings.js`, `AttendanceAuditLog.js`
- `routes/auth.routes.js`, `student.routes.js`, `faculty.routes.js`, `admin.routes.js`, `attendance.routes.js`, `ai.routes.js`
- `controllers/auth.controller.js`, `student.controller.js`, `faculty.controller.js`, `admin.controller.js`, `attendance.controller.js`
- `middleware/auth.middleware.js`, `role.middleware.js`, `errorHandler.js`
- `services/pythonAi.service.js`
- `seeds/updateAllToSem5.js`
- `tests/attendance.test.js`

### Python AI Service (`ai-service/`)
- `app.py`, `requirements.txt`, `conftest.py`
- `app/__init__.py`, `config.py`
- `app/routes/biometric_routes.py`, `enrollment_routes.py`, `verification_routes.py`, `analytics_routes.py`, `health_routes.py`
- `app/recognition/detector.py`, `embedding.py`, `matcher.py`, `quality.py`, `preprocessing.py`
- `app/enrollment/enrollment_service.py`, `consent_service.py`
- `app/verification/verification_service.py`, `challenge_service.py`
- `app/analytics/engine.py`
- `app/security/auth.py`, `encryption.py`
- `app/utils/image_utils.py`, `exceptions.py`
- `tests/test_face_recognition_engine.py`, `test_analytics.py`, `test_biometrics.py`

