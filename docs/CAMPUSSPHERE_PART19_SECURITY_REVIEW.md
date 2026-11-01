# CampusSphere AI — Part 19: Security Review & Threat Mitigation

## 1. Threat Modeling & Vulnerability Analysis

The Campus Transport subsystem manages fleet assets, student personal commute details, regulatory certificates, and administrative approvals. An exhaustive security review was performed covering authentication, authorization, injection attacks, and concurrency race conditions.

---

## 2. Role-Based Access Control (RBAC) Matrix

| Endpoint Action | Admin | Transport Manager | Driver | Attendant | Student | Faculty |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Create / Update Fleet Vehicle |  |  | ❌ | ❌ | ❌ | ❌ |
| Create / Update Routes & Stops |  |  | ❌ | ❌ | ❌ | ❌ |
| View Routes & Public Stops |  |  |  |  |  |  |
| Submit Transport Application | ❌ | ❌ | ❌ | ❌ |  | ❌ |
| Review / Approve Application |  |  | ❌ | ❌ | ❌ | ❌ |
| Allocate Commuter Pass |  |  | ❌ | ❌ | ❌ | ❌ |
| View Own Commute / Applications |  |  |  |  |  (Self) |  (Self) |
| View Other Commuters' Details |  |  | ❌ | ❌ | ❌ | ❌ |
| Dispatch Daily Trip / Report Delay |  |  |  (Own Trip) | ❌ | ❌ | ❌ |
| Log Vehicle Maintenance |  |  | ❌ | ❌ | ❌ | ❌ |
| Export Transport CSV Records |  |  | ❌ | ❌ | ❌ | ❌ |
| Update Transport Policy |  | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 3. Insecure Direct Object References (Anti-IDOR)

Ordinary students must never be allowed to inspect or alter other students' transit records.
- **Application Endpoints (`GET /api/transport/applications/my`):**
  Student queries are strictly scoped to `req.user._id`:
  ```javascript
  const applications = await TransportApplication.find({ student: req.user._id });
  ```
- **Direct ID Access:**
  When querying by application or allocation ID, the controller explicitly verifies:
  ```javascript
  if (req.user.role === 'student' && application.student.toString() !== req.user._id.toString()) {
    throw new AppError('Access denied: You can only view your own applications', 403);
  }
  ```

---

## 4. Formula Injection Defense (CWE-1236)

When exporting route schedules, commuter rosters, or fleet logs to CSV, un-sanitized user inputs (e.g. stop names, driver remarks, student emergency contact names) could contain malicious spreadsheet formulas (`=cmd|' /C calc'!A0`, `@SUM(...)`, `+`, `-`).

### 4.1 Sanitization Algorithm
All exported cell values pass through `transportService.sanitizeCsvValue()`:
```javascript
sanitizeCsvValue(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  // Neutralize formula injection characters
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}
```
Formula indicators are prefixed with an apostrophe `'`, forcing spreadsheet software (Excel, LibreOffice, Google Sheets) to treat the cell as raw text rather than executable macro formulas.

---

## 5. Concurrency Race Condition Protections

Under peak enrollment, multiple students or staff might attempt to book the final available seat on a popular route.
- The system employs atomic MongoDB queries with capacity conditions:
  ```javascript
  const route = await TransportRoute.findOneAndUpdate(
    {
      _id: routeId,
      status: 'active',
      $expr: { $lt: ['$allocatedStudentsCount', '$maxCapacity'] }
    },
    { $inc: { allocatedStudentsCount: 1 } },
    { new: true }
  );
  ```
- Because MongoDB applies document-level locks during write operations, this guarantees that even under simultaneous concurrent execution, `allocatedStudentsCount` will never exceed `maxCapacity`.

