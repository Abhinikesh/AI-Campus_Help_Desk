# CampusSphere AI — Part 15: Manual Validation & Verification Guide

## 1. Overview

This guide provides test scenarios, credentials, and verification steps for administrators, faculty, and QA reviewers to manually validate the **Academic Calendar, Timetable Management & Scheduling Integration** workflows in CampusSphere AI.

---

## 2. Test Environment Setup

Verify active services:
- **Backend API:** `http://localhost:5001`
- **Frontend Client:** `http://localhost:5173`
- **Python AI Microservice:** `http://localhost:5002`
- **Database:** `mongodb://127.0.0.1:27018/campus-erp`

---

## 3. Step-by-Step Validation Scenarios

### Scenario 1: Admin Adds an Academic Calendar Event
1. **Login:** Access `http://localhost:5173/login` as Admin (`admin@campussphere.edu` / `Admin@123`).
2. **Navigate:** Open sidebar and click **Scheduling & Cal** (`/admin/timetable`).
3. **Action:** Click the **+ Add Calendar Event** button.
4. **Fill Form:**
   - Title: "Mid-Term Academic Recess"
   - Event Type: `College Holiday`
   - Start Date: Select 3 weeks from today.
   - End Date: Select 3 weeks + 4 days from today.
   - Audience: `Everyone (Campus Wide)`
   - Venue: `Main Campus`
5. **Submit:** Click **Publish Event**.
6. **Verification:**
   - Switch to the "Academic Calendar" tab on the page.
   - Confirm "Mid-Term Academic Recess" appears with red "Holiday" pill badge.

---

### Scenario 2: Admin Schedules a Class & Tests Conflict Detection
1. **Action:** On `/admin/timetable`, click **+ Add Class Slot**.
2. **Fill Form:**
   - Subject: Enter active CSE subject code or ID.
   - Faculty: Enter active faculty user ID.
   - Day of Week: `Monday`
   - Period: `1`
   - Start Time: `09:00`, End Time: `10:00`
   - Room: `Hall 301`
3. **Submit:** Click **Schedule Slot**.
4. **Collision Test:**
   - Click **+ Add Class Slot** again.
   - Choose a different subject and faculty, but select the **SAME Room (`Hall 301`)**, **SAME Day (`Monday`)**, and overlapping time (`09:30 - 10:30`).
   - Click **Schedule Slot**.
   - **Verification:** An alert banner appears displaying: *"Classroom Conflict: Room "Hall 301" is already allocated..."* and blocks creation.

---

### Scenario 3: Admin Publishes Timetable Version
1. **Action:** Notice the green **Publish Version** button appears with badge showing draft count.
2. **Click:** Click **Publish Version**. Enter release notes: "Official Semester 5 V1 Schedule".
3. **Submit:** Click **Confirm & Publish**.
4. **Verification:**
   - Status badge on the slot transitions from amber "Draft" to green "Published".
   - Switch to the "Version History" tab: Version 1 snapshot is listed with total slot count and timestamp.

---

### Scenario 4: Student Views Weekly Timetable & Aggregated Calendar
1. **Login:** In an incognito browser window, log in as Student Rahul (`student.rahul@campussphere.edu` / `Student@123`).
2. **Navigate:** Open the sidebar and click **Timetable & Cal** (`/student/timetable`).
3. **Verification:**
   - The weekly timetable renders the newly published Monday 09:00 - 10:00 class with Hall 301.
   - Click on the **Academic Calendar & Key Deadlines** tab.
   - Confirm the calendar displays:
     1. Institutional holiday: "Mid-Term Academic Recess".
     2. Integrated Examination from Part 14 with purple "Examination" badge.
     3. Integrated Assignment deadline from Part 13 with amber "Assignment Due" badge.
4. **Action Link:** Click "View Exam" or "Submit Work" to verify direct navigation to the respective modules.

---

### Scenario 5: Faculty Timetable & Smart Attendance Launch
1. **Login:** Log in as Faculty Professor Sharma (`prof.sharma@campussphere.edu` / `Faculty@123`).
2. **Navigate:** Open sidebar and click **Weekly Timetable** (`/faculty/timetable`).
3. **Verification:**
   - The Monday lecture appears with the subject code and room.
   - Click **Start Attendance**.
   - The page routes to `/faculty/attendance` with the session pre-filled.
   - Launch attendance and verify facial verification works normally.

