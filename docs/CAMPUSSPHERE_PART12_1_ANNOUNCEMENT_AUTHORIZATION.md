# CampusSphere AI — Part 12.1 Announcement Audience Authorization & Security Audit

## 1. Scope & Vulnerabilities Identified

During the Part 12.1 security audit, the announcement query and retrieval layer was analyzed for authorization bypasses and IDOR (Insecure Direct Object Reference) vulnerabilities:

1. **Broken `$or` Spread in Student Queries**:
   In `getVisibleAnnouncements`, spreading `baseFilter` (`{ status: 'published', $or: [expiresAt checks] }`) alongside `studentAudienceConditions` caused JavaScript object key collision, silently erasing the expiration condition and leaking expired announcements into student feeds.
2. **Permissive Audience Disjunction**:
   Audience conditions previously evaluated `targetBranches` OR `targetSemesters` using `$or`. An announcement restricted to CSE Semester 5 was visible to ECE students in Semester 5.
3. **Unprotected Direct Retrieval (`getAnnouncementById`)**:
   `GET /api/announcements/:id` lacked audience and status checks, allowing any authenticated student to view unpublished drafts, archived announcements, and faculty-only broadcasts by guessing or extracting IDs.
4. **Open Redirect Risks**:
   Notification and announcement target routes lacked validation against arbitrary external URL destinations (e.g. `//attacker.com` or `javascript:`).

---

## 2. Security Controls Implemented

### 2.1 Conjunction-Safe MongoDB Query Construction

To prevent query property collisions and enforce proper logic, expiration and audience filters are wrapped in `$and`:

```javascript
const query = {
  status: 'published',
  $and: [
    { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
    { $or: studentAudienceConditions },
  ],
};
```

### 2.2 Strict Student Audience Matching Rules

For announcements targeted to `audience: 'student'`:
- If `targetBranches` is non-empty, the student's branch **must** match.
- If `targetSemesters` is non-empty, the student's semester **must** match.
- Both constraints are combined using `$and`:

```javascript
const studentBranchCondition = branch
  ? { $or: [{ targetBranches: { $size: 0 } }, { targetBranches: branch }] }
  : { targetBranches: { $size: 0 } };

const studentSemesterCondition = semester
  ? { $or: [{ targetSemesters: { $size: 0 } }, { targetSemesters: semester }] }
  : { targetSemesters: { $size: 0 } };

studentAudienceConditions.push({
  audience: 'student',
  $and: [studentBranchCondition, studentSemesterCondition],
});
```

### 2.3 Authoritative Direct Retrieval Checks (`getAnnouncementById`)

`GET /api/announcements/:id` now evaluates:
1. **Admin**: Universal institutional access.
2. **Original Author**: Can view their own drafts and announcements.
3. **Ordinary Users**:
   - `status !== 'published'` -> HTTP 404 (Hides existence of drafts).
   - `expiresAt <= now` -> HTTP 404 (Announcement expired).
   - `audience === 'faculty'` -> Rejected for students (HTTP 403).
   - `audience === 'department'` -> Evaluates faculty department and student branch.
   - `audience === 'student'` -> Evaluates both branch and semester criteria.

### 2.4 Open Redirect Defense

All `targetRoute` destinations are validated before persistence:
- Must start with `/` (internal route).
- Must NOT start with `//` (protocol-relative external redirect).
- Must NOT contain `://` (absolute external URL).
- Invalid targets are sanitized to `null`.

---

## 3. Verification Evidence

- `E1`: Student cannot create or publish announcements (**PASS**).
- `E2`: Faculty cannot publish admin-only / faculty-wide announcements (**PASS**).
- `E3`: Faculty B cannot edit Faculty A restricted announcements (**PASS**).
- `E4`: Draft announcements are invisible in public feed and direct ID lookup (**PASS**).
- `E5`: Expired announcements are excluded from public feed and direct ID lookup (**PASS**).
- `E6`: Student outside audience receives HTTP 403 on direct lookup and exclusion from feed (**PASS**).

