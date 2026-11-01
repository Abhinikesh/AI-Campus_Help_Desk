# CAMPUSSPHERE AI — PART 17/24
# LIBRARY FINE MANAGEMENT & FINANCIAL INTEGRITY

**Phase:** Part 17 of 24  
**Module:** Physical Library Management System  
**Status:** Completed & Stabilized  

---

## 1. Zero Rounding Drift: Decimal-Safe Integer Paise

All financial values in the library subsystem are strictly represented and calculated in integer paise ($1\text{ INR} = 100\text{ paise}$).
- Standard fine rates: `finePerOverdueDayInPaise` (e.g. `200` paise = ₹2.00/day).
- Maximum fine cap: `maxFinePerBookInPaise` (e.g. `50000` paise = ₹500.00).
- Book prices: `priceInPaise` (e.g. `450000` paise = ₹4,500.00).

Virtual getters automatically convert paise to rupees for UI display (`amountInRupees`).

---

## 2. Overdue Fine Calculation Engine

The overdue calculation in `libraryService.calculateOverdueFine` enforces the following mathematical rules:

$$\text{diffDays} = \max\left(0, \left\lfloor \frac{\text{returnDate} - \text{dueDate}}{86,400,000} \right\rfloor\right)$$

$$\text{fineInPaise} = \begin{cases} 
0 & \text{if } \text{diffDays} \le \text{gracePeriodDays} \\
\min(\text{diffDays} \times \text{ratePerDayInPaise}, \text{maxFinePerBookInPaise}) & \text{if } \text{diffDays} > \text{gracePeriodDays}
\end{cases}$$

### Example Scenarios:
- **Scenario A (Within Grace):** Due Oct 1, Returned Oct 2 (1 day overdue, Grace: 2 days). Fine = 0.
- **Scenario B (Exceeds Grace):** Due Oct 1, Returned Oct 6 (5 days overdue, Grace: 2 days). Rate = 200 paise/day. Fine = $5 \times 200 = 1000\text{ paise}$ (₹10.00).
- **Scenario C (Capped):** Due Oct 1, Returned 300 days later. Fine is safely capped at `50000 paise` (₹500.00).

---

## 3. Fine Waivers & Audit Trail

Administrators or Head Librarians can formally waive a fine.
- **Mandatory Justification:** Rejects waiver with HTTP 400 if reason is omitted or fewer than 5 characters.
- **Status Transition:** Fine transitions from `pending` to `waived`.
- **Immutable Audit Logging:** Appends a record to `LibraryAuditLog` capturing:
  - `action: 'fine_waived'`
  - `entityId: fine._id`
  - `performedBy: staffUserId`
  - `details: { fineNumber, amountInPaise, waiverReason }`
- **Student Alert:** Automatically dispatches a notification to the student informing them of the granted waiver.

---

## 4. Cash / Counter Payment Recording

Physical circulation desks accept cash or offline payments:
- Records `paymentReference` (e.g. `CASH-REC-1793472000`).
- Records `paymentDate`, `paidAt`, and `paymentMode` (`cash`, `online`, `other`).
- Updates fine status to `'paid'`.

