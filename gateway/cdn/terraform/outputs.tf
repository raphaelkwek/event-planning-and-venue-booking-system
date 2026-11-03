output "distribution_domain_name" {
  description = "The *.cloudfront.net name to point domain_name at (a CNAME or alias record)."
  value       = aws_cloudfront_distribution.web.domain_name
}

output "spa_bucket" {
  description = "Upload the built web app (frontend/dist) here."
  value       = aws_s3_bucket.spa.id
}
