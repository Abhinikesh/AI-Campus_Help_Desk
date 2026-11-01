# CampusSphere AI — Part 14: Marks Approval & Audited Correction System

## 1. Executive Summary

Academic assessment systems require robust governance to prevent unauthorized grade modifications, grade inflation, and clerical errors. CampusSphere AI implements a **Two-Tier Verification & Approval Hierarchy** combined with an **Immutable Audited Correction Ledger** for post-publication grade revisions.

---

## 2. Two-Tier Approval Hierarchy

```
+--------------------------------------------------------------------------------+
| TIER 1: Evaluation & Submission (Course Faculty)                                |
|   - Marks entered and saved in draft status.                                    |
|   - Verification of cohort completeness.                                       |
|   - Faculty submits roster to Department Head / Examination Cell.               |
|   - Status: 'submitted_for_review'                                             |
+--------------------------------------------------------------------------------+
                                       |
                                       v
+--------------------------------------------------------------------------------+
| TIER 2: Independent Review & Institutional Approval (Admin / Review Committee) |
|   - Anti-Self-Approval Enforcement: The submitting faculty member CANNOT       |
|     approve their own evaluation.                                              |
|   - Independent reviewer or Admin verifies grading distribution and anomalies. |
|   - Approval transitions records to 'approved'.                                |
+--------------------------------------------------------------------------------+
                                       |
                                       v
+--------------------------------------------------------------------------------+
| TIER 3: Institutional Publication                                              |
|   - Official release of results to students.                                   |
|   - Batch notification dispatch via Part 12 centralized notification engine.   |
|   - Status: 'published'                                                        |
+--------------------------------------------------------------------------------+
```

### 2.1. Anti-Self-Approval Invariant

To guarantee academic objectivity, the system enforces anti-self-approval at the controller layer:

```javascript
// server/controllers/exam.controller.js
if (req.user.role !== 'admin' && exam.faculty.toString() === req.user._id.toString()) {
  return res.status(403).json({
    message: 'Instructors cannot self-approve their own submitted marks. Approval must be conducted by an administrator or designated reviewer.'
  });
}
```

---

## 3. Post-Publication Audited Correction Workflow

Once an examination's results are marked `published`, direct in-place modifications are strictly prohibited. Any score adjustment must follow the audited correction protocol.

### 3.1. Correction Protocol Lifecycle

```
[ Published Result ]
        |
        | 1. Faculty / Admin identifies error / re-evaluation
        v
[ Correction Request ]
        | - Requires mandatory justification (min 5 characters)
        | - Exam evaluationStatus -> 'correction_requested'
        v
[ Administrative Review & Audit Ledger Append ]
        | - Admin executes /api/exams/:id/marks/:markId/correct
        | - MongoDB atomic push to correctionHistory[]
        | - Updates marksObtained and status
        v
[ Real-Time Student Notification ]
        | - Notification sent to student detailing previous score,
        |   new score, and verified reason
        v
[ Final Corrected State ]
```

### 3.2. Data Structure of `correctionHistory`

Every revision creates an immutable audit entry inside `Mark.correctionHistory`:

```javascript
{
  previousMarks: 78,
  newMarks: 85,
  reason: "Clerical summation error in Section C: re-evaluation confirmed +7 marks.",
  requestedBy: ObjectId("60d0fe4f5311236168a109ca"), // Faculty User ID
  approvedBy: ObjectId("60d0fe4f5311236168a109cc"),  // Admin User ID
  correctedAt: ISODate("2025-11-25T14:30:00Z")
}
```

### 3.3. Key Governance Guarantees

1. **Non-Destructive:** Historical marks are never overwritten or deleted from the database.
2. **Actor Traceability:** Both the requesting faculty and the approving administrator are recorded with foreign key references.
3. **Mandatory Justification:** Empty, whitespace, or generic reasons are rejected with HTTP 400.
4. **Immediate Transparency:** The student receives an automated, tamper-evident notification as soon as the correction is committed.

