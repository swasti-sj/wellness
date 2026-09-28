const mongoose = require('mongoose');
const User = require('../models/User');
const preview = require('./previewStaffImport');

const EXPECTED_STAFF_ROWS = 97;
const EXPECTED_NEW_USERS = 96;
const EXPECTED_EXISTING_UPDATES = 1;

function assertConfirmedTarget() {
  if (!process.argv.includes('--confirm-staff-import')) {
    throw new Error('Import requires explicit --confirm-staff-import approval.');
  }
  if (!process.env.MONGO_URI) throw new Error('Confirmed production MongoDB URI was not provided.');
}

function buildUpdateFilter(plan) {
  const filter = { _id: new mongoose.Types.ObjectId(plan.userId) };
  const user = plan.user;
  for (const key of ['email', 'roll', 'name', 'role', 'patientCategory', 'uhid']) {
    if (user[key] === undefined) filter[key] = { $exists: false };
    else filter[key] = user[key];
  }
  return filter;
}

function buildNewUser(plan) {
  const now = new Date();
  return {
    name: plan.record.name,
    email: plan.record.email,
    roll: plan.record.staffId,
    role: 'patient',
    patientCategory: plan.record.sourceCategory,
    uhid: plan.proposedUhid,
    profileComplete: false,
    consentAccepted: false,
    isVerified: false,
    dependants: [],
    createdAt: now,
    updatedAt: now
  };
}

async function reconcileInTransaction(session) {
  const { records } = preview.readWorkbook();
  const duplicateInfo = preview.classifyExcelDuplicates(records);
  const sourceRecords = duplicateInfo.nonHeaders.filter(record => record.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email));
  const emails = [...new Set(sourceRecords.map(record => record.email))];
  const staffIds = [...new Set(sourceRecords.map(record => record.staffId.toLowerCase()).filter(Boolean))];
  const userConditions = [];
  if (emails.length) userConditions.push({ email: { $in: emails } });
  if (staffIds.length) userConditions.push({ roll: { $in: staffIds } });

  const users = await User.find({ $or: userConditions })
    .collation({ locale: 'en', strength: 2 })
    .select('_id name email roll role patientCategory phone uhid profileComplete')
    .session(session)
    .lean();
  const result = preview.assessMatches(records, users, []);
  const existingUhids = await User.find({ uhid: { $exists: true, $ne: null, $ne: '' } })
    .select('_id uhid')
    .session(session)
    .lean();
  const uhidPlan = preview.allocateNewUhids(result.plans, existingUhids);

  if (records.filter(record => !record.repeatedHeader).length !== EXPECTED_STAFF_ROWS) {
    throw new Error(`Expected ${EXPECTED_STAFF_ROWS} staff rows; found ${records.filter(record => !record.repeatedHeader).length}.`);
  }
  if (result.conflicts.length || result.invalidRecords.length) {
    throw new Error(`Current roster has ${result.conflicts.length} conflicts and ${result.invalidRecords.length} invalid rows; refusing writes.`);
  }
  if (result.plans.length !== EXPECTED_STAFF_ROWS) {
    throw new Error(`Expected ${EXPECTED_STAFF_ROWS} accounted-for staff records; found ${result.plans.length}.`);
  }

  const newPlans = result.plans.filter(plan => plan.kind === 'new');
  const updatePlans = result.plans.filter(plan => plan.kind === 'update');
  const unchangedPlans = result.plans.filter(plan => plan.kind === 'unchanged');
  if (newPlans.length !== EXPECTED_NEW_USERS || updatePlans.length !== EXPECTED_EXISTING_UPDATES || unchangedPlans.length !== 0) {
    throw new Error(`Plan changed from reviewed counts: new=${newPlans.length}, updates=${updatePlans.length}, unchanged=${unchangedPlans.length}.`);
  }
  if (uhidPlan.plannedCollisionCount || uhidPlan.duplicatePlannedCount || uhidPlan.newUhidCount !== EXPECTED_NEW_USERS) {
    throw new Error('UHID plan is not collision-free or does not cover all new accounts.');
  }
  if (newPlans.some(plan => !/^\d{4}$/.test(plan.proposedUhid))) {
    throw new Error('A proposed UHID is not four digits.');
  }

  return { result, uhidPlan, newPlans, updatePlans };
}

async function applyStaffImport() {
  assertConfirmedTarget();
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  if (mongoose.connection.db.databaseName !== 'medapp' || User.collection.collectionName !== 'users') {
    throw new Error('Connected target did not resolve to medapp.users.');
  }

  const session = await mongoose.startSession();
  let finalReport;
  try {
    await session.withTransaction(async () => {
      const plan = await reconcileInTransaction(session);
      const newEmails = plan.newPlans.map(item => item.record.email);
      const newRolls = plan.newPlans.map(item => item.record.staffId);
      const duplicateUsers = await User.find({
        $or: [
          { email: { $in: newEmails } },
          { roll: { $in: newRolls } }
        ]
      }).collation({ locale: 'en', strength: 2 }).select('_id').session(session).lean();
      if (duplicateUsers.length) throw new Error('A new staff email or employee ID became occupied before insert.');

      const uhids = plan.newPlans.map(item => item.proposedUhid);
      const occupiedUhids = await User.find({ uhid: { $in: uhids } }).select('_id').session(session).lean();
      if (occupiedUhids.length) throw new Error('A planned staff UHID became occupied before insert.');

      const operations = [
        ...plan.newPlans.map(item => ({ insertOne: { document: buildNewUser(item) } })),
        ...plan.updatePlans.map(item => ({
          updateOne: {
            filter: buildUpdateFilter(item),
            update: { $set: { patientCategory: item.proposedUpdates.patientCategory } }
          }
        }))
      ];

      const writeResult = await User.bulkWrite(operations, {
        session,
        ordered: true,
        timestamps: false
      });
      if (writeResult.insertedCount !== EXPECTED_NEW_USERS
        || writeResult.matchedCount !== EXPECTED_EXISTING_UPDATES
        || writeResult.modifiedCount !== EXPECTED_EXISTING_UPDATES) {
        throw new Error(`Unexpected write result: inserted=${writeResult.insertedCount}, matched=${writeResult.matchedCount}, modified=${writeResult.modifiedCount}.`);
      }

      const allEmails = plan.result.plans.map(item => item.record.email);
      const finalUsers = await User.find({ email: { $in: allEmails } })
        .collation({ locale: 'en', strength: 2 })
        .select('_id name email roll role patientCategory uhid')
        .session(session)
        .lean();
      if (finalUsers.length !== EXPECTED_STAFF_ROWS) {
        throw new Error(`Transactional verification expected ${EXPECTED_STAFF_ROWS} accounts, found ${finalUsers.length}.`);
      }

      const byEmail = new Map(finalUsers.map(user => [String(user.email).toLowerCase(), user]));
      const invalid = plan.result.plans.filter(item => {
        const user = byEmail.get(item.record.email);
        if (!user) return true;
        if (user.role !== 'patient' || user.patientCategory !== item.proposedCategory) return true;
        if (user.roll?.toLowerCase() !== item.record.staffId.toLowerCase()) return true;
        if (item.kind === 'new' && user.uhid !== item.proposedUhid) return true;
        if (item.kind !== 'new' && item.user && user.uhid !== item.user.uhid) return true;
        return false;
      });
      const plannedUhidSet = new Set(plan.newPlans.map(item => item.proposedUhid));
      if (invalid.length || plannedUhidSet.size !== EXPECTED_NEW_USERS) {
        throw new Error(`Transactional verification found ${invalid.length} record mismatches or duplicate planned UHIDs.`);
      }

      finalReport = {
        inserted: writeResult.insertedCount,
        updated: writeResult.modifiedCount,
        unchanged: plan.result.plans.filter(item => item.kind === 'unchanged').length,
        errors: 0,
        manualReview: plan.result.conflicts.length,
        processed: plan.result.plans.length,
        plannedUhidCollisions: plan.uhidPlan.plannedCollisionCount,
        duplicatePlannedUhids: plan.uhidPlan.duplicatePlannedCount
      };
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
  } finally {
    await session.endSession();
  }

  return finalReport;
}

applyStaffImport()
  .then(report => {
    console.log('STAFF IMPORT RESULTS');
    console.log(`Inserted patient Users: ${report.inserted}`);
    console.log(`Updated existing Users: ${report.updated}`);
    console.log(`Unchanged: ${report.unchanged}`);
    console.log(`Errors: ${report.errors}`);
    console.log(`Manual review: ${report.manualReview}`);
    console.log(`Staff rows processed: ${report.processed}`);
    console.log(`Planned UHID collisions: ${report.plannedUhidCollisions}`);
    console.log(`Duplicate planned UHIDs: ${report.duplicatePlannedUhids}`);
  })
  .catch(error => {
    console.error(`Staff patient import stopped: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
