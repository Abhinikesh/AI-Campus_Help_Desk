# CampusSphere AI — Part 14: Result Calculation Rules & Academic Standards

## 1. Overview

CampusSphere AI implements the standardized **University Grants Commission (UGC) Choice Based Credit System (CBCS)** 10-point letter grading scheme. All calculations are executed server-side in `server/services/resultCalculation.service.js` to eliminate client-side manipulation risks.

---

## 2. UGC 10-Point Grading Scale

The following table defines the official conversion between raw marks percentage and letter grade points:

| Percentage Range | Letter Grade | Grade Point | Performance Description | Pass / Fail |
| :--- | :---: | :---: | :--- | :---: |
| **90.00% – 100.00%** | **O** | 10.0 | Outstanding | Pass |
| **80.00% – 89.99%** | **A+** | 9.0 | Excellent | Pass |
| **70.00% – 79.99%** | **A** | 8.0 | Very Good | Pass |
| **60.00% – 69.99%** | **B+** | 7.0 | Good | Pass |
| **55.00% – 59.99%** | **B** | 6.0 | Above Average | Pass |
| **50.00% – 54.99%** | **C** | 5.0 | Average | Pass |
| **40.00% – 49.99%** | **P** | 4.0 | Pass | Pass |
| **Below 40.00%** | **F** | 0.0 | Fail | Fail |
| **Absent / Withheld** | **F** | 0.0 | Absent / Incomplete | Fail |

---

## 3. Mathematical Calculations

### 3.1. Percentage Calculation
For an examination with maximum marks $M_{max}$ and marks obtained $M_{obt}$:

$$\text{Percentage} = \operatorname{round}\left(\frac{M_{obt}}{M_{max}} \times 100, 2\right)$$

- If `isAbsent === true` or `isWithheld === true`, $\text{Percentage} = 0.00\%$.
- All percentage values are rounded strictly to two decimal places.

### 3.2. Passing Criteria
A student is declared to have passed an examination if and only if:
1. `isAbsent === false`
2. `isWithheld === false`
3. $M_{obt} \ge M_{pass}$, where $M_{pass}$ is the configured `passingMarks` for the examination (default $40\%$).

### 3.3. Semester Grade Point Average (SGPA)
SGPA aggregates all courses completed in a given academic semester:

$$\text{SGPA} = \frac{\sum_{i=1}^{N} (C_i \times G_i)}{\sum_{i=1}^{N} C_i}$$

Where:
- $N$ is the number of subjects taken in the semester.
- $C_i$ is the credit weight assigned to subject $i$.
- $G_i$ is the grade point earned in subject $i$.

If $\sum C_i = 0$, SGPA resolves safely to $0.00$.

### 3.4. Cumulative Grade Point Average (CGPA)
CGPA represents the cumulative academic performance across all completed semesters:

$$\text{CGPA} = \frac{\sum_{j=1}^{M} (C_j \times G_j)}{\sum_{j=1}^{M} C_j}$$

Where $M$ is the total number of subjects completed across all semesters to date.

---

## 4. Edge Cases & Safeguards

1. **Fractional Maximum Marks:** Validated to ensure $M_{max} > 0$. Zero or negative maximum marks are rejected at schema validation.
2. **Rounding Boundaries:** A score of $79.99\%$ strictly receives an **A** grade (8.0), preventing artificial promotion to **A+** without meeting the $80.00\%$ threshold.
3. **Withheld Results:** Students with disciplinary flags or fee clearances pending can have `isWithheld = true`. Withheld results hide detailed score breakdowns from the student while preserving internal faculty records.
4. **Zero-Credit Courses:** Mandatory non-credit or audit courses ($C_i = 0$) display the letter grade earned but are excluded from the SGPA denominator.

