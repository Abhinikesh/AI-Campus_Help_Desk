# CampusSphere AI — Part 20: Selection Rounds & Interview Management

## 1. Configurable Selection Stages

Recruitment processes involve multiple evaluation rounds. The `PlacementSelectionStage` model structures rounds within a drive:

- `resume_screening`: Initial shortlisting based on profile and resume.
- `online_assessment`: Coding or aptitude tests.
- `technical_interview`: System design, problem solving, or technical viva.
- `coding_interview`: Live pair-programming or whiteboarding.
- `group_discussion`: Behavioral assessment.
- `hr_interview`: Culture fit and compensation discussion.
- `final_selection`: Final candidate panel review.

### 1.1 Sequence Uniqueness
- Compound unique index `{ drive: 1, sequence: 1 }` guarantees monotonic progression (Round 1, Round 2, Round 3) without duplicate sequence numbers.

---

## 2. Candidate Evaluation & Audited Result Corrections

Candidate outcomes are tracked in `PlacementStageResult` (`cleared`, `not_cleared`, `on_hold`, `absent`, `score`).

### 2.1 Audited Result Corrections
If an interviewer enters an incorrect score or outcome:
- Correction endpoint (`PATCH /api/placement/stages/results/:id/correct`) requires a **mandatory justification of at least 5 characters**.
- Appends to `correctionHistory`:
  ```javascript
  correctionHistory: [
    {
      previousOutcome: 'not_cleared',
      newOutcome: 'cleared',
      reason: 'Recalculated coding test testcase scores manually',
      correctedBy: coordinatorUserId,
      correctedAt: new Date()
    }
  ]
  ```
- Previous outcomes are strictly preserved for administrative accountability.

---

## 3. Interview Schedule Visibility

- Shortlisted students can view scheduled assessment dates, start times, venues, and video conferencing links directly from their Student Placement Portal.
- Confidential interviewer notes (`internalNotes`) are omitted from student responses, while constructive feedback (`studentFeedback`) is shared.

