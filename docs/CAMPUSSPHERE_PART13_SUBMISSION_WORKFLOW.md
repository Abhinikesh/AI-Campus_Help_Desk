# CampusSphere AI — Part 13: Submission Workflow & Versioning

## 1. End-to-End Submission Lifecycle

```
[ Student Navigates to /student/assignments ]
                   │
                   ▼
     [ Check Enrollment & Status ]
  - Filter: Pending / Submitted / Graded
  - Review Due Date & Late Policy
                   │
                   ▼
     [ Submit Coursework Modal ]
  - Upload up to 5 files (PDF, DOCX, ZIP, JPG, PNG)
  - Add text notes or inline answers
                   │
                   ▼
     [ Backend Validation & Invariants ]
  - Is Student Enrolled? (branch & semester match)
  - Has Deadline Passed?
       ├─ If before deadline ──> Status: 'submitted', isLate: false
       └─ If after deadline:
             ├─ latePolicy === 'none' ──> REJECT (400 Bad Request)
             ├─ latePolicy === 'allowed' ──> Status: 'late', isLate: true
             └─ latePolicy === 'grace_period':
                   ├─ Within grace period ──> ACCEPT (isLate: true/false)
                   └─ Past grace period ──> REJECT (400 Bad Request)
                   │
                   ▼
      [ Atomic Upsert via { assignment, student } ]
       ├─ Existing doc found?
       │     ├── Push current state to previousVersions[]
       │     ├── Increment version counter: version = version + 1
       │     ├── Reset marksAwarded to null
       │     └── Set isResultPublished to false
       └─ First submission?
             └── Create document with version = 1
                   │
                   ▼
         [ Notifications Triggered ]
  - Student: Submission confirmation
  - Faculty: Student submission alert
```

---

## 2. Version Tracking & History Invariant

### 2.1. The Academic Audit Trail
In educational environments, students often request to replace an uploaded file with corrections before a deadline or submit updated work. Overwriting the existing record directly destroys evidence of what was submitted initially and when.

### 2.2. The Snapshot Solution
Our implementation maintains a compound unique index on `{ assignment: 1, student: 1 }`. When a student uploads a revised version:
1. The entire previous state (`version`, `submissionFiles`, `textResponse`, `submittedAt`, `isLate`) is cloned into the `previousVersions` array.
2. The root document is updated with the new payload and `version` is incremented.
3. If the submission had already been evaluated, `marksAwarded` and `isResultPublished` are cleanly reset so faculty can re-grade the new revision.

```javascript
existing.previousVersions.push({
  version: existing.version,
  submissionFiles: existing.submissionFiles,
  textResponse: existing.textResponse,
  submittedAt: existing.submittedAt,
  isLate: existing.isLate,
});
existing.version += 1;
existing.submissionFiles = newFiles;
existing.submittedAt = new Date();
```

