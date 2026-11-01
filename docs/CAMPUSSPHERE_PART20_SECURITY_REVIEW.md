# CampusSphere AI — Part 20: Security Review & Threat Mitigation

## 1. Threat Modeling & Vulnerability Analysis

The Placement subsystem handles student personal resumes, confidential corporate recruiter contacts, candidate evaluation scores, and employment packages. An exhaustive security audit was conducted covering RBAC, Anti-IDOR, and injection defenses.

---

## 2. Role-Based Access Control (RBAC) Matrix

| Action | Admin | Placement Officer | Placement Coordinator | Faculty | Student |
|---|:---:|:---:|:---:|:---:|:---:|
| Manage Companies |  |  | ❌ | ❌ | ❌ |
| Create / Publish Opportunities |  |  | ❌ | ❌ | ❌ |
| View Published Opportunities |  |  |  |  |  |
| View Draft Opportunities |  |  | ❌ | ❌ | ❌ |
| Schedule Recruitment Drives |  |  | ❌ | ❌ | ❌ |
| Manage Drive Stages & Results |  |  |  (Assigned Only) | ❌ | ❌ |
| Apply for Opportunities | ❌ | ❌ | ❌ | ❌ |  |
| View / Edit Own Placement Profile | ❌ | ❌ | ❌ | ❌ |  (Self) |
| View Other Candidate Resumes |  |  |  (Assigned Drive) | ❌ | ❌ (Blocked) |
| Issue Employment Offers |  |  | ❌ | ❌ | ❌ |
| Verify Official Placement |  |  | ❌ | ❌ | ❌ |
| Download Reports / CSV |  |  |  | ❌ | ❌ |

---

## 3. Insecure Direct Object References (Anti-IDOR)

1. **Resume Documents:**
   - Downloading resumes (`GET /api/placement/resumes/:filename`) verifies that the logged-in student owns the requested document.
   - Any student attempting to query or download another student's resume is blocked with `HTTP 403 Forbidden`.
2. **Offer Letters:**
   - Offer letters are strictly accessible by the recipient student and authorized Placement Officers.
3. **Application Management:**
   - Students can only withdraw their own submitted applications (`req.user._id === application.user`).

---

## 4. Academic Data Tampering Defense

- The placement submission endpoint (`POST /api/placement/applications`) ignores any student-supplied CGPA, grade point, or backlog claims.
- The server independently queries authoritative marks from `Mark.js` and runs `resultCalculationService.calculateSemesterResult()`, eliminating client-side spoofing.
