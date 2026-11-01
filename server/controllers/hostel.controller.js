/**
 * server/controllers/hostel.controller.js
 * Comprehensive Hostel Management, Room & Bed Inventory, Allocations,
 * Check-In / Check-Out, Transfers, Maintenance, Mess & Policy Administration.
 */
'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const Hostel = require('../models/Hostel');
const HostelRoom = require('../models/HostelRoom');
const HostelBed = require('../models/HostelBed');
const HostelApplication = require('../models/HostelApplication');
const HostelAllocation = require('../models/HostelAllocation');
const HostelOccupancy = require('../models/HostelOccupancy');
const HostelTransferRequest = require('../models/HostelTransferRequest');
const HostelPolicy = require('../models/HostelPolicy');
const HostelAuditLog = require('../models/HostelAuditLog');
const MessMenu = require('../models/MessMenu');
const Complaint = require('../models/Complaint');
const Student = require('../models/Student');
const User = require('../models/User');
const hostelService = require('../services/hostel.service');
const notificationService = require('../services/notification.service');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Resolves current student profile for authenticated user
 * @param {Object} req
 * @returns {Promise<Object|null>}
 */
async function resolveCurrentStudent(req) {
  const userId = req.user?.userId || req.user?._id || req.user?.id;
  if (!userId) return null;
  return await Student.findOne({ user: userId });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. HOSTEL & BUILDING MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/hostel/hostels
 * Admin creates a new hostel residential building.
 */
const createHostel = asyncHandler(async (req, res) => {
  const {
    name,
    code,
    type,
    genderEligibility,
    building,
    campusLocation,
    description,
    wardens,
    contactNumber,
    contactEmail,
    applicablePrograms,
    applicableBatches,
  } = req.body;

  if (!name || !code || !type) {
    throw new ApiError(400, 'Hostel name, unique code, and type are required');
  }

  const cleanCode = code.trim().toUpperCase();
  const existingCode = await Hostel.findOne({ code: cleanCode });
  if (existingCode) {
    throw new ApiError(409, `Hostel code '${cleanCode}' is already in use`);
  }

  const cleanName = name.trim();
  const existingName = await Hostel.findOne({ name: cleanName });
  if (existingName) {
    throw new ApiError(409, `Hostel with name '${cleanName}' already exists`);
  }

  const staffUserId = req.user?.userId || req.user?._id;

  const hostel = await Hostel.create({
    name: cleanName,
    code: cleanCode,
    type,
    genderEligibility: genderEligibility || (type === 'boys' ? 'male' : type === 'girls' ? 'female' : 'any'),
    building: (building || '').trim(),
    campusLocation: (campusLocation || 'Main Campus').trim(),
    description: (description || '').trim(),
    wardens: Array.isArray(wardens) ? wardens : wardens ? [wardens] : [],
    contactNumber: (contactNumber || '').trim(),
    contactEmail: (contactEmail || '').trim(),
    applicablePrograms: Array.isArray(applicablePrograms) ? applicablePrograms : [],
    applicableBatches: Array.isArray(applicableBatches) ? applicableBatches : [],
    status: 'active',
    createdBy: staffUserId,
  });

  await HostelAuditLog.create({
    action: 'hostel_created',
    entityType: 'hostel',
    entityId: hostel._id,
    performedBy: staffUserId,
    details: { name: hostel.name, code: hostel.code, type: hostel.type },
  });

  return res.status(201).json({
    success: true,
    data: hostel,
    message: 'Hostel residential building created successfully',
  });
});

/**
 * GET /api/hostel/hostels
 * List hostels with role scoping (Wardens only see assigned hostels, Admin sees all, Students see active).
 */
const getHostels = asyncHandler(async (req, res) => {
  const { type, gender, status, search } = req.query;
  const filter = {};

  if (req.user?.role === 'warden') {
    const wardenId = req.user?.userId || req.user?._id;
    filter.wardens = wardenId;
  } else if (req.user?.role === 'student') {
    filter.status = 'active';
  } else {
    if (status && status !== 'all') filter.status = status;
  }

  if (type && type !== 'all') filter.type = type;
  if (gender && gender !== 'all') filter.genderEligibility = gender;
  if (search) {
    filter.$or = [
      { name: { $regex: search.trim(), $options: 'i' } },
      { code: { $regex: search.trim(), $options: 'i' } },
      { building: { $regex: search.trim(), $options: 'i' } },
    ];
  }

  const hostels = await Hostel.find(filter)
    .populate('wardens', 'name email loginId phone')
    .sort({ name: 1 });

  return res.status(200).json({
    success: true,
    data: hostels,
    count: hostels.length,
    message: 'Hostels retrieved successfully',
  });
});

/**
 * GET /api/hostel/hostels/:id
 * Retrieve detailed hostel info including capacity and warden contacts.
 */
const getHostelById = asyncHandler(async (req, res) => {
  const hostel = await Hostel.findById(req.params.id).populate('wardens', 'name email loginId phone');
  if (!hostel) {
    throw new ApiError(404, 'Hostel not found');
  }

  if (req.user?.role === 'warden') {
    await hostelService.assertWardenAuthorization(req.user, hostel);
  }

  return res.status(200).json({
    success: true,
    data: hostel,
    message: 'Hostel details retrieved successfully',
  });
});

/**
 * PATCH /api/hostel/hostels/:id
 * Admin updates hostel metadata, assigned wardens, or status.
 */
const updateHostel = asyncHandler(async (req, res) => {
  const hostel = await Hostel.findById(req.params.id);
  if (!hostel) {
    throw new ApiError(404, 'Hostel not found');
  }

  const updatable = [
    'name',
    'type',
    'genderEligibility',
    'building',
    'campusLocation',
    'description',
    'wardens',
    'contactNumber',
    'contactEmail',
    'applicablePrograms',
    'applicableBatches',
    'status',
  ];

  for (const field of updatable) {
    if (req.body[field] !== undefined) {
      hostel[field] = req.body[field];
    }
  }

  await hostel.save();

  await HostelAuditLog.create({
    action: 'hostel_updated',
    entityType: 'hostel',
    entityId: hostel._id,
    performedBy: req.user?.userId || req.user?._id,
    details: req.body,
  });

  return res.status(200).json({
    success: true,
    data: hostel,
    message: 'Hostel updated successfully',
  });
});

/**
 * DELETE /api/hostel/hostels/:id
 * Non-destructive archive of obsolete hostel.
 */
const archiveHostel = asyncHandler(async (req, res) => {
  const hostel = await Hostel.findById(req.params.id);
  if (!hostel) {
    throw new ApiError(404, 'Hostel not found');
  }

  hostel.status = 'archived';
  await hostel.save();

  await HostelAuditLog.create({
    action: 'hostel_archived',
    entityType: 'hostel',
    entityId: hostel._id,
    performedBy: req.user?.userId || req.user?._id,
    details: { name: hostel.name, code: hostel.code },
  });

  return res.status(200).json({
    success: true,
    data: hostel,
    message: 'Hostel successfully archived without altering historical records',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. ROOM & BED INVENTORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/hostel/rooms
 * Admin or Warden creates a new room in a hostel.
 */
const createRoom = asyncHandler(async (req, res) => {
  const { hostelId, roomNumber, floor, block, roomType, capacity, facilities } = req.body;

  if (!hostelId || !roomNumber || !roomType || capacity === undefined) {
    throw new ApiError(400, 'Hostel ID, room number, room type, and capacity are required');
  }

  const cleanRoomNumber = roomNumber.trim().toUpperCase();
  const hostel = await Hostel.findById(hostelId);
  if (!hostel) {
    throw new ApiError(404, 'Hostel not found');
  }

  if (req.user?.role === 'warden') {
    await hostelService.assertWardenAuthorization(req.user, hostel);
  }

  const existingRoom = await HostelRoom.findOne({ hostel: hostel._id, roomNumber: cleanRoomNumber });
  if (existingRoom) {
    throw new ApiError(409, `Room '${cleanRoomNumber}' already exists in hostel '${hostel.name}'`);
  }

  const numCapacity = Number(capacity);
  if (numCapacity < 1) {
    throw new ApiError(400, 'Room capacity must be at least 1');
  }

  const room = await HostelRoom.create({
    hostel: hostel._id,
    roomNumber: cleanRoomNumber,
    floor: Number(floor) || 0,
    block: (block || '').trim(),
    roomType,
    capacity: numCapacity,
    facilities: Array.isArray(facilities) ? facilities : facilities ? [facilities] : [],
    status: 'available',
  });

  await hostelService.syncHostelCapacity(hostel._id);

  return res.status(201).json({
    success: true,
    data: room,
    message: `Room ${room.roomNumber} created successfully`,
  });
});

/**
 * GET /api/hostel/rooms
 * List rooms for a hostel with floor, type, and availability filters.
 */
const getRooms = asyncHandler(async (req, res) => {
  const { hostelId, floor, roomType, status } = req.query;
  const filter = {};

  if (hostelId) filter.hostel = hostelId;
  if (floor !== undefined && floor !== '') filter.floor = Number(floor);
  if (roomType && roomType !== 'all') filter.roomType = roomType;
  if (status && status !== 'all') filter.status = status;

  if (req.user?.role === 'warden' && hostelId) {
    await hostelService.assertWardenAuthorization(req.user, hostelId);
  }

  const rooms = await HostelRoom.find(filter)
    .populate('hostel', 'name code')
    .sort({ floor: 1, roomNumber: 1 });

  return res.status(200).json({
    success: true,
    data: rooms,
    count: rooms.length,
    message: 'Rooms retrieved successfully',
  });
});

/**
 * POST /api/hostel/beds
 * Adds a physical bed to a room. Validates capacity constraints.
 */
const createBed = asyncHandler(async (req, res) => {
  const { roomId, bedNumber, bedId } = req.body;

  if (!roomId || !bedNumber) {
    throw new ApiError(400, 'Room ID and bed number/label are required');
  }

  const room = await HostelRoom.findById(roomId).populate('hostel');
  if (!room) {
    throw new ApiError(404, 'Room not found');
  }

  if (req.user?.role === 'warden') {
    await hostelService.assertWardenAuthorization(req.user, room.hostel);
  }

  const cleanBedNumber = bedNumber.trim().toUpperCase();
  const existingBedInRoom = await HostelBed.findOne({ room: room._id, bedNumber: cleanBedNumber });
  if (existingBedInRoom) {
    throw new ApiError(409, `Bed '${cleanBedNumber}' already exists in Room ${room.roomNumber}`);
  }

  // Validate room capacity constraint
  const currentBedCount = await HostelBed.countDocuments({ room: room._id, status: { $ne: 'inactive' } });
  if (currentBedCount >= room.capacity) {
    throw new ApiError(
      400,
      `Cannot add bed: Room ${room.roomNumber} has reached its configured capacity limit of ${room.capacity} beds`
    );
  }

  const bedSuffix = cleanBedNumber.startsWith(`${room.roomNumber}-`)
    ? cleanBedNumber.slice(room.roomNumber.length + 1)
    : cleanBedNumber;

  const generatedBedId =
    (bedId && bedId.trim().toUpperCase()) ||
    `${room.hostel.code}-${room.roomNumber}-${bedSuffix}`.toUpperCase();

  const existingBedId = await HostelBed.findOne({ bedId: generatedBedId });
  if (existingBedId) {
    throw new ApiError(409, `A bed with identifier '${generatedBedId}' already exists`);
  }

  const bed = await HostelBed.create({
    bedId: generatedBedId,
    hostel: room.hostel._id,
    room: room._id,
    bedNumber: cleanBedNumber,
    status: 'available',
  });

  await hostelService.syncRoomCapacity(room._id);
  await hostelService.syncHostelCapacity(room.hostel._id);

  return res.status(201).json({
    success: true,
    data: bed,
    message: `Bed ${bed.bedNumber} added successfully`,
  });
});

/**
 * GET /api/hostel/beds
 * List beds for a room or hostel.
 */
const getBeds = asyncHandler(async (req, res) => {
  const { roomId, hostelId, status } = req.query;
  const filter = {};

  if (roomId) filter.room = roomId;
  if (hostelId) filter.hostel = hostelId;
  if (status && status !== 'all') filter.status = status;

  if (req.user?.role === 'warden' && hostelId) {
    await hostelService.assertWardenAuthorization(req.user, hostelId);
  }

  const beds = await HostelBed.find(filter)
    .populate('room', 'roomNumber floor roomType')
    .populate('hostel', 'name code')
    .populate({
      path: 'currentStudent',
      select: 'fullName rollNumber program branch semester phone email',
    })
    .sort({ bedNumber: 1 });

  return res.status(200).json({
    success: true,
    data: beds,
    count: beds.length,
    message: 'Beds retrieved successfully',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. STUDENT HOSTEL APPLICATIONS & REVIEW
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/hostel/applications
 * Student submits an application for hostel accommodation.
 */
const createApplication = asyncHandler(async (req, res) => {
  const { preferredHostels, requestedRoomType, distanceFromCollegeKm, medicalConditions, emergencyContact, academicYear } =
    req.body;

  const student = await resolveCurrentStudent(req);
  if (!student) {
    throw new ApiError(404, 'Student profile not found');
  }

  const policy = await hostelService.getActivePolicy();
  if (!policy.applicationWindowOpen) {
    throw new ApiError(400, 'Hostel applications are currently closed by the administration');
  }

  const effectiveAcademicYear = (academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`).trim();

  // Prevent duplicate active applications
  const existingActiveApp = await HostelApplication.findOne({
    student: student._id,
    academicYear: effectiveAcademicYear,
    status: { $in: ['submitted', 'under_review', 'approved', 'waitlisted', 'allocated'] },
  });

  if (existingActiveApp) {
    throw new ApiError(
      409,
      `You already have an active hostel application (#${existingActiveApp.applicationNumber}) for academic year ${effectiveAcademicYear}`
    );
  }

  const applicationNumber = `HAPP-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

  const application = await HostelApplication.create({
    applicationNumber,
    student: student._id,
    academicYear: effectiveAcademicYear,
    semester: student.semester || 1,
    preferredHostels: Array.isArray(preferredHostels) ? preferredHostels : preferredHostels ? [preferredHostels] : [],
    requestedRoomType: requestedRoomType || 'any',
    distanceFromCollegeKm: Number(distanceFromCollegeKm) || 0,
    medicalConditions: (medicalConditions || '').trim(),
    emergencyContact: emergencyContact || {},
    status: 'submitted',
  });

  // Notify student of submission
  try {
    await notificationService.createNotification({
      recipient: req.user?.userId || req.user?._id,
      title: 'Hostel Application Submitted',
      message: `Your hostel application #${application.applicationNumber} has been received for review.`,
      category: 'hostel',
      priority: 'normal',
      relatedEntityType: 'hostel_application',
      relatedEntityId: application._id,
      targetRoute: '/student/hostel',
      actorName: 'Hostel Administration Office',
      actorRole: 'admin',
      eventId: `hostel_app_submit_${application._id}`,
    });
  } catch (err) {
    console.warn('⚠️ Application notification skipped:', err.message);
  }

  return res.status(201).json({
    success: true,
    data: application,
    message: 'Hostel accommodation application submitted successfully',
  });
});

/**
 * GET /api/hostel/applications
 * List applications with role scoping (Students only see their own, Wardens see their hostels, Admin sees all).
 */
const getApplications = asyncHandler(async (req, res) => {
  const { status, academicYear, hostelId, page = 1, limit = 20 } = req.query;
  const filter = {};

  if (req.user?.role === 'student') {
    const student = await resolveCurrentStudent(req);
    if (!student) throw new ApiError(404, 'Student profile not found');
    filter.student = student._id;
  } else {
    if (status && status !== 'all') filter.status = status;
    if (academicYear) filter.academicYear = academicYear;
    if (hostelId) filter.preferredHostels = hostelId;

    if (req.user?.role === 'warden') {
      const wardenId = req.user?.userId || req.user?._id;
      const assignedHostels = await Hostel.find({ wardens: wardenId }).select('_id');
      const assignedIds = assignedHostels.map((h) => h._id);
      filter.preferredHostels = { $in: assignedIds };
    }
  }

  const skip = (Number(page) - 1) * Number(limit);
  const total = await HostelApplication.countDocuments(filter);
  const applications = await HostelApplication.find(filter)
    .populate({
      path: 'student',
      select: 'fullName rollNumber program branch semester gender phone email guardianName guardianPhone',
    })
    .populate('preferredHostels', 'name code type genderEligibility')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  return res.status(200).json({
    success: true,
    data: applications,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    },
    message: 'Hostel applications retrieved successfully',
  });
});

/**
 * PATCH /api/hostel/applications/:id/review
 * Admin or Warden reviews an application -> Approve, Reject, or Waitlist.
 */
const reviewApplication = asyncHandler(async (req, res) => {
  const { decision, comments, rejectionReason, waitlistNumber } = req.body;

  if (!decision || !['approved', 'rejected', 'waitlisted', 'under_review'].includes(decision)) {
    throw new ApiError(400, 'Valid decision is required (approved, rejected, waitlisted, under_review)');
  }

  if (decision === 'rejected' && (!rejectionReason || rejectionReason.trim().length < 5)) {
    throw new ApiError(400, 'A detailed rejection reason (minimum 5 characters) is required');
  }

  const application = await HostelApplication.findById(req.params.id)
    .populate({
      path: 'student',
      populate: { path: 'user', select: 'name email loginId' },
    })
    .populate('preferredHostels');

  if (!application) {
    throw new ApiError(404, 'Hostel application not found');
  }

  if (application.status === 'allocated') {
    throw new ApiError(400, 'Cannot modify application that has already been allocated accommodation');
  }

  const staffUserId = req.user?.userId || req.user?._id;

  application.status = decision;
  application.reviewDetails = {
    reviewedBy: staffUserId,
    reviewedAt: new Date(),
    comments: (comments || '').trim(),
    rejectionReason: decision === 'rejected' ? rejectionReason.trim() : '',
    waitlistNumber: decision === 'waitlisted' ? Number(waitlistNumber) || null : null,
  };

  await application.save();

  await HostelAuditLog.create({
    action: `application_${decision}`,
    entityType: 'application',
    entityId: application._id,
    performedBy: staffUserId,
    details: { decision, comments, rejectionReason },
  });

  // Notify student of decision
  const studentUser = application.student?.user;
  if (studentUser?._id || studentUser) {
    const recipientId = studentUser._id || studentUser;
    try {
      const msg =
        decision === 'approved'
          ? `Your hostel application #${application.applicationNumber} has been approved! Room and bed allocation will follow shortly.`
          : decision === 'rejected'
          ? `Your hostel application #${application.applicationNumber} was not approved. Reason: ${rejectionReason}`
          : `Your hostel application #${application.applicationNumber} has been waitlisted (Position: ${waitlistNumber || 'Pending'}).`;

      await notificationService.createNotification({
        recipient: recipientId,
        title: `Hostel Application ${decision.toUpperCase()}`,
        message: msg,
        category: 'hostel',
        priority: decision === 'approved' ? 'high' : 'normal',
        relatedEntityType: 'hostel_application',
        relatedEntityId: application._id,
        targetRoute: '/student/hostel',
        actorName: 'Hostel Administration',
        actorRole: 'admin',
        eventId: `hostel_review_${application._id}_${decision}`,
      });
    } catch (err) {
      console.warn('⚠️ Review notification skipped:', err.message);
    }
  }

  return res.status(200).json({
    success: true,
    data: application,
    message: `Application marked as ${decision}`,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. ROOM & BED ALLOCATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/hostel/allocations
 * Admin or Warden assigns an approved student to a specific hostel, room, and bed.
 * Guarantees atomicity and zero double-allocation.
 */
const allocateBed = asyncHandler(async (req, res) => {
  const { studentId, applicationId, hostelId, roomId, bedId, startDate, expectedEndDate, academicYear, remarks } =
    req.body;

  if (!studentId || !hostelId || !roomId || !bedId) {
    throw new ApiError(400, 'Student ID, hostel ID, room ID, and bed ID are required');
  }

  const student = await Student.findById(studentId);
  if (!student) {
    throw new ApiError(404, 'Student not found');
  }

  const hostel = await Hostel.findById(hostelId);
  if (!hostel) {
    throw new ApiError(404, 'Hostel not found');
  }

  if (req.user?.role === 'warden') {
    await hostelService.assertWardenAuthorization(req.user, hostel);
  }

  // 1. Eligibility Check
  const policy = await hostelService.getActivePolicy();
  const eligibility = hostelService.checkStudentHostelEligibility(student, hostel, policy);
  if (!eligibility.eligible) {
    throw new ApiError(400, `Student is not eligible for this hostel: ${eligibility.reason}`);
  }

  // 2. Prevent overlapping active allocations for the same student
  const activeExistingAlloc = await HostelAllocation.findOne({
    student: student._id,
    status: { $in: ['allocated', 'active'] },
  });
  if (activeExistingAlloc) {
    throw new ApiError(400, 'Student already possesses an active hostel accommodation allocation');
  }

  // 3. Atomic Bed Assignment (prevents race conditions)
  const bed = await HostelBed.findOneAndUpdate(
    { _id: bedId, room: roomId, hostel: hostel._id, status: 'available' },
    { $set: { status: 'allocated', currentStudent: student._id } },
    { new: true }
  );

  if (!bed) {
    throw new ApiError(409, 'Bed is no longer available or was concurrently allocated to another student');
  }

  const room = await HostelRoom.findById(roomId);
  const staffUserId = req.user?.userId || req.user?._id;
  const start = startDate ? new Date(startDate) : new Date();
  const end = expectedEndDate
    ? new Date(expectedEndDate)
    : new Date(start.getTime() + (policy.maxAllocationDurationMonths || 12) * 30 * 24 * 60 * 60 * 1000);

  const allocationNumber = `HALLOC-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

  const allocation = await HostelAllocation.create({
    allocationNumber,
    student: student._id,
    application: applicationId || null,
    hostel: hostel._id,
    room: room._id,
    bed: bed._id,
    academicYear: (academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`).trim(),
    startDate: start,
    expectedEndDate: end,
    allocatedBy: staffUserId,
    status: 'allocated',
    remarks: (remarks || '').trim(),
  });

  // Link allocation to bed
  bed.currentAllocation = allocation._id;
  await bed.save();

  // If allocation was based on an application, update application status
  if (applicationId) {
    await HostelApplication.findByIdAndUpdate(applicationId, { status: 'allocated' });
  }

  // Sync capacity counts
  await hostelService.syncRoomCapacity(room._id);
  await hostelService.syncHostelCapacity(hostel._id);

  await HostelAuditLog.create({
    action: 'bed_allocated',
    entityType: 'allocation',
    entityId: allocation._id,
    performedBy: staffUserId,
    details: {
      student: student.rollNumber,
      hostel: hostel.code,
      room: room.roomNumber,
      bed: bed.bedNumber,
    },
  });

  // Notify student
  try {
    await notificationService.createNotification({
      recipient: student.user,
      title: 'Hostel Accommodation Allocated',
      message: `You have been allocated Bed ${bed.bedNumber} in Room ${room.roomNumber} at ${hostel.name}. Please proceed with check-in.`,
      category: 'hostel',
      priority: 'high',
      relatedEntityType: 'hostel_allocation',
      relatedEntityId: allocation._id,
      targetRoute: '/student/hostel',
      actorName: 'Hostel Administration',
      actorRole: 'admin',
      eventId: `hostel_alloc_${allocation._id}`,
    });
  } catch (err) {
    console.warn('⚠️ Allocation notification skipped:', err.message);
  }

  return res.status(201).json({
    success: true,
    data: allocation,
    message: `Bed ${bed.bedNumber} in Room ${room.roomNumber} successfully allocated to ${student.fullName}`,
  });
});

/**
 * GET /api/hostel/allocations
 * List allocations with role scoping.
 */
const getAllocations = asyncHandler(async (req, res) => {
  const { hostelId, status, academicYear, page = 1, limit = 20 } = req.query;
  const filter = {};

  if (req.user?.role === 'student') {
    const student = await resolveCurrentStudent(req);
    if (!student) throw new ApiError(404, 'Student profile not found');
    filter.student = student._id;
  } else {
    if (hostelId) filter.hostel = hostelId;
    if (status && status !== 'all') filter.status = status;
    if (academicYear) filter.academicYear = academicYear;

    if (req.user?.role === 'warden' && hostelId) {
      await hostelService.assertWardenAuthorization(req.user, hostelId);
    }
  }

  const skip = (Number(page) - 1) * Number(limit);
  const total = await HostelAllocation.countDocuments(filter);
  const allocations = await HostelAllocation.find(filter)
    .populate({
      path: 'student',
      select: 'fullName rollNumber program branch semester gender phone email',
    })
    .populate('hostel', 'name code type')
    .populate('room', 'roomNumber floor roomType')
    .populate('bed', 'bedNumber bedId')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  return res.status(200).json({
    success: true,
    data: allocations,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    },
    message: 'Allocations retrieved successfully',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. CHECK-IN & CHECK-OUT CIRCULATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/hostel/allocations/:id/check-in
 * Staff records physical student arrival, key issuance, and initial room inspection.
 */
const checkInStudent = asyncHandler(async (req, res) => {
  const { inventoryCondition, keysIssued, notes } = req.body;

  const allocation = await HostelAllocation.findById(req.params.id)
    .populate('hostel')
    .populate('room')
    .populate('bed')
    .populate({
      path: 'student',
      populate: { path: 'user', select: 'name email loginId' },
    });

  if (!allocation) {
    throw new ApiError(404, 'Hostel allocation record not found');
  }

  if (req.user?.role === 'warden') {
    await hostelService.assertWardenAuthorization(req.user, allocation.hostel);
  }

  if (allocation.status !== 'allocated') {
    throw new ApiError(400, `Cannot check-in allocation with status '${allocation.status}'`);
  }

  const existingOccupancy = await HostelOccupancy.findOne({ allocation: allocation._id });
  if (existingOccupancy) {
    throw new ApiError(400, 'Student has already completed physical check-in for this allocation');
  }

  const staffUserId = req.user?.userId || req.user?._id;

  const occupancy = await HostelOccupancy.create({
    allocation: allocation._id,
    student: allocation.student._id,
    hostel: allocation.hostel._id,
    room: allocation.room._id,
    bed: allocation.bed._id,
    checkIn: {
      date: new Date(),
      staff: staffUserId,
      inventoryCondition: (inventoryCondition || 'Pristine condition').trim(),
      keysIssued: Number(keysIssued) || 1,
      notes: (notes || '').trim(),
    },
    status: 'checked_in',
  });

  allocation.status = 'active';
  await allocation.save();

  // Update Bed to 'occupied'
  await HostelBed.findByIdAndUpdate(allocation.bed._id, { status: 'occupied' });
  await hostelService.syncRoomCapacity(allocation.room._id);
  await hostelService.syncHostelCapacity(allocation.hostel._id);

  await HostelAuditLog.create({
    action: 'student_checked_in',
    entityType: 'occupancy',
    entityId: occupancy._id,
    performedBy: staffUserId,
    details: {
      allocationNumber: allocation.allocationNumber,
      student: allocation.student.rollNumber,
      room: allocation.room.roomNumber,
      bed: allocation.bed.bedNumber,
    },
  });

  // Notify student
  try {
    await notificationService.createNotification({
      recipient: allocation.student?.user?._id || allocation.student.user,
      title: 'Hostel Check-in Completed',
      message: `Welcome to ${allocation.hostel.name}! Your check-in to Room ${allocation.room.roomNumber}, Bed ${allocation.bed.bedNumber} is confirmed.`,
      category: 'hostel',
      priority: 'normal',
      relatedEntityType: 'hostel_occupancy',
      relatedEntityId: occupancy._id,
      targetRoute: '/student/hostel',
      actorName: 'Hostel Warden Office',
      actorRole: 'admin',
      eventId: `hostel_checkin_${occupancy._id}`,
    });
  } catch (err) {
    console.warn('⚠️ Check-in notification skipped:', err.message);
  }

  return res.status(200).json({
    success: true,
    data: occupancy,
    message: `Physical check-in for ${allocation.student.fullName} recorded successfully`,
  });
});

/**
 * POST /api/hostel/allocations/:id/check-out
 * Staff records departure, room inspection, clearance, and releases the bed.
 */
const checkOutStudent = asyncHandler(async (req, res) => {
  const { roomCondition, keysReturned, damageAssessmentInPaise, outstandingDuesInPaise, clearanceStatus, clearanceNotes } =
    req.body;

  const allocation = await HostelAllocation.findById(req.params.id)
    .populate('hostel')
    .populate('room')
    .populate('bed')
    .populate({
      path: 'student',
      populate: { path: 'user', select: 'name email loginId' },
    });

  if (!allocation) {
    throw new ApiError(404, 'Hostel allocation record not found');
  }

  if (req.user?.role === 'warden') {
    await hostelService.assertWardenAuthorization(req.user, allocation.hostel);
  }

  const occupancy = await HostelOccupancy.findOne({ allocation: allocation._id });
  if (!occupancy || occupancy.status === 'checked_out') {
    throw new ApiError(400, 'Student is not actively checked in or has already completed check-out');
  }

  const staffUserId = req.user?.userId || req.user?._id;

  occupancy.checkOut = {
    date: new Date(),
    staff: staffUserId,
    roomCondition: (roomCondition || 'Good condition').trim(),
    keysReturned: keysReturned !== undefined ? Boolean(keysReturned) : true,
    damageAssessmentInPaise: Number(damageAssessmentInPaise) || 0,
    outstandingDuesInPaise: Number(outstandingDuesInPaise) || 0,
    clearanceStatus: clearanceStatus || 'cleared',
    clearanceNotes: (clearanceNotes || '').trim(),
  };
  occupancy.status = 'checked_out';
  await occupancy.save();

  allocation.status = 'checked_out';
  allocation.actualEndDate = new Date();
  await allocation.save();

  // Atomically release bed back to 'available'
  await HostelBed.findByIdAndUpdate(allocation.bed._id, {
    status: 'available',
    currentAllocation: null,
    currentStudent: null,
  });

  await hostelService.syncRoomCapacity(allocation.room._id);
  await hostelService.syncHostelCapacity(allocation.hostel._id);

  await HostelAuditLog.create({
    action: 'student_checked_out',
    entityType: 'occupancy',
    entityId: occupancy._id,
    performedBy: staffUserId,
    details: {
      allocationNumber: allocation.allocationNumber,
      student: allocation.student.rollNumber,
      clearanceStatus: occupancy.checkOut.clearanceStatus,
    },
  });

  // Notify student
  try {
    await notificationService.createNotification({
      recipient: allocation.student?.user?._id || allocation.student.user,
      title: 'Hostel Check-out Recorded',
      message: `Your check-out from ${allocation.hostel.name} has been processed. Clearance status: ${occupancy.checkOut.clearanceStatus.toUpperCase()}.`,
      category: 'hostel',
      priority: 'normal',
      relatedEntityType: 'hostel_occupancy',
      relatedEntityId: occupancy._id,
      targetRoute: '/student/hostel',
      actorName: 'Hostel Warden Office',
      actorRole: 'admin',
      eventId: `hostel_checkout_${occupancy._id}`,
    });
  } catch (err) {
    console.warn('⚠️ Check-out notification skipped:', err.message);
  }

  return res.status(200).json({
    success: true,
    data: occupancy,
    message: `Check-out completed for ${allocation.student.fullName}. Bed ${allocation.bed.bedNumber} is now available.`,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. ROOM TRANSFERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/hostel/transfers
 * Student requests a room or bed transfer.
 */
const requestTransfer = asyncHandler(async (req, res) => {
  const { requestedHostelId, requestedRoomType, reason } = req.body;

  if (!reason || reason.trim().length < 5) {
    throw new ApiError(400, 'A detailed transfer reason (min 5 characters) is required');
  }

  const student = await resolveCurrentStudent(req);
  if (!student) {
    throw new ApiError(404, 'Student profile not found');
  }

  const activeAllocation = await HostelAllocation.findOne({
    student: student._id,
    status: { $in: ['allocated', 'active'] },
  })
    .populate('hostel')
    .populate('room')
    .populate('bed');

  if (!activeAllocation) {
    throw new ApiError(400, 'You must have an active hostel accommodation allocation to request a room transfer');
  }

  // Prevent multiple pending transfer requests
  const pendingRequest = await HostelTransferRequest.findOne({
    student: student._id,
    status: 'pending',
  });
  if (pendingRequest) {
    throw new ApiError(400, 'You already have a room transfer request pending review');
  }

  const requestNumber = `HTR-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

  const transfer = await HostelTransferRequest.create({
    requestNumber,
    student: student._id,
    currentAllocation: activeAllocation._id,
    currentHostel: activeAllocation.hostel._id,
    currentRoom: activeAllocation.room._id,
    currentBed: activeAllocation.bed._id,
    requestedHostel: requestedHostelId || activeAllocation.hostel._id,
    requestedRoomType: requestedRoomType || 'any',
    reason: reason.trim(),
    status: 'pending',
  });

  return res.status(201).json({
    success: true,
    data: transfer,
    message: 'Room transfer request submitted for warden review',
  });
});

/**
 * GET /api/hostel/transfers
 * List transfer requests.
 */
const getTransferRequests = asyncHandler(async (req, res) => {
  const { status, hostelId } = req.query;
  const filter = {};

  if (req.user?.role === 'student') {
    const student = await resolveCurrentStudent(req);
    if (!student) throw new ApiError(404, 'Student profile not found');
    filter.student = student._id;
  } else {
    if (status && status !== 'all') filter.status = status;
    if (hostelId) filter.currentHostel = hostelId;

    if (req.user?.role === 'warden') {
      const wardenId = req.user?.userId || req.user?._id;
      const assigned = await Hostel.find({ wardens: wardenId }).select('_id');
      filter.currentHostel = { $in: assigned.map((h) => h._id) };
    }
  }

  const transfers = await HostelTransferRequest.find(filter)
    .populate({
      path: 'student',
      select: 'fullName rollNumber program branch semester gender phone',
    })
    .populate('currentHostel', 'name code')
    .populate('currentRoom', 'roomNumber floor')
    .populate('currentBed', 'bedNumber bedId')
    .populate('requestedHostel', 'name code')
    .sort({ createdAt: -1 });

  return res.status(200).json({
    success: true,
    data: transfers,
    count: transfers.length,
    message: 'Transfer requests retrieved successfully',
  });
});

/**
 * PATCH /api/hostel/transfers/:id/review
 * Warden or Admin approves or rejects a room transfer.
 * On approval with target bed, performs atomic transition freeing old bed and claiming new bed.
 */
const reviewTransfer = asyncHandler(async (req, res) => {
  const { decision, comments, newHostelId, newRoomId, newBedId } = req.body;

  if (!decision || !['approved', 'rejected'].includes(decision)) {
    throw new ApiError(400, 'Decision must be approved or rejected');
  }

  const transfer = await HostelTransferRequest.findById(req.params.id)
    .populate('currentHostel')
    .populate('currentRoom')
    .populate('currentBed')
    .populate({
      path: 'student',
      populate: { path: 'user', select: 'name email loginId' },
    });

  if (!transfer) {
    throw new ApiError(404, 'Transfer request not found');
  }

  if (transfer.status !== 'pending') {
    throw new ApiError(400, `Cannot review transfer in '${transfer.status}' status`);
  }

  const staffUserId = req.user?.userId || req.user?._id;

  if (decision === 'rejected') {
    transfer.status = 'rejected';
    transfer.review = {
      reviewedBy: staffUserId,
      reviewedAt: new Date(),
      comments: (comments || 'Transfer request declined').trim(),
    };
    await transfer.save();

    return res.status(200).json({
      success: true,
      data: transfer,
      message: 'Transfer request rejected',
    });
  }

  // Decision === 'approved': Requires newBedId, newRoomId, newHostelId
  if (!newBedId || !newRoomId || !newHostelId) {
    throw new ApiError(400, 'New target hostel, room, and bed are required to approve transfer');
  }

  // 1. Atomically claim new bed
  const newBed = await HostelBed.findOneAndUpdate(
    { _id: newBedId, room: newRoomId, hostel: newHostelId, status: 'available' },
    { $set: { status: 'allocated', currentStudent: transfer.student._id } },
    { new: true }
  );

  if (!newBed) {
    throw new ApiError(409, 'Target bed is no longer available');
  }

  // 2. Mark old allocation as 'transferred'
  const oldAllocation = await HostelAllocation.findById(transfer.currentAllocation);
  if (oldAllocation) {
    oldAllocation.status = 'transferred';
    oldAllocation.actualEndDate = new Date();
    await oldAllocation.save();
  }

  // 3. Atomically release old bed
  await HostelBed.findByIdAndUpdate(transfer.currentBed._id, {
    status: 'available',
    currentAllocation: null,
    currentStudent: null,
  });

  // 4. Create new allocation
  const newAllocationNumber = `HALLOC-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const newAllocation = await HostelAllocation.create({
    allocationNumber: newAllocationNumber,
    student: transfer.student._id,
    hostel: newHostelId,
    room: newRoomId,
    bed: newBed._id,
    academicYear: oldAllocation?.academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    startDate: new Date(),
    expectedEndDate: oldAllocation?.expectedEndDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    allocatedBy: staffUserId,
    status: 'allocated',
    remarks: `Transferred from ${transfer.currentHostel.code} Room ${transfer.currentRoom.roomNumber}`,
  });

  newBed.currentAllocation = newAllocation._id;
  await newBed.save();

  transfer.status = 'approved';
  transfer.review = {
    reviewedBy: staffUserId,
    reviewedAt: new Date(),
    comments: (comments || 'Transfer approved and executed').trim(),
    newAllocation: newAllocation._id,
  };
  await transfer.save();

  // Sync capacities of both old and new rooms & hostels
  await hostelService.syncRoomCapacity(transfer.currentRoom._id);
  await hostelService.syncHostelCapacity(transfer.currentHostel._id);
  await hostelService.syncRoomCapacity(newRoomId);
  await hostelService.syncHostelCapacity(newHostelId);

  await HostelAuditLog.create({
    action: 'transfer_completed',
    entityType: 'transfer',
    entityId: transfer._id,
    performedBy: staffUserId,
    details: {
      student: transfer.student.rollNumber,
      fromBed: transfer.currentBed.bedNumber,
      toBed: newBed.bedNumber,
    },
  });

  // Notify student
  try {
    await notificationService.createNotification({
      recipient: transfer.student?.user?._id || transfer.student.user,
      title: 'Room Transfer Approved',
      message: `Your room transfer has been approved! You have been allocated Bed ${newBed.bedNumber}.`,
      category: 'hostel',
      priority: 'high',
      relatedEntityType: 'hostel_transfer',
      relatedEntityId: transfer._id,
      targetRoute: '/student/hostel',
      actorName: 'Hostel Administration',
      actorRole: 'admin',
      eventId: `hostel_transfer_${transfer._id}`,
    });
  } catch (err) {
    console.warn('⚠️ Transfer notification skipped:', err.message);
  }

  return res.status(200).json({
    success: true,
    data: {
      ...transfer.toObject(),
      transfer,
      newAllocation,
    },
    message: 'Room transfer executed successfully',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. HOSTEL MAINTENANCE & COMPLAINTS (INTEGRATED)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/hostel/complaints
 * Student logs a maintenance problem for their hostel/room.
 */
const createHostelComplaint = asyncHandler(async (req, res) => {
  const { title, description, priority, hostelId, roomId, bedId } = req.body;

  if (!title || !description) {
    throw new ApiError(400, 'Title and description are required');
  }

  const student = await resolveCurrentStudent(req);
  if (!student) throw new ApiError(404, 'Student profile not found');

  // Find student's active allocation if hostel not specified
  let targetHostel = hostelId;
  let targetRoom = roomId;
  let targetBed = bedId;

  if (!targetHostel) {
    const activeAlloc = await HostelAllocation.findOne({
      student: student._id,
      status: { $in: ['allocated', 'active'] },
    });
    if (activeAlloc) {
      targetHostel = activeAlloc.hostel;
      targetRoom = activeAlloc.room;
      targetBed = activeAlloc.bed;
    }
  }

  const complaint = await Complaint.create({
    raisedBy: req.user?.userId || req.user?._id,
    category: 'hostel',
    title: title.trim(),
    description: description.trim(),
    priority: priority || 'normal',
    hostel: targetHostel || null,
    room: targetRoom || null,
    bed: targetBed || null,
    status: 'pending',
  });

  return res.status(201).json({
    success: true,
    data: complaint,
    message: 'Hostel maintenance complaint registered successfully',
  });
});

/**
 * GET /api/hostel/complaints
 * List hostel maintenance complaints with role scoping.
 */
const getHostelComplaints = asyncHandler(async (req, res) => {
  const { hostelId, status } = req.query;
  const filter = { category: 'hostel' };

  if (req.user?.role === 'student') {
    filter.raisedBy = req.user?.userId || req.user?._id;
  } else {
    if (status && status !== 'all') filter.status = status;
    if (hostelId) filter.hostel = hostelId;

    if (req.user?.role === 'warden') {
      const wardenId = req.user?.userId || req.user?._id;
      const assigned = await Hostel.find({ wardens: wardenId }).select('_id');
      filter.hostel = { $in: assigned.map((h) => h._id) };
    }
  }

  const complaints = await Complaint.find(filter)
    .populate('raisedBy', 'name email loginId')
    .populate('hostel', 'name code')
    .populate('room', 'roomNumber floor')
    .populate('assignedTo', 'name email')
    .sort({ createdAt: -1 });

  return res.status(200).json({
    success: true,
    data: complaints,
    count: complaints.length,
    message: 'Hostel maintenance requests retrieved successfully',
  });
});

/**
 * PATCH /api/hostel/complaints/:id
 * Admin or Warden resolves or assigns maintenance complaint.
 */
const updateHostelComplaint = asyncHandler(async (req, res) => {
  const { status, adminResponse, closureNotes, assignedTo } = req.body;

  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) {
    throw new ApiError(404, 'Complaint not found');
  }

  if (status) complaint.status = status;
  if (adminResponse) complaint.adminResponse = adminResponse.trim();
  if (closureNotes) complaint.closureNotes = closureNotes.trim();
  if (assignedTo) complaint.assignedTo = assignedTo;
  if (status === 'resolved' || status === 'closed') {
    complaint.resolvedAt = new Date();
  }

  await complaint.save();

  // Notify student
  try {
    await notificationService.createNotification({
      recipient: complaint.raisedBy,
      title: 'Hostel Complaint Status Updated',
      message: `Your maintenance ticket "${complaint.title}" is now marked as ${complaint.status.toUpperCase()}.`,
      category: 'hostel',
      priority: 'normal',
      relatedEntityType: 'complaint',
      relatedEntityId: complaint._id,
      targetRoute: '/student/hostel',
      actorName: 'Hostel Maintenance Hub',
      actorRole: 'admin',
      eventId: `hostel_complaint_${complaint._id}`,
    });
  } catch (err) {
    console.warn('⚠️ Complaint notification skipped:', err.message);
  }

  return res.status(200).json({
    success: true,
    data: complaint,
    message: 'Complaint updated successfully',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. MESS DINING SCHEDULE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/hostel/mess-menu
 * Retrieve weekly dining menu for a hostel.
 */
const getMessMenu = asyncHandler(async (req, res) => {
  const { hostelId } = req.query;
  if (!hostelId) {
    throw new ApiError(400, 'Hostel ID is required');
  }

  const menu = await MessMenu.find({ hostel: hostelId }).sort({ dayOfWeek: 1 });

  return res.status(200).json({
    success: true,
    data: menu,
    message: 'Mess menu retrieved successfully',
  });
});

/**
 * PUT /api/hostel/mess-menu
 * Admin or Warden updates mess dining items for a day.
 */
const updateMessMenu = asyncHandler(async (req, res) => {
  const { hostelId, dayOfWeek, breakfast, lunch, snacks, dinner, specialNotes } = req.body;

  if (!hostelId || !dayOfWeek) {
    throw new ApiError(400, 'Hostel ID and day of week are required');
  }

  const hostel = await Hostel.findById(hostelId);
  if (!hostel) throw new ApiError(404, 'Hostel not found');

  if (req.user?.role === 'warden') {
    await hostelService.assertWardenAuthorization(req.user, hostel);
  }

  const staffUserId = req.user?.userId || req.user?._id;

  const menu = await MessMenu.findOneAndUpdate(
    { hostel: hostelId, dayOfWeek },
    {
      $set: {
        breakfast: breakfast || { time: '07:30 - 09:30 AM', items: [] },
        lunch: lunch || { time: '12:30 - 02:30 PM', items: [] },
        snacks: snacks || { time: '05:00 - 06:00 PM', items: [] },
        dinner: dinner || { time: '08:00 - 10:00 PM', items: [] },
        specialNotes: (specialNotes || '').trim(),
        updatedBy: staffUserId,
      },
    },
    { upsert: true, new: true }
  );

  return res.status(200).json({
    success: true,
    data: menu,
    message: `Mess menu for ${dayOfWeek} updated successfully`,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. POLICY & DASHBOARD METRICS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/hostel/policy
 */
const getHostelPolicy = asyncHandler(async (req, res) => {
  const policy = await hostelService.getActivePolicy();
  return res.status(200).json({
    success: true,
    data: policy,
    message: 'Active hostel policy loaded',
  });
});

/**
 * PATCH /api/hostel/policy
 * Admin updates institutional hostel configuration.
 */
const updateHostelPolicy = asyncHandler(async (req, res) => {
  const policy = await hostelService.getActivePolicy();
  const updatable = [
    'applicationWindowOpen',
    'applicationDeadline',
    'maxActiveApplicationsPerStudent',
    'maxAllocationDurationMonths',
    'allowCrossGenderAllocation',
    'requireGuardianConsent',
    'defaultHostelFeeInPaise',
    'defaultSecurityDepositInPaise',
    'defaultMessFeeInPaise',
  ];

  for (const field of updatable) {
    if (req.body[field] !== undefined) {
      policy[field] = req.body[field];
    }
  }

  policy.updatedBy = req.user?.userId || req.user?._id;
  await policy.save();

  await HostelAuditLog.create({
    action: 'policy_updated',
    entityType: 'policy',
    entityId: policy._id,
    performedBy: policy.updatedBy,
    details: req.body,
  });

  return res.status(200).json({
    success: true,
    data: policy,
    message: 'Hostel policy updated successfully',
  });
});

/**
 * GET /api/hostel/student/overview
 * Comprehensive dashboard summary for authenticated student.
 */
const getStudentHostelOverview = asyncHandler(async (req, res) => {
  const student = await resolveCurrentStudent(req);
  if (!student) throw new ApiError(404, 'Student profile not found');

  const [activeAllocation, applications, transferRequests, complaints, policy] = await Promise.all([
    HostelAllocation.findOne({ student: student._id, status: { $in: ['allocated', 'active'] } })
      .populate('hostel')
      .populate('room')
      .populate('bed'),
    HostelApplication.find({ student: student._id })
      .populate('preferredHostels', 'name code type')
      .sort({ createdAt: -1 }),
    HostelTransferRequest.find({ student: student._id })
      .populate('currentHostel', 'name code')
      .populate('currentRoom', 'roomNumber')
      .populate('requestedHostel', 'name code')
      .sort({ createdAt: -1 }),
    Complaint.find({ raisedBy: req.user?.userId || req.user?._id, category: 'hostel' }).sort({ createdAt: -1 }),
    hostelService.getActivePolicy(),
  ]);

  let occupancy = null;
  if (activeAllocation) {
    occupancy = await HostelOccupancy.findOne({ allocation: activeAllocation._id });
  }

  return res.status(200).json({
    success: true,
    data: {
      student,
      activeAllocation,
      occupancy,
      applications,
      transferRequests,
      complaints,
      policy,
    },
    message: 'Student hostel overview loaded',
  });
});

/**
 * GET /api/hostel/admin/metrics
 * Institutional occupancy, application queues, and capacity breakdown.
 */
const getHostelMetrics = asyncHandler(async (req, res) => {
  const wardenFilter = {};
  if (req.user?.role === 'warden') {
    wardenFilter.wardens = req.user?.userId || req.user?._id;
  }

  const hostels = await Hostel.find(wardenFilter);
  const hostelIds = hostels.map((h) => h._id);

  const [totalRooms, totalBeds, occupiedBeds, availableBeds, pendingApps, waitlistedApps, activeAllocations, openComplaints] =
    await Promise.all([
      HostelRoom.countDocuments({ hostel: { $in: hostelIds }, status: { $ne: 'inactive' } }),
      HostelBed.countDocuments({ hostel: { $in: hostelIds }, status: { $ne: 'inactive' } }),
      HostelBed.countDocuments({ hostel: { $in: hostelIds }, status: { $in: ['allocated', 'occupied'] } }),
      HostelBed.countDocuments({ hostel: { $in: hostelIds }, status: 'available' }),
      HostelApplication.countDocuments({ status: 'submitted' }),
      HostelApplication.countDocuments({ status: 'waitlisted' }),
      HostelAllocation.countDocuments({ hostel: { $in: hostelIds }, status: { $in: ['allocated', 'active'] } }),
      Complaint.countDocuments({ category: 'hostel', status: { $in: ['pending', 'in-progress'] } }),
    ]);

  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  const metricsData = {
    totalHostels: hostels.length,
    totalRooms,
    totalBeds,
    occupiedBeds,
    availableBeds,
    occupancyRate,
    occupancyRatePercentage: occupancyRate,
    pendingApps,
    waitlistedApps,
    activeAllocations,
    openComplaints,
  };

  return res.status(200).json({
    success: true,
    data: {
      ...metricsData,
      metrics: metricsData,
    },
    message: 'Hostel metrics loaded successfully',
  });
});

/**
 * GET /api/hostel/reports/export
 * RFC-4180 CSV Export with CWE-1236 Formula Injection defense.
 */
const exportHostelCsv = asyncHandler(async (req, res) => {
  const reportType = req.query.reportType || req.query.type || 'occupancy';
  const { hostelId } = req.query;
  const filter = {};
  if (hostelId) filter.hostel = hostelId;

  let csvContent = '';
  const now = new Date().toISOString().replace(/[:.]/g, '-');

  if (reportType === 'occupancy') {
    const beds = await HostelBed.find(filter)
      .populate('hostel', 'name code')
      .populate('room', 'roomNumber floor roomType')
      .populate({
        path: 'currentStudent',
        select: 'fullName rollNumber program branch semester',
      })
      .sort({ 'hostel.name': 1, 'room.roomNumber': 1 });

    const headers = [
      'Hostel Name',
      'Hostel Code',
      'Room Number',
      'Floor',
      'Room Type',
      'Bed ID',
      'Bed Status',
      'Occupant Name',
      'Roll Number',
      'Branch',
      'Semester',
    ];

    const rows = beds.map((b) => [
      hostelService.sanitizeCsvValue(b.hostel?.name),
      hostelService.sanitizeCsvValue(b.hostel?.code),
      hostelService.sanitizeCsvValue(b.room?.roomNumber),
      hostelService.sanitizeCsvValue(b.room?.floor),
      hostelService.sanitizeCsvValue(b.room?.roomType),
      hostelService.sanitizeCsvValue(b.bedId),
      hostelService.sanitizeCsvValue(b.status),
      hostelService.sanitizeCsvValue(b.currentStudent?.fullName || 'N/A'),
      hostelService.sanitizeCsvValue(b.currentStudent?.rollNumber || 'N/A'),
      hostelService.sanitizeCsvValue(b.currentStudent?.branch || 'N/A'),
      hostelService.sanitizeCsvValue(b.currentStudent?.semester || 'N/A'),
    ]);

    csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="hostel_occupancy_${now}.csv"`);
    return res.status(200).send(csvContent);
  } else {
    // Applications report
    const apps = await HostelApplication.find(filter)
      .populate({
        path: 'student',
        select: 'fullName rollNumber program branch semester gender phone',
      })
      .populate('preferredHostels', 'name code')
      .sort({ createdAt: -1 });

    const headers = [
      'Application Number',
      'Student Name',
      'Roll Number',
      'Gender',
      'Program',
      'Branch',
      'Semester',
      'Status',
      'Distance (KM)',
      'Preferred Hostels',
      'Submission Date',
    ];

    const rows = apps.map((a) => [
      hostelService.sanitizeCsvValue(a.applicationNumber),
      hostelService.sanitizeCsvValue(a.student?.fullName),
      hostelService.sanitizeCsvValue(a.student?.rollNumber),
      hostelService.sanitizeCsvValue(a.student?.gender),
      hostelService.sanitizeCsvValue(a.student?.program),
      hostelService.sanitizeCsvValue(a.student?.branch),
      hostelService.sanitizeCsvValue(a.student?.semester),
      hostelService.sanitizeCsvValue(a.status),
      hostelService.sanitizeCsvValue(a.distanceFromCollegeKm),
      hostelService.sanitizeCsvValue(a.preferredHostels?.map((h) => h.code).join('; ')),
      hostelService.sanitizeCsvValue(new Date(a.createdAt).toLocaleDateString()),
    ]);

    csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="hostel_applications_${now}.csv"`);
    return res.status(200).send(csvContent);
  }
});

module.exports = {
  createHostel,
  getHostels,
  getHostelById,
  updateHostel,
  archiveHostel,
  createRoom,
  getRooms,
  createBed,
  getBeds,
  createApplication,
  getApplications,
  reviewApplication,
  allocateBed,
  getAllocations,
  checkInStudent,
  checkOutStudent,
  requestTransfer,
  getTransferRequests,
  reviewTransfer,
  createHostelComplaint,
  getHostelComplaints,
  updateHostelComplaint,
  getMessMenu,
  updateMessMenu,
  getHostelPolicy,
  updateHostelPolicy,
  getStudentHostelOverview,
  getHostelMetrics,
  exportHostelCsv,
};
