# Wellness Database — Security & Access Guide

What the database is, where it lives, how to access it, and what security work has been done — written so any team member (or reviewer) can pick this up without needing prior context.

*Last updated: 27 September 2026*

---

## 1. Overview

As of September 2026, the Wellness app's database was migrated **off MongoDB Atlas (cloud, free tier)** onto the VM itself, running **Percona Server for MongoDB** — a free, fully MongoDB-compatible distribution that also adds encryption at rest, which the plain (Community Edition) version of MongoDB does not include.

This migration was done specifically in response to a faculty review comment on **patient data confidentiality**. This document doubles as evidence of that work.

---

## 2. Where everything actually lives

| What | Where |
|---|---|
| Application server | VM `10.195.250.184` (`wellness.iitdh.ac.in`) |
| Database engine | Percona Server for MongoDB 7.0, running as the `mongod` systemd service |
| Database files | `/var/lib/mongodb` (the VM's own local disk — **never** the CCS network drive, see section 4) |
| Database config | `/etc/mongod.conf` |
| Encryption key (database) | `/etc/mongodb-encryption-keyfile` — root-only (`chmod 600`) |
| Database port | `27017`, bound to `127.0.0.1` only — **not reachable from outside the VM** |
| Uploaded files (images/documents) | CCS institute network storage, mounted at `/mnt/ccs-wellness`, symlinked to `backend/uploads` |
| Database backups | `/mnt/ccs-wellness/mongo-backups/` (same CCS drive — safe for backups, since they're static files, not a live database) |
| Backup script | `/usr/local/bin/mongo-backup.sh` |
| Backup encryption key | `/etc/mongodb-backup-encryption-key` — root-only |

---

## 3. How to access the database

**1. SSH into the VM:**
```bash
ssh wc@10.195.250.184
```

**2. Connect to the database** (credentials required — see note below):
```bash
mongosh -u <username> -p --authenticationDatabase admin
```

**Where to get the username/password:** these are **not written in this file on purpose** — the whole point of this security work is that database credentials aren't something anyone can just read off a doc. Ask whoever last set up the database (currently: Swasti) for access, the same way you'd ask for any other production credential.

**Database name once connected:** `medapp` — e.g. `use medapp` inside `mongosh`, then `show collections`.

---

## 4. Security measures implemented

Mapped directly against the three requirements raised in faculty review:

| Requirement | Status | How it's done |
|---|---|---|
| **Data encrypted on disk** | ✅ Done | Percona's built-in encryption (AES-256), keyfile-based. Verified by writing test data and confirming it does **not** appear in the raw database files on disk — proven, not just configured. |
| **One patient can't see another's data** | ✅ Done | Every route that returns patient records (`tests`, `prescriptions`, `vitals`) now checks that the logged-in user actually owns the record being requested, before returning it. Previously, a valid login alone was enough to fetch *any* patient's record by changing an ID in the request — this was confirmed as a real, working exploit before being fixed. |
| **Developers can't see sensitive data even with DB access** | 🚧 In progress | Not yet implemented. Plan: field-level encryption (MongoDB's Client-Side Field Level Encryption) on specific sensitive fields, with the encryption key held separately from general developer access. Needs a decision on exactly which fields to cover before implementation starts. |

**Additional protections in place, not part of the original three requirements:**
- **Authentication required** — the database rejects any request without valid credentials (confirmed: an unauthenticated command fails with an explicit authentication error).
- **Network-isolated** — the database only accepts connections from the VM itself (`127.0.0.1`), never from the public internet.
- **Encryption in transit** — HTTPS on the live site (nginx), unaffected by this migration.
- **Encrypted, automated backups** — see section 5.

---

## 5. Backups

Since leaving Atlas also means losing its automatic managed backups, a replacement was built:

- **What happens:** every Sunday at 4 AM, `mongo-backup.sh` runs automatically (via cron). It dumps the full database, compresses it, **encrypts the compressed file**, and saves it to the CCS network drive.
- **Where:** `/mnt/ccs-wellness/mongo-backups/` — files look like `2026-09-27_12-36-18.tar.gz.enc`.
- **Retention:** only the last 4 backups are kept; older ones are deleted automatically.
- **Encrypted:** yes — even someone with access to the CCS drive can't read a backup file without the separate backup encryption key (`/etc/mongodb-backup-encryption-key`, root-only on the VM).
- **Manual backup, anytime:**
  ```bash
  sudo /usr/local/bin/mongo-backup.sh
  ```
- **Restoring from a backup:**
  ```bash
  openssl enc -d -aes-256-cbc -pbkdf2 -in <backup>.tar.gz.enc -out backup.tar.gz -pass file:/etc/mongodb-backup-encryption-key
  tar -xzf backup.tar.gz
  mongorestore --uri="mongodb://<username>:<password>@localhost:27017/?authSource=admin" <extracted-folder>
  ```
- **Backup run history:** `cat /var/log/mongo-backup.log`

---

## 6. Why some things were built the way they were (worth knowing before changing them)

- **Why Percona Server for MongoDB, not plain MongoDB?** Plain (Community Edition) MongoDB has no encryption-at-rest option — that's normally an Enterprise-only paid feature. Percona's distribution is fully compatible (same commands, same data format, same drivers) but includes it for free.
- **Why isn't the database's data directory on the CCS network drive, if uploads/backups are?** It was actually tried — and **failed with a real crash**. MongoDB's storage engine cannot safely open its data files over a network filesystem (CIFS/SMB); this is a documented MongoDB limitation, not a configuration mistake. Static files (uploads, backup archives) are fine on network storage; a live database's active data files are not. **Do not attempt to move `dbPath` to `/mnt/ccs-wellness` again** — it will not work.
- **Why is the database only reachable from `localhost`?** So it's never exposed to the internet or campus network directly — only the backend app (running on the same VM) can reach it.

---

## 7. What's still left to do

- **Field-level encryption** for specific sensitive fields (the "developers can't see data" requirement) — needs a decision on which fields, then implementation.
- Written data retention/deletion policy — discussed, deprioritized by the team for now.

---

## 8. Quick reference — health checks

```bash
sudo systemctl status mongod                  # database should be 'active (running)'
mongosh --eval 'db.testcol.insertOne({x:1})'  # should FAIL — confirms auth is enforced
ls -la /mnt/ccs-wellness/mongo-backups/        # confirms backups are landing correctly
cat /var/log/mongo-backup.log                  # backup run history
```

See [`INFRASTRUCTURE.md`](INFRASTRUCTURE.md) for the full picture of how the whole app (not just the database) is deployed and run.
