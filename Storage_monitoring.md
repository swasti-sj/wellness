# Wellness Project — Storage Monitoring and Reporting

## 1. Overview

A storage monitoring and reporting system has been implemented to track disk usage and storage availability across the Wellness project infrastructure.

The system consists of two independent components:

1. **VM Collection Script (`collect.sh`)** — runs on the VM and collects storage statistics every four hours, appending timestamped measurements to a CSV file.
2. **Local Reporting Script (`plot_storage.py`)** — runs on a local Windows/WSL environment, reads a downloaded copy of the CSV file, and generates storage graphs and a detailed text report.

The collection process runs automatically on the VM through a scheduled cron job. Graph generation and report creation are performed locally, so Matplotlib and other graph-generation dependencies are not required on the VM.

### Overall Architecture

```text
                  WELLNESS VM
                       |
                       v
                  collect.sh
                       |
                Every 4 Hours
                       |
                       v
               storage_history.csv
                       |
                       | Manual SSH / SCP Transfer
                       v
                 LOCAL COMPUTER
                    (Windows)
                       |
                       v
                 Download CSV
                       |
                       v
                  WSL / Ubuntu
                       |
                       v
                 plot_storage.py
                       |
             +---------+---------+
             |                   |
             v                   v
         Four Graphs        Text Report
             |                   |
             v                   v
          PNG Files         growth_report.txt
```

The VM collection and local reporting processes operate independently. Downloading the CSV and generating updated reports are manual operations.

---

## 2. File Locations

### 2.1 VM Storage Monitoring Directory

The monitoring files are maintained under:

`/home/wc/wellness-monitoring/`

| File | Purpose |
|---|---|
| `collect.sh` | Collects VM and network storage statistics |
| `storage_history.csv` | Stores historical storage measurements |
| `collector.log` | Stores scheduled execution output and errors |

The monitoring directory belongs to the `wc` user. The `admin` account has a separate home directory, and the `devteam` account does not have direct access to the original monitoring directory under its normal permissions.

### 2.2 Network Storage

The Wellness network share is:

- Network share: `//10.250.200.50/wellness`
- VM mount point: `/mnt/ccs-wellness`

The collection script monitors the VM's root filesystem and the filesystem mounted at `/mnt/ccs-wellness`.

Network measurements represent the entire filesystem reported by the network storage server, not just the Wellness project directory.

### 2.3 Local Reporting Directory

The local reporting project contains:

| File | Purpose |
|---|---|
| `plot_storage.py` | Processes storage history and generates graphs and reports |
| `storage_history.csv` | Downloaded copy of the VM's historical CSV |
| `vm_storage_usage.png` | VM disk usage graph |
| `network_storage_usage.png` | Network storage usage graph |
| `storage_usage_percentage.png` | VM and network storage utilization comparison |
| `storage_available_space.png` | Available storage comparison |
| `growth_report.txt` | Historical storage summary and future usage estimates |

The local directory can be created anywhere on the Windows computer. The examples in this document use a directory named `wellness-graphs`.

---

## 3. VM Collection Script

### 3.1 Script Location

`/home/wc/wellness-monitoring/collect.sh`

The collection script uses Linux system utilities to obtain filesystem statistics and appends the results to `storage_history.csv`.

The existing CSV is retained between executions. New measurements are appended rather than replacing historical records.

### 3.2 Information Collected

The monitoring process tracks the following information.

**VM storage**

- Total filesystem capacity.
- Used storage.
- Available storage.
- Storage utilization percentage.
- Measurement timestamp.

**Network storage**

- Network mount status.
- Total filesystem capacity.
- Used storage.
- Available storage.
- Storage utilization percentage.
- Measurement timestamp.

The measurements are recorded in bytes in the CSV file. The local reporting script converts these values into decimal gigabytes (GB) for presentation.

### 3.3 CSV Structure

The historical CSV contains the following columns:

| Column | Description |
|---|---|
| `timestamp` | Date and time of measurement |
| `vm_total_bytes` | Total VM filesystem capacity |
| `vm_used_bytes` | VM filesystem space used |
| `vm_available_bytes` | Available VM filesystem space |
| `vm_used_pct` | VM filesystem utilization percentage |
| `network_status` | Network mount status |
| `network_total_bytes` | Total network filesystem capacity |
| `network_used_bytes` | Network filesystem space used |
| `network_available_bytes` | Available network filesystem space |
| `network_used_pct` | Network filesystem utilization percentage |

Possible network status values:

- `MOUNTED` — the network share is mounted and its filesystem statistics were obtained.
- `NOT_MOUNTED` — the network share is not mounted.
- `UNREADABLE` — the mount exists, but filesystem statistics could not be obtained.

When network measurements are unavailable, the corresponding network metric fields are left empty.

### 3.4 Inspect the Monitoring Files

Connect to the VM using an account with the required permissions.

Since the monitoring directory belongs to `wc`, the `admin` account should use `sudo` when accessing the original files.

List the monitoring files:

```bash
sudo ls -lh /home/wc/wellness-monitoring/
```

Inspect the collection script:

```bash
sudo cat /home/wc/wellness-monitoring/collect.sh
```

For page-by-page inspection:

```bash
sudo less /home/wc/wellness-monitoring/collect.sh
```

Press `q` to exit.

### 3.5 Check the Automatic Schedule

Cron executes the collection script automatically under the `wc` user account.

To inspect the installed cron configuration:

```bash
sudo crontab -u wc -l
```

If already logged in as `wc`, use:

```bash
crontab -l
```

The verified cron configuration is:

```cron
0 */4 * * * /bin/bash /home/wc/wellness-monitoring/collect.sh >> /home/wc/wellness-monitoring/collector.log 2>&1
```

This schedules collection every four hours, at:

- 00:00
- 04:00
- 08:00
- 12:00
- 16:00
- 20:00

All times follow the VM's local timezone.

The command redirects standard output and errors to `collector.log`. The `>>` operator appends new log entries rather than overwriting the existing log.

**Important:**

- Cron configurations are user-specific.
- Running `crontab -l` as `admin` does not display the `wc` user's crontab.
- The installed schedule should be checked using `sudo crontab -u wc -l`.
- The VM and its cron service must be running for scheduled execution.
- An SSH terminal does not need to remain open for cron execution.

### 3.6 Check Historical Measurements

Display the complete CSV:

```bash
sudo cat /home/wc/wellness-monitoring/storage_history.csv
```

Display the latest ten measurements:

```bash
sudo tail -n 10 /home/wc/wellness-monitoring/storage_history.csv
```

Inspect the CSV header and first records:

```bash
sudo head -n 5 /home/wc/wellness-monitoring/storage_history.csv
```

### 3.7 Run Manual Collection

To execute the collection script immediately:

```bash
sudo -u wc /bin/bash /home/wc/wellness-monitoring/collect.sh
```

This performs an additional measurement without waiting for the next scheduled execution.

The script runs as `wc`, ensuring that the monitoring directory and CSV are accessed using the intended user account.

### 3.8 Check the Collection Log

Display the latest log entries:

```bash
sudo tail -n 30 /home/wc/wellness-monitoring/collector.log
```

Monitor new log entries:

```bash
sudo tail -f /home/wc/wellness-monitoring/collector.log
```

Press `Ctrl+C` to exit.

The log contains execution timestamps, VM statistics, network mount status, and error output from the collection process.

---

## 4. Network Storage Verification

The network storage is mounted at:

`/mnt/ccs-wellness`

Check whether the mount is active:

```bash
mountpoint /mnt/ccs-wellness
```

Display network filesystem usage:

```bash
df -h /mnt/ccs-wellness
```

Check the VM's root filesystem:

```bash
df -h /
```

Display the directory-level storage consumed by the mounted share:

```bash
sudo du -sh /mnt/ccs-wellness
```

### Understanding `df` and `du`

These commands measure different things:

- `df` reports the usage and capacity of the entire filesystem.
- `du` reports the space occupied by files within a particular directory.

Consequently, their results can differ significantly.

The network share's `df` output represents the filesystem reported by the network storage server, not exclusively the data belonging to the Wellness application.

The monitoring script uses `df` to collect filesystem-level statistics.

---

## 5. Retrieve Storage History Using Admin SSH Access

### 5.1 Access Restrictions

The original monitoring files are stored under:

`/home/wc/wellness-monitoring/`

This directory belongs to the `wc` user and is protected by Linux filesystem permissions.

The `admin` and `devteam` accounts cannot directly access the original monitoring files using their normal permissions.

The current retrieval procedure uses the authorized `admin` account with `sudo` to create a temporary copy of the CSV. This allows the file to be downloaded without changing the permissions of the original monitoring directory.

### 5.2 Create a Temporary CSV Copy on the VM

Connect to the VM using the authorized `admin` SSH credentials.

**Step 1: Copy the original CSV into `/tmp`.**

```bash
sudo cp /home/wc/wellness-monitoring/storage_history.csv /tmp/storage_history.csv
```

**Step 2: Change ownership of the copied file to `admin`.**

```bash
sudo chown admin:admin /tmp/storage_history.csv
```

**Step 3: Restrict file permissions.**

```bash
chmod 600 /tmp/storage_history.csv
```

This restricts access to the temporary file to its owner, `admin`.

**Step 4: Verify the temporary file.**

```bash
ls -lh /tmp/storage_history.csv
```

The temporary CSV is now accessible through the `admin` SSH account.

### 5.3 Download the CSV to Windows

Open Windows PowerShell and execute:

```powershell
scp admin@<VM_IP>:/tmp/storage_history.csv "$env:USERPROFILE\Downloads\storage_history.csv"
```

Replace `<VM_IP>` with the approved VM address.

The CSV will be downloaded to:

`%USERPROFILE%\Downloads\storage_history.csv`

### 5.4 Clean Up the Temporary Copy

After successfully downloading the CSV, reconnect to the VM using the `admin` account.

Execute:

```bash
sudo rm /tmp/storage_history.csv
```

This removes the temporary copy while preserving the original historical CSV under:

`/home/wc/wellness-monitoring/`

### 5.5 Important Notes

- The original monitoring CSV remains protected under the `wc` user's directory.
- The `admin` account uses `sudo` to create a temporary copy.
- The temporary copy is owned by `admin` and has permission `600`.
- The `devteam` account does not currently have direct access to the original monitoring directory.
- The temporary CSV represents a snapshot of the historical measurements at the time it was copied.
- A new temporary copy must be created whenever updated measurements are required.
- The temporary file should be removed after a successful download.
- Removing the temporary file does not affect the original monitoring history.

This is the current manual CSV retrieval procedure. It does not modify the original monitoring directory permissions or grant additional filesystem access to other SSH accounts.

---

## 6. Local Graph-Generation Environment

The reporting script runs locally using Python in WSL/Ubuntu.

It is independent of the VM collection process and does not directly access the VM or network share.

### 6.1 Local Project Structure

Create a directory named `wellness-graphs` on the Windows computer.

The directory should contain:

```text
wellness-graphs/
│
├── plot_storage.py
├── storage_history.csv
│
├── vm_storage_usage.png
├── network_storage_usage.png
├── storage_usage_percentage.png
├── storage_available_space.png
│
└── growth_report.txt
```

The PNG files and text report are generated after executing the Python script.

### 6.2 Open WSL/Ubuntu

Open the WSL/Ubuntu terminal.

Navigate to the local reporting directory:

```bash
cd /mnt/c/Users/<WINDOWS_USERNAME>/wellness-graphs
```

Replace `<WINDOWS_USERNAME>` with the Windows account directory.

### 6.3 Copy the Latest CSV

Copy the downloaded CSV from Windows Downloads into the reporting directory:

```bash
cp /mnt/c/Users/<WINDOWS_USERNAME>/Downloads/storage_history.csv .
```

The local directory should now contain both:

- `plot_storage.py`
- `storage_history.csv`

The reporting script reads this local CSV file. It does not automatically download or synchronize measurements from the VM.

### 6.4 Verify Python and Matplotlib

Check the Python installation:

```bash
python3 --version
```

Check whether Matplotlib is installed:

```bash
python3 -c "import matplotlib; print(matplotlib.__version__)"
```

If Matplotlib is unavailable, install it in the WSL Python environment:

```bash
python3 -m pip install matplotlib
```

If the environment requires a virtual environment, create and activate one before installing the dependency.

### 6.5 Generate Graphs and Report

Execute:

```bash
python3 plot_storage.py
```

The script reads the historical CSV, processes valid measurements, and generates the configured graphs and report in the local reporting directory.

### 6.6 Verify Generated Files

```bash
ls -lh *.png growth_report.txt
```

Open the current directory in Windows Explorer:

```bash
explorer.exe .
```

The generated PNG files can be opened using an image viewer. The report can be opened using any text editor.

---

## 7. Generated Graphs and Report

The local reporting script generates four graphs and one text report.

### 7.1 VM Storage Usage

**File:** `vm_storage_usage.png`

Displays changes in VM disk usage over the recorded measurement period.

The graph uses the recorded VM used-space measurements and presents them in decimal GB.

### 7.2 Network Storage Usage

**File:** `network_storage_usage.png`

Displays changes in used storage on the mounted network filesystem.

Measurements are plotted only when the network status is `MOUNTED` and valid network storage data is available.

### 7.3 Storage Usage Percentage

**File:** `storage_usage_percentage.png`

Compares the storage utilization percentages of:

- VM filesystem.
- Network filesystem.

This provides a visual comparison of storage utilization over time.

### 7.4 Available Storage

**File:** `storage_available_space.png`

Compares available storage space across the monitored filesystems.

This helps identify changes in remaining VM and network storage capacity.

### 7.5 Growth Report

**File:** `growth_report.txt`

The report provides a detailed textual summary of the collected storage measurements.

It includes:

- Number of valid measurements processed.
- First recorded measurement.
- Latest recorded measurement.
- Latest VM storage statistics.
- Latest network mount status.
- Latest available mounted network storage statistics.
- Historical VM storage usage change.
- Historical network storage usage change.
- Average daily storage change.
- Seven-day VM and network storage projections.
- Thirty-day VM and network storage projections.
- VM storage utilization notices.

**Historical growth calculations**

The report compares the first and latest valid measurements to calculate:

- Net change in used storage.
- Average daily change in storage usage.

**Future storage projections**

The report estimates future storage consumption for two periods:

- Next 7 days.
- Next 30 days.

For both VM and network storage, the report displays:

- Current usage.
- Historical average daily change.
- Estimated additional storage consumption.
- Projected total usage after the selected period.

These projections use the average daily change between the first and latest valid historical measurements. They are not calculated from a rolling seven-day or thirty-day window.

They are estimates based on the assumption that the historical average growth rate continues. Actual storage consumption may differ.

**Storage utilization thresholds**

The reporting script applies the following thresholds to the latest VM usage percentage:

| VM storage utilization | Report status |
|---|---|
| Below 80% | No threshold notice |
| 80% to below 90% | NOTICE |
| 90% or above | WARNING |

These thresholds apply only to VM storage. The script does not generate equivalent threshold notices for network storage.

The notices are informational. They do not automatically delete files, increase storage capacity, or modify the filesystem.

**Network measurement handling**

Network measurements are included only when the network share is mounted and valid network statistics are available.

If the latest collection record indicates that the network is not mounted, the report displays that latest mount status. The network usage details and network projections can still reflect the most recent earlier mounted measurements.

All storage values in the report and graphs are displayed in decimal GB (1 GB = 1,000,000,000 bytes).

---

## 8. Updating the Graphs and Report

The VM continues collecting measurements automatically through cron.

However, the local CSV file does not automatically synchronize with the VM.

Whenever updated graphs and reports are required, follow this process.

**Step 1:** Connect to the VM using the authorized `admin` account.

**Step 2:** Create a temporary CSV copy using the procedure described in Section 5.2.

**Step 3:** Open Windows PowerShell and download the CSV using the SCP command in Section 5.3.

**Step 4:** Remove the temporary CSV from the VM using the cleanup procedure in Section 5.4.

**Step 5:** Open WSL/Ubuntu and navigate to the local reporting directory.

```bash
cd /mnt/c/Users/<WINDOWS_USERNAME>/wellness-graphs
```

**Step 6:** Copy the updated CSV into the reporting directory.

```bash
cp /mnt/c/Users/<WINDOWS_USERNAME>/Downloads/storage_history.csv .
```

**Step 7:** Execute the reporting script.

```bash
python3 plot_storage.py
```

**Step 8:** Verify the generated files.

```bash
ls -lh *.png growth_report.txt
```

The reporting script processes the measurements available in the downloaded CSV and regenerates all four graphs and the text report.

The latest report and projections therefore depend on the measurements present in the local CSV at the time of execution.

Previous historical measurements remain available in the VM's CSV, provided the collection script continues appending records.

---

## 9. Storage Monitoring Safety and Limitations

The monitoring system is designed to collect filesystem statistics without modifying the monitored application data.

- The collection script reads filesystem statistics using Linux system utilities.
- Measurements are appended to a CSV file.
- The monitoring process does not query patient records or MongoDB collections.
- It does not modify the Wellness application's source code or application configuration.
- It does not modify patient records or appointment data.
- The CSV and collection log consume a small amount of VM storage.
- Graphs and reports are generated locally.
- Network storage measurements represent filesystem-level usage, not exclusively Wellness application data.
- The reporting process operates on a downloaded CSV copy and does not directly access the VM.
- The local CSV must be manually refreshed to include newer VM measurements.
- Historical growth calculations and future projections depend on the available valid measurements.
- Storage warning thresholds are informational and do not perform automatic cleanup or capacity expansion.

The monitoring system is separate from the Wellness application's runtime and database operations.

---

## 10. Complete Workflow Summary

### A. Automatic VM Collection

```text
                 WELLNESS VM
                      |
                      v
                  collect.sh
                      |
                      v
              Cron (Every 4 Hours)
                      |
                      v
             storage_history.csv
                      |
                      v
                collector.log
```

### B. Manual CSV Transfer

```text
        Original CSV on VM
                 |
                 v
       Admin SSH + sudo
                 |
                 v
       Temporary CSV in /tmp
                 |
                 v
          SCP Transfer
                 |
                 v
        Windows Downloads
                 |
                 v
       Remove Temporary Copy
```

### C. Local Reporting

```text
        Downloaded CSV
               |
               v
      Local wellness-graphs
               |
               v
        plot_storage.py
               |
       +-------+--------+
       |                |
       v                v
   Four PNG Graphs   growth_report.txt
                          |
                          v
                Historical Growth Analysis
                          |
                          v
                7-Day and 30-Day
                 Storage Projections
```

---

## 11. Summary

The Wellness project has a separate storage-monitoring and reporting mechanism consisting of an automated VM collection component and a local reporting component.

The VM collection script records historical VM and mounted network filesystem measurements every four hours through a scheduled cron job.

The measurements are stored in a CSV file under the `wc` user's monitoring directory. The historical CSV can be retrieved using the authorized `admin` account through a temporary-copy and SCP procedure.

The downloaded CSV is processed locally using Python and Matplotlib to generate four storage graphs and a detailed text report.

The system provides:

- Periodic monitoring of VM storage.
- Monitoring of mounted network filesystem storage.
- Historical storage measurements.
- Visual representation of storage consumption.
- VM and network storage usage comparisons.
- Historical storage growth analysis.
- Seven-day and thirty-day future storage usage estimates.
- Informational VM storage utilization notices.
- Local report generation without requiring graph-generation dependencies on the VM.

The collection and reporting components operate independently. This allows the Wellness infrastructure to maintain its storage history automatically while the team can retrieve the latest measurements and generate updated reports whenever required.