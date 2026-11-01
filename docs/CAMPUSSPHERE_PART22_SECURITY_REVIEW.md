# CampusSphere AI — Part 22: Security Review & Compliance Audit

### 1. Role-Based Access Control (RBAC) Enforcement

The inventory subsystem introduces three specialized institutional roles in addition to `admin` and `faculty`:
- `inventory_manager`: Comprehensive authority over categories, locations, assets, stock adjustments, audits, and maintenance.
- `procurement_officer`: Management of vendors, purchase requisitions, approvals, and purchase orders.
- `storekeeper`: Day-to-day warehouse operations, goods receipting, physical audits, and stock issuance.
- `faculty`: Requisition creation, assigned asset custody review, and breakdown reporting.
- `student`: **Strictly blocked (`403 Forbidden`)** from all inventory endpoints.

---

### 2. Threat Analysis & Mitigations

#### 2.1 CWE-1236: CSV Formula Injection Mitigation
When administrators export asset inventories or consumable stock registers to CSV, malicious users could inject spreadsheet formulas into fields like `serialNumber`, `name`, or `description` (e.g. `=cmd|' /C calc'!A0` or `@SUM(...)`).

**Mitigation**:
All exported values pass through `inventoryService.sanitizeCsvValue()`:
```javascript
sanitizeCsvValue(val) {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`; // Prepends single quote to neutralize formula evaluation
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
```

#### 2.2 Insecure Direct Object Reference (IDOR) & Custody Snooping
- Faculty can only query assets where `assignedTo === req.user._id` via `GET /api/inventory/assets/my`.
- Purchase requisitions queried by faculty are restricted to `requestingEmployee === req.user._id`.

#### 2.3 Vendor Confidentiality Protection
Vendor profit margins and supplier negotiation notes (`internalRemarks`) are protected with Mongoose `{ select: false }`. Non-procurement users (faculty, storekeepers) never receive these confidential remarks in response payloads.
