# CAMPUSSPHERE AI — PART 17/24
# MANUAL TESTING & USER ACCEPTANCE VALIDATION GUIDE

**Phase:** Part 17 of 24  
**Module:** Physical Library Management System  
**Status:** Completed & Stabilized  

---

## 1. Prerequisites & Test Accounts

Start the development daemons:
```bash
# Terminal 1: Backend Server
cd server && node server.js  # Runs on http://localhost:5001

# Terminal 2: Frontend Client
cd client && npm run dev     # Runs on http://localhost:5173
```

Log in with seeded accounts or test credentials:
- **Admin:** `admin@campussphere.edu` (Role: `admin`)
- **Librarian:** `librarian@campussphere.edu` (Role: `librarian`)
- **Student 1:** `student1@campussphere.edu` (Role: `student`)
- **Student 2:** `student2@campussphere.edu` (Role: `student`)

---

## 2. Step-by-Step Validation Walkthroughs

### Workflow 1: Admin Accessions a New Title and Physical Copies
1. Log in as **Admin** or **Librarian**.
2. Navigate to sidebar -> **Library Desk** (`/admin/library`).
3. Click the **Catalog & Inventory** tab.
4. Click **+ Add Title**. Fill in:
   - Title: `Operating System Concepts (10th Edition)`
   - Authors: `Abraham Silberschatz, Peter B. Galvin`
   - Category: `Computer Science`
   - Shelf Number: `CS-03`, Rack: `RACK-A`
   - Click **Save Title**.
5. Locate the newly created title in the table and click **+ Add Copy**.
   - Accession Number: `ACC-CS-101`
   - Condition: `New`
   - Price in ₹: `4,500`
   - Click **Save Copy**.
6. Verify copy count updates to `1 Total, 1 Available, 0 Issued`.

---

### Workflow 2: Issuing a Physical Copy to a Student
1. On `/admin/library`, switch to the **Circulation Desk** tab.
2. Under **Issue / Check-Out**:
   - Select or search for the student (e.g. `Rahul Sharma`).
   - Select the book copy `ACC-CS-101`.
   - Leave due date default (14 days) or pick custom date.
   - Click **Confirm Issue**.
3. Verify badge changes to **Issued**.
4. In another browser or incognito window, log in as `Rahul Sharma` and go to `/student/library`.
5. Verify the book appears under **My Active Loans** with a countdown badge (e.g. `14 days left`).

---

### Workflow 3: Student Renewal Request
1. As the student on `/student/library`, find the active loan.
2. Click **Renew Loan**.
3. Confirm modal prompt.
4. Verify due date extends by 14 days and renewal count increments to `1 / 2`.

---

### Workflow 4: Hold Reservation Queue (When 0 Copies on Shelf)
1. Since `ACC-CS-101` is currently issued, `Operating System Concepts` has `0 Available`.
2. Log in as **Student 2** (`Priya Verma`) and navigate to `/student/library`.
3. In the catalog, locate `Operating System Concepts`.
4. Note the amber **Currently Issued (Join Queue)** status badge.
5. Click **Reserve Copy**.
6. Verify popup confirms **Queue Position #1**.
7. In the student dashboard, verify the reservation is listed under **My Holds & Reservations** with status `Waiting in queue`.

---

### Workflow 5: Return with Auto-Allocation to Reserving Student
1. As Desk Staff on `/admin/library`, switch to **Return / Check-In**.
2. Select `ACC-CS-101`.
3. Condition: `Good`.
4. Click **Confirm Return & Check-In**.
5. Check Student 2's portal:
   - Reservation status transitions to `Ready for Pickup` with a 3-day pickup deadline!
   - Copy status is held (`status: 'reserved'`) and cannot be issued to any random student.
6. Check Student 2's notification bell: a high-priority alert informs them their reserved copy is waiting at the desk.

---

### Workflow 6: Damaged Return & Fine Ledger
1. Issue a book to Student 1.
2. Return it with condition set to **Damaged** and an assessment penalty of ₹1,500.
3. Verify copy status becomes **Damaged** and is NOT returned to open shelf.
4. On `/admin/library`, switch to **Fines Ledger**:
   - Verify the ₹1,500 damage fine is listed under `Pending`.
5. Click **Waive Fine**, enter justification `Volunteered for library inventory reorganization`, and confirm.
6. Verify fine status changes to **Waived** and audit log is preserved.

