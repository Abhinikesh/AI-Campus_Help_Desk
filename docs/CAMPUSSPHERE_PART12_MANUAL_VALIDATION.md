# CampusSphere AI — Part 12 Manual Validation Guide

This step-by-step checklist enables quality assurance teams and administrators to manually validate the Centralized Notification and Campus Announcement system in a browser.

---

## 1. Prerequisites & Services Check

Ensure all three core services are running:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5001`
- Python AI Microservice: `http://localhost:5002`

---

## 2. Validation Checklist

### Scenario A: Real-Time Header Bell & Unread Counter
1. Open Chrome/Firefox and navigate to `http://localhost:5173`.
2. Log in as a student (e.g. `STU001` or any registered student).
3. Observe the top navigation header:
   - Verify that the notification bell icon is visible on both desktop and mobile viewports.
   - If there are unread notifications, verify the red badge shows the exact unread count.
4. Click the bell icon:
   - A dropdown menu opens showing the most recent notifications with category icons and relative timestamps (e.g., "5m ago").
   - Click "Mark all as read" in the dropdown header.
   - Verify the unread badge animates down to zero immediately.
5. Click "View all in Notification Center":
   - Verify the browser navigates smoothly to `/notifications`.

---

### Scenario B: Dedicated Notification Center (`/notifications`)
1. From any role (Student, Faculty, Admin), click **Notifications** in the left sidebar or visit `/notifications`.
2. Inspect the UI layout:
   - **Header**: Shows title, subtitle, unread count badge, and action buttons ("Mark all read", "Preferences").
   - **Category Tabs**: Filter between All, Academic, Attendance, Announcements, Exams, and Admin.
   - **Unread Only Switch**: Toggle the switch to instantly filter only unread notices.
3. Test Notification Interactions:
   - Click the circular checkmark icon on an individual item to mark it read or unread.
   - Click the trash icon to delete a notification.
   - Click the external link icon or card body:
     - Verify it routes directly to the relevant ERP module (e.g., `/student/attendance`).
4. Notification Preferences Modal:
   - Click "Preferences" button in the top right.
   - Modal appears displaying toggles for categories (Attendance, Academic, Assignments, etc.).
   - Note that "System Alerts" is locked with a badge labeled "Mandatory (Security & Safety)".
   - Toggle "Assignment Deadlines" off and click "Save Preferences".
   - Toast notification confirms "Notification preferences saved".

---

### Scenario C: Campus Announcements & Automated Notification Push
1. Open two browser windows side by side:
   - **Window 1**: Logged in as **Admin** or **Faculty**.
   - **Window 2**: Logged in as **Student** (branch: CSE, semester: 5).
2. In Window 1 (Admin/Faculty):
   - Publish a new announcement targeted to "All Students" or "Department: CSE".
   - Title: "Midterm Lab Schedule Release".
   - Priority: "High".
   - Click "Publish".
3. In Window 2 (Student):
   - Notice the bell badge immediately increments without any manual page reload.
   - Click the bell icon: the new announcement alert appears at the top.
   - Click the notification to open the announcement details.

---

### Scenario D: Real-Time Attendance Finalization Alert
1. Faculty creates and conducts an attendance session for a class with Student A present and Student B absent.
2. Faculty clicks "Finalize Session".
3. Student B's browser bell icon immediately rings/updates with an attendance notification:
   - *"Attendance Alert: You were marked absent in <Subject> on <Date>."*
4. Faculty performs an attendance correction for Student B (changing status to "Present" with reason "Medical certificate submitted"):
   - Student B instantly receives a correction notification:
   - *"Attendance Corrected: CS101 status updated to Present. Reason: Medical certificate submitted."*

---

### Scenario E: Security & Biometric Alerts
1. Student navigates to `/student/face-registration`.
2. Student grants biometric consent and registers facial template.
3. Observe security notification in `/notifications`:
   - *"Biometric Enrollment Confirmed: Your face biometric template was successfully enrolled with AES-256-GCM encryption."*
4. Student clicks "Revoke Consent & Delete Biometrics".
5. Immediate critical security notification is received:
   - *"Biometric Consent Revoked: Your biometric face template and encryption keys have been permanently purged."*
   - Verify this notification cannot be muted or suppressed by category settings.

