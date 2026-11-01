# CAMPUSSPHERE AI — PART 16/24
# FRONTEND USER INTERFACES: STUDENT & ADMIN PORTALS

## 1. Student Portal (`/student/fees`)

Implemented at `client/src/pages/StudentFees/index.jsx`:

### Key Features
1. **Financial Stat Cards:**
   - **Total Net Billed:** Sum of all net payable amounts across enrolled terms.
   - **Total Verified Paid:** Total payments verified by the Finance Department.
   - **Outstanding Balance:** Total pending amount with visual highlighting.
   - **Pending Verification:** Badge indicating transactions under administrative review.

2. **Invoices View:**
   - Card layout for each invoice displaying invoice number, term, department, due date, status badge (`paid`, `partially_paid`, `issued`, `overdue`).
   - Detailed ledger breakdown modal: itemized component amounts, scholarships, and late fees.
   - Direct button to **Record Offline Payment**.
   - Direct button to **Apply Waiver / Concession**.

3. **Offline Payment Modal:**
   - Select payment mode: UPI, Direct Bank Transfer, NEFT/RTGS, Cheque, Demand Draft, Cash.
   - Amount input pre-filled with remaining balance and strictly capped at the balance.
   - UTR / Cheque reference number and payment date.
   - Clear disclosure explaining that submissions start in pending status and update upon verification.

4. **Concession & Scholarship Application Modal:**
   - Categories: Need-based Concession, Academic Merit Scholarship, Government Scholarship, Institutional Waiver.
   - Detailed justification and document reference fields.

5. **Verified Payment Receipts & Printable Modal:**
   - Table of verified transactions.
   - **Printable Modal:** Features CampusSphere AI institutional banner, receipt number, transaction ID, student details, registrar verification stamp, and one-click `window.print()` trigger.

---

## 2. Administrator Portal (`/admin/finance`)

Implemented at `client/src/pages/AdminFinance/index.jsx`:

### Key Features
1. **Executive Metrics Overview:**
   - Total Gross Billed, Concessions Granted, Total Net Receivable, Total Collected, Overall Collection Rate (%), Total Outstanding, Pending Verifications Count and Amount.

2. **Tab 1: Pending Verifications (Action Queue):**
   - High-priority table of pending student offline payments.
   - Displays Student Name, Roll No, Department, Invoice No, Mode, UTR/Reference, Date, and Amount.
   - One-click **Verify & Credit** action button.
   - **Reject** action button with prompt/modal for mandatory rejection reason.

3. **Tab 2: Cohort Invoices Management:**
   - Filters by Department, Semester, Status, and search by Invoice Number.
   - Table showing Net Payable, Amount Paid, Outstanding, Status, and Due Date.
   - **Issue Cohort Invoices** button and modal: select fee structure template, department, semester, section, and due date. Displays duplicate skip summary upon completion.

4. **Tab 3: Fee Structures (Templates):**
   - Grid cards of all templates with status badges.
   - **Create New Structure Template** modal with dynamic component rows (add/remove components, set amounts, toggle mandatory) and late fee policies.
   - Archive structure capability.

5. **Tab 4: Concessions & Refunds:**
   - Management table for concession requests with quick Approve and Reject buttons.
   - **Process Formal Refund** modal with amount validation (strictly capped at verified payments).

6. **CSV Audit Report Export:**
   - Export button triggering `/api/fees/admin/export-csv` which generates an RFC-4180 compliant CSV stream with anti-formula injection guards.

