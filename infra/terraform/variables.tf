# ---------------------------------------------------------------------------
# Required tags — must be supplied for every deployment
# (used for cost allocation, incident attribution, and automated governance)
# ---------------------------------------------------------------------------
variable "tenant_id" {
  description = "Unique identifier for the tenant that owns these resources (maps to the 'tenantId' tag)."
  type        = string
}

variable "submission_id" {
  description = "Identifier for the submission / deployment run (maps to the 'submissionId' tag)."
  type        = string
}

variable "cost_centre" {
  description = "Cost centre code used for cloud-spend allocation (maps to the 'costCentre' tag)."
  type        = string
}

# ---------------------------------------------------------------------------
# AWS / infrastructure settings
# ---------------------------------------------------------------------------
variable "aws_region" {
  description = "AWS region in which all resources are deployed."
  type        = string
  default     = "us-east-1"
}

variable "s3_bucket_name" {
  description = "Name of the S3 bucket used to store resumes and JD documents."
  type        = string
}

variable "environment" {
  description = "Deployment environment label (e.g. dev, staging, prod)."
  type        = string
  default     = "prod"
}
