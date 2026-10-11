/**
 * server/utils/grades.js
 * Grade calculation utilities for the ERP.
 *
 * Grading scale (as per UGC / 10-point system):
 *   O  >= 90  → 10 points
 *   A+ >= 80  → 9 points
 *   A  >= 70  → 8 points
 *   B+ >= 60  → 7 points
 *   B  >= 50  → 6 points
 *   C  >= 40  → 5 points
 *   F  < 40   → 0 points  (fail)
 *
 * SGPA / CGPA = Σ(gradePoints × credits) / Σcredits
 */
'use strict';

const GRADE_TABLE = [
  { min: 90, grade: 'O',  points: 10 },
  { min: 80, grade: 'A+', points: 9  },
  { min: 70, grade: 'A',  points: 8  },
  { min: 60, grade: 'B+', points: 7  },
  { min: 50, grade: 'B',  points: 6  },
  { min: 40, grade: 'C',  points: 5  },
  { min: 0,  grade: 'F',  points: 0  },
];

/**
 * Convert a percentage mark (0-100) to a grade letter.
 * @param {number} percentage
 * @returns {{ grade: string, points: number }}
 */
const getGrade = (percentage) => {
  const entry = GRADE_TABLE.find((g) => percentage >= g.min);
  return entry || { grade: 'F', points: 0 };
};

/**
 * Calculate CGPA from an array of subject results.
 * @param {Array<{ internal: number, external: number, credits: number }>} subjects
 * @returns {{ cgpa: number, sgpa: number, grades: Array<{ grade, points }> }}
 */
const calculateCGPA = (subjects) => {
  if (!subjects || subjects.length === 0) return { cgpa: 0, sgpa: 0, grades: [] };

  let totalCredits = 0;
  let totalWeightedPoints = 0;
  const grades = [];

  for (const sub of subjects) {
    const total = (sub.internal || 0) + (sub.external || 0); // max 100
    const { grade, points } = getGrade(total);
    const credits = sub.credits || 0;

    grades.push({ grade, points });
    totalWeightedPoints += points * credits;
    totalCredits += credits;
  }

  const cgpa = totalCredits > 0 ? totalWeightedPoints / totalCredits : 0;
  return {
    cgpa: Math.round(cgpa * 100) / 100,
    sgpa: Math.round(cgpa * 100) / 100, // same as CGPA for a single semester
    grades,
  };
};

module.exports = { getGrade, calculateCGPA, GRADE_TABLE };
