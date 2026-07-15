output "s3_bucket_name" {
  description = "Name of the Talent-Lens S3 document bucket."
  value       = aws_s3_bucket.talent_lens_docs.id
}

output "s3_bucket_arn" {
  description = "ARN of the Talent-Lens S3 document bucket."
  value       = aws_s3_bucket.talent_lens_docs.arn
}

output "s3_bucket_region" {
  description = "AWS region where the S3 bucket resides."
  value       = aws_s3_bucket.talent_lens_docs.region
}
