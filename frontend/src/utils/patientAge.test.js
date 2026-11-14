import { calculateAge } from './patientAge';

const formatDate = (date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-');

describe('calculateAge', () => {
  test('calculates completed years from date of birth', () => {
    const today = new Date();
    const birthday = new Date(today.getFullYear() - 20, today.getMonth(), today.getDate());
    const dayBeforeBirthday = new Date(today.getFullYear() - 20, today.getMonth(), today.getDate() + 1);

    expect(calculateAge(formatDate(birthday))).toBe(20);
    expect(calculateAge(formatDate(dayBeforeBirthday))).toBe(19);
  });

  test('keeps the existing age when a date of birth is unavailable or invalid', () => {
    expect(calculateAge('', 42)).toBe(42);
    expect(calculateAge('not-a-date', 42)).toBe(42);
  });
});
