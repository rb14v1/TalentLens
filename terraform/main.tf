terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# ── Primary region provider ──────────────────────────────────────────────────
provider "aws" {
  region = var.aws_region
}

# ── Backup / replica region provider ─────────────────────────────────────────
# Backups are replicated to a *separate* region to satisfy the requirement that
# backup storage must differ from the primary database region.
provider "aws" {
  alias  = "backup_region"
  region = var.backup_region
}
