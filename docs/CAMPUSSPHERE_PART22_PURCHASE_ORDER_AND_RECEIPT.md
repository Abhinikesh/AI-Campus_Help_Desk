# CampusSphere AI — Part 22: Purchase Orders & Goods Receipt (GRN)

### 1. Purchase Order Formulation

Approved Purchase Requisitions are transformed into formal legal contracts (`PurchaseOrder.js`) issued to verified suppliers (`Vendor.js`).

#### Financial Precision:
$$\text{Line Subtotal (Paise)} = \text{Quantity} \times \text{UnitPricePaise}$$
$$\text{Line Tax (Paise)} = \text{round}\left(\frac{\text{Line Subtotal} \times \text{TaxPercent}}{100}\right)$$
$$\text{Line Total (Paise)} = \text{Line Subtotal} + \text{Line Tax}$$
$$\text{PO Total Amount (Paise)} = \sum \text{Line Total (Paise)}$$

---

### 2. Goods Receipt Note (GRN) & Quality Inspection

Upon delivery by the supplier, the shipment is received and inspected at a registered `InventoryLocation` (`store` or `warehouse`).

#### 2.1 Inspection Scenarios
1. **Full Acceptance**: Ordered quantity equals received and accepted quantity.
2. **Partial Acceptance & Rejection**: Items damaged in transit or failing technical specifications are rejected with a documented reason (`rejectionReason`).
3. **Partial Receipt**: Supplier fulfills the order across multiple consignments; PO transitions to `'partially_received'`.

#### 2.2 Automated Entity Generation
- For line items with `itemType === 'asset'`: The fulfillment engine creates individual `Asset` records for each accepted unit, assigning sequential `AssetId`s and linking provided serial numbers.
- For line items with `itemType === 'consumable'`: The fulfillment engine atomically increments `StockItem.currentQuantity` and logs a `purchase_receipt` `StockMovement`.
- When all PO line items are fully accepted, the PO status transitions automatically to `'fulfilled'`.

