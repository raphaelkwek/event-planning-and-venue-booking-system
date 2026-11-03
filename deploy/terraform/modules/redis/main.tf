resource "aws_security_group" "redis" {
  name_prefix = "${var.name}-redis-"
  description = "Redis for ${var.name}: reachable only from the cluster nodes"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, { Name = "${var.name}-redis" })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_security_group_ingress_rule" "from_nodes" {
  security_group_id            = aws_security_group.redis.id
  description                  = "Redis from the cluster nodes"
  referenced_security_group_id = var.allowed_security_group_id
  from_port                    = 6379
  to_port                      = 6379
  ip_protocol                  = "tcp"
}

resource "aws_elasticache_subnet_group" "this" {
  name       = var.name
  subnet_ids = var.subnet_ids
  tags       = var.tags
}

# A parameter group of our own: the default one cannot be edited, and rate limiting
# should not have to be rebuilt to change a setting later.
resource "aws_elasticache_parameter_group" "this" {
  name        = var.name
  family      = "redis7"
  description = "Redis parameters for ${var.name}"
  tags        = var.tags
}

resource "aws_elasticache_replication_group" "this" {
  replication_group_id = var.name
  description          = "Redis for ConnectSphere rate limits (EN-12)"

  engine               = "redis"
  engine_version       = var.engine_version
  node_type            = var.node_type
  port                 = 6379
  parameter_group_name = aws_elasticache_parameter_group.this.name

  num_cache_clusters         = var.num_cache_clusters
  automatic_failover_enabled = var.num_cache_clusters > 1
  multi_az_enabled           = var.num_cache_clusters > 1

  subnet_group_name  = aws_elasticache_subnet_group.this.name
  security_group_ids = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = var.auth_token

  tags = var.tags
}
