# Wellness Project — Semester Work Summary

**Review period:** 1 August–17 November 2026

This summary is based on the available Git history and the current application code and project documentation. The dated history begins on 5 August. Features described as VM-only are identified separately because their scripts and live configuration are not in the repository.


## 1. New Features

**Doctor and nurse dashboard statistics**

- What was done: Added dashboard data for unique patients, weekly and monthly appointments, patient age and sex breakdowns, and appointment status counts. Doctor statistics are limited to that doctor's appointments; nurse statistics cover the clinic.
- What changed or improved: Staff can review appointment and patient trends in the dashboard.
- Status: Completed. Evidence: [backend/routes/dashboardRoutes.js](backend/routes/dashboardRoutes.js), [frontend/src/pages/doctor/DoctorDashboard.js](frontend/src/pages/doctor/DoctorDashboard.js).

**SDM appointments**

- What was done: Added SDM as an appointment option and support for recording and displaying an SDM doctor's name.
- What changed or improved: Receptionists can record SDM appointments alongside appointments with listed doctors.
- Status: Completed. Evidence: October SDM commits and [backend/routes/receptionists.js](backend/routes/receptionists.js).

## 2. Patient Dashboard Improvements

**Emergency contacts**

- What was done: Added an emergency-contact panel to the patient dashboard, with phone links and a collapse/reopen control.
- What changed or improved: Important contact numbers are easier to access from the patient portal.
- Status: Completed. Evidence: [frontend/src/pages/patient/EmergencyContacts.js](frontend/src/pages/patient/EmergencyContacts.js).

## 3. Receptionist, Nurse and Doctor Improvements

**Receptionist appointment entry and patient lookup**

- What was done: Added receptionist walk-in entries and remarks; improved patient lookup using email or roll/staff ID and added dependant selection. The dashboard also supports editing appointment-entry details.
- What changed or improved: Front-desk staff can find the correct patient or dependant and record walk-ins and appointment notes more clearly.
- Status: Completed. Evidence: [backend/routes/users.js](backend/routes/users.js), [backend/routes/receptionists.js](backend/routes/receptionists.js), [frontend/src/pages/receptionist/ReceptionistDashboard.js](frontend/src/pages/receptionist/ReceptionistDashboard.js).

**Receptionist department selection and case-sheet routing**

- What was done: Added a department to receptionist entries and appointment views, with department selection in the receptionist dashboard and department handling for case sheets.
- What changed or improved: Reception and clinical staff can associate entries and case sheets with the appropriate department.
- Status: Completed. Evidence: November 16 changes in [backend/models/ReceptionistEntry.js](backend/models/ReceptionistEntry.js) and [frontend/src/pages/receptionist/ReceptionistDashboard.js](frontend/src/pages/receptionist/ReceptionistDashboard.js).

**Receptionist appointment deletion and access control**

- What was done: Added receptionist appointment deletion and protected receptionist routes with authentication and authorization checks.
- What changed or improved: Receptionists can remove an entry through the interface, while the related API routes require the proper access.
- Status: Completed. Evidence: [backend/routes/receptionists.js](backend/routes/receptionists.js).

**Multiple case sheets, referral uploads and appointment colours**

- What was done: Added support for uploading multiple case-sheet files and a separate referral-form file. Appointment types/statuses also received distinct calendar colours.
- What changed or improved: Clinical documents can be attached separately and appointment types are easier to distinguish visually.
- Status: Completed. Evidence: [backend/routes/tests.js](backend/routes/tests.js), [backend/models/Vital.js](backend/models/Vital.js), [frontend/src/pages/doctor/DoctorVitals.js](frontend/src/pages/doctor/DoctorVitals.js), and [frontend/src/pages/patient/AppointmentBooking.js](frontend/src/pages/patient/AppointmentBooking.js).

**Doctor and nurse workflow refinements**

- What was done: Updated appointment, patient-history, vitals, prescription, referral and document views, including the handling and display of patient clinical information.
- What changed or improved: Clinical staff have clearer access to appointment and patient records and related documents.
- Status: Completed. Evidence includes [frontend/src/pages/doctor/DoctorAppointment.js](frontend/src/pages/doctor/DoctorAppointment.js), [frontend/src/pages/nurse/NurseAppointment.js](frontend/src/pages/nurse/NurseAppointment.js), and [frontend/src/pages/doctor/PatientHistory.js](frontend/src/pages/doctor/PatientHistory.js).

## 4. Appointment Management

**Calendar checks and appointment refresh**

- What was done: Improved appointment calendar checks and added background refresh for appointments and manual receptionist entries.
- What changed or improved: Appointment views can stay current without requiring a full page reload, and booking workflows check calendar availability.
- Status: Completed. Evidence: October 2 and October 4 changes in [backend/routes/appointments.js](backend/routes/appointments.js) and [frontend/src/pages/receptionist/ReceptionistDashboard.js](frontend/src/pages/receptionist/ReceptionistDashboard.js).

**Past appointment access**

- What was done: Patients can see recent past visits and visit history, including applicable walk-in and attended records.
- What changed or improved: Past visits are available for review; the current patient booking flow uses available appointment slots.
- Status: Completed for viewing past visits. Booking new appointments for past dates was not verified in the current code.

## 5. Security and Authentication

**One-time patient consent**

- What was done: Added patient consent fields and a consent prompt during profile completion. The server finalizes the choice when first submitted and does not accept a later change through the same profile update.
- What changed or improved: The patient's consent choice is recorded once rather than being silently overwritten on later profile edits.
- Status: Completed. Evidence: [backend/models/User.js](backend/models/User.js), [backend/routes/users.js](backend/routes/users.js), and [frontend/src/pages/patient/InitialProfileForm.js](frontend/src/pages/patient/InitialProfileForm.js).

**Protection against access to another patient's records**

- What was done: Added ownership and role checks to patient record endpoints for tests, prescriptions and vitals.
- What changed or improved: A logged-in user cannot retrieve another patient's records simply by changing an appointment or record ID.
- Status: Completed. Evidence: September 27 changes in [backend/routes/tests.js](backend/routes/tests.js), [backend/routes/prescriptions.js](backend/routes/prescriptions.js), and [backend/routes/vitals.js](backend/routes/vitals.js).

**API security hardening**

- What was done: Restricted allowed origins, added security headers and request limits, required key secrets at startup, and moved login tokens toward the Authorization header. Login sessions are also recorded for audit.
- What changed or improved: Tightens default API protections and reduces exposure of tokens in URLs and error responses.
- Status: Partially completed. The current [backend/utils/requestToken.js](backend/utils/requestToken.js) still accepts legacy URL/body tokens as a warned fallback; remove that fallback after old clients are retired.

**Encryption of sensitive clinical fields**

- What was done: Added field-level encryption for clinical notes, selected test/referral and certificate text, prescription details, and free-text clinical fields in vitals/case sheets.
- What changed or improved: These selected values are encrypted before storage and decrypted for normal application reads; older plain-text values remain readable.
- Status: Completed in the current code. Evidence: [backend/utils/fieldEncryption.js](backend/utils/fieldEncryption.js) and the related clinical models in [backend/models](backend/models).

**Google login and first-time patient registration**

- What was done: The current Google OAuth flow creates a patient account for a first-time eligible user and routes them to initial profile completion.
- What changed or improved: New patients can sign in and complete their profile before using the patient dashboard.
- Status: Completed in the current code. Google OAuth itself predates this review period; it is not counted here as a feature first introduced between August and November. Evidence: [backend/server.js](backend/server.js) and [frontend/src/App.js](frontend/src/App.js).

## 6. Database and Patient Management

**Patient profile and dependant management**

- What was done: Added patient profile editing, clinical-history fields, dependant editing and dependant removal. Profile forms also capture emergency contacts and validate dates of birth and phone numbers.
- What changed or improved: Patients can maintain their own and their dependants' information, and clinical staff can view the available clinical history.
- Status: Completed. Evidence: [backend/routes/users.js](backend/routes/users.js) and [frontend/src/pages/patient/ProfilePage.js](frontend/src/pages/patient/ProfilePage.js).

**Patient categories and identifiers**

- What was done: Added patient categories for students, faculty, regular staff, contractual staff and outsourced staff. Receptionist lookup supports email and roll/staff identifiers.
- What changed or improved: Staff patients can be categorized and located using their institutional identifier as well as email.
- Status: Completed in the current code. Evidence: [backend/models/User.js](backend/models/User.js), [backend/routes/users.js](backend/routes/users.js), and [frontend/src/pages/patient/InitialProfileForm.js](frontend/src/pages/patient/InitialProfileForm.js).

**UHID generation and student UHID review**

- What was done: Added four-digit UHID generation and scripts to preview student UHID regeneration against the student roster, reconcile existing accounts and flag conflicts.
- What changed or improved: UHIDs and roster updates can be reviewed before a bulk change; the student regeneration script requires explicit production confirmation to apply changes.
- Status: Partially completed. Generation and preview/apply code exist, but the repository does not establish that a bulk regeneration was run or independently confirm global uniqueness across all profile-creation paths. Evidence: [backend/routes/users.js](backend/routes/users.js), [backend/models/Counter.js](backend/models/Counter.js), and [backend/scripts/previewStudentUhidRegeneration.js](backend/scripts/previewStudentUhidRegeneration.js).

**Database migration and backups**

- What was done: Project documentation records migration from MongoDB Atlas to self-hosted Percona MongoDB on the VM, with database authentication, disk encryption, and scheduled encrypted database backups to CCS storage.
- What changed or improved: The documented setup keeps the live database on the VM's local disk and stores encrypted backup files separately.
- Status: Needs verification on the VM. The repository documents the configuration and backup procedure, but does not contain the live database configuration or backup script. Evidence: [DATABASE.md](DATABASE.md) and [INFRASTRUCTURE.md](INFRASTRUCTURE.md).

## 7. Scripts and Automation

**Spreadsheet imports**

- What was done: Added scripts to import doctor schedules and process student/staff patient rosters. The scripts validate records and identifiers; staff/student apply paths include review or explicit confirmation safeguards.
- What changed or improved: Roster data can be loaded in a repeatable, checked way instead of being entered entirely by hand.
- Status: Scripts completed; whether each import was run against production was not verified. Evidence: [backend/scripts/importDoctors.js](backend/scripts/importDoctors.js), [backend/scripts/importStudents.js](backend/scripts/importStudents.js), and [backend/scripts/importStaffPatients.js](backend/scripts/importStaffPatients.js).

**Node and deployment consistency**

- What was done: Pinned Node 20 and documented using the matching npm version and lockfiles for deployment.
- What changed or improved: Reduces lockfile and deployment failures caused by differences between developer and VM tool versions.
- Status: Completed. Evidence: [.nvmrc](.nvmrc) and [INFRASTRUCTURE.md](INFRASTRUCTURE.md).

## 8. VM and Storage Monitoring

**Compressed uploads and disk-based file storage**

- What was done: Added image compression and moved uploads from the Cloudinary destination to disk storage, documented as backed by the CCS network share. Images are compressed and saved as WebP; non-image files such as PDFs are saved without image compression.
- What changed or improved: Reduces image size and keeps uploaded files outside the database; the repository retains Cloudinary helper code, but the current upload path uses disk storage.
- Status: Completed in the application code. The live VM mount and symlink need operational verification. Evidence: [backend/utils/diskStorage.js](backend/utils/diskStorage.js), [backend/utils/cloudinary.js](backend/utils/cloudinary.js), and [INFRASTRUCTURE.md](INFRASTRUCTURE.md).

**VM disk-full recovery and maintenance**

- What was done: The incident report describes freeing disk space after the 20 GB VM filled, then adding log limits, weekly cleanup, a disk-usage warning above 85%, and backend restart on reboot.
- What changed or improved: Documented safeguards address the disk and log growth that had caused service outages.
- Status: Needs verification on the VM. The cleanup script, cron job and active log-rotation configuration are not tracked in the repository.

**Storage monitoring and reporting**

- What was done: Added documentation for VM and network-share measurements collected every four hours into a CSV, plus local Windows/WSL processing to create four graphs and a storage-growth report with 7- and 30-day estimates.
- What changed or improved: Provides a documented way to track storage history and review usage trends. CSV retrieval and report generation are manual; documented report thresholds are informational.
- Status: Partially completed / needs VM verification. The collector and report scripts are described in [Storage_monitoring.md](Storage_monitoring.md) but are not present in the repository.

**Email alerts above 85% disk usage**

- What was done: The incident report mentions a weekly warning when VM disk use exceeds 85%.
- What changed or improved: The repository does not show that this warning is sent by email. The storage-monitoring documentation explicitly describes informational notices and no automatic alerts.
- Status: Pending / needs verification. No email-alert implementation or tracked VM script was found.

**VM database backup**

- What was done: The database and infrastructure guides describe a weekly encrypted database backup, retention of the latest four backups, and storage on CCS.
- What changed or improved: Provides a documented recovery copy separate from the live database.
- Status: Needs verification on the VM. The backup script and its schedule are described in documentation but are not tracked in Git.

## 9. Bug Fixes and Other Improvements

**Vital-data responses and receptionist workflow**

- What was done: Updated vital-data handling and API response structure, corrected receptionist lookup/entry behavior, and addressed appointment and interface issues.
- What changed or improved: Improved consistency in clinical data responses and reduced friction in receptionist workflows.
- Status: Completed. Evidence: August 5–20 changes in [backend/routes/vitals.js](backend/routes/vitals.js) and [frontend/src/pages/receptionist/ReceptionistDashboard.js](frontend/src/pages/receptionist/ReceptionistDashboard.js).

**Field-encryption follow-up fixes**

- What was done: Fixed encryption-key file path resolution and ensured sensitive values are decrypted after saving as well as when read from the database.
- What changed or improved: Prevents startup path differences from hiding the key and prevents encrypted text from appearing in immediate save responses.
- Status: Completed. Evidence: October 23 changes in [backend/server.js](backend/server.js) and the clinical model hooks.

**Unused code and environment-file cleanup**

- What was done: Removed an unused Trialread model/routes/styles and cleaned up unused environment variables and data/schedule files.
- What changed or improved: Removed obsolete project files and configuration.
- Status: Completed.

