# Partial configuration: bucket, key, region and lock table come from
# backend.hcl (copy backend.hcl.example) and credentials from the usual AWS
# environment variables or profile. Nothing secret is committed.
terraform {
  backend "s3" {}
}
