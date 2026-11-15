/**
 * server/scripts/enroll_real_dataset_students.js
 *
 * Enrolls all authentic student records from StudentStaging (Batch 003) into
 * the canonical Student collection. Cleans up synthetic TEMP dummy records.
 */
'use strict';

const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/campus-erp';

async function run() {
  console.log(`Connecting to MongoDB at ${MONGO_URI}...`);
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  // 1. Remove synthetic TEMP placeholder students
  const deleteTemp = await db.collection('students').deleteMany({
    rollNumber: { $regex: '^TEMP' }
  });
  console.log(`🗑️ Removed ${deleteTemp.deletedCount} synthetic TEMP placeholder students.`);

  // 2. Fetch all real students from StudentStaging Batch 003
  const stagings = await db.collection('studentstagings').find({
    batchId: 'BATCH-20261112-STAGING-003',
  }).toArray();
  console.log(`Found ${stagings.length} real staging students in Batch 003.`);

  let inserted = 0;
  let updated = 0;

  for (const s of stagings) {
    const raw = s.rawPayload || {};
    const roll = s.normalizedRollNumber || s.rawIdentifier;
    if (!roll) continue;

    const fullName = s.studentName || raw['Student Name'] || raw.Name;
    if (!fullName) continue;

    const studentDoc = {
      rollNumber: roll,
      fullName: fullName.trim(),
      school: raw.School || 'School of Engineering',
      course: raw.Course || 'CSE',
      branch: raw.Branch || 'CSE',
      program: 'B.Tech',
      batch: raw.Batch || raw['Batch / Year'] || '2024/3rd',
      year: '3rd',
      semester: 5,
      section: raw.Section || null,
      phone: raw['Phone Number'] || null,
      email: raw['Personal Email'] || raw['College / Official Email'] || null,
      teamsId: raw['College / Official Email'] || raw['Teams ID'] || null,
      admissionApplicationNumber: raw['Admission Application Number'] || null,
      status: 'active',
      accountStatus: 'enrolled_offline',
      sourceBatchId: s.batchId,
      importSourceRow: s.sourceRow,
      updatedAt: new Date(),
    };

    const result = await db.collection('students').updateOne(
      { rollNumber: roll },
      {
        $set: studentDoc,
        $setOnInsert: {
          user: null,
          createdAt: new Date(),
        }
      },
      { upsert: true }
    );

    if (result.upsertedCount > 0) inserted++;
    else if (result.modifiedCount > 0) updated++;
  }

  console.log(`✅ Real students enrolled: ${inserted} newly created, ${updated} updated.`);

  const totalStudents = await db.collection('students').countDocuments();
  console.log(`Total students now in canonical Student collection: ${totalStudents}`);

  // Sample check for 1/24/SET/BCS/231
  const sample = await db.collection('students').findOne({ rollNumber: '1/24/SET/BCS/231' });
  console.log('Sample verified student in database:');
  console.log(JSON.stringify(sample, null, 2));

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Enrollment error:', err);
  process.exit(1);
});
