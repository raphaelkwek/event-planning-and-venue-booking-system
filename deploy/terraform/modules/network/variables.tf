variable "name" {
  description = "Name prefix for every network resource, for example connectsphere-staging."
  type        = string
}

variable "cluster_name" {
  description = "EKS cluster name, used for the subnet discovery tags."
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block of the VPC."
  type        = string
  default     = "10.20.0.0/16"
}

variable "az_count" {
  description = "Number of availability zones to span (ADR-0012 asks for three)."
  type        = number
  default     = 3
}

variable "single_nat_gateway" {
  description = "Use one NAT gateway for all private subnets (cheaper, staging) instead of one per zone."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags added to every resource."
  type        = map(string)
  default     = {}
}
