/**
 * server/tests/phase3_4_timetable_schema.test.js
 * Comprehensive Targeted Test Suite for Phase 3.4:
 * Timetable Schema Implementation, Validation, Backward Compatibility & Attendance Gates.
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { verifyTestDatabaseIsolation, TEST_DB_URI } = require('./helpers/testDatabase');
const User = require('../models/User');
const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const Student = require('../models/Student');
const Timetable = require('../models/Timetable');
const TimetableVersion = require('../models/TimetableVersion');
const ConflictRecord = require('../models/ConflictRecord');
const TimetableAnomaly = require('../models/TimetableAnomaly');
const TimetableStaging = require('../models/TimetableStaging');
const AttendanceSession = require('../models/AttendanceSession');
const attendanceController = require('../controllers/attendance.controller');
const {
  buildCanonicalScopeKey,
  parseCanonicalScopeKey,
  validateScopeKey,
  sanitizeToken,
} = require('../utils/scopeKey.util');

function createMockRes() {
  return {
    statusCode: 200,
    jsonData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    },
  };
}

test('Phase 3.4: Timetable Schema Implementation & Attendance Gate Suite', async (t) => {
  let faculty1User, faculty2User, subject1, testStudent;

  await t.test('Setup: Connect & initialize fixtures in isolated test DB', async () => {
    verifyTestDatabaseIsolation(TEST_DB_URI);
    await mongoose.connect(TEST_DB_URI);

    // Drop stale test index in isolated test DB if present
    await Timetable.collection.dropIndex('idx_timetable_multi_faculty_conflict').catch(() => {});

    // Initialize indexes for schema models in test database
    await Promise.all([
      Timetable.init(),
      TimetableVersion.init(),
      ConflictRecord.init(),
      TimetableAnomaly.init(),
      TimetableStaging.init(),
    ]);

    // Clean only test collections
    await Promise.all([
      User.deleteMany({ email: /@phase34-test\.edu$/ }),
      Faculty.deleteMany({ employeeId: /^P34-/ }),
      Subject.deleteMany({ code: /^P34-/ }),
      Student.deleteMany({ rollNumber: /^P34-/ }),
      Timetable.deleteMany({ academicYear: '2026-2027', section: { $in: ['P34A', 'P34B', 'P34C', 'P34D'] } }),
      TimetableVersion.deleteMany({ academicYear: '2026-2027', section: { $in: ['P34A', 'P34B', 'P34C', 'P34D'] } }),
      ConflictRecord.deleteMany({ academicYear: '2026-2027' }),
      TimetableAnomaly.deleteMany({ sourceCohort: /^P34-/ }),
      TimetableStaging.deleteMany({ importBatchId: /^P34-/ }),
      AttendanceSession.deleteMany({ academicYear: '2026-2027', section: { $in: ['P34A', 'P34B', 'P34C', 'P34D'] } }),
    ]);

    // Create Faculty 1
    faculty1User = await User.create({
      name: 'Dr. Aarav Patel',
      email: 'aarav.patel@phase34-test.edu',
      loginId: 'P34FAC01',
      passwordHash: 'hashed_pw',
      isVerified: true,
      active: true,
      role: 'faculty',
    });
    await Faculty.create({
      user: faculty1User._id,
      employeeId: 'P34-FAC-001',
      department: 'CSE',
      designation: 'Associate Professor',
    });

    // Create Faculty 2
    faculty2User = await User.create({
      name: 'Prof. Neha Gupta',
      email: 'neha.gupta@phase34-test.edu',
      loginId: 'P34FAC02',
      passwordHash: 'hashed_pw',
      isVerified: true,
      active: true,
      role: 'faculty',
    });
    await Faculty.create({
      user: faculty2User._id,
      employeeId: 'P34-FAC-002',
      department: 'CSE',
      designation: 'Assistant Professor',
    });

    // Create Subject
    subject1 = await Subject.create({
      name: 'Data Structures & Algorithms',
      code: 'P34-CS501',
      department: 'CSE',
      semester: 5,
      credits: 4,
      faculty: faculty1User._id,
    });

    // Create Student fixture
    const studentUser = await User.create({
      name: 'Test Student P34',
      email: 'student.p34@phase34-test.edu',
      loginId: 'P34STU01',
      passwordHash: 'hashed_pw',
      isVerified: true,
      active: true,
      role: 'student',
    });
    testStudent = await Student.create({
      user: studentUser._id,
      fullName: 'Test Student P34',
      rollNumber: 'P34-CSE-001',
      branch: 'CSE',
      semester: 5,
      section: 'P34A',
      academicYear: '2026-2027',
    });
  });

  // ── 1. New Timetable Schema Validation ──────────────────────────────────────
  await t.test('1. New timetable schema validation creates complete canonical entry', async () => {
    const entry = new Timetable({
      academicYear: '2026-2027',
      program: 'B.Tech',
      department: 'CSE',
      departmentCode: 'CSE',
      branch: 'CSE',
      specialization: 'AIML',
      semester: 5,
      section: 'P34A',
      dayOfWeek: 1,
      period: 2,
      periodNumbers: [2],
      slotSpan: 1,
      startTime: '09:00',
      endTime: '09:50',
      room: 'AS18',
      subject: subject1._id,
      subjectAcronym: 'DSA',
      subjectName: 'Data Structures & Algorithms',
      faculty: faculty1User._id,
      instructors: [faculty1User._id],
      instructorAbbreviations: ['AP'],
      batch: 'All',
      sourcePage: 12,
      sourceCohortName: '5 CSE-AIML-A',
      sourceCellText: 'DSA AS18 AP',
      extractionHash: 'hash_test_1',
    });

    await entry.validate();
    const saved = await entry.save();

    assert.ok(saved._id);
    assert.equal(saved.academicYear, '2026-2027');
    assert.equal(saved.program, 'B.Tech');
    assert.equal(saved.specialization, 'AIML');
    assert.equal(saved.dayName, 'Monday');
    assert.equal(saved.durationMinutes, 50);
    assert.equal(saved.isSubjectResolved, true);
    assert.equal(saved.subjectResolutionStatus, 'RESOLVED');
    assert.equal(saved.isFacultyResolved, true);
    assert.equal(saved.facultyResolutionStatus, 'RESOLVED');
    assert.equal(saved.cohortIdentifier, 'B.Tech 5 CSE-AIML-P34A');
    assert.equal(saved.scopeKey, 'AY=2026-2027|PRG=B.TECH|DPT=CSE|BRN=CSE|SPC=AIML|SEM=5|SEC=P34A');
  });

  // ── 2. Legacy Timetable Record Compatibility ───────────────────────────────
  await t.test('2. Legacy timetable record compatibility preserves legacy fields and populates defaults', async () => {
    const legacyEntry = new Timetable({
      subject: subject1._id,
      faculty: faculty1User._id,
      academicYear: '2026-2027',
      department: 'CSE',
      branch: 'CSE',
      semester: 5,
      section: 'P34B',
      dayOfWeek: 2,
      period: 1,
      startTime: '08:10',
      endTime: '09:00',
      room: 'Hall 101',
    });

    await legacyEntry.validate();
    const saved = await legacyEntry.save();

    assert.ok(saved._id);
    assert.equal(saved.program, 'B.Tech'); // Default
    assert.equal(saved.specialization, 'Core'); // Default
    assert.equal(saved.batch, 'All'); // Default
    assert.equal(saved.dayName, 'Tuesday'); // Auto-synchronized
    assert.deepEqual(saved.periodNumbers, [1]); // Auto-populated array
    assert.equal(saved.slotSpan, 1);
    assert.deepEqual(saved.instructors, [faculty1User._id]); // Synchronized from scalar
    assert.equal(saved.isSubgroup, false);
    assert.equal(saved.scopeKey, 'AY=2026-2027|PRG=B.TECH|DPT=CSE|BRN=CSE|SPC=CORE|SEM=5|SEC=P34B');
  });

  // ── 3. Multiple Instructors ────────────────────────────────────────────────
  await t.test('3. Multiple instructors co-teaching array persists correctly', async () => {
    const multiTeacherEntry = new Timetable({
      academicYear: '2026-2027',
      department: 'CSE',
      semester: 5,
      section: 'P34A',
      dayOfWeek: 3,
      period: 3,
      startTime: '10:00',
      endTime: '10:50',
      room: 'Lab 2',
      instructors: [faculty1User._id, faculty2User._id],
      instructorAbbreviations: ['AP', 'NG'],
    });

    await multiTeacherEntry.validate();
    const saved = await multiTeacherEntry.save();

    assert.equal(saved.instructors.length, 2);
    assert.equal(saved.instructors[0].toString(), faculty1User._id.toString());
    assert.equal(saved.instructors[1].toString(), faculty2User._id.toString());
    assert.deepEqual(saved.instructorAbbreviations, ['AP', 'NG']);
    assert.equal(saved.faculty.toString(), faculty1User._id.toString()); // Primary synced
  });

  // ── 4. Primary Instructor Synchronization ──────────────────────────────────
  await t.test('4. Primary instructor scalar synchronizes with instructors[0]', async () => {
    const entry = new Timetable({
      academicYear: '2026-2027',
      department: 'CSE',
      semester: 5,
      section: 'P34A',
      dayOfWeek: 4,
      period: 4,
      startTime: '11:00',
      endTime: '11:50',
      room: 'AS10',
      faculty: faculty2User._id,
    });

    await entry.validate();
    assert.equal(entry.instructors.length, 1);
    assert.equal(entry.instructors[0].toString(), faculty2User._id.toString());
  });

  // ── 5. Unresolved Faculty Handling ─────────────────────────────────────────
  await t.test('5. Unresolved faculty retains source abbreviation and zero synthetic ObjectId', async () => {
    const unresolvedEntry = new Timetable({
      academicYear: '2026-2027',
      department: 'CSE',
      semester: 5,
      section: 'P34C',
      dayOfWeek: 3,
      period: 8,
      startTime: '14:00',
      endTime: '14:50',
      room: 'AS18',
      faculty: null,
      instructors: [],
      instructorAbbreviations: ['SJ'],
      unresolvedFacultyAbbreviations: ['SJ'],
    });

    await unresolvedEntry.validate();
    const saved = await unresolvedEntry.save();

    assert.equal(saved.faculty, null);
    assert.deepEqual(saved.instructors, []);
    assert.deepEqual(saved.unresolvedFacultyAbbreviations, ['SJ']);
    assert.equal(saved.isFacultyResolved, false);
    assert.equal(saved.facultyResolutionStatus, 'UNRESOLVED');
  });

  // ── 6. Resolved and Unresolved Subjects ────────────────────────────────────
  await t.test('6. Resolved subject sets resolution status to RESOLVED', async () => {
    const resolvedEntry = new Timetable({
      academicYear: '2026-2027',
      department: 'CSE',
      semester: 5,
      section: 'P34A',
      dayOfWeek: 1,
      period: 1,
      startTime: '08:10',
      endTime: '09:00',
      room: 'Hall 3',
      subject: subject1._id,
      subjectAcronym: 'DSA',
    });

    await resolvedEntry.validate();
    assert.equal(resolvedEntry.isSubjectResolved, true);
    assert.equal(resolvedEntry.subjectResolutionStatus, 'RESOLVED');
  });

  // ── 7. Nullable Subject Reference Behavior ─────────────────────────────────
  await t.test('7. Nullable subject stores acronym without synthetic Subject ObjectId', async () => {
    const unmappedEntry = new Timetable({
      academicYear: '2026-2027',
      department: 'CSE',
      semester: 5,
      section: 'P34A',
      dayOfWeek: 2,
      period: 2,
      startTime: '09:00',
      endTime: '09:50',
      room: 'Hall 4',
      subject: null,
      subjectAcronym: 'WPPH',
      unresolvedSubjectCode: 'WPPH',
    });

    await unmappedEntry.validate();
    const saved = await unmappedEntry.save();

    assert.equal(saved.subject, null);
    assert.equal(saved.subjectAcronym, 'WPPH');
    assert.equal(saved.unresolvedSubjectCode, 'WPPH');
    assert.equal(saved.isSubjectResolved, false);
    assert.equal(saved.subjectResolutionStatus, 'UNRESOLVED');
  });

  // ── 8. Batch and Source-Group Preservation ─────────────────────────────────
  await t.test('8. Batch and source-group preservation marks isSubgroup accurately', async () => {
    const subgroupEntry = new Timetable({
      academicYear: '2026-2027',
      department: 'CSE',
      semester: 5,
      section: 'P34C',
      dayOfWeek: 3,
      period: 7,
      startTime: '13:10',
      endTime: '14:00',
      room: 'AS19',
      batch: '5CSE-C2',
      sourceGroupLabel: '5CSE-C2',
    });

    await subgroupEntry.validate();
    assert.equal(subgroupEntry.batch, '5CSE-C2');
    assert.equal(subgroupEntry.sourceGroupLabel, '5CSE-C2');
    assert.equal(subgroupEntry.isSubgroup, true);

    const wholeClassEntry = new Timetable({
      academicYear: '2026-2027',
      department: 'CSE',
      semester: 5,
      section: 'P34C',
      dayOfWeek: 3,
      period: 1,
      startTime: '08:10',
      endTime: '09:00',
      room: 'AS19',
      batch: 'All',
    });
    await wholeClassEntry.validate();
    assert.equal(wholeClassEntry.isSubgroup, false);
  });

  // ── 9. Single-Period Sessions ──────────────────────────────────────────────
  await t.test('9. Single-period session computes duration and period span', async () => {
    const single = new Timetable({
      academicYear: '2026-2027',
      department: 'CSE',
      semester: 5,
      section: 'P34A',
      dayOfWeek: 5,
      period: 5,
      startTime: '12:00',
      endTime: '12:50',
      room: 'Hall 5',
    });

    await single.validate();
    assert.deepEqual(single.periodNumbers, [5]);
    assert.equal(single.slotSpan, 1);
    assert.equal(single.durationMinutes, 50);
    assert.equal(single.isDoublePeriod, false);
  });

  // ── 10. Double-Period Contiguity ───────────────────────────────────────────
  await t.test('10. Double-period contiguous session computes 100min and isDoublePeriod virtual', async () => {
    const labSession = new Timetable({
      academicYear: '2026-2027',
      department: 'CSE',
      semester: 5,
      section: 'P34A',
      dayOfWeek: 4,
      periodNumbers: [7, 8],
      startTime: '13:10',
      endTime: '14:50',
      room: 'CL01',
      sessionType: 'Lab',
    });

    await labSession.validate();
    assert.equal(labSession.period, 7);
    assert.equal(labSession.slotSpan, 2);
    assert.equal(labSession.durationMinutes, 100);
    assert.equal(labSession.isDoublePeriod, true);
  });

  // ── 11. Invalid Period Boundaries ──────────────────────────────────────────
  await t.test('11. Non-contiguous or invalid period arrays are rejected by schema validator', async () => {
    // Non-contiguous [1, 3]
    const nonContiguous = new Timetable({
      academicYear: '2026-2027',
      department: 'CSE',
      semester: 5,
      section: 'P34A',
      dayOfWeek: 1,
      periodNumbers: [1, 3],
      startTime: '08:10',
      endTime: '10:00',
      room: 'Hall 1',
    });

    await assert.rejects(
      async () => {
        await nonContiguous.validate();
      },
      /periodNumbers must be a non-empty array of contiguous integer periods/
    );

    // Out of range [10, 11]
    const outOfRange = new Timetable({
      academicYear: '2026-2027',
      department: 'CSE',
      semester: 5,
      section: 'P34A',
      dayOfWeek: 1,
      periodNumbers: [10, 11],
      startTime: '15:40',
      endTime: '17:20',
      room: 'Hall 1',
    });

    await assert.rejects(
      async () => {
        await outOfRange.validate();
      },
      /periodNumbers must be a non-empty array of contiguous integer periods/
    );
  });

  // ── 12. Canonical scopeKey Determinism ─────────────────────────────────────
  await t.test('12. Canonical scopeKey is deterministic and case/trim normalized', () => {
    const key1 = buildCanonicalScopeKey({
      academicYear: ' 2026-2027 ',
      program: 'b.tech',
      departmentCode: 'cse',
      branch: 'cse',
      specialization: 'core',
      semester: 5,
      section: 'a',
    });

    const key2 = buildCanonicalScopeKey({
      academicYear: '2026-2027',
      program: 'B.Tech',
      departmentCode: 'CSE',
      branch: 'CSE',
      specialization: 'Core',
      semester: '5',
      section: 'A',
    });

    assert.equal(key1, key2);
    assert.equal(key1, 'AY=2026-2027|PRG=B.TECH|DPT=CSE|BRN=CSE|SPC=CORE|SEM=5|SEC=A');

    const parsed = parseCanonicalScopeKey(key1);
    assert.equal(parsed.academicYear, '2026-2027');
    assert.equal(parsed.program, 'B.TECH');
    assert.equal(parsed.departmentCode, 'CSE');
    assert.equal(parsed.branch, 'CSE');
    assert.equal(parsed.specialization, 'CORE');
    assert.equal(parsed.semester, 5);
    assert.equal(parsed.section, 'A');
  });

  // ── 13. scopeKey Collision Resistance ──────────────────────────────────────
  await t.test('13. scopeKey collision resistance prevents delimiter injection', () => {
    // Attempting delimiter injection with pipes and equals
    const injectionToken = sanitizeToken('CORE|SEC=B', 'DEFAULT');
    assert.equal(injectionToken, 'CORE_SEC_B');

    const keyWithSpecialization = buildCanonicalScopeKey({
      academicYear: '2026-2027',
      program: 'B.Tech',
      departmentCode: 'CSE',
      branch: 'CSE',
      specialization: 'AIML',
      semester: 5,
      section: 'A',
    });

    const keyCore = buildCanonicalScopeKey({
      academicYear: '2026-2027',
      program: 'B.Tech',
      departmentCode: 'CSE',
      branch: 'CSE',
      specialization: 'Core',
      semester: 5,
      section: 'A',
    });

    // Must be distinct
    assert.notEqual(keyWithSpecialization, keyCore);
    assert.ok(keyWithSpecialization.includes('SPC=AIML'));
    assert.ok(keyCore.includes('SPC=CORE'));
  });

  // ── 14. Missing and Invalid Cohort Dimensions ──────────────────────────────
  await t.test('14. Missing or invalid cohort dimensions are handled or rejected', async () => {
    // Missing academicYear
    const invalidEntry = new Timetable({
      academicYear: '',
      department: 'CSE',
      semester: 5,
      section: 'P34A',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '09:50',
    });

    await assert.rejects(
      async () => {
        await invalidEntry.validate();
      },
      /Path `academicYear` is required/
    );

    // Invalid semester
    const invalidSemEntry = new Timetable({
      academicYear: '2026-2027',
      department: 'CSE',
      semester: 15,
      section: 'P34A',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '09:50',
    });

    await assert.rejects(
      async () => {
        await invalidSemEntry.validate();
      },
      /maximum allowed value|cannot exceed/
    );
  });

  // ── 15. Timetable Version Uniqueness Constraints ───────────────────────────
  await t.test('15. TimetableVersion enforces uniqueness on { scopeKey, versionNumber } and immutability', async () => {
    const v1 = new TimetableVersion({
      academicYear: '2026-2027',
      program: 'B.Tech',
      department: 'CSE',
      departmentCode: 'CSE',
      branch: 'CSE',
      specialization: 'Core',
      semester: 5,
      section: 'P34D',
      versionNumber: 1,
      status: 'draft',
      notes: 'Initial test version',
    });

    await v1.save();
    assert.ok(v1._id);
    assert.equal(v1.scopeKey, 'AY=2026-2027|PRG=B.TECH|DPT=CSE|BRN=CSE|SPC=CORE|SEM=5|SEC=P34D');

    // Attempting to mutate cohort dimensions after creation is blocked
    v1.semester = 6;
    await assert.rejects(
      async () => {
        await v1.save();
      },
      /Version cohort identity is immutable/
    );

    // Duplicate version for same scopeKey and versionNumber
    const vDuplicate = new TimetableVersion({
      academicYear: '2026-2027',
      program: 'B.Tech',
      department: 'CSE',
      departmentCode: 'CSE',
      branch: 'CSE',
      specialization: 'Core',
      semester: 5,
      section: 'P34D',
      versionNumber: 1,
      status: 'draft',
    });

    await assert.rejects(
      async () => {
        await vDuplicate.save();
      },
      (err) => err.code === 11000 || /duplicate key/i.test(err.message)
    );
  });

  // ── 16. Conflict Evidence Validation ───────────────────────────────────────
  await t.test('16. ConflictRecord persists evidence details and publication blocker status', async () => {
    const conflict = new ConflictRecord({
      conflictCode: 'ROOM_DOUBLE_BOOKED',
      severity: 'BLOCKER',
      academicYear: '2026-2027',
      dayOfWeek: 'Monday',
      periodNumbers: [2],
      timeWindow: { startTime: '09:00', endTime: '09:50' },
      resourceType: 'ROOM',
      resourceId: 'AS18',
      description: 'Room AS18 occupied by 5 CSE-A and 5 CSE-B concurrently without joint session evidence.',
      evidenceType: 'NONE',
      verificationStatus: 'UNVERIFIED',
      resolutionStatus: 'OPEN',
    });

    await conflict.validate();
    const saved = await conflict.save();

    assert.ok(saved._id);
    assert.equal(saved.isPublicationBlocker(), true);

    // Resolving conflict clears blocker status
    saved.resolutionStatus = 'ACCEPTED_OVERRIDE';
    saved.resolutionJustification = 'Administrative override authorized by HOD.';
    await saved.save();
    assert.equal(saved.isPublicationBlocker(), false);
  });

  // ── 17. Unverified Joint-Session Rejection ──────────────────────────────────
  await t.test('17. Unverified joint-session remains a blocker conflict', async () => {
    const unverifiedConflict = new ConflictRecord({
      conflictCode: 'FACULTY_DOUBLE_BOOKED',
      severity: 'BLOCKER',
      academicYear: '2026-2027',
      dayOfWeek: 'Tuesday',
      periodNumbers: [3],
      resourceType: 'FACULTY',
      resourceId: 'RS',
      description: 'Prof. Ramesh Sharma scheduled across Hall 101 and Hall 102 concurrently.',
      evidenceType: 'NONE',
      verificationStatus: 'UNVERIFIED',
      resolutionStatus: 'OPEN',
    });

    await unverifiedConflict.save();
    assert.equal(unverifiedConflict.isPublicationBlocker(), true);
    assert.equal(unverifiedConflict.verificationStatus, 'UNVERIFIED');
  });

  // ── 18. SJ Unresolved Conflict Representation ──────────────────────────────
  await t.test('18. SJ static helper produces data-backed Wednesday P8 publication blocker', async () => {
    const sjRecord = ConflictRecord.createSJConflictRecord({ academicYear: '2026-2027' });

    assert.equal(sjRecord.conflictCode, 'POTENTIAL_FACULTY_CONFLICT');
    assert.equal(sjRecord.severity, 'BLOCKER');
    assert.equal(sjRecord.resourceId, 'SJ');
    assert.equal(sjRecord.dayOfWeek, 'Wednesday');
    assert.deepEqual(sjRecord.periodNumbers, [8]);
    assert.equal(sjRecord.conflictingEntries.length, 2);

    // Page 12 5 CSE-B AICA AS18
    assert.equal(sjRecord.conflictingEntries[0].sourcePage, 12);
    assert.equal(sjRecord.conflictingEntries[0].cohort, '5 CSE-B');
    assert.equal(sjRecord.conflictingEntries[0].subjectAcronym, 'AICA');
    assert.equal(sjRecord.conflictingEntries[0].room, 'AS18');

    // Page 13 5 CSE-C2 FLAT AS19
    assert.equal(sjRecord.conflictingEntries[1].sourcePage, 13);
    assert.equal(sjRecord.conflictingEntries[1].cohort, '5 CSE-C2');
    assert.equal(sjRecord.conflictingEntries[1].subjectAcronym, 'FLAT');
    assert.equal(sjRecord.conflictingEntries[1].room, 'AS19');

    assert.equal(sjRecord.isPublicationBlocker(), true);

    const saved = await sjRecord.save();
    assert.ok(saved._id);
    assert.equal(saved.isPublicationBlocker(), true);
  });

  // ── 19. Attendance-Session Compatibility ───────────────────────────────────
  await t.test('19. Fully resolved timetable entry successfully links to AttendanceSession', async () => {
    // Create fully resolved timetable entry
    const resolvedEntry = await Timetable.create({
      subject: subject1._id,
      faculty: faculty1User._id,
      academicYear: '2026-2027',
      department: 'CSE',
      branch: 'CSE',
      semester: 5,
      section: 'P34A',
      dayOfWeek: 1,
      period: 1,
      startTime: '08:10',
      endTime: '09:00',
      room: 'AS18',
    });

    const session = new AttendanceSession({
      subject: subject1._id,
      faculty: faculty1User._id,
      date: '2026-11-23',
      period: 1,
      startTime: '08:10',
      endTime: '09:00',
      branch: 'CSE',
      semester: 5,
      section: 'P34A',
      academicYear: '2026-2027',
      timetableEntry: resolvedEntry._id,
    });

    const savedSession = await session.save();
    assert.ok(savedSession._id);
    assert.equal(savedSession.timetableEntry.toString(), resolvedEntry._id.toString());
  });

  // ── 20. Attendance Blocking for Unresolved Resources ───────────────────────
  await t.test('20. Unresolved timetable entry is blocked from AttendanceSession creation', async () => {
    // Create unmapped entry (subject: null)
    const unmappedEntry = await Timetable.create({
      subject: null,
      subjectAcronym: 'WPPH',
      faculty: faculty1User._id,
      academicYear: '2026-2027',
      department: 'CSE',
      branch: 'CSE',
      semester: 5,
      section: 'P34A',
      dayOfWeek: 2,
      period: 2,
      startTime: '09:00',
      endTime: '09:50',
      room: 'Hall 4',
    });

    // 1. Model-level rejection
    const invalidSession = new AttendanceSession({
      subject: subject1._id,
      faculty: faculty1User._id,
      date: '2026-11-24',
      period: 2,
      startTime: '09:00',
      endTime: '09:50',
      branch: 'CSE',
      semester: 5,
      section: 'P34A',
      academicYear: '2026-2027',
      timetableEntry: unmappedEntry._id,
    });

    await assert.rejects(
      async () => {
        await invalidSession.save();
      },
      /ATTENDANCE_NOT_CONFIGURED: Timetable entry has an unresolved subject/
    );

    // 2. Controller-level rejection (HTTP 422)
    const req = {
      user: { userId: faculty1User._id, role: 'faculty' },
      body: {
        subjectId: subject1._id,
        date: '2026-11-25',
        period: 2,
        startTime: '09:00 AM',
        endTime: '10:00 AM',
        branch: 'CSE',
        semester: 5,
        section: 'P34A',
        timetableEntry: unmappedEntry._id,
      },
    };
    const res = createMockRes();

    await assert.rejects(
      async () => {
        await attendanceController.createSession(req, res);
      },
      (err) => err.statusCode === 422 && /unresolved subject/i.test(err.message)
    );
  });

  // ── Supporting Model Integrity ─────────────────────────────────────────────
  await t.test('Supporting Models: TimetableAnomaly and TimetableStaging schemas validate properly', async () => {
    const anomaly = new TimetableAnomaly({
      anomalyType: 'TOKEN_SPLIT_ANOMALY',
      sourcePage: 14,
      sourceCohort: 'P34-COHORT',
      dayOfWeek: 'Monday',
      periodNumber: 3,
      rawCellText: 'DSA (LAB) AS18 AP',
      parsedRepresentation: { token: 'DSA (LAB)' },
      resolutionStrategy: 'AUTOMATIC_REGEX_RULE',
      status: 'IDENTIFIED',
    });
    const savedAnomaly = await anomaly.save();
    assert.ok(savedAnomaly._id);
    assert.equal(savedAnomaly.anomalyType, 'TOKEN_SPLIT_ANOMALY');

    const staging = new TimetableStaging({
      importBatchId: 'P34-BATCH-001',
      sourceDocument: {
        fileName: 'classWise-TT-21_OCT_2026.pdf',
        fileChecksumSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        totalPages: 50,
      },
      extractedEntry: {
        sourcePage: 12,
        sourceCohortName: '5 CSE-B',
        dayOfWeek: 'Wednesday',
        periodNumber: 8,
        slotSpan: 1,
        periodNumbers: [8],
        rawSubjectAcronym: 'AICA',
        rawFacultyAbbreviations: ['SJ'],
        rawRoom: 'AS18',
        sourceCellText: 'AICA AS18 SJ',
        extractionHash: 'p34_hash_1',
      },
      stagingStatus: 'staged',
    });
    const savedStaging = await staging.save();
    assert.ok(savedStaging._id);
    assert.equal(savedStaging.stagingStatus, 'staged');
  });

  // ── Teardown ───────────────────────────────────────────────────────────────
  await t.test('Teardown: Disconnect test database cleanly', async () => {
    // Cleanup created test records
    await Promise.all([
      User.deleteMany({ email: /@phase34-test\.edu$/ }),
      Faculty.deleteMany({ employeeId: /^P34-/ }),
      Subject.deleteMany({ code: /^P34-/ }),
      Student.deleteMany({ rollNumber: /^P34-/ }),
      Timetable.deleteMany({ academicYear: '2026-2027', section: { $in: ['P34A', 'P34B', 'P34C', 'P34D'] } }),
      TimetableVersion.deleteMany({ academicYear: '2026-2027', section: { $in: ['P34A', 'P34B', 'P34C', 'P34D'] } }),
      ConflictRecord.deleteMany({ academicYear: '2026-2027' }),
      TimetableAnomaly.deleteMany({ sourceCohort: /^P34-/ }),
      TimetableStaging.deleteMany({ importBatchId: /^P34-/ }),
      AttendanceSession.deleteMany({ academicYear: '2026-2027', section: { $in: ['P34A', 'P34B', 'P34C', 'P34D'] } }),
    ]);

    await mongoose.disconnect();
    assert.equal(mongoose.connection.readyState, 0);
  });
});
