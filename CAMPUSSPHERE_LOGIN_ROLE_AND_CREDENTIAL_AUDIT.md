# CampusSphere AI — Login Roles, Demo Credentials & Authentication Audit

> **Audit Type:** Strictly Read-Only Architecture & Security Audit  
> **Date:** November 19, 2026  
> **Target Repository:** `~/AI-Campus_Help_Desk`  
> **MongoDB:** `mongodb://127.0.0.1:27018/campus-erp` (Persistent in-memory WiredTiger, `server/.data/db`)  
> **Status:** Completed — Zero database writes, zero password resets, zero account modifications.

---

## 1. Executive Summary

An evidence-based investigation was performed to reconcile the login roles and demo credentials documented in `README.md` against actual database collections, seed scripts, authentication controllers, middleware, and frontend login forms.

### Key Audit Findings
1. **README Credential Inaccuracy:** All five credentials documented in `README.md` are inaccurate or non-functional against the current production codebase:
   - **Student (`Roll: 20240001 / student123`):** Password-based student login does not exist. Student authentication strictly requires `Roll Number + Registered Personal Gmail` (no password). Furthermore, `20240001` has email `20240001@campus.edu` which fails the `@gmail.com` validator.
   - **Faculty (`faculty@campus.edu / faculty123`):** No user with email or loginId `faculty@campus.edu` exists in the database. Faculty accounts use identifiers `FAC001` through `FAC019`, with cryptographically random temporary password hashes.
   - **Admin (`admin@campus.edu / admin1234`):** An admin user exists (`ADMIN001`), but its password is NOT `admin1234`. Admin credentials are cryptographically generated via `bootstrap_admin.js` with 24-hour expiration.
   - **Parent (`parent@campus.edu / parent123`):** Zero parent accounts exist in MongoDB. The backend User schema role enum does not include `parent`, and the login controller explicitly rejects `role: 'parent'` with HTTP 400 (`Invalid role`).
   - **Visitor (`Name + Purpose (no password)`):** No visitor accounts, models, routes, or database collections exist anywhere in the application.
2. **Provenance of Parent & Visitor:**
   - Both originated in an early static HTML/vanilla-JS prototype (`js/role-select.js`, commit `50995b9`) where a modal prompted for "Full Name" and "Purpose of Visit".
   - **Visitor** was entirely abandoned during the React transition and only survived as stale text in `README.md`.
   - **Parent** was partially ported as an empty React dashboard stub with no backend APIs, no schema support, and broken authentication.
3. **Canonical Student Authentication Gap:**
   - The production student login logic fully supports official roll numbers (`1/24/SET/BCS/XXX`) and registered `@gmail.com` addresses.
   - However, all 535 canonical 2024 BCS student records currently have `user: null` (`accountStatus: 'enrolled_offline'`). Because the authentication controller enforces `if (!student.user) throw 401`, no canonical student can log in until an institutional portal onboarding/user creation step is executed.

---

## 2. Documented vs. Implemented Roles Matrix

| Documented Role | Present in `README.md` | Present in `User.js` Role Enum | Present in MongoDB `users` | Implemented in Auth Controller | Status |
|---|---|---|---|---|---|
| **Student** | Yes | Yes (`'student'`) | Yes (8 synthetic) | Yes (`POST /api/auth/student-login`) | **Fully Implemented** (Requires Roll + Gmail) |
| **Faculty** | Yes | Yes (`'faculty'`) | Yes (19 accounts) | Yes (`POST /api/auth/login`) | **Fully Implemented** (Requires Employee ID + Password) |
| **Admin** | Yes | Yes (`'admin'`) | Yes (1 account) | Yes (`POST /api/auth/login`) | **Fully Implemented** (Requires Admin ID + Password) |
| **Parent** | Yes | **No** | **No** (0 accounts) | **No** (Rejected with HTTP 400) | **Legacy Stub** (Non-functional frontend shell) |
| **Visitor** | Yes | **No** | **No** (0 accounts) | **No** (No endpoint or logic) | **Documentation-Only Artifact** |

### Additional Operational Staff Roles Implemented in ERP
The backend `server/models/User.js` schema defines 16 additional operational staff roles that are genuine parts of the college ERP but not listed in the top-level README:
- `librarian`, `warden`, `transport_manager`, `driver`, `attendant`
- `placement_officer`, `placement_coordinator`
- `event_organizer`, `club_coordinator`
- `inventory_manager`, `procurement_officer`, `storekeeper`
- `department_head`, `hr_admin`, `hr_officer`, `employee`

---

## 3. Demo Credential Verification Status

Direct non-destructive verification against MongoDB `campus-erp` on port 27018:

| Documented Credential | Stored User Found? | Role Match? | Password Verification | Root Cause of Failure |
|---|---|---|---|---|
| **Student**<br>`Roll: 20240001`<br>`student123` | **Yes** (`_id: 6ae46faf...dd3`, `loginId: 20240001`) | `student` | ❌ `false` (Bcrypt mismatch) | 1. Seed generated random 16-byte hex password.<br>2. Student login endpoint does not accept passwords.<br>3. Student email is `20240001@campus.edu`, which is rejected by the `@gmail.com` validator. |
| **Faculty**<br>`faculty@campus.edu`<br>`faculty123` | ❌ **No** (0 records) | N/A | N/A | No user with email `faculty@campus.edu` exists. Faculty in DB are `FAC001` (`priya.mehta@campus.edu`) and `FAC002`–`FAC019` (`fac00X@campussphere.edu`), all created with random hex hashes. |
| **Admin**<br>`admin@campus.edu`<br>`admin1234` | **Yes** (`_id: 6ae46faf...dcf`, `loginId: ADMIN001`) | `admin` | ❌ `false` (Bcrypt mismatch) | Admin account was generated via random hex seed / `bootstrap_admin.js`. `admin1234` was only a mock concept. |
| **Parent**<br>`parent@campus.edu`<br>`parent123` | ❌ **No** (0 records) | N/A | N/A | Zero parent records exist in database. |
| **Visitor**<br>`Name + Purpose`<br>`(no password)` | ❌ **No** (0 records) | N/A | N/A | Zero visitor records exist in database. |

> **Security Confirmation:** All password checks were performed locally using read-only in-memory bcrypt comparisons. No hashes, salts, or passwords were logged or exposed.

---

## 4. Provenance of Parent & Visitor Concepts

### 4.1 Historical Origin in Git
Git history reveals that both concepts were introduced in the earliest commits:
- **Commit `94a10c9` (March 24, 2026):** Initial repository commit created `README.md` with the 5-role demo table as a conceptual vision.
- **Commit `50995b9` / `b5124c2` (Early Prototype):** A static vanilla JavaScript file (`js/role-select.js`) implemented a mock modal:
  ```javascript
  // Early prototype logic in js/role-select.js:
  if (role === 'parent' || role === 'new_admission') {
    loginTitle.textContent = role === 'parent' ? 'Parent / Visitor Entry' : 'New Admission Entry';
    idLabel.textContent = 'Full Name';
    secondaryLabel.textContent = 'Purpose of Visit';
  }
  ```

### 4.2 Divergence During the Enterprise React/Express Rewrite
When the project was restructured into React + Vite and Express + MongoDB:
1. **Visitor:**
   - Was completely dropped. No React route, no component, no controller, and no MongoDB collection was ever built.
   - Remained only as a dead string in `README.md`.
2. **Parent:**
   - **Frontend:** A stub page `client/src/pages/ParentDashboard/index.jsx` was created, along with `parent.service.js` calling a fictitious endpoint `GET /api/parent/student-data`, and navigation links in `Sidebar.jsx`.
   - **Backend:** Completely neglected. The route `GET /api/parent/student-data` was never registered in `server.js` or `server/routes/`.
   - **Data Model:** `server/models/User.js` explicitly omits `parent` from its `enum`.
   - **Authentication:** `server/controllers/auth.controller.js` explicitly defines `ROLE_REDIRECTS` as `{ student, faculty, admin }`. Attempting to submit `role: 'parent'` returns:
     ```json
     { "success": false, "message": "Invalid role" }
     ```
   - **Verdict:** "Visitor" is a pure documentation artifact. "Parent" is a stranded frontend mockup with zero backend capability.

---

## 5. Investigation of Student Demo Account `20240001`

### 5.1 Account Identity & Linkage
- **User Record:**
  - `_id`: `6ae46faf9e9e56f71ecccdd3`
  - `loginId`: `'20240001'`
  - `email`: `'20240001@campus.edu'`
  - `role`: `'student'`
  - `isActive`: `true`
- **Student Profile Record:**
  - `_id`: `6ae46faf9e9e56f71ecccdd5`
  - `rollNumber`: `'20240001'`
  - `fullName`: `'Arjun Sharma'`
  - `email`: `'20240001@campus.edu'`
  - `branch`: `'CSE'`, `semester`: `5`, `section`: `'A'`
  - `status`: `'active'`
  - `user`: `ObjectId('6ae46faf9e9e56f71ecccdd3')` (Bidirectional link valid ✅)

### 5.2 Confirmation of Synthetic Status
As discovered in Part 1 and Part 2 audits, `20240001` is one of **8 synthetic student profiles** (`20240001` through `20240008`) created by `server/seed.js`.
- It does **not** correspond to any real university enrollment.
- The official roll-number format is `1/24/SET/BCS/XXX`.
- It holds **10 attendance records** and **2 face embeddings** from earlier mock tests.
- **Login Incompatibility:** Even though this account has a linked User record, entering `20240001` and its email `20240001@campus.edu` into the student login form fails immediately because `studentLogin` requires an email ending with `@gmail.com`.

---

## 6. Official Student Login Compatibility Audit

### 6.1 Authentication Architecture (`POST /api/auth/student-login`)
The production student authentication mechanism adheres to the **Part 7 Two-Factor Identity Mandate**:
1. **Inputs:** Exactly two fields — `rollNumber` and `gmail`. No password or OTP is used.
2. **Roll Number Normalization:** `normalizedRoll = rollNumber.trim().toUpperCase()`.
   - **Compatibility:** **100% compatible** with official formats like `1/24/SET/BCS/222` or `1/24/SET/BCS/001`.
3. **Gmail Validation:**
   - Must match `/^[a-zA-Z0-9._%+-]+@gmail\.com$/`.
   - In MongoDB, 514 out of 561 student records currently possess a valid registered `@gmail.com` address.
4. **Account Eligibility & User Linkage Requirement:**
   ```javascript
   // auth.controller.js lines 112-126
   if (!student.user) {
     recordFailure();
     throw new ApiError(401, 'Invalid roll number or registered Gmail address');
   }
   ```

### 6.2 The "Enrolled Offline" Blocker
- **Database Status:** All 535 canonical `1/24/SET/BCS/XXX` students in MongoDB currently have `user: null` and `accountStatus: 'enrolled_offline'`.
- **Impact:** If a real student enters their canonical roll number and registered Gmail, Step 5 successfully finds the student document, but Step 7 rejects them with HTTP 401 because `student.user` has not yet been provisioned.
- **Ready Students:** Currently **0 students** in MongoDB can successfully log in through `studentLogin`:
  - 8 synthetic students fail Gmail validation (they have `@campus.edu` emails).
  - 535 canonical students fail Step 7 (`user: null`).

---

## 7. Role-Based Access Control (RBAC) Integrity

An audit of route definitions across all 20+ Express router files verified that RBAC enforcement is tightly configured via `authMiddleware` and `allowRoles`:

| Route Module | Allowed Roles | Access Assessment |
|---|---|---|
| `admin.routes.js` | `admin` | Strictly protected. Zero student or faculty access. |
| `faculty.routes.js` | `faculty` | Strictly protected. Includes audit logging on unauthorized attempts. |
| `student.routes.js` | `student` | Restricted to enrolled student tokens. |
| `hr.routes.js` | `admin`, `hr_admin`, `hr_officer`, `department_head`, `employee` | Fine-grained managerial and employee self-service separation. |
| `inventory.routes.js`| `admin`, `inventory_manager`, `procurement_officer`, `storekeeper` | Strictly compartmentalized to logistics personnel. |
| `hostel.routes.js` | `admin`, `warden`, `student` (for student-specific endpoints) | Correct separation between administration and student lodging requests. |
| `transport.routes.js`| `admin`, `transport_manager`, `driver`, `attendant`, `student` | Operational bus tracking segregated from rider queries. |
| `placement.routes.js`| `admin`, `placement_officer`, `placement_coordinator`, `student` | Corporate relations and application records protected. |
| `library.routes.js` | `admin`, `librarian`, `faculty`, `student` | Catalog public, circulation and inventory staff-controlled. |

**RBAC Leakage Finding:** No role possesses permissions beyond its defined scope. The access control middleware functions correctly.

---

## 8. Inconsistencies Summary

1. **Password Authentication vs. Passwordless Student Login:**
   `README.md` advertises `student123` as a password. In reality, the student portal is completely passwordless and relies on registered personal Gmail verification.
2. **Faculty Username:**
   `README.md` lists `faculty@campus.edu`. The actual login system expects Employee IDs (`FAC001` - `FAC019`), and the database contains no user named `faculty@campus.edu`.
3. **Hardcoded vs. Dynamic Credentials:**
   `README.md` implies fixed demo passwords (`admin1234`, `faculty123`), whereas the enterprise codebase enforces PRNG-generated passwords with `mustChangePassword=true` and time-based expiration.
4. **Phantom Roles:**
   `README.md` lists `Parent` and `Visitor`, neither of which have functioning authentication, database support, or backend business logic.

---

## 9. Recommendations & Next Steps

### 9.1 Documentation Corrections (`README.md`)
1. **Remove Visitor completely:** Delete the Visitor row from the Demo Credentials table and features list.
2. **Remove Parent completely:** Strip Parent from the roles list until (and unless) a dedicated Parent portal with verified student-parent relationships is commissioned.
3. **Correct Faculty Login Instructions:** Document that faculty sign in using their **Employee ID** (`FAC001` - `FAC019`) rather than `faculty@campus.edu`.
4. **Correct Student Login Instructions:** Clarify that student login uses **Roll Number + Registered Personal Gmail** with no password.
5. **Document Bootstrap Script:** Mention `npm run bootstrap:admin` as the authoritative mechanism to obtain a secure administrative credential.

### 9.2 Institutional Portal Onboarding (Prerequisite for Live Student Login)
To enable real students with canonical roll numbers (`1/24/SET/BCS/XXX`) to log into the application:
1. Develop an administrative user provisioning script (or automated first-login trigger) that creates a linked `User` record (`role: 'student'`, `loginId: rollNumber`) for every eligible Student record having `accountStatus: 'enrolled_offline'`.
2. Transition the synthetic students (`20240001` - `20240008`) out of the active roster as detailed in the Part 2 Reconciliation report.

---

*Report prepared by: CampusSphere AI Security & Architecture Auditor*  
*Repository: `~/AI-Campus_Help_Desk`*  
*Audit Mode: READ-ONLY*
