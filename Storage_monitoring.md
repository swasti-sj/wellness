# Wellness Project — Storage Monitoring and Reporting

## 1. Overview

A storage monitoring system has been set up to track storage usage for the Wellness project infrastructure.

The system consists of two separate scripts:

1. **VM collection script (`collect.sh`)** — runs automatically every four hours and records storage statistics in a CSV file on the VM.
2. **Local reporting script (`plot_storage.py`)** — processes a downloaded copy of the CSV file and generates graphs and a text report on a local computer.

The collection script runs on the VM. The graph-generation script runs locally and does not need to be installed or executed on the VM.

## 2. File Locations

### On the VM

Directory:

`/home/wc/wellness-monitoring/`

| File | Purpose |
|---|---|
| `collect.sh` | Collects storage statistics |
| `storage_history.csv` | Stores historical measurements |
| `collector.log` | Stores scheduled execution output and errors |

### On a local computer

Project directory:

`C:\Users\RENUSRI\wellness-graphs\`

| File | Purpose |
|---|---|
| `plot_storage.py` | Generates graphs and the report |
| `storage_history.csv` | Downloaded copy of the VM's CSV |
| `vm_storage_usage.png` | VM disk usage graph |
| `network_storage_usage.png` | Network storage usage graph |
| `storage_usage_percentage.png` | Storage usage percentage comparison |
| `storage_available_space.png` | Available storage comparison |
| `growth_report.txt` | Summary of storage usage and historical changes |

The local Windows directory above is an example of the current development environment. Team members should substitute their own local directory where necessary.

## 3. VM Collection Script

The script is located at:

`/home/wc/wellness-monitoring/collect.sh`

It collects the following information:

- Total VM disk capacity.
- VM disk space used and available.
- VM disk usage percentage.
- Network-drive mount status.
- Total, used and available network storage.
- Network storage usage percentage.
- Timestamp of each measurement.

The script appends each measurement to `storage_history.csv`, preserving the previous measurements.

### Inspect the script

After connecting to the VM using the approved SSH method, run:

```bash
cd /home/wc/wellness-monitoring
ls -lh
cat collect.sh
```

To inspect the script page by page:

```bash
less /home/wc/wellness-monitoring/collect.sh
```

Press `q` to exit.

### Check the automatic schedule

```bash
crontab -l
```

The configured schedule is:

```cron
0 */4 * * * /bin/bash /home/wc/wellness-monitoring/collect.sh >> /home/wc/wellness-monitoring/collector.log 2>&1
```

This executes the script at 00:00, 04:00, 08:00, 12:00, 16:00 and 20:00 according to the VM's local timezone, provided the VM and cron service are running.

An SSH terminal does not need to remain open.

### Check collected measurements

```bash
cat /home/wc/wellness-monitoring/storage_history.csv
```

To display the latest rows:

```bash
tail -n 10 /home/wc/wellness-monitoring/storage_history.csv
```

### Run a manual collection

```bash
/bin/bash /home/wc/wellness-monitoring/collect.sh
```

This records an additional measurement immediately without waiting for the next scheduled run.

### Check the scheduler log

```bash
tail -n 30 /home/wc/wellness-monitoring/collector.log
```

The log is created when output is written by the scheduled command.

## 4. Download the CSV from the VM

The local reporting script requires a copy of the CSV generated on the VM.

Run the following command in **Windows PowerShell**, not inside the VM terminal or WSL:

```powershell
scp wc@10.195.250.184:/home/wc/wellness-monitoring/storage_history.csv "$HOME\Downloads\storage_history.csv"
```

Use the approved VM address and account if the connection details change.

If SSH reports a host-key verification problem, verify the server fingerprint through the VM administrator or trusted IT documentation before accepting it.

After downloading, the file should be available at:

`C:\Users\RENUSRI\Downloads\storage_history.csv`

Downloading the CSV creates a local copy; it does not delete or modify the original VM file.

## 5. Local Graph-Generation Script

The Python script `plot_storage.py` reads the CSV and generates four graphs and one text report.

### Step 1: Open WSL/Ubuntu

Open the local WSL/Ubuntu terminal.

### Step 2: Navigate to the local directory

```bash
cd /mnt/c/Users/RENUSRI/wellness-graphs
```

### Step 3: Copy the downloaded CSV into the project directory

```bash
cp /mnt/c/Users/RENUSRI/Downloads/storage_history.csv .
```

The CSV must be in the same directory as `plot_storage.py`.

### Step 4: Verify the input files

```bash
ls -lh
```

Confirm that both `plot_storage.py` and `storage_history.csv` are present.

### Step 5: Check Python and Matplotlib

```bash
python3 --version
python3 -c "import matplotlib; print(matplotlib.__version__)"
```

If Matplotlib is not installed in the current WSL Python environment:

```bash
python3 -m pip install --user matplotlib
```

### Step 6: Generate the graphs and report

```bash
python3 plot_storage.py
```

The script reads the downloaded CSV and saves the output files in the same local directory.

### Step 7: Verify the generated files

```bash
ls -lh *.png growth_report.txt
```

### Step 8: Open the output directory

```bash
explorer.exe .
```

Open the PNG files to view the graphs and `growth_report.txt` to read the summary.

## 6. Generated Graphs and Report

The local script generates the following outputs:

1. **VM Storage Usage (`vm_storage_usage.png`)** — shows how VM disk usage changes over time.
2. **Network Storage Usage (`network_storage_usage.png`)** — shows changes in used network storage.
3. **Storage Usage Percentage (`storage_usage_percentage.png`)** — compares VM and network storage usage percentages.
4. **Available Storage (`storage_available_space.png`)** — compares the available space on both filesystems.
5. **Growth Report (`growth_report.txt`)** — includes measurement count, first and latest measurements, current storage statistics, and the difference between the first and latest valid measurements.

The report displays a notice when VM disk usage reaches 80% and a warning when it reaches 90%.

Growth calculations are historical averages based on collected measurements, not predictions of future usage.

## 7. Updating the Graphs

The VM continues collecting data automatically, but the local CSV copy does not update by itself.

Whenever updated graphs are needed:

1. Download the latest CSV from the VM using the PowerShell `scp` command.
2. Open WSL/Ubuntu.
3. Copy the downloaded CSV into the local reporting directory.
4. Run the Python script again.

Commands for steps 3 and 4:

```bash
cd /mnt/c/Users/RENUSRI/wellness-graphs
cp /mnt/c/Users/RENUSRI/Downloads/storage_history.csv .
python3 plot_storage.py
```

The output files will be regenerated using all valid measurements present in the downloaded CSV.

## 8. Storage and Application Safety

- The collection script reads filesystem statistics and appends them to a CSV.
- It does not read patient records or query MongoDB collections.
- It does not modify the Wellness application's source code, database or configuration.
- The CSV and log files consume a small amount of storage on the VM.
- The generated graphs and report are stored locally.
- The network-drive measurements represent filesystem usage reported by Linux `df`, not exclusively files belonging to the Wellness project.
- `df` and `du` can report different usage values because they measure different things.

## 9. Complete Workflow

**Automatic collection on the VM**

`collect.sh` → executes every four hours → appends measurements to `storage_history.csv`

**Manual transfer**

VM CSV → downloaded to the local computer using PowerShell and `scp`

**Local reporting**

Downloaded CSV → `plot_storage.py` → four graphs and `growth_report.txt`

This setup maintains a historical record of storage usage on the VM while allowing the team to generate and inspect graphs locally without running the reporting script on the VM.
