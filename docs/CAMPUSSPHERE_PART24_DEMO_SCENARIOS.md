# CampusSphere AI — Repeatable Demonstration Scenarios
## Part 24/24 Step-by-Step Institutional Demonstration & Evaluation Scripts

---

## 1. Executive Summary

This manual provides structured, end-to-end demonstration scripts for stakeholders, university executives, accreditation auditors (NAAC/ABET), and engineering teams. Each script provides exact credentials, navigation routes, expected UI state changes, and verification checkpoints.

---

## 2. Default Demonstration User Directory

All accounts are seeded and available in the local database:

| Role | Username / Email | Password | Primary Demonstration Focus |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin@campussphere.edu` | `Admin@12345` | Global dashboards, master setup, institutional policies. |
| **Faculty Member** | `faculty.cse@campussphere.edu` | `Faculty@12345` | Smart attendance launch, coursework grading, exams, HR. |
| **Student (Final Year)**| `student.cse@campussphere.edu` | `Student@12345` | Attendance check-in, fees, hostel, library, placement cell. |
| **Librarian** | `librarian@campussphere.edu` | `Librarian@12345` | Book cataloging, circulation loans, overdue fines. |
| **Hostel Warden** | `warden@campussphere.edu` | `Warden@12345` | Bed allocation, occupancy grid, room transfer approvals. |
| **Transport Manager** | `transport@campussphere.edu` | `Transport@12345` | Fleet management, route stops, bus pass allocation. |
| **Placement Officer** | `placement@campussphere.edu` | `Placement@12345` | Corporate drives, candidate filtering, offer letters. |
| **HR Administrator** | `hr@campussphere.edu` | `HRAdmin@12345` | Employee directory, leave balance ledger, attendance logs. |

---

## 3. Demonstration Script Walkthroughs

### Script 1: Student Comprehensive Academic Experience
1. **Login**: Navigate to `/login`, sign in as `student.cse@campussphere.edu`.
2. **Dashboard Overview**: Observe personalized KPI cards showing attendance rate, upcoming assignment deadlines, and pending fee balance.
3. **Smart Attendance Verification**:
   - Navigate to `/student/attendance/mark`.
   - Grant webcam permissions; notice live camera viewport.
   - Enter dynamic classroom PIN / scan rotating QR code.
   - Click "Verify & Check In". Observe instant green verification toast and attendance counter update.
4. **Assignments Desk**:
   - Navigate to `/student/assignments`.
   - Select "CS301: Distributed Systems Lab 3".
   - Upload coursework PDF. Notice instant status transition from "Pending" to "Submitted".
5. **Fee Payment & Receipt**:
   - Navigate to `/student/fees`.
   - Review pending Tuition Fee invoice with itemized fee components.
   - Click "Pay Now (Demo Gateway)". Status updates to "Paid".
   - Click "Download Receipt" to view official digital invoice with receipt number.
6. **Library Reservation**:
   - Navigate to `/student/library`. Search "Introduction to Algorithms".
   - Click "Reserve Copy". Observe confirmed reservation hold banner.

---

### Script 2: Faculty Live Attendance & Assessment Management
1. **Login**: Sign in as `faculty.cse@campussphere.edu`.
2. **Launch Smart Attendance**:
   - Navigate to `/faculty/attendance`.
   - Select Course: "CS301: Distributed Systems", Room: "Lab 302", Duration: "15 mins".
   - Click "Start Live Session".
   - Projector screen renders large rotating TOTP QR code with 15-second countdown timer.
   - As students check in, observe live counter ("12 / 60 Present") increment in real-time.
3. **Coursework Assignment**:
   - Navigate to `/faculty/assignments`.
   - Click "Create Assignment". Enter Title: "Assignment 4: Paxos Consensus", Marks: 50, Due Date: Next Friday.
   - Click "Publish". Observe SSE notification emitted to cohort.
4. **Grading & Feedback**:
   - Select submitted coursework from the roster.
   - Enter Score: 45 / 50 and Feedback: "Excellent implementation of leader election".
   - Click "Publish Grade".
5. **HR Self-Service**:
   - Navigate to `/faculty/hr`.
   - View remaining Casual and Sick leave balances.
   - Click "Apply Leave", select date range and substitute faculty, click "Submit".

---

### Script 3: Placement Cell & Campus Recruitment Drive
1. **Login**: Sign in as `placement@campussphere.edu`.
2. **Create Corporate Drive**:
   - Navigate to `/admin/placement`.
   - Click "New Drive". Select Company: "Google Cloud", Role: "Associate Software Engineer", CTC: "₹24,00,000".
   - Set Minimum CGPA: 8.0, Max Backlogs: 0.
   - Click "Announce Drive".
3. **Candidate Screening**:
   - Open Drive Applications list.
   - System automatically flags students meeting the 8.0 CGPA criteria as "Eligible".
   - Transition selected cohort to "Interview Round 1".
4. **Offer Generation**:
   - Select finalist. Click "Issue Offer".
   - System updates student's career status to "Placed" and generates digital offer record.

---

### Script 4: Campus Inventory & Asset Procurement Flow
1. **Login**: Sign in as `admin@campussphere.edu` or Storekeeper.
2. **Navigate to Inventory**: Open `/admin/inventory`.
3. **Asset Tagging**:
   - Click "Add Asset". Input Tag: `AST-LAB-2026-089`, Item: "Dell Precision Workstation", Cost: ₹85,000.00 (stored as `8500000` paise).
   - Assign to Department: "Computer Science".
4. **Stock Movement & Audit**:
   - Navigate to Stock Items. Select "A4 Ream Paper".
   - Record "Issue to Exam Cell" quantity: 20 units.
   - Ledger records stock reduction atomically with user timestamp.

---

## 4. Demonstration Verification Checkpoints

- **Zero Blank Pages**: All 33 routes render immediately with styled loading skeletons.
- **Real-Time Responsiveness**: SSE push delivers notification banners within $< 500\text{ms}$.
- **Data Fidelity**: All financial amounts render in Indian Rupee format (`₹XX,XXX.XX`).
- **Access Control Enforced**: Attempting to access `/admin/finance` as student redirects to `/student/dashboard`.
