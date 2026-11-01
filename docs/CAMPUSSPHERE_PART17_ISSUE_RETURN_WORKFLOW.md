# CAMPUSSPHERE AI — PART 17/24
# CIRCULATION DESK: ISSUE & RETURN WORKFLOW

**Phase:** Part 17 of 24  
**Module:** Physical Library Management System  
**Status:** Completed & Stabilized  

---

## 1. Issue Workflow (Check-Out)

When an authorized student presents their physical college ID card and a book at the circulation counter, the desk staff follows this workflow:

```mermaid
sequenceDiagram
    autonumber
    actor Staff as Desk Staff (Admin/Librarian)
    participant UI as Circulation Desk (/admin/library)
    participant API as /api/library/loans/issue
    participant DB as MongoDB (BookCopy, Student, Loan)
    participant Notif as Notification Service

    Staff->>UI: Enter Student Roll/Enrollment & Scan Copy Barcode
    UI->>API: POST /api/library/loans/issue { studentId, copyId }
    API->>DB: Check student exists and active
    API->>DB: Count active loans: count < policy.maxBooksPerStudent?
    API->>DB: Check if student already has active loan of this title
    API->>DB: Check copy status == 'available' (or 'reserved' for this student)
    API->>DB: Create LibraryLoan record with frozen policySnapshot
    API->>DB: Update BookCopy status to 'issued' and set currentLoan
    API->>DB: Recalculate Book total/available/issued copy counts
    API->>Notif: Dispatch 'library' notification to student with due date
    API-->>UI: Return 201 Created with loan details
    UI-->>Staff: Display confirmation with due date badge
```

### Pre-Condition Checks:
1. **Loan Quota Limits:** Rejects issue with HTTP 400 if active loans equal or exceed `policy.maxBooksPerStudent` (default 3).
2. **Duplicate Title Restriction:** Rejects issue with HTTP 400 if student already possesses an unreturned copy of the same title.
3. **Availability State:** Rejects issue with HTTP 400 if physical copy is not `'available'` or `'reserved'` for this student.
4. **Policy Freeze:** A complete snapshot of circulation policy rules (`loanDurationDays`, `finePerOverdueDayInPaise`, `gracePeriodDays`, `maxFinePerBookInPaise`) is attached to `loan.policySnapshot`.

---

## 2. Return Workflow (Check-In)

When a book is brought back to the circulation desk:

```mermaid
sequenceDiagram
    autonumber
    actor Staff as Desk Staff
    participant UI as Circulation Desk
    participant API as /api/library/loans/:id/return
    participant Service as LibraryService
    participant DB as MongoDB
    participant Notif as Notification Service

    Staff->>UI: Scan Book Accession / Select Active Loan
    Staff->>UI: Inspect condition (good / fair / damaged / lost)
    UI->>API: POST /api/library/loans/:id/return { condition, damagePenaltyInPaise }
    API->>DB: Find loan, verify status is 'active'
    API->>Service: calculateOverdueFine(loan, actualReturnDate)
    opt Overdue Days > Grace Period
        API->>DB: Create LibraryFine record (fineType: 'overdue')
    end
    opt Condition == 'damaged' or 'lost'
        API->>DB: Mark BookCopy as 'damaged' or 'lost' (NOT available)
        API->>DB: Create LibraryFine record (fineType: 'damaged_book' or 'lost_book')
    end
    opt Condition in ['new', 'good', 'fair']
        API->>Service: processNextReservation(bookId, copy)
        alt Next Reservation Found in Queue
            Service->>DB: Mark copy as 'reserved'
            Service->>DB: Update reservation status to 'available_for_pickup' with deadline
            Service->>Notif: Send alert to holding student
        else Queue Empty
            Service->>DB: Mark copy as 'available' on shelf
        end
    end
    API->>DB: Update loan status to 'returned' with actualReturnDate
    API->>DB: Sync book counts
    API->>Notif: Send check-in receipt notification to returning student
    API-->>UI: Return 200 OK with summary
```

### Return Condition Rules:
- **Good / Fair:** Returns to general shelf stock or fulfills the next queued reservation.
- **Damaged:** Copy is immediately isolated from circulation (`status: 'damaged'`). An administrative assessment fine (`fineType: 'damaged_book'`) is created in the fine ledger.
- **Lost:** Copy is marked `status: 'lost'`. A replacement cost penalty (`fineType: 'lost_book'`), computed using `policy.defaultLostPenaltyMultiplier` (default $1.5\times$), is assessed.

