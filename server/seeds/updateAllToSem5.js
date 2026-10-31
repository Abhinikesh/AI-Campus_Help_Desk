/**
 * server/seeds/updateAllToSem5.js
 * Updates all student profiles, attendance records, active sessions, and fee records to Semester 5 (CSE).
 */
'use strict';

const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/';

const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const Timetable = require('../models/Timetable');
const Attendance = require('../models/Attendance');
const AttendanceSession = require('../models/AttendanceSession');
const Fee = require('../models/Fee');

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB for Sem 5 update');

  // 1. Update all students to Semester 5, branch 'CSE'
  const studentResult = await Student.updateMany(
    {},
    {
      $set: {
        semester: 5,
        branch: 'CSE',
        section: 'A',
      }
    }
  );
  console.log(`✅ Updated ${studentResult.modifiedCount} students to Semester 5 (CSE, Section A)`);

  const allStudents = await Student.find({});
  console.log(`Found ${allStudents.length} total students.`);

  // 2. Fetch all 5th sem subjects
  const subjects5 = await Subject.find({ semester: 5 });
  console.log(`Found ${subjects5.length} subjects for Semester 5.`);

  // 3. Clear old attendance records for these students
  await Attendance.deleteMany({});
  console.log('Cleared existing attendance records');

  // 4. Seed realistic attendance for each student across core 5th Sem subjects
  const coreSubjects = subjects5.filter(s => ['CS501', 'CS502', 'CS503', 'CS504', 'CS505', 'CS506', 'CS507'].includes(s.code));

  const dates = [
    '2026-10-01', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08',
    '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-19',
    '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-26', '2026-10-27',
    '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31'
  ];

  let totalAttCreated = 0;
  for (const st of allStudents) {
    for (let subIdx = 0; subIdx < coreSubjects.length; subIdx++) {
      const sub = coreSubjects[subIdx];
      // Seed between 12 and 18 classes per subject
      const numClasses = 15;
      for (let i = 0; i < numClasses; i++) {
        const d = dates[i % dates.length];
        // 88% attendance probability
        const isPresent = (i + subIdx + st.rollNumber.slice(-2)) % 8 !== 0;
        try {
          await Attendance.create({
            subject: sub._id,
            student: st._id,
            date: d,
            period: (subIdx % 4) + 1,
            status: isPresent ? 'present' : 'absent',
            attendanceStatus: isPresent ? 'present' : 'absent',
            verificationMethod: 'face',
            verificationStatus: 'verified',
            confidence: 0.94,
          });
          totalAttCreated++;
        } catch {
          // ignore duplicate index collision
        }
      }
    }
  }
  console.log(`✅ Created ${totalAttCreated} attendance records for Sem 5 subjects`);

  // 5. Clean up old attendance sessions and create an active live session for CS501
  await AttendanceSession.deleteMany({});
  const daaSubject = await Subject.findOne({ code: 'CS501' });
  const facultyUser = await User.findOne({ loginId: 'FAC001' });

  if (daaSubject && facultyUser) {
    const today = new Date().toISOString().split('T')[0];
    const liveSession = await AttendanceSession.create({
      sessionId: 'sess-' + Date.now(),
      subject: daaSubject._id,
      faculty: facultyUser._id,
      date: today,
      sessionDate: today,
      period: 1,
      startTime: '08:10 AM',
      endTime: '09:00 AM',
      academicYear: '2026-2027',
      sessionType: 'regular',
      attendanceMethod: 'qr_face',
      status: 'active',
      sessionStatus: 'active',
      branch: 'CSE',
      semester: 5,
      section: 'A',
      totalStudents: allStudents.length,
      presentCount: 0,
      qrChallengeToken: 'cs501-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
    });
    console.log(`✅ Created live attendance session: ${liveSession.sessionId} for CS501 (DAA)`);
  }

  // 6. Update Fees
  await Fee.updateMany({}, {
    $set: {
      title: 'Semester 5 Tuition Fee',
      academicYear: '2026-2027',
    }
  });
  console.log('✅ Updated Fee titles to Semester 5');

  console.log('🎉 Completed all Semester 5 updates!');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('❌ Error updating to Sem 5:', err);
  process.exit(1);
});

