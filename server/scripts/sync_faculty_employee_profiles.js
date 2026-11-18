/**
 * server/scripts/sync_faculty_employee_profiles.js
 * Syncs and provisions EmployeeProfile records, Departments, and Designations
 * for all registered Faculty members.
 * Part 10.7: Separates employee-profile synchronization from leave-policy creation.
 * Unapproved default leave policies (CL/SL/EL) are never created silently.
 */
'use strict';

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const User = require('../models/User');
const Faculty = require('../models/Faculty');
const Department = require('../models/Department');
const Designation = require('../models/Designation');
const EmployeeProfile = require('../models/EmployeeProfile');
const LeavePolicy = require('../models/LeavePolicy');
const { hrService } = require('../services/hr.service');

async function syncFacultyProfiles(options = {}) {
  const uri = options.mongoUri || process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27018/campus-erp';

  if (mongoose.connection.readyState === 0) {
    console.log('Connecting to MongoDB at:', uri);
    await mongoose.connect(uri);
  }

  // 1. Ensure Standard Departments
  const deptDefs = [
    { name: 'Computer Science & Engineering', code: 'CSE', type: 'academic' },
    { name: 'Career Development Centre', code: 'CDC', type: 'academic' },
    { name: 'Electronics & Communication Engineering', code: 'ECE', type: 'academic' },
    { name: 'Mechanical Engineering', code: 'MECH', type: 'academic' },
    { name: 'Human Resources & Administration', code: 'HR_ADMIN', type: 'administrative' }
  ];

  const deptMap = {};
  for (const d of deptDefs) {
    let dept = await Department.findOne({ code: d.code });
    if (!dept) {
      try {
        dept = await Department.create({ ...d, isActive: true });
        console.log(`Created department: ${d.name} (${d.code})`);
      } catch (err) {
        if (err.code === 11000) {
          dept = await Department.findOne({ code: d.code });
        } else {
          throw err;
        }
      }
    }
    deptMap[d.code] = dept;
  }

  // 2. Ensure Standard Designations
  const desigDefs = [
    { name: 'Associate Professor', title: 'Associate Professor', code: 'ASSOC_PROF', category: 'teaching_faculty', department: deptMap['CSE']._id },
    { name: 'Assistant Professor', title: 'Assistant Professor', code: 'ASST_PROF', category: 'teaching_faculty', department: deptMap['CSE']._id },
    { name: 'Professor', title: 'Professor', code: 'PROF', category: 'teaching_faculty', department: deptMap['CSE']._id },
    { name: 'Dean Academics', title: 'Dean Academics', code: 'DEAN', category: 'teaching_faculty', department: deptMap['CSE']._id }
  ];

  const desigMap = {};
  for (const d of desigDefs) {
    let desig = await Designation.findOne({ code: d.code });
    if (!desig) {
      try {
        desig = await Designation.create(d);
        console.log(`Created designation: ${d.name} (${d.code})`);
      } catch (err) {
        if (err.code === 11000) {
          desig = await Designation.findOne({ code: d.code });
        } else {
          throw err;
        }
      }
    }
    desigMap[d.code] = desig;
  }

  // 3. Preflight Validation: Audit Existing Leave Policies
  // Note (Part 10.7): Unapproved automatic default leave policy creation (CL/SL/EL)
  // has been completely removed. Institutional policies must be created administratively.
  const activePolicies = await LeavePolicy.find({ isActive: true });
  const hasApprovedPolicies = activePolicies.length > 0;

  if (!hasApprovedPolicies) {
    console.log('⚠️  [Preflight Notice] Zero active LeavePolicy records found in database.');
    console.log('   EmployeeProfile synchronization will proceed safely, but leave balance allocation is skipped.');
    console.log('   Approved institutional leave policies must be created administratively before balances can be allocated.');
  } else {
    console.log(`ℹ️  [Preflight] Verified ${activePolicies.length} active LeavePolicy record(s) available.`);
  }

  // 4. Sync Faculty to EmployeeProfile
  const facultyUsers = await User.find({ role: 'faculty' });
  console.log(`Found ${facultyUsers.length} faculty users`);

  let createdCount = 0;
  let existingCount = 0;
  let balancesInitializedCount = 0;

  for (const u of facultyUsers) {
    let employee = await EmployeeProfile.findOne({ user: u._id });
    const fac = await Faculty.findOne({ user: u._id });

    // Determine Dept
    let assignedDept = deptMap['CSE'];
    if (fac?.department) {
      const dName = fac.department.toLowerCase();
      if (dName.includes('cdc')) assignedDept = deptMap['CDC'] || deptMap['CSE'];
      else if (dName.includes('ece')) assignedDept = deptMap['ECE'] || deptMap['CSE'];
      else if (dName.includes('mech')) assignedDept = deptMap['MECH'] || deptMap['CSE'];
    }

    // Determine Desig
    let assignedDesig = desigMap['ASST_PROF'];
    if (fac?.designation) {
      const dTitle = fac.designation.toLowerCase();
      if (dTitle.includes('assoc')) assignedDesig = desigMap['ASSOC_PROF'] || desigMap['ASST_PROF'];
      else if (dTitle.includes('dean')) assignedDesig = desigMap['DEAN'] || desigMap['ASST_PROF'];
      else if (dTitle === 'professor') assignedDesig = desigMap['PROF'] || desigMap['ASST_PROF'];
    }

    const nameParts = (u.name || 'Faculty Member').trim().split(/\s+/);
    const firstName = nameParts[0] || 'Faculty';
    const lastName = nameParts.slice(1).join(' ') || 'Member';
    const empId = fac?.employeeId || `FAC-${String(u._id).slice(-4).toUpperCase()}`;

    if (!employee) {
      try {
        employee = await EmployeeProfile.create({
          employeeId: empId,
          user: u._id,
          firstName,
          lastName,
          displayName: u.name,
          officialEmail: u.email,
          phone: fac?.phone || u.phone || '',
          employeeCategory: 'teaching_faculty',
          department: assignedDept._id,
          designation: assignedDesig._id,
          employmentType: 'permanent',
          employmentStatus: 'active',
          joiningDate: fac?.createdAt || u.createdAt || new Date(),
          onboardingStatus: 'completed'
        });
        createdCount++;
        console.log(`Created EmployeeProfile for: ${u.email} (${empId}) - ${u.name}`);
      } catch (err) {
        if (err.code === 11000) {
          employee = await EmployeeProfile.findOne({ user: u._id });
          existingCount++;
        } else {
          throw err;
        }
      }
    } else {
      existingCount++;
    }

    // Initialize leave balances only if approved policies exist
    if (hasApprovedPolicies) {
      try {
        await hrService.initializeLeaveBalancesForEmployee(employee._id, new Date().getFullYear(), u._id);
        balancesInitializedCount++;
      } catch (e) {
        // Balances already exist or employee category has no matching policy
      }
    }
  }

  console.log(`\nSync Summary:`);
  console.log(`- Created EmployeeProfiles: ${createdCount}`);
  console.log(`- Existing EmployeeProfiles: ${existingCount}`);
  console.log(`- Total synced: ${createdCount + existingCount}`);
  console.log(`- Leave Policies Active: ${activePolicies.length}`);
  console.log(`- Balances Initialized: ${balancesInitializedCount}`);

  if (!options.skipDisconnect && mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('Done!');
  }

  return {
    createdCount,
    existingCount,
    totalSynced: createdCount + existingCount,
    activePoliciesCount: activePolicies.length,
    balancesInitializedCount,
  };
}

module.exports = { syncFacultyProfiles };

if (require.main === module) {
  syncFacultyProfiles().catch(err => {
    console.error('Sync failed:', err);
    process.exit(1);
  });
}
