# CampusSphere AI — Part 22: Existing Inventory, Asset & Procurement Audit

## 1. Executive Summary

This pre-implementation audit inspects the current repository state of **CampusSphere AI** prior to engineering **Part 22: Campus Asset, Inventory, Procurement & Maintenance Management**.

The audit confirms the complete operational integrity of previous modules (Parts 10 through 21), evaluates existing maintenance and grievance patterns, identifies architectural reusable assets, and establishes the operational boundaries required for Part 22.

---

## 2. Upstream Verification & Previous Part Status

All prior ERP phases were audited and verified using automated test suites targeting the isolated MongoDB database (`campus-erp-test-isolated`):

| Subsystem / Phase | Test Suite | Tests Run | Result | Notes |
|---|---|:---:|:---:|---|
| **Part 21: Campus Events & Clubs** | `server/tests/campus_events_management.test.js` | 41 | **PASS** | 0 failures, 100% pass |
| **Part 20: Placement & Career System** | `server/tests/placement_management.test.js` | 37 | **PASS** | 0 failures, 100% pass |
| **Part 19: Transport Management** | `server/tests/transport_management.test.js` | 43 | **PASS** | 0 failures, 100% pass |
| **Part 18: Hostel Management** | `server/tests/hostel_management.test.js` | 39 | **PASS** | 0 failures, 100% pass |
| **Part 17: Library Management** | `server/tests/library_management.test.js` | 36 | **PASS** | 0 failures, 100% pass |
| **Part 16: Fee & Finance Management** | `server/tests/fee_finance_management.test.js` | 38 | **PASS** | 0 failures, 100% pass |
| **Part 15: Timetable & Calendar** | `server/tests/academic_calendar_timetable.test.js` | 30 | **PASS** | 0 failures, 100% pass |
| **Part 14: Examination Management** | `server/tests/examination_management.test.js` | 28 | **PASS** | 0 failures, 100% pass |
| **Part 13: Assignment Management** | `server/tests/assignment_management.test.js` | 23 | **PASS** | 0 failures, 100% pass |
| **Part 12.1: Notification Stabilization** | `server/tests/notification_stabilization_part12_1.test.js` | 23 | **PASS** | 0 failures, 100% pass |
| **Part 10: Smart Attendance Analytics** | `server/tests/attendance_analytics_and_reporting.test.js` | 27 | **PASS** | 0 failures, 100% pass |
| **Python AI Microservice** | `ai-service/tests/` | 85 | **PASS** | 0 failures, 100% pass |
| **Client Production Build** | Vite 8 + React 19 (`npm run build`) | 1873 modules | **PASS** | 0 errors, 0 warnings |

---

## 3. Existing Inventory & Procurement Functionality Discovered

A comprehensive codebase search for `asset`, `inventory`, `procurement`, `purchase`, `vendor`, `stock`, `equipment`, and `depreciation` revealed:

1. **No Existing Generic Asset or Inventory Subsystem:**
   - The repository currently has domain-specific asset tracking in Part 17 (`BookCopy.js`), Part 18 (`HostelBed.js`), and Part 19 (`TransportVehicle.js`, `TransportMaintenance.js`).
   - There are **no generic institutional asset registers, consumable stock ledgers, vendor directories, purchase requests, purchase orders, or goods receipt models**.
   - **Finding:** A clean slate allows Part 22 to be designed with cohesive domain boundaries without legacy data migrations.

2. **Maintenance Patterns:**
   - Transport maintains `TransportMaintenance.js` for fleet vehicle garage servicing with cost in integer paise.
   - Hostel has maintenance statuses for rooms and beds.
   - **Finding:** Part 22 should introduce a centralized asset maintenance model (`AssetMaintenance.js`) for institutional equipment (computers, projectors, lab apparatus, HVAC, electronics) while keeping specialized vehicle servicing intact.

3. **Currency & Financial Precision:**
   - All financial modules (Part 16 Fee/Invoice, Part 17 Library fines, Part 18 Hostel fees, Part 19 Transport billing, Part 20 Placement CTC) strictly use **integer Indian paise (`1 INR = 100 paise`)**.
   - **Finding:** Part 22 must strictly follow this pattern for unit costs, estimated purchase totals, purchase orders, maintenance repair bills, and asset acquisition values. Floating-point currency drift is completely disallowed.

4. **Notification Engine (`server/services/notification.service.js`):**
   - Active SSE engine supporting in-app persistence and preferences.
   - **Finding:** Extend `category` enum with `'inventory'` in `Notification.js`, `NotificationPreference.js`, and `notification.service.js`.

5. **User Model & Role Architecture (`server/models/User.js`):**
   - Roles currently include: `student`, `faculty`, `admin`, `librarian`, `warden`, `transport_manager`, `driver`, `attendant`, `placement_officer`, `placement_coordinator`, `event_organizer`, `club_coordinator`.
   - **Finding:** Expand `role` enum with `'inventory_manager'`, `'procurement_officer'`, and `'storekeeper'` to provide dedicated institutional administrative views.

---

## 4. Reusable Infrastructure

| Component | File Path | Reuse Strategy in Part 22 |
|---|---|---|
| **Notification Engine** | `server/services/notification.service.js` | Real-time SSE alerts for low stock, purchase approvals, goods receipt |
| **Role-Based Access** | `server/middleware/role.middleware.js` | `allowRoles('admin', 'inventory_manager', 'procurement_officer', 'storekeeper', 'faculty')` |
| **Faculty & Department Models** | `server/models/Faculty.js`, `server/models/Student.js` | Custodian and departmental ownership mapping |
| **Complaint System** | `server/models/Complaint.js` | Infrastructure and asset grievance categorization (`category: 'asset'`) |
| **File Storage Infrastructure** | `server/services/event.service.js` pattern | Secure crypto-random disk storage for invoices, receipts, warranties |
| **Formula Sanitization** | `server/services/event.service.js` pattern | CWE-1236 spreadsheet defense across all inventory CSV export streams |

---

## 5. Missing Features to be Built in Part 22

1. **Category Management (`InventoryCategory.js`):** Configurable taxonomy for IT, lab apparatus, furniture, and consumables.
2. **Asset Register (`Asset.js`):** Individually tracked physical equipment with unique asset codes, serial numbers, warranty, condition, and location.
3. **Consumable Inventory (`StockItem.js`):** Quantity-based inventory with UOM (pieces, boxes, kg, litres), reorder thresholds, and zero-negative stock enforcement.
4. **Stock Movement Ledger (`StockMovement.js`):** Immutable ledger tracking receipts, issues, returns, transfers, adjustments, and write-offs.
5. **Location Management (`InventoryLocation.js`):** Campuses, buildings, labs, stores, and warehouses.
6. **Procurement Pipeline (`PurchaseRequest.js`, `PurchaseOrder.js`, `GoodsReceipt.js`):**
   - Purchase requests with justification and estimated costs in integer paise.
   - Multi-tier approval workflow with mandatory rejection reasons and separation of duties.
   - Purchase orders linked to approved requests.
   - Goods receipt note (GRN) with inspection, partial receipts, and automatic asset/stock generation.
7. **Vendor Directory (`Vendor.js`):** Partner database with GST/tax details, contacts, and restricted internal remarks.
8. **Asset Allocation & Transfers (`AssetAllocation.js`, `AssetTransfer.js`):** Custody tracking, handovers, returns, and cross-department transfers.
9. **Asset Maintenance (`AssetMaintenance.js`):** Preventive/breakdown maintenance, warranty checks, and integer paise repair costs.
10. **Low-Stock Alerting Engine:** Real-time stock reorder monitoring based on physical quantities.
11. **Stocktaking & Audits (`InventoryAudit.js`, `InventoryAuditItem.js`):** Physical verification sessions with discrepancy tracking and authorized compensating adjustments.
12. **Informational Depreciation:** Straight-line and written-down book value estimations clearly demarcated as informational.
13. **Modern Portals:**
    - Admin/Inventory Desk (`/admin/inventory`): Centralized asset register, stock management, procurement approvals, purchase orders, maintenance, and formula-safe CSV exports.
    - Departmental/Faculty Asset View: My assigned assets, department inventory, and maintenance requests.

---

## 6. Financial & Security Risks

1. **Negative Stock Vulnerabilities:** Concurrent stock issue requests could drive inventory below zero. Solved via atomic conditional MongoDB updates (`$inc: { currentQuantity: -qty }` conditioned on `$gte: qty`).
2. **Double-Receipt & Overselling:** Replaying a goods receipt must not inflate inventory twice. Solved via idempotency checks and ordered vs received tracking.
3. **Separation of Duties:** Requesters must not approve their own purchase requests.
4. **CWE-1236 Formula Injection:** Neutralize dangerous characters (`=, +, -, @, \t, \r`) in asset and stock CSV exports.
5. **Anti-IDOR:** Department custodians and employees only view assets within their authorized department scope.

---

## 7. Conclusion

The ERP infrastructure is stable and fully prepared for Part 22. Proceeding to Phase B & C: Shared Model Extensions & Domain Model Architecture.

