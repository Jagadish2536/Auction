variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "ap-south-2"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "jagadishvarma.xyz"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.medium"
}

variable "key_name" {
  description = "SSH key pair name"
  type        = string
  default     = "jv-cricket-key"
}

variable "db_password" {
  description = "PostgreSQL database password"
  type        = string
  sensitive   = true
  default     = "change-this-password"
}

variable "project_name" {
  description = "Project name for resource tagging"
  type        = string
  default     = "jv-cricket-auction"
}

variable "manager_email" {
  description = "Manager account email"
  type        = string
  default     = "jagadishvarma99@gmail.com"
}

variable "manager_password" {
  description = "Manager account password"
  type        = string
  sensitive   = true
  default     = "change-this-password"
}

variable "jwt_secret" {
  description = "JWT secret key"
  type        = string
  sensitive   = true
  default     = "change-this-jwt-secret"
}

variable "app_secret" {
  description = "Flask secret key"
  type        = string
  sensitive   = true
  default     = "change-this-app-secret"
}

variable "enable_dns" {
  description = "Set to true to create Route53 records and ACM certificate (requires existing hosted zone)"
  type        = bool
  default     = false
}
