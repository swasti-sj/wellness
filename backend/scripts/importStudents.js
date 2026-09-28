require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const Note = require('../models/Note');
const Prescription = require('../models/Prescription');
const Vital = require('../models/Vital');
const Test = require('../models/Test');
const Referral = require('../models/Referral');
const MedicineIssuance = require('../models/MedicineIssuance');
const ActivityLog = require('../models/ActivityLog');
const SessionLog = require('../models/SessionLog');
const ReceptionistEntry = require('../models/ReceptionistEntry');

const REFERENCE_DATE = new Date(Date.UTC(2026, 8, 28));
const EXPECTED_SHEETS = ['UG', 'PG'];
const CATEGORIES = {
  UG: /^(b\.?\s?tech|bs\b)/i,
  PG: /^(m\.?\s?sc|m\.?\s?tech|ms\b|ph\.?\s?d)/i
};

function parseArguments(argv) {
  const options = { offline: false, apply: false, confirmProduction: false, showManualDetails: false, file: null, planHash: null };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--offline') options.offline = true;
    else if (argument === '--apply') options.apply = true;
    else if (argument === '--confirm-production') options.confirmProduction = true;
    else if (argument === '--show-manual-details') options.showManualDetails = true;
    else if (argument === '--file') options.file = argv[++index];
    else if (argument === '--plan-hash') options.planHash = argv[++index];
    else throw new Error(`Unknown argument: ${argument}`);
  }

  if (options.file && !options.file.trim()) throw new Error('--file requires a workbook path');
  if (options.apply && options.offline) throw new Error('--apply cannot be combined with --offline');
  if (options.apply && (!options.confirmProduction || !options.planHash)) {
    throw new Error('--apply requires --confirm-production and the hash from a reviewed production dry run');
  }

  return options;
}

function normalizeHeader(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cellText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function getColumnIndexes(header) {
  const normalized = header.map(normalizeHeader);
  const find = aliases => normalized.findIndex(value => aliases.includes(value));
  const columns = {
    roll: find(['roll no', 'roll number']),
    name: find(['student name', 'name']),
    dob: find(['dob', 'date of birth']),
    gender: find(['gender', 'sex']),
    phone: find(['mobile no', 'mobile number', 'phone', 'phone number']),
    program: find(['program', 'academic program'])
  };
  const missing = Object.entries(columns)
    .filter(([key, index]) => index < 0 && key !== 'phone')
    .map(([key]) => key);

  if (missing.length) {
    throw new Error(`Required workbook columns not found: ${missing.join(', ')}`);
  }

  return columns;
}

function isBlankRow(row) {
  return row.every(value => !cellText(value));
}

function isRepeatedHeader(row, header, columns) {
  return ['roll', 'name', 'dob', 'gender', 'program']
    .filter(key => normalizeHeader(row[columns[key]]) === normalizeHeader(header[columns[key]]))
    .length >= 3;
}

function validCalendarDate(year, month, day) {
  if (year < 1900 || year > REFERENCE_DATE.getUTCFullYear()) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  if (date > REFERENCE_DATE) return null;
  return date;
}

function parseDateOfBirth(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return validCalendarDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? validCalendarDate(parsed.y, parsed.m, parsed.d) : null;
  }

  const text = cellText(value);
  let match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    // The source is an IIT Dharwad roster using Indian day/month/year ordering.
    return validCalendarDate(Number(match[3]), Number(match[2]), Number(match[1]));
  }

  match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    return validCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  return null;
}

function calculateAge(dateOfBirth) {
  let age = REFERENCE_DATE.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const birthdayPending = REFERENCE_DATE.getUTCMonth() < dateOfBirth.getUTCMonth()
    || (REFERENCE_DATE.getUTCMonth() === dateOfBirth.getUTCMonth()
      && REFERENCE_DATE.getUTCDate() < dateOfBirth.getUTCDate());
  if (birthdayPending) age -= 1;
  return age;
}

function readWorkbook(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Workbook not found: ${filePath}`);

  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const missingSheets = EXPECTED_SHEETS.filter(sheet => !workbook.SheetNames.includes(sheet));
  if (missingSheets.length) throw new Error(`Required workbook sheets not found: ${missingSheets.join(', ')}`);

  const result = { totalExcelRows: 0, blankRows: 0, repeatedHeaderRows: 0, invalidRows: 0, validStudentRows: 0, students: [], issues: [] };

  for (const sheetName of EXPECTED_SHEETS) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      defval: '',
      raw: true
    });
    const headerIndex = rows.findIndex(row => !isBlankRow(row));
    if (headerIndex < 0) throw new Error(`Sheet ${sheetName} has no header row`);

    const header = rows[headerIndex].map(cellText);
    const columns = getColumnIndexes(header);
    const dataRows = rows.slice(headerIndex + 1);
    result.totalExcelRows += dataRows.length;

    dataRows.forEach((row, rowIndex) => {
      const excelRow = headerIndex + rowIndex + 2;
      if (isBlankRow(row)) {
        result.blankRows += 1;
        return;
      }

      if (isRepeatedHeader(row, header, columns)) {
        result.repeatedHeaderRows += 1;
        result.invalidRows += 1;
        result.issues.push({ type: 'invalid', sheet: sheetName, row: excelRow, reason: 'repeated header row' });
        return;
      }

      const source = {
        sheet: sheetName,
        row: excelRow,
        roll: cellText(row[columns.roll]),
        name: cellText(row[columns.name]),
        dobText: cellText(row[columns.dob]),
        gender: cellText(row[columns.gender]),
        phone: columns.phone < 0 ? '' : cellText(row[columns.phone]),
        program: cellText(row[columns.program])
      };
      const reasons = [];

      if (!source.name) reasons.push('missing student name');
      if (!source.roll) reasons.push('missing roll number');
      if (source.roll && !/^[A-Za-z0-9._+-]+$/.test(source.roll)) {
        reasons.push('roll number cannot form a valid institutional email');
      }
      const dateOfBirth = parseDateOfBirth(row[columns.dob]);
      if (!dateOfBirth) reasons.push('missing, malformed, invalid, or future DOB');
      const sex = source.gender.toLowerCase();
      if (!['male', 'female', 'other'].includes(sex)) reasons.push('missing or unsupported gender');
      if (!source.program) reasons.push('missing academic program');

      if (reasons.length) {
        result.invalidRows += 1;
        result.issues.push({ type: 'invalid', sheet: sheetName, row: excelRow, reason: reasons.join('; ') });
        return;
      }

      result.validStudentRows += 1;
      if (!CATEGORIES[sheetName].test(source.program)) {
        result.issues.push({ type: 'manual', sheet: sheetName, row: excelRow, reason: 'program does not match its UG/PG sheet' });
        result.students.push({ ...source, dateOfBirth, sex: sex[0].toUpperCase() + sex.slice(1), status: 'manual' });
        return;
      }

      source.email = `${source.roll}@iitdh.ac.in`.toLowerCase();
      source.dateOfBirth = dateOfBirth;
      source.age = calculateAge(dateOfBirth);
      source.sex = sex[0].toUpperCase() + sex.slice(1);
      source.patientCategory = 'Student';
      source.status = 'candidate';
      result.students.push(source);
    });
  }

  return result;
}

function studentSignature(student) {
  return JSON.stringify({
    email: student.email,
    roll: student.roll.toLowerCase(),
    name: student.name.toLowerCase(),
    dob: student.dateOfBirth.toISOString(),
    sex: student.sex,
    phone: student.phone,
    program: student.program
  });
}

function classifySourceDuplicates(data) {
  const candidates = data.students.filter(student => student.status === 'candidate');
  const groups = new Map();
  for (const student of candidates) {
    const group = groups.get(student.email) || [];
    group.push(student);
    groups.set(student.email, group);
  }

  let duplicateExcelRows = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    duplicateExcelRows += group.length - 1;
    const identical = group.every(student => studentSignature(student) === studentSignature(group[0]));
    if (identical) {
      group.slice(1).forEach(student => {
        student.status = 'duplicate';
        data.issues.push({ type: 'duplicate', sheet: student.sheet, row: student.row, reason: 'same student appears more than once in the workbook' });
      });
    } else {
      group.forEach(student => {
        student.status = 'manual';
        data.issues.push({ type: 'manual', sheet: student.sheet, row: student.row, reason: 'duplicate roll/email has conflicting workbook details' });
      });
    }
  }

  data.duplicateExcelRows = duplicateExcelRows;
  return data.students.filter(student => student.status === 'candidate');
}

function isEmpty(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function normalizedName(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function namesCompatible(first, second) {
  const firstTokens = normalizedName(first).split(/\s+/).filter(Boolean);
  const secondTokens = normalizedName(second).split(/\s+/).filter(Boolean);
  if (!firstTokens.length || firstTokens.length !== secondTokens.length) return false;
  const sortedFirst = firstTokens.slice().sort();
  const sortedSecond = secondTokens.slice().sort();
  return sortedFirst.every((token, index) => token === sortedSecond[index]);
}

function existingNameIsSubset(existingName, rosterName) {
  const existingTokens = normalizedName(existingName).split(/\s+/).filter(Boolean);
  const rosterTokens = new Set(normalizedName(rosterName).split(/\s+/).filter(Boolean));
  return existingTokens.length > 0 && existingTokens.every(token => rosterTokens.has(token));
}

function buildProfile(student) {
  const profile = {
    name: student.name,
    email: student.email,
    roll: student.roll,
    sex: student.sex,
    age: student.age,
    patientCategory: student.patientCategory,
    role: 'patient',
    profileComplete: false,
    consentAccepted: false
  };
  if (student.phone) profile.phone = student.phone;
  return profile;
}

function indexUsers(users) {
  const byEmail = new Map();
  const byRoll = new Map();
  for (const user of users) {
    if (user.email) {
      const key = user.email.trim().toLowerCase();
      byEmail.set(key, [...(byEmail.get(key) || []), user]);
    }
    if (user.roll) {
      const key = user.roll.trim().toLowerCase();
      byRoll.set(key, [...(byRoll.get(key) || []), user]);
    }
  }
  return { byEmail, byRoll };
}

function planDatabaseActions(data, users) {
  const indexes = indexUsers(users);
  const actions = [];
  const manualReviews = [];
  const matchedUserIds = new Set();
  const counts = {
    studentRowsWithExistingMatches: 0,
    matchedExistingUserRecords: 0,
    newUsersToInsert: 0,
    existingUsersToUpdate: 0,
    canonicalEmailUpdates: 0,
    fillEmptyOnlyUpdates: 0,
    existingUsersSkipped: 0,
    manualReviewRows: 0
  };

  for (const student of data.students) {
    if (student.status === 'manual') counts.manualReviewRows += 1;
  }

  for (const student of data.students.filter(item => item.status === 'candidate')) {
    const emailMatches = indexes.byEmail.get(student.email) || [];
    const rollMatches = indexes.byRoll.get(student.roll.toLowerCase()) || [];
    const matches = new Map([...emailMatches, ...rollMatches].map(user => [String(user._id), user]));

    if (matches.size > 1) {
      counts.studentRowsWithExistingMatches += 1;
      [...matches.keys()].forEach(id => matchedUserIds.add(id));
      counts.manualReviewRows += 1;
      const matchedUsers = [...matches.values()];
      const emailIds = new Set(emailMatches.map(user => String(user._id)));
      const rollIds = new Set(rollMatches.map(user => String(user._id)));
      const reason = [...emailIds].some(id => !rollIds.has(id)) && [...rollIds].some(id => !emailIds.has(id))
        ? 'Excel-derived email and roll number match different existing users'
        : 'Multiple existing users match the Excel-derived email or roll number';
      data.issues.push({ type: 'manual', sheet: student.sheet, row: student.row, reason });
      manualReviews.push({
        student,
        reason,
        action: 'Do not update either account, do not merge them, and do not insert a third account until the legitimate account is confirmed.',
        matchedUsers
      });
      continue;
    }

    if (matches.size === 0) {
      counts.newUsersToInsert += 1;
      actions.push({ kind: 'insert', student, profile: buildProfile(student) });
      continue;
    }

    const [user] = matches.values();
    counts.studentRowsWithExistingMatches += 1;
    matchedUserIds.add(String(user._id));
    const matchedByRoll = rollMatches.some(match => String(match._id) === String(user._id));
    const emailConflict = !isEmpty(user.email) && user.email.trim().toLowerCase() !== student.email;
    const rollConflict = !isEmpty(user.roll) && user.roll.trim().toLowerCase() !== student.roll.toLowerCase();
    const legacyPlaceholderEmail = typeof user.email === 'string'
      && user.email.toLowerCase().endsWith('@wellness.local');
    const hasReceptionistStudentProof = user.receptionistStudentRolls?.includes(student.roll.toLowerCase()) || false;
    const verifiedPlaceholder = matchedByRoll
      && user.role === 'user'
      && (legacyPlaceholderEmail || user.email?.trim().toLowerCase() === student.email)
      && hasReceptionistStudentProof;
    const nameConflict = !namesCompatible(user.name, student.name)
      && !(verifiedPlaceholder && existingNameIsSubset(user.name, student.name));
    const categoryConflict = !isEmpty(user.patientCategory) && user.patientCategory !== 'Student';
    const roleConflict = user.role && !['patient', 'user'].includes(user.role);
    const canCanonicalizePlaceholder = emailConflict
      && verifiedPlaceholder
      && legacyPlaceholderEmail
      && !nameConflict;

    if ((emailConflict && !canCanonicalizePlaceholder) || rollConflict || nameConflict || categoryConflict || roleConflict) {
      counts.manualReviewRows += 1;
      const conflicts = [];
      if (emailConflict && !canCanonicalizePlaceholder) conflicts.push('existing email differs from canonical roll-derived email and is not a verified receptionist placeholder');
      if (rollConflict) conflicts.push('existing roll differs from Excel roll');
      if (nameConflict) conflicts.push('existing name does not match the student name token-for-token');
      if (categoryConflict) conflicts.push(`existing patientCategory is ${user.patientCategory}`);
      if (roleConflict) conflicts.push(`existing role is ${user.role}`);
      const reason = conflicts.join('; ');
      data.issues.push({ type: 'manual', sheet: student.sheet, row: student.row, reason });
      manualReviews.push({
        student,
        reason,
        action: 'Do not update or insert this student until the identity conflict is resolved.',
        matchedUsers: [user]
      });
      continue;
    }

    const sourceProfile = buildProfile(student);
    const updates = {};
    for (const key of ['name', 'roll', 'sex', 'age', 'phone', 'patientCategory']) {
      if (!isEmpty(sourceProfile[key]) && isEmpty(user[key])) updates[key] = sourceProfile[key];
    }
    const correctAge = user.age !== student.age;
    if (correctAge) updates.age = student.age;
    if (canCanonicalizePlaceholder || isEmpty(user.email)) updates.email = student.email;

    if (Object.keys(updates).length) {
      counts.existingUsersToUpdate += 1;
      if (canCanonicalizePlaceholder) counts.canonicalEmailUpdates += 1;
      else counts.fillEmptyOnlyUpdates += 1;
      actions.push({
        kind: 'update',
        student,
        userId: String(user._id),
        updates,
        expectedEmail: user.email,
        forceCanonicalEmail: canCanonicalizePlaceholder,
        expectedAge: user.age,
        forceCorrectAge: correctAge,
        snapshot: user
      });
    } else {
      counts.existingUsersSkipped += 1;
      actions.push({ kind: 'skip', student, userId: String(user._id), snapshot: user });
    }
  }

  counts.matchedExistingUserRecords = matchedUserIds.size;

  const digestInput = actions.map(action => ({
    kind: action.kind,
    row: action.student.row,
    sheet: action.student.sheet,
    profile: action.profile,
    updates: action.updates,
    userId: action.userId,
    expectedEmail: action.expectedEmail,
    forceCanonicalEmail: action.forceCanonicalEmail,
    expectedAge: action.expectedAge,
    forceCorrectAge: action.forceCorrectAge,
    snapshot: action.snapshot
  }));
  const reviewedPlan = {
    totalExcelRows: data.totalExcelRows,
    blankRows: data.blankRows,
    repeatedHeaderRows: data.repeatedHeaderRows,
    invalidRows: data.invalidRows,
    validStudentRows: data.validStudentRows,
    duplicateExcelRows: data.duplicateExcelRows,
    issues: data.issues,
    counts,
    actions: digestInput
  };
  const planHash = crypto.createHash('sha256').update(JSON.stringify(reviewedPlan)).digest('hex');
  return { actions, counts, planHash, manualReviews };
}

async function readAccountReferences(manualReviews) {
  const userIds = new Set();
  for (const review of manualReviews) {
    review.referenceCounts = [];
    review.matchedUsers.forEach(user => userIds.add(String(user._id)));
  }

  const userById = new Map();
  for (const review of manualReviews) {
    review.matchedUsers.forEach(user => userById.set(String(user._id), user));
  }

  const countsById = new Map();
  for (const userId of userIds) {
    const user = userById.get(userId);
    const appointments = await Appointment.find({ user: user._id }).select('_id').lean();
    const appointmentIds = appointments.map(appointment => appointment._id);
    const entryFilters = [];
    if (user.roll) entryFilters.push({ roll: new RegExp(`^${user.roll.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
    if (user.email) entryFilters.push({ email: user.email });
    if (appointmentIds.length) entryFilters.push({ appointmentId: { $in: appointmentIds } });

    const [prescriptions, vitals, tests, referrals, medicineIssuances, activityLogs, sessionLogs, notes, receptionistEntries] = await Promise.all([
      Prescription.countDocuments({ patient: user._id }),
      Vital.countDocuments({ patient: user._id }),
      Test.countDocuments({ patient: user._id }),
      Referral.countDocuments({ patient: user._id }),
      MedicineIssuance.countDocuments({ patient: user._id }),
      ActivityLog.countDocuments({ userId: user._id }),
      SessionLog.countDocuments({ userId: user._id }),
      appointmentIds.length ? Note.countDocuments({ appointment: { $in: appointmentIds } }) : 0,
      entryFilters.length ? ReceptionistEntry.countDocuments({ $or: entryFilters }) : 0
    ]);

    countsById.set(userId, {
      dependants: (user.dependants || []).length,
      appointments: appointments.length,
      notes,
      prescriptions,
      vitals,
      tests,
      referrals,
      medicineIssuances,
      activityLogs,
      sessionLogs,
      receptionistEntries
    });
  }

  for (const review of manualReviews) {
    review.referenceCounts = review.matchedUsers.map(user => ({
      userId: String(user._id),
      counts: countsById.get(String(user._id))
    }));
  }
}

function assertProductionTarget() {
  if (!process.env.MONGO_URI) throw new Error('Production MONGO_URI is not configured.');

  const match = process.env.MONGO_URI.match(/^mongodb(?:\+srv)?:\/\/([^/]+)\/([^/?]+)(?:\?(.+))?$/i);
  if (!match) throw new Error('Production MongoDB URI is invalid.');

  const authority = match[1];
  const credentialsEnd = authority.lastIndexOf('@');
  const credentials = credentialsEnd >= 0 ? authority.slice(0, credentialsEnd) : '';
  const hosts = authority.slice(credentialsEnd + 1).split(',').map(host => host.trim());
  const databaseName = decodeURIComponent(match[2]);
  const query = match[3] || '';
  const authSource = (query.match(/(?:^|&)authSource=([^&]+)/i) || [])[1];
  const hostNames = hosts.map(host => {
    const normalized = host.toLowerCase();
    return normalized.startsWith('[')
      ? normalized.slice(1, normalized.indexOf(']'))
      : normalized.split(':')[0];
  });
  const localFlags = hostNames.map(host => ['localhost', '127.0.0.1', '::1'].includes(host));
  const isLocal = localFlags.every(Boolean);
  const isRemote = localFlags.every(flag => !flag);
  const authenticated = credentials.includes(':') && decodeURIComponent(authSource || '') === 'admin';

  if (databaseName !== 'medapp' || !hosts.length || !authenticated || (!isLocal && !isRemote)) {
    throw new Error('Refusing database access: expected authenticated production medapp.');
  }
  if (isLocal && !(process.platform === 'linux' && fs.existsSync('/etc/mongod.conf') && process.env.NODE_ENV === 'production')) {
    throw new Error('Refusing database access: local MongoDB is not the deployed production target.');
  }

  return isLocal ? 'production VM MongoDB' : 'remote authenticated MongoDB';
}

async function readExistingUsers(students) {
  const emails = [...new Set(students.map(student => student.email))];
  const rolls = [...new Set(students.map(student => student.roll))];
  const conditions = [];
  if (emails.length) conditions.push({ email: { $in: emails } });
  if (rolls.length) conditions.push({ roll: { $in: rolls } });
  if (!conditions.length) return [];

  const users = await User.find({ $or: conditions })
    .select('_id email roll name sex age phone patientCategory role dependants')
    .collation({ locale: 'en', strength: 2 })
    .lean();

  await Promise.all(users.map(async user => {
    if (user.role !== 'user' || !user.roll) return;
    const escapedRoll = user.roll.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const entries = await ReceptionistEntry.find({
      roll: new RegExp(`^${escapedRoll}$`, 'i'),
      role: 'Student'
    }).select('patientName roll').lean();
    const hasExactProvenance = entries.some(entry =>
      entry.roll.trim().toLowerCase() === user.roll.trim().toLowerCase()
      && normalizedName(entry.patientName) === normalizedName(user.name)
    );
    if (hasExactProvenance) {
      user.receptionistStudentRolls = [user.roll.trim().toLowerCase()];
    }
  }));

  return users;
}

function printReport(data, counts, target, planHash, manualReviews = []) {
  const issueCounts = {
    invalid: data.issues.filter(issue => issue.type === 'invalid').length,
    duplicate: data.duplicateExcelRows || 0,
    manual: counts ? counts.manualReviewRows : data.issues.filter(issue => issue.type === 'manual').length
  };
  const validRows = data.validStudentRows;

  console.log(`Database target: ${target}`);
  console.log(`Total Excel data rows (including blank rows): ${data.totalExcelRows}`);
  console.log(`Blank rows: ${data.blankRows}`);
  console.log(`Valid student rows before duplicate reconciliation: ${validRows}`);
  console.log(`Invalid rows: ${issueCounts.invalid}`);
  console.log(`Repeated header rows (included in invalid rows): ${data.repeatedHeaderRows}`);
  console.log(`Duplicate Excel rows: ${issueCounts.duplicate}`);
  if (counts) {
    console.log(`Student rows matching existing users: ${counts.studentRowsWithExistingMatches}`);
    console.log(`Distinct existing user records matched: ${counts.matchedExistingUserRecords}`);
    console.log(`New users to insert: ${counts.newUsersToInsert}`);
    console.log(`Existing users to update: ${counts.existingUsersToUpdate}`);
    console.log(`  Canonical email replacements: ${counts.canonicalEmailUpdates}`);
    console.log(`  Fill-empty-only updates: ${counts.fillEmptyOnlyUpdates}`);
    console.log(`Existing users skipped: ${counts.existingUsersSkipped}`);
    console.log(`Rows requiring manual review: ${issueCounts.manual}`);
    const rowsAccountedFor = counts.newUsersToInsert + counts.existingUsersToUpdate
      + counts.existingUsersSkipped + issueCounts.manual + issueCounts.duplicate
      + issueCounts.invalid + data.blankRows;
    console.log(`Rows not accounted for: ${data.totalExcelRows - rowsAccountedFor}`);
  } else {
    console.log('Already existing users: NOT CHECKED (offline workbook-only run)');
    console.log(`Potential new users before database reconciliation: ${data.students.filter(student => student.status === 'candidate').length}`);
    console.log('Existing users to update: NOT CHECKED');
    console.log('Existing users skipped: NOT CHECKED');
    console.log(`Rows requiring manual review: ${issueCounts.manual}`);
  }
  console.log(`Production plan hash: ${planHash || 'NOT AVAILABLE (offline run)'}`);

  for (const issue of data.issues) {
    console.log(`${issue.type.toUpperCase()} ${issue.sheet} row ${issue.row}: ${issue.reason}`);
  }

  if (manualReviews.length) {
    console.log('Manual-review comparisons:');
    for (const [index, review] of manualReviews.entries()) {
      const { student } = review;
      console.log(`Conflict ${index + 1}: ${student.sheet} Excel row ${student.row}`);
      console.log(`  Excel student: name=${JSON.stringify(student.name)}; roll=${JSON.stringify(student.roll)}; email=${JSON.stringify(student.email)}`);
      console.log(`  Reason: ${review.reason}`);
      console.log('  Existing matched users:');
      for (const user of review.matchedUsers) {
        const id = String(user._id);
        console.log(`    _id=${id.slice(0, 8)}...${id.slice(-4)}; name=${JSON.stringify(user.name || '')}; roll=${JSON.stringify(user.roll || '')}; email=${JSON.stringify(user.email || '')}; role=${JSON.stringify(user.role || '')}; patientCategory=${JSON.stringify(user.patientCategory || '')}`);
      }
      if (review.referenceCounts?.length) {
        console.log('  Linked records by existing account (counts only):');
        for (const reference of review.referenceCounts) {
          const id = reference.userId;
          console.log(`    _id=${id.slice(0, 8)}...${id.slice(-4)}; ${JSON.stringify(reference.counts)}`);
        }
      }
      console.log(`  Proposed action: ${review.action}`);
    }
  }
}

function emptyValueFilter(key) {
  const emptyConditions = [{ [key]: { $exists: false } }, { [key]: null }];
  if (key !== 'age') emptyConditions.push({ [key]: '' });
  return { $or: emptyConditions };
}

async function applyActions(actions) {
  const result = { inserted: 0, updated: 0, skipped: 0, errors: 0 };

  for (const action of actions) {
    if (action.kind === 'skip') {
      result.skipped += 1;
      continue;
    }

    try {
      if (action.kind === 'insert') {
        const existing = await User.findOne({
          $or: [{ email: action.profile.email }, { roll: action.profile.roll }]
        }).collation({ locale: 'en', strength: 2 }).select('_id').lean();
        if (existing) {
          result.errors += 1;
          console.error(`WRITE CONFLICT ${action.student.sheet} row ${action.student.row}: a matching user appeared after planning; no change made`);
          continue;
        }
        await User.create(action.profile);
        result.inserted += 1;
        continue;
      }

      const updateFields = Object.keys(action.updates).filter(key => !(key === 'email' && action.forceCanonicalEmail));
      const conditions = updateFields
        .filter(key => !(key === 'age' && action.forceCorrectAge))
        .map(emptyValueFilter);
      if (action.forceCanonicalEmail) conditions.push({ email: action.expectedEmail });
      if (action.forceCorrectAge) conditions.push({ age: action.expectedAge });
      const updated = await User.findOneAndUpdate({
        _id: action.userId,
        $and: conditions
      }, { $set: action.updates }, { new: true, runValidators: true }).select('_id').lean();

      if (!updated) {
        result.errors += 1;
        console.error(`WRITE CONFLICT ${action.student.sheet} row ${action.student.row}: existing profile changed after planning; no change made`);
      } else {
        result.updated += 1;
      }
    } catch {
      result.errors += 1;
      console.error(`WRITE ERROR ${action.student.sheet} row ${action.student.row}: database operation failed`);
    }
  }

  return result;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const workbookPath = path.resolve(options.file || path.join(__dirname, '..', 'ACAD_- Students Basic Details_Wellness Center.xlsx'));
  const data = readWorkbook(workbookPath);
  const candidates = classifySourceDuplicates(data);

  if (options.offline) {
    const manualRows = data.students.filter(student => student.status === 'manual').length;
    printReport(data, null, 'NOT CONNECTED (no database access)', null);
    if (manualRows) process.exitCode = 2;
    return;
  }

  const targetDescription = assertProductionTarget();
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  const databaseName = mongoose.connection.db.databaseName;
  const collectionName = User.collection.collectionName;
  if (databaseName !== 'medapp' || collectionName !== 'users') {
    throw new Error('Connected database/model do not match the required medapp.users target.');
  }

  const existingUsers = await readExistingUsers(candidates);
  const plan = planDatabaseActions(data, existingUsers);
  if (options.showManualDetails) await readAccountReferences(plan.manualReviews);
  printReport(
    data,
    plan.counts,
    `${databaseName}.${collectionName} (${targetDescription})`,
    plan.planHash,
    options.showManualDetails ? plan.manualReviews : []
  );

  if (!options.apply) return;
  if (options.planHash !== plan.planHash) {
    throw new Error('The reviewed plan hash does not match the current production dry run; no writes were made.');
  }

  const result = await applyActions(plan.actions);
  console.log('Production write results:');
  console.log(`Inserted: ${result.inserted}`);
  console.log(`Updated: ${result.updated}`);
  console.log(`Skipped: ${result.skipped}`);
  console.log(`Errors/conflicts: ${result.errors}`);
  if (result.errors) process.exitCode = 2;
}

main()
  .catch(error => {
    console.error(`Student import stopped: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });