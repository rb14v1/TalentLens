# TalentLens — Database Backup & Restore Procedure

> **Compliance reference:** `rel.backup_configured`
> This document must be reviewed and the restore test repeated after every major infrastructure change.

---

## 1. Backup Policy

| Setting | Value |
|---|---|
| Database engine | PostgreSQL 16 (AWS RDS) |
| Automated backup window | 02:00–03:00 UTC daily |
| Retention period | **30 days** |
| Point-in-time recovery (PITR) | Enabled (RDS enables PITR automatically when `backup_retention_period > 0`) |
| Encryption | AWS KMS (`alias/talentlens-production-rds`) |
| Cross-region replication | Automated backup replicas copied to **`us-west-2`** (separate from primary `us-east-1`) |
| Final snapshot on deletion | Enabled (`final_snapshot_identifier = talentlens-production-final-snapshot`) |

All settings are managed in **`terraform/rds.tf`**.  Changes must go through a Terraform plan/apply cycle.

---

## 2. Verify Backups are Active

```bash
# List automated backups for the instance
aws rds describe-db-instances \
  --db-instance-identifier talentlens-production-postgres \
  --query 'DBInstances[0].{BackupRetention:BackupRetentionPeriod,LatestRestoreTime:LatestRestorableTime,Status:DBInstanceStatus}'

# List available automated snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier talentlens-production-postgres \
  --snapshot-type automated \
  --query 'DBSnapshots[*].{Id:DBSnapshotIdentifier,Created:SnapshotCreateTime,Status:Status}'

# Verify cross-region replicas (run in backup region)
aws rds describe-db-instance-automated-backups \
  --region us-west-2 \
  --query 'DBInstanceAutomatedBackups[?DBInstanceIdentifier==`talentlens-production-postgres`]'
```

---

## 3. Restore Procedures

### 3a. Point-in-Time Restore (PITR)

Use this when you need to recover data as it existed at a specific moment (e.g., to undo accidental deletions or data corruption).

```bash
# 1. Choose your target restore time (ISO 8601, UTC)
TARGET_TIME="2026-07-14T10:30:00Z"

# 2. Restore to a NEW instance (never overwrite the running instance directly)
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier talentlens-production-postgres \
  --target-db-instance-identifier talentlens-production-postgres-restored \
  --restore-time "$TARGET_TIME" \
  --db-instance-class db.t3.micro \
  --publicly-accessible false \
  --no-multi-az

# 3. Wait for the restored instance to become available (~10–20 min)
aws rds wait db-instance-available \
  --db-instance-identifier talentlens-production-postgres-restored

# 4. Retrieve the new endpoint
aws rds describe-db-instances \
  --db-instance-identifier talentlens-production-postgres-restored \
  --query 'DBInstances[0].Endpoint.Address'

# 5. Validate data integrity (connect and run application smoke tests against the restored instance)

# 6. If validated, update the application's DB_HOST environment variable to the new endpoint,
#    then rename/delete the old instance following your change-management process.
```

### 3b. Restore from a Specific Automated Snapshot

Use this when you want to restore from a known-good daily snapshot.

```bash
# 1. List available automated snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier talentlens-production-postgres \
  --snapshot-type automated \
  --query 'sort_by(DBSnapshots, &SnapshotCreateTime)[-10:].{Id:DBSnapshotIdentifier,Created:SnapshotCreateTime}'

# 2. Restore from the chosen snapshot
SNAPSHOT_ID="rds:talentlens-production-postgres-2026-07-14-02-00"

aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier talentlens-production-postgres-snap-restored \
  --db-snapshot-identifier "$SNAPSHOT_ID" \
  --db-instance-class db.t3.micro \
  --publicly-accessible false

# 3. Wait for the instance to become available
aws rds wait db-instance-available \
  --db-instance-identifier talentlens-production-postgres-snap-restored

# 4. Validate and cut over as in step 3a (steps 4–6).
```

### 3c. Restore from Cross-Region Backup Replica

Use this when the primary region (`us-east-1`) is unavailable.

```bash
# 1. List cross-region automated backups in the backup region
aws rds describe-db-instance-automated-backups \
  --region us-west-2 \
  --query 'DBInstanceAutomatedBackups[?DBInstanceIdentifier==`talentlens-production-postgres`].{ARN:DBInstanceArn,LatestTime:RestoreWindow.LatestTime}'

# 2. Copy the cross-region backup into a usable snapshot (or use PITR directly)
SOURCE_ARN="<arn from step 1>"

aws rds restore-db-instance-to-point-in-time \
  --region us-west-2 \
  --source-db-instance-automated-backups-arn "$SOURCE_ARN" \
  --target-db-instance-identifier talentlens-dr-postgres \
  --restore-time "$TARGET_TIME" \
  --db-instance-class db.t3.micro

# 3. Update application config to point to the restored instance in us-west-2.
```

---

## 4. Qdrant Vector Store Backup

Qdrant snapshots must be managed separately via the Qdrant API:

```bash
# Create a snapshot of the resumes collection
curl -X POST "${QDRANT_URL}/collections/resumes/snapshots" \
  -H "api-key: ${QDRANT_API_KEY}"

# List existing snapshots
curl "${QDRANT_URL}/collections/resumes/snapshots" \
  -H "api-key: ${QDRANT_API_KEY}"

# Download the latest snapshot (replace <snapshot_name> with the name returned above)
curl -o resumes_snapshot.tar \
  "${QDRANT_URL}/collections/resumes/snapshots/<snapshot_name>" \
  -H "api-key: ${QDRANT_API_KEY}"

# Upload snapshot to S3 for long-term retention
aws s3 cp resumes_snapshot.tar \
  s3://${S3_BUCKET}/qdrant-backups/resumes/$(date +%Y-%m-%d)/resumes_snapshot.tar
```

Automate the above as a scheduled task (cron / ECS scheduled task) running daily, with the S3 bucket configured to replicate objects to a second region using **S3 Cross-Region Replication**.

---

## 5. Pre-Go-Live Restore Test Checklist

Complete this checklist before go-live and record results below.

| # | Step | Pass/Fail | Tested by | Date |
|---|---|---|---|---|
| 1 | Verify `backup_retention_period = 30` in AWS Console / Terraform state | | | |
| 2 | Confirm PITR `LatestRestorableTime` is within the last 5 minutes | | | |
| 3 | Confirm cross-region backup replicas appear in `us-west-2` | | | |
| 4 | Execute PITR restore (§ 3a) to a staging instance | | | |
| 5 | Run Django migrations dry-run against restored instance | | | |
| 6 | Run application smoke tests (login, search, JD creation) against restored instance | | | |
| 7 | Record RTO (time from restore trigger to app healthy): _______ min | | | |
| 8 | Delete test restored instance | | | |
| 9 | Verify Qdrant snapshot upload to S3 (§ 4) | | | |

**Test result summary:**

> _Fill in before go-live._

---

## 6. Contacts & Escalation

| Role | Responsibility |
|---|---|
| Platform / DevOps engineer | Executes restore; owns Terraform config |
| Engineering lead | Authorises production cutover |
| Product owner | Confirms business impact and communications |

For AWS RDS restore support: <https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_RestoreFromSnapshot.html>
