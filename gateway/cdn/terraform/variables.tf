variable "domain_name" {
  description = "The public host name attendees and staff use, for example connectsphere.example.edu."
  type        = string
}

variable "certificate_arn" {
  description = "ARN of an ACM certificate for domain_name, issued in us-east-1."
  type        = string
}

variable "gateway_domain" {
  description = "Host name of the load balancer in front of the Kong gateway (gateway/k8s). The CDN reaches it over HTTPS only."
  type        = string
}

variable "spa_bucket_name" {
  description = "Name of the S3 bucket that holds the built web app (frontend/dist)."
  type        = string
}

variable "web_acl_arn" {
  description = "Optional AWS WAF web ACL to attach. Empty means none."
  type        = string
  default     = ""
}
