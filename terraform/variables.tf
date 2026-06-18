variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "ap-south-1"
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
  default     = "Jagadish-cricket-auction"
}
