variable "aws_region" {
  description = "Primary AWS region where the RDS instance is deployed"
  type        = string
  default     = "us-east-1"
}

variable "backup_region" {
  description = "Secondary AWS region where automated backup replicas are stored (must differ from aws_region)"
  type        = string
  default     = "us-west-2"
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "talentlens_db"
}

variable "db_username" {
  description = "Master username for the RDS PostgreSQL instance"
  type        = string
  sensitive   = true
}

variable "db_password" {
  description = "Master password for the RDS PostgreSQL instance"
  type        = string
  sensitive   = true
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "Allocated storage in GB"
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "Upper limit for storage autoscaling in GB"
  type        = number
  default     = 100
}

variable "subnet_ids" {
  description = "List of subnet IDs for the RDS subnet group"
  type        = list(string)
}

variable "vpc_id" {
  description = "VPC ID in which the RDS instance resides"
  type        = string
}

variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to reach the RDS instance on port 5432"
  type        = list(string)
  default     = []
}

variable "environment" {
  description = "Deployment environment tag (e.g. production, staging)"
  type        = string
  default     = "production"
}
