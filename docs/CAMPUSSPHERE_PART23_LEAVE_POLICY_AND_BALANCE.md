# CampusSphere AI — Part 23/24 Leave Policy & Balance Ledger
## Institutional Leave Entitlements, Accrual Rules & Double-Entry Ledger Mechanics

---

## 1. Overview & Policy Architecture

Higher education institutions enforce diverse leave categories governed by institutional statutes, UGC guidelines, or state labor regulations. The CampusSphere AI leave engine provides a flexible, policy-driven model (`LeavePolicy`) combined with an immutable double-entry ledger (`LeaveLedgerEntry`) that guarantees complete financial-grade auditability.

---

## 2. Standard Institutional Leave Policies

The system supports standard academic and administrative leave classifications:

| Leave Code | Policy Name | Default Annual Quota | Accrual Frequency | Max Consecutive | Negative Allowed | Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CL** | Casual Leave | 12 days | Annual (Jan 1) | 3 days | No | Short unplanned personal contingencies |
| **SL** | Sick / Medical Leave | 10 days | Annual (Jan 1) | 15 days | No | Health conditions & medical recuperation |
| **EL** | Earned / Privilege Leave | 30 days | Monthly / Quarterly | 30 days | No | Accrued based on completed service periods |
| **OD** | Official Duty / Deputation | Ad-hoc | None | 14 days | Yes (Uncapped) | Attending conferences, external exams, university boards |
| **ML** | Maternity / Paternity Leave | Statutory | None | 180 days | No | Statutory parental leave |
| **SBL** | Sabbatical / Study Leave | Specialized | None | 365 days | No | Research sabbaticals for eligible senior faculty |

---

## 3. Double-Entry Leave Ledger Mechanics

To prevent fraudulent balance manipulation or untracked changes, leave balances are never directly updated without an accompanying ledger transaction.

### 3.1. Balance Equation
The current available leave balance for an employee is determined by:
$$\text{Current Balance} = \text{Opening Balance} + \text{Accrued} - \text{Used} + \text{Adjusted}$$

### 3.2. Transaction Types in `LeaveLedgerEntry`

| Transaction Type | Mathematical Impact | When Triggered | Reason Field |
| :--- | :--- | :--- | :--- |
| **`annual_grant`** | $+\text{days}$ (CREDIT) | Initial allocation on Jan 1 or onboarding | `annual_grant` |
| **`accrual`** | $+\text{days}$ (CREDIT) | Periodic monthly or quarterly accrual | `monthly_accrual` |
| **`leave_taken`** | $-\text{days}$ (DEBIT) | Approval of a leave application | `leave_taken` |
| **`cancellation_refund`** | $+\text{days}$ (CREDIT) | Cancellation or revocation of approved leave | `cancellation_refund` |
| **`administrative_adjustment`**| $\pm \text{days}$ (CREDIT / DEBIT) | HR manual correction or compensatory off | `administrative_adjustment` |

---

## 4. Atomic Concurrency Control

When debiting leave days upon requisition approval, multiple concurrent approvals could potentially overdraw an employee's quota if not handled atomically.

### Concurrency-Safe Mutation Query:
```javascript
const updatedBalance = await EmployeeLeaveBalance.findOneAndUpdate(
  {
    employee: employeeId,
    policy: policyId,
    year: targetYear,
    currentBalance: { $gte: daysToDeduct } // Atomic guard preventing overdraw
  },
  {
    $inc: {
      used: daysToDeduct,
      currentBalance: -daysToDeduct
    }
  },
  { new: true }
);

if (!updatedBalance) {
  throw new Error('Leave balance deduction failed due to concurrent modification or insufficient balance');
}
```
If two administrators attempt to approve overlapping requests simultaneously, MongoDB's document-level locking ensures only the transaction that satisfies `currentBalance >= days` succeeds, while the second fails cleanly with an explanatory error.

