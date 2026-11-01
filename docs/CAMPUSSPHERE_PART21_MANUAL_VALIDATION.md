# CampusSphere AI — Part 21: Manual Validation Guide

This step-by-step walkthrough enables quality engineers, system administrators, and student representatives to verify the Part 21 Campus Events, Clubs & Activities Management System via the user interface and REST endpoints.

---

## 1. Prerequisites & Environment Check

1. **Backend Server Running:** Confirm `http://localhost:5001` responds (`GET /api/health`).
2. **Frontend Running:** Confirm Vite client is available at `http://localhost:5173`.
3. **Database Available:** MongoDB active on `localhost:27018` or configured URI.
4. **User Accounts:**
   - **Admin:** `admin@campussphere.edu`
   - **Faculty Coordinator:** `faculty.coordinator@campussphere.edu`
   - **Event Organizer:** `organizer@campussphere.edu`
   - **Student:** `rahul.student@campussphere.edu`

---

## 2. End-to-End Verification Scenarios

### Scenario 1: Proposing a New Event & Setting Up Criteria
1. Log in as **Event Organizer** (`organizer@campussphere.edu`) or **Faculty**.
2. Navigate to **Activities & Clubs** (`/admin/activities`).
3. Click **Add Event** and fill in:
   - Event Title: `Annual AI & Machine Learning Symposium 2026`
   - Event Code: `EV-AIMS-2026`
   - Category: `conference`
   - Start Date & Time: Set 10 days in the future.
   - End Date & Time: Set 11 days in the future.
   - Registration Opens: Today.
   - Registration Closes: 8 days in the future.
   - Max Capacity: `50`
   - Waitlist Enabled: `true` (Capacity: `25`)
4. Save the event.
5. **Verification:** The event appears in the Events Directory with status badge `DRAFT`. It is **NOT visible** to students.

---

### Scenario 2: Submitting for Approval & Department Review
1. On the Event Directory table, click **Submit** on `EV-AIMS-2026`.
2. Status updates to `PENDING_APPROVAL`.
3. Log in as **Admin** or Faculty Authority.
4. Locate the pending event and click **Approve**.
5. **Verification:** Status transitions to `APPROVED`.
6. Click **Publish**.
7. **Verification:** Status becomes `PUBLISHED`. The event is now synced into the institutional **Academic Calendar** (`/admin/timetable`).

---

### Scenario 3: Student Discovery & Live Eligibility Check
1. Log in as **Student** (`rahul.student@campussphere.edu`).
2. Navigate to **Campus Activities** (`/student/activities`).
3. Under the **Explore Events** tab, observe `Annual AI & Machine Learning Symposium 2026`.
4. Click **Eligibility**.
5. **Verification:** A green modal appears stating: *"You meet all eligibility requirements for this event!"* with details on your branch, semester, and batch.

---

### Scenario 4: Concurrency-Safe Registration & Waitlist
1. Click **Register Now** and confirm.
2. **Verification:**
   - Status updates to `REGISTERED` / `CONFIRMED`.
   - Unique registration number is issued (e.g. `REG-2026-XXXXX`).
   - The button changes to a green checkmark `Registered`.
3. Switch to **My Registrations** tab:
   - The symposium appears with event dates, venue location, and a `Cancel Registration` action.

---

### Scenario 5: Club Discovery & Membership Application
1. On the Student portal, switch to **Clubs & Societies** tab.
2. Locate `Campus Robotics & AI Society`.
3. Click **Join Club**.
4. In the modal, provide a statement of purpose (e.g. *"Passionate about ROS2 robot navigation and computer vision."*) and submit.
5. **Verification:** Status shows `Application Under Review`.
6. Log in as Admin/Coordinator on `/admin/activities` -> **Clubs & Societies**.
7. Approve Rahul's membership.
8. **Verification:** Club active member count increments by 1. Student receives an in-app notification confirming membership!

---

### Scenario 6: Attendance Recording & Audited Correction
1. Log in as Admin or Event Organizer on `/admin/activities`.
2. Switch to **Attendance & Certificates** tab.
3. Select `Annual AI & Machine Learning Symposium 2026` from the dropdown.
4. Locate student Rahul's entry.
5. Click **Present**.
6. **Verification:** Attendance status changes to green badge `PRESENT`. Student registration updates to `ATTENDED`.
7. Click **Correct**:
   - Change status to `ABSENT` with reason: *"Erroneously marked before physical badge scanning."*
8. **Verification:** Status updates to `ABSENT` and correction reason is stored in `correctionHistory`.
9. Correct back to `PRESENT` with verified reason.

---

### Scenario 7: Issuing Verifiable Certificate & Public Verification
1. On the Attendance desk, click **Cert** next to attendee Rahul Sharma.
2. Select honor type: `Participation`. Click **Issue Certificate**.
3. **Verification:** Certificate is issued with unique number `CERT-2026-XXXXX`.
4. Log in as Student Rahul and switch to **My Certificates** tab.
5. **Verification:** The symposium certificate is displayed with issuing dean details and issue date.
6. Click **Verify Authenticity**:
   - A modal confirms: *"Authentic Verified Certificate: CERT-2026-XXXXX awarded to Rahul Sharma."*
7. Open public verification URL in an incognito window: `http://localhost:5001/api/certificates/verify/CERT-2026-XXXXX`.
8. **Verification:** Valid JSON is returned with event title, student name, and issue date, without exposing private phone, email, or academic marks.

---

### Scenario 8: CSV Export & Formula Injection Defense
1. On the Admin Activities desk, click **CSV** on the symposium row.
2. Open the downloaded file in a text editor.
3. **Verification:** All cell values containing leading `=, +, -, @` are safely escaped with a leading single quote (`'`), neutralizing spreadsheet formula execution.
