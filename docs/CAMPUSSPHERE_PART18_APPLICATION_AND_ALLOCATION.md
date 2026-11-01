# CampusSphere AI — Part 18: Application & Allocation Engine

## 1. Student Application Lifecycle

### 1.1 Submission Guardrails
- **Eligibility Pre-Check:** Validates gender eligibility against selected hostels (`hostelService.checkStudentHostelEligibility`).
- **Policy Window Verification:** Rejects applications if `policy.applicationWindowOpen === false`.
- **Duplicate Prevention:** Checks for existing active applications (`submitted`, `under_review`, `approved`, `waitlisted`, `allocated`) for the current academic year. Duplicate submissions are rejected with `HTTP 409 Conflict`.
- **Anti-IDOR:** Students querying `/api/hostel/applications` are strictly constrained to their own applications through `filter.student = currentStudent._id`.

### 1.2 Administrative Review
Wardens and administrators can review applications (`PATCH /api/hostel/applications/:id/review`):
- **Decision: `approved`:** Unlocks allocation workflow for this student. Dispatches `Notification` with category `'hostel'`.
- **Decision: `rejected`:** Requires mandatory rejection reason with minimum 5 characters. Dispatches clear explanation to student.
- **Decision: `waitlisted`:** Optional waitlist sequence number.

---

## 2. Bed Allocation Engine

### 2.1 Concurrency Safety & Double-Booking Prevention
Allocating a bed (`POST /api/hostel/allocations`) requires:
1. Verifying student exists and is eligible for the designated hostel.
2. Checking student does not already hold an active allocation (`status in ['allocated', 'active']`). Overlapping allocations are rejected with `HTTP 400`.
3. Executing an atomic state transition:
   ```javascript
   const bed = await HostelBed.findOneAndUpdate(
     { _id: bedId, room: roomId, hostel: hostel._id, status: 'available' },
     { $set: { status: 'allocated', currentStudent: student._id } },
     { new: true }
   );
   ```
4. If two wardens attempt to allocate the exact same bed at the exact same millisecond, exactly one query claims the bed while the second query returns `null` and is rejected with `HTTP 409 Conflict: Bed is no longer available`.

### 2.2 Scoped Warden Authorization
Before modifying any hostel resources, wardens must pass `hostelService.assertWardenAuthorization(user, hostel)`. If the warden's `userId` is not present in `hostel.wardens`, the request is intercepted and rejected with `HTTP 403 Forbidden: You are not authorized to administer this hostel`.

