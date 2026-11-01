# CampusSphere AI — Part 22: Stock Movement Ledger & Consumables Management

### 1. The Immutable Ledger Paradigm

In CampusSphere AI, consumable stock balances are never updated in an un-audited manner. Every increment or decrement must be accompanied by an immutable ledger entry in `StockMovement.js`.

#### 1.1 Atomic Non-Negative Invariant
To prevent race conditions, stock decrements use atomic MongoDB conditional updates:
```javascript
const updateQuery = {
  _id: stockItemId,
  currentQuantity: { $gte: movementQty }
};
const updateDoc = {
  $inc: { currentQuantity: -movementQty },
  $set: { updatedAt: new Date() }
};
const result = await StockItem.updateOne(updateQuery, updateDoc);
if (result.modifiedCount === 0) {
  throw new Error('Insufficient stock balance or concurrent modification detected');
}
```

---

### 2. Transaction Classification

| Movement Type | Direction | Description | Reference Model |
| :--- | :--- | :--- | :--- |
| `opening_balance` | In (+) | Initial balance recorded during SKU cataloging | `StockItem` |
| `purchase_receipt`| In (+) | Inbound shipment received against approved Purchase Order | `GoodsReceipt`, `PurchaseOrder` |
| `issue` | Out (-) | Dispatched to academic department, lab, or faculty | `User`, `Department` |
| `return` | In (+) | Unused supplies returned from department back to store | `User`, `Department` |
| `adjustment` | In/Out (±) | Physical inventory stocktaking audit reconciliation | `InventoryAudit` |
| `damaged` | Out (-) | Damaged in warehouse or expired chemical disposal | `InventoryAudit` |
| `write_off` | Out (-) | Condemned or discarded consumable stock | `InventoryAudit` |

---

### 3. Automated Low-Stock Alerting & Reorder Intelligence

The system continuously scans consumables against their defined reorder thresholds:
$$\text{Is Low Stock} = (\text{CurrentQuantity} \le \text{ReorderThreshold})$$
$$\text{Deficit} = \max(0, \text{ReorderThreshold} - \text{CurrentQuantity})$$
$$\text{Suggested Reorder Quantity} = \max(\text{ReorderQuantity}, \text{Deficit} + 10)$$
$$\text{Estimated Restocking Cost (Paise)} = \text{Suggested Reorder Quantity} \times \text{UnitPrice}$$

When breached, asynchronous notifications are dispatched to storekeepers and inventory managers, and reorder suggestions appear on the dashboard.
