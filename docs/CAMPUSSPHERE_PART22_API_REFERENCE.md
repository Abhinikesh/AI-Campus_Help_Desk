# CampusSphere AI — Part 22: REST API Reference
## Endpoint Directory & Protocol Documentation

All endpoints are mounted at `/api/inventory` (with `/api/procurement` as an operational alias) and require `Authorization: Bearer <JWT>`.

---

### 1. Metrics, Low-Stock & Export Endpoints

#### `GET /api/inventory/metrics`
- **Authorized Roles**: `admin`, `inventory_manager`, `procurement_officer`
- **Description**: Returns live aggregated counts and integer paise valuations.
- **Sample Response**:
  ```json
  {
    "success": true,
    "data": {
      "totalAssets": 12,
      "inStoreAssets": 8,
      "inUseAssets": 3,
      "underMaintenanceAssets": 1,
      "totalStockItems": 45,
      "lowStockAlerts": 2,
      "pendingPurchaseRequests": 4,
      "activePurchaseOrders": 2,
      "pendingMaintenance": 1,
      "completedMaintenanceExpenditurePaise": 120000,
      "totalAssetBookValuePaise": 6500000
    }
  }
  ```

#### `GET /api/inventory/low-stock`
- **Authorized Roles**: `admin`, `inventory_manager`, `procurement_officer`, `storekeeper`
- **Description**: Returns consumables where `currentQuantity <= reorderThreshold` along with suggested reorder batch sizes and estimated restocking costs.

#### `GET /api/inventory/export/assets` & `GET /api/inventory/export/stock`
- **Authorized Roles**: `admin`, `inventory_manager`, `procurement_officer`
- **Description**: Streams a sanitized CSV file with formula-injection defenses (CWE-1236).

---

### 2. Categories & Locations

#### `GET /api/inventory/categories` | `POST /api/inventory/categories`
- **POST Roles**: `admin`, `inventory_manager`
- **Payload**: `{ name, code, classification: 'asset' | 'consumable', description }`

#### `GET /api/inventory/locations` | `POST /api/inventory/locations`
- **POST Roles**: `admin`, `inventory_manager`, `storekeeper`
- **Payload**: `{ name, code, type, building, roomNumber, department, custodian }`

---

### 3. Capital Asset Endpoints

#### `GET /api/inventory/assets` | `POST /api/inventory/assets`
- **POST Roles**: `admin`, `inventory_manager`, `storekeeper`
- **Payload**: `{ name, category, serialNumber, modelNumber, manufacturer, acquisitionCost (paise), salvageValuePaise, usefulLifeYears, purchaseDate, warrantyExpiry, location }`

#### `GET /api/inventory/assets/:id`
- **Description**: Returns complete asset history including straight-line depreciation, allocations, transfers, and maintenance logs.

#### `GET /api/inventory/assets/my`
- **Authorized Roles**: `faculty`, `admin`, `inventory_manager`
- **Description**: Returns assets assigned to the authenticated user.

#### `POST /api/inventory/assets/:id/allocate`
- **Payload**: `{ assignedTo, purpose, expectedReturnDate, department, accessories }`

#### `POST /api/inventory/assets/:id/return`
- **Payload**: `{ returnedCondition, notes, returnLocation }`

#### `POST /api/inventory/assets/:id/transfer`
- **Payload**: `{ toLocation, toDepartment, reason }`

---

### 4. Consumable Stock & Ledger Endpoints

#### `GET /api/inventory/stock` | `POST /api/inventory/stock`
- **Payload**: `{ sku, name, category, unit, initialQuantity, reorderThreshold, unitCostRupees, location }`

#### `POST /api/inventory/stock/:id/issue`
- **Payload**: `{ quantity, reason, issuedTo }`

#### `POST /api/inventory/stock/:id/adjust`
- **Payload**: `{ countedQuantity, reason }`

#### `GET /api/inventory/stock/movements`
- **Query Params**: `stockItemId`, `type`, `limit`

---

### 5. Procurement: Requisitions & Purchase Orders

#### `GET /api/inventory/requests` | `POST /api/inventory/requests`
- **POST Roles**: `faculty`, `admin`, `inventory_manager`, `procurement_officer`
- **Payload**: `{ title, department, priority, justification, items: [{ itemName, category, quantity, estimatedUnitCostPaise }] }`

#### `POST /api/inventory/requests/:id/approve`
- **Roles**: `admin`, `procurement_officer`, `inventory_manager`
- **Constraint**: Requester cannot approve their own PR (`403 Forbidden`).

#### `POST /api/inventory/requests/:id/reject`
- **Payload**: `{ reason }` (Mandatory)

#### `GET /api/inventory/orders` | `POST /api/inventory/orders`
- **Payload**: `{ vendor, purchaseRequest, items, expectedDeliveryDate, termsAndConditions }`

#### `POST /api/inventory/receipts` (GRN)
- **Payload**: `{ purchaseOrder, destinationLocation, invoiceNumber, deliveryChallanNumber, items, inspectionNotes }`

---

### 6. Maintenance & Stocktaking Audits

#### `GET /api/inventory/maintenance` | `POST /api/inventory/maintenance`
- **Payload**: `{ asset, type, title, priority, scheduledDate }`

#### `PATCH /api/inventory/maintenance/:id/status`
- **Payload**: `{ status: 'completed', costPaise, restoredCondition, resolutionNotes }`

#### `POST /api/inventory/audits` | `POST /api/inventory/audits/:auditId/items/:itemId/count` | `POST /api/inventory/audits/:id/reconcile`
- **Description**: Full physical stocktaking workflow and automated ledger reconciliation.
