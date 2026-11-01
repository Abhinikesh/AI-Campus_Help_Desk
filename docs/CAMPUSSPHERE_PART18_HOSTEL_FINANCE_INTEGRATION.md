# CampusSphere AI — Part 18: Hostel Finance & Ledger Integration

## 1. Zero Shadow Ledgers & Precision Arithmetic

In accordance with the financial integrity rules established in Part 16:
- All monetary amounts (hostel fees, security caution deposits, mess meal charges, property damage assessments, and outstanding dues) are stored strictly as **positive integers representing Indian Paise** (`1 INR = 100 paise`).
- Floating-point calculations are strictly forbidden to eliminate IEEE-754 binary rounding drift.
- Zero shadow financial ledgers: Hostel financial operations reference Part 16 `FeeStructure` and `StudentInvoice` architectures, ensuring seamless billing consolidation.

---

## 2. Institutional Policy Fee Configurations

Default residential tariff structures are governed by `HostelPolicy` (`server/models/HostelPolicy.js`):

| Fee Head | Default Amount (Paise) | Equivalent INR | Description |
| :--- | :--- | :--- | :--- |
| **Default Hostel Fee** | `4,500,000` | ₹45,000.00 | Annual or semester residential accommodation fee |
| **Caution Deposit** | `1,000,000` | ₹10,000.00 | Refundable institutional property deposit |
| **Mess Fee** | `2,500,000` | ₹25,000.00 | Semester dining mess catering fee |

---

## 3. Damage Assessments & Departure Clearance

During the physical check-out circulation inspection:
- If damages are identified (e.g. broken fixtures, lost keys), the inspecting warden or staff records `damageAssessmentInPaise` directly into `HostelOccupancy.checkOut`.
- Outstanding dues (`outstandingDuesInPaise`) determine whether clearance is marked `'cleared'`, `'conditional'`, or `'withheld'`.
- Withheld clearances prevent formal academic degree issuance until financial reconciliation is verified by the campus finance office.

