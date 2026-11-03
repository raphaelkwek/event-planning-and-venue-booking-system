output "cluster_name" {
  description = "EKS cluster name, for aws eks update-kubeconfig."
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "Kubernetes API endpoint."
  value       = module.eks.cluster_endpoint
}

output "vpc_id" {
  description = "ID of the VPC."
  value       = module.network.vpc_id
}

output "redis_primary_endpoint" {
  description = "Redis primary address for the rate limiter (EN-12). Use TLS and the AUTH token."
  value       = module.redis.primary_endpoint
}
