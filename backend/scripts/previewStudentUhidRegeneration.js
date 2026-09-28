const path = require('path');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const User = require('../models/User');

const EXPECTED_STUDENT_COUNT = 1731;
const WORKBOOK_PATH = path.join(__dirname, '..', 'ACAD_- Students Basic Details_Wellness Center.xlsx');
const SHEETS = ['UG', 'PG'];

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function normalizeHeader(value) {
  return text(value).toLowerCase().replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function getColumns(header) {
  const headers = header.map(normalizeHeader);
  const roll = headers.findIndex(value => ['roll no', 'roll number'].includes(value));
  const name = headers.findIndex(value => ['student name', 'name'].includes(value));
  if (roll < 0 || name < 0) throw new Error('Workbook must contain student name and roll number columns.');
  return { roll, name };
}

function isBlank(row) {
  return row.every(value => !text(value));
}

function isRepeatedHeader(row, header, columns) {
  return [columns.roll, columns.name]
    .filter(index => normalizeHeader(row[index]) === normalizeHeader(header[index]))
    .length === 2;
}

function readStudents() {
  const workbook = XLSX.readFile(WORKBOOK_PATH, { cellDates: false });
  const missingSheets = SHEETS.filter(sheet => !workbook.SheetNames.includes(sheet));
  if (missingSheets.length) throw new Error(`Missing workbook sheets: ${missingSheets.join(', ')}`);

  const students = [];
  const invalidRows = [];
  for (const sheet of SHEETS) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { header: 1, defval: '', raw: true });
    const headerIndex = rows.findIndex(row => !isBlank(row));
    if (headerIndex < 0) throw new Error(`No header row in ${sheet}.`);
    const header = rows[headerIndex].map(text);
    const columns = getColumns(header);

    rows.slice(headerIndex + 1).forEach((row, offset) => {
      const excelRow = headerIndex + offset + 2;
      if (isBlank(row)) return;
      if (isRepeatedHeader(row, header, columns)) {
        invalidRows.push({ sheet, row: excelRow, reason: 'repeated header' });
        return;
      }

      const roll = text(row[columns.roll]);
      const name = text(row[columns.name]);
      if (!roll || !name) {
        invalidRows.push({ sheet, row: excelRow, reason: 'missing roll or student name' });
        return;
      }
      students.push({ sheet, row: excelRow, roll, name, email: `${roll.toLowerCase()}@iitdh.ac.in` });
    });
  }

  return { students, invalidRows };
}

function addToIndex(index, key, user) {
  if (!key) return;
  index.set(key, [...(index.get(key) || []), user]);
}

function getAccountMatches(students, users) {
  const byEmail = new Map();
  const byRoll = new Map();
  for (const user of users) {
    addToIndex(byEmail, text(user.email).toLowerCase(), user);
    addToIndex(byRoll, text(user.roll).toLowerCase(), user);
  }

  const plan = [];
  const conflicts = [];
  const seenSourceEmails = new Set();
  for (const student of students) {
    if (seenSourceEmails.has(student.email)) {
      conflicts.push({ ...student, reason: 'duplicate canonical student email in workbook' });
      continue;
    }
    seenSourceEmails.add(student.email);

    const emailMatches = byEmail.get(student.email) || [];
    const rollMatches = byRoll.get(student.roll.toLowerCase()) || [];
    const matches = new Map([...emailMatches, ...rollMatches].map(user => [String(user._id), user]));

    if (matches.size !== 1) {
      conflicts.push({
        ...student,
        reason: matches.size === 0
          ? 'no existing account matches canonical email or roll'
          : 'multiple existing accounts match canonical email or roll'
      });
      continue;
    }

    const [user] = matches.values();
    const exactCanonicalEmail = text(user.email).toLowerCase() === student.email;
    const exactRoll = text(user.roll).toLowerCase() === student.roll.toLowerCase();
    if (!exactCanonicalEmail || !exactRoll) {
      conflicts.push({ ...student, reason: 'matched account does not contain both canonical email and matching roll' });
      continue;
    }

    plan.push({
      ...student,
      userId: String(user._id),
      oldUhid: text(user.uhid),
      expectedUhid: user.uhid,
      expectedEmail: user.email,
      expectedRoll: user.roll,
      expectedRole: user.role,
      currentRole: text(user.role),
      newRole: 'patient'
    });
  }

  return { plan, conflicts };
}

function assignCollisionSafeUhidPlan(plan, users) {
  const occupied = new Set();
  let assignedCount = 0;
  let existingUsersWithUhid = 0;

  for (const user of users) {
    const uhid = text(user.uhid);
    if (!uhid) continue;
    assignedCount += 1;
    existingUsersWithUhid += 1;
    occupied.add(uhid);
  }

  let collisionSkips = 0;
  let nextNumber = assignedCount + 1;
  const assignments = [];
  for (const student of plan) {
    // Match the application rule: count assigned User UHIDs, add one, then pad to four digits.
    let newUhid = String(nextNumber).padStart(4, '0');
    while (occupied.has(newUhid)) {
      collisionSkips += 1;
      nextNumber += 1;
      newUhid = String(nextNumber).padStart(4, '0');
    }

    occupied.add(newUhid);
    assignments.push({ ...student, newUhid });
    nextNumber += 1;
  }

  return { assignments, existingUsersWithUhid, collisionSkips };
}

function printReport(students, invalidRows, reconciliation, uhidPlan, users) {
  const { assignments, existingUsersWithUhid, collisionSkips } = uhidPlan;
  const studentsWithUhid = assignments.filter(student => student.oldUhid).length;
  const studentsWithoutUhid = assignments.length - studentsWithUhid;
  const alreadyPatient = assignments.filter(student => student.currentRole === 'patient').length;
  const otherRoles = assignments.length - alreadyPatient;
  const roleChanges = assignments.filter(student => student.currentRole !== 'patient').length;
  const generatedValues = assignments.map(student => student.newUhid);
  const plannedUhidSet = new Set(generatedValues);
  const duplicatePlannedUhidCount = generatedValues.length - plannedUhidSet.size;
  const existingUhidSet = new Set(users.map(user => text(user.uhid)).filter(Boolean));
  const wouldCollideWithExisting = assignments.filter(student => existingUhidSet.has(student.newUhid)).length;

  console.log('Mode: READ-ONLY DRY RUN; no database writes performed');
  console.log('Target: medapp.users');
  console.log(`Valid student rows in workbook: ${students.length}`);
  console.log(`Imported student accounts found uniquely: ${assignments.length}`);
  console.log(`Students with an existing UHID: ${studentsWithUhid}`);
  console.log(`Students without a UHID: ${studentsWithoutUhid}`);
  console.log(`Total UHIDs planned for regeneration: ${assignments.length}`);
  console.log(`Existing User documents with a UHID (generation counter): ${existingUsersWithUhid}`);
  console.log(`Students already role=patient: ${alreadyPatient}`);
  console.log(`Students with another current role: ${otherRoles}`);
  console.log(`Roles that would change to patient: ${roleChanges}`);
  console.log(`Duplicate/conflicting student records: ${reconciliation.conflicts.length}`);
  console.log(`UHID generation candidates colliding with existing users: ${wouldCollideWithExisting}`);
  console.log(`UHIDs reserved/skipped because already in use: ${collisionSkips}`);
  console.log(`Duplicate UHIDs within planned batch: ${duplicatePlannedUhidCount}`);
  console.log(`Documents that would be updated: ${assignments.length}`);
  console.log(`Invalid nonblank workbook rows: ${invalidRows.length}`);
  console.log(`Students not accounted for: ${students.length - assignments.length - reconciliation.conflicts.length}`);

  if (invalidRows.length) {
    for (const issue of invalidRows) console.log(`INVALID ${issue.sheet} row ${issue.row}: ${issue.reason}`);
  }
  if (reconciliation.conflicts.length) {
    for (const issue of reconciliation.conflicts) {
      console.log(`CONFLICT ${issue.sheet} row ${issue.row}; roll=${JSON.stringify(issue.roll)}; email=${JSON.stringify(issue.email)}; reason=${issue.reason}`);
    }
  }

  console.log('Sample proposed changes (roll | email | old UHID | new UHID | current role | new role):');
  for (const student of assignments.slice(0, 5)) {
    console.log(`${student.roll} | ${student.email} | ${student.oldUhid || '(none)'} | ${student.newUhid} | ${student.currentRole || '(unset)'} | ${student.newRole}`);
  }
}

function assertSafePlan(students, invalidRows, reconciliation, uhidPlan, users) {
  const { assignments } = uhidPlan;
  const uniqueUhidCount = new Set(assignments.map(student => student.newUhid)).size;
  const existingUhidSet = new Set(users.map(user => text(user.uhid)).filter(Boolean));
  const collisionCount = assignments.filter(student => existingUhidSet.has(student.newUhid)).length;

  if (students.length !== EXPECTED_STUDENT_COUNT || assignments.length !== EXPECTED_STUDENT_COUNT) {
    throw new Error(`Expected ${EXPECTED_STUDENT_COUNT} students and unique accounts; found ${students.length} rows and ${assignments.length} accounts.`);
  }
  const unexpectedInvalidRows = invalidRows.filter(issue => issue.reason !== 'repeated header');
  if (unexpectedInvalidRows.length || reconciliation.conflicts.length) {
    throw new Error(`Refusing to apply with ${unexpectedInvalidRows.length} unexpected invalid rows and ${reconciliation.conflicts.length} account conflicts.`);
  }
  if (uniqueUhidCount !== assignments.length || collisionCount !== 0) {
    throw new Error('Refusing to apply because planned UHIDs are duplicated or collide with existing User UHIDs.');
  }
  if (assignments.some(student => !/^\d{4}$/.test(student.newUhid))) {
    throw new Error('Refusing to apply because one or more generated UHIDs are not four digits.');
  }
}

function buildConcurrencyFilter(student) {
  const filter = { _id: new mongoose.Types.ObjectId(student.userId) };
  if (student.expectedEmail === undefined) filter.email = { $exists: false };
  else filter.email = student.expectedEmail;
  if (student.expectedRoll === undefined) filter.roll = { $exists: false };
  else filter.roll = student.expectedRoll;
  if (student.expectedRole === undefined) filter.role = { $exists: false };
  else filter.role = student.expectedRole;

  if (student.expectedUhid === undefined) filter.uhid = { $exists: false };
  else if (student.expectedUhid === null || student.expectedUhid === '') {
    filter.uhid = { $in: [null, ''] };
  } else filter.uhid = student.expectedUhid;
  return filter;
}

async function applyPlan(assignments) {
  const session = await mongoose.startSession();
  let updated = 0;
  try {
    await session.withTransaction(async () => {
      const targetIds = assignments.map(student => new mongoose.Types.ObjectId(student.userId));
      const currentUsers = await User.find({ _id: { $in: targetIds } })
        .select('_id email roll uhid role')
        .session(session)
        .lean();
      if (currentUsers.length !== EXPECTED_STUDENT_COUNT) {
        throw new Error(`Target account count changed before apply: ${currentUsers.length}.`);
      }

      const newUhids = assignments.map(student => student.newUhid);
      const collisions = await User.find({ uhid: { $in: newUhids } })
        .select('_id')
        .session(session)
        .lean();
      if (collisions.length) throw new Error('A planned UHID became occupied before apply.');

      const operations = assignments.map(student => ({
        updateOne: {
          filter: buildConcurrencyFilter(student),
          update: { $set: { uhid: student.newUhid, role: 'patient' } }
        }
      }));
      const result = await User.bulkWrite(operations, { session, ordered: true });
      if (result.matchedCount !== EXPECTED_STUDENT_COUNT || result.modifiedCount !== EXPECTED_STUDENT_COUNT) {
        throw new Error(`Expected to update ${EXPECTED_STUDENT_COUNT} documents; matched ${result.matchedCount}, modified ${result.modifiedCount}.`);
      }

      const verified = await User.find({ _id: { $in: targetIds } })
        .select('_id email roll uhid role')
        .session(session)
        .lean();
      const byId = new Map(verified.map(user => [String(user._id), user]));
      const invalidResults = assignments.filter(student => {
        const user = byId.get(student.userId);
        return !user
          || user.uhid !== student.newUhid
          || user.role !== 'patient'
          || text(user.email).toLowerCase() !== student.email
          || text(user.roll).toLowerCase() !== student.roll.toLowerCase();
      });
      if (invalidResults.length) throw new Error(`Post-update transaction verification found ${invalidResults.length} mismatched accounts.`);
      updated = result.modifiedCount;
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
    return updated;
  } finally {
    await session.endSession();
  }
}

async function verifyProduction(assignments) {
  const emails = assignments.map(student => student.email);
  const students = await User.find({ email: { $in: emails } }).select('_id email roll uhid role').lean();
  const matching = students.length === EXPECTED_STUDENT_COUNT;
  const emailCounts = new Map();
  const uhidCounts = new Map();
  let invalid = 0;
  for (const user of students) {
    const email = text(user.email).toLowerCase();
    const uhid = text(user.uhid);
    emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
    if (uhid) uhidCounts.set(uhid, (uhidCounts.get(uhid) || 0) + 1);
    if (!/^\d{4}$/.test(uhid) || user.role !== 'patient') invalid += 1;
  }
  const duplicateEmails = [...emailCounts.values()].filter(count => count !== 1).length;
  const duplicateUhids = [...uhidCounts.values()].filter(count => count > 1).length;
  const emailSet = new Set(emails);
  const externalCollision = await User.countDocuments({
    uhid: { $in: [...uhidCounts.keys()] },
    email: { $nin: [...emailSet] }
  });
  return {
    found: students.length,
    invalidRoleOrUhid: invalid,
    duplicateEmails,
    duplicateUhids,
    collisionsWithOtherUsers: externalCollision,
    verified: matching && invalid === 0 && duplicateEmails === 0 && duplicateUhids === 0 && externalCollision === 0
  };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const confirmed = process.argv.includes('--confirm-uhid-regeneration');
  if (apply && !confirmed) {
    throw new Error('Apply requires explicit --confirm-uhid-regeneration approval.');
  }
  if (!process.env.MONGO_URI) throw new Error('Confirmed production MongoDB URI was not provided in the environment.');
  const { students, invalidRows } = readStudents();
  if (students.length !== EXPECTED_STUDENT_COUNT) {
    throw new Error(`Expected ${EXPECTED_STUDENT_COUNT} valid student rows, found ${students.length}; no database write attempted.`);
  }

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  if (mongoose.connection.db.databaseName !== 'medapp' || User.collection.collectionName !== 'users') {
    throw new Error('Connected target did not resolve to medapp.users.');
  }

  const users = await User.find({}).select('_id email roll uhid role').lean();
  const reconciliation = getAccountMatches(students, users);
  const uhidPlan = assignCollisionSafeUhidPlan(reconciliation.plan, users);
  assertSafePlan(students, invalidRows, reconciliation, uhidPlan, users);
  printReport(students, invalidRows, reconciliation, uhidPlan, users);

  if (apply) {
    const updated = await applyPlan(uhidPlan.assignments);
    const verification = await verifyProduction(uhidPlan.assignments);
    console.log('APPLY RESULTS');
    console.log(`Updated documents: ${updated}`);
    console.log(`Post-update accounts found: ${verification.found}`);
    console.log(`Accounts with invalid UHID/role: ${verification.invalidRoleOrUhid}`);
    console.log(`Duplicate canonical emails: ${verification.duplicateEmails}`);
    console.log(`Duplicate student UHIDs: ${verification.duplicateUhids}`);
    console.log(`UHID collisions with other users: ${verification.collisionsWithOtherUsers}`);
    console.log(`Verification: ${verification.verified ? 'PASS' : 'FAIL'}`);
    if (!verification.verified) process.exitCode = 2;
  }
}

main()
  .catch(error => {
    console.error(`UHID dry run stopped: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
