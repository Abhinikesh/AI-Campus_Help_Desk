# CAMPUSSPHERE AI — PART 17/24
# LIBRARY ARCHITECTURE & SYSTEM OVERVIEW

**Phase:** Part 17 of 24  
**Module:** Physical Library Management System  
**Status:** Completed & Stabilized  

---

## 1. System Mission & Architectural Scope

The CampusSphere AI Library Management System manages physical book inventory, circulation desk operations, student loan quotas, fair reservation queues, and institutional fine accounting.

### Critical System Boundary: Physical Library vs Academic Drive
- **Academic Drive (`/client/src/pages/Drive/`, `server/models/File.js`):** Stores digital PDF syllabus copies, lecture notes, lab manuals, and student course materials.
- **Physical Library Module (`/client/src/pages/StudentLibrary/`, `/client/src/pages/AdminLibrary/`, `server/models/Book.js`, `server/models/BookCopy.js`):** Tracks tangible physical books, shelf/rack coordinates, unique copy accession numbers, physical loans, renewals, returns, reservations, condition evaluations, and overdue/damage fines.

---

## 2. High-Level System Architecture

```mermaid
graph TD
    ClientUI["React 19 Frontend<br>(Student & Admin Dashboards)"] -->|Axios REST API| ExpressRouter["Express API Gateway<br>/api/library"]
    
    subgraph Security & Access Control
        ExpressRouter --> AuthMiddleware["JWT Auth Middleware<br>(authenticateToken)"]
        AuthMiddleware --> RoleMiddleware["Role Scoping<br>(requireRole / requireAdminOrLibrarian)"]
        RoleMiddleware --> AntiIDOR["Anti-IDOR Verification<br>(resolveCurrentStudent)"]
    end

    subgraph Controller & Business Logic
        AntiIDOR --> LibController["Library Controller<br>(22 Actions)"]
        LibController --> LibService["Library Domain Service<br>(Integer Math, FIFO, Auto-Assign)"]
        LibController --> NotifService["Central Notification Service<br>(Category: 'library')"]
    end

    subgraph Data Persistence (MongoDB)
        LibService --> Book["Book<br>(Bibliographic Metadata)"]
        LibService --> BookCopy["BookCopy<br>(Accession & Shelf Location)"]
        LibService --> LibraryLoan["LibraryLoan<br>(Active/Returned Loans)"]
        LibService --> BookReservation["BookReservation<br>(FIFO Queue)"]
        LibService --> LibraryFine["LibraryFine<br>(Integer Paise Ledger)"]
        LibService --> LibraryPolicy["LibraryPolicy<br>(Quota & Rates)"]
        LibService --> LibraryAuditLog["LibraryAuditLog<br>(Immutable Ledger)"]
    end
```

---

## 3. Core Architectural Subsystems

### 3.1 Bibliographic Catalog vs Physical Copies
A clean separation of concerns divides book catalog entries from individual physical units:
- **`Book`:** Contains title, subtitle, authors, publisher, ISBN, publication year, category, subject, and physical shelf/rack location. Aggregates live copy counts: `totalCopies`, `availableCopies`, and `issuedCopies`.
- **`BookCopy`:** Represents a specific tangible book sitting on a shelf. Possesses a globally unique `accessionNumber`, barcode, condition (`new`, `good`, `fair`, `damaged`, `lost`), acquisition cost in paise, and individual status (`available`, `issued`, `reserved`, `maintenance`, `lost`, `damaged`).

### 3.2 Circulation Desk (Issue, Return, Renewal)
- **Issue:** Validates student loan quota (`activeLoanCount < maxBooksPerStudent`), prevents duplicate borrowing of the same title, atomically reserves the copy (`status: 'issued'`), attaches a frozen snapshot of institutional policy to the loan, and updates book counts.
- **Return:** Inspects returned physical condition. If returned in good condition and pending reservations exist, automatically triggers fair FIFO reservation allocation. If returned damaged or lost, marks copy accordingly, assesses a penalty fine, and keeps the copy out of circulation.
- **Renewal:** Permits up to `maxRenewals` extensions, provided the loan is not overdue (unless policy explicitly permits) and no other student has placed a hold reservation on the title.

### 3.3 Fair FIFO Reservation Queue
- When all copies of a book title are issued (`availableCopies === 0`), students can queue a reservation.
- Multiple reservations form a strict First-In-First-Out (FIFO) queue ordered by `requestDate`.
- Upon copy return, `processNextReservation` claims the copy (`status: 'reserved'`), marks the top reservation as `'available_for_pickup'`, and sets a pickup deadline.
- If a student cancels their hold, the copy automatically advances to the next student in queue or returns to open shelf availability if the queue is exhausted.

### 3.4 Decimal-Safe Integer Fine Accounting
- Zero floating-point rounding errors: all fines, damage assessments, and book prices are handled strictly as integer paise ($1\text{ INR} = 100\text{ paise}$).
- Policy specifies grace periods and daily fine rates.
- Administrators can waive fines with mandatory justification, recording full audit logs.
- Cash payments at the circulation counter record explicit payment references, timestamps, and payment modes.

---

## 4. Architectural Invariants & Guarantees

1. **Zero Double-Issuing:** A physical copy in status `'issued'` can never be issued to another student.
2. **Deterministic Queue Ordering:** Reservations are strictly processed by timestamp; queue positions are dynamically calculated based on prior pending holds.
3. **Historical Policy Immutability:** Loans store a snapshot of institutional rules at the moment of borrowing, ensuring subsequent administrative rule revisions do not alter existing obligations.
4. **CWE-1236 Formula Injection Defense:** All exported CSV fields are checked for dangerous leading formula characters (`=`, `+`, `-`, `@`, `\t`, `\r`) and prepended with a single quotation mark.

