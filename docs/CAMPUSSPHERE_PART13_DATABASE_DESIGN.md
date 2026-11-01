# CampusSphere AI — Part 13: Database Design

## 1. Schema Specifications

### 1.1. Assignment Collection (`server/models/Assignment.js`)

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `title` | String | Yes | Name of coursework or homework assignment. |
| `description` | String | Yes | Detailed problem statement and submission guidelines. |
| `subject` | ObjectId (ref: `Subject`) | Yes | Reference to academic course subject. |
| `faculty` | ObjectId (ref: `User`) | Yes | Assigned faculty instructor who authored the assignment. |
| `department` | String | Yes | Target academic department (e.g. `CSE`, `ECE`). |
| `semester` | Number | Yes | Target semester (1–8). |
| `section` | String | No | Target section (`All` or `A`/`B`). Default: `All`. |
| `maximumMarks` | Number | Yes | Total available marks. Default: 100. |
| `assignmentType`| String (enum) | Yes | `homework`, `project`, `lab_report`, `quiz_takehome`, `case_study`. |
| `attachments` | Array of Subdocuments | No | Reference files attached by faculty (`name`, `path`, `mimetype`, `size`). |
| `status` | String (enum) | Yes | `draft`, `published`, `closed`, `archived`. Default: `draft`. |
| `dueDate` | Date | Yes | Deadline timestamp for student submissions. |
| `latePolicy` | String (enum) | Yes | `none` (strict cutoff), `allowed` (marked late), `grace_period`. |
| `gracePeriodMinutes` | Number | No | Additional minutes allowed if policy is `grace_period`. |
| `publishedAt` | Date | No | Timestamp when assignment was published to students. |
| `closedAt` | Date | No | Timestamp when assignment was manually or automatically closed. |

#### Indexes
- `{ department: 1, semester: 1, status: 1 }` — Accelerated lookup for student coursework feeds.
- `{ faculty: 1, status: 1 }` — Accelerated lookup for faculty instructor management screens.
- `{ dueDate: 1, status: 1 }` — Automated session and deadline monitoring index.

---

### 1.2. Submission Collection (`server/models/Submission.js`)

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `assignment` | ObjectId (ref: `Assignment`) | Yes | Reference to parent assignment. |
| `student` | ObjectId (ref: `Student`) | Yes | Reference to submitting student profile. |
| `studentUser` | ObjectId (ref: `User`) | Yes | Reference to student's user authentication account. |
| `submissionFiles` | Array of Subdocuments | No | Uploaded submission files (`name`, `path`, `mimetype`, `size`). |
| `textResponse` | String | No | Written commentary, explanations, or code responses. |
| `submittedAt` | Date | Yes | Timestamp of current active submission version. |
| `version` | Number | Yes | Monotonically increasing revision counter (starts at 1). |
| `status` | String (enum) | Yes | `submitted`, `late`, `evaluated`, `resubmitted`. |
| `isLate` | Boolean | Yes | Flag indicating whether submission was made after `dueDate`. |
| `marksAwarded` | Number | No | Faculty awarded score (null until evaluated). |
| `maxMarksSnapshot` | Number | Yes | Point-in-time snapshot of assignment max marks. |
| `feedback` | String | No | Qualitative feedback provided by instructor. |
| `evaluatedBy` | ObjectId (ref: `User`) | No | Faculty instructor who completed the evaluation. |
| `evaluatedAt` | Date | No | Timestamp when evaluation was recorded. |
| `isResultPublished` | Boolean | Yes | When false, grades/feedback are invisible to the student. |
| `resultPublishedAt` | Date | No | Timestamp when evaluation was released to the student. |
| `previousVersions` | Array of Subdocuments | No | Historical snapshot of previous versions for auditability. |

#### Subdocument: `previousVersions`
- `version` (Number)
- `submissionFiles` (Array of file subdocs)
- `textResponse` (String)
- `submittedAt` (Date)
- `isLate` (Boolean)

#### Indexes
- `{ assignment: 1, student: 1 }` (Unique) — Guarantees atomic single active document per student-assignment pair. Prevents split-brain duplicates.
- `{ assignment: 1, status: 1 }` — Accelerated lookup for faculty submission audit tables.
- `{ studentUser: 1, submittedAt: -1 }` — Accelerated student submission ledger queries.

