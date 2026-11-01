# CampusSphere AI — Part 19: Manual Validation Guide

This step-by-step walkthrough enables quality engineers, system administrators, and institutional stakeholders to verify the Part 19 Campus Transport Management System through the UI and REST API.

---

## 1. Prerequisites & Environment Check

1. **Backend Server Running:** Confirm `http://localhost:5001` responds.
2. **Frontend Running:** Confirm Vite client is available at `http://localhost:5173`.
3. **Database Available:** MongoDB active on `localhost:27018` or configured URI.
4. **User Accounts:**
   - **Admin:** `admin@campussphere.edu`
   - **Transport Manager:** `transport.manager@campussphere.edu`
   - **Driver:** `ramesh.driver@campussphere.edu`
   - **Student:** `rahul.student@campussphere.edu`

---

## 2. End-to-End Verification Scenarios

### Scenario 1: Fleet Vehicle Registration & Validation
1. Log in as **Admin** or **Transport Manager** and navigate to **Transport Desk** (`/admin/transport`).
2. Switch to the **Fleet Vehicles** tab.
3. Click **Add Vehicle** and submit:
   - Registration Number: `DL-01-EV-2026`
   - Internal Code: `BUS-05`
   - Vehicle Type: `Electric Bus`
   - Seating Capacity: `45`
   - Insurance Policy Number: `POL-ICICI-998822`
   - Insurance Expiry Date: Future date (e.g., 1 year from today)
   - Fitness Certificate Expiry Date: Future date
   - Permit Expiry Date: Future date
4. **Verification:** The vehicle appears in the fleet table with status badge `Active` and correct seating capacity `45`.

---

### Scenario 2: Document Expiry Alert Verification
1. Click **Add Vehicle** to register an asset with an expiring document:
   - Registration Number: `DL-01-EXP-9999`
   - Internal Code: `BUS-99`
   - Fitness Certificate Expiry: Set to 10 days from today.
2. Navigate back to the Transport Desk dashboard.
3. **Verification:** The amber alert banner appears: **"1 document(s) expiring within 30 days"**, listing `BUS-99 (Fitness Certificate)`.

---

### Scenario 3: Route Corridor & Stop Setup
1. On the Transport Desk, switch to the **Routes & Corridors** tab.
2. Click **Create Route** and enter:
   - Route Code: `R-NORTH-01`
   - Route Name: `North Campus Express`
   - Start Location: `Rohini Sector 18`
   - End Location: `Campus Main Gate`
   - Morning Departure Time: `07:15`
   - Morning Arrival Time: `08:45`
   - Evening Departure Time: `17:15`
   - Operating Days: `Monday, Tuesday, Wednesday, Thursday, Friday`
   - Max Capacity: `45`
3. Click on the created route row to expand its details.
4. Click **Add Stop**:
   - Sequence: `1`, Stop Name: `Rohini Sec 18 Metro`, Pickup: `07:15`, Drop: `18:15`
5. Click **Add Stop**:
   - Sequence: `2`, Stop Name: `Pitampura TV Tower`, Pickup: `07:35`, Drop: `17:55`
6. Click **Assign Fleet & Crew**:
   - Select Vehicle: `BUS-05`
   - Select Driver: `Ramesh Kumar`
7. **Verification:** The route details now display assigned vehicle `BUS-05`, driver `Ramesh Kumar`, and 2 ordered boarding stops.

---

### Scenario 4: Student Commuter Application
1. Log in as **Student** (`rahul.student@campussphere.edu`) and navigate to **My Transport** (`/student/transport`).
2. The route explorer shows available campus routes and stop timings.
3. Click **Apply for Transport Pass**:
   - Select Route: `North Campus Express (R-NORTH-01)`
   - Select Boarding Stop: `Pitampura TV Tower`
   - Emergency Contact Name: `Sunita Sharma (Mother)`
   - Emergency Contact Phone: `+91 98765 43210`
4. Click **Submit Application**.
5. **Verification:** The application status shows `Pending Review` with application number `TR-APP-...`.

---

### Scenario 5: Review & Concurrency-Safe Seat Allocation
1. Log in as **Transport Manager** and open the **Applications Desk** tab.
2. Locate Rahul's pending application.
3. Click **Approve**. Application transitions to `Approved`.
4. Click **Allocate Seat**:
   - Set validity: Start of term to End of term.
   - Set fee amount: ₹15,000 (`1,500,000 paise`).
5. Click **Confirm Allocation**.
6. **Verification:**
   - A digital pass number is generated (`TP-2026-...`).
   - The route's `allocatedStudentsCount` increments by 1.
   - Attempting to allocate another student when capacity is full returns an immediate capacity warning.

---

### Scenario 6: Student Digital Commute Pass
1. Return to the student session at `/student/transport`.
2. **Verification:**
   - The top banner displays the **Digital Commuter Bus Pass**.
   - Details confirm: Pass ID, Allocated Route `R-NORTH-01`, Boarding Stop `Pitampura TV Tower`, Pickup Time `07:35 AM`, and Return Time `05:55 PM`.
   - Driver contact and vehicle registration number are visible.

---

### Scenario 7: Driver Delay Notification Dispatch
1. Log in as **Driver** or **Transport Manager**.
2. Under **Daily Trips**, select today's morning run for `R-NORTH-01`.
3. Click **Report Delay**:
   - Delay Minutes: `20`
   - Reason: `Traffic jam due to flyover construction`
4. Click **Broadcast Delay Alert**.
5. Log in as the student.
6. **Verification:** An amber delay banner appears on the student's transport dashboard: **"Route R-NORTH-01 delayed by 20 minutes: Traffic jam due to flyover construction"**. Centralized notification is also delivered.

---

### Scenario 8: Vehicle Maintenance Logging
1. In the admin desk, open the **Maintenance** tab.
2. Click **Log Maintenance**:
   - Vehicle: `BUS-05`
   - Service Type: `Routine Service`
   - Description: `Engine oil change, brake pad inspection, air filter cleaning`
   - Odometer: `15,400 km`
   - Cost: `₹8,500` (stored as `850000 paise`)
   - Service Provider: `Tata Motors Authorized Service Center`
3. Click **Save Maintenance Record**.
4. **Verification:** The maintenance ledger updates, and `BUS-05` odometer updates to `15,400 km`.

---

### Scenario 9: CSV Export & Formula Injection Guard (CWE-1236)
1. In the admin desk, click **Export Allocations CSV**.
2. Open the downloaded CSV file in a text editor or spreadsheet viewer.
3. **Verification:** Any field starting with `=`, `+`, `-`, or `@` is prefixed with an apostrophe `'`, preventing formula execution.

