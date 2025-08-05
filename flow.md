# Student Side — Design Notes & Problems

---

## Student Use Case & Flow

---

### Authentication
- Login allowed **only via institute email or LDAP**  
  - Only university-provided Gmail or LDAP accounts are accepted  
  - No access via personal emails or external accounts

---

### First-Time Visit
- Prompted to fill a **basic demographic information form**:
  - Full Name
  - Sex
  - Age
  - Occupation (e.g., student)
  - Year & Batch
  - Department
  - Place of Residence (e.g., hostel name / area)
  - Mode of Referral: Self / Dean / Faculty / Peer / Others

> Data stored securely — initiates contract between **Student Welfare Cell** and the student (not directly with a doctor)

---

### Dashboard
- Shows **Summary of Last Visit**:
  - Date & Time
  - Brief reason (e.g., “cold”, “stress”)
- Notification section for:
  - **Referrals**, if applicable:
    - To Psychologist / Counsellor / Specialist
    - Status updates if follow-up required

---

### Visit History
- Timeline view of **all past visits** in **chronological order**
- Expandable entries show:
  - Brief issue reported
  - Referral details (if any)
- **Read-only access** for students

---

### Referrals
- Displayed prominently if the student was referred
- Shows:
  - Referral Date
  - Reason for Referral
  - Department/Person Referred To

---

### Medication Awareness

> **Medication details will NOT be shown to students**  
>  This is to prevent misuse or unregulated purchase from medical stores.

- Medication data is **only accessible to authorized medical staff**
- **Future scope**: Doctors can generate anonymized **reports/statistics** for **Dean or Authorities**

---

### Smart Search
- Students can **search their own visit history**
- Features:
  - Autocomplete support for:
    - Dates
    - Keywords (e.g., “stress”, “injury”)
  - Optional: Name fuzzy match / edit distance matching for shared terminal use (if allowed)

---

### Data Safety & Confidentiality
- Students can view **only their own** health records
- No access to peer records or sensitive information
- **Dean/Authority** dashboard will display only **anonymized statistics** (no personal identifiers)

---

## Important Notes / Constraints

- **Medication information must be restricted** — only visible to doctors and authorized personnel
- **Contractual understanding** is between **Student Welfare Cell** and student (for ethical compliance)
- Authentication must strictly enforce LDAP/university Gmail use
- Future consideration: Integration with anonymized report generation for research or authority briefings
