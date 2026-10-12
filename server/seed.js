/**
 * server/seed.js
 * Development seed script.
 * Run: node server/seed.js
 *
 * Creates:
 *   - 2 students, 1 faculty, 1 admin
 *   - Sample subjects, fees, announcements, complaint
 */
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const connectDB = require('./config/db');

const User         = require('./models/User');
const Student      = require('./models/Student');
const Faculty      = require('./models/Faculty');
const Subject      = require('./models/Subject');
const Fee          = require('./models/Fee');
const Complaint    = require('./models/Complaint');
const Announcement = require('./models/Announcement');

const SALT = 12;

const seed = async (shouldExit = true) => {
  try {
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    console.log('🗑️  Clearing existing data...');
    await Promise.all([
      User.deleteMany({}),
      Student.deleteMany({}),
      Faculty.deleteMany({}),
      Subject.deleteMany({}),
      Fee.deleteMany({}),
      Complaint.deleteMany({}),
      Announcement.deleteMany({}),
    ]);
    console.log('✅ Collections cleared');

    // ── Users ────────────────────────────────────────────────────────────────
    console.log('👤 Creating users...');

    const adminHash = await bcrypt.hash('Admin@1234', SALT);
    const admin = await User.create({
      name: 'Campus Admin',
      email: 'admin@campus.edu',
      loginId: 'ADMIN001',
      passwordHash: adminHash,
      role: 'admin',
    });

    const facultyHash = await bcrypt.hash('Faculty@123', SALT);
    const facultyUser = await User.create({
      name: 'Dr. Priya Mehta',
      email: 'priya.mehta@campus.edu',
      loginId: 'FAC001',
      passwordHash: facultyHash,
      role: 'faculty',
    });

    const student1Hash = await bcrypt.hash('Student@123', SALT);
    const student1User = await User.create({
      name: 'Arjun Sharma',
      email: 'arjun.sharma@campus.edu',
      loginId: '20240001', // roll number is the loginId for students
      passwordHash: student1Hash,
      role: 'student',
    });

    const student2Hash = await bcrypt.hash('Student@123', SALT);
    const student2User = await User.create({
      name: 'Abhinikesh',
      email: 'abhinikesh@campus.edu',
      loginId: '20240002',
      passwordHash: student2Hash,
      role: 'student',
    });

    console.log('  ✅ 4 users created');

    // ── Faculty profile ───────────────────────────────────────────────────────
    const facultyProfile = await Faculty.create({
      user: facultyUser._id,
      employeeId: 'FAC001',
      department: 'Computer Science & Engineering',
      designation: 'Associate Professor',
      phone: '9876543210',
    });
    console.log('  ✅ Faculty profile created');

    // ── Subjects ──────────────────────────────────────────────────────────────
    const subjects = await Subject.insertMany([
      { code: 'CS201', name: 'Data Structures',         credits: 4, branch: 'CSE', semester: 4, faculty: facultyUser._id },
      { code: 'CS202', name: 'Algorithm Design',        credits: 4, branch: 'CSE', semester: 4, faculty: facultyUser._id },
      { code: 'CS203', name: 'Database Management',     credits: 3, branch: 'CSE', semester: 4, faculty: facultyUser._id },
      { code: 'CS205', name: 'Web Development',         credits: 3, branch: 'CSE', semester: 4, faculty: facultyUser._id },
      { code: 'CS207', name: 'Computer Networks',       credits: 3, branch: 'CSE', semester: 4, faculty: facultyUser._id },
    ]);
    console.log('  ✅ 5 subjects created');

    // ── Student profiles ──────────────────────────────────────────────────────
    const student1 = await Student.create({
      user: student1User._id,
      rollNumber: '20240001',
      fullName: 'Arjun Sharma',
      email: 'arjun.sharma@campus.edu',
      phone: '9000000001',
      branch: 'Computer Science & Engineering',
      program: 'B.Tech',
      semester: 4,
      section: 'A',
      admissionYear: 2024,
      gender: 'male',
      guardianName: 'Ramesh Sharma',
      guardianPhone: '9100000001',
      address: '12, MG Road, Bangalore - 560001',
      status: 'active',
    });

    const student2 = await Student.create({
      user: student2User._id,
      rollNumber: '20240002',
      fullName: 'Abhinikesh',
      email: 'abhinikesh@campus.edu',
      phone: '9000000002',
      branch: 'Computer Science & Engineering',
      program: 'B.Tech',
      semester: 4,
      section: 'A',
      admissionYear: 2024,
      gender: 'male',
      status: 'active',
    });
    console.log('  ✅ 2 student profiles created');

    // ── Fees ──────────────────────────────────────────────────────────────────
    await Fee.insertMany([
      {
        student: student1._id,
        title: 'Semester 4 Tuition Fee',
        amount: 75000,
        dueDate: new Date('2026-04-20'),
        payments: [
          {
            amount: 75000,
            paidOn: new Date('2026-01-15'),
            mode: 'online',
            reference: 'TXN20260115001',
            receiptNo: 'REC-2026-001',
            recordedBy: admin._id,
          },
        ],
      },
      {
        student: student2._id,
        title: 'Semester 4 Tuition Fee',
        amount: 75000,
        dueDate: new Date('2026-04-20'),
        payments: [
          {
            amount: 37500,
            paidOn: new Date('2026-02-10'),
            mode: 'online',
            reference: 'TXN20260210002',
            receiptNo: 'REC-2026-002',
            recordedBy: admin._id,
          },
        ],
      },
    ]);
    console.log('  ✅ Fee records created');

    // ── Announcements ─────────────────────────────────────────────────────────
    await Announcement.insertMany([
      {
        title: 'Mid-Semester Exams Begin April 12',
        body: 'Mid-semester examinations commence on April 12, 2026. Students must carry their ID cards. Hall tickets available on the portal.',
        audience: 'all',
        createdBy: admin._id,
      },
      {
        title: 'Fee Payment Deadline: April 20',
        body: 'Last date for Semester 4 fee payment is April 20, 2026. A late fee of ₹500/day will be charged after the deadline.',
        audience: 'student',
        createdBy: admin._id,
      },
      {
        title: 'Faculty Meeting — April 8',
        body: 'Mandatory faculty meeting on April 8, 2026 at 11:00 AM in the Conference Hall, Admin Block.',
        audience: 'faculty',
        createdBy: admin._id,
      },
    ]);
    console.log('  ✅ 3 announcements created');

    // ── Sample complaint ──────────────────────────────────────────────────────
    await Complaint.create({
      raisedBy: student1User._id,
      category: 'academic',
      title: 'Result not updated',
      description: 'Data Structures mid-semester result is not visible on the portal.',
      status: 'pending',
    });
    console.log('  ✅ Sample complaint created');

    console.log('\n🎉 Seeding complete!');
    console.log('─────────────────────────────────────────────────');
    console.log('Admin:   loginId=ADMIN001   password=Admin@1234');
    console.log('Faculty: loginId=FAC001     password=Faculty@123');
    console.log('Student: loginId=20240001   password=Student@123');
    console.log('Student: loginId=20240002   password=Student@123');
    console.log('─────────────────────────────────────────────────');

    if (shouldExit) process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    if (shouldExit) process.exit(1);
    throw err;
  }
};

if (require.main === module) {
  seed(true);
}

module.exports = () => seed(false);
