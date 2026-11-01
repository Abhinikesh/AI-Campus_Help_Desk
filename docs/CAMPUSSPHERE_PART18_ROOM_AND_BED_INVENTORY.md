# CampusSphere AI — Part 18: Room & Bed Inventory Management

## 1. Inventory Hierarchy & Capacity Guarantees

CampusSphere AI enforces physical capacity guarantees at every layer of the residential inventory hierarchy:

```
[Hostel Residential Complex]
   │
   ├── [HostelRoom: Room 101, Floor 1, Capacity 2]
   │      ├── Bed 101-A (bedId: TBH-1-101-A, status: available)
   │      └── Bed 101-B (bedId: TBH-1-101-B, status: allocated)
   │
   └── [HostelRoom: Room 102, Floor 1, Capacity 1]
          └── Bed 102-A (bedId: TBH-1-102-A, status: occupied)
```

---

## 2. Capacity Invariants & Validation Logic

### 2.1 Room Capacity Guardrails
When creating beds via `POST /api/hostel/beds`:
1. `HostelBed.countDocuments({ room: room._id, status: { $ne: 'inactive' } })` computes active beds.
2. If `activeBeds >= room.capacity`, creation is rejected with `HTTP 400 Bad Request`:
   `Cannot add bed: Room 101 has reached its configured capacity limit of 2 beds`.
3. Ensures no room is accidentally over-provisioned with physical beds beyond its structural blueprint.

### 2.2 Unique Bed Identification
1. Bed numbers within the same room must be unique (enforced by Mongoose compound index `{ room: 1, bedNumber: 1 }`).
2. Global `bedId` is automatically constructed if omitted:
   `${hostel.code}-${room.roomNumber}-${bedSuffix}` (e.g., `TBH-1-101-A`).
3. Unique index `{ bedId: 1 }` guarantees unambiguous asset tagging across the entire ERP.

### 2.3 Rollup Capacity Synchronization
Whenever rooms or beds are created, allocated, checked-in, checked-out, or transferred, `hostelService.syncRoomCapacity()` and `hostelService.syncHostelCapacity()` execute atomic recalculations:

- **Room Rollup:**
  - `totalBeds = count(status != 'inactive')`
  - `occupiedBeds = count(status in ['allocated', 'occupied'])`
  - `availableBeds = count(status == 'available')`
  - If `occupiedBeds >= capacity`, `room.status` transitions automatically to `'full'`. Otherwise, it reverts to `'available'`.

- **Hostel Rollup:**
  - Total active rooms, total beds, available beds, and occupied beds are rolled up onto the parent `Hostel` document in real time.
  - Zero out-of-sync counts or stale cache inconsistencies.

