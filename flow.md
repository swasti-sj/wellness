# Student Side — Design Notes & Problems

##  Student Use Case & Flow

---

###  Authentication
- Login using **institute email** or **LDAP**
- 
---

###  First-Time Visit
- Fill out a basic personal information form:
  - Name
  - Sex
  - Age
  - Place of origin
  - Year of study
  - Department
  - Mode of referral (self, dean, peer, etc.)

---

###  Dashboard
- View **summary of last visit**:
  - Date and time
  - Brief reason (e.g., "cold", "stress")
- Notifications if referred to:
  - Psychologist / Counsellor / Specialist

---

###  Visit History
- View timeline of **past visits**
- Ability to **expand** entries to view:
  - Last medication
  - Referral details
- All fields are **read-only** for students

---

###  Referrals
- Clearly displayed if the student was referred
- Show:
  - Date of referral
  - Reason for referral
  - Department/person referred to

---

###  Medication Awareness
- See list of **prescribed medications**
- View medication from **last visit**
- No option to edit — **only viewable**

---

###  Smart Search
- Search **own visit history**
- Autocomplete for:
  - Dates
  - Keywords (e.g., “stress”, “injury”)
- Minimum edit distance for name-matching (if extended to allow shared terminals)

---

###  Data Safety & Confidentiality
- Students can view **only their own records**
- No peer access
- Dean/Authorities see only **anonymized statistics**, not personal details

