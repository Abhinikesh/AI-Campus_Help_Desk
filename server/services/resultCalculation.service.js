/**
 * server/services/resultCalculation.service.js
 * Centralized, decimal-safe Academic Result and CGPA Calculation Service.
 * Follows UGC 10-point standard defined in server/utils/grades.js.
 */
'use strict';

const { getGrade, calculateCGPA, GRADE_TABLE } = require('../utils/grades');
const ApiError = require('../utils/ApiError');

/**
 * Calculates derived performance metrics for an individual marks record.
 */
function calculateSubjectResult(marksObtained, maxMarks = 100, passingMarks = 40, isAbsent = false, isWithheld = false) {
  if (isWithheld) {
    return {
      marksObtained: null,
      maxMarks,
      passingMarks,
      percentage: null,
      grade: 'W',
      gradePoints: 0,
      isPassed: false,
      resultStatus: 'WITHHELD',
    };
  }

  if (isAbsent) {
    return {
      marksObtained: null,
      maxMarks,
      passingMarks,
      percentage: null,
      grade: 'F',
      gradePoints: 0,
      isPassed: false,
      resultStatus: 'ABSENT',
    };
  }

  if (marksObtained === null || marksObtained === undefined || isNaN(marksObtained)) {
    return {
      marksObtained: null,
      maxMarks,
      passingMarks,
      percentage: null,
      grade: null,
      gradePoints: null,
      isPassed: null,
      resultStatus: 'PENDING',
    };
  }

  const numMarks = Number(marksObtained);
  const numMax = Number(maxMarks) > 0 ? Number(maxMarks) : 100;
  const numPassing = Number(passingMarks) >= 0 ? Number(passingMarks) : 40;

  const rawPercentage = (numMarks / numMax) * 100;
  const percentage = Math.round(rawPercentage * 10) / 10;
  const gradeData = getGrade(percentage);
  const isPassed = numMarks >= numPassing;

  return {
    marksObtained: numMarks,
    maxMarks: numMax,
    passingMarks: numPassing,
    percentage,
    grade: gradeData.grade,
    gradePoints: gradeData.points,
    isPassed,
    resultStatus: isPassed ? 'PASS' : 'FAIL',
  };
}

/**
 * Aggregates a student's published marks into an overall semester result.
 * @param {Array<Object>} publishedMarks Array of Mark docs with populated subject & exam
 */
function calculateSemesterResult(publishedMarks = []) {
  if (!publishedMarks.length) {
    return {
      totalMarksObtained: 0,
      totalMaxMarks: 0,
      overallPercentage: 0,
      sgpa: 0,
      cgpa: 0,
      totalSubjects: 0,
      passedSubjects: 0,
      failedSubjects: 0,
      overallStatus: 'NO_DATA',
      subjects: [],
    };
  }

  let totalMarksObtained = 0;
  let totalMaxMarks = 0;
  let totalWeightedPoints = 0;
  let totalCredits = 0;
  let passedCount = 0;
  let failedCount = 0;

  const subjectResults = [];

  for (const m of publishedMarks) {
    const max = m.maxMarks || m.exam?.maximumMarks || 100;
    const passing = m.passingMarks || m.exam?.passingMarks || 40;
    const credits = m.subject?.credits || 3;

    const calc = calculateSubjectResult(m.marksObtained, max, passing, m.isAbsent, m.isWithheld);

    if (calc.resultStatus === 'PASS') {
      passedCount++;
    } else if (['FAIL', 'ABSENT'].includes(calc.resultStatus)) {
      failedCount++;
    }

    if (calc.marksObtained !== null) {
      totalMarksObtained += calc.marksObtained;
    }
    totalMaxMarks += max;

    if (calc.gradePoints !== null) {
      totalWeightedPoints += calc.gradePoints * credits;
      totalCredits += credits;
    }

    subjectResults.push({
      markId: m._id,
      examId: m.exam?._id || m.exam,
      examTitle: m.exam?.title || 'Examination',
      examType: m.exam?.examinationType || 'regular',
      subjectId: m.subject?._id || m.subject,
      subjectName: m.subject?.name || 'Subject',
      subjectCode: m.subject?.code || '',
      credits,
      ...calc,
    });
  }

  const overallPercentage =
    totalMaxMarks > 0 ? Math.round((totalMarksObtained / totalMaxMarks) * 1000) / 10 : 0;
  const gpa = totalCredits > 0 ? Math.round((totalWeightedPoints / totalCredits) * 100) / 100 : 0;
  const overallStatus = failedCount > 0 ? 'FAIL' : 'PASS';

  return {
    totalMarksObtained,
    totalMaxMarks,
    overallPercentage,
    sgpa: gpa,
    cgpa: gpa,
    totalCredits,
    totalSubjects: publishedMarks.length,
    passedSubjects: passedCount,
    failedSubjects: failedCount,
    overallStatus,
    subjects: subjectResults,
  };
}

/**
 * Validates a bulk marks-entry array against the target examination.
 */
function validateMarksPayload(entries, examDoc) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new ApiError(400, 'Marks entries list is required and cannot be empty');
  }

  const maxMarks = examDoc.maximumMarks;
  const seenStudents = new Set();
  const validated = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry.student) {
      throw new ApiError(400, `Entry at row ${i + 1} is missing a student ID`);
    }

    const studentId = String(entry.student);
    if (seenStudents.has(studentId)) {
      throw new ApiError(400, `Duplicate student entry detected in payload for student ID: ${studentId}`);
    }
    seenStudents.add(studentId);

    const isAbsent = Boolean(entry.isAbsent);
    let marksNum = null;

    if (!isAbsent && entry.marksObtained !== null && entry.marksObtained !== undefined && entry.marksObtained !== '') {
      marksNum = Number(entry.marksObtained);
      if (isNaN(marksNum)) {
        throw new ApiError(400, `Invalid numeric mark for student ${studentId} at row ${i + 1}`);
      }
      if (marksNum < 0) {
        throw new ApiError(400, `Marks cannot be negative (student ${studentId})`);
      }
      if (marksNum > maxMarks) {
        throw new ApiError(400, `Marks (${marksNum}) exceed maximum marks (${maxMarks}) for student ${studentId}`);
      }
    }

    validated.push({
      student: studentId,
      marksObtained: isAbsent ? null : marksNum,
      isAbsent,
      feedback: entry.feedback || '',
    });
  }

  return validated;
}

module.exports = {
  calculateSubjectResult,
  calculateSemesterResult,
  validateMarksPayload,
  GRADE_TABLE,
};

