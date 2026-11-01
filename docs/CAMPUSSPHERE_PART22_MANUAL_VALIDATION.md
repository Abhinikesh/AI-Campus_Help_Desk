# CampusSphere AI — Part 22: Manual Validation Guide

### 1. Preparation & Environment Verification

1. Start all required background services:
   - Node.js backend: `cd server && node server.js` (`http://localhost:5001`)
   - Python AI service: `cd ai-service && source .venv/bin/activate && python app.py` (`http://localhost:5002`)
   - Vite client frontend: `cd client && npm run dev` (`http://localhost:5173`)
2. Log in with an administrative account or role `inventory_manager` (`admin@campussphere.edu`).

---

### 2. Step-by-Step Manual Verification Scenarios

#### Scenario A: Serialized Asset Registration & Depreciation Inspection
1. Navigate to **Sidebar → Inventory Desk (`/admin/inventory`)**.
2. Verify KPI cards at the top show live database values.
3. On the **Asset Register** tab, click **Register Asset**.
4. Enter Name: `Apple MacBook Pro M3`, Category: `IT Equipment`, Serial: `MBP-2026-X1`, Cost (INR): `150000`, Useful Life: `60` months.
5. Submit form. Verify asset card appears in the table with status `in_stock`.
6. Click the **Eye icon** on the asset row. Verify the modal displays straight-line depreciation, accumulated wear, and current book value.

#### Scenario B: Asset Custody Allocation & Store Return
1. On the asset row, click **Allocate**.
2. Select a faculty member or enter purpose: `Faculty AI Lab Station`.
3. Submit. Verify status transitions to `assigned` (highlighted in emerald).
4. Log in as the allocated faculty member and navigate to **Sidebar → Assets & Supplies (`/faculty/inventory`)**.
5. Verify the laptop appears under **Assigned to Me**.
6. Switch back to admin/storekeeper and click **Return**. Enter condition `good` and remarks.
7. Verify asset status resets to `in_stock`.

#### Scenario C: Consumable Stock Management & Atomic Decrement
1. Navigate to **Consumables Stock** tab.
2. Click **Add Stock Item (SKU)**.
3. Enter SKU: `CHEM-HCL-01`, Name: `Hydrochloric Acid 1M`, Unit: `litres`, Initial Qty: `50`, Reorder Threshold: `15`, Unit Cost: `180`.
4. Click **Save SKU**. Verify balance is `50 litres`.
5. Click **Issue** on the item row. Enter quantity `10`.
6. Submit and verify balance is now `40 litres`.
7. Click **Ledger**. Verify the immutable stock movement history displays previous quantity 50 → new quantity 40.

#### Scenario D: Multi-Tier Requisition & Goods Receipt
1. As Faculty, click **New Requisition (PR)** on `/faculty/inventory`.
2. Request `2 Arduino Kits` at `₹2,500` each.
3. As Admin / Procurement Officer, navigate to `/admin/inventory` → **Procurement & Orders**.
4. Verify the PR appears under Requisitions. Approve through the workflow stages.
5. Click **Issue PO** for the approved PR.
6. Click **Process GRN** on the issued PO. Enter serial numbers `ARDU-01, ARDU-02`.
7. Accept delivery. Verify PO becomes `fulfilled` and 2 new assets appear on the Asset Register automatically.

