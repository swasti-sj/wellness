# Wellness Project — Storage Monitoring and Reporting

## 1. Overview

The Wellness storage monitoring system tracks disk usage and available storage on the VM and mounted network filesystem.

It consists of two independent components:

1. **`collect.sh`** – Runs automatically on the VM every four hours and records storage measurements in a CSV file.
2. **`plot_storage.py`** – Runs locally in Windows/WSL, processes a downloaded CSV copy, and generates four graphs and a storage report.

Graph generation is performed locally, so Matplotlib is not required on the VM.

### Architecture

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
             Manual SCP
                  |
                  v
           WINDOWS / WSL
                  |
                  v
           plot_storage.py
                  |
             +----+----+
             |         |
             v         v
          4 Graphs   Text Report
           (.png)   growth_report.txt
```

CSV retrieval and report generation are manual. VM collection is automatic.

## 2. File Locations

### VM

Directory: `/home/wc/wellness-monitoring/`

| File | Purpose |
|---|---|
| `collect.sh` | Collects VM and network storage statistics |
| `storage_history.csv` | Stores historical measurements |
| `collector.log` | Records collection output and errors |

The directory belongs to the `wc` user. The `admin` account requires `sudo` to access the original files.

### Network Storage

- Network share: `//10.250.200.50/wellness`
- VM mount point: `/mnt/ccs-wellness`

### Local Reporting Directory

Example: `wellness-graphs/`

| File | Purpose |
|---|---|
| `plot_storage.py` | Generates graphs and report |
| `storage_history.csv` | Downloaded VM measurement history |
| `vm_storage_usage.png` | VM usage over time |
| `network_storage_usage.png` | Network storage usage over time |
| `storage_usage_percentage.png` | VM and network utilization comparison |
| `storage_available_space.png` | Available storage comparison |
| `growth_report.txt` | Historical analysis and future projections |

## 3. VM Storage Collection

### What Is Collected?

The script monitors:

- **VM:** Total capacity, used space, available space and usage percentage.
- **Network:** Mount status, total capacity, used space, available space and usage percentage.
- **Timestamp:** Date and time of each measurement.

Measurements are stored in bytes in the CSV. The local reporting script converts them into decimal GB.

Network statistics represent the entire mounted filesystem, not just the Wellness project directory.

### CSV Columns

| Column | Description |
|---|---|
| `timestamp` | Measurement date and time |
| `vm_total_bytes` | Total VM filesystem capacity |
| `vm_used_bytes` | VM space used |
| `vm_available_bytes` | VM space available |
| `vm_used_pct` | VM utilization percentage |
| `network_status` | Network mount status |
| `network_total_bytes` | Total network filesystem capacity |
| `network_used_bytes` | Network space used |
| `network_available_bytes` | Network space available |
| `network_used_pct` | Network utilization percentage |

Network status can be:

- `MOUNTED` – Network filesystem statistics collected successfully.
- `NOT_MOUNTED` – Network share is not mounted.
- `UNREADABLE` – Mount exists, but statistics could not be obtained.

Unavailable network measurements are recorded as empty fields.

### Automatic Schedule

The verified cron entry belongs to the `wc` user:

```cron
0 */4 * * * /bin/bash /home/wc/wellness-monitoring/collect.sh >> /home/wc/wellness-monitoring/collector.log 2>&1
```

Collection runs at 00:00, 04:00, 08:00, 12:00, 16:00 and 20:00, according to the VM's local timezone.

Check the installed schedule:

```bash
sudo crontab -u wc -l
```

The VM and cron service must be running. An SSH session does not need to remain open.

### Useful VM Commands

Run these commands from an SSH session with appropriate permissions:

```bash
# List monitoring files
sudo ls -lh /home/wc/wellness-monitoring/

# View collection script
sudo cat /home/wc/wellness-monitoring/collect.sh

# View latest CSV measurements
sudo tail -n 10 /home/wc/wellness-monitoring/storage_history.csv

# View collection log
sudo tail -n 30 /home/wc/wellness-monitoring/collector.log

# Run collection manually
sudo -u wc /bin/bash /home/wc/wellness-monitoring/collect.sh
```

## 4. Network Storage Verification

The network share is mounted at `/mnt/ccs-wellness`.

```bash
# Check mount status
mountpoint /mnt/ccs-wellness

# Check network filesystem usage
df -h /mnt/ccs-wellness

# Check VM root filesystem usage
df -h /

# Check directory-level usage
sudo du -sh /mnt/ccs-wellness
```

**Difference between `df` and `du`:**

- `df` reports usage of the entire filesystem.
- `du` reports the space occupied by files in a directory.

Therefore, network filesystem usage reported by `df` should not be interpreted as Wellness application data alone.

## 5. Download the Historical CSV

The original CSV is protected under the `wc` user's directory. The current retrieval method uses the `admin` account to create a temporary copy without changing the original file permissions.

### Step 1: Create a temporary copy on the VM

Connect using the authorized `admin` SSH account:

```bash
sudo cp /home/wc/wellness-monitoring/storage_history.csv /tmp/storage_history.csv
sudo chown admin:admin /tmp/storage_history.csv
chmod 600 /tmp/storage_history.csv
```

### Step 2: Download using Windows PowerShell

```powershell
scp admin@<VM_IP>:/tmp/storage_history.csv "$env:USERPROFILE\Downloads\storage_history.csv"
```

Replace `<VM_IP>` with the approved VM address.

### Step 3: Remove the temporary copy

After confirming the download, reconnect to the VM and run:

```bash
sudo rm /tmp/storage_history.csv
```

The original CSV remains unchanged in `/home/wc/wellness-monitoring/`.

## 6. Local Report Generation

The reporting script runs in WSL/Ubuntu and requires Python and Matplotlib.

### Local Setup

Navigate to the reporting directory:

```bash
cd /mnt/c/Users/<WINDOWS_USERNAME>/wellness-graphs
```

Copy the downloaded CSV from Windows Downloads:

```bash
cp /mnt/c/Users/<WINDOWS_USERNAME>/Downloads/storage_history.csv .
```

Install Matplotlib if required:

```bash
python3 -m pip install matplotlib
```

Generate the graphs and report:

```bash
python3 plot_storage.py
```

Verify the output:

```bash
ls -lh *.png growth_report.txt
```

Open the directory in Windows Explorer:

```bash
explorer.exe .
```

The local script reads `storage_history.csv` from its own directory. It does not automatically download or synchronize data from the VM.

## 7. Generated Graphs and Report

The script generates four graphs:

| Output | Information |
|---|---|
| `vm_storage_usage.png` | VM used storage over time |
| `network_storage_usage.png` | Network used storage over time |
| `storage_usage_percentage.png` | VM and network utilization percentages |
| `storage_available_space.png` | Available VM and network storage |

### `growth_report.txt`

The report includes:

- Number of valid measurements and measurement period.
- Latest VM storage status.
- Latest network mount status and available mounted measurements.
- Historical storage changes and average daily growth.
- VM and network storage projections for the next 7 and 30 days.
- VM storage utilization notices.

**Storage projections**

The script estimates future storage consumption using the average daily change between the first and latest valid measurements.

For both VM and network storage, it calculates:

- Current usage.
- Average daily change.
- Estimated additional usage over 7 days and 30 days.
- Projected total usage after each period.

These are historical-average estimates, not guaranteed forecasts or rolling 7-day/30-day growth calculations.

**VM storage notices**

| VM utilization | Status |
|---|---|
| Below 80% | No notice |
| 80% to below 90% | NOTICE |
| 90% or above | WARNING |

These thresholds apply only to VM storage. They are informational and do not trigger automatic cleanup or capacity expansion.

Network statistics are included only for mounted measurements. If the latest record shows an unmounted network share, the report displays that status while network usage details may reflect the most recent earlier mounted measurement.

All graph and report storage values use decimal GB (1 GB = 1,000,000,000 bytes).

## 8. Updating Graphs and Reports

VM collection continues automatically, but the local CSV must be manually refreshed.

Whenever an updated report is required:

1. Create a temporary CSV copy on the VM using Section 5.
2. Download it to Windows using SCP.
3. Remove the temporary VM copy.
4. Copy the downloaded CSV into the local `wellness-graphs` directory.
5. Run the reporting script:

```bash
cd /mnt/c/Users/<WINDOWS_USERNAME>/wellness-graphs
cp /mnt/c/Users/<WINDOWS_USERNAME>/Downloads/storage_history.csv .
python3 plot_storage.py
```

The graphs and report are regenerated using the measurements in the updated local CSV.

## 9. Safety and Limitations

- The collection script reads filesystem statistics and appends measurements to a CSV.
- It does not query patient records or MongoDB collections.
- It does not modify application source code, configuration, patient records or appointment data.
- Network measurements represent the entire mounted filesystem.
- The original monitoring CSV remains under the `wc` user's directory.
- Local reporting operates on a downloaded CSV copy and does not directly access the VM.
- Updated reports require manual CSV retrieval.
- Growth projections are estimates based on historical measurements.
- Storage notices are informational; no automatic alerts, cleanup or capacity expansion are implemented.

## 10. Summary

The Wellness storage monitoring system automatically records VM and mounted network filesystem usage every four hours.

The measurements are retained in a historical CSV on the VM. The team can download the CSV when required and process it locally using Python and Matplotlib.

The system provides periodic storage monitoring, historical usage analysis, four visual reports, 7-day and 30-day storage projections, and informational VM utilization notices.

The collection and reporting components operate independently, allowing storage history to be maintained automatically while updated reports can be generated whenever needed.