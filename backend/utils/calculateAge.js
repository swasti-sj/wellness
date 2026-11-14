function calculateAge(dateOfBirth) {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;

  const today = new Date();
  const birthYear = dob.getUTCFullYear();
  const birthMonth = dob.getUTCMonth();
  const birthDay = dob.getUTCDate();
  let age = today.getFullYear() - birthYear;
  if (
    today.getMonth() < birthMonth
    || (today.getMonth() === birthMonth && today.getDate() < birthDay)
  ) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

module.exports = calculateAge;
