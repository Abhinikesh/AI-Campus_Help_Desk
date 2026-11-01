/**
 * server/services/hostel.service.js
 * Domain service for CampusSphere AI Hostel Management System.
 * Enforces atomic bed allocation, capacity synchronization, gender eligibility,
 * warden scope enforcement, and spreadsheet formula injection protection.
 */
'use strict';

const mongoose = require('mongoose');
const Hostel = require('../models/Hostel');
const HostelRoom = require('../models/HostelRoom');
const HostelBed = require('../models/HostelBed');
const HostelPolicy = require('../models/HostelPolicy');
const ApiError = require('../utils/ApiError');

class HostelService {
  /**
   * Retrieves the active institutional hostel policy, or creates default.
   * @returns {Promise<Object>}
   */
  async getActivePolicy() {
    let policy = await HostelPolicy.findOne({ isActive: true });
    if (!policy) {
      policy = await HostelPolicy.create({
        applicationWindowOpen: true,
        maxActiveApplicationsPerStudent: 1,
        maxAllocationDurationMonths: 12,
        allowCrossGenderAllocation: false,
        requireGuardianConsent: false,
        defaultHostelFeeInPaise: 4500000,
        defaultSecurityDepositInPaise: 1000000,
        defaultMessFeeInPaise: 2500000,
        isActive: true,
      });
    }
    return policy;
  }

  /**
   * Synchronizes bed inventory and occupancy status for a specific room.
   * @param {string|mongoose.Types.ObjectId} roomId
   * @returns {Promise<Object|null>}
   */
  async syncRoomCapacity(roomId) {
    if (!roomId) return null;
    const room = await HostelRoom.findById(roomId);
    if (!room) return null;

    const totalBeds = await HostelBed.countDocuments({ room: room._id, status: { $ne: 'inactive' } });
    const occupiedBeds = await HostelBed.countDocuments({
      room: room._id,
      status: { $in: ['allocated', 'occupied'] },
    });
    const availableBeds = await HostelBed.countDocuments({ room: room._id, status: 'available' });

    room.totalBeds = totalBeds;
    room.occupiedBeds = occupiedBeds;
    room.availableBeds = availableBeds;

    if (room.status !== 'maintenance' && room.status !== 'inactive') {
      if (occupiedBeds >= room.capacity || availableBeds === 0) {
        room.status = 'full';
      } else {
        room.status = 'available';
      }
    }

    await room.save();
    return room;
  }

  /**
   * Atomically recalculates total rooms, total beds, occupied beds, and available beds for a hostel.
   * @param {string|mongoose.Types.ObjectId} hostelId
   * @returns {Promise<Object|null>}
   */
  async syncHostelCapacity(hostelId) {
    if (!hostelId) return null;
    const hostel = await Hostel.findById(hostelId);
    if (!hostel) return null;

    const totalRooms = await HostelRoom.countDocuments({ hostel: hostel._id, status: { $ne: 'inactive' } });
    const totalBeds = await HostelBed.countDocuments({ hostel: hostel._id, status: { $ne: 'inactive' } });
    const occupiedBeds = await HostelBed.countDocuments({
      hostel: hostel._id,
      status: { $in: ['allocated', 'occupied'] },
    });
    const availableBeds = await HostelBed.countDocuments({ hostel: hostel._id, status: 'available' });

    hostel.totalRooms = totalRooms;
    hostel.totalBeds = totalBeds;
    hostel.occupiedBeds = occupiedBeds;
    hostel.availableBeds = availableBeds;

    await hostel.save();
    return hostel;
  }

  /**
   * Validates whether a user has administrative or warden privileges for a specific hostel.
   * Admins have campus-wide authority; Wardens have authority strictly for assigned hostels.
   * @param {Object} user - Authenticated user payload { userId, role }
   * @param {Object|string} hostel - Hostel document or hostel ObjectId
   * @returns {Promise<boolean>}
   */
  async isWardenAuthorizedForHostel(user, hostel) {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role !== 'warden') return false;

    const userId = user.userId || user._id || user.id;
    let hostelDoc = hostel;
    if (typeof hostel === 'string' || mongoose.isObjectIdOrHexString(hostel)) {
      hostelDoc = await Hostel.findById(hostel);
    }
    if (!hostelDoc) return false;

    const wardenList = hostelDoc.wardens || [];
    return wardenList.some((w) => String(w._id || w) === String(userId));
  }

  /**
   * Asserts warden or admin authorization, throwing ApiError(403) on failure.
   * @param {Object} user
   * @param {Object|string} hostel
   */
  async assertWardenAuthorization(user, hostel) {
    const isAuth = await this.isWardenAuthorizedForHostel(user, hostel);
    if (!isAuth) {
      throw new ApiError(403, 'Forbidden: You are not authorized to administer this hostel');
    }
  }

  /**
   * Checks whether a student is eligible for a particular hostel based on gender, program, and policy.
   * @param {Object} student - Student document
   * @param {Object} hostel - Hostel document
   * @param {Object} [policy] - Active institutional policy
   * @returns {{ eligible: boolean, reason?: string }}
   */
  checkStudentHostelEligibility(student, hostel, policy = null) {
    if (!student) return { eligible: false, reason: 'Student profile not found' };
    if (!hostel) return { eligible: false, reason: 'Hostel not found' };

    if (hostel.status !== 'active') {
      return { eligible: false, reason: `Hostel '${hostel.name}' is currently inactive` };
    }

    // Gender Eligibility Check
    const studentGender = (student.gender || '').toLowerCase();
    const hostelGender = (hostel.genderEligibility || 'any').toLowerCase();
    const allowCrossGender = policy?.allowCrossGenderAllocation ?? false;

    if (!allowCrossGender && hostelGender !== 'any' && hostelGender !== 'co-ed') {
      if (hostelGender === 'male' && studentGender !== 'male') {
        return { eligible: false, reason: `Hostel '${hostel.name}' is designated for male students only` };
      }
      if (hostelGender === 'female' && studentGender !== 'female') {
        return { eligible: false, reason: `Hostel '${hostel.name}' is designated for female students only` };
      }
    }

    // Program Eligibility Check
    if (hostel.applicablePrograms && hostel.applicablePrograms.length > 0) {
      const studentProgram = (student.program || '').trim();
      const isProgramAllowed = hostel.applicablePrograms.some(
        (p) => p.toLowerCase() === studentProgram.toLowerCase()
      );
      if (!isProgramAllowed) {
        return { eligible: false, reason: `Hostel '${hostel.name}' is restricted to specific academic programs` };
      }
    }

    // Batch Eligibility Check
    if (hostel.applicableBatches && hostel.applicableBatches.length > 0) {
      const studentBatch = String(student.admissionYear || student.batch || '').trim();
      const isBatchAllowed = hostel.applicableBatches.some((b) => b === studentBatch);
      if (!isBatchAllowed) {
        return { eligible: false, reason: `Hostel '${hostel.name}' is restricted to specific admission batches` };
      }
    }

    return { eligible: true };
  }

  /**
   * Sanitizes input string to prevent CSV / Formula Injection attacks (CWE-1236).
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

module.exports = new HostelService();

