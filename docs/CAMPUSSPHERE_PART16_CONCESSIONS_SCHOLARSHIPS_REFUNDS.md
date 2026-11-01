# CAMPUSSPHERE AI — PART 16/24
# CONCESSIONS, SCHOLARSHIPS, WAIVERS & FORMAL REFUNDS

## 1. Concession Lifecycle

The institution provides multiple financial aid instruments:
- `merit_scholarship`: Academic excellence tuition discounts.
- `need_based_concession`: Economically weaker section fee support.
- `government_scholarship`: State / central welfare scholarships.
- `institutional_waiver`: Staff ward and institutional quota reductions.
- `refund`: Excess payment, caution deposit, or withdrawal refunds.

### Application & Review Workflow
1. **Application:**
   Student or Admin submits a concession request against an active invoice via `POST /api/fees/adjustments`.
   - Constraints: $0 < \text{amountInPaise} \le \text{invoice.grossAmountInPaise}$.
   - Creates a `FeeAdjustment` in `pending` status.
   - The invoice balance is **not** altered.

2. **Administrative Approval:**
   Finance Administrator inspects the justification and supporting award reference.
   - Calls `PATCH /api/fees/adjustments/:id/approve`.
   - Status updates to `approved`.
   - Reconciles invoice: increments `concessionAmountInPaise`, reduces `netPayableInPaise` and `outstandingBalanceInPaise`.
   - Dispatches in-app notification to the student.

3. **Administrative Rejection:**
   Calls `PATCH /api/fees/adjustments/:id/reject` with mandatory rejection reason.
   - Status updates to `rejected`.
   - Invoice balance remains unaltered.

---

## 2. Forensic Refund Ledger Architecture

Unlike destructive systems that delete or edit historical payment transactions, CampusSphere AI handles refunds via **audit-proof compensating transactions**:

- An approved refund is created with `adjustmentType: 'refund'`.
- Reconciles invoice balances:
  $$\text{Effective Amount Paid} = \sum \text{Verified Transactions} - \sum \text{Approved Refunds}$$
  $$\text{Outstanding Balance} = \max(0, \text{Net Payable} - \text{Effective Amount Paid})$$
- Controller strictly prevents refunding more than the total verified payments recorded:
  $$\text{Refund Amount} \le \text{invoice.amountPaidInPaise}$$
- Historical payment receipts and transaction records remain 100% intact for external statutory financial audits.

