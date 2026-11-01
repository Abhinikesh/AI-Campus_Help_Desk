# CampusSphere AI — Part 18: Hostel Management API Reference

Base URL: `/api/hostel` (All endpoints require valid authentication Bearer token)

## 1. Student Portal
- `GET /student/overview` — Get logged-in student's complete accommodation summary (active allocation, room, bed, roommates, pending applications, active transfer requests, hostel complaints). Role: `student`.

## 2. Institutional Metrics & Reports
- `GET /admin/metrics` — Real-time capacity, occupancy rates, pending apps, and open complaints. Roles: `admin`, `warden`.
- `GET /reports/export?reportType=occupancy|applications` — RFC-4180 CSV export protected against CWE-1236 formula injection. Roles: `admin`, `warden`.

## 3. Policy Administration
- `GET /policy` — Get active institutional hostel policy. Roles: `admin`, `warden`, `student`.
- `PATCH /policy` — Update hostel policy (window open, default fees in paise, cross-gender rules). Role: `admin`.

## 4. Hostel Master Records
- `POST /hostels` — Create new hostel building. Role: `admin`.
- `GET /hostels` — List hostels with filters (`type`, `genderEligibility`, `status`). Roles: `admin`, `warden`, `student`, `faculty`.
- `GET /hostels/:id` — Get detailed hostel building record with wardens. Roles: `admin`, `warden`, `student`, `faculty`.
- `PATCH /hostels/:id` — Update hostel details. Role: `admin`.
- `DELETE /hostels/:id` — Archive hostel building. Role: `admin`.

## 5. Room & Bed Inventory
- `POST /rooms` — Create room in hostel (enforces capacity & duplicate roomNumber check). Roles: `admin`, `warden`.
- `GET /rooms?hostelId=:id` — List rooms. Roles: `admin`, `warden`, `student`, `faculty`.
- `POST /beds` — Add physical bed to room (enforces capacity limits & duplicate bedNumber/bedId check). Roles: `admin`, `warden`.
- `GET /beds?roomId=:id&hostelId=:id` — List beds with occupant details. Roles: `admin`, `warden`, `student`, `faculty`.

## 6. Student Applications
- `POST /applications` — Submit accommodation application. Role: `student`.
- `GET /applications` — List applications (scoped to student if role=student; scoped to assigned hostels if role=warden). Roles: `admin`, `warden`, `student`.
- `PATCH /applications/:id/review` — Review application (decision: `approved`, `rejected`, `waitlisted`). Roles: `admin`, `warden`.

## 7. Allocations & Physical Circulation
- `POST /allocations` — Allocate bed to approved student (atomic state lock). Roles: `admin`, `warden`.
- `GET /allocations` — List allocations (scoped). Roles: `admin`, `warden`, `student`.
- `POST /allocations/:id/check-in` — Record student check-in, key issuance, and inventory condition. Roles: `admin`, `warden`.
- `POST /allocations/:id/check-out` — Record check-out, damage assessment, clearance status, and release bed. Roles: `admin`, `warden`.

## 8. Room Transfers
- `POST /transfers` — Student submits transfer request with mandatory reason. Role: `student`.
- `GET /transfers` — List transfer requests. Roles: `admin`, `warden`, `student`.
- `PATCH /transfers/:id/review` — Review transfer request and perform atomic bed swap if approved. Roles: `admin`, `warden`.

## 9. Hostel Maintenance & Grievances
- `POST /complaints` — File maintenance complaint for hostel room/bed. Role: `student`.
- `GET /complaints` — List hostel complaints (scoped to assigned hostels for wardens). Roles: `admin`, `warden`, `student`.
- `PATCH /complaints/:id` — Update maintenance complaint status or resolution. Roles: `admin`, `warden`.

## 10. Dining Mess Menu
- `GET /mess-menu?hostelId=:id` — Get weekly meal schedule. Roles: `admin`, `warden`, `student`, `faculty`.
- `PUT /mess-menu` — Update weekly meal schedule. Roles: `admin`, `warden`.

