/**
 * server/controllers/transport.controller.js
 * Comprehensive Campus Transport Management Controller.
 * Handles Vehicles, Routes, Stops, Staff, Applications, Allocations,
 * Daily Operations, Maintenance, Incidents, Policies, and CSV Reports.
 */
'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const TransportVehicle = require('../models/TransportVehicle');
const TransportRoute = require('../models/TransportRoute');
const TransportStop = require('../models/TransportStop');
const TransportStaffRecord = require('../models/TransportStaffRecord');
const TransportApplication = require('../models/TransportApplication');
const TransportAllocation = require('../models/TransportAllocation');
const TransportTrip = require('../models/TransportTrip');
const TransportMaintenance = require('../models/TransportMaintenance');
const TransportIncident = require('../models/TransportIncident');
const TransportPolicy = require('../models/TransportPolicy');
const TransportAuditLog = require('../models/TransportAuditLog');
const Complaint = require('../models/Complaint');
const Student = require('../models/Student');
const User = require('../models/User');
const transportService = require('../services/transport.service');
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
// 1. VEHICLE INVENTORY MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/transport/vehicles
 * Admin or Transport Manager registers a new vehicle.
 */
const createVehicle = asyncHandler(async (req, res) => {
  const {
    registrationNumber,
    vehicleCode,
    vehicleType,
    makeAndModel,
    seatingCapacity,
    ownershipType,
    documents,
    fuelType,
    notes,
  } = req.body;

  if (!registrationNumber || !vehicleCode || !makeAndModel || !seatingCapacity) {
    throw new ApiError(400, 'Registration number, vehicle code, make/model, and seating capacity are required');
  }

  const cleanReg = registrationNumber.trim().toUpperCase();
  const existingReg = await TransportVehicle.findOne({ registrationNumber: cleanReg });
  if (existingReg) {
    throw new ApiError(409, `Vehicle with registration '${cleanReg}' is already registered`);
  }

  const cleanCode = vehicleCode.trim().toUpperCase();
  const existingCode = await TransportVehicle.findOne({ vehicleCode: cleanCode });
  if (existingCode) {
    throw new ApiError(409, `Vehicle internal code '${cleanCode}' is already in use`);
  }

  const capacityNum = Number(seatingCapacity);
  if (!Number.isInteger(capacityNum) || capacityNum <= 0) {
    throw new ApiError(400, 'Seating capacity must be a positive integer');
  }

  const staffUserId = req.user?.userId || req.user?._id;

  const vehicle = await TransportVehicle.create({
    registrationNumber: cleanReg,
    vehicleCode: cleanCode,
    vehicleType: vehicleType || 'bus',
    makeAndModel: makeAndModel.trim(),
    seatingCapacity: capacityNum,
    ownershipType: ownershipType || 'institution_owned',
    documents: documents || {},
    fuelType: fuelType || 'diesel',
    notes: (notes || '').trim(),
    createdBy: staffUserId,
    status: 'active',
  });

  await TransportAuditLog.create({
    action: 'vehicle_created',
    entityType: 'vehicle',
    entityId: vehicle._id,
    performedBy: staffUserId,
    details: { registrationNumber: vehicle.registrationNumber, vehicleCode: vehicle.vehicleCode },
  });

  return res.status(201).json({
    success: true,
    data: vehicle,
    message: `Vehicle ${vehicle.vehicleCode} (${vehicle.registrationNumber}) registered successfully`,
  });
});

/**
 * GET /api/transport/vehicles
 * List all vehicles with optional filtering.
 */
const getVehicles = asyncHandler(async (req, res) => {
  const { status, vehicleType, ownershipType, search } = req.query;
  const filter = {};

  if (status && status !== 'all') filter.status = status;
  if (vehicleType && vehicleType !== 'all') filter.vehicleType = vehicleType;
  if (ownershipType && ownershipType !== 'all') filter.ownershipType = ownershipType;

  if (search) {
    const term = search.trim();
    filter.$or = [
      { registrationNumber: { $regex: term, $options: 'i' } },
      { vehicleCode: { $regex: term, $options: 'i' } },
      { makeAndModel: { $regex: term, $options: 'i' } },
    ];
  }

  const vehicles = await TransportVehicle.find(filter)
    .populate('assignedRoute', 'name code')
    .populate('assignedDriver', 'name email phone')
    .populate('assignedAttendant', 'name email phone')
    .sort({ vehicleCode: 1 });

  return res.status(200).json({
    success: true,
    data: vehicles,
    count: vehicles.length,
    message: 'Vehicles retrieved successfully',
  });
});

/**
 * GET /api/transport/vehicles/:id
 * Retrieve single vehicle details.
 */
const getVehicleById = asyncHandler(async (req, res) => {
  const vehicle = await TransportVehicle.findById(req.params.id)
    .populate('assignedRoute')
    .populate('assignedDriver', 'name email')
    .populate('assignedAttendant', 'name email');

  if (!vehicle) {
    throw new ApiError(404, 'Vehicle not found');
  }

  return res.status(200).json({
    success: true,
    data: vehicle,
    message: 'Vehicle details loaded',
  });
});

/**
 * PATCH /api/transport/vehicles/:id
 * Update vehicle details or status.
 */
const updateVehicle = asyncHandler(async (req, res) => {
  const vehicle = await TransportVehicle.findById(req.params.id);
  if (!vehicle) {
    throw new ApiError(404, 'Vehicle not found');
  }

  const { status, maintenanceStatus, documents, notes, seatingCapacity, makeAndModel } = req.body;

  if (status) vehicle.status = status;
  if (maintenanceStatus) vehicle.maintenanceStatus = maintenanceStatus;
  if (notes !== undefined) vehicle.notes = notes.trim();
  if (makeAndModel) vehicle.makeAndModel = makeAndModel.trim();
  if (seatingCapacity) {
    const cap = Number(seatingCapacity);
    if (!Number.isInteger(cap) || cap <= 0) {
      throw new ApiError(400, 'Seating capacity must be a positive integer');
    }
    vehicle.seatingCapacity = cap;
  }

  if (documents) {
    vehicle.documents = { ...vehicle.documents.toObject(), ...documents };
  }

  await vehicle.save();

  await TransportAuditLog.create({
    action: 'vehicle_updated',
    entityType: 'vehicle',
    entityId: vehicle._id,
    performedBy: req.user?.userId || req.user?._id,
    details: { status: vehicle.status, maintenanceStatus: vehicle.maintenanceStatus },
  });

  return res.status(200).json({
    success: true,
    data: vehicle,
    message: `Vehicle ${vehicle.vehicleCode} updated successfully`,
  });
});

/**
 * DELETE /api/transport/vehicles/:id
 * Soft delete / retire vehicle.
 */
const archiveVehicle = asyncHandler(async (req, res) => {
  const vehicle = await TransportVehicle.findById(req.params.id);
  if (!vehicle) {
    throw new ApiError(404, 'Vehicle not found');
  }

  vehicle.status = 'retired';
  await vehicle.save();

  return res.status(200).json({
    success: true,
    data: vehicle,
    message: `Vehicle ${vehicle.vehicleCode} retired`,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. ROUTE & STOP MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/transport/routes
 * Admin or Transport Manager creates a route.
 */
const createRoute = asyncHandler(async (req, res) => {
  const {
    name,
    code,
    startLocation,
    endLocation,
    estimatedDurationMinutes,
    operationalDays,
    schedule,
    maxCapacity,
    academicYear,
    description,
  } = req.body;

  if (!name || !code || !startLocation || !endLocation || !maxCapacity) {
    throw new ApiError(400, 'Route name, code, start location, end destination, and capacity are required');
  }

  const cleanCode = code.trim().toUpperCase();
  const existingRoute = await TransportRoute.findOne({ code: cleanCode });
  if (existingRoute) {
    throw new ApiError(409, `Route code '${cleanCode}' is already in use`);
  }

  const cap = Number(maxCapacity);
  if (!Number.isInteger(cap) || cap <= 0) {
    throw new ApiError(400, 'Route maximum capacity must be a positive integer');
  }

  const staffUserId = req.user?.userId || req.user?._id;

  const route = await TransportRoute.create({
    name: name.trim(),
    code: cleanCode,
    startLocation: startLocation.trim(),
    endLocation: endLocation.trim(),
    estimatedDurationMinutes: Number(estimatedDurationMinutes) || 45,
    operationalDays: operationalDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    schedule: schedule || {},
    maxCapacity: cap,
    academicYear: (academicYear || '2026-2027').trim(),
    description: (description || '').trim(),
    createdBy: staffUserId,
    status: 'active',
  });

  await TransportAuditLog.create({
    action: 'route_created',
    entityType: 'route',
    entityId: route._id,
    performedBy: staffUserId,
    details: { code: route.code, name: route.name, maxCapacity: route.maxCapacity },
  });

  return res.status(201).json({
    success: true,
    data: route,
    message: `Route ${route.code} (${route.name}) created successfully`,
  });
});

/**
 * GET /api/transport/routes
 * List routes with filters.
 */
const getRoutes = asyncHandler(async (req, res) => {
  const { status, academicYear, search } = req.query;
  const filter = {};

  if (status && status !== 'all') filter.status = status;
  if (academicYear) filter.academicYear = academicYear;

  if (search) {
    const term = search.trim();
    filter.$or = [
      { name: { $regex: term, $options: 'i' } },
      { code: { $regex: term, $options: 'i' } },
      { startLocation: { $regex: term, $options: 'i' } },
      { endLocation: { $regex: term, $options: 'i' } },
    ];
  }

  const routes = await TransportRoute.find(filter)
    .populate('assignedVehicle', 'vehicleCode registrationNumber seatingCapacity status fuelType')
    .populate('assignedDriver', 'name email phone')
    .populate('assignedAttendant', 'name email phone')
    .sort({ code: 1 });

  return res.status(200).json({
    success: true,
    data: routes,
    count: routes.length,
    message: 'Routes retrieved successfully',
  });
});

/**
 * GET /api/transport/routes/:id
 * Retrieve single route with ordered stops.
 */
const getRouteById = asyncHandler(async (req, res) => {
  const route = await TransportRoute.findById(req.params.id)
    .populate('assignedVehicle')
    .populate('assignedDriver', 'name email')
    .populate('assignedAttendant', 'name email');

  if (!route) {
    throw new ApiError(404, 'Route not found');
  }

  const stops = await TransportStop.find({ route: route._id, status: 'active' }).sort({ sequence: 1 });

  return res.status(200).json({
    success: true,
    data: {
      ...route.toObject(),
      stops,
    },
    message: 'Route details loaded',
  });
});

/**
 * PATCH /api/transport/routes/:id
 * Update route basic details or schedule.
 */
const updateRoute = asyncHandler(async (req, res) => {
  const route = await TransportRoute.findById(req.params.id);
  if (!route) {
    throw new ApiError(404, 'Route not found');
  }

  const { name, startLocation, endLocation, maxCapacity, operationalDays, schedule, status, description } = req.body;

  if (name) route.name = name.trim();
  if (startLocation) route.startLocation = startLocation.trim();
  if (endLocation) route.endLocation = endLocation.trim();
  if (description !== undefined) route.description = description.trim();
  if (operationalDays) route.operationalDays = operationalDays;
  if (schedule) route.schedule = { ...route.schedule, ...schedule };
  if (status) route.status = status;

  if (maxCapacity) {
    const cap = Number(maxCapacity);
    if (!Number.isInteger(cap) || cap <= 0) {
      throw new ApiError(400, 'Max capacity must be a positive integer');
    }
    if (cap < route.allocatedStudentsCount) {
      throw new ApiError(
        400,
        `Cannot reduce capacity to ${cap}: route already has ${route.allocatedStudentsCount} active student allocations`
      );
    }
    route.maxCapacity = cap;
  }

  await route.save();

  return res.status(200).json({
    success: true,
    data: route,
    message: `Route ${route.code} updated successfully`,
  });
});

/**
 * POST /api/transport/routes/:id/assign
 * Assign vehicle, driver, and attendant to route with conflict detection.
 */
const assignVehicleAndStaffToRoute = asyncHandler(async (req, res) => {
  const route = await TransportRoute.findById(req.params.id);
  if (!route) {
    throw new ApiError(404, 'Route not found');
  }

  const { vehicleId, driverUserId, attendantUserId } = req.body;

  // 1. Vehicle validation
  if (vehicleId) {
    const vehicleValidation = await transportService.validateVehicleForAssignment(vehicleId, route.maxCapacity);
    if (!vehicleValidation.eligible) {
      throw new ApiError(400, vehicleValidation.reason);
    }

    // Check overlapping vehicle assignment
    const overlappingVehicleRoute = await transportService.checkOverlappingVehicleAssignment(
      vehicleId,
      route._id,
      route.operationalDays
    );
    if (overlappingVehicleRoute) {
      throw new ApiError(
        409,
        `Vehicle is already assigned to active route '${overlappingVehicleRoute.code}' on overlapping operational days`
      );
    }

    route.assignedVehicle = vehicleId;
    await TransportVehicle.findByIdAndUpdate(vehicleId, { assignedRoute: route._id });
  }

  // 2. Driver validation
  if (driverUserId) {
    const driverValidation = await transportService.validateDriverForAssignment(driverUserId);
    if (!driverValidation.eligible) {
      throw new ApiError(400, driverValidation.reason);
    }

    // Check overlapping driver assignment
    const overlappingDriverRoute = await transportService.checkOverlappingDriverAssignment(
      driverUserId,
      route._id,
      route.operationalDays
    );
    if (overlappingDriverRoute) {
      throw new ApiError(
        409,
        `Driver is already assigned to active route '${overlappingDriverRoute.code}' on overlapping operational days`
      );
    }

    route.assignedDriver = driverUserId;
    await TransportStaffRecord.findOneAndUpdate({ user: driverUserId }, { assignedRoute: route._id });
  }

  // 3. Attendant validation
  if (attendantUserId) {
    const attendantValidation = await transportService.validateAttendantForAssignment(attendantUserId);
    if (!attendantValidation.eligible) {
      throw new ApiError(400, attendantValidation.reason);
    }

    const overlappingAttendantRoute = await transportService.checkOverlappingAttendantAssignment(
      attendantUserId,
      route._id,
      route.operationalDays
    );
    if (overlappingAttendantRoute) {
      throw new ApiError(
        409,
        `Attendant is already assigned to active route '${overlappingAttendantRoute.code}' on overlapping operational days`
      );
    }

    route.assignedAttendant = attendantUserId;
  }

  await route.save();

  await TransportAuditLog.create({
    action: 'route_assignment_updated',
    entityType: 'route',
    entityId: route._id,
    performedBy: req.user?.userId || req.user?._id,
    details: { vehicleId, driverUserId, attendantUserId },
  });

  return res.status(200).json({
    success: true,
    data: route,
    message: `Operational assignments for Route ${route.code} updated successfully`,
  });
});

/**
 * POST /api/transport/routes/:id/stops
 * Add stop to route. Enforces sequence uniqueness.
 */
const createStop = asyncHandler(async (req, res) => {
  const route = await TransportRoute.findById(req.params.id);
  if (!route) {
    throw new ApiError(404, 'Route not found');
  }

  const {
    stopName,
    stopCode,
    sequence,
    address,
    scheduledMorningPickupTime,
    scheduledEveningDropTime,
    coordinates,
    fareMultiplier,
  } = req.body;

  if (!stopName || sequence === undefined) {
    throw new ApiError(400, 'Stop name and sequence number are required');
  }

  const seq = Number(sequence);
  if (!Number.isInteger(seq) || seq <= 0) {
    throw new ApiError(400, 'Stop sequence must be a positive integer');
  }

  // Check unique sequence on route
  const existingSeq = await TransportStop.findOne({ route: route._id, sequence: seq });
  if (existingSeq) {
    throw new ApiError(409, `Stop sequence ${seq} is already occupied by '${existingSeq.stopName}' on this route`);
  }

  const stop = await TransportStop.create({
    route: route._id,
    stopName: stopName.trim(),
    stopCode: (stopCode || `${route.code}-S${seq}`).trim().toUpperCase(),
    sequence: seq,
    address: (address || '').trim(),
    scheduledMorningPickupTime: (scheduledMorningPickupTime || '').trim(),
    scheduledEveningDropTime: (scheduledEveningDropTime || '').trim(),
    coordinates: coordinates || {},
    fareMultiplier: Number(fareMultiplier) || 1.0,
    status: 'active',
  });

  return res.status(201).json({
    success: true,
    data: stop,
    message: `Stop '${stop.stopName}' (Seq ${stop.sequence}) added to Route ${route.code}`,
  });
});

/**
 * GET /api/transport/routes/:id/stops
 * List stops for a route.
 */
const getStops = asyncHandler(async (req, res) => {
  const stops = await TransportStop.find({ route: req.params.id, status: 'active' }).sort({ sequence: 1 });
  return res.status(200).json({
    success: true,
    data: stops,
    count: stops.length,
    message: 'Stops retrieved',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. STAFF RECORDS (DRIVERS & ATTENDANTS)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/transport/staff
 * Register a driver or attendant profile.
 */
const createStaffRecord = asyncHandler(async (req, res) => {
  const {
    userId,
    staffRole,
    fullName,
    employeeId,
    phone,
    email,
    licenseNumber,
    licenseCategory,
    licenseExpiryDate,
    employmentType,
    emergencyContact,
  } = req.body;

  if (!userId || !staffRole || !fullName || !phone) {
    throw new ApiError(400, 'User ID, staff role (driver/attendant), full name, and phone are required');
  }

  if (staffRole === 'driver') {
    if (!licenseNumber || !licenseExpiryDate) {
      throw new ApiError(400, 'Driving license number and license expiry date are mandatory for drivers');
    }
  }

  const existing = await TransportStaffRecord.findOne({ user: userId });
  if (existing) {
    throw new ApiError(409, 'Staff profile already exists for this user account');
  }

  const staff = await TransportStaffRecord.create({
    user: userId,
    staffRole,
    fullName: fullName.trim(),
    employeeId: (employeeId || '').trim(),
    phone: phone.trim(),
    email: (email || '').trim().toLowerCase(),
    licenseNumber: staffRole === 'driver' ? licenseNumber.trim().toUpperCase() : '',
    licenseCategory: staffRole === 'driver' ? licenseCategory || 'heavy_passenger' : 'none',
    licenseExpiryDate: staffRole === 'driver' && licenseExpiryDate ? new Date(licenseExpiryDate) : null,
    employmentType: employmentType || 'permanent',
    emergencyContact: emergencyContact || {},
    availabilityStatus: 'available',
  });

  return res.status(201).json({
    success: true,
    data: staff,
    message: `${staffRole === 'driver' ? 'Driver' : 'Attendant'} profile registered successfully`,
  });
});

/**
 * GET /api/transport/staff
 * List staff profiles.
 */
const getStaffRecords = asyncHandler(async (req, res) => {
  const { staffRole, availabilityStatus } = req.query;
  const filter = {};

  if (staffRole && staffRole !== 'all') filter.staffRole = staffRole;
  if (availabilityStatus && availabilityStatus !== 'all') filter.availabilityStatus = availabilityStatus;

  const staff = await TransportStaffRecord.find(filter)
    .populate('user', 'name email loginId role')
    .populate('assignedRoute', 'name code')
    .populate('assignedVehicle', 'vehicleCode registrationNumber')
    .sort({ fullName: 1 });

  return res.status(200).json({
    success: true,
    data: staff,
    count: staff.length,
    message: 'Transport staff retrieved',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. STUDENT TRANSPORT APPLICATIONS & REVIEW
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/transport/applications
 * Student applies for transport service.
 */
const createApplication = asyncHandler(async (req, res) => {
  const { preferredRouteId, preferredPickupStopId, preferredDropStopId, academicYear, emergencyContact, contactPhone } =
    req.body;

  const student = await resolveCurrentStudent(req);
  if (!student) {
    throw new ApiError(404, 'Student profile not found');
  }

  const policy = await transportService.getActivePolicy();
  if (!policy.applicationWindowOpen) {
    throw new ApiError(400, 'Transport application window is currently closed by administration');
  }

  if (!preferredRouteId || !preferredPickupStopId) {
    throw new ApiError(400, 'Preferred route and pickup stop are required');
  }

  const route = await TransportRoute.findById(preferredRouteId);
  if (!route || route.status !== 'active') {
    throw new ApiError(400, 'Selected route is inactive or does not exist');
  }

  const stop = await TransportStop.findOne({ _id: preferredPickupStopId, route: route._id });
  if (!stop) {
    throw new ApiError(400, 'Selected pickup stop does not belong to this route');
  }

  const effectiveAcademicYear = (academicYear || route.academicYear || '2026-2027').trim();

  // Prevent duplicate active applications
  const existingActiveApp = await TransportApplication.findOne({
    student: student._id,
    academicYear: effectiveAcademicYear,
    status: { $in: ['submitted', 'pending', 'under_review', 'approved', 'waitlisted', 'allocated'] },
  });

  if (existingActiveApp) {
    throw new ApiError(
      409,
      `You already have an active transport application (#${existingActiveApp.applicationNumber}) for academic year ${effectiveAcademicYear}`
    );
  }

  const applicationNumber = `TAPP-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

  const application = await TransportApplication.create({
    applicationNumber,
    student: student._id,
    academicYear: effectiveAcademicYear,
    preferredRoute: route._id,
    preferredPickupStop: stop._id,
    preferredDropStop: preferredDropStopId || null,
    contactPhone: contactPhone || student.phone || '',
    emergencyContact: emergencyContact || {},
    status: 'submitted',
  });

  // Notify student
  try {
    await notificationService.createNotification({
      recipient: req.user?.userId || req.user?._id,
      title: 'Transport Application Submitted',
      message: `Your transport application #${application.applicationNumber} for Route ${route.code} has been received for review.`,
      category: 'transport',
      priority: 'normal',
      relatedEntityType: 'transport_application',
      relatedEntityId: application._id,
      targetRoute: '/student/transport',
      actorName: 'Transport Department',
      actorRole: 'admin',
      eventId: `transport_app_submit_${application._id}`,
    });
  } catch (err) {
    console.warn('⚠️ Transport application notification skipped:', err.message);
  }

  return res.status(201).json({
    success: true,
    data: application,
    message: 'Transport application submitted successfully',
  });
});

/**
 * GET /api/transport/applications
 * List applications (scoped to student if role=student).
 */
const getApplications = asyncHandler(async (req, res) => {
  const { status, routeId, academicYear, page = 1, limit = 20 } = req.query;
  const filter = {};

  if (req.user?.role === 'student') {
    const student = await resolveCurrentStudent(req);
    if (!student) throw new ApiError(404, 'Student profile not found');
    filter.student = student._id;
  } else {
    if (status && status !== 'all') filter.status = status;
    if (routeId) filter.preferredRoute = routeId;
    if (academicYear) filter.academicYear = academicYear;
  }

  const skip = (Number(page) - 1) * Number(limit);
  const total = await TransportApplication.countDocuments(filter);
  const applications = await TransportApplication.find(filter)
    .populate({
      path: 'student',
      select: 'fullName rollNumber program branch semester gender phone email',
    })
    .populate('preferredRoute', 'name code startLocation endLocation maxCapacity allocatedStudentsCount')
    .populate('preferredPickupStop', 'stopName sequence scheduledMorningPickupTime')
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
    message: 'Transport applications retrieved',
  });
});

/**
 * PATCH /api/transport/applications/:id/review
 * Admin reviews application -> Approve, Reject, Waitlist.
 */
const reviewApplication = asyncHandler(async (req, res) => {
  const { decision, comments, rejectionReason, waitlistNumber } = req.body;

  if (!decision || !['approved', 'rejected', 'waitlisted', 'under_review'].includes(decision)) {
    throw new ApiError(400, 'Valid decision is required (approved, rejected, waitlisted, under_review)');
  }

  if (decision === 'rejected' && (!rejectionReason || rejectionReason.trim().length < 5)) {
    throw new ApiError(400, 'A detailed rejection reason (minimum 5 characters) is required');
  }

  const application = await TransportApplication.findById(req.params.id)
    .populate({
      path: 'student',
      populate: { path: 'user', select: 'name email loginId' },
    })
    .populate('preferredRoute');

  if (!application) {
    throw new ApiError(404, 'Transport application not found');
  }

  if (application.status === 'allocated') {
    throw new ApiError(400, 'Cannot modify application that has already been allocated transport');
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

  await TransportAuditLog.create({
    action: `application_${decision}`,
    entityType: 'application',
    entityId: application._id,
    performedBy: staffUserId,
    details: { decision, comments, rejectionReason },
  });

  // Notify student
  const studentUser = application.student?.user;
  if (studentUser?._id || studentUser) {
    try {
      const msg =
        decision === 'approved'
          ? `Your transport application #${application.applicationNumber} for Route ${application.preferredRoute?.code} has been approved! Route allocation will follow.`
          : decision === 'rejected'
          ? `Your transport application #${application.applicationNumber} was not approved. Reason: ${rejectionReason}`
          : `Your transport application #${application.applicationNumber} is waitlisted (Position: ${waitlistNumber || 'Pending'}).`;

      await notificationService.createNotification({
        recipient: studentUser._id || studentUser,
        title: `Transport Application ${decision.toUpperCase()}`,
        message: msg,
        category: 'transport',
        priority: decision === 'approved' ? 'high' : 'normal',
        relatedEntityType: 'transport_application',
        relatedEntityId: application._id,
        targetRoute: '/student/transport',
        actorName: 'Transport Department',
        actorRole: 'admin',
        eventId: `transport_review_${application._id}_${decision}`,
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
// 5. CONCURRENCY-SAFE STUDENT ROUTE ALLOCATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/transport/allocations
 * Admin allocates an approved student to a route and stop.
 * Uses atomic findOneAndUpdate with capacity condition to prevent race conditions.
 */
const allocateStudent = asyncHandler(async (req, res) => {
  const {
    studentId,
    applicationId,
    routeId,
    pickupStopId,
    dropStopId,
    academicYear,
    startDate,
    endDate,
    seatNumber,
    remarks,
  } = req.body;

  if (!studentId || !routeId || !pickupStopId) {
    throw new ApiError(400, 'Student ID, route ID, and pickup stop ID are required');
  }

  const student = await Student.findById(studentId);
  if (!student) {
    throw new ApiError(404, 'Student not found');
  }

  const route = await TransportRoute.findById(routeId);
  if (!route || route.status !== 'active') {
    throw new ApiError(400, 'Route is inactive or not found');
  }

  // Prevent duplicate active allocations
  const activeExistingAlloc = await TransportAllocation.findOne({
    student: student._id,
    status: { $in: ['allocated', 'active'] },
  });
  if (activeExistingAlloc) {
    throw new ApiError(400, 'Student already possesses an active transport route allocation');
  }

  // Validate pickup stop
  const stop = await TransportStop.findOne({ _id: pickupStopId, route: route._id, status: 'active' });
  if (!stop) {
    throw new ApiError(400, 'Selected pickup stop does not belong to this active route');
  }

  // ATOMIC CAPACITY CHECK & INCREMENT
  // Guarantees zero over-allocation even if two admins submit concurrently
  const updatedRoute = await TransportRoute.findOneAndUpdate(
    {
      _id: route._id,
      allocatedStudentsCount: { $lt: route.maxCapacity },
      status: 'active',
    },
    { $inc: { allocatedStudentsCount: 1 } },
    { new: true }
  );

  if (!updatedRoute) {
    throw new ApiError(409, `Route ${route.code} has reached its maximum passenger capacity limit of ${route.maxCapacity}`);
  }

  const policy = await transportService.getActivePolicy();
  const staffUserId = req.user?.userId || req.user?._id;
  const start = startDate ? new Date(startDate) : new Date();
  const end = endDate ? new Date(endDate) : new Date(start.getTime() + 180 * 24 * 60 * 60 * 1000);

  const allocationNumber = `TALLOC-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

  const allocation = await TransportAllocation.create({
    allocationNumber,
    student: student._id,
    application: applicationId || null,
    route: route._id,
    pickupStop: stop._id,
    dropStop: dropStopId || null,
    vehicle: route.assignedVehicle || null,
    seatNumber: seatNumber || null,
    academicYear: (academicYear || route.academicYear || '2026-2027').trim(),
    startDate: start,
    endDate: end,
    allocatedBy: staffUserId,
    feeAmountInPaise: policy.defaultTransportFeeInPaise,
    status: 'allocated',
    remarks: (remarks || '').trim(),
  });

  if (applicationId) {
    await TransportApplication.findByIdAndUpdate(applicationId, { status: 'allocated' });
  }

  await TransportAuditLog.create({
    action: 'transport_allocated',
    entityType: 'allocation',
    entityId: allocation._id,
    performedBy: staffUserId,
    details: {
      student: student.rollNumber,
      route: route.code,
      stop: stop.stopName,
      capacityNow: updatedRoute.allocatedStudentsCount,
    },
  });

  // Notify student
  try {
    await notificationService.createNotification({
      recipient: student.user,
      title: 'Transport Route Allocated',
      message: `You have been allocated Route ${route.code} (${route.name}) at Stop '${stop.stopName}'. Scheduled pickup: ${stop.scheduledMorningPickupTime || route.schedule?.morningDepartureTime}.`,
      category: 'transport',
      priority: 'high',
      relatedEntityType: 'transport_allocation',
      relatedEntityId: allocation._id,
      targetRoute: '/student/transport',
      actorName: 'Transport Department',
      actorRole: 'admin',
      eventId: `transport_alloc_${allocation._id}`,
    });
  } catch (err) {
    console.warn('⚠️ Allocation notification skipped:', err.message);
  }

  return res.status(201).json({
    success: true,
    data: allocation,
    message: `Student ${student.fullName} successfully allocated to Route ${route.code}`,
  });
});

/**
 * GET /api/transport/allocations
 * List allocations with role-based scoping.
 */
const getAllocations = asyncHandler(async (req, res) => {
  const { routeId, status, academicYear, page = 1, limit = 20 } = req.query;
  const filter = {};

  if (req.user?.role === 'student') {
    const student = await resolveCurrentStudent(req);
    if (!student) throw new ApiError(404, 'Student profile not found');
    filter.student = student._id;
  } else {
    if (routeId) filter.route = routeId;
    if (status && status !== 'all') filter.status = status;
    if (academicYear) filter.academicYear = academicYear;
  }

  const skip = (Number(page) - 1) * Number(limit);
  const total = await TransportAllocation.countDocuments(filter);
  const allocations = await TransportAllocation.find(filter)
    .populate({
      path: 'student',
      select: 'fullName rollNumber program branch semester gender phone email',
    })
    .populate('route', 'name code startLocation endLocation schedule')
    .populate('pickupStop', 'stopName sequence scheduledMorningPickupTime address')
    .populate('vehicle', 'vehicleCode registrationNumber seatingCapacity')
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
    message: 'Allocations retrieved',
  });
});

/**
 * POST /api/transport/allocations/:id/cancel
 * Cancel transport allocation and atomically release route capacity.
 */
const cancelAllocation = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const allocation = await TransportAllocation.findById(req.params.id).populate('route');

  if (!allocation) {
    throw new ApiError(404, 'Allocation not found');
  }

  if (allocation.status === 'cancelled') {
    throw new ApiError(400, 'Allocation is already cancelled');
  }

  allocation.status = 'cancelled';
  allocation.cancellationReason = (reason || 'Administrative cancellation').trim();
  allocation.cancelledAt = new Date();
  await allocation.save();

  // Atomically decrement route capacity
  await TransportRoute.findByIdAndUpdate(allocation.route._id, {
    $inc: { allocatedStudentsCount: -1 },
  });

  await TransportAuditLog.create({
    action: 'allocation_cancelled',
    entityType: 'allocation',
    entityId: allocation._id,
    performedBy: req.user?.userId || req.user?._id,
    details: { reason: allocation.cancellationReason },
  });

  return res.status(200).json({
    success: true,
    data: allocation,
    message: 'Transport allocation cancelled and capacity released',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. DAILY TRIP OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/transport/trips
 * Schedule a daily route trip.
 */
const createTrip = asyncHandler(async (req, res) => {
  const { routeId, vehicleId, driverUserId, tripType, scheduledDeparture, scheduledArrival, notes } = req.body;

  if (!routeId || !scheduledDeparture || !scheduledArrival) {
    throw new ApiError(400, 'Route ID, scheduled departure, and scheduled arrival are required');
  }

  const route = await TransportRoute.findById(routeId);
  if (!route) {
    throw new ApiError(404, 'Route not found');
  }

  const vehicle = vehicleId || route.assignedVehicle;
  const driver = driverUserId || route.assignedDriver;

  if (!vehicle || !driver) {
    throw new ApiError(400, 'Vehicle and driver are required to schedule a trip');
  }

  const trip = await TransportTrip.create({
    route: route._id,
    vehicle,
    driver,
    tripType: tripType || 'morning_pickup',
    scheduledDeparture: new Date(scheduledDeparture),
    scheduledArrival: new Date(scheduledArrival),
    status: 'scheduled',
    notes: (notes || '').trim(),
  });

  return res.status(201).json({
    success: true,
    data: trip,
    message: 'Trip scheduled successfully',
  });
});

/**
 * GET /api/transport/trips
 * List daily trips with filters.
 */
const getTrips = asyncHandler(async (req, res) => {
  const { routeId, status, date } = req.query;
  const filter = {};

  if (routeId) filter.route = routeId;
  if (status && status !== 'all') filter.status = status;

  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    filter.tripDate = { $gte: start, $lte: end };
  }

  if (req.user?.role === 'driver') {
    filter.driver = req.user?.userId || req.user?._id;
  }

  const trips = await TransportTrip.find(filter)
    .populate('route', 'name code startLocation endLocation')
    .populate('vehicle', 'vehicleCode registrationNumber')
    .populate('driver', 'name email phone')
    .sort({ scheduledDeparture: -1 });

  return res.status(200).json({
    success: true,
    data: trips,
    count: trips.length,
    message: 'Trips retrieved',
  });
});

/**
 * PATCH /api/transport/trips/:id
 * Driver or Admin updates trip status (start, complete, delay).
 */
const updateTripStatus = asyncHandler(async (req, res) => {
  const trip = await TransportTrip.findById(req.params.id);
  if (!trip) {
    throw new ApiError(404, 'Trip not found');
  }

  const { status, delayMinutes, delayReason, actualDeparture, actualArrival } = req.body;

  if (status) trip.status = status;
  if (delayMinutes !== undefined) trip.delayMinutes = Number(delayMinutes);
  if (delayReason) trip.delayReason = delayReason.trim();
  if (actualDeparture) trip.actualDeparture = new Date(actualDeparture);
  if (actualArrival) trip.actualArrival = new Date(actualArrival);

  if (status === 'in_progress' && !trip.actualDeparture) {
    trip.actualDeparture = new Date();
  }
  if (status === 'completed' && !trip.actualArrival) {
    trip.actualArrival = new Date();
  }

  await trip.save();

  return res.status(200).json({
    success: true,
    data: trip,
    message: `Trip status updated to ${trip.status}`,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. MAINTENANCE & INCIDENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/transport/maintenance
 * Record a vehicle maintenance service.
 */
const recordMaintenance = asyncHandler(async (req, res) => {
  const {
    vehicleId,
    maintenanceType,
    description,
    serviceDate,
    nextServiceDate,
    costInPaise,
    serviceProvider,
    odometerReadingKm,
    downtimeDays,
  } = req.body;

  if (!vehicleId || !maintenanceType || !description || !serviceProvider) {
    throw new ApiError(400, 'Vehicle ID, maintenance type, description, and service provider are required');
  }

  const vehicle = await TransportVehicle.findById(vehicleId);
  if (!vehicle) {
    throw new ApiError(404, 'Vehicle not found');
  }

  const staffUserId = req.user?.userId || req.user?._id;

  const maintenance = await TransportMaintenance.create({
    vehicle: vehicle._id,
    maintenanceType,
    description: description.trim(),
    serviceDate: serviceDate ? new Date(serviceDate) : new Date(),
    nextServiceDate: nextServiceDate ? new Date(nextServiceDate) : null,
    costInPaise: Number(costInPaise) || 0,
    serviceProvider: serviceProvider.trim(),
    odometerReadingKm: Number(odometerReadingKm) || 0,
    downtimeDays: Number(downtimeDays) || 0,
    recordedBy: staffUserId,
    status: 'completed',
  });

  return res.status(201).json({
    success: true,
    data: maintenance,
    message: 'Vehicle maintenance record saved',
  });
});

/**
 * GET /api/transport/maintenance
 * List vehicle maintenance logs.
 */
const getMaintenanceRecords = asyncHandler(async (req, res) => {
  const { vehicleId } = req.query;
  const filter = {};
  if (vehicleId) filter.vehicle = vehicleId;

  const records = await TransportMaintenance.find(filter)
    .populate('vehicle', 'vehicleCode registrationNumber makeAndModel')
    .sort({ serviceDate: -1 });

  return res.status(200).json({
    success: true,
    data: records,
    count: records.length,
    message: 'Maintenance records retrieved',
  });
});

/**
 * POST /api/transport/incidents
 * Log a transport safety, delay, or breakdown incident.
 */
const reportIncident = asyncHandler(async (req, res) => {
  const { routeId, vehicleId, category, severity, title, description } = req.body;

  if (!routeId || !category || !title || !description) {
    throw new ApiError(400, 'Route ID, category, title, and description are required');
  }

  const staffUserId = req.user?.userId || req.user?._id;
  const incidentNumber = `TINC-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

  const incident = await TransportIncident.create({
    incidentNumber,
    route: routeId,
    vehicle: vehicleId || null,
    reportedBy: staffUserId,
    category,
    severity: severity || 'medium',
    title: title.trim(),
    description: description.trim(),
    resolutionStatus: 'reported',
  });

  return res.status(201).json({
    success: true,
    data: incident,
    message: 'Incident reported successfully',
  });
});

/**
 * GET /api/transport/incidents
 * List incidents.
 */
const getIncidents = asyncHandler(async (req, res) => {
  const { routeId, severity, status } = req.query;
  const filter = {};

  if (routeId) filter.route = routeId;
  if (severity) filter.severity = severity;
  if (status) filter.resolutionStatus = status;

  const incidents = await TransportIncident.find(filter)
    .populate('route', 'name code')
    .populate('vehicle', 'vehicleCode registrationNumber')
    .populate('reportedBy', 'name email role')
    .sort({ incidentDate: -1 });

  return res.status(200).json({
    success: true,
    data: incidents,
    count: incidents.length,
    message: 'Incidents retrieved',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. POLICY, STUDENT OVERVIEW & METRICS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/transport/policy
 * Retrieve institutional transport policy.
 */
const getTransportPolicy = asyncHandler(async (req, res) => {
  const policy = await transportService.getActivePolicy();
  return res.status(200).json({
    success: true,
    data: policy,
    message: 'Transport policy retrieved',
  });
});

/**
 * PATCH /api/transport/policy
 * Admin updates transport policy.
 */
const updateTransportPolicy = asyncHandler(async (req, res) => {
  const policy = await transportService.getActivePolicy();
  const { applicationWindowOpen, defaultTransportFeeInPaise, allowRouteChanges, documentExpiryNoticeDays } = req.body;

  if (applicationWindowOpen !== undefined) policy.applicationWindowOpen = Boolean(applicationWindowOpen);
  if (defaultTransportFeeInPaise !== undefined) {
    const fee = Number(defaultTransportFeeInPaise);
    if (!Number.isInteger(fee) || fee < 0) {
      throw new ApiError(400, 'Fee in paise must be a non-negative integer');
    }
    policy.defaultTransportFeeInPaise = fee;
  }
  if (allowRouteChanges !== undefined) policy.allowRouteChanges = Boolean(allowRouteChanges);
  if (documentExpiryNoticeDays !== undefined) policy.documentExpiryNoticeDays = Number(documentExpiryNoticeDays);

  await policy.save();

  return res.status(200).json({
    success: true,
    data: policy,
    message: 'Transport policy updated successfully',
  });
});

/**
 * GET /api/transport/student/overview
 * Comprehensive student transport dashboard payload.
 */
const getStudentTransportOverview = asyncHandler(async (req, res) => {
  const student = await resolveCurrentStudent(req);
  if (!student) {
    throw new ApiError(404, 'Student profile not found');
  }

  const activeAllocation = await TransportAllocation.findOne({
    student: student._id,
    status: { $in: ['allocated', 'active'] },
  })
    .populate({
      path: 'route',
      populate: [
        { path: 'assignedVehicle', select: 'vehicleCode registrationNumber seatingCapacity fuelType' },
        { path: 'assignedDriver', select: 'name phone' },
        { path: 'assignedAttendant', select: 'name phone' },
      ],
    })
    .populate('pickupStop')
    .populate('dropStop');

  let routeStops = [];
  if (activeAllocation?.route?._id) {
    routeStops = await TransportStop.find({ route: activeAllocation.route._id, status: 'active' }).sort({ sequence: 1 });
  }

  const applications = await TransportApplication.find({ student: student._id })
    .populate('preferredRoute', 'name code')
    .populate('preferredPickupStop', 'stopName scheduledMorningPickupTime')
    .sort({ createdAt: -1 });

  const policy = await transportService.getActivePolicy();

  return res.status(200).json({
    success: true,
    data: {
      student: {
        id: student._id,
        name: student.fullName,
        rollNumber: student.rollNumber,
      },
      hasActiveTransport: Boolean(activeAllocation),
      allocation: activeAllocation,
      routeStops,
      applications,
      policy: {
        applicationWindowOpen: policy.applicationWindowOpen,
        defaultFeeInPaise: policy.defaultTransportFeeInPaise,
      },
    },
    message: 'Student transport overview loaded',
  });
});

/**
 * GET /api/transport/admin/metrics
 * Real-time transport system metrics calculated directly from database.
 */
const getTransportMetrics = asyncHandler(async (req, res) => {
  const [vehicles, routes, allocations, pendingApps, openIncidents, expiringDocs] = await Promise.all([
    TransportVehicle.find(),
    TransportRoute.find(),
    TransportAllocation.find({ status: { $in: ['allocated', 'active'] } }),
    TransportApplication.countDocuments({ status: { $in: ['submitted', 'pending', 'under_review'] } }),
    TransportIncident.countDocuments({ resolutionStatus: { $in: ['reported', 'investigating', 'action_taken'] } }),
    transportService.getExpiringDocuments(30),
  ]);

  const totalVehicles = vehicles.length;
  const activeVehicles = vehicles.filter((v) => v.status === 'active').length;
  const underMaintenanceVehicles = vehicles.filter((v) => v.status === 'under_maintenance').length;

  const totalRoutes = routes.length;
  const activeRoutes = routes.filter((r) => r.status === 'active').length;
  const totalCapacity = routes.reduce((sum, r) => sum + (r.maxCapacity || 0), 0);
  const allocatedStudents = allocations.length;
  const availableCapacity = Math.max(0, totalCapacity - allocatedStudents);
  const occupancyRate = totalCapacity > 0 ? Math.round((allocatedStudents / totalCapacity) * 100) : 0;

  const metricsData = {
    totalVehicles,
    activeVehicles,
    underMaintenanceVehicles,
    totalRoutes,
    activeRoutes,
    totalCapacity,
    allocatedStudents,
    availableCapacity,
    occupancyRate,
    occupancyRatePercentage: occupancyRate,
    pendingApps,
    openIncidents,
    expiringDocumentsCount: expiringDocs.totalAlerts,
  };

  return res.status(200).json({
    success: true,
    data: {
      ...metricsData,
      metrics: metricsData,
      expiringDocuments: expiringDocs,
    },
    message: 'Transport metrics loaded successfully',
  });
});

/**
 * GET /api/transport/reports/export
 * RFC-4180 CSV export with formula injection defense.
 */
const exportTransportCsv = asyncHandler(async (req, res) => {
  const reportType = req.query.reportType || req.query.type || 'routes';
  const now = new Date().toISOString().replace(/[:.]/g, '-');

  let csvContent = '';

  if (reportType === 'routes') {
    const routes = await TransportRoute.find()
      .populate('assignedVehicle', 'vehicleCode registrationNumber')
      .populate('assignedDriver', 'name phone');

    const headers = [
      'Route Code',
      'Route Name',
      'Start Location',
      'End Destination',
      'Max Capacity',
      'Allocated Students',
      'Available Capacity',
      'Vehicle Code',
      'Registration',
      'Driver Name',
      'Status',
    ];

    const rows = routes.map((r) => [
      transportService.sanitizeCsvValue(r.code),
      transportService.sanitizeCsvValue(r.name),
      transportService.sanitizeCsvValue(r.startLocation),
      transportService.sanitizeCsvValue(r.endLocation),
      transportService.sanitizeCsvValue(r.maxCapacity),
      transportService.sanitizeCsvValue(r.allocatedStudentsCount),
      transportService.sanitizeCsvValue(Math.max(0, r.maxCapacity - r.allocatedStudentsCount)),
      transportService.sanitizeCsvValue(r.assignedVehicle?.vehicleCode || 'Unassigned'),
      transportService.sanitizeCsvValue(r.assignedVehicle?.registrationNumber || 'Unassigned'),
      transportService.sanitizeCsvValue(r.assignedDriver?.name || 'Unassigned'),
      transportService.sanitizeCsvValue(r.status),
    ]);

    csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="transport_routes_${now}.csv"`);
    return res.status(200).send(csvContent);
  } else {
    // Allocations export
    const allocations = await TransportAllocation.find()
      .populate('student', 'fullName rollNumber program branch semester')
      .populate('route', 'code name')
      .populate('pickupStop', 'stopName sequence')
      .populate('vehicle', 'vehicleCode');

    const headers = [
      'Allocation Number',
      'Roll Number',
      'Student Name',
      'Program',
      'Branch',
      'Semester',
      'Route Code',
      'Route Name',
      'Pickup Stop',
      'Vehicle Code',
      'Status',
    ];

    const rows = allocations.map((a) => [
      transportService.sanitizeCsvValue(a.allocationNumber),
      transportService.sanitizeCsvValue(a.student?.rollNumber),
      transportService.sanitizeCsvValue(a.student?.fullName),
      transportService.sanitizeCsvValue(a.student?.program),
      transportService.sanitizeCsvValue(a.student?.branch),
      transportService.sanitizeCsvValue(a.student?.semester),
      transportService.sanitizeCsvValue(a.route?.code),
      transportService.sanitizeCsvValue(a.route?.name),
      transportService.sanitizeCsvValue(a.pickupStop?.stopName),
      transportService.sanitizeCsvValue(a.vehicle?.vehicleCode || 'TBD'),
      transportService.sanitizeCsvValue(a.status),
    ]);

    csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="transport_allocations_${now}.csv"`);
    return res.status(200).send(csvContent);
  }
});

module.exports = {
  createVehicle,
  getVehicles,
  getVehicleById,
  updateVehicle,
  archiveVehicle,
  createRoute,
  getRoutes,
  getRouteById,
  updateRoute,
  assignVehicleAndStaffToRoute,
  createStop,
  getStops,
  createStaffRecord,
  getStaffRecords,
  createApplication,
  getApplications,
  reviewApplication,
  allocateStudent,
  getAllocations,
  cancelAllocation,
  createTrip,
  getTrips,
  updateTripStatus,
  recordMaintenance,
  getMaintenanceRecords,
  reportIncident,
  getIncidents,
  getTransportPolicy,
  updateTransportPolicy,
  getStudentTransportOverview,
  getTransportMetrics,
  exportTransportCsv,
};

