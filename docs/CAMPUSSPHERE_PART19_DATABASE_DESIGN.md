# CampusSphere AI — Part 19: Database Design & Schema Specifications

## 1. Overview & Data Architecture

The Part 19 Campus Transport Management System introduces 11 dedicated MongoDB collections and extends 4 shared institutional models. All models adhere to strict schema constraints, compound unique indexes for race condition prevention, soft and hard foreign key references, and integer paise currency precision for all financial attributes.

---

## 2. Shared Model Extensions

### 2.1 User (`server/models/User.js`)
- **Role Enum Expansion:** Added `'transport_manager'`, `'driver'`, `'attendant'` to the allowed user roles.
  ```javascript
  enum: ['student', 'faculty', 'admin', 'warden', 'librarian', 'transport_manager', 'driver', 'attendant']
  ```

### 2.2 Notification (`server/models/Notification.js`)
- **Category Enum Expansion:** Added `'transport'` to allowed notification categories.
  ```javascript
  category: {
    type: String,
    enum: ['academic', 'attendance', 'fee', 'general', 'library', 'system', 'hostel', 'transport'],
    default: 'general'
  }
  ```

### 2.3 NotificationPreference (`server/models/NotificationPreference.js`)
- **Category Preference:** Added `transport: { type: Boolean, default: true }`.

### 2.4 Complaint (`server/models/Complaint.js`)
- **Category Enum Expansion:** Added `'transport'` to allowed complaint categories.
- **Transport References:** Added optional references for transit grievances:
  - `vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'TransportVehicle' }`
  - `route: { type: mongoose.Schema.Types.ObjectId, ref: 'TransportRoute' }`
  - `stop: { type: mongoose.Schema.Types.ObjectId, ref: 'TransportStop' }`
  - `driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }`

---

## 3. Dedicated Transport Collections

### 3.1 TransportVehicle (`server/models/TransportVehicle.js`)
Stores institutional fleet vehicle details, physical capacities, and regulatory certificates.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `registrationNumber` | String | Required, Unique, Trim, Uppercase | Official license plate number (e.g. `DL-01-AB-1234`) |
| `vehicleCode` | String | Required, Unique, Trim, Uppercase | Internal fleet ID (e.g. `BUS-01`) |
| `type` | String | Enum: `['bus', 'minibus', 'van', 'shuttle', 'suv']` | Vehicle classification |
| `make` | String | Required, Trim | Manufacturer (e.g. `Tata Motors`, `Ashok Leyland`) |
| `modelName` | String | Required, Trim | Vehicle model |
| `seatingCapacity` | Number | Required, Min: 1 | Legal passenger seating capacity |
| `standingCapacity`| Number | Default: 0, Min: 0 | Permitted standing capacity |
| `status` | String | Enum: `['active', 'maintenance', 'out_of_service', 'decommissioned']` | Operational status |
| `insurancePolicyNumber` | String | Required, Trim | Insurance policy identifier |
| `insuranceExpiryDate` | Date | Required | Insurance policy expiration date |
| `fitnessCertificateExpiryDate` | Date | Required | RTO Fitness certificate expiration date |
| `permitExpiryDate` | Date | Required | Commercial passenger permit expiration date |
| `pollutionCertificateExpiryDate`| Date | Optional | Emission certificate expiration date |
| `currentOdometerReading` | Number | Default: 0, Min: 0 | Odometer in kilometers |
| `fuelType` | String | Enum: `['diesel', 'cng', 'electric', 'petrol']` | Fuel / power source |
| `gpsDeviceId` | String | Optional, Trim | Telematics hardware identifier |
| `assignedRoute` | ObjectId | Ref: `TransportRoute`, Optional | Currently assigned route |
| `assignedDriver` | ObjectId | Ref: `User`, Optional | Primary assigned driver |
| `assignedAttendant` | ObjectId | Ref: `User`, Optional | Primary assigned attendant |

**Indexes:**
- Unique Index: `{ registrationNumber: 1 }`
- Unique Index: `{ vehicleCode: 1 }`
- Index: `{ status: 1 }`
- Index: `{ insuranceExpiryDate: 1, fitnessCertificateExpiryDate: 1, permitExpiryDate: 1 }`

---

### 3.2 TransportRoute (`server/models/TransportRoute.js`)
Defines commuter transit routes, schedules, stops count, and capacity locks.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `routeCode` | String | Required, Unique, Trim, Uppercase | Unique route identifier (e.g. `R-01`, `NORTH-EXP`) |
| `routeName` | String | Required, Trim | Descriptive corridor name |
| `description` | String | Optional, Trim | Route overview and landmarks |
| `startLocation` | String | Required, Trim | Origin terminal |
| `endLocation` | String | Required, Trim | Destination terminal (e.g. Main Campus) |
| `totalDistanceKm` | Number | Default: 0, Min: 0 | Total route distance |
| `estimatedDurationMinutes` | Number | Default: 0, Min: 0 | Average transit time |
| `morningDepartureTime` | String | Required, Pattern: `HH:MM` | Morning start time (e.g. `07:15`) |
| `morningArrivalTime` | String | Required, Pattern: `HH:MM` | Campus arrival time (e.g. `08:45`) |
| `eveningDepartureTime` | String | Required, Pattern: `HH:MM` | Campus evening departure time (e.g. `17:15`) |
| `operatingDays` | [String] | Enum: `['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']` | Scheduled operating days |
| `vehicle` | ObjectId | Ref: `TransportVehicle`, Optional | Primary assigned vehicle |
| `driver` | ObjectId | Ref: `User`, Optional | Primary designated driver |
| `attendant` | ObjectId | Ref: `User`, Optional | Primary designated attendant |
| `maxCapacity` | Number | Required, Min: 1 | Maximum commuter capacity |
| `allocatedStudentsCount` | Number | Default: 0, Min: 0 | Concurrently allocated students |
| `status` | String | Enum: `['active', 'suspended', 'draft', 'inactive']` | Route operational state |

**Indexes:**
- Unique Index: `{ routeCode: 1 }`
- Index: `{ status: 1 }`
- Index: `{ vehicle: 1 }`
- Index: `{ driver: 1 }`

---

### 3.3 TransportStop (`server/models/TransportStop.js`)
Ordered stops along a transit corridor.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `route` | ObjectId | Required, Ref: `TransportRoute` | Route parent reference |
| `stopName` | String | Required, Trim | Location / landmark name |
| `sequence` | Number | Required, Min: 1 | Ordered sequence index (1, 2, 3...) |
| `morningPickupTime` | String | Required, Pattern: `HH:MM` | Scheduled morning pickup time |
| `eveningDropTime` | String | Required, Pattern: `HH:MM` | Scheduled evening drop-off time |
| `distanceFromStartKm` | Number | Default: 0, Min: 0 | Cumulative distance |
| `coordinates` | Object | `{ latitude: Number, longitude: Number }` | Geographic coordinates |
| `landmark` | String | Optional, Trim | Identifying physical landmark |
| `isActive` | Boolean | Default: `true` | Active stop flag |

**Indexes:**
- Compound Unique Index: `{ route: 1, sequence: 1 }`
- Index: `{ route: 1, isActive: 1 }`

---

### 3.4 TransportStaffRecord (`server/models/TransportStaffRecord.js`)
Maintains institutional personnel profiles for drivers and attendants.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `user` | ObjectId | Required, Unique, Ref: `User` | User account reference |
| `role` | String | Enum: `['driver', 'attendant']` | Transport crew role |
| `licenseNumber` | String | Required for driver, Trim, Uppercase | Commercial driving license ID |
| `licenseCategory` | String | Optional | Heavy passenger / commercial badge |
| `licenseExpiryDate` | Date | Required for driver | License expiration date |
| `badgeNumber` | String | Optional, Trim | Official transport badge ID |
| `experienceYears` | Number | Default: 0, Min: 0 | Commercial driving experience |
| `bloodGroup` | String | Optional | Emergency medical info |
| `medicalFitnessDate` | Date | Optional | Last health checkup date |
| `assignedVehicle` | ObjectId | Ref: `TransportVehicle`, Optional | Current assigned vehicle |
| `assignedRoute` | ObjectId | Ref: `TransportRoute`, Optional | Current assigned route |
| `status` | String | Enum: `['available', 'on_duty', 'on_leave', 'suspended', 'terminated']` | Staff readiness status |

**Indexes:**
- Unique Index: `{ user: 1 }`
- Index: `{ role: 1, status: 1 }`
- Index: `{ licenseExpiryDate: 1 }`

---

### 3.5 TransportApplication (`server/models/TransportApplication.js`)
Captures student applications for institutional transport passes.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `applicationNumber` | String | Required, Unique, Trim, Uppercase | e.g. `TR-APP-2026-0001` |
| `student` | ObjectId | Required, Ref: `User` | Student applicant |
| `academicYear` | String | Required, Trim | Academic session (e.g. `2025-2026`) |
| `preferredRoute` | ObjectId | Required, Ref: `TransportRoute` | Desired transit route |
| `boardingStop` | ObjectId | Required, Ref: `TransportStop` | Desired boarding stop |
| `emergencyContactName` | String | Required, Trim | Emergency contact person |
| `emergencyContactPhone`| String | Required, Trim | Emergency contact phone |
| `medicalNotes` | String | Optional, Trim | Medical conditions or allergies |
| `status` | String | Enum: `['pending', 'approved', 'rejected', 'cancelled']` | Application review status |
| `reviewedBy` | ObjectId | Ref: `User`, Optional | Reviewing transport manager/admin |
| `reviewedAt` | Date | Optional | Review timestamp |
| `rejectionReason` | String | Optional, Min: 5 chars when rejected | Mandatory review feedback |

**Indexes:**
- Unique Index: `{ applicationNumber: 1 }`
- Compound Index: `{ student: 1, academicYear: 1, status: 1 }`
- Index: `{ preferredRoute: 1, status: 1 }`

---

### 3.6 TransportAllocation (`server/models/TransportAllocation.js`)
Represents an active or historical student bus pass and seat allocation.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `passNumber` | String | Required, Unique, Trim, Uppercase | e.g. `TP-2026-CSE-0001` |
| `student` | ObjectId | Required, Ref: `User` | Allocated student |
| `application` | ObjectId | Required, Ref: `TransportApplication` | Originating application |
| `route` | ObjectId | Required, Ref: `TransportRoute` | Assigned route |
| `stop` | ObjectId | Required, Ref: `TransportStop` | Assigned boarding stop |
| `academicYear` | String | Required, Trim | Active academic session |
| `feeAmount` | Number | Required, Min: 0 | Fee in integer paise (e.g. `1200000` = ₹12,000) |
| `invoice` | ObjectId | Ref: `FeeInvoice`, Optional | Linked Part 16 financial invoice |
| `status` | String | Enum: `['allocated', 'active', 'suspended', 'cancelled', 'expired']` | Allocation state |
| `allocatedBy` | ObjectId | Required, Ref: `User` | Allocating administrator |
| `allocatedAt` | Date | Default: `Date.now` | Allocation timestamp |
| `validFrom` | Date | Required | Commute pass start date |
| `validUntil` | Date | Required | Commute pass expiration date |
| `cancellationReason` | String | Optional, Trim | Reason if cancelled |

**Indexes:**
- Unique Index: `{ passNumber: 1 }`
- Compound Index: `{ student: 1, status: 1 }`
- Index: `{ route: 1, status: 1 }`

---

### 3.7 TransportTrip (`server/models/TransportTrip.js`)
Tracks daily operational morning and evening runs, arrivals, departures, and delays.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `tripDate` | String | Required, Format: `YYYY-MM-DD` | Operating date |
| `route` | ObjectId | Required, Ref: `TransportRoute` | Route corridor |
| `vehicle` | ObjectId | Required, Ref: `TransportVehicle` | Dispatched vehicle |
| `driver` | ObjectId | Required, Ref: `User` | On-duty driver |
| `attendant` | ObjectId | Ref: `User`, Optional | On-duty attendant |
| `tripType` | String | Enum: `['morning_pickup', 'evening_drop', 'special_trip']` | Run category |
| `scheduledDepartureTime`| String | Required, Pattern: `HH:MM` | Scheduled departure time |
| `scheduledArrivalTime` | String | Required, Pattern: `HH:MM` | Scheduled arrival time |
| `actualDepartureTime` | Date | Optional | Actual recorded departure |
| `actualArrivalTime` | Date | Optional | Actual recorded arrival |
| `status` | String | Enum: `['scheduled', 'boarding', 'in_transit', 'completed', 'delayed', 'cancelled']` | Trip operational state |
| `delayMinutes` | Number | Default: 0, Min: 0 | Operational delay duration |
| `delayReason` | String | Optional, Trim | Cause of delay (e.g. traffic, breakdown) |
| `passengerCount` | Number | Default: 0, Min: 0 | Actual boarded passenger headcount |

**Indexes:**
- Compound Index: `{ tripDate: 1, route: 1, tripType: 1 }`
- Index: `{ vehicle: 1, tripDate: 1 }`
- Index: `{ status: 1 }`

---

### 3.8 TransportMaintenance (`server/models/TransportMaintenance.js`)
Logs fleet vehicle servicing, repairs, odometer readings, and costs in integer paise.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `maintenanceId` | String | Required, Unique, Trim, Uppercase | e.g. `TM-2026-0001` |
| `vehicle` | ObjectId | Required, Ref: `TransportVehicle` | Serviced vehicle |
| `serviceType` | String | Enum: `['routine_service', 'repair', 'inspection', 'tire_replacement', 'battery', 'emergency']` | Maintenance type |
| `description` | String | Required, Trim | Details of work performed |
| `serviceDate` | Date | Required | Date service was performed |
| `odometerReading` | Number | Required, Min: 0 | Vehicle odometer reading at service |
| `costPaise` | Number | Required, Min: 0 | Servicing cost in integer paise |
| `serviceProvider`| String | Required, Trim | Garage / authorized dealer name |
| `invoiceNumber` | String | Optional, Trim | Workshop invoice reference |
| `nextServiceDueOdometer` | Number | Optional | Recommended next service odometer |
| `nextServiceDueDate` | Date | Optional | Recommended next service date |
| `recordedBy` | ObjectId | Required, Ref: `User` | Staff member recording maintenance |

**Indexes:**
- Unique Index: `{ maintenanceId: 1 }`
- Index: `{ vehicle: 1, serviceDate: -1 }`

---

### 3.9 TransportIncident (`server/models/TransportIncident.js`)
Records traffic accidents, mechanical breakdowns, medical emergencies, or disciplinary issues.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `incidentNumber` | String | Required, Unique, Trim, Uppercase | e.g. `INC-TR-2026-0001` |
| `trip` | ObjectId | Ref: `TransportTrip`, Optional | Linked operational trip |
| `vehicle` | ObjectId | Required, Ref: `TransportVehicle` | Inoperative / involved vehicle |
| `route` | ObjectId | Ref: `TransportRoute`, Optional | Route where incident occurred |
| `driver` | ObjectId | Ref: `User`, Optional | Driver on duty |
| `type` | String | Enum: `['breakdown', 'accident', 'medical_emergency', 'route_obstruction', 'student_misconduct', 'weather_delay', 'other']` | Incident classification |
| `severity` | String | Enum: `['minor', 'moderate', 'major', 'critical']` | Impact severity |
| `occurredAt` | Date | Required | Incident timestamp |
| `locationDescription` | String | Required, Trim | Physical location description |
| `description` | String | Required, Trim | Detailed report |
| `actionsTaken` | String | Optional, Trim | Immediate response & resolution |
| `reportedBy` | ObjectId | Required, Ref: `User` | Reporting user |
| `status` | String | Enum: `['reported', 'investigating', 'resolved', 'closed']` | Incident lifecycle state |

**Indexes:**
- Unique Index: `{ incidentNumber: 1 }`
- Index: `{ vehicle: 1, occurredAt: -1 }`
- Index: `{ severity: 1, status: 1 }`

---

### 3.10 TransportPolicy (`server/models/TransportPolicy.js`)
Institutional rules and parameters for campus commuting.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `policyName` | String | Required, Default: `'Institutional Transport Policy'` | Policy title |
| `academicYear` | String | Required, Trim | e.g. `2025-2026` |
| `isActive` | Boolean | Default: `true` | Active status flag |
| `annualBaseFeePaise` | Number | Default: `1200000` (₹12,000) | Default base annual fee |
| `perKmRatePaise` | Number | Default: `1000` (₹10/km) | Mileage rate |
| `documentExpiryNoticeDays`| Number | Default: `30`, Min: 1 | Advance alert window for expiring papers |
| `maxCapacityBufferPercentage`| Number | Default: `0`, Min: 0, Max: 10 | Permitted temporary over-capacity |
| `cancellationRefundPercentage`| Number | Default: `80`, Min: 0, Max: 100 | Pro-rated refund percentage |
| `operatingHours` | Object | `{ morningStart: '06:30', morningEnd: '09:30', eveningStart: '16:30', eveningEnd: '20:00' }` | Daily transit operating hours |
| `updatedBy` | ObjectId | Ref: `User` | Administrator who last edited policy |

---

### 3.11 TransportAuditLog (`server/models/TransportAuditLog.js`)
Immutable administrative security audit trail for transport mutations.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `action` | String | Required | Action taken (e.g. `ALLOCATE_PASS`, `CANCEL_PASS`, `ASSIGN_VEHICLE`) |
| `entityType` | String | Required | Target entity type (`Vehicle`, `Route`, `Allocation`, `Trip`) |
| `entityId` | ObjectId | Required | Target document ObjectId |
| `performedBy`| ObjectId | Required, Ref: `User` | Actor user ID |
| `details` | Object | Default: `{}` | Action metadata snapshot |
| `ipAddress` | String | Optional | Client IP address |
| `timestamp` | Date | Default: `Date.now` | Audit entry creation timestamp |

**Indexes:**
- Index: `{ entityId: 1, action: 1 }`
- Index: `{ performedBy: 1, timestamp: -1 }`

