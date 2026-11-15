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
  const { search, branch, semester, page = 1, limit = 20 } = req.query;

  const andConditions = [];

  if (branch) andConditions.push({ branch: String(branch).trim() });
  if (semester) andConditions.push({ semester: Number(semester) });

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
      ],
    });
  }

  const filter = andConditions.length === 0 ? {} : (andConditions.length === 1 ? andConditions[0] : { $and: andConditions });

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [students, total] = await Promise.all([
    Student.find(filter)
      .select('rollNumber fullName email phone branch program semester section admissionYear status createdAt')
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
    if (val !== null && (isNaN(val) || val < 1 || val > 10)) {
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
  listFacultyProfiles,
  getFacultyDetail,
  updateFacultyProfile,
};
