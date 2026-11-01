# CampusSphere AI — Part 18: Circulation, Check-In, Check-Out & Transfers

## 1. Physical Check-In Workflow

Check-in tracks the operational handoff of physical assets when the student arrives on campus (`POST /api/hostel/allocations/:id/check-in`):
- **Pre-Conditions:** Allocation must be in `'allocated'` status. Duplicate check-ins are rejected with `HTTP 400`.
- **Handoff Tracking:** Records number of keys issued (`keysIssued`), inventory condition notes, and authorized staff member ID.
- **State Updates:**
  - Creates permanent `HostelOccupancy` record (`status: 'checked_in'`).
  - Allocation status advances to `'active'`.
  - Bed status transitions from `'allocated'` to `'occupied'`.
  - Recalculates room and hostel occupied bed counts.
  - Sends high-priority check-in welcome notification to student.

---

## 2. Room Transfer Protocol

Students with active accommodation can request room transfers (`POST /api/hostel/transfers`):
1. **Submission:** Reason must be detailed (min 5 characters). Only 1 pending transfer allowed per student.
2. **Review & Atomic Bed Swap (`PATCH /api/hostel/transfers/:id/review`):**
   - Atomically claims new target bed: `HostelBed.findOneAndUpdate({ _id: newBedId, status: 'available' }, { status: 'allocated' })`.
   - Archives current allocation: `oldAllocation.status = 'transferred'`.
   - Atomically releases old bed back to `'available'`: `HostelBed.findByIdAndUpdate(oldBedId, { status: 'available', currentStudent: null, currentAllocation: null })`.
   - Creates new `HostelAllocation` document for target room.
   - Synchronizes capacities across both old and new rooms and hostels.
   - Historical records are preserved for auditing and longitudinal reporting.

---

## 3. Physical Check-Out Workflow

When a student departs at the end of the academic year or program (`POST /api/hostel/allocations/:id/check-out`):
- **Clearance Verification:** Staff inspects room condition, verifies keys returned, and assesses any property damages (`damageAssessmentInPaise`) or outstanding dues (`outstandingDuesInPaise`).
- **Clearance Status:** `'cleared'`, `'conditional'`, or `'withheld'`.
- **Bed Release:**
  - Bed is atomically reset to `status: 'available'`, `currentStudent: null`, `currentAllocation: null`.
  - Allocation marked `'checked_out'`.
  - `HostelOccupancy` updated with check-out timestamp, staff ID, and clearance notes.
  - Room and hostel capacities are atomically decremented.

