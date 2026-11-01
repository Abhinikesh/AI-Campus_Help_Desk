# CAMPUSSPHERE AI — PART 16/24
# OFFLINE PAYMENT RECORDING & VERIFICATION WORKFLOW

## 1. Motivation & Context

In production educational ERP deployments without live external payment gateway integrations, students pay via external banking instruments:
- UPI (Google Pay, PhonePe, Paytm, BHIM)
- Direct Bank Transfer / IMPS
- NEFT / RTGS
- Bank Cheque
- Demand Draft (DD)
- Direct Cash at Campus Accounts Desk

A secure financial system must never auto-credit unverified user claims. Allowing students to simply type "I paid 50,000 INR" and reducing their balance immediately would invite severe fraudulent exploitation.

---

## 2. Multi-tier Verification Lifecycle

```
[Student Submits UTR] ──► (Status: pending) ──► Balance UNCHANGED
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
       [Admin Verifies]                 [Admin Rejects]
               │                               │
       (Status: verified)              (Status: failed)
               │                               │
   • Balance Reduced Atomically    • Balance Unchanged
   • Formal Receipt Generated      • Reason Logged Immutably
   • Student Notified (SSE/In-App) • Student Notified of Rejection
```

### Step 1: Submission & Overpayment Guard
- Student navigates to `/student/fees` and selects an invoice with an outstanding balance.
- Enters `amount` (rupees), `paymentMethod`, `externalReference` (12-digit UTR or Cheque number), `paymentDate`, and optional notes.
- Controller enforces:
  $$0 < \text{amountInPaise} \le \text{invoice.outstandingBalanceInPaise}$$
- Generated record starts in `pending` status.
- **Invoice balances remain completely untouched.**

### Step 2: Administrator Queue & Verification
- Finance Administrator visits `/admin/finance` under the **Pending Verifications** tab.
- Views the student's name, roll number, invoice number, payment mode, bank reference, date, and claimed amount.
- Checks against the college's physical bank statement / net banking portal.
- Clicks **Verify & Credit**:
  - Sets transaction status to `'verified'`, `verifiedBy = adminUserId`, `verifiedAt = new Date()`.
  - Invokes `feeCalcService.reconcileInvoiceBalances(invoice, { save: true })`.
  - Atomically increments `invoice.amountPaidInPaise` and decrements `invoice.outstandingBalanceInPaise`.
  - Dispatches an authoritative notification with category `'fee'` to the student.

### Step 3: Formal Receipt Access
- Once verified, the transaction generates an official printable payment receipt accessible at `/student/fees` under **Verified Receipts**.
- Contains institutional branding, receipt number, transaction ID, student details, payment mode, bank reference, and digital registrar verification stamp.

