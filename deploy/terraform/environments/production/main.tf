locals {
  name = "connectsphere-production"

  tags = {
    Project     = "connectsphere"
    Environment = "production"
    ManagedBy   = "terraform"
  }
}

module "network" {
  source = "../../modules/network"

  name               = local.name
  cluster_name       = local.name
  vpc_cidr           = "10.30.0.0/16"
  az_count           = 3
  single_nat_gateway = false
  tags               = local.tags
}

module "eks" {
  source = "../../modules/eks"

  cluster_name                 = local.name
  kubernetes_version           = var.kubernetes_version
  private_subnet_ids           = module.network.private_subnet_ids
  endpoint_public_access_cidrs = var.endpoint_public_access_cidrs
  node_min_size                = 3
  node_desired_size            = 3
  node_max_size                = 12
  tags                         = local.tags
}

module "redis" {
  source = "../../modules/redis"

  name                      = local.name
  vpc_id                    = module.network.vpc_id
  subnet_ids                = module.network.private_subnet_ids
  allowed_security_group_id = module.eks.cluster_security_group_id
  num_cache_clusters        = 3
  auth_token                = var.redis_auth_token
  tags                      = local.tags
}
