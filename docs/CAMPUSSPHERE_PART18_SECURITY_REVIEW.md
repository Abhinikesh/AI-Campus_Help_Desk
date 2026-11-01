# CampusSphere AI — Part 18: Security & Authorization Review

## 1. Threat Modeling & Vulnerability Defenses

| Threat Vector | Severity | Vulnerability Description | CampusSphere Part 18 Mitigation |
| :--- | :--- | :--- | :--- |
| **IDOR in Applications & Allocations** | **High** | Malicious student requests another student's application or room allocation details | Constrained to `req.user.userId -> Student._id` in controllers. Any attempt to query outside student identity returns strictly the logged-in student's records or `404/403`. |
| **Warden Privilege Escalation** | **High** | Warden of Hostel A attempts to allocate beds, review applications, or inspect complaints for Hostel B | `hostelService.assertWardenAuthorization()` verifies that the warden's user ID exists in `hostel.wardens`. Rejects with `403 Forbidden` if unauthorized. |
| **Race Conditions in Bed Allocation** | **Critical** | Concurrent allocation attempts for the same bed by two wardens | Atomic MongoDB state lock: `HostelBed.findOneAndUpdate({ _id: bedId, status: 'available' }, { status: 'allocated' })`. Only one transaction succeeds; concurrent attempts receive `HTTP 409 Conflict`. |
| **Overlapping Room Allocations** | **Medium** | Student attempting to reserve multiple rooms across campuses | Controller queries active allocations (`allocated`, `active`) for the student before initiating assignment, rejecting duplicates with `HTTP 400`. |
| **CWE-1236 CSV Formula Injection** | **Medium** | Student inserts `=cmd|' /C calc'!A0` in application notes or name, executing malicious code when exported to MS Excel | `hostelService.sanitizeCsvValue()` tests for leading formula symbols (`=`, `+`, `-`, `@`, `\t`, `\r`) and prefixes with single apostrophe `'`, wrapping in quotes. |
| **Gender Integrity Violation** | **High** | Accidental or malicious assignment of male students to female hostels or vice versa | Mandatory gender check against `hostel.genderEligibility` unless `policy.allowCrossGenderAllocation` is explicitly enabled. |
| **Unauthorized Master Configuration** | **High** | Warden or faculty attempting to alter institutional policy or delete hostel buildings | Routes `POST /hostels`, `PATCH /policy`, and `DELETE /hostels/:id` restricted strictly to `allowRoles('admin')`. |

