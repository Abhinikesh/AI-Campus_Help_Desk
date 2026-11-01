# CampusSphere AI — Part 18: Manual Validation Guide

## 1. Prerequisites
- Node.js backend running on `http://localhost:5001`.
- Vite client running on `http://localhost:5173`.
- MongoDB running on port 27018.

---

## 2. End-to-End Manual Testing Scenarios

### Scenario 1: Admin Creates Hostels, Rooms, and Beds
1. Log in as an Admin (`/login`).
2. Navigate to **Hostel Desk** (`/admin/hostel`) in the sidebar.
3. In the **Hostels & Inventory** tab, click **+ Add Hostel Building**.
4. Fill out name: `Tagore Boys Hostel`, code: `TBH-1`, type: `boys`, genderEligibility: `male`. Save.
5. In the created hostel row, click **+ Add Room**.
6. Set room number `101`, floor `1`, capacity `2`, room type `double`. Add facilities (`Wi-Fi, Study Desk`). Save.
7. Click **+ Add Bed**. Enter bed label `101-A`. Save.
8. Click **+ Add Bed**. Enter bed label `101-B`. Save.
9. Attempt to add a 3rd bed (`101-C`). Notice the UI / API error toast: Room has reached its maximum configured capacity of 2 beds.

### Scenario 2: Student Submits Hostel Application
1. Log in as a male student.
2. Navigate to **Hostel & Housing** (`/student/hostel`) in the sidebar.
3. Click **Apply for Accommodation**.
4. Select `Tagore Boys Hostel` from preferred hostels, choose `Double Room`, enter distance and emergency contact. Submit.
5. Verify application appears in the **Application Status** card with status `submitted`.
6. Attempt to submit a second application for the same academic year. Verify conflict modal/alert is displayed.

### Scenario 3: Warden Reviews Application and Allocates Bed
1. Log in as assigned Warden or Admin.
2. In `/admin/hostel`, navigate to the **Applications** tab.
3. Locate the student's application. Click **Review**.
4. Select `Approve` with comments. Submit.
5. In the **Allocations** tab, click **+ Allocate Bed**.
6. Select the approved student, `Tagore Boys Hostel`, Room `101`, and Bed `101-A`. Click **Confirm Allocation**.
7. Verify bed status switches to `allocated`.

### Scenario 4: Circulation Desk Check-In
1. Navigate to the **Circulation Desk** tab in `/admin/hostel`.
2. Locate the allocated student record in the **Pending Check-In** table.
3. Click **Check-In**.
4. Enter keys issued (2), room condition notes ("All lights and furniture working"). Confirm.
5. Verify status changes to `Active Occupancy` and bed status switches to `occupied`.

### Scenario 5: Student Files Maintenance Grievance
1. Return to the Student portal (`/student/hostel`).
2. Under the **Maintenance & Grievances** tab, click **Report Issue**.
3. Enter title: "Water leakage in washroom", priority: "High", description: "The pipe beneath the sink is dripping." Submit.
4. Verify the complaint appears in the student's active tickets.
5. Log in as Warden. Verify the ticket appears in the Warden's Maintenance Hub with action buttons to assign and resolve.

### Scenario 6: Student Requests Room Transfer & Warden Executes Swap
1. In Student portal, click **Request Transfer**.
2. Select target room type `Double`, reason: "Need ground floor room for mobility". Submit.
3. In Warden portal, open **Transfer Requests** tab.
4. Click **Review Transfer**. Select approved, choose Room `101`, Bed `101-B`. Confirm.
5. Verify old bed `101-A` is released to `available` and new bed `101-B` is allocated.

### Scenario 7: Student Departure Check-Out
1. In Warden portal **Circulation Desk**, find student under **Active Occupants**.
2. Click **Check-Out**.
3. Verify room condition, confirm keys returned, assess damage (₹0), set clearance to `cleared`. Submit.
4. Verify bed `101-B` is returned to `available` status and occupancy rate is updated.

