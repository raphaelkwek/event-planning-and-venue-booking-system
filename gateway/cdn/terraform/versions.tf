# EN-12: the CDN in front of the web app and the attendee browse API, as code.
#
# NOTHING IN THIS FOLDER HAS BEEN APPLIED. No CDN is deployed and no AWS account was used: CI runs
# `terraform fmt -check`, `terraform init -backend=false` and `terraform validate`, which prove the
# file is well formed, not that CloudFront would serve it. See documentation/gateway.md.
terraform {
  required_version = ">= 1.9.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# CloudFront is a global service; its certificates must live in us-east-1.
provider "aws" {
  region = "us-east-1"
}
