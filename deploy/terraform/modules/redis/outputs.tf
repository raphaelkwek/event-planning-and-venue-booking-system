output "primary_endpoint" {
  description = "Address of the primary node. Connect with TLS (rediss://) and the AUTH token."
  value       = aws_elasticache_replication_group.this.primary_endpoint_address
}
