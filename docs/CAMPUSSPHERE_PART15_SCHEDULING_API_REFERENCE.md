# CampusSphere AI — Part 15: Timetable & Academic Calendar API Reference

## 1. Overview

The Timetable & Academic Calendar APIs are mounted at `/api/timetable` and `/api/calendar`.
All endpoints require JWT Bearer authentication (`authMiddleware`) and enforce role-based access controls.

---

## 2. Timetable Management Endpoints (`/api/timetable`)

### 2.1. Create Timetable Entry
- **Path & Method:** `POST /api/timetable`
- **Access:** `admin`, `faculty` (faculty may only schedule for themselves)
- **Request Body:**
  ```json
  {
    "subject": "60d0fe4f5311236168a109ca",
    "faculty": "60d0fe4f5311236168a109cb",
    "academicYear": "2026-2027",
    "department": "CSE",
    "semester": 5,
    "section": "A",
    "dayOfWeek": 1,
    "period": 1,
    "periodCount": 1,
    "startTime": "09:00",
    "endTime": "10:00",
    "room": "Hall 301",
    "sessionType": "Lecture"
  }
  ```
- **Responses:**
  - `201 Created`: Entry created successfully in `draft` state (or `published` if created directly by Admin).
  - `400 Bad Request`: Missing mandatory fields or malformed data.
  - `403 Forbidden`: Faculty member scheduling for another instructor.
  - `409 Conflict`: Faculty, class cohort, classroom, holiday, or examination collision.

---

### 2.2. Get Student Timetable
- **Path & Method:** `GET /api/timetable/student`
- **Access:** `student`
- **Behavior:** Scoped strictly to the authenticated student's enrolled department, semester, and section. Filters out all `draft` entries.
- **Response:**
  - `200 OK`:
  ```json
  {
    "success": true,
    "cohort": { "department": "CSE", "semester": 5, "section": "A" },
    "count": 5,
    "data": [
      {
        "_id": "...",
        "dayOfWeek": 1,
        "dayName": "Monday",
        "time": "09:00 - 10:00",
        "period": 1,
        "room": "Hall 301",
        "sessionType": "Lecture",
        "subject": { "name": "Database Management Systems", "code": "CS501" },
        "faculty": { "name": "Prof. Ramesh Sharma" }
      }
    ]
  }
  ```

---

### 2.3. Get Faculty Timetable
- **Path & Method:** `GET /api/timetable/faculty`
- **Access:** `faculty`, `admin`
- **Behavior:** Returns teaching timetable entries assigned to the authenticated faculty.
- **Response:**
  - `200 OK`: Array of scheduled teaching slots.

---

### 2.4. Update Timetable Entry
- **Path & Method:** `PUT /api/timetable/:id`
- **Access:** `admin`, assigned `faculty`
- **Behavior:** Re-evaluates conflict detection engine excluding current `_id`. If entry was published, requires mandatory `reason` (min 5 chars) and logs revision in `changeHistory`. Dispatches reschedule notifications to enrolled cohort.
- **Responses:**
  - `200 OK`: Updated entry document.
  - `400 Bad Request`: Missing reason on published entry modification.
  - `403 Forbidden`: Unauthorized user.
  - `409 Conflict`: Scheduling collision.

---

### 2.5. Cancel Timetable Entry
- **Path & Method:** `DELETE /api/timetable/:id`
- **Access:** `admin`, assigned `faculty`
- **Request Body:**
  ```json
  {
    "reason": "Instructor attending university academic symposium."
  }
  ```
- **Behavior:** Marks slot `status: 'cancelled'`, records in `changeHistory`, and sends high-priority notification to students.
- **Response:**
  - `200 OK`: `{ "success": true, "message": "Timetable entry cancelled successfully." }`

---

### 2.6. Publish Timetable Version
- **Path & Method:** `POST /api/timetable/publish`
- **Access:** `admin`
- **Request Body:**
  ```json
  {
    "academicYear": "2026-2027",
    "department": "CSE",
    "semester": 5,
    "section": "A",
    "notes": "Official semester timetable release"
  }
  ```
- **Behavior:** Transitions all draft and updated slots for the cohort to `published`, snapshots records in `TimetableVersion`, increments `versionNumber`, and dispatches notification alerts to the cohort.
- **Response:**
  - `200 OK`: Returns created `TimetableVersion` snapshot.

---

### 2.7. Get Timetable Versions
- **Path & Method:** `GET /api/timetable/versions`
- **Access:** `admin`
- **Query Parameters:** `department`, `semester`, `section`, `academicYear`
- **Response:**
  - `200 OK`: Array of historical published timetable versions with audit metadata.

---

## 3. Academic Calendar Endpoints (`/api/calendar`)

### 3.1. Get Aggregated Calendar Events
- **Path & Method:** `GET /api/calendar/events`
- **Access:** `student`, `faculty`, `admin`
- **Query Parameters:** `startDate`, `endDate`, `eventType`, `academicYear`
- **Behavior:** Dynamically aggregates:
  1. `AcademicCalendarEvent` records matching role and audience boundaries.
  2. Scheduled `Exam` records (Part 14) for the cohort.
  3. Published `Assignment` deadlines (Part 13) for the cohort.
- **Response:**
  - `200 OK`: Unified chronologically sorted event stream.

---

### 3.2. Get Upcoming Events Widget
- **Path & Method:** `GET /api/calendar/upcoming`
- **Access:** `student`, `faculty`, `admin`
- **Behavior:** Returns the next 8 upcoming calendar milestones starting from current date.
- **Response:**
  - `200 OK`: Array of upcoming events for dashboard display.

---

### 3.3. Create Calendar Event
- **Path & Method:** `POST /api/calendar/events`
- **Access:** `admin`
- **Request Body:**
  ```json
  {
    "title": "Semester Recess / Winter Break",
    "description": "Annual academic recess period",
    "eventType": "holiday_academic",
    "startDate": "2026-12-20T00:00:00.000Z",
    "endDate": "2027-01-05T23:59:59.999Z",
    "isAllDay": true,
    "audience": "all",
    "venue": "Campus Wide",
    "status": "published"
  }
  ```
- **Responses:**
  - `201 Created`: Event saved and notifications dispatched if requested.
  - `400 Bad Request`: Missing fields or `startDate > endDate`.

---

### 3.4. Update & Delete Calendar Events
- **`PUT /api/calendar/events/:id`**: Updates event metadata (`admin` only).
- **`DELETE /api/calendar/events/:id`**: Sets event status to `cancelled` (`admin` only).

