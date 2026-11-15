/**
 * server/scripts/update_student_datasets_school_batch.js
 *
 * Populates and standardizes student dataset fields across:
 * - Canonical Student collection:
 *     school: 'School of Engineering'
 *     course: 'CSE'
 *     branch: 'CSE'
 *     batch: '2024/3rd'
 *     year: '3rd'
 *     semester: 5
 *     admissionYear: 2024
 * - StudentStaging collection (rawPayload):
 *     School: 'School of Engineering'
 *     Course: 'CSE'
 *     Batch: '2024/3rd'
 *     'Batch / Year': '2024/3rd'
 *     'Batch and year': '2024/3rd'
 *     Year: '3rd'
 * - EnrollmentRegister rows (where present)
 */
'use strict';

const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/campus-erp';

async function updateStudentDatasets() {
  console.log(`Connecting to MongoDB at ${MONGO_URI}...`);
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  // 1. Update canonical Student collection
  const studentRes = await db.collection('students').updateMany(
    {},
    {
      $set: {
        school: 'School of Engineering',
        course: 'CSE',
        branch: 'CSE',
        batch: '2024/3rd',
        year: '3rd',
        semester: 5,
        admissionYear: 2024,
      },
    }
  );
  console.log(`✅ Updated ${studentRes.modifiedCount} canonical students (total matched: ${studentRes.matchedCount}).`);

  // 2. Update StudentStaging collection
  const stagingRes = await db.collection('studentstagings').updateMany(
    {},
    {
      $set: {
        'rawPayload.School': 'School of Engineering',
        'rawPayload.Course': 'CSE',
        'rawPayload.Batch': '2024/3rd',
        'rawPayload.Batch / Year': '2024/3rd',
        'rawPayload.Batch and year': '2024/3rd',
        'rawPayload.Year': '3rd',
      },
    }
  );
  console.log(`✅ Updated ${stagingRes.modifiedCount} staging student records (total matched: ${stagingRes.matchedCount}).`);

  // 3. Update EnrollmentRegister rows if present
  const collections = (await db.listCollections().toArray()).map((c) => c.name);
  if (collections.includes('enrollmentregisterrows')) {
    const regRes = await db.collection('enrollmentregisterrows').updateMany(
      {},
      {
        $set: {
          rawSchool: 'School of Engineering',
          rawCourse: 'CSE',
          rawAcademicYear: '2024/3rd',
        },
      }
    );
    console.log(`✅ Updated ${regRes.modifiedCount} enrollment register rows.`);
  }

  // 4. Sample verification
  const sampleStudent = await db.collection('students').findOne();
  console.log('Sample verified student:', {
    roll: sampleStudent.rollNumber,
    name: sampleStudent.fullName,
    school: sampleStudent.school,
    course: sampleStudent.course,
    batch: sampleStudent.batch,
    branch: sampleStudent.branch,
    semester: sampleStudent.semester,
    admissionYear: sampleStudent.admissionYear,
  });

  const sampleStaging = await db.collection('studentstagings').findOne();
  console.log('Sample verified staging rawPayload:', {
    roll: sampleStaging.normalizedRollNumber,
    name: sampleStaging.studentName,
    school: sampleStaging.rawPayload?.School,
    course: sampleStaging.rawPayload?.Course,
    batch: sampleStaging.rawPayload?.Batch,
    batchAndYear: sampleStaging.rawPayload?.['Batch / Year'],
  });

  await mongoose.disconnect();
  console.log('✅ Update script completed successfully!');
}

updateStudentDatasets().catch((err) => {
  console.error('❌ Update script failed:', err);
  process.exit(1);
});

