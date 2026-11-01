# CAMPUSSPHERE AI — PART 16/24
# APPLICATION SECURITY: ANTI-IDOR & FORMULA INJECTION PREVENTION

## 1. Threat Modeling & Scope

Financial systems in higher education must defend against critical application security threats:
1. **Broken Object-Level Authorization (IDOR):** A malicious student attempting to inspect or modify another student's fee invoices, payments, or concession applications.
2. **CSV Formula Injection (CWE-1236):** An adversary injecting spreadsheet formula commands (e.g., `=cmd|'...`, `+HYPERLINK(...)`) into text fields that execute when an administrator exports and opens a CSV report in Microsoft Excel or Google Sheets.
3. **Role-Based Access Control (RBAC):** Students attempting administrative operations such as approving payments, setting fee structures, or issuing refunds.

---

## 2. Anti-IDOR Implementation

In `server/controllers/fee.controller.js`, student identity is resolved authoritatively from the authenticated session:

```javascript
async function resolveCurrentStudent(req) {
  const userId = req.user?.userId || req.user?._id || req.user?.id;
  if (!userId) return null;
  return await Student.findOne({ user: userId });
}
```

When accessing individual invoices, payments, or receipts:

```javascript
if (req.user?.role === 'student') {
  const currentStudent = await resolveCurrentStudent(req);
  if (!currentStudent || String(target.student._id || target.student) !== String(currentStudent._id)) {
    throw new ApiError(403, 'Forbidden: You do not have permission to access financial records belonging to another student');
  }
}
```

### Verified Protections:
- **Test 29:** Student A cannot view Student B's fee invoice (HTTP 403).
- **Test 30:** Student A cannot view or print Student B's payment receipt (HTTP 403).
- **Test 31:** Student A cannot record payments on Student B's invoice (HTTP 403).

---

## 3. CSV Formula Injection Defense (CWE-1236)

Spreadsheet applications treat cells starting with `=`, `+`, `-`, `@`, `\t`, or `\r` as executable formulas or commands.

### Sanitization Implementation (`server/services/feeCalculation.service.js`):
```javascript
function sanitizeCsvValue(cell) {
  if (cell === null || cell === undefined) return '""';
  let str = String(cell).trim();

  // Guard against spreadsheet formula triggers
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape double quotes inside cell
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}
```

### Verified Protections:
- **Test 32:** Formula injection strings like `=CMD|`, `+1+2`, `@SUM(...)` are automatically neutralized with a leading single quote `'`.
- **Test 33:** Full CSV export generates RFC-4180 compliant streams with formula guards applied to all student and institutional attributes.

