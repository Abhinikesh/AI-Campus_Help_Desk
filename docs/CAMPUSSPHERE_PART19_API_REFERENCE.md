# CampusSphere AI — Part 19: REST API Reference

All Transport endpoints are mounted under the base path `/api/transport` and require Bearer JWT authentication unless marked public.

---

## 1. Transport Policy & Configuration

### `GET /api/transport/policy`
- **Access:** Authenticated Users
- **Description:** Retrieves the active institutional transport policy and fee parameters.

### `PUT /api/transport/policy`
- **Access:** Admin only
- **Description:** Updates institutional transport policy parameters (fees, notice days, buffer).
- **Body:** `{ annualBaseFeePaise, perKmRatePaise, documentExpiryNoticeDays, maxCapacityBufferPercentage }`

---

## 2. Fleet Vehicle Inventory

### `GET /api/transport/vehicles`
- **Access:** Admin, Transport Manager
- **Query Params:** `status`, `type`, `search`
- **Description:** Lists fleet vehicles with pagination and filtering.

### `POST /api/transport/vehicles`
- **Access:** Admin, Transport Manager
- **Description:** Registers a new fleet vehicle.
- **Body:** `{ registrationNumber, vehicleCode, type, make, modelName, seatingCapacity, standingCapacity, insurancePolicyNumber, insuranceExpiryDate, fitnessCertificateExpiryDate, permitExpiryDate, fuelType }`

### `GET /api/transport/vehicles/:id`
- **Access:** Admin, Transport Manager
- **Description:** Retrieves full vehicle profile and assignment status.

### `PUT /api/transport/vehicles/:id`
- **Access:** Admin, Transport Manager
- **Description:** Updates vehicle details, maintenance status, or odometer readings.

---

## 3. Routes & Ordered Stops

### `GET /api/transport/routes`
- **Access:** Authenticated Users
- **Query Params:** `status`, `search`
- **Description:** Retrieves transit routes and their assigned vehicle/driver info.

### `POST /api/transport/routes`
- **Access:** Admin, Transport Manager
- **Description:** Creates a new transit corridor.
- **Body:** `{ routeCode, routeName, description, startLocation, endLocation, totalDistanceKm, morningDepartureTime, morningArrivalTime, eveningDepartureTime, operatingDays, maxCapacity }`

### `GET /api/transport/routes/:id`
- **Access:** Authenticated Users
- **Description:** Retrieves detailed route information, ordered stops, and capacity counts.

### `PUT /api/transport/routes/:id`
- **Access:** Admin, Transport Manager
- **Description:** Updates route metadata or capacity (cannot reduce below active allocations).

### `POST /api/transport/routes/:id/assign`
- **Access:** Admin, Transport Manager
- **Description:** Binds a vehicle, driver, and attendant to a route with conflict checking.
- **Body:** `{ vehicleId, driverId, attendantId }`

### `POST /api/transport/routes/:id/stops`
- **Access:** Admin, Transport Manager
- **Description:** Adds an ordered stop to a route corridor.
- **Body:** `{ stopName, sequence, morningPickupTime, eveningDropTime, distanceFromStartKm, landmark }`

### `PUT /api/transport/stops/:stopId`
- **Access:** Admin, Transport Manager
- **Description:** Updates stop details or timings.

### `DELETE /api/transport/stops/:stopId`
- **Access:** Admin, Transport Manager
- **Description:** Soft-deletes / deactivates a route stop.

---

## 4. Transport Crew & Staff Records

### `GET /api/transport/staff`
- **Access:** Admin, Transport Manager
- **Query Params:** `role`, `status`
- **Description:** Lists transport drivers and attendants.

### `POST /api/transport/staff`
- **Access:** Admin, Transport Manager
- **Description:** Creates or updates a driver or attendant transport staff profile.
- **Body:** `{ userId, role, licenseNumber, licenseCategory, licenseExpiryDate, experienceYears, bloodGroup }`

---

## 5. Applications & Seat Allocations

### `POST /api/transport/applications`
- **Access:** Student only
- **Description:** Submits a commuter pass application.
- **Body:** `{ preferredRouteId, boardingStopId, academicYear, emergencyContactName, emergencyContactPhone, medicalNotes }`

### `GET /api/transport/applications/my`
- **Access:** Student only
- **Description:** Retrieves current and historical applications submitted by the logged-in student.

### `GET /api/transport/applications`
- **Access:** Admin, Transport Manager
- **Query Params:** `status`, `academicYear`, `route`
- **Description:** Lists all student applications for administrative review.

### `PUT /api/transport/applications/:id/review`
- **Access:** Admin, Transport Manager
- **Description:** Approves or rejects a student transport application.
- **Body:** `{ status: 'approved' | 'rejected', rejectionReason?: string }`

### `POST /api/transport/allocations`
- **Access:** Admin, Transport Manager
- **Description:** Concurrency-safe seat allocation and bus pass issuance.
- **Body:** `{ applicationId, validFrom, validUntil, feeAmountPaise }`

### `GET /api/transport/allocations/my`
- **Access:** Student only
- **Description:** Retrieves active commuter pass and boarding details for the logged-in student.

### `GET /api/transport/allocations`
- **Access:** Admin, Transport Manager
- **Query Params:** `status`, `route`, `academicYear`
- **Description:** Lists all student seat allocations across the institution.

### `PUT /api/transport/allocations/:id/cancel`
- **Access:** Admin, Transport Manager
- **Description:** Cancels an active commuter pass and atomically releases route capacity.
- **Body:** `{ cancellationReason }`

---

## 6. Daily Trip Operations & Delays

### `GET /api/transport/trips`
- **Access:** Authenticated Users
- **Query Params:** `date`, `routeId`, `status`
- **Description:** Lists scheduled daily route runs.

### `POST /api/transport/trips`
- **Access:** Admin, Transport Manager, Driver
- **Description:** Dispatches a daily route trip.
- **Body:** `{ routeId, vehicleId, driverId, tripDate, tripType, scheduledDepartureTime, scheduledArrivalTime }`

### `PUT /api/transport/trips/:id/status`
- **Access:** Admin, Transport Manager, Driver
- **Description:** Updates trip status (`boarding`, `in_transit`, `completed`, `cancelled`).
- **Body:** `{ status, actualDepartureTime, actualArrivalTime, passengerCount }`

### `POST /api/transport/trips/:id/delay`
- **Access:** Admin, Transport Manager, Driver
- **Description:** Logs trip delays and delivers notifications to affected students.
- **Body:** `{ delayMinutes, delayReason }`

---

## 7. Fleet Maintenance, Incidents & Expiry Audits

### `GET /api/transport/maintenance`
- **Access:** Admin, Transport Manager
- **Description:** Retrieves vehicle servicing and repair records.

### `POST /api/transport/maintenance`
- **Access:** Admin, Transport Manager
- **Description:** Logs workshop servicing with cost in integer paise.
- **Body:** `{ vehicleId, serviceType, description, serviceDate, odometerReading, costPaise, serviceProvider, invoiceNumber }`

### `GET /api/transport/incidents`
- **Access:** Admin, Transport Manager
- **Description:** Retrieves transit incident logs.

### `POST /api/transport/incidents`
- **Access:** Authenticated Users
- **Description:** Reports a traffic accident, mechanical breakdown, or transit incident.
- **Body:** `{ vehicleId, routeId, type, severity, locationDescription, description, occurredAt }`

### `GET /api/transport/expiring-documents`
- **Access:** Admin, Transport Manager
- **Query Params:** `noticeDays` (default: 30)
- **Description:** Scans for insurance, permits, fitness certificates, and driver licenses expiring soon.

### `GET /api/transport/metrics`
- **Access:** Admin, Transport Manager
- **Description:** Aggregates real-time fleet, commuter, and financial metrics.

### `GET /api/transport/export`
- **Access:** Admin, Transport Manager
- **Query Params:** `type` (`routes` | `allocations` | `vehicles` | `maintenance`)
- **Description:** Downloads RFC-4180 compliant CSV reports with formula injection guards.

