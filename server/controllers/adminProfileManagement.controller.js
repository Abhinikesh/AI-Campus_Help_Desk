/**
 * server/controllers/adminProfileManagement.controller.js
 * Comprehensive Profile Management Controller for Enrolled Students and Faculty.
 * Supports viewing complete permitted profiles, editing permitted fields, filling missing info,
 * enforcing immutable institutional identifiers and roles, strict validation, and non-repudiable audit trails.
 */
'use strict';

const mongoose = require('mongoose');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const Attendance = require('../models/Attendance');
const FaceEmbedding = require('../models/FaceEmbedding');
const Fee = require('../models/Fee');
const FeeInvoice = require('../models/FeeInvoice');
const Mark = require('../models/Mark');
const Complaint = require('../models/Complaint');
const Submission = require('../models/Submission');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// ── Validation & Normalization Helpers ─────────────────────────

const normalizePhone = (phone) => {
  if (phone == null || phone === '') return null;
  const str = String(phone).trim();
  if (!str) return null;
  const clean = str.replace(/[^\d+]/g, '');
  const digitsOnly = clean.replace(/\D/g, '');
  if (digitsOnly.length < 10 || digitsOnly.length > 15) {
    throw new ApiError(400, 'Invalid phone number format. Must contain 10 to 15 digits.');
  }
  return clean;
};

const validateEmail = (email) => {
  if (email == null || email === '') return null;
  const str = String(email).trim().toLowerCase();
  if (!str) return null;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(str)) {
    throw new ApiError(400, 'Invalid email address format.');
  }
  return str;
};

// ══════════════════════════════════════════════════════════════
// 1. ADMIN STUDENT PROFILE MANAGEMENT
// ══════════════════════════════════════════════════════════════

// GET /api/admin/students — List & search canonical enrolled students
const listCanonicalStudents = asyncHandler(async (req, res) => {
  const { search, branch, semester, status, page = 1, limit = 20 } = req.query;

  const andConditions = [];

  if (branch) {
    const bRegex = new RegExp(String(branch).trim(), 'i');
    andConditions.push({
      $or: [
        { branch: bRegex },
        { course: bRegex },
      ],
    });
  }
  if (semester) andConditions.push({ semester: Number(semester) });
  if (status) andConditions.push({ status: String(status).trim().toLowerCase() });

  const queryStr = typeof search === 'string' ? search.trim() : '';
  if (queryStr) {
    const escaped = queryStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    andConditions.push({
      $or: [
        { rollNumber: regex },
        { fullName: regex },
        { phone: regex },
        { email: regex },
        { school: regex },
        { course: regex },
        { branch: regex },
        { batch: regex },
        { section: regex },
      ],
    });
  }

  const filter = andConditions.length === 0 ? {} : (andConditions.length === 1 ? andConditions[0] : { $and: andConditions });

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [students, total] = await Promise.all([
    Student.find(filter)
      .select('rollNumber fullName email phone branch program course school batch year semester section admissionYear status createdAt')
      .populate('user', 'name email loginId isActive')
      .sort({ rollNumber: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Student.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    data: students,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 0,
      pages: Math.ceil(total / limitNum) || 0,
    },
    message: 'Students retrieved successfully',
  });
});

// GET /api/admin/students/:id — Retrieve full permitted student profile with audit history
const getCanonicalStudentDetail = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid student identifier format');
  }

  const student = await Student.findById(id)
    .populate('user', 'name email loginId isActive role')
    .lean();

  if (!student) {
    throw new ApiError(404, 'Student record not found');
  }

  // Fetch recent profile audit history for this student
  const auditHistory = await AuditLog.find({
    entityType: 'Student',
    entityId: student._id,
  })
    .populate('actor', 'name email role')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  return res.status(200).json({
    success: true,
    data: {
      student,
      auditHistory,
    },
    message: 'Student profile loaded successfully',
  });
});

// PATCH /api/admin/students/:id — Edit permitted fields and fill missing info
const updateCanonicalStudentProfile = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const adminUserId = req.user.userId;

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid student identifier format');
  }

  const student = await Student.findById(id);
  if (!student) {
    throw new ApiError(404, 'Student record not found');
  }

  const body = req.body || {};

  // 1. Enforce protection of immutable institutional identifiers and status
  if (body.rollNumber !== undefined && String(body.rollNumber).trim().toUpperCase() !== student.rollNumber) {
    throw new ApiError(400, 'Roll number is an immutable institutional identifier and cannot be modified.');
  }

  if (body.status !== undefined && body.status !== student.status) {
    throw new ApiError(400, 'Enrollment verification and promotion status cannot be modified via profile editing.');
  }

  if (body.user !== undefined || body._id !== undefined) {
    throw new ApiError(400, 'System references and internal bindings cannot be modified.');
  }

  const updatedFields = [];

  // 2. Validate and apply permitted field updates
  if (body.fullName !== undefined) {
    const name = String(body.fullName).trim();
    if (!name || name.length < 2) {
      throw new ApiError(400, 'Full name must contain at least 2 characters.');
    }
    if (name !== student.fullName) {
      student.fullName = name;
      updatedFields.push('fullName');
    }
  }

  if (body.email !== undefined) {
    const validatedEmail = validateEmail(body.email);
    if (validatedEmail !== (student.email || null)) {
      if (validatedEmail) {
        // Ensure no other student already uses this email
        const conflict = await Student.findOne({
          email: validatedEmail,
          _id: { $ne: student._id },
        }).lean();
        if (conflict) {
          throw new ApiError(409, 'Email address is already in use by another student.');
        }

        // Prevent accidental email synchronization conflict to an unrelated User
        if (student.user) {
          const userConflict = await User.findOne({
            email: validatedEmail,
            _id: { $ne: student.user },
          }).lean();
          if (userConflict) {
            throw new ApiError(409, 'Email address is already in use by another user account.');
          }
        }
      }
      student.email = validatedEmail;
      updatedFields.push('email');
    }
  }

  if (body.phone !== undefined) {
    const normalizedPhone = normalizePhone(body.phone);
    if (normalizedPhone !== (student.phone || null)) {
      student.phone = normalizedPhone;
      updatedFields.push('phone');
    }
  }

  if (body.branch !== undefined) {
    const val = body.branch ? String(body.branch).trim() : null;
    if (val !== (student.branch || null)) {
      student.branch = val;
      updatedFields.push('branch');
    }
  }

  if (body.program !== undefined) {
    const val = body.program ? String(body.program).trim() : null;
    if (val !== (student.program || null)) {
      student.program = val;
      updatedFields.push('program');
    }
  }

  if (body.semester !== undefined) {
    const val = body.semester !== null && body.semester !== '' ? Number(body.semester) : null;
    if (val !== null && (isNaN(val) || !Number.isInteger(val) || val < 1 || val > 10)) {
      throw new ApiError(400, 'Semester must be a valid number between 1 and 10.');
    }
    if (val !== (student.semester != null ? student.semester : null)) {
      student.semester = val;
      updatedFields.push('semester');
    }
  }

  if (body.section !== undefined) {
    const val = body.section ? String(body.section).trim() : null;
    if (val !== (student.section || null)) {
      student.section = val;
      updatedFields.push('section');
    }
  }

  if (body.admissionYear !== undefined) {
    const val = body.admissionYear !== null && body.admissionYear !== '' ? Number(body.admissionYear) : null;
    if (val !== null && (isNaN(val) || val < 1990 || val > 2050)) {
      throw new ApiError(400, 'Admission year must be between 1990 and 2050.');
    }
    if (val !== (student.admissionYear != null ? student.admissionYear : null)) {
      student.admissionYear = val;
      updatedFields.push('admissionYear');
    }
  }

  if (body.school !== undefined) {
    const val = body.school ? String(body.school).trim() : null;
    if (val !== (student.school || null)) {
      student.school = val;
      updatedFields.push('school');
    }
  }

  if (body.course !== undefined) {
    const val = body.course ? String(body.course).trim() : null;
    if (val !== (student.course || null)) {
      student.course = val;
      updatedFields.push('course');
    }
  }

  if (body.batch !== undefined) {
    const val = body.batch ? String(body.batch).trim() : null;
    if (val !== (student.batch || null)) {
      student.batch = val;
      updatedFields.push('batch');
    }
  }

  if (body.year !== undefined) {
    const val = body.year ? String(body.year).trim() : null;
    if (val !== (student.year || null)) {
      student.year = val;
      updatedFields.push('year');
    }
  }

  if (body.gender !== undefined) {
    const val = String(body.gender || '').trim().toLowerCase();
    if (!['male', 'female', 'other', ''].includes(val)) {
      throw new ApiError(400, 'Gender must be male, female, other, or empty.');
    }
    if (val !== (student.gender || '')) {
      student.gender = val;
      updatedFields.push('gender');
    }
  }

  if (body.dateOfBirth !== undefined) {
    const val = body.dateOfBirth ? new Date(body.dateOfBirth) : null;
    if (val && isNaN(val.getTime())) {
      throw new ApiError(400, 'Invalid date of birth format.');
    }
    student.dateOfBirth = val;
    updatedFields.push('dateOfBirth');
  }

  // 3. Save changes if any fields updated
  if (updatedFields.length > 0) {
    await student.save();

    // Synchronize linked User document if name or email changed
    if (student.user) {
      const userUpdates = {};
      if (updatedFields.includes('fullName')) userUpdates.name = student.fullName;
      if (updatedFields.includes('email') && student.email) userUpdates.email = student.email;
      if (Object.keys(userUpdates).length > 0) {
        await User.findByIdAndUpdate(student.user, userUpdates);
      }
    }

    // Record non-repudiable audit event
    await AuditLog.create({
      actor: adminUserId,
      action: 'ADMIN_STUDENT_PROFILE_UPDATE',
      entityType: 'Student',
      entityId: student._id,
      summary: `Admin updated student profile fields: [${updatedFields.join(', ')}]`,
      ip: req.ip || '',
    });
  }

  return res.status(200).json({
    success: true,
    data: student,
    updatedFields,
    message: updatedFields.length > 0
      ? 'Student profile updated successfully'
      : 'No changes detected',
  });
});

// POST /api/admin/students — Create an individual canonical enrolled student
const createCanonicalStudent = asyncHandler(async (req, res) => {
  const adminUserId = req.user.userId;
  const body = req.body || {};

  // 1. Validate required fields
  const rawRoll = body.rollNumber ? String(body.rollNumber).trim().toUpperCase() : '';
  if (!rawRoll) {
    throw new ApiError(400, 'Roll number is required.');
  }

  if (/^\d{10}$/.test(rawRoll)) {
    throw new ApiError(400, 'Invalid roll number format: 10-digit mobile phone numbers cannot be used as roll numbers.');
  }

  const rawName = body.fullName ? String(body.fullName).trim() : '';
  if (!rawName || rawName.length < 2) {
    throw new ApiError(400, 'Full name is required and must contain at least 2 characters.');
  }

  // 2. Prevent duplicate roll number (conflict 409)
  const existingRoll = await Student.findOne({ rollNumber: rawRoll }).lean();
  if (existingRoll) {
    throw new ApiError(409, `A student with roll number "${rawRoll}" already exists.`);
  }

  // 3. Validate and check email if provided
  let validatedEmail = null;
  if (body.email !== undefined && body.email !== null && String(body.email).trim() !== '') {
    validatedEmail = validateEmail(body.email);
    if (validatedEmail) {
      const existingEmail = await Student.findOne({ email: validatedEmail }).lean();
      if (existingEmail) {
        throw new ApiError(409, 'Email address is already in use by another student.');
      }
    }
  }

  // 4. Validate phone if provided
  let normalizedPhone = null;
  if (body.phone !== undefined && body.phone !== null && String(body.phone).trim() !== '') {
    normalizedPhone = normalizePhone(body.phone);
  }

  // 5. Validate semester if provided
  let semesterVal = null;
  if (body.semester !== undefined && body.semester !== null && body.semester !== '') {
    semesterVal = Number(body.semester);
    if (isNaN(semesterVal) || !Number.isInteger(semesterVal) || semesterVal < 1 || semesterVal > 10) {
      throw new ApiError(400, 'Semester must be an integer between 1 and 10.');
    }
  }

  // 6. Validate admissionYear if provided
  let admissionYearVal = null;
  if (body.admissionYear !== undefined && body.admissionYear !== null && body.admissionYear !== '') {
    admissionYearVal = Number(body.admissionYear);
    if (isNaN(admissionYearVal) || admissionYearVal < 1990 || admissionYearVal > 2050) {
      throw new ApiError(400, 'Admission year must be between 1990 and 2050.');
    }
  }

  // 7. Validate gender if provided
  let genderVal = '';
  if (body.gender !== undefined && body.gender !== null) {
    const g = String(body.gender).trim().toLowerCase();
    if (g && !['male', 'female', 'other'].includes(g)) {
      throw new ApiError(400, 'Gender must be male, female, other, or empty.');
    }
    genderVal = g;
  }

  // 8. Validate dateOfBirth if provided
  let dobVal = null;
  if (body.dateOfBirth) {
    dobVal = new Date(body.dateOfBirth);
    if (isNaN(dobVal.getTime())) {
      throw new ApiError(400, 'Invalid date of birth format.');
    }
  }

  // 9. Validate status if provided
  let statusVal = 'active';
  if (body.status !== undefined && body.status !== null && String(body.status).trim() !== '') {
    const s = String(body.status).trim().toLowerCase();
    const allowedStatuses = ['active', 'inactive', 'suspended', 'graduated', 'withdrawn', 'alumni'];
    if (!allowedStatuses.includes(s)) {
      throw new ApiError(400, `Invalid status "${s}". Allowed values: ${allowedStatuses.join(', ')}`);
    }
    statusVal = s;
  }

  // 10. Create canonical student record
  // Note: user is null (offline institutional student per spec); no User account, biometric or attendance records created.
  const newStudent = await Student.create({
    rollNumber: rawRoll,
    fullName: rawName,
    email: validatedEmail,
    phone: normalizedPhone,
    branch: body.branch ? String(body.branch).trim() : null,
    program: body.program ? String(body.program).trim() : null,
    course: body.course ? String(body.course).trim() : null,
    batch: body.batch ? String(body.batch).trim() : null,
    semester: semesterVal,
    section: body.section ? String(body.section).trim().toUpperCase() : null,
    admissionYear: admissionYearVal,
    school: body.school ? String(body.school).trim() : null,
    gender: genderVal,
    dateOfBirth: dobVal,
    status: statusVal,
    accountStatus: 'enrolled_offline',
    user: null,
  });

  // 11. Audit log
  await AuditLog.create({
    actor: adminUserId,
    action: 'ADMIN_STUDENT_CREATE',
    entityType: 'Student',
    entityId: newStudent._id,
    summary: `Admin created student record: ${newStudent.rollNumber} (${newStudent.fullName})`,
    ip: req.ip || '',
  });

  return res.status(201).json({
    success: true,
    data: newStudent,
    message: 'Student record created successfully',
  });
});

// PATCH /api/admin/students/:id/status — Manage canonical student status (active, inactive, suspended, graduated, withdrawn)
const updateCanonicalStudentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const adminUserId = req.user.userId;
  const { status } = req.body || {};

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid student identifier format');
  }

  if (!status || typeof status !== 'string') {
    throw new ApiError(400, 'Status is required.');
  }

  const normalizedStatus = status.trim().toLowerCase();
  const allowedStatuses = ['active', 'inactive', 'suspended', 'graduated', 'withdrawn', 'alumni'];
  if (!allowedStatuses.includes(normalizedStatus)) {
    throw new ApiError(400, `Invalid status "${status}". Allowed values: ${allowedStatuses.join(', ')}`);
  }

  const student = await Student.findById(id);
  if (!student) {
    throw new ApiError(404, 'Student record not found');
  }

  const previousStatus = student.status;
  if (previousStatus === normalizedStatus) {
    return res.status(200).json({
      success: true,
      data: student,
      message: `Student status is already "${normalizedStatus}".`,
    });
  }

  // Update status (Preserve attendance, academic history, and user without mutation)
  student.status = normalizedStatus;
  await student.save();

  // Deactivate or activate linked User account in sync with student status
  if (student.user) {
    const shouldBeActive = normalizedStatus === 'active';
    await User.findByIdAndUpdate(student.user, { isActive: shouldBeActive });
  }

  // Audit log
  await AuditLog.create({
    actor: adminUserId,
    action: 'ADMIN_STUDENT_STATUS_UPDATE',
    entityType: 'Student',
    entityId: student._id,
    summary: `Admin changed student ${student.rollNumber} status from "${previousStatus}" to "${normalizedStatus}"`,
    ip: req.ip || '',
  });

  return res.status(200).json({
    success: true,
    data: student,
    previousStatus,
    newStatus: normalizedStatus,
    message: `Student status updated to "${normalizedStatus}" successfully.`,
  });
});

// DELETE /api/admin/students/:id — Safely delete or prevent deletion of canonical student
const deleteCanonicalStudent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const adminUserId = req.user.userId;

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid student identifier format');
  }

  const student = await Student.findById(id);
  if (!student) {
    throw new ApiError(404, 'Student record not found');
  }

  // 1. Check for dependent records across attendance, biometric, financial, mark, complaint, and submission systems
  const [
    attendanceCount,
    faceCount,
    feeCount,
    invoiceCount,
    markCount,
    complaintCount,
    submissionCount,
  ] = await Promise.all([
    Attendance.countDocuments({ student: student._id }),
    FaceEmbedding.countDocuments({ student: student._id }),
    Fee.countDocuments({ student: student._id }),
    FeeInvoice.countDocuments({ student: student._id }),
    Mark.countDocuments({ student: student._id }),
    Complaint.countDocuments({ student: student._id }),
    Submission.countDocuments({ student: student._id }),
  ]);

  const dependencyDetails = [];
  if (attendanceCount > 0) dependencyDetails.push(`${attendanceCount} attendance record(s)`);
  if (faceCount > 0) dependencyDetails.push(`${faceCount} biometric face vector(s)`);
  if (feeCount > 0 || invoiceCount > 0) dependencyDetails.push(`${feeCount + invoiceCount} fee/invoice record(s)`);
  if (markCount > 0) dependencyDetails.push(`${markCount} exam mark(s)`);
  if (complaintCount > 0) dependencyDetails.push(`${complaintCount} complaint record(s)`);
  if (submissionCount > 0) dependencyDetails.push(`${submissionCount} assignment submission(s)`);

  if (dependencyDetails.length > 0) {
    throw new ApiError(
      400,
      `Cannot permanently delete student "${student.rollNumber}" with existing records (${dependencyDetails.join(', ')}). To preserve institutional and academic history, please deactivate the student by setting status to "inactive" or "withdrawn" instead.`
    );
  }

  // 2. If student has a linked User, delete linked student user account
  if (student.user) {
    const user = await User.findById(student.user);
    if (user && user.role === 'student') {
      await User.findByIdAndDelete(student.user);
    }
  }

  // 3. Delete student document
  await Student.findByIdAndDelete(student._id);

  // 4. Audit log
  await AuditLog.create({
    actor: adminUserId,
    action: 'ADMIN_STUDENT_DELETE',
    entityType: 'Student',
    entityId: student._id,
    summary: `Admin permanently deleted student record: ${student.rollNumber} (${student.fullName}) with zero dependent records.`,
    ip: req.ip || '',
  });

  return res.status(200).json({
    success: true,
    data: {
      _id: student._id,
      rollNumber: student.rollNumber,
      fullName: student.fullName,
    },
    message: `Student "${student.fullName}" (${student.rollNumber}) deleted successfully.`,
  });
});

// ══════════════════════════════════════════════════════════════
// 2. ADMIN FACULTY PROFILE MANAGEMENT
// ══════════════════════════════════════════════════════════════

// GET /api/admin/faculty — List & search canonical faculty profiles
const listFacultyProfiles = asyncHandler(async (req, res) => {
  const { search, department, page = 1, limit = 20 } = req.query;

  const facultyFilter = {};
  if (department) facultyFilter.department = String(department).trim();

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  let query = Faculty.find(facultyFilter)
    .populate('user', 'name email loginId role isActive')
    .sort({ employeeId: 1 });

  const allFaculty = await query.lean();

  // In-memory filter for search across populated user fields & faculty fields
  const queryStr = typeof search === 'string' ? search.trim().toLowerCase() : '';
  const filtered = queryStr
    ? allFaculty.filter(
        (f) =>
          String(f.employeeId || '').toLowerCase().includes(queryStr) ||
          String(f.department || '').toLowerCase().includes(queryStr) ||
          String(f.designation || '').toLowerCase().includes(queryStr) ||
          String(f.phone || '').includes(queryStr) ||
          String(f.user?.name || '').toLowerCase().includes(queryStr) ||
          String(f.user?.email || '').toLowerCase().includes(queryStr)
      )
    : allFaculty;

  const paginated = filtered.slice(skip, skip + limitNum);

  return res.status(200).json({
    success: true,
    data: paginated,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / limitNum) || 0,
    },
    message: 'Faculty retrieved successfully',
  });
});

// GET /api/admin/faculty/:id — Retrieve full permitted faculty profile with audit history
const getFacultyDetail = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid faculty identifier format');
  }

  const faculty = await Faculty.findById(id)
    .populate('user', 'name email loginId role isActive')
    .lean();

  if (!faculty) {
    throw new ApiError(404, 'Faculty record not found');
  }

  // Fetch recent profile audit history for this faculty
  const auditHistory = await AuditLog.find({
    entityType: 'Faculty',
    entityId: faculty._id,
  })
    .populate('actor', 'name email role')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  return res.status(200).json({
    success: true,
    data: {
      faculty,
      auditHistory,
    },
    message: 'Faculty profile loaded successfully',
  });
});

// PATCH /api/admin/faculty/:id — Edit permitted fields and fill missing info
const updateFacultyProfile = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const adminUserId = req.user.userId;

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid faculty identifier format');
  }

  const faculty = await Faculty.findById(id).populate('user');
  if (!faculty) {
    throw new ApiError(404, 'Faculty record not found');
  }

  const body = req.body || {};

  // 1. Enforce protection of immutable institutional identifiers and roles
  if (body.employeeId !== undefined && String(body.employeeId).trim() !== faculty.employeeId) {
    throw new ApiError(400, 'Employee ID is an immutable institutional identifier and cannot be modified.');
  }

  if (body.role !== undefined && body.role !== faculty.user?.role) {
    throw new ApiError(400, 'Faculty role and access permissions cannot be modified via profile editing.');
  }

  if (body.user !== undefined || body._id !== undefined) {
    throw new ApiError(400, 'System references and internal bindings cannot be modified.');
  }

  const updatedFields = [];

  // 2. Validate and apply permitted field updates
  if (body.department !== undefined) {
    const dept = String(body.department).trim();
    if (dept !== (faculty.department || '')) {
      faculty.department = dept;
      updatedFields.push('department');
    }
  }

  if (body.designation !== undefined) {
    const desig = String(body.designation).trim();
    if (!desig) {
      throw new ApiError(400, 'Designation cannot be empty.');
    }
    if (desig !== (faculty.designation || '')) {
      faculty.designation = desig;
      updatedFields.push('designation');
    }
  }

  if (body.phone !== undefined) {
    const normalizedPhone = normalizePhone(body.phone);
    if (normalizedPhone !== (faculty.phone || null)) {
      faculty.phone = normalizedPhone || '';
      updatedFields.push('phone');
    }
  }

  // Linked User updates (name and email)
  let userChanged = false;
  if (faculty.user) {
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name || name.length < 2) {
        throw new ApiError(400, 'Full name must contain at least 2 characters.');
      }
      if (name !== faculty.user.name) {
        faculty.user.name = name;
        userChanged = true;
        updatedFields.push('name');
      }
    }

    if (body.email !== undefined) {
      const validatedEmail = validateEmail(body.email);
      if (!validatedEmail) {
        throw new ApiError(400, 'Faculty email address cannot be empty.');
      }
      if (validatedEmail !== faculty.user.email) {
        // Ensure email uniqueness across User collection
        const conflict = await User.findOne({
          email: validatedEmail,
          _id: { $ne: faculty.user._id },
        }).lean();
        if (conflict) {
          throw new ApiError(409, 'Email address is already in use by another user account.');
        }
        faculty.user.email = validatedEmail;
        userChanged = true;
        updatedFields.push('email');
      }
    }
  }

  // 3. Save changes if any fields updated
  if (updatedFields.length > 0) {
    await faculty.save();
    if (userChanged && faculty.user) {
      await faculty.user.save();
    }

    // Record non-repudiable audit event
    await AuditLog.create({
      actor: adminUserId,
      action: 'ADMIN_FACULTY_PROFILE_UPDATE',
      entityType: 'Faculty',
      entityId: faculty._id,
      summary: `Admin updated faculty profile fields: [${updatedFields.join(', ')}]`,
      ip: req.ip || '',
    });
  }

  const populated = await Faculty.findById(faculty._id).populate('user', 'name email loginId role isActive').lean();

  return res.status(200).json({
    success: true,
    data: populated,
    updatedFields,
    message: updatedFields.length > 0
      ? 'Faculty profile updated successfully'
      : 'No changes detected',
  });
});

module.exports = {
  listCanonicalStudents,
  getCanonicalStudentDetail,
  updateCanonicalStudentProfile,
  createCanonicalStudent,
  updateCanonicalStudentStatus,
  deleteCanonicalStudent,
  listFacultyProfiles,
  getFacultyDetail,
  updateFacultyProfile,
};
