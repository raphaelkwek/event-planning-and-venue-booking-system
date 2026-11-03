variable "cluster_name" {
  description = "Name of the EKS cluster."
  type        = string
}

variable "kubernetes_version" {
  description = "Kubernetes version of the control plane."
  type        = string
  default     = "1.31"
}

variable "private_subnet_ids" {
  description = "Private subnets for the control plane network interfaces and the nodes."
  type        = list(string)
}

variable "endpoint_public_access" {
  description = "Whether the Kubernetes API endpoint is reachable from the internet."
  type        = bool
  default     = true
}

variable "endpoint_public_access_cidrs" {
  description = "CIDR blocks allowed to reach the public API endpoint. Restrict this outside a demo."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "node_instance_types" {
  description = "EC2 instance types of the managed node group."
  type        = list(string)
  default     = ["t3.large"]
}

variable "node_min_size" {
  description = "Minimum number of nodes."
  type        = number
  default     = 3
}

variable "node_desired_size" {
  description = "Desired number of nodes at creation."
  type        = number
  default     = 3
}

variable "node_max_size" {
  description = "Maximum number of nodes."
  type        = number
  default     = 6
}

variable "tags" {
  description = "Tags added to every resource."
  type        = map(string)
  default     = {}
}
