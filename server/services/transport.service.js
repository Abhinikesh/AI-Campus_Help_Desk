/**
 * server/services/transport.service.js
 * Domain Service for CampusSphere AI Transport Management System.
 * Enforces atomic route allocation, vehicle document validity checks,
 * driver license validation, overlapping assignment prevention,
 * capacity synchronization, and spreadsheet formula injection protection.
 */
'use strict';

const mongoose = require('mongoose');
const TransportVehicle = require('../models/TransportVehicle');
const TransportRoute = require('../models/TransportRoute');
const TransportAllocation = require('../models/TransportAllocation');
const TransportStaffRecord = require('../models/TransportStaffRecord');
const TransportPolicy = require('../models/TransportPolicy');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

class TransportService {
  /**
   * Retrieves active institutional transport policy or creates default.
   * @returns {Promise<Object>}
   */
  async getActivePolicy() {
    let policy = await TransportPolicy.findOne({ isActive: true });
    if (!policy) {
      policy = await TransportPolicy.create({
        applicationWindowOpen: true,
        maxActiveApplicationsPerStudent: 1,
        defaultTransportFeeInPaise: 1800000, // Rs. 18,000.00 / semester
        allowRouteChanges: true,
        requireEmergencyContact: true,
        maxCapacityBufferPercent: 0,
        documentExpiryNoticeDays: 30,
        isActive: true,
      });
    }
    return policy;
  }

  /**
   * Recalculates and synchronizes allocated student counts for a route.
   * @param {string|mongoose.Types.ObjectId} routeId
   * @returns {Promise<Object|null>}
   */
  async syncRouteCapacity(routeId) {
    if (!routeId) return null;
    const route = await TransportRoute.findById(routeId);
    if (!route) return null;

    const activeAllocationsCount = await TransportAllocation.countDocuments({
      route: route._id,
      status: { $in: ['allocated', 'active'] },
    });

    route.allocatedStudentsCount = activeAllocationsCount;
    await route.save();
    return route;
  }

  /**
   * Validates whether a vehicle is legally and operationally eligible for route assignment.
   * Checks operational status, capacity, and expired mandatory documents.
   * @param {string|mongoose.Types.ObjectId|Object} vehicleInput
   * @param {number} [requiredCapacity]
   * @returns {Promise<{ eligible: boolean, reason?: string, vehicle?: Object }>}
   */
  async validateVehicleForAssignment(vehicleInput, requiredCapacity = 0) {
    let vehicle = vehicleInput;
    if (typeof vehicleInput === 'string' || mongoose.isObjectIdOrHexString(vehicleInput)) {
      vehicle = await TransportVehicle.findById(vehicleInput);
    }
    if (!vehicle) {
      return { eligible: false, reason: 'Vehicle not found' };
    }

    if (vehicle.status !== 'active') {
      return {
        eligible: false,
        reason: `Vehicle ${vehicle.vehicleCode} (${vehicle.registrationNumber}) is currently '${vehicle.status}' and cannot be assigned to an active route`,
        vehicle,
      };
    }

    if (requiredCapacity > 0 && vehicle.seatingCapacity < requiredCapacity) {
      return {
        eligible: false,
        reason: `Vehicle ${vehicle.vehicleCode} seating capacity (${vehicle.seatingCapacity}) is less than required route capacity (${requiredCapacity})`,
        vehicle,
      };
    }

    const now = new Date();

    // Check mandatory documents if present
    const docs = vehicle.documents || {};
    if (docs.insurance?.expiryDate && new Date(docs.insurance.expiryDate) < now) {
      return {
        eligible: false,
        reason: `Vehicle ${vehicle.vehicleCode} has expired insurance (${new Date(docs.insurance.expiryDate).toLocaleDateString()})`,
        vehicle,
      };
    }

    if (docs.fitnessCertificate?.expiryDate && new Date(docs.fitnessCertificate.expiryDate) < now) {
      return {
        eligible: false,
        reason: `Vehicle ${vehicle.vehicleCode} has expired fitness certificate (${new Date(docs.fitnessCertificate.expiryDate).toLocaleDateString()})`,
        vehicle,
      };
    }

    if (docs.permit?.expiryDate && new Date(docs.permit.expiryDate) < now) {
      return {
        eligible: false,
        reason: `Vehicle ${vehicle.vehicleCode} has expired transport permit (${new Date(docs.permit.expiryDate).toLocaleDateString()})`,
        vehicle,
      };
    }

    return { eligible: true, vehicle };
  }

  /**
   * Validates whether a driver is eligible for active route assignment.
   * Checks license validity and current availability status.
   * @param {string|mongoose.Types.ObjectId} driverUserId
   * @returns {Promise<{ eligible: boolean, reason?: string, staffRecord?: Object }>}
   */
  async validateDriverForAssignment(driverUserId) {
    if (!driverUserId) return { eligible: true };

    const user = await User.findById(driverUserId);
    if (!user) {
      return { eligible: false, reason: 'Driver user account not found' };
    }

    const staffRecord = await TransportStaffRecord.findOne({ user: user._id });
    if (staffRecord) {
      if (['suspended', 'terminated', 'on_leave'].includes(staffRecord.availabilityStatus)) {
        return {
          eligible: false,
          reason: `Driver ${staffRecord.fullName} is currently '${staffRecord.availabilityStatus}'`,
          staffRecord,
        };
      }

      if (staffRecord.licenseExpiryDate && new Date(staffRecord.licenseExpiryDate) < new Date()) {
        return {
          eligible: false,
          reason: `Driver ${staffRecord.fullName} has an expired driving license (${new Date(staffRecord.licenseExpiryDate).toLocaleDateString()})`,
          staffRecord,
        };
      }
    }

    return { eligible: true, staffRecord };
  }

  /**
   * Validates whether an attendant is eligible for route assignment.
   * @param {string|mongoose.Types.ObjectId} attendantUserId
   * @returns {Promise<{ eligible: boolean, reason?: string }>}
   */
  async validateAttendantForAssignment(attendantUserId) {
    if (!attendantUserId) return { eligible: true };

    const user = await User.findById(attendantUserId);
    if (!user) {
      return { eligible: false, reason: 'Attendant user account not found' };
    }

    const staffRecord = await TransportStaffRecord.findOne({ user: user._id });
    if (staffRecord) {
      if (['suspended', 'terminated', 'on_leave'].includes(staffRecord.availabilityStatus)) {
        return {
          eligible: false,
          reason: `Attendant ${staffRecord.fullName} is currently '${staffRecord.availabilityStatus}'`,
        };
      }
    }

    return { eligible: true };
  }

  /**
   * Checks for overlapping vehicle assignments on the same active operational days.
   * @param {string|mongoose.Types.ObjectId} vehicleId
   * @param {string|mongoose.Types.ObjectId} currentRouteId
   * @param {string[]} operationalDays
   * @returns {Promise<Object|null>} Overlapping route or null
   */
  async checkOverlappingVehicleAssignment(vehicleId, currentRouteId = null, operationalDays = []) {
    if (!vehicleId) return null;

    const query = {
      assignedVehicle: vehicleId,
      status: 'active',
    };
    if (currentRouteId) {
      query._id = { $ne: currentRouteId };
    }

    const existingRoutes = await TransportRoute.find(query);
    if (!existingRoutes.length) return null;

    if (!operationalDays || !operationalDays.length) {
      return existingRoutes[0];
    }

    for (const r of existingRoutes) {
      const days = r.operationalDays || [];
      const hasOverlap = operationalDays.some((d) => days.includes(d));
      if (hasOverlap) {
        return r;
      }
    }

    return null;
  }

  /**
   * Checks for overlapping driver assignments on active routes.
   * @param {string|mongoose.Types.ObjectId} driverUserId
   * @param {string|mongoose.Types.ObjectId} currentRouteId
   * @param {string[]} operationalDays
   * @returns {Promise<Object|null>} Overlapping route or null
   */
  async checkOverlappingDriverAssignment(driverUserId, currentRouteId = null, operationalDays = []) {
    if (!driverUserId) return null;

    const query = {
      assignedDriver: driverUserId,
      status: 'active',
    };
    if (currentRouteId) {
      query._id = { $ne: currentRouteId };
    }

    const existingRoutes = await TransportRoute.find(query);
    if (!existingRoutes.length) return null;

    if (!operationalDays || !operationalDays.length) {
      return existingRoutes[0];
    }

    for (const r of existingRoutes) {
      const days = r.operationalDays || [];
      const hasOverlap = operationalDays.some((d) => days.includes(d));
      if (hasOverlap) {
        return r;
      }
    }

    return null;
  }

  /**
   * Checks for overlapping attendant assignments on active routes.
   * @param {string|mongoose.Types.ObjectId} attendantUserId
   * @param {string|mongoose.Types.ObjectId} currentRouteId
   * @param {string[]} operationalDays
   * @returns {Promise<Object|null>} Overlapping route or null
   */
  async checkOverlappingAttendantAssignment(attendantUserId, currentRouteId = null, operationalDays = []) {
    if (!attendantUserId) return null;

    const query = {
      assignedAttendant: attendantUserId,
      status: 'active',
    };
    if (currentRouteId) {
      query._id = { $ne: currentRouteId };
    }

    const existingRoutes = await TransportRoute.find(query);
    if (!existingRoutes.length) return null;

    if (!operationalDays || !operationalDays.length) {
      return existingRoutes[0];
    }

    for (const r of existingRoutes) {
      const days = r.operationalDays || [];
      const hasOverlap = operationalDays.some((d) => days.includes(d));
      if (hasOverlap) {
        return r;
      }
    }

    return null;
  }

  /**
   * Scans for vehicle documents and driver licenses expiring within noticeDays.
   * @param {number} [noticeDays=30]
   * @returns {Promise<Object>}
   */
  async getExpiringDocuments(noticeDays = 30) {
    const now = new Date();
    const thresholdDate = new Date(Date.now() + noticeDays * 24 * 60 * 60 * 1000);

    const vehicles = await TransportVehicle.find({
      status: { $ne: 'retired' },
      $or: [
        { 'documents.insurance.expiryDate': { $lte: thresholdDate } },
        { 'documents.fitnessCertificate.expiryDate': { $lte: thresholdDate } },
        { 'documents.permit.expiryDate': { $lte: thresholdDate } },
        { 'documents.pollutionCertificate.expiryDate': { $lte: thresholdDate } },
      ],
    });

    const drivers = await TransportStaffRecord.find({
      staffRole: 'driver',
      availabilityStatus: { $ne: 'terminated' },
      licenseExpiryDate: { $lte: thresholdDate },
    });

    const vehicleAlerts = [];
    for (const v of vehicles) {
      const docs = v.documents || {};
      for (const [docName, docObj] of Object.entries(docs)) {
        if (docObj?.expiryDate && new Date(docObj.expiryDate) <= thresholdDate) {
          const isExpired = new Date(docObj.expiryDate) < now;
          vehicleAlerts.push({
            vehicleId: v._id,
            vehicleCode: v.vehicleCode,
            registrationNumber: v.registrationNumber,
            documentType: docName,
            expiryDate: docObj.expiryDate,
            isExpired,
            daysRemaining: Math.ceil((new Date(docObj.expiryDate) - now) / (1000 * 60 * 60 * 24)),
          });
        }
      }
    }

    const driverAlerts = drivers.map((d) => ({
      staffId: d._id,
      fullName: d.fullName,
      licenseNumber: d.licenseNumber,
      expiryDate: d.licenseExpiryDate,
      isExpired: new Date(d.licenseExpiryDate) < now,
      daysRemaining: Math.ceil((new Date(d.licenseExpiryDate) - now) / (1000 * 60 * 60 * 24)),
    }));

    return {
      vehicleAlerts,
      driverAlerts,
      totalAlerts: vehicleAlerts.length + driverAlerts.length,
    };
  }

  /**
   * Sanitizes input cell to prevent CSV / Spreadsheet Formula Injection (CWE-1236).
   * @param {string|number|null|undefined} cell
   * @returns {string} Safe CSV cell string
   */
  sanitizeCsvValue(cell) {
    if (cell === null || cell === undefined) return '""';
    let str = String(cell).trim();
    if (/^[=+\-@\t\r]/.test(str)) {
      str = `'${str}`;
    }
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  }
}

module.exports = new TransportService();

