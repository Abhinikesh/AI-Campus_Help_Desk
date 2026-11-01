# CampusSphere AI — Part 13: Grading, Evaluation & Result Publication

## 1. Evaluation Workflow

Faculty evaluation represents the academic assessment phase of coursework. To avoid student confusion or premature score visibility while an instructor is actively marking an entire batch, evaluation uses a **two-phase commitment model**:
1. **Mark Recording (`evaluateSubmission`):** Marks and notes are saved to the database, but marked as unpublished (`isResultPublished: false`).
2. **Result Release (`publishSubmissionResult`):** Faculty formally publishes the grade, transitioning `isResultPublished: true` and triggering an academic alert notification to the student.

---

## 2. Academic Invariants & Validation Rules

### 2.1. Marks Boundary Rules
- **Non-Negative:** `marksAwarded >= 0`. Negative values are rejected with `400 Bad Request`.
- **Upper Bound:** `marksAwarded <= assignment.maximumMarks`. Scores exceeding the total points are rejected with `400 Bad Request`.
- **Snapshot Integrity:** When evaluating, `submission.maxMarksSnapshot` records the points possible at the time of evaluation, preventing grade discrepancies if maximum marks are later edited.

### 2.2. Qualitative Feedback
Instructors can provide free-form text feedback (`submission.feedback`) explaining deductions, praising strong answers, or detailing rubric criteria.

---

## 3. Student Privacy & Isolation

When a student queries `/api/assignments/student/:id`, the controller strips evaluation data if `isResultPublished` is `false`:
```javascript
let studentSubmission = null;
if (submission) {
  studentSubmission = submission.toObject();
  if (!studentSubmission.isResultPublished) {
    studentSubmission.marksAwarded = null;
    studentSubmission.feedback = null;
  }
}
```
This guarantees that students cannot inspect network payloads in DevTools to view unpublished draft grades.

