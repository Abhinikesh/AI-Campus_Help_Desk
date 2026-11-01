# CAMPUSSPHERE AI — PART 17/24
# APPLICATION SECURITY REVIEW & DEFENSE AUDIT

**Phase:** Part 17 of 24  
**Module:** Physical Library Management System  
**Status:** Completed & Stabilized  

---

## 1. Security Architecture & Threat Model

| Vulnerability Threat | CWE Reference | Architectural Mitigation | Test Verification |
|---|---|---|---|
| **Insecure Direct Object References (IDOR)** | CWE-639 | `resolveCurrentStudent(req)` ensures students can only view or renew their own loans and reservations. Attempts to access other students' records yield HTTP 403. | Test 13 |
| **Spreadsheet Formula Injection** | CWE-1236 | `libraryService.sanitizeCsvValue` neutralizes leading formula characters (`=`, `+`, `-`, `@`, `\t`, `\r`) with a single quotation mark (`'`). | Test 32 |
| **Privilege Escalation** | CWE-250 | Strict role authorization: only `admin` and `librarian` can add books, accession copies, issue books, waive fines, or update policy. Students attempting to add books receive HTTP 403. | Test 2 |
| **Race Conditions in Circulation** | CWE-362 | Physical copy availability checked atomically; duplicate issue blocked; unique compound indexes enforce single active title loan per student. | Test 9, 10, 12 |
| **Currency Rounding Drift** | CWE-682 | All financial values stored strictly as integer paise ($1\text{ INR} = 100\text{ paise}$). Zero floating-point multiplication in database. | Test 27 |
| **Data Leakage in Audit Trails** | CWE-532 | Audit logs record actor, timestamp, action, and entity ID without exposing credentials or unverified financial payloads. | Test 28 |

---

## 2. Anti-IDOR Deep Dive

In `server/controllers/library.controller.js`:
```javascript
// Example from renewLoan:
if (req.user?.role === 'student') {
  const currentStudent = await resolveCurrentStudent(req);
  if (!currentStudent || String(loan.student._id) !== String(currentStudent._id)) {
    throw new ApiError(403, 'Forbidden: You cannot renew another student book loan');
  }
}
```
Similarly, in `cancelReservation`, `getStudentLibraryOverview`, and `getFines`, student queries are forced to `student: currentStudent._id`. Students cannot manipulate query parameters or URL path IDs to traverse to another student's loan or fine ledger.

---

## 3. Spreadsheet Injection Defense (CWE-1236)

CSV exports use `sanitizeCsvValue`:
```javascript
sanitizeCsvValue(cell) {
  if (cell === null || cell === undefined) return '""';
  let str = String(cell).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}
```
If an adversary names a book title `=cmd|'/C calc'!A0`, it is exported as `"'=cmd|'/C calc'!A0"`, rendering safely as inert text in Microsoft Excel, LibreOffice Calc, and Google Sheets.

