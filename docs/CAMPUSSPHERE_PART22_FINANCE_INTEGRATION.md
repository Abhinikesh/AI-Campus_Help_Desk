# CampusSphere AI — Part 22: Finance Integration & Expenditure Synchronization

### 1. Zero Shadow Ledger Mandate

To uphold strict accounting integrity, the inventory and procurement subsystem does NOT maintain duplicate financial ledgers or unlinked balances.

All procurement financial liabilities are anchored to:
1. **Purchase Orders (`PurchaseOrder.js`)**: Encumbrances / commitments against approved department budgets.
2. **Goods Receipt Notes (`GoodsReceipt.js`)**: Invoiced liabilities verified with vendor delivery challan numbers and tax details.
3. **Asset Maintenance (`AssetMaintenance.js`)**: Operational repair expenditures.

---

### 2. Monetary Precision Matrix

| Field | Representation | Unit | Precision |
| :--- | :--- | :--- | :--- |
| `Asset.acquisitionCost` | Integer | Indian Paise | Zero decimal drift |
| `StockItem.unitPrice` | Integer | Indian Paise | Exact per-unit cost |
| `PurchaseRequest.estimatedTotalCost` | Integer | Indian Paise | Budget commitment |
| `PurchaseOrder.subtotalPaise` | Integer | Indian Paise | Pre-tax sum |
| `PurchaseOrder.taxTotalPaise` | Integer | Indian Paise | GST calculation |
| `PurchaseOrder.totalAmountPaise` | Integer | Indian Paise | Final payable amount |
| `AssetMaintenance.costPaise` | Integer | Indian Paise | Actual service cost |

By adhering to integer paise across 100% of the inventory data model, financial aggregation queries return exact sums matching general ledger auditing standards.
