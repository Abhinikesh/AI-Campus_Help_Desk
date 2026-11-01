# CampusSphere AI — Part 22: Asset Allocation, Custody & Transfers

### 1. Custody & Allocation Tracking

Asset allocation delegates physical responsibility of institutional equipment to a specific employee (`assignedTo`) or department.

#### 1.1 Invariants
- An asset cannot be allocated if its status is already `'assigned'`.
- Assets under maintenance, lost, damaged, or disposed cannot be allocated.
- When allocated:
  1. Asset status transitions to `'assigned'`.
  2. `assignedTo` is recorded on the `Asset` document.
  3. An `AssetAllocation` history record is generated with issued condition and accessory checklists.

---

### 2. Return to Central Store

When custody ends (e.g. end of semester, resignation, project completion), the asset is checked back into central stores:
1. The active `AssetAllocation` document is closed with `returnedDate`, `returnedCondition`, and `returnedRemarks`.
2. The `Asset` status is reset to `'in_stock'`.
3. Custodian pointers are cleared (`assignedTo: null`).
4. Physical condition is updated based on storekeeper check-in inspection.

---

### 3. Inter-Departmental & Location Transfers

When equipment moves between campus laboratories or buildings (e.g. from Central Store to CS Lab 1):
1. An `AssetTransfer` record is logged capturing `transferNumber`, `fromLocation`, `toLocation`, `fromDepartment`, `toDepartment`, `requestedBy`, and `reason`.
2. The `currentLocation` pointer on the `Asset` document is atomically updated.
3. The historical location audit trail remains permanently queryable.

