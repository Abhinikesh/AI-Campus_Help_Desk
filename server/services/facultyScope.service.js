/**
 * server/services/facultyScope.service.js
 * Grounded teaching-scope derivation and authorization service.
 * Enforces fail-closed student access control based on verified Subject and Timetable records.
 */
'use strict';

const Subject = require('../models/Subject');
const Timetable = require('../models/Timetable');

class FacultyScopeService {
  /**
   * Derive the authorized teaching jurisdiction for a faculty member.
   * Looks up actual assigned subjects and timetable slots.
   *
   * @param {string|mongoose.Types.ObjectId} facultyUserId
   * @returns {Promise<{
   *   hasScope: boolean,
   *   branches: string[],
   *   semesters: number[],
   *   subjectIds: mongoose.Types.ObjectId[],
   *   studentQuery: object|null
   * }>}
   */
  async getFacultyTeachingScope(facultyUserId) {
    if (!facultyUserId) {
      return {
        hasScope: false,
        branches: [],
        semesters: [],
        subjectIds: [],
        studentQuery: null,
      };
    }

    const [subjects, timetableSlots] = await Promise.all([
      Subject.find({ faculty: facultyUserId }).lean(),
      Timetable.find({ faculty: facultyUserId }).lean(),
    ]);

    if (subjects.length === 0 && timetableSlots.length === 0) {
      // Fail-closed: faculty has no teaching assignments
      return {
        hasScope: false,
        branches: [],
        semesters: [],
        subjectIds: [],
        studentQuery: null,
      };
    }

    const branchSet = new Set();
    const semesterSet = new Set();
    const subjectIds = subjects.map((s) => s._id);
    const scopeConditions = [];

    // Derive from assigned subjects
    for (const s of subjects) {
      if (s.branch && s.semester) {
        branchSet.add(s.branch);
        semesterSet.add(s.semester);
        scopeConditions.push({ branch: s.branch, semester: s.semester });
      }
    }

    // Derive from timetable slots
    for (const t of timetableSlots) {
      if (t.branch && t.semester) {
        branchSet.add(t.branch);
        semesterSet.add(t.semester);
        const cond = { branch: t.branch, semester: t.semester };
        if (t.section && t.section !== 'All') {
          cond.section = t.section;
        }
        scopeConditions.push(cond);
      }
    }

    if (scopeConditions.length === 0) {
      return {
        hasScope: false,
        branches: [],
        semesters: [],
        subjectIds,
        studentQuery: null,
      };
    }

    // De-duplicate conditions
    const uniqueConds = [];
    const seen = new Set();
    for (const c of scopeConditions) {
      const key = `${c.branch}|${c.semester}|${c.section || 'ANY'}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueConds.push(c);
      }
    }

    const studentQuery = uniqueConds.length === 1 ? uniqueConds[0] : { $or: uniqueConds };

    return {
      hasScope: true,
      branches: Array.from(branchSet),
      semesters: Array.from(semesterSet),
      subjectIds,
      studentQuery,
      scopeConditions: uniqueConds,
    };
  }

  /**
   * Determine whether a specific student falls within the faculty member's teaching scope.
   *
   * @param {object} student
   * @param {object} scope - Output from getFacultyTeachingScope
   * @returns {boolean}
   */
  isStudentInScope(student, scope) {
    if (!student || !scope || !scope.hasScope || !scope.scopeConditions) {
      return false;
    }

    const sBranch = String(student.branch || '').trim();
    const sSem = Number(student.semester);
    const sSec = String(student.section || '').trim();

    return scope.scopeConditions.some((c) => {
      const matchBranch = String(c.branch || '').trim() === sBranch;
      const matchSem = Number(c.semester) === sSem;
      if (!matchBranch || !matchSem) return false;

      // If scope condition is section-specific, verify section match
      if (c.section && c.section !== 'All') {
        return String(c.section).trim() === sSec;
      }
      return true;
    });
  }
}

module.exports = new FacultyScopeService();

