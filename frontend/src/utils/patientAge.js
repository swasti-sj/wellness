export function calculateAge(dateOfBirth, fallbackAge = null) {
  if (!dateOfBirth) return fallbackAge ?? null;

  const [year, month, day] = String(dateOfBirth).slice(0, 10).split('-').map(Number);
  const dob = new Date(year, month - 1, day);
  if (
    Number.isNaN(dob.getTime())
    || dob.getFullYear() !== year
    || dob.getMonth() !== month - 1
    || dob.getDate() !== day
  ) {
    return fallbackAge ?? null;
  }

  const today = new Date();
  let age = today.getFullYear() - year;
  if (
    today.getMonth() < month - 1
    || (today.getMonth() === month - 1 && today.getDate() < day)
  ) {
    age -= 1;
  }
  return age >= 0 ? age : (fallbackAge ?? null);
}

export function dateInputValue(dateOfBirth) {
  if (!dateOfBirth) return '';
  const value = String(dateOfBirth);
  return value.length >= 10 ? value.slice(0, 10) : '';
}

export function todayDateInputValue() {
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  return today.toISOString().slice(0, 10);
}
