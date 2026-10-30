/**
 * server/seed.js
 * Comprehensive development seed script with Smart Attendance data.
 * Run: node server/seed.js
 */
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const connectDB = require('./config/db');

const User               = require('./models/User');
const Student            = require('./models/Student');
const Faculty            = require('./models/Faculty');
const Subject            = require('./models/Subject');
const Fee                = require('./models/Fee');
const Complaint          = require('./models/Complaint');
const Announcement       = require('./models/Announcement');
const Timetable          = require('./models/Timetable');
const Attendance         = require('./models/Attendance');
const AttendanceSession  = require('./models/AttendanceSession');
const FaceEmbedding      = require('./models/FaceEmbedding');
const AttendanceSettings = require('./models/AttendanceSettings');

const SALT = 10;

const seed = async (shouldExit = true) => {
  try {
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    console.log('🗑️  Clearing existing collections...');
    await Promise.all([
      User.deleteMany({}),
      Student.deleteMany({}),
      Faculty.deleteMany({}),
      Subject.deleteMany({}),
      Fee.deleteMany({}),
      Complaint.deleteMany({}),
      Announcement.deleteMany({}),
      Timetable.deleteMany({}),
      Attendance.deleteMany({}),
      AttendanceSession.deleteMany({}),
      FaceEmbedding.deleteMany({}),
      AttendanceSettings.deleteMany({}),
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

    const studentHash = await bcrypt.hash('Student@123', SALT);

    const studentData = [
      { name: 'Arjun Sharma', roll: '20240001', gender: 'male', phone: '9000000001' },
      { name: 'Abhinikesh',   roll: '20240002', gender: 'male', phone: '9000000002' },
      { name: 'Rohan Verma',  roll: '20240003', gender: 'male', phone: '9000000003' },
      { name: 'Sneha Patel',  roll: '20240004', gender: 'female', phone: '9000000004' },
      { name: 'Ananya Rao',   roll: '20240005', gender: 'female', phone: '9000000005' },
      { name: 'Aditya Nair',  roll: '20240006', gender: 'male', phone: '9000000006' },
      { name: 'Meera Iyer',   roll: '20240007', gender: 'female', phone: '9000000007' },
      { name: 'Kabir Singh',  roll: '20240008', gender: 'male', phone: '9000000008' },
    ];

    const studentUsers = [];
    const studentProfiles = [];

    for (const s of studentData) {
      const u = await User.create({
        name: s.name,
        email: `${s.roll.toLowerCase()}@campus.edu`,
        loginId: s.roll,
        passwordHash: studentHash,
        role: 'student',
      });
      studentUsers.push(u);

      const sp = await Student.create({
        user: u._id,
        rollNumber: s.roll,
        fullName: s.name,
        email: u.email,
        phone: s.phone,
        branch: 'Computer Science & Engineering',
        program: 'B.Tech',
        semester: 4,
        section: 'A',
        admissionYear: 2024,
        gender: s.gender,
        status: 'active',
      });
      studentProfiles.push(sp);
    }
    console.log(`  ✅ 1 Admin, 1 Faculty, and ${studentProfiles.length} Students created`);

    // ── Faculty Profile ───────────────────────────────────────────────────────
    await Faculty.create({
      user: facultyUser._id,
      employeeId: 'FAC001',
      department: 'Computer Science & Engineering',
      designation: 'Associate Professor',
      phone: '9876543210',
    });

    // ── Subjects ──────────────────────────────────────────────────────────────
    const subjects = await Subject.insertMany([
      { code: 'CS201', name: 'Data Structures & Algorithms', credits: 4, branch: 'CSE', semester: 4, faculty: facultyUser._id },
      { code: 'CS202', name: 'Database Management Systems', credits: 4, branch: 'CSE', semester: 4, faculty: facultyUser._id },
      { code: 'CS203', name: 'Operating Systems',           credits: 3, branch: 'CSE', semester: 4, faculty: facultyUser._id },
      { code: 'CS205', name: 'Computer Networks',           credits: 3, branch: 'CSE', semester: 4, faculty: facultyUser._id },
      { code: 'CS207', name: 'Full-Stack Web Development',  credits: 3, branch: 'CSE', semester: 4, faculty: facultyUser._id },
    ]);
    console.log('  ✅ 5 Subjects created');

    // ── Timetable ─────────────────────────────────────────────────────────────
    await Timetable.insertMany([
      { subject: subjects[0]._id, dayOfWeek: 1, startTime: '09:00 AM', endTime: '10:00 AM', room: 'Hall 301' },
      { subject: subjects[1]._id, dayOfWeek: 1, startTime: '11:15 AM', endTime: '12:15 PM', room: 'Hall 301' },
      { subject: subjects[2]._id, dayOfWeek: 2, startTime: '10:00 AM', endTime: '11:00 AM', room: 'Hall 301' },
      { subject: subjects[3]._id, dayOfWeek: 3, startTime: '09:00 AM', endTime: '10:00 AM', room: 'Hall 302' },
      { subject: subjects[4]._id, dayOfWeek: 4, startTime: '02:00 PM', endTime: '04:00 PM', room: 'Computer Lab 2' },
      { subject: subjects[0]._id, dayOfWeek: 5, startTime: '11:15 AM', endTime: '12:15 PM', room: 'Hall 301' },
    ]);
    console.log('  ✅ Timetable entries created');

    // ── Settings ──────────────────────────────────────────────────────────────
    await AttendanceSettings.create({
      minAttendancePercent: 75,
      defaultSessionDurationMinutes: 60,
      verificationRetryLimit: 3,
      faceConfidenceThreshold: 0.65,
      allowManualOverride: true,
      biometricRetentionDays: 365,
    });

    // ── Face Biometric Enrollments ────────────────────────────────────────────
    await FaceEmbedding.create({
      student: studentProfiles[0]._id, // Arjun
      consentGiven: true,
      consentDate: new Date('2026-02-01'),
      enrolledAt: new Date('2026-02-01'),
      isActive: true,
      status: 'enrolled',
      samplesCaptured: 3,
      imageQualityScore: 95,
    });

    await FaceEmbedding.create({
      student: studentProfiles[1]._id, // Abhinikesh
      consentGiven: true,
      consentDate: new Date('2026-02-05'),
      enrolledAt: new Date('2026-02-05'),
      isActive: true,
      status: 'enrolled',
      samplesCaptured: 3,
      imageQualityScore: 92,
    });

    // ── Attendance Sessions & Records ─────────────────────────────────────────
    console.log('📅 Generating Smart Attendance sessions and records...');
    const pastDates = [
      '2026-04-01', '2026-04-03', '2026-04-06', '2026-04-08',
      '2026-04-10', '2026-04-13', '2026-04-15', '2026-04-17',
      '2026-04-20', '2026-04-22', '2026-04-24', '2026-04-27'
    ];

    let sessionIdx = 0;
    for (const d of pastDates) {
      for (let p = 0; p < 2; p++) {
        const sub = subjects[(sessionIdx + p) % subjects.length];
        const sess = await AttendanceSession.create({
          subject: sub._id,
          faculty: facultyUser._id,
          date: d,
          period: p + 1,
          startTime: p === 0 ? '09:00 AM' : '11:15 AM',
          endTime: p === 0 ? '10:00 AM' : '12:15 PM',
          sessionType: 'regular',
          attendanceMethod: 'face',
          branch: 'CSE',
          semester: 4,
          section: 'A',
          status: 'finalized',
          totalStudents: studentProfiles.length,
          presentCount: 0,
        });

        let pCount = 0;
        for (let sIdx = 0; sIdx < studentProfiles.length; sIdx++) {
          const st = studentProfiles[sIdx];
          // Give students realistic attendance: 80% to 90% present
          const isPresent = (sIdx + sessionIdx + p) % 6 !== 0;
          if (isPresent) pCount++;

          await Attendance.create({
            subject: sub._id,
            student: st._id,
            session: sess._id,
            date: d,
            period: p + 1,
            status: isPresent ? 'present' : 'absent',
            verificationMethod: isPresent ? (sIdx % 2 === 0 ? 'face' : 'qr') : 'manual',
            confidence: isPresent ? 0.92 : null,
            verifiedAt: new Date(`${d}T${p === 0 ? '09:05:00' : '11:20:00'}Z`),
          });
        }

        sess.presentCount = pCount;
        await sess.save();
      }
      sessionIdx++;
    }

    // ── 1 Active Open Session for Today ───────────────────────────────────────
    const todayStr = new Date().toISOString().split('T')[0];
    const liveSession = await AttendanceSession.create({
      subject: subjects[0]._id, // Data Structures
      faculty: facultyUser._id,
      date: todayStr,
      period: 1,
      startTime: '09:00 AM',
      endTime: '10:00 AM',
      sessionType: 'regular',
      attendanceMethod: 'face',
      branch: 'CSE',
      semester: 4,
      section: 'A',
      status: 'open',
      totalStudents: studentProfiles.length,
      presentCount: 2,
      openedAt: new Date(),
    });

    // Populate students into today's active session
    for (let i = 0; i < studentProfiles.length; i++) {
      const st = studentProfiles[i];
      // Mark first 2 students as present (recognized by camera), others pending
      const isAlreadyPresent = i < 2;
      await Attendance.create({
        subject: subjects[0]._id,
        student: st._id,
        session: liveSession._id,
        date: todayStr,
        period: 1,
        status: isAlreadyPresent ? 'present' : 'pending',
        verificationMethod: isAlreadyPresent ? 'face' : 'manual',
        confidence: isAlreadyPresent ? 0.94 : null,
        verifiedAt: isAlreadyPresent ? new Date() : null,
      });
    }

    // ── Fees & Announcements ──────────────────────────────────────────────────
    await Fee.create({
      student: studentProfiles[0]._id,
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
    });

    await Announcement.insertMany([
      {
        title: 'Smart Attendance Module Live',
        body: 'Faculty and students can now track real-time attendance and verify attendance using face biometrics.',
        audience: 'all',
        createdBy: admin._id,
      },
      {
        title: 'Mid-Semester Examinations Notice',
        body: 'Mid-semester examinations commence soon. Minimum 75% attendance is required to download hall tickets.',
        audience: 'student',
        createdBy: admin._id,
      },
    ]);

    await Complaint.create({
      raisedBy: studentUsers[0]._id,
      category: 'academic',
      title: 'Result query for CS201',
      description: 'Requesting review of lab exam marks for Data Structures.',
      status: 'pending',
    });

    console.log('\n🎉 Comprehensive seed completed successfully!');
    console.log('─────────────────────────────────────────────────');
    console.log('Admin:   loginId=ADMIN001   password=Admin@1234');
    console.log('Faculty: loginId=FAC001     password=Faculty@123');
    console.log('Student: loginId=20240001   password=Student@123 (Arjun Sharma)');
    console.log('Student: loginId=20240002   password=Student@123 (Abhinikesh)');
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
