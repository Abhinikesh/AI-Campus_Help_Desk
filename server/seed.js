/**
 * CampusSphere AI — Seed Script
 * Run: node server/seed.js
 * Seeds demo users + student profile data for testing
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const connectDB = require('./config/db');
const User = require('./models/User');
const Student = require('./models/Student');
const Faculty = require('./models/Faculty');
const Parent = require('./models/Parent');
const Complaint = require('./models/Complaint');

const SALT_ROUNDS = 10;

const seedUsers = [
  {
    name: 'Arjun Sharma',
    email: 'student@campus.edu',
    password: 'student123',
    role: 'student',
    rollNumber: '20240001',
  },
  {
    name: 'Abhinikesh',
    email: 'abhinikesh@campus.edu',
    password: 'student123',
    role: 'student',
    rollNumber: '20240002',
  },
  {
    name: 'Dr. Priya Mehta',
    email: 'faculty@campus.edu',
    password: 'faculty123',
    role: 'faculty',
  },
  {
    name: 'Admin User',
    email: 'admin@campus.edu',
    password: 'admin1234',
    role: 'admin',
  },
  {
    name: 'Ramesh Sharma',
    email: 'parent@campus.edu',
    password: 'parent123',
    role: 'parent',
  },
];

const studentAttendance = [
  { subject: 'Data Structures', code: 'CS201', attended: 42, total: 50 },
  { subject: 'Database Management', code: 'CS203', attended: 38, total: 50 },
  { subject: 'Web Development', code: 'CS205', attended: 45, total: 50 },
  { subject: 'Computer Networks', code: 'CS207', attended: 28, total: 50 },
  { subject: 'Operating Systems', code: 'CS209', attended: 40, total: 50 }
];

const studentResults = [
  { subject: 'Data Structures', code: 'CS201', marks: 88, maxMarks: 100, grade: 'A+' },
  { subject: 'Database Management', code: 'CS203', marks: 74, maxMarks: 100, grade: 'B' },
  { subject: 'Web Development', code: 'CS205', marks: 91, maxMarks: 100, grade: 'A+' },
  { subject: 'Computer Networks', code: 'CS207', marks: 52, maxMarks: 100, grade: 'C' },
  { subject: 'Operating Systems', code: 'CS209', marks: 79, maxMarks: 100, grade: 'A' }
];

const studentExams = [
  { subject: 'Theoretical CS', code: 'CS401', date: 'Apr 12, 2026', time: '10:00 AM', room: 'Exam Hall A' },
  { subject: 'Cloud Computing', code: 'CS403', date: 'Apr 15, 2026', time: '02:00 PM', room: 'Exam Hall B' },
  { subject: 'Cyber Security', code: 'CS405', date: 'Apr 18, 2026', time: '10:00 AM', room: 'Exam Hall A' },
];

const seed = async () => {
  try {
    await connectDB();

    // ── Wipe existing data ────────────────────────────────────
    console.log('🗑️  Clearing existing data...');
    await User.deleteMany({});
    await Student.deleteMany({});
    await Faculty.deleteMany({});
    await Parent.deleteMany({});
    await Complaint.deleteMany({});
    console.log('✅ Collections cleared');

    // ── Hash passwords and create users ───────────────────────
    console.log('👤 Creating users...');
    const createdUsers = {};

    for (const userData of seedUsers) {
      const hashed = await bcrypt.hash(userData.password, SALT_ROUNDS);
      const user = await User.create({
        name:       userData.name,
        email:      userData.email,
        password:   hashed,
        role:       userData.role,
        rollNumber: userData.rollNumber || null,
      });
      createdUsers[userData.email] = user;
      console.log(`  ✅ Created [${userData.role}]: ${userData.email}`);
    }

    // ── Create Student profile for Arjun Sharma ───────────────
    console.log('📚 Creating student profiles...');
    await Student.create({
      userId:     createdUsers['student@campus.edu']._id,
      rollNumber: '20240001',
      branch: 'Computer Science & Engineering',
      semester: 4,
      year: 2,
      attendance: studentAttendance,
      results: studentResults,
      exams: studentExams,
      fees: {
        total: 120000,
        paid: 80000,
        due: 40000,
        lastPaid: new Date('2026-02-15'),
        dueDate: new Date('2026-04-20')
      },
      announcements: [
        {
          title: 'Mid-Semester Exams Begin',
          body: 'Exams start from April 12, 2026. Check the exam timetable on the portal.',
          date: new Date('2026-04-01')
        },
        {
          title: 'Fee Payment Reminder',
          body: 'Last date for semester fee payment is April 20, 2026. Late fee of ₹500 per day will be charged after deadline.',
          date: new Date('2026-04-05')
        }
      ],
    });
    console.log('  ✅ Student profile created for Arjun Sharma');

    await Student.create({
      userId:     createdUsers['abhinikesh@campus.edu']._id,
      rollNumber: '20240002',
      branch:     'Computer Science & Engineering',
      semester:   4,
      year:       2,
      attendance: studentAttendance,
      results:    studentResults,
      exams:      studentExams,
      fees: {
        total: 120000,
        paid: 120000,
        due: 0,
        lastPaid: new Date('2026-01-10'),
        dueDate: new Date('2026-04-20')
      },
      announcements: []
    });
    console.log('  ✅ Student profile created for Abhinikesh');

    // ── Create Parent record for Ramesh Sharma ────────────────
    console.log('👨‍👩‍👧 Creating parent record...');
    await Parent.create({
      userId: createdUsers['parent@campus.edu']._id,
      studentRollNumber: '20240001',
      relation: 'Father'
    });
    console.log('  ✅ Parent record created for Ramesh Sharma');

    // ── Create Faculty profile for Dr. Priya Mehta ────────────
    console.log('🏫 Creating faculty profile...');
    await Faculty.create({
      userId:     createdUsers['faculty@campus.edu']._id,
      department: 'Computer Science',
      employeeId: 'FAC001',
      subjects: [
        { name: 'Data Structures', code: 'CS201', credits: 4, semester: 4 },
        { name: 'Algorithm Design', code: 'CS202', credits: 4, semester: 4 },
        { name: 'Database Management', code: 'CS203', credits: 3, semester: 4 }
      ],
      timetable: [
        { day: 'Monday', startTime: '09:00 AM', endTime: '10:00 AM', subject: 'Data Structures', code: 'CS201', room: 'CS-101', batch: 'All' },
        { day: 'Tuesday', startTime: '10:00 AM', endTime: '11:00 AM', subject: 'Data Structures', code: 'CS201', room: 'CS-101', batch: 'All' },
        { day: 'Wednesday', startTime: '09:00 AM', endTime: '10:00 AM', subject: 'Algorithm Design', code: 'CS202', room: 'CS-102', batch: 'All' },
      ],
    });
    console.log('  ✅ Faculty record created');

    console.log('📝 Creating complaints...');
    await Complaint.insertMany([
      { title: 'Result not updated', raisedBy: createdUsers['student@campus.edu']._id, role: 'student', category: 'academic', status: 'pending', description: 'Data Structures mid-sem result not visible.', createdAt: new Date('2026-04-01') },
      { title: 'ID card issue', raisedBy: createdUsers['student@campus.edu']._id, role: 'student', category: 'admin', status: 'in-progress', description: 'Applied for ID card 3 weeks ago.', createdAt: new Date('2026-03-28') },
      { title: 'Water heater broken', raisedBy: createdUsers['student@campus.edu']._id, role: 'student', category: 'hostel', status: 'resolved', description: 'Hostel No. 2 Room 204 heater repaired.', createdAt: new Date('2026-03-25'), resolvedAt: new Date('2026-03-28') }
    ]);
    console.log('  ✅ Complaints created');

    console.log('\n🎉 Seeding complete! Demo credentials:');
    console.log('Student: student@campus.edu / student123');
    console.log('Faculty: faculty@campus.edu / faculty123');
    console.log('Admin:   admin@campus.edu   / admin1234');
    console.log('Parent:  parent@campus.edu  / parent123');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  }
};

seed();
