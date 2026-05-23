const axios = require("axios");

async function isEmailAllowed(sheetUrl, email) {
  try {

    const response = await axios.get(sheetUrl);

    const rows = response.data
      .split("\n")
      .map(row =>
        row
          .replace(/"/g, "")
          .trim()
          .toLowerCase()
      );

    console.log("📄 Sheet rows:", rows);
    console.log("📧 Checking email:", email.toLowerCase());

    const allowed = rows.some(row =>
      row.includes(email.toLowerCase())
    );

    console.log("✅ Allowed result:", allowed);

    return allowed;

  } catch (error) {

    console.error(
      "Google Sheet Access Error:",
      error.message
    );

    return false;
  }
}

module.exports = { isEmailAllowed };