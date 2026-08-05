# Receptionist Walk-in & Remarks Feature — Task Steps

## Goal
Modify receptionist entry logic so:
- **Walk-in** (no account) → entry only (record purpose), no appointment.
- **Not walk-in** → entry + appointment (same as normal, visible on patient/doctor/nurse sides).
- Add **Entry Type** dropdown: `Appointment` / `Walk-in`.
- Add **Remarks** dropdown: `None` / `Outsourced Staff` / `Dependant`.

## Steps
- [x] 1. Add `isWalkIn` and `remarks` fields to `backend/models/ReceptionistEntry.js`
- [x] 2. Update `backend/routes/receptionists.js` POST /entries logic (walk-in = entry only, no User/Appointment)
- [x] 3. Update `backend/routes/receptionists.js` PATCH /entries/:entryId to accept remarks/isWalkIn
- [x] 4. Update `frontend/src/pages/receptionist/ReceptionistDashboard.js` form (Entry Type + Remarks dropdowns)
- [x] 5. Update frontend mapping, edit, save, and table display for remarks/isWalkIn
- [x] 6. Update `frontend/src/styles/receptionist/ReceptionistDashboard.css` grid for extra dropdowns
- [x] 7. FIX: Ensure non walk-in creates a proper User (valid required email) + real Appointment so it's visible on patient/doctor/nurse sides
