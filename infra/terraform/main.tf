terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# ---------------------------------------------------------------------------
# AWS provider — default_tags propagates tenantId, submissionId, and
# costCentre to EVERY AWS resource (S3, RDS, etc.) automatically.
# ---------------------------------------------------------------------------
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      tenantId     = var.tenant_id
      submissionId = var.submission_id
      costCentre   = var.cost_centre
      application  = "talent-lens"
      environment  = var.environment
      managedBy    = "terraform"
    }
  }
}
