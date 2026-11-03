variable "region" {
  description = "AWS region. ADR-0012 fixes ap-southeast-1 (Singapore) for PDPA."
  type        = string
  default     = "ap-southeast-1"
}

variable "kubernetes_version" {
  description = "Kubernetes version of the EKS control plane."
  type        = string
  default     = "1.31"
}

variable "endpoint_public_access_cidrs" {
  description = "CIDR blocks allowed to reach the Kubernetes API endpoint."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "redis_auth_token" {
  description = "Redis AUTH token (16 or more characters). Set with TF_VAR_redis_auth_token; never commit it."
  type        = string
  sensitive   = true
}
