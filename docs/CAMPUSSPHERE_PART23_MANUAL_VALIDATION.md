# CampusSphere AI — Part 23/24 Manual Validation Runbook
## Step-by-Step Manual Testing & Operational Acceptance Guide

---

## 1. Prerequisites & Environment Setup

1. **Verify Backend Server**:
   Ensure the backend is running at `http://localhost:5001`.
   ```bash
   curl -s http://localhost:5001/api/health
   # Expected response: {"success":true,"data":{"status":"OK",...}}
   ```
2. **Verify Frontend Dev Server**:
   Ensure Vite client is running at `http://localhost:5173`.
3. **Verify Database**:
   MongoDB listening on `localhost:27018`.

---

## 2. Test Execution Steps

### Scenario 1: Admin HR Desk & Workforce Dashboard
1. Open browser and navigate to `http://localhost:5173`.
2. Log in as an Administrator (`admin` / `Admin@123`).
3. Click **HR & Workforce** on the sidebar or navigate to `http://localhost:5173/admin/hr`.
4. **Verify**:
   - Dashboard KPI cards display Total Staff, On Probation, Onboarding Queue, Pending Leaves, Present Today.
   - Headcount by Department and Category breakdown widgets populate cleanly.
   - Navigation tabs: Overview, Employee Directory, Leave Management, Attendance Roster, HR Announcements.

### Scenario 2: Employee Onboarding & Lifecycle
1. In the **Employee Directory** tab, click **Add Employee**.
2. Complete the form:
   - First Name: `Sarah`
   - Last Name: `Connor`
   - Official Email: `sarah.connor@campussphere.edu`
   - Category: `Teaching Faculty`
   - Department: Select an active department (e.g. `Computer Science`)
   - Designation: Select an active designation (e.g. `Associate Professor`)
   - Joining Date: Select today's date
3. Submit the modal.
4. **Verify**:
   - New employee card appears in directory with generated ID (`EMP-2026-XXXX`).
   - Onboarding status shows `pending`.
   - Click **Verify** on the employee row; status updates to `verified` with a success toast.

### Scenario 3: Leave Application & Separation of Duties
1. In a private/incognito window, log in as a Faculty member (`faculty` / `Faculty@123`).
2. Navigate to `http://localhost:5173/faculty/hr`.
3. **Verify**:
   - Header shows employee name, ID, and designation.
   - Leave balances display current quotas for active policies (e.g. Casual Leave 12/12 days).
4. Click **Apply for Leave**:
   - Policy: `Casual Leave`
   - Dates: Select 2 business days in the upcoming week
   - Reason: `Personal family function`
5. Submit the application.
6. **Verify**: Application appears in "My Leave Applications" table with status `pending`.
7. **Attempt Self-Approval (Separation of Duties Verification)**:
   - Attempting to review/approve own application via API or reviewer endpoint returns `HTTP 403 Forbidden: Separation of duties violation`.
8. Switch back to the Admin browser window (`/admin/hr` -> **Leave Management**).
9. Locate the pending leave application and click **Review**.
10. Select **Approve** and submit.
11. **Verify**:
    - Application status transitions to `approved`.
    - In Faculty window, refresh; balance decrements by exactly 2 days (10/12 days left).
    - In Attendance tab, the approved dates show status `on_leave`.

### Scenario 4: Employee Daily Check-In & Check-Out
1. In the Faculty window (`/faculty/hr`), view the top attendance action card.
2. Click **Check In**.
3. **Verify**:
   - Status changes to `Present` (or `Late` if after grace period).
   - Timestamp is recorded.
   - Duplicate check-in button is disabled.
4. Click **Check Out**.
5. **Verify**: Working hours are calculated and recorded.

### Scenario 5: Employee Document Vault & Security
1. In the Faculty window (`/faculty/hr`), switch to **My Documents** tab.
2. Click **Upload Document**:
   - Document Type: `Academic Qualification`
   - Title: `Doctoral Degree Certificate`
   - Attach a sample PDF file.
3. Submit the form.
4. **Verify**: Document appears with badge `Pending Verification` and download button works.
5. In the Admin window (`/admin/hr`), the document is visible to HR administrators for verification.

### Scenario 6: CWE-1236 Formula Injection Defense & CSV Export
1. In `/admin/hr`, click **Export Employees**.
2. Save the downloaded CSV file (`campus_employees.csv`).
3. Open in a text editor.
4. **Verify**: Any cell beginning with `=`, `+`, `-`, or `@` is prefixed with a single quote (`'`), neutralizing spreadsheet formula execution.

