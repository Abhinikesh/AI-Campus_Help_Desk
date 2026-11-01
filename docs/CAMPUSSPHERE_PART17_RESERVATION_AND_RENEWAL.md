# CAMPUSSPHERE AI — PART 17/24
# FAIR FIFO RESERVATION QUEUES & LOAN RENEWALS

**Phase:** Part 17 of 24  
**Module:** Physical Library Management System  
**Status:** Completed & Stabilized  

---

## 1. Loan Renewal Mechanics

Students and staff can extend active loans without physically returning the book to the desk, subject to policy restrictions.

### Renewal Constraints:
1. **Max Renewals Limit:** Rejects renewal with HTTP 400 if `loan.renewalCount >= policy.maxRenewals` (default 2).
2. **Overdue Guard:** Rejects renewal with HTTP 400 if the current timestamp is past `loan.dueDate` and `policy.allowRenewIfOverdue` is false.
3. **Reservation Conflict Guard:** Rejects renewal with HTTP 400 if one or more students have queued an active hold on the title and `policy.allowRenewIfReserved` is false.
4. **Anti-IDOR Enforcement:** Rejects renewal with HTTP 403 if a student attempts to renew another student's loan.
5. **Audited Due Date Extension:** Each approved renewal appends a detailed record into `loan.renewalHistory` recording previous due date, new extended due date, timestamp, and renewing actor.

---

## 2. Fair FIFO Reservation Queueing

When a title has 0 available shelf copies (`availableCopies === 0`), students can place a hold.

### Queue Principles:
1. **Direct Borrowing Priority:** If any copy is on the shelf (`availableCopies > 0`), reservation attempts are rejected with HTTP 400, directing the student to visit the desk immediately.
2. **Anti-Duplicate Rule:** Compound index `{ student: 1, book: 1, status: 1 }` prevents a student from holding multiple active reservations for the same book.
3. **Queue Position Calculation:** Dynamically calculates 1-based position by counting active holds for that title with earlier `requestDate` timestamps:
   $$\text{QueuePosition} = 1 + \sum [ \text{requestDate} < \text{currentRequestDate} ]$$
4. **Automatic Copy Allocation (`processNextReservation`):**
   When a copy is returned in good condition:
   - Finds top pending reservation ordered by `requestDate: 1`.
   - Transitions copy to `status: 'reserved'`.
   - Transitions reservation to `status: 'available_for_pickup'`.
   - Sets `pickupDeadline = Date.now() + reservationExpiryDays`.
   - Dispatches a high-priority notification to the student.
5. **Hold Cancellation / Expiry Reallocation:**
   - If a student cancels their hold, the copy automatically advances to the next student in the queue.
   - If the queue is empty, the copy status returns to `'available'`.

