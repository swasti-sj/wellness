# Incident Report — Site Going Down Every Few Days (Disk Full)

**App:** Wellness (wellness.iitdh.ac.in)
**Server:** Ubuntu VM `10.195.250.184`, 20 GB disk
**Status:** Resolved

---

## Summary

The site kept showing **"502 Bad Gateway" / "Internal Server Error"** every few days. Each time, redeploying brought it back — but it always returned after a few days.

The root cause was that the **server's disk was filling up to 100%**. A full disk crashes the process that runs our backend, which takes the whole site down. Redeploying only freed a little space temporarily, which is why the problem kept coming back.

We cleaned up the disk, removed the things that were filling it, and set up **automatic maintenance** so it can't happen again.

---

## Symptoms observed

- Website showed **502 Bad Gateway** / **Internal Server Error**.
- The backend process (managed by PM2) was **missing / not running**.
- PM2 commands **hung** and wouldn't respond.
- `npm` failed with **`ENOSPC: no space left on device`**.
- Disk usage: **`/dev/sda3  20G  19G  0  100%`** — completely full, zero space free.

---

## Root cause

**The 20 GB disk had filled to 100%.** When a Linux disk is completely full, no program can write to it. This caused a chain reaction:

```
Disk 100% full
   → PM2 (process manager) can't write its files → crashes
      → Backend process dies (nothing keeps it alive)
         → nginx has no backend to forward API requests to
            → Site returns 502 Bad Gateway
```

**Why redeploying "fixed" it temporarily:** restarting freed a tiny bit of space, enough to run for a few more days — then the disk filled again and it broke. It treated the symptom, not the cause.

### What was filling the disk

| Culprit | Size | What it was | Why it grew |
|---|---|---|---|
| **VS Code remote-server files** | **3.0 GB** | Files copied onto the server every time we connected via VS Code Remote-SSH | Left behind and never cleaned up |
| **Snap package cache** | **3.7 GB** | Cached copies of system software packages | No cleanup by default |
| **System (journal) logs** | ~700 MB | Ubuntu's own activity logs | No size limit set |
| **App logs (PM2)** | growing | Our backend logs every request | No rotation / size limit |
| **Old snap versions** | ~GBs | Old copies of Firefox, GNOME, etc. | Kept indefinitely |

None of this was caused by a mistake in the app — these are **default Ubuntu behaviours** where logs and caches grow forever unless limits are configured, which they weren't.

---

## What we did

### 1. Freed the disk (immediate fix)
- Removed the 3 GB leftover VS Code remote-server folder.
- Cleared the 3.7 GB snap cache.
- Vacuumed old system logs (~700 MB) and removed old snap versions.
- **Result: disk went from 100% full → 74% used, ~5 GB free.**

### 2. Restarted the backend
- Brought the backend process back online under PM2. Site recovered.

### 3. Put automatic safeguards in place (so it can't recur)

| Safeguard | Effect |
|---|---|
| **PM2 log rotation** | App logs are capped (10 MB each, keep 5) — can't grow forever |
| **System log size cap** (200 MB) | Ubuntu logs are limited |
| **Weekly auto-cleanup job** (runs Sundays 3 AM) | Clears caches, old logs, and old software versions automatically; warns if disk goes above 85% |
| **Auto-restart on reboot** | If the server restarts, the backend comes back automatically instead of staying down |

---

## Result

- Site is **back up and stable**.
- The disk is now **self-maintaining** — every source that was growing without limit now has a cap or automatic cleanup.
- **This specific problem should not recur.**

## Note for the future

- **Avoid connecting to the server through VS Code Remote-SSH** — it silently copies ~3 GB of files onto the server each time. Use plain SSH (`ssh wc@10.195.250.184`) instead.
- **Quick health check anytime:** run `df -h /` — as long as it stays well under 90%, the server is healthy.

---

*Prepared for review — issue diagnosed and resolved.*
