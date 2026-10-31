/**
 * server/seeds/seed5thSem.js
 * Seeds 5th Semester CSE timetable, subjects, and faculty
 * Based on actual college timetable (classWise-TT-21_OCT_2026.pdf)
 * Run: node server/seeds/seed5thSem.js
 */
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

// ── Connect ───────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/';

// ── Schemas (inline to avoid circular deps in standalone script) ──────────────
const User = require('../models/User');
const Faculty = require('../models/Faculty');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const Timetable = require('../models/Timetable');

// ── 5th Sem CSE Subjects from PDF ─────────────────────────────────────────────
const SUBJECTS_5 = [
  { code: 'CS501', name: 'Design Analysis of Algorithms',                credits: 4, abbr: 'DAA'   },
  { code: 'CS502', name: 'Formal Languages and Automata Theory',          credits: 4, abbr: 'FLAT'  },
  { code: 'CS503', name: 'Artificial Intelligence Concepts & Apps',       credits: 4, abbr: 'AICA'  },
  { code: 'CS504', name: 'Computer Graphics',                             credits: 3, abbr: 'CG'    },
  { code: 'CS505', name: 'Software Development Processes',                credits: 3, abbr: 'SDP'   },
  { code: 'CS506', name: 'Design Thinking and Innovation - III',          credits: 2, abbr: 'DTI-III'},
  { code: 'CS507', name: 'Entrepreneurship and Startups',                 credits: 2, abbr: 'ES'    },
  { code: 'CS508L', name: 'Design Analysis of Algorithms Lab',            credits: 2, abbr: 'DAA Lab'},
  { code: 'CS509L', name: 'Artificial Intelligence Concepts Lab',         credits: 2, abbr: 'AICA LAB'},
  { code: 'CS510L', name: 'Computer Graphics Lab',                        credits: 2, abbr: 'CG Lab'},
  { code: 'CS511L', name: 'Software Development Processes Lab',           credits: 2, abbr: 'SDP Lab'},
  { code: 'CS512', name: 'QA Aptitude',                                   credits: 1, abbr: '5QA-APT'},
  { code: 'CS513', name: 'QA Technical',                                  credits: 1, abbr: '5QA-Tech'},
  { code: 'CS514', name: 'QA Verbal',                                     credits: 1, abbr: '5QA-VERB'},
];

// ── Teachers from PDF (5 CSE-A) ───────────────────────────────────────────────
const TEACHERS = [
  { loginId: 'FAC001', name: 'Neha Singh',         abbr: 'NES', dept: 'CSE' },
  { loginId: 'FAC002', name: 'Meeta Singh',         abbr: 'MS',  dept: 'CSE' },
  { loginId: 'FAC003', name: 'Poonam Nandal',       abbr: 'PN',  dept: 'CSE' },
  { loginId: 'FAC004', name: 'Swati Hans',          abbr: 'SH',  dept: 'CSE' },
  { loginId: 'FAC005', name: 'Ginni Sehgal',        abbr: 'GS',  dept: 'CSE' },
  { loginId: 'FAC006', name: 'Aman Prasad',         abbr: 'AP',  dept: 'CSE' },
  { loginId: 'FAC007', name: 'Avishek Choudhuri',   abbr: 'AC',  dept: 'CSE' },
  { loginId: 'FAC008', name: 'Megha Makan',         abbr: 'MEGH', dept: 'CSE' },
  { loginId: 'FAC009', name: 'Arushi Gupta',        abbr: 'AG',  dept: 'CSE' },
  { loginId: 'FAC010', name: 'Nidhi',               abbr: 'NID', dept: 'CSE' },
  { loginId: 'FAC011', name: 'Anisha Mahto',        abbr: 'ANM', dept: 'CSE' },
  { loginId: 'FAC012', name: 'Rosy Madaan',         abbr: 'RM',  dept: 'CSE' },
  { loginId: 'FAC013', name: 'Tanu Dua',            abbr: 'TD',  dept: 'CSE' },
  { loginId: 'FAC014', name: 'Rachna Behl',         abbr: 'RB',  dept: 'CSE' },
  { loginId: 'FAC015', name: 'Rohit Bathla',        abbr: 'ROB', dept: 'CSE' },
  { loginId: 'FAC016', name: 'Prity Bhardwaj',      abbr: 'PB',  dept: 'CSE' },
  { loginId: 'FAC017', name: 'Tara (German)',        abbr: 'TARA', dept: 'CSE' },
  { loginId: 'FAC018', name: 'Vipin (CDC)',          abbr: 'VIP', dept: 'CDC' },
  { loginId: 'FAC019', name: 'Shivangee (CDC)',      abbr: 'SHV', dept: 'CDC' },
];

// ── 5 CSE-A Timetable from PDF ─────────────────────────────────────────────────
// dayOfWeek: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri
// Period slots: 1(8:10-9:00), 2(9:00-9:50), 3(9:50-10:40), 4(10:40-11:30),
//               5(11:30-12:20), 6(12:20-13:10), 7(13:10-14:00), 8(14:00-14:50),
//               9(14:50-15:40), 10(15:40-16:30)
const TIMETABLE_5A = [
  // Monday
  { day: 1, period: 1, subjectAbbr: 'DAA',     room: 'AS17', batch: 'CSE-5A' },
  { day: 1, period: 2, subjectAbbr: 'FLAT',    room: 'AS17', batch: 'CSE-5A' },
  { day: 1, period: 3, subjectAbbr: '5QA-Tech',room: 'AS17', batch: 'CSE-5A' },
  { day: 1, period: 4, subjectAbbr: 'AICA',    room: 'AS17', batch: 'CSE-5A' },
  { day: 1, period: 5, subjectAbbr: 'ES',      room: 'AS17', batch: 'CSE-5A' },
  // Tuesday
  { day: 2, period: 1, subjectAbbr: 'SDP',     room: 'AS17', batch: 'CSE-5A' },
  { day: 2, period: 2, subjectAbbr: 'AICA',    room: 'AS18', batch: 'CSE-5A' },
  { day: 2, period: 3, subjectAbbr: 'DAA',     room: 'AS17', batch: 'CSE-5A' },
  { day: 2, period: 4, subjectAbbr: 'CG',      room: 'AS19', batch: 'CSE-5A' },
  // Wednesday
  { day: 3, period: 1, subjectAbbr: 'FLAT',    room: 'AS17', batch: 'CSE-5A' },
  { day: 3, period: 2, subjectAbbr: '5QA-VERB',room: 'AS18', batch: 'CSE-5A' },
  { day: 3, period: 3, subjectAbbr: 'DAA',     room: 'AF18', batch: 'CSE-5A' },
  { day: 3, period: 4, subjectAbbr: '5QA-APT', room: 'AS17', batch: 'CSE-5A' },
  // Thursday
  { day: 4, period: 1, subjectAbbr: 'CG',      room: 'AS17', batch: 'CSE-5A' },
  { day: 4, period: 2, subjectAbbr: 'DAA',     room: 'AS17', batch: 'CSE-5A' },
  { day: 4, period: 3, subjectAbbr: 'AICA LAB',room: 'AF06', batch: 'CSE-5A' },
  { day: 4, period: 4, subjectAbbr: 'SDP',     room: 'AS17', batch: 'CSE-5A' },
  { day: 4, period: 5, subjectAbbr: 'DAA Lab', room: 'AF-11', batch: 'CSE-5A1' },
  { day: 4, period: 6, subjectAbbr: 'SDP Lab', room: 'AF18',  batch: 'CSE-5A2' },
  { day: 4, period: 7, subjectAbbr: 'CG Lab',  room: 'AF06',  batch: 'CSE-5A2' },
  // Friday
  { day: 5, period: 1, subjectAbbr: 'FLAT',    room: 'AS17', batch: 'CSE-5A' },
  { day: 5, period: 2, subjectAbbr: 'DAA',     room: 'AS17', batch: 'CSE-5A' },
  { day: 5, period: 3, subjectAbbr: 'SDP',     room: 'AS17', batch: 'CSE-5A' },
  { day: 5, period: 4, subjectAbbr: 'AICA',    room: 'AS17', batch: 'CSE-5A' },
  { day: 5, period: 5, subjectAbbr: 'SDP Lab', room: 'AG24-A', batch: 'CSE-5A1' },
];

const PERIOD_TIMES = {
  1:  { startTime: '8:10',  endTime: '9:00'  },
  2:  { startTime: '9:00',  endTime: '9:50'  },
  3:  { startTime: '9:50',  endTime: '10:40' },
  4:  { startTime: '10:40', endTime: '11:30' },
  5:  { startTime: '11:30', endTime: '12:20' },
  6:  { startTime: '12:20', endTime: '13:10' },
  7:  { startTime: '13:10', endTime: '14:00' },
  8:  { startTime: '14:00', endTime: '14:50' },
  9:  { startTime: '14:50', endTime: '15:40' },
  10: { startTime: '15:40', endTime: '16:30' },
};

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ── Main Seed Function ────────────────────────────────────────────────────────
async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  // ── 1. Upsert Subjects ──────────────────────────────────────────────────────
  const subjectMap = {};
  for (const s of SUBJECTS_5) {
    const doc = await Subject.findOneAndUpdate(
      { code: s.code },
      {
        code: s.code,
        name: s.name,
        credits: s.credits,
        semester: 5,
        branch: 'CSE',
      },
      { upsert: true, new: true }
    );
    subjectMap[s.abbr] = doc;
    console.log(`  Subject upserted: ${s.code} ${s.name}`);
  }

  // ── 2. Upsert Faculty Users ────────────────────────────────────────────────
  const bcrypt = require('bcryptjs');
  const defaultPwHash = await bcrypt.hash('Faculty@123', 10);

  const facultyMap = {}; // abbr -> Faculty doc
  for (const t of TEACHERS) {
    let userDoc = await User.findOne({ loginId: t.loginId });
    if (!userDoc) {
      userDoc = await User.create({
        loginId: t.loginId,
        name: t.name,
        email: `${t.loginId.toLowerCase()}@campussphere.edu`,
        role: 'faculty',
        passwordHash: defaultPwHash,
        isActive: true,
      });
    }

    let facDoc = await Faculty.findOne({ user: userDoc._id });
    if (!facDoc) {
      facDoc = await Faculty.create({
        user: userDoc._id,
        employeeId: t.loginId,
        fullName: t.name,
        department: t.dept,
        designation: 'Assistant Professor',
        subjects: [],
      });
    }
    facultyMap[t.abbr] = facDoc;
    console.log(`  Faculty upserted: ${t.loginId} ${t.name}`);
  }

  // ── 3. Map subject abbr → primary teacher based on timetable ──────────────
  const subjectTeacher = {
    'DAA':      'NES',  // Neha Singh
    'FLAT':     'PN',   // Poonam Nandal
    'AICA':     'MS',   // Meeta Singh
    'CG':       'GS',   // Ginni Sehgal
    'SDP':      'SH',   // Swati Hans
    'DTI-III':  'NES',  // Neha Singh / Anisha Mahto
    'ES':       'SHV',  // Shivangee (CDC)
    'DAA Lab':  'SH',   // Swati Hans / Rosy Madaan
    'AICA LAB': 'MEGH', // Megha Makan
    'CG Lab':   'MS',   // Meeta Singh
    'SDP Lab':  'MS',   // Meeta Singh
    '5QA-APT':  'VIP',  // Vipin CDC
    '5QA-Tech': 'VIP',
    '5QA-VERB': 'SHV',
  };

  // ── 4. Update subjects with primary faculty ref ────────────────────────────
  for (const [abbr, facAbbr] of Object.entries(subjectTeacher)) {
    const sub = subjectMap[abbr];
    const fac = facultyMap[facAbbr];
    if (sub && fac?.user) {
      await Subject.findByIdAndUpdate(sub._id, { faculty: fac.user });
    }
  }

  // ── 5. Seed Timetable entries ──────────────────────────────────────────────
  await Timetable.deleteMany({ semester: 5, branch: 'CSE' });
  console.log('  Cleared existing 5th sem timetable entries');

  const ttDocs = [];
  for (const slot of TIMETABLE_5A) {
    const sub = subjectMap[slot.subjectAbbr];
    if (!sub) continue;

    const facAbbr = subjectTeacher[slot.subjectAbbr];
    const fac = facultyMap[facAbbr];
    const times = PERIOD_TIMES[slot.period];

    ttDocs.push({
      subject: sub._id,
      faculty: fac?.user || null,
      dayOfWeek: slot.day,
      dayName: DAY_NAMES[slot.day],
      period: slot.period,
      startTime: times.startTime,
      endTime: times.endTime,
      time: `${times.startTime} - ${times.endTime}`,
      room: slot.room,
      semester: 5,
      branch: 'CSE',
      section: 'A',
      batch: slot.batch,
    });
  }

  await Timetable.insertMany(ttDocs);
  console.log(`✅ Seeded ${ttDocs.length} timetable entries for 5 CSE-A`);

  // ── 6. Update existing students semester to 5 if in CSE ───────────────────
  const updated = await Student.updateMany(
    { branch: 'CSE', semester: { $lt: 5 } },
    { $set: { semester: 5 } }
  );
  console.log(`✅ Updated ${updated.modifiedCount} CSE students to semester 5`);

  await mongoose.disconnect();
  console.log('🎉 Seed complete!');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});

