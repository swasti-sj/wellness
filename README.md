# Swasti — IIT Dharwad Wellness App

A full-stack medical records and appointment management system for IIT Dharwad's health centre.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React.js |
| Backend | Node.js + Express |
| Database | MongoDB (Mongoose) |
| Auth | Google OAuth 2.0 + JWT |
| File Storage | Cloudinary (images/documents) |
| Calendar | react-big-calendar |

## Roles

| Role | Access |
|------|--------|
| **Patient** | Book appointments, view history, manage profile |
| **Doctor** | Manage appointments, write prescriptions, case sheets, referrals, tests |
| **Nurse** | Same as Doctor (shared components) |
| **Receptionist** | Walk-in entry, appointment creation |
| **Pharmacist** | Medicine stock management, issuances |
| **Admin** | Audit logs, user management |

## Running Locally

```bash
# Backend (always use dev for hot-reload)
cd backend
npm run dev        # ✅ nodemon auto-reloads on file changes
# NOT: npm start   # ❌ plain node — changes ignored until manual restart

# Frontend
cd frontend
npm start
```

Backend runs on **port 5000**, Frontend on **port 3000**.

Network access (mobile testing): `http://<your-local-ip>:3000`

## Key Features

- **UHID Auto-generation**: Sequential 4-digit IDs (0001, 0002 ...) assigned server-side
- **Profile Guard**: Incomplete profiles redirect user back to setup form on next login
- **Prescription**: Manual medicine entry OR image upload (or both)
- **Lab Tests**: Select tests + upload lab document
- **Case Sheet**: Vitals, history, examination, treatment notes
- **Referrals**: Hospital and internal referrals with documents
- **Certificates**: Medical/fitness certificate generation

## Discussion Notes (Initial Design)

1. **Confidentiality**: Head/Dean SW/Academics can see *whether* someone visited — NOT details. Dean's notes visible only to Dean.
2. **Authentication**: Google OAuth (institute email). Future: LDAP/biometric.
3. **First-visit form**: Name, sex, age, place of origin, year, department, mode of referral.
4. **Search**: Last visit date, expandable details, similar-name suggestions.
5. **Reports**: Anonymised statistics for Dean (visit counts etc.).
6. **Extendability**: Psychologist/Counsellor accounts, separate confidentiality.
