const path = require('path');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Nurse = require('../models/Nurse');
const Receptionist = require('../models/Receptionist');
const Pharmacist = require('../models/Pharmacist');
const Admin = require('../models/Admin');
const Appointment = require('../models/Appointment');
const Note = require('../models/Note');
const Vital = require('../models/Vital');
const Test = require('../models/Test');
const Prescription = require('../models/Prescription');
const Referral = require('../models/Referral');
const MedicineIssuance = require('../models/MedicineIssuance');
const ActivityLog = require('../models/ActivityLog');
const SessionLog = require('../models/SessionLog');
const ReceptionistEntry = require('../models/ReceptionistEntry');

const WORKBOOK_PATH = path.join(__dirname, '..', 'Wellnessdatastaff.xlsx');
const SHEET_CATEGORIES = {
  'Regular Staff': 'Regular Staff',
  'contractual staff': 'Contractual Staff'
};
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_DOMAIN = 'iitdh.ac.in';

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function normalizeHeader(value) {
  return text(value).toLowerCase().replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function blankRow(row) {
  return row.every(value => !text(value));
}

function columnIndexes(header) {
  const normalized = header.map(normalizeHeader);
  const find = aliases => normalized.findIndex(value => aliases.includes(value));
  const columns = {
    serial: find(['sl no', 'serial no', 's no']),
    staffId: find(['emp id', 'employee id', 'staff id']),
    name: find(['name', 'staff name', 'employee name']),
    designation: find(['designation', 'position', 'job title']),
    email: find(['institute mail id', 'institutional email id', 'email', 'email id', 'mail id']),
    phone: find(['phone', 'phone number', 'mobile', 'mobile number', 'contact']),
    dob: find(['dob', 'date of birth', 'birth date']),
    age: find(['age']),
    gender: find(['gender', 'sex']),
    department: find(['department', 'dept'])
  };
  const required = ['staffId', 'name', 'designation', 'email'];
  const missing = required.filter(key => columns[key] < 0);
  if (missing.length) throw new Error(`Required staff workbook columns not found: ${missing.join(', ')}`);
  return columns;
}

function isRepeatedHeader(row, header, columns) {
  return [columns.staffId, columns.name, columns.email]
    .filter(index => normalizeHeader(row[index]) === normalizeHeader(header[index]))
    .length === 3;
}

function readWorkbook() {
  const workbook = XLSX.readFile(WORKBOOK_PATH, { cellDates: false });
  const records = [];
  const report = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
    const headerIndex = rows.findIndex(row => !blankRow(row));
    if (headerIndex < 0) {
      report.push({ sheetName, header: [], headerRow: null, bodyRows: 0, blankRows: 0, repeatedHeaders: 0, nonblankRows: 0 });
      continue;
    }

    const header = rows[headerIndex].map(text);
    const columns = columnIndexes(header);
    const body = rows.slice(headerIndex + 1);
    let blankRows = 0;
    let repeatedHeaders = 0;
    let nonblankRows = 0;

    body.forEach((row, offset) => {
      const excelRow = headerIndex + offset + 2;
      if (blankRow(row)) {
        blankRows += 1;
        return;
      }
      nonblankRows += 1;
      if (isRepeatedHeader(row, header, columns)) {
        repeatedHeaders += 1;
        records.push({ sheetName, excelRow, repeatedHeader: true });
        return;
      }

      const sourceCategory = SHEET_CATEGORIES[sheetName] || '';
      const rawEmail = text(row[columns.email]);
      const email = rawEmail.toLowerCase();
      const record = {
        sheetName,
        excelRow,
        staffId: text(row[columns.staffId]),
        name: text(row[columns.name]),
        designation: text(row[columns.designation]),
        rawEmail,
        email,
        sourceCategory,
        phone: columns.phone < 0 ? '' : text(row[columns.phone]),
        dob: columns.dob < 0 ? '' : text(row[columns.dob]),
        age: columns.age < 0 ? '' : text(row[columns.age]),
        gender: columns.gender < 0 ? '' : text(row[columns.gender]),
        department: columns.department < 0 ? '' : text(row[columns.department]),
        issues: []
      };

      if (!record.staffId) record.issues.push('missing employee/staff ID');
      if (!record.name) record.issues.push('missing name');
      if (!record.email) record.issues.push('missing email');
      else if (!EMAIL_PATTERN.test(record.email)) record.issues.push('malformed email');
      else if (record.email.split('@')[1] !== EMAIL_DOMAIN) record.issues.push('email domain is not iitdh.ac.in; patient OAuth will not accept it');
      if (!sourceCategory) record.issues.push('sheet name does not map to a supported User.patientCategory');
      records.push(record);
    });

    report.push({
      sheetName,
      headerRow: headerIndex + 1,
      header,
      bodyRows: body.length,
      nonblankRows,
      blankRows,
      repeatedHeaders
    });
  }

  return { records, sheets: report };
}

function addIndex(index, key, record) {
  if (!key) return;
  index.set(key, [...(index.get(key) || []), record]);
}

function collectDuplicateGroups(records, keyFor) {
  const index = new Map();
  for (const record of records) addIndex(index, keyFor(record), record);
  return [...index.entries()].filter(([, group]) => group.length > 1);
}

function classifyExcelDuplicates(records) {
  const nonHeaders = records.filter(record => !record.repeatedHeader);
  const duplicateStaffIds = collectDuplicateGroups(nonHeaders, record => record.staffId.toLowerCase());
  const duplicateEmails = collectDuplicateGroups(nonHeaders, record => record.email);
  const duplicates = new Map();
  for (const [key, group] of duplicateStaffIds) {
    for (const record of group) {
      duplicates.set(record, [...(duplicates.get(record) || []), `duplicate employee ID (${key})`]);
    }
  }
  for (const [key, group] of duplicateEmails) {
    for (const record of group) {
      duplicates.set(record, [...(duplicates.get(record) || []), `duplicate normalized email (${key})`]);
    }
  }
  return { nonHeaders, duplicateStaffIds, duplicateEmails, duplicates };
}

function nameKey(value) {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean).sort().join(' ');
}

function nameTokensCompatible(first, second) {
  const firstTokens = nameKey(first).split(' ').filter(Boolean);
  const secondTokens = nameKey(second).split(' ').filter(Boolean);
  if (!firstTokens.length || !secondTokens.length) return false;
  const smaller = firstTokens.length <= secondTokens.length ? firstTokens : secondTokens;
  const larger = new Set(firstTokens.length <= secondTokens.length ? secondTokens : firstTokens);
  return smaller.every(token => larger.has(token));
}

function assessMatches(records, dbUsers, privilegedMatches) {
  const userByEmail = new Map();
  const userByStaffId = new Map();
  for (const user of dbUsers) {
    addIndex(userByEmail, text(user.email).toLowerCase(), user);
    addIndex(userByStaffId, text(user.roll).toLowerCase(), user);
  }

  const plans = [];
  const conflicts = [];
  const invalidRecords = [];
  const excelDuplicates = classifyExcelDuplicates(records);

  for (const record of excelDuplicates.nonHeaders) {
    const reasons = [...record.issues, ...(excelDuplicates.duplicates.get(record) || [])];
    if (reasons.length) {
      invalidRecords.push({ record, reasons });
      continue;
    }

    const emailMatches = userByEmail.get(record.email) || [];
    const idMatches = userByStaffId.get(record.staffId.toLowerCase()) || [];
    const userMatches = new Map([...emailMatches, ...idMatches].map(user => [String(user._id), user]));
    const otherRoleMatches = privilegedMatches.filter(match => match.email === record.email);

    if (userMatches.size > 1) {
      conflicts.push({ record, reason: 'email and employee ID match multiple User documents', matches: [...userMatches.values()] });
      continue;
    }

    if (userMatches.size === 1) {
      const [user] = userMatches.values();
      const matchedByEmail = emailMatches.some(match => String(match._id) === String(user._id));
      const matchedByStaffId = idMatches.some(match => String(match._id) === String(user._id));
      const nameCompatible = nameTokensCompatible(user.name, record.name);
      const existingCategory = text(user.patientCategory);
      const ts2308LegacyCategory = record.staffId.toLowerCase() === 'ts2308'
        && existingCategory === 'Staff'
        && matchedByEmail
        && matchedByStaffId
        && nameCompatible
        && user.role === 'patient';
      const categoryCompatible = !existingCategory || existingCategory === record.sourceCategory || ts2308LegacyCategory;
      const roleCompatible = !user.role || ['patient', 'user'].includes(user.role);
      const identityCompatible = matchedByEmail || (matchedByStaffId && nameCompatible);
      const issues = [];
      if (!identityCompatible) issues.push('employee-ID match does not have a matching normalized name');
      if (!categoryCompatible) issues.push(`existing patientCategory ${existingCategory} conflicts with ${record.sourceCategory}`);
      if (!roleCompatible) issues.push(`existing User role ${user.role} is incompatible with a patient account`);
      if (!nameCompatible && matchedByEmail) issues.push('email matches, but existing name differs from workbook name');
      if (issues.length) {
        conflicts.push({ record, reason: issues.join('; '), matches: [user] });
        continue;
      }

      const proposedUpdates = {};
      if (!text(user.name)) proposedUpdates.name = record.name;
      if (!existingCategory || ts2308LegacyCategory) proposedUpdates.patientCategory = record.sourceCategory;
      if (ts2308LegacyCategory) record.ts2308Verified = true;
      plans.push({
        record,
        kind: Object.keys(proposedUpdates).length ? 'update' : 'unchanged',
        userId: String(user._id),
        user,
        proposedRole: user.role || 'patient',
        proposedCategory: existingCategory || record.sourceCategory,
        proposedUpdates,
        doctorEmailMatches: otherRoleMatches
      });
      if (ts2308LegacyCategory) plans[plans.length - 1].proposedCategory = record.sourceCategory;
      continue;
    }

    plans.push({
      record,
      kind: 'new',
      userId: null,
      user: null,
      proposedRole: 'patient',
      proposedCategory: record.sourceCategory,
      proposedUpdates: {
        name: record.name,
        email: record.email,
        role: 'patient',
        patientCategory: record.sourceCategory,
        profileComplete: false
      },
      doctorEmailMatches: otherRoleMatches
    });
  }

  return { plans, conflicts, invalidRecords, excelDuplicates };
}

async function queryPrivilegedRoleCollections(emails) {
  const collections = [
    ['Doctor', Doctor],
    ['Nurse', Nurse],
    ['Receptionist', Receptionist],
    ['Pharmacist', Pharmacist],
    ['Admin', Admin]
  ];
  const matches = [];
  for (const [model, Model] of collections) {
    const docs = await Model.find({ email: { $in: emails } })
      .collation({ locale: 'en', strength: 2 })
      .select('_id email name role')
      .lean();
    for (const doc of docs) matches.push({ model, _id: String(doc._id), email: text(doc.email).toLowerCase(), name: text(doc.name), role: text(doc.role), googleId: text(doc.googleId) });
  }
  return matches;
}

async function inspectUserHistory(user) {
  const appointments = await Appointment.find({ user: user._id }).select('_id').lean();
  const appointmentIds = appointments.map(appointment => appointment._id);
  const filters = [];
  if (user.roll) filters.push({ roll: new RegExp(`^${text(user.roll).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
  if (user.email) filters.push({ email: user.email });
  if (appointmentIds.length) filters.push({ appointmentId: { $in: appointmentIds } });
  const [notes, vitals, tests, prescriptions, referrals, medicineIssuances, activities, sessions, receptionistEntries] = await Promise.all([
    appointmentIds.length ? Note.countDocuments({ appointment: { $in: appointmentIds } }) : 0,
    Vital.countDocuments({ patient: user._id }),
    Test.countDocuments({ patient: user._id }),
    Prescription.countDocuments({ patient: user._id }),
    Referral.countDocuments({ patient: user._id }),
    MedicineIssuance.countDocuments({ patient: user._id }),
    ActivityLog.countDocuments({ userId: user._id }),
    SessionLog.countDocuments({ userId: user._id }),
    filters.length ? ReceptionistEntry.countDocuments({ $or: filters }) : 0
  ]);
  return {
    appointments: appointments.length,
    notes,
    vitals,
    tests,
    prescriptions,
    dependants: (user.dependants || []).length,
    referrals,
    medicineIssuances,
    activityLogs: activities,
    sessionLogs: sessions,
    receptionistEntries
  };
}

async function enrichReadOnlyDetails(result, privilegedMatches) {
  for (const conflict of result.conflicts) {
    for (const match of conflict.matches) {
      if (match.model !== 'User' || !match._id) continue;
      const user = await User.findById(match._id)
        .select('_id email name roll role patientCategory uhid age sex phone emergencyContactNo allergies consentAccepted isVerified profileComplete googleId googleAccessToken googleRefreshToken picture dependants')
        .lean();
      if (user) {
        match.userDetails = user;
        match.linkedData = await inspectUserHistory(user);
      }
    }
  }

  for (const plan of result.plans.filter(item => item.record.staffId.toLowerCase() === 'ts2308' && item.user)) {
    plan.userDetails = await User.findById(plan.user._id)
      .select('_id email name roll role patientCategory uhid age sex phone emergencyContactNo allergies consentAccepted isVerified profileComplete googleId googleAccessToken googleRefreshToken picture dependants')
      .lean();
    if (plan.userDetails) plan.linkedData = await inspectUserHistory(plan.userDetails);
  }

  for (const conflict of result.conflicts.filter(item => privilegedMatches.some(match => match.email === item.record.email))) {
    conflict.associatedUsers = await User.find({
      $or: [
        { email: conflict.record.email },
        { roll: conflict.record.staffId }
      ]
    })
      .collation({ locale: 'en', strength: 2 })
      .select('_id email name roll role patientCategory uhid googleId')
      .lean();
    for (const user of conflict.associatedUsers) user.linkedData = await inspectUserHistory(user);
  }
}

function allocateNewUhids(plans, users) {
  const newPlans = plans.filter(plan => plan.kind === 'new');
  const occupied = new Set(users.map(user => text(user.uhid)).filter(Boolean));
  const currentCount = users.length;
  let nextNumber = currentCount + 1;
  let skipped = 0;
  for (const plan of newPlans) {
    let candidate = String(nextNumber).padStart(4, '0');
    while (occupied.has(candidate)) {
      skipped += 1;
      nextNumber += 1;
      candidate = String(nextNumber).padStart(4, '0');
    }
    plan.proposedUhid = candidate;
    occupied.add(candidate);
    nextNumber += 1;
  }
  return {
    newUhidCount: newPlans.length,
    existingUhidCount: currentCount,
    skippedCollisionCount: skipped,
    plannedCollisionCount: newPlans.filter(plan => users.some(user => text(user.uhid) === plan.proposedUhid)).length,
    duplicatePlannedCount: newPlans.length - new Set(newPlans.map(plan => plan.proposedUhid)).size
  };
}

function uniqueMap(items, keyFor) {
  const map = new Map();
  for (const item of items) {
    const key = keyFor(item);
    map.set(key, [...(map.get(key) || []), item]);
  }
  return map;
}

function printReport(sheets, allRecords, result, uhidState, uhidPlan) {
  const { plans, conflicts, invalidRecords, excelDuplicates } = result;
  const validRecords = excelDuplicates.nonHeaders.filter(record => !record.issues.length && !excelDuplicates.duplicates.has(record));
  const countsByCategory = uniqueMap(plans, plan => plan.proposedCategory);
  const emailMissing = excelDuplicates.nonHeaders.filter(record => !record.email).length;
  const emailMalformed = excelDuplicates.nonHeaders.filter(record => record.email && !EMAIL_PATTERN.test(record.email)).length;
  const emailWrongDomain = excelDuplicates.nonHeaders.filter(record => record.email && EMAIL_PATTERN.test(record.email) && record.email.split('@')[1] !== EMAIL_DOMAIN).length;
  const totalRows = sheets.reduce((sum, sheet) => sum + sheet.bodyRows, 0);
  const blankRows = sheets.reduce((sum, sheet) => sum + sheet.blankRows, 0);
  const repeatedHeaders = sheets.reduce((sum, sheet) => sum + sheet.repeatedHeaders, 0);
  const uniqueStaff = new Set(validRecords.map(record => record.staffId.toLowerCase())).size;
  const categoryTotals = new Map();
  for (const record of excelDuplicates.nonHeaders) {
    const category = SHEET_CATEGORIES[record.sheetName] || 'UNMAPPED';
    categoryTotals.set(category, (categoryTotals.get(category) || 0) + 1);
  }

  console.log('READ-ONLY STAFF IMPORT DRY RUN — no database writes');
  console.log('Database target: medapp.users; privileged-role collections were read only for email conflicts');
  console.log(`Sheets: ${sheets.map(sheet => sheet.sheetName).join(', ')}`);
  for (const sheet of sheets) {
    console.log(`SHEET ${sheet.sheetName}: header row ${sheet.headerRow}; columns=${JSON.stringify(sheet.header)}; body rows=${sheet.bodyRows}; nonblank=${sheet.nonblankRows}; blank=${sheet.blankRows}; repeated headers=${sheet.repeatedHeaders}`);
  }
  console.log(`Total body rows across sheets: ${totalRows}`);
  console.log(`Blank rows: ${blankRows}`);
  console.log(`Repeated-header rows excluded: ${repeatedHeaders}`);
  console.log(`Nonblank staff rows: ${excelDuplicates.nonHeaders.length}`);
  console.log(`Unique employee IDs: ${uniqueStaff}`);
  console.log(`Valid staff rows (required ID/name/email, valid IITDH email, mapped sheet category, unique identifiers): ${validRecords.length}`);
  console.log(`Invalid/incomplete source rows before duplicate exclusion: ${excelDuplicates.nonHeaders.filter(record => record.issues.length).length}`);
  console.log(`Duplicate Excel employee-ID groups: ${excelDuplicates.duplicateStaffIds.length}; extra rows=${excelDuplicates.duplicateStaffIds.reduce((sum, [, group]) => sum + group.length - 1, 0)}`);
  console.log(`Duplicate Excel normalized-email groups: ${excelDuplicates.duplicateEmails.length}; extra rows=${excelDuplicates.duplicateEmails.reduce((sum, [, group]) => sum + group.length - 1, 0)}`);
  console.log(`Missing emails: ${emailMissing}`);
  console.log(`Malformed emails: ${emailMalformed}`);
  console.log(`Non-IITDH email domains: ${emailWrongDomain}`);
  console.log(`New User documents proposed: ${plans.filter(plan => plan.kind === 'new').length}`);
  console.log(`Existing User documents matched: ${plans.filter(plan => plan.kind !== 'new').length + conflicts.filter(conflict => conflict.matches.some(match => match.model === 'User')).length}`);
  console.log(`Existing User documents requiring supported empty-field updates: ${plans.filter(plan => plan.kind === 'update').length}`);
  console.log(`Unchanged existing users: ${plans.filter(plan => plan.kind === 'unchanged').length}`);
  console.log(`Ambiguous/conflicting records: ${conflicts.length}`);
  const doctorEmailPlans = plans.filter(plan => plan.doctorEmailMatches?.length);
  console.log(`Doctor-email overlaps treated as separate-account proposals, not conflicts: ${doctorEmailPlans.length}`);
  console.log(`Invalid/incomplete rows: ${invalidRecords.length}`);
  console.log(`Category totals in workbook: ${JSON.stringify(Object.fromEntries(categoryTotals))}`);
  console.log('Category mapping and proposed User values:');
  for (const [sheet, category] of Object.entries(SHEET_CATEGORIES)) {
    const total = categoryTotals.get(category) || 0;
    console.log(`  ${sheet} -> patientCategory=${category}; new-account role=patient; profileComplete=false; expected rows=${total}`);
  }
  console.log('Field mapping: employee ID -> User.roll (generic institutional ID field); Name -> User.name; normalized institutional email -> User.email; sheet category -> User.patientCategory. Designation, DOB, age, sex, phone, and department have no source column or compatible User field and are not mapped.');
  console.log('UHID decision: assign at import for new patient User accounts using users.js logic: count nonempty User UHIDs, add one, and pad to four digits; skip any value already occupied, including values planned earlier in this batch. Existing users’ UHIDs are preserved.');
  console.log(`New UHIDs planned: ${uhidPlan.newUhidCount}`);
  console.log(`Existing nonempty User UHIDs encountered: ${uhidPlan.existingUhidCount}`);
  console.log(`Existing UHID candidates skipped due to collision: ${uhidPlan.skippedCollisionCount}`);
  console.log(`Planned UHID collisions against existing users: ${uhidPlan.plannedCollisionCount}`);
  console.log(`Duplicate planned UHIDs: ${uhidPlan.duplicatePlannedCount}`);
  console.log(`Age discrepancies: not applicable; workbook has no DOB or age field.`);
  console.log('Google OAuth compatibility: patient callback looks up User by exact Google email, requires @iitdh.ac.in, attaches googleId/access token and refresh token when supplied, updates picture only when supplied, and leaves an existing User role/profile fields intact. New imported Users must use the exact lowercased workbook email.');
  console.log('Doctor coexistence: Doctor OAuth uses the separate Doctor collection and doctor JWT; patient OAuth uses User. Matching email in Doctor does not block a separate patient User proposal. No Doctor documents are changed.');

  for (const issue of invalidRecords) {
    console.log(`INVALID ${issue.record.sheetName} row ${issue.record.excelRow}; staffId=${JSON.stringify(issue.record.staffId)}; reason=${issue.reasons.join('; ')}`);
  }
  for (const conflict of conflicts) {
    console.log(`CONFLICT ${conflict.record.sheetName} row ${conflict.record.excelRow}; staffId=${JSON.stringify(conflict.record.staffId)}; email=${JSON.stringify(conflict.record.email)}; reason=${conflict.reason}`);
    for (const match of conflict.matches) {
      const id = String(match._id || '');
      console.log(`  existing ${match.model || 'User'} _id=${id ? `${id.slice(0, 8)}...${id.slice(-4)}` : '(unknown)'}; name=${JSON.stringify(match.name || '')}; email=${JSON.stringify(match.email || '')}; role=${JSON.stringify(match.role || '')}; patientCategory=${JSON.stringify(match.patientCategory || '')}`);
    }
    for (const doctor of conflict.matches.filter(match => match.model === 'Doctor')) {
      const associated = conflict.associatedUsers || [];
      console.log(`  associated User records for Doctor email: ${associated.length}`);
      for (const user of associated) {
        const id = String(user._id);
        console.log(`    User _id=${id.slice(0, 8)}...${id.slice(-4)}; name=${JSON.stringify(user.name || '')}; roll=${JSON.stringify(user.roll || '')}; role=${JSON.stringify(user.role || '')}; patientCategory=${JSON.stringify(user.patientCategory || '')}; uhid=${JSON.stringify(user.uhid || '')}; linked=${JSON.stringify(user.linkedData || {})}`);
      }
      console.log(`  proposed action: leave Doctor and any User unchanged; do not create a duplicate User until a supported doctor-as-patient identity policy is established`);
    }
  }

  if (doctorEmailPlans.length) {
    console.log('DOCTOR EMAIL OVERLAPS (informational; separate patient User will be proposed):');
    for (const plan of doctorEmailPlans) {
      for (const doctor of plan.doctorEmailMatches) {
        const id = String(doctor._id);
        console.log(`${plan.record.staffId} | ${plan.record.name} | ${plan.record.email} | Doctor ${id.slice(0, 8)}...${id.slice(-4)} (${doctor.name}); proposed separate User role=patient, patientCategory=${plan.proposedCategory}, UHID=${plan.proposedUhid}; Doctor unchanged`);
      }
    }
  }

  const ts2308 = plans.find(plan => plan.record.staffId.toLowerCase() === 'ts2308');
  if (ts2308) {
    const user = ts2308.userDetails || ts2308.user;
    const id = String(user._id);
    console.log('TS2308 EXISTING USER REVIEW');
    console.log(`Employee ID=${ts2308.record.staffId}; workbook email=${ts2308.record.email}; existing User ID=${id.slice(0, 8)}...${id.slice(-4)}; existing category=${JSON.stringify(user.patientCategory || '')}; proposed category=${ts2308.proposedCategory}; existing UHID=${JSON.stringify(user.uhid || '')}; proposed UHID=(preserve existing)`);
    console.log(`Identity evidence: exact normalized email match=${text(user.email).toLowerCase() === ts2308.record.email}; exact employee ID/roll match=${text(user.roll).toLowerCase() === ts2308.record.staffId.toLowerCase()}; compatible name tokens=${nameTokensCompatible(user.name, ts2308.record.name)}; role=${JSON.stringify(user.role || '')}`);
    console.log(`Profile fields: ${JSON.stringify({ name: user.name, email: user.email, roll: user.roll, role: user.role, patientCategory: user.patientCategory, uhid: user.uhid, age: user.age, sex: user.sex, phone: user.phone, emergencyContactNo: user.emergencyContactNo, allergiesPresent: Boolean(user.allergies), consentAccepted: user.consentAccepted, isVerified: user.isVerified, profileComplete: user.profileComplete, picturePresent: Boolean(user.picture), googleIdPresent: Boolean(user.googleId), googleAccessTokenPresent: Boolean(user.googleAccessToken), googleRefreshTokenPresent: Boolean(user.googleRefreshToken), dependantCount: (user.dependants || []).length })}`);
    console.log(`Linked records: ${JSON.stringify(ts2308.linkedData || {})}`);
    console.log(`Proposed action: update only patientCategory from "Staff" to "Regular Staff"; preserve all other existing fields and linked records`);
  }

  console.log('Sample mappings (staff ID | name | Excel email | existing User | proposed role | proposed patientCategory | old UHID | new UHID):');
  for (const [sheet, category] of Object.entries(SHEET_CATEGORIES)) {
    const samples = plans.filter(plan => plan.proposedCategory === category).slice(0, 6);
    for (const plan of samples) {
      const existing = plan.user ? `${String(plan.user._id).slice(0, 8)}...${String(plan.user._id).slice(-4)}` : 'none';
      const oldUhid = plan.user?.uhid ? text(plan.user.uhid) : '(none)';
      console.log(`${plan.record.staffId} | ${plan.record.name} | ${plan.record.email} | ${existing} | ${plan.proposedRole} | ${plan.proposedCategory} | ${oldUhid} | ${plan.proposedUhid || '(existing account; preserve)'}`);
    }
  }
  if (doctorEmailPlans.length) {
    console.log('Doctor-email patient-account samples (Employee ID | Name | Email | Patient role | Category | New UHID | Existing Doctor left unchanged):');
    for (const plan of doctorEmailPlans) {
      console.log(`${plan.record.staffId} | ${plan.record.name} | ${plan.record.email} | ${plan.proposedRole} | ${plan.proposedCategory} | ${plan.proposedUhid || '(not planned)'} | ${plan.doctorEmailMatches.map(doctor => text(doctor.name)).join(', ')}`);
    }
  }
}

async function main() {
  if (process.argv.includes('--apply') || process.argv.includes('--write')) {
    throw new Error('This preview-only script does not support database writes.');
  }
  if (!process.env.MONGO_URI) throw new Error('Confirmed production MongoDB URI was not provided in the environment.');

  const { records, sheets } = readWorkbook();
  const duplicateInfo = classifyExcelDuplicates(records);
  const recordsToCheck = duplicateInfo.nonHeaders.filter(record => record.email && EMAIL_PATTERN.test(record.email));
  const emails = [...new Set(recordsToCheck.map(record => record.email))];
  const staffIds = [...new Set(recordsToCheck.map(record => record.staffId.toLowerCase()).filter(Boolean))];

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  if (mongoose.connection.db.databaseName !== 'medapp' || User.collection.collectionName !== 'users') {
    throw new Error('Connected database/model did not resolve to medapp.users.');
  }

  const userConditions = [];
  if (emails.length) userConditions.push({ email: { $in: emails } });
  if (staffIds.length) userConditions.push({ roll: { $in: staffIds } });
  const users = userConditions.length
    ? await User.find({ $or: userConditions }).collation({ locale: 'en', strength: 2 }).select('_id name email roll role patientCategory phone uhid profileComplete age sex emergencyContactNo allergies consentAccepted isVerified googleId googleAccessToken googleRefreshToken picture dependants').lean()
    : [];
  const privilegedMatches = await queryPrivilegedRoleCollections(emails);
  const result = assessMatches(records, users, privilegedMatches);
  await enrichReadOnlyDetails(result, privilegedMatches);
  const allUsersWithUhid = await User.find({ uhid: { $exists: true, $ne: null, $ne: '' } }).select('_id uhid').lean();
  const uhidPlan = allocateNewUhids(result.plans, allUsersWithUhid);
  printReport(sheets, records, result, {}, uhidPlan);
  console.log('SECOND STAFF DRY RUN COMPLETE — NOTHING WAS WRITTEN TO MONGODB.');
}

if (require.main === module) {
  main()
    .catch(error => {
      console.error(`Staff import preview stopped: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    });
} else {
  module.exports = {
    WORKBOOK_PATH,
    SHEET_CATEGORIES,
    readWorkbook,
    classifyExcelDuplicates,
    assessMatches,
    queryPrivilegedRoleCollections,
    allocateNewUhids,
    text
  };
}
