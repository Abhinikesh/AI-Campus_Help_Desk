# CampusSphere AI — Part 22: Procurement Workflow & Approval Hierarchy

### 1. Multi-Tier Procurement Architecture

The procurement workflow orchestrates institutional purchasing with strict compliance controls, separation of duties, and audit trail generation.

```mermaid
sequenceDiagram
    autonumber
    actor Faculty as Requisitioner (Faculty/Dept)
    actor HOD as Head of Department
    actor Fin as Finance Officer
    actor Prin as Principal / Director
    actor Proc as Procurement Officer
    actor Vendor as Supplier

    Faculty->>HOD: Submit Purchase Requisition (PR)
    Note over Faculty,HOD: Separation of duties: Requester cannot self-approve
    HOD->>Fin: Approve Academic Justification (Stage 1)
    Fin->>Prin: Budget Allocation Sanction (Stage 2)
    Prin->>Proc: Final Institutional Sanction (Stage 3)
    Proc->>Vendor: Generate & Issue Purchase Order (PO)
    Vendor-->>Proc: Dispatch Goods with Invoice & Challan
    Proc->>Faculty: Receive & Inspect Shipment (GRN)
```

---

### 2. Separation of Duties Enforcement

To prevent internal fraud and unauthorized financial commitments, the authorization layer enforces a strict barrier:
```javascript
if (purchaseRequest.requestingEmployee.toString() === req.user._id.toString()) {
  return res.status(403).json({
    success: false,
    message: 'Separation of duties violation: You cannot approve your own purchase request'
  });
}
```

### 3. Rejection & Cancellation Protocol
Any reviewer in the workflow chain can reject a requisition with a mandatory written justification (`minlength: 5 chars`). The requisition transitions immediately to `'rejected'`, preventing further approvals or conversion to a Purchase Order.
