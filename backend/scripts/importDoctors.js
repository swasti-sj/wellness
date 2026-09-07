require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const Doctor = require('../models/Doctor');

const daysOfWeek = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

const aliases = {
  name: ['name', 'full name', 'doctor name', 'doctor'],
  email: ['email', 'email address', 'email id', 'mail'],
  specialization: ['specialization', 'specialisation', 'specialty', 'department'],
  phone: ['phone', 'phone number', 'mobile', 'mobile number', 'contact'],
  slotTimings: ['slot timings', 'slot timing', 'timings', 'timing']
};

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_.-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function findColumn(row, field) {
  const rowKeys = Object.keys(row);
  const fieldAliases = aliases[field];
  const key = rowKeys.find(rowKey => fieldAliases.includes(normalizeHeader(rowKey)));
  return key ? text(row[key]) : '';
}

function parseTimes(value) {
  if (Array.isArray(value)) {
    return value
      .map(item => (typeof item === 'object' ? text(item.time) : text(item)))
      .filter(Boolean)
      .map(time => ({ time, status: 'available' }));
  }

  return text(value)
    .split(/[;,|\n]+/)
    .map(time => time.trim())
    .filter(Boolean)
    .map(time => ({ time, status: 'available' }));
}

function parseWeeklySlots(row) {
  const weeklySlotsKey = Object.keys(row).find(key =>
    ['weekly slots', 'weekly availability', 'availability'].includes(normalizeHeader(key))
  );

  if (weeklySlotsKey && text(row[weeklySlotsKey])) {
    try {
      const parsed = JSON.parse(row[weeklySlotsKey]);
      if (Array.isArray(parsed)) {
        return parsed.map(slot => ({
          day: text(slot.day),
          times: parseTimes(slot.times)
        })).filter(slot => slot.day);
      }
    } catch (error) {
      throw new Error('weeklySlots/availability must contain valid JSON');
    }
  }

  const slotTimings = findColumn(row, 'slotTimings');
  if (slotTimings) {
    const slots = daysOfWeek.map(day => ({ day, times: [] }));
    const defaultTime = (slotTimings.match(/^([^,(]+)/) || [])[1]?.trim() || slotTimings;
    const dayMatches = [...slotTimings.matchAll(/([^,(]+?)\s*\(([^)]+)\)/g)];

    if (dayMatches.length === 0) {
      const range = defaultTime.replace(/\s+to\s+/i, ' to ');
      const dayText = slotTimings.match(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i);
      const matchingDays = dayText
        ? daysOfWeek.filter(day => new RegExp(`\\b${day}\\b`, 'i').test(slotTimings))
        : [];
      matchingDays.forEach(day => {
        slots.find(slot => slot.day === day).times = [{ time: range, status: 'available' }];
      });
    } else {
      dayMatches.forEach(([, time, dayText]) => {
        daysOfWeek
          .filter(day => new RegExp(`\\b${day}\\b`, 'i').test(dayText))
          .forEach(day => {
            slots.find(slot => slot.day === day).times = [{ time: time.trim(), status: 'available' }];
          });
      });
    }

    const mentionedDays = slots.some(slot => slot.times.length > 0);
    if (mentionedDays) return slots;
  }

  return daysOfWeek.map(day => {
    const dayKey = Object.keys(row).find(key => normalizeHeader(key) === day.toLowerCase());
    return {
      day,
      times: dayKey ? parseTimes(row[dayKey]) : []
    };
  });
}

function readRows(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(firstSheet, { defval: '', range: 1 });
}

async function ensureGoogleIdIndex() {
  const indexes = await Doctor.collection.indexes();
  const googleIdIndex = indexes.find(index => index.key && index.key.googleId === 1);

  if (googleIdIndex && (!googleIdIndex.unique || !googleIdIndex.sparse)) {
    await Doctor.collection.dropIndex(googleIdIndex.name);
  }

  if (!googleIdIndex || !googleIdIndex.unique || !googleIdIndex.sparse) {
    await Doctor.collection.createIndex({ googleId: 1 }, { unique: true, sparse: true });
  }
}

async function importDoctors(filePath, dryRun = false) {
  const rows = readRows(filePath);
  if (rows.length === 0) {
    throw new Error('The spreadsheet contains no data rows');
  }

  if (dryRun) {
    console.log(`Dry run: ${rows.length} spreadsheet rows found; no database connection opened.`);
    return;
  }

  if (!process.env.MONGO_URI || /mongodb:\/\/(localhost|127\.0\.0\.1)(?::|\/)/i.test(process.env.MONGO_URI)) {
    throw new Error('Refusing to import: MONGO_URI is missing or points to localhost. Set the deployed MongoDB URI explicitly.');
  }

  await mongoose.connect(process.env.MONGO_URI);
  await ensureGoogleIdIndex();

  let imported = 0;
  let skipped = 0;
  let duplicates = 0;

  for (const [index, row] of rows.entries()) {
    const name = findColumn(row, 'name').replace(/^\s+/, '');
    const email = findColumn(row, 'email').toLowerCase();

    if (!name || !email) {
      skipped += 1;
      console.warn(`Skipping row ${index + 2}: name and email are required`);
      continue;
    }

    if (await Doctor.exists({ email })) {
      duplicates += 1;
      console.warn(`Skipping row ${index + 2}: doctor already exists for ${email}`);
      continue;
    }

    await Doctor.create({
      name,
      email,
      specialization: findColumn(row, 'specialization'),
      phone: findColumn(row, 'phone'),
      weeklySlots: parseWeeklySlots(row)
    });
    imported += 1;
  }

  console.log(`Inserted ${imported} doctor profiles; skipped ${skipped} invalid rows and ${duplicates} existing doctors.`);
}

const input = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
if (!input || input.startsWith('--')) {
  console.error('Usage: npm run import:doctors -- <path-to-excel-file> [--dry-run]');
  process.exitCode = 1;
} else {
  importDoctors(path.resolve(input), dryRun)
    .catch(error => {
      console.error(`Doctor import failed: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
    });
}