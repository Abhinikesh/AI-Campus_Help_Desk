# CAMPUSSPHERE AI — PART 17/24
# LIBRARY MANAGEMENT REST API REFERENCE

**Phase:** Part 17 of 24  
**Base URL:** `/api/library`  
**Authentication:** Bearer JWT Header (`Authorization: Bearer <token>`) or HttpOnly Session Cookie  

---

## 1. Catalog & Physical Copies

### `POST /api/library/books`
- **Access:** Admin, Librarian
- **Description:** Adds a new bibliographic title to the catalog.
- **Request Body:**
  ```json
  {
    "title": "Introduction to Algorithms",
    "subtitle": "Fourth Edition",
    "isbn": "978-0262046305",
    "authors": ["Thomas H. Cormen", "Charles E. Leiserson"],
    "publisher": "MIT Press",
    "publicationYear": 2022,
    "category": "Computer Science",
    "subject": "Algorithms",
    "shelfNumber": "CS-01",
    "rackNumber": "RACK-A"
  }
  ```
- **Response:** `201 Created`

### `GET /api/library/books`
- **Access:** All Authenticated Users
- **Query Params:** `search`, `category`, `availableOnly`, `page`, `limit`
- **Response:** `200 OK` with list of titles and copy availability counts.

### `POST /api/library/copies`
- **Access:** Admin, Librarian
- **Description:** Accessions a physical copy with unique accession number.
- **Request Body:**
  ```json
  {
    "bookId": "6543210987abcdef",
    "accessionNumber": "ACC-CS-0042",
    "barcode": "BAR-CS-0042",
    "priceInPaise": 450000,
    "shelfLocation": "CS-01-RACK-A",
    "condition": "new"
  }
  ```
- **Response:** `201 Created`

---

## 2. Circulation Desk Operations

### `POST /api/library/loans/issue`
- **Access:** Admin, Librarian
- **Description:** Issues a copy to a student.
- **Request Body:**
  ```json
  {
    "copyId": "6543210987abcdef",
    "studentId": "6543210987fedcba",
    "remarks": "Semester project borrow"
  }
  ```
- **Response:** `201 Created`

### `POST /api/library/loans/:id/return`
- **Access:** Admin, Librarian
- **Description:** Checks in a borrowed book, assesses damage/overdue penalties, and processes FIFO reservation queue.
- **Request Body:**
  ```json
  {
    "condition": "good",
    "damageFeeInPaise": 0,
    "remarks": "Returned in good order"
  }
  ```
- **Response:** `200 OK`

### `POST /api/library/loans/:id/renew`
- **Access:** Student (Own Loans Only), Admin, Librarian
- **Description:** Renews an active loan and extends due date.
- **Response:** `200 OK`

---

## 3. Reservations & Holds

### `POST /api/library/reservations`
- **Access:** Student, Admin, Librarian
- **Description:** Places a reservation on a title with 0 available copies.
- **Request Body:** `{ "bookId": "6543210987abcdef" }`
- **Response:** `201 Created` with reservation details and queue position `#N`.

### `PATCH /api/library/reservations/:id/cancel`
- **Access:** Student (Own Reservations Only), Admin, Librarian
- **Description:** Cancels hold and reallocates held physical copy to next student in FIFO queue.
- **Response:** `200 OK`

---

## 4. Fine Ledger & Policy

### `PATCH /api/library/fines/:id/waive`
- **Access:** Admin, Librarian
- **Request Body:** `{ "waiverReason": "Detailed reason with min 5 characters" }`
- **Response:** `200 OK`

### `PATCH /api/library/fines/:id/pay`
- **Access:** Admin, Librarian
- **Request Body:** `{ "paymentMode": "cash", "paymentReference": "REC-1234" }`
- **Response:** `200 OK`

### `GET /api/library/policy` & `PATCH /api/library/policy`
- **Access:** Admin (Update), All (Read)
- **Description:** Retrieves and updates institutional circulation rules.
- **Response:** `200 OK`

### `GET /api/library/reports/export`
- **Access:** Admin, Librarian
- **Query Params:** `reportType=inventory|circulation|fines`
- **Response:** `200 OK` (`Content-Type: text/csv`) with CWE-1236 formula sanitization.

