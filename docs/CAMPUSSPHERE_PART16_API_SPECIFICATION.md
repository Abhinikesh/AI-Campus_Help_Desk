# CAMPUSSPHERE AI — PART 16/24
# FINANCIAL & FEE MANAGEMENT REST API SPECIFICATION

All endpoints are mounted at `/api/fees` and require authentication (`authMiddleware`).

---

## 1. Fee Structure Templates (Admin Only)

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `POST` | `/api/fees/structures` | `admin` | Create a new academic cohort fee structure |
| `GET` | `/api/fees/structures` | `admin`, `faculty` | List fee structures with query filters |
| `GET` | `/api/fees/structures/:id` | `admin`, `faculty` | Retrieve single structure by ID |
| `PUT` | `/api/fees/structures/:id` | `admin` | Update structure name, components, late fee policy |
| `DELETE` | `/api/fees/structures/:id` | `admin` | Archive fee structure |

---

## 2. Invoices & Cohort Billing

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `POST` | `/api/fees/invoices/generate-cohort` | `admin` | Batch generate invoices for cohort with duplicate check |
| `GET` | `/api/fees/invoices` | `admin`, `student` | Query invoices (students see only their own) |
| `GET` | `/api/fees/invoices/:id` | `admin`, `student` | Get invoice breakdown with transactions and adjustments |
| `POST` | `/api/fees/invoices/:id/cancel` | `admin` | Cancel unpaid invoice |

---

## 3. Payment Transactions & Verification

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `POST` | `/api/fees/payments` | `student`, `admin` | Record offline payment reference (starts in `pending`) |
| `PATCH` | `/api/fees/payments/:id/verify` | `admin` | Verify or reject payment reference |
| `GET` | `/api/fees/payments` | `student`, `admin` | List payments with status filter |
| `GET` | `/api/fees/payments/:id/receipt` | `student`, `admin` | Get printable official payment receipt |

---

## 4. Adjustments, Concessions & Refunds

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `POST` | `/api/fees/adjustments` | `student`, `admin` | Request or register concession / scholarship |
| `PATCH` | `/api/fees/adjustments/:id/approve` | `admin` | Approve concession and reduce invoice balance |
| `PATCH` | `/api/fees/adjustments/:id/reject` | `admin` | Reject concession with reason |
| `POST` | `/api/fees/adjustments/refund` | `admin` | Process audited fee refund |
| `GET` | `/api/fees/adjustments` | `student`, `admin` | Query adjustments ledger |

---

## 5. Student Portal Dedicated Endpoints

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/fees/student/overview` | `student` | Complete financial metrics, active invoices, balance |
| `GET` | `/api/fees/student/receipts` | `student` | List all verified official receipts |

---

## 6. Admin Analytics & Reporting

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/fees/admin/metrics` | `admin` | Institutional financial aggregates and collection metrics |
| `GET` | `/api/fees/admin/export-csv` | `admin` | Download sanitized CSV audit report |

