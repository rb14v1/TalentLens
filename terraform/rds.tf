# =============================================================================
# TalentLens — RDS PostgreSQL with automated backups
#
# Compliance: rel.backup_configured
#   • Automated daily backups retained for 30 days  (backup_retention_period)
#   • Point-in-time recovery (PITR) enabled by default in RDS when backups > 0
#   • Cross-region backup replication via aws_db_instance_automated_backups_replication
#   • Restore procedure documented in docs/BACKUP_RESTORE.md
# =============================================================================

# ── Subnet group ─────────────────────────────────────────────────────────────
resource "aws_db_subnet_group" "talentlens" {
  name        = "talentlens-${var.environment}-subnet-group"
  subnet_ids  = var.subnet_ids
  description = "Subnet group for TalentLens RDS PostgreSQL"

  tags = {
    Name        = "talentlens-${var.environment}-subnet-group"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# ── Security group ────────────────────────────────────────────────────────────
resource "aws_security_group" "rds" {
  name        = "talentlens-${var.environment}-rds-sg"
  description = "Allow PostgreSQL traffic to TalentLens RDS"
  vpc_id      = var.vpc_id

  ingress {
    description = "PostgreSQL from allowed CIDRs"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "talentlens-${var.environment}-rds-sg"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# ── KMS key for RDS encryption at rest ───────────────────────────────────────
resource "aws_kms_key" "rds" {
  description             = "KMS key for TalentLens RDS PostgreSQL encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name        = "talentlens-${var.environment}-rds-key"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_kms_alias" "rds" {
  name          = "alias/talentlens-${var.environment}-rds"
  target_key_id = aws_kms_key.rds.key_id
}

# ── RDS PostgreSQL instance ───────────────────────────────────────────────────
resource "aws_db_instance" "talentlens" {
  identifier = "talentlens-${var.environment}-postgres"

  # Engine
  engine         = "postgres"
  engine_version = "16"
  instance_class = var.db_instance_class

  # Storage
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.rds.arn

  # Credentials
  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  # Network
  db_subnet_group_name   = aws_db_subnet_group.talentlens.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  # ── Backup / PITR configuration ──────────────────────────────────────────
  # RDS enables Point-in-Time Recovery automatically when backup_retention_period > 0.
  # Automated snapshots are taken daily during the backup_window and kept for 30 days.
  backup_retention_period = 30          # days — satisfies ≥ 30-day retention requirement
  backup_window           = "02:00-03:00" # UTC; choose a low-traffic window
  copy_tags_to_snapshot   = true

  # Maintenance window (must not overlap backup_window)
  maintenance_window = "Mon:04:00-Mon:05:00"

  # Availability & durability
  multi_az            = true  # standby in a different AZ, also aids backup resilience
  deletion_protection = true

  # Performance insights (optional — aids troubleshooting)
  performance_insights_enabled          = true
  performance_insights_retention_period = 7  # days (free tier)

  # Monitoring
  monitoring_interval = 60  # seconds; 0 to disable Enhanced Monitoring
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn

  # Final snapshot before destroy
  skip_final_snapshot       = false
  final_snapshot_identifier = "talentlens-${var.environment}-final-snapshot"

  tags = {
    Name        = "talentlens-${var.environment}-postgres"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# ── Cross-region automated backup replication ─────────────────────────────────
# Satisfies the requirement that backups are stored in a separate region from the
# primary database.  AWS replicates automated snapshots to var.backup_region.
resource "aws_db_instance_automated_backups_replication" "talentlens" {
  source_db_instance_arn = aws_db_instance.talentlens.arn
  retention_period       = 30  # days — mirrors primary retention

  provider = aws.backup_region
}

# ── IAM role for RDS Enhanced Monitoring ─────────────────────────────────────
resource "aws_iam_role" "rds_monitoring" {
  name = "talentlens-${var.environment}-rds-monitoring"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "monitoring.rds.amazonaws.com" }
    }]
  })

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# ── Outputs ───────────────────────────────────────────────────────────────────
output "rds_endpoint" {
  description = "Connection endpoint for the TalentLens PostgreSQL RDS instance"
  value       = aws_db_instance.talentlens.endpoint
  sensitive   = true
}

output "rds_identifier" {
  description = "RDS instance identifier (used in restore commands)"
  value       = aws_db_instance.talentlens.identifier
}

output "backup_region" {
  description = "AWS region where cross-region backup replicas are stored"
  value       = var.backup_region
}
