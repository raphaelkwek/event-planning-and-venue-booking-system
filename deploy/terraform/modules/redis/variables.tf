variable "name" {
  description = "Name of the replication group, for example connectsphere-staging."
  type        = string
}

variable "vpc_id" {
  description = "VPC the cache runs in."
  type        = string
}

variable "subnet_ids" {
  description = "Private subnets for the cache."
  type        = list(string)
}

variable "allowed_security_group_id" {
  description = "The only security group allowed to reach Redis: the cluster node group."
  type        = string
}

variable "node_type" {
  description = "ElastiCache node type."
  type        = string
  default     = "cache.t4g.small"
}

variable "num_cache_clusters" {
  description = "Number of nodes: 1 primary plus replicas. Use 2 or more for automatic failover."
  type        = number
  default     = 2
}

variable "engine_version" {
  description = "Redis engine version."
  type        = string
  default     = "7.1"
}

variable "auth_token" {
  description = "Redis AUTH token, at least 16 characters. Pass it with TF_VAR_redis_auth_token from a secret store; it is never committed."
  type        = string
  sensitive   = true
}

variable "tags" {
  description = "Tags added to every resource."
  type        = map(string)
  default     = {}
}
