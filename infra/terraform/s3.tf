# ---------------------------------------------------------------------------
# S3 bucket — stores resumes and job-description PDFs for Talent-Lens.
# The three mandatory tags (tenantId, submissionId, costCentre) are applied
# automatically via the provider's default_tags block in main.tf.
# ---------------------------------------------------------------------------
resource "aws_s3_bucket" "talent_lens_docs" {
  bucket = var.s3_bucket_name

  # Explicit tags here are merged with default_tags — duplicates are rejected
  # by Terraform, so only additional resource-specific tags belong here.
  tags = {
    Name = "${var.s3_bucket_name}-talent-lens-docs"
  }
}

resource "aws_s3_bucket_versioning" "talent_lens_docs" {
  bucket = aws_s3_bucket.talent_lens_docs.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "talent_lens_docs" {
  bucket = aws_s3_bucket.talent_lens_docs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "talent_lens_docs" {
  bucket = aws_s3_bucket.talent_lens_docs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
