# CampusSphere AI — Part 12.1 Smoke Test Root Cause Investigation

## 1. Overview of Reported Incident

In the Part 12 execution report, an initial live API smoke test evaluation command exited with code 1.

Per Section 8 (Phase G) of the Part 12.1 mandate, this investigation documents the original command, root cause, classification, and final verification.

---

## 2. Incident Reproduction & Evidence

### 2.1 Original Command
```bash
node -e "
(async () => {
  const jwt = require('jsonwebtoken');
  const secret = '...';
  const token = jwt.sign({ userId: '...', role: 'student' }, secret, { expiresIn: '1h' });
  const unreadRes = await fetch('http://localhost:5001/api/notifications/unread-count', { ... });
  ...
})();
"
```

### 2.2 Execution Context
- **Working Directory**: `/Users/abhinikesh/AI-Campus_Help_Desk/` (Repository root).
- **Exit Code**: `1`.

### 2.3 Exact Failure Output
```text
node:internal/modules/cjs/loader:1475
  const err = new Error(message);
              ^

Error: Cannot find module 'jsonwebtoken'
Require stack:
- /Users/abhinikesh/AI-Campus_Help_Desk/[eval]
    at Module._resolveFilename (node:internal/modules/cjs/loader:1475:15)
    at wrapResolveFilename (node:internal/modules/cjs/loader:1048:27)
    at defaultResolveImplForCJSLoading (node:internal/modules/cjs/loader:1072:10)
    at resolveForCJSWithHooks (node:internal/modules/cjs/loader:1093:12)
    at Module._load (node:internal/modules/cjs/loader:1261:25)
    at wrapModuleLoad (node:internal/modules/cjs/loader:255:19)
    at Module.require (node:internal/modules/cjs/loader:1575:12)
    at require (node:internal/modules/helpers:191:16)
    at [eval]:3:15
    at [eval]:30:3 {
  code: 'MODULE_NOT_FOUND',
  requireStack: [ '/Users/abhinikesh/AI-Campus_Help_Desk/[eval]' ]
}
```

---

## 3. Root Cause Analysis

1. **Root Cause**: The evaluation script required `jsonwebtoken`. In CampusSphere AI's multi-package repository structure, backend npm dependencies are installed strictly in `server/node_modules/`, while frontend dependencies reside in `client/node_modules/`. The repository root does not contain `node_modules` or `package.json`.
2. **Failure Classification**: **Test-Environment Execution Context Issue**. It was not an application code defect, server crash, or API bug.
3. **Corrective Action**: Executed the verification command with the working directory set to `server/`:
   ```bash
   cd /Users/abhinikesh/AI-Campus_Help_Desk/server && node -e "..."
   ```

---

## 4. Verification After Fix

When executed within `server/`, the verification script completed with **exit code 0**:

```text
SSE ?token status (expect 400): 400
SSE ?token response: Passing authentication tokens in URL query parameters is prohibited for security. Use Authorization header or HttpOnly cookie.
SSE no-auth status (expect 401): 401
GET /notifications/unread-count status (expect 200): 200
GET /announcements status (expect 200): 200
```

All endpoints returned expected HTTP status codes, verifying live runtime health.

