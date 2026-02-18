variable "aws_region" {
  description = "AWS region where Lightsail resources are deployed."
  type        = string
  default     = "eu-west-3"

  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-[0-9]$", var.aws_region))
    error_message = "aws_region must follow the AWS region format, for example us-east-1."
  }
}

variable "project_name" {
  description = "Project identifier used in resource names and tags."
  type        = string
  default     = "ai-pr-sentinel"

  validation {
    condition     = length(trimspace(var.project_name)) > 0
    error_message = "project_name must not be empty."
  }
}

variable "compute_provider" {
  description = "Compute provider selected through the provider-agnostic Terraform contract."
  type        = string
  default     = "aws_lightsail"

  validation {
    condition     = contains(["aws_lightsail", "gcp_compute_engine"], var.compute_provider)
    error_message = "compute_provider must be one of: aws_lightsail, gcp_compute_engine."
  }

  validation {
    condition     = contains(["aws_lightsail"], var.compute_provider)
    error_message = "Selected compute_provider is reserved but not implemented yet in this environment. Currently implemented: aws_lightsail."
  }
}

variable "environment_name" {
  description = "Environment identifier used in names and tags."
  type        = string
  default     = "development"

  validation {
    condition     = length(trimspace(var.environment_name)) > 0
    error_message = "environment_name must not be empty."
  }
}

variable "availability_zone" {
  description = "AWS availability zone for the Lightsail instance."
  type        = string
  default     = "eu-west-3a"

  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-[0-9][a-z]$", var.availability_zone))
    error_message = "availability_zone must follow the AWS availability zone format, for example us-east-1a."
  }
}

variable "blueprint_id" {
  description = "Lightsail blueprint id."
  type        = string
  default     = "debian_12"
}

variable "bundle_id" {
  description = "Lightsail bundle id."
  type        = string
  default     = "small_3_0"
}

variable "ip_address_type" {
  description = "Lightsail networking mode. Allowed values: dualstack, ipv4, ipv6."
  type        = string
  default     = "ipv4"

  validation {
    condition     = contains(["dualstack", "ipv4", "ipv6"], var.ip_address_type)
    error_message = "ip_address_type must be one of: dualstack, ipv4, ipv6."
  }
}

variable "key_pair_name" {
  description = "Existing Lightsail key pair for SSH access. Use null when ssh_public_key_path is provided."
  type        = string
  default     = null
}

variable "ssh_public_key_path" {
  description = "Absolute or environment-relative path to an SSH public key (.pub) for automatic Lightsail key pair creation."
  type        = string
  default     = null

  validation {
    condition     = var.ssh_public_key_path == null || fileexists(var.ssh_public_key_path)
    error_message = "ssh_public_key_path must point to an existing public key file or be null."
  }

  validation {
    condition     = !(var.ssh_public_key_path != null && var.key_pair_name != null)
    error_message = "Set only one of ssh_public_key_path or key_pair_name."
  }
}

variable "deploy_user_name" {
  description = "Unprivileged user created for application deployments."
  type        = string
  default     = "deploy"

  validation {
    condition     = can(regex("^[a-z_][a-z0-9_-]{0,31}$", var.deploy_user_name))
    error_message = "deploy_user_name must be a valid Linux username."
  }
}

variable "deploy_user_ssh_public_key" {
  description = "Optional inline SSH public key for the deploy user. Prefer this in CI via TF_VAR_deploy_user_ssh_public_key."
  type        = string
  default     = null
  sensitive   = true

  validation {
    condition     = var.deploy_user_ssh_public_key == null || length(trimspace(var.deploy_user_ssh_public_key)) > 0
    error_message = "deploy_user_ssh_public_key cannot be an empty string when set."
  }

  validation {
    condition     = var.deploy_user_ssh_public_key == null || can(regex("^ssh-(rsa|ed25519|ecdsa-[a-z0-9-]+)\\s+", trimspace(var.deploy_user_ssh_public_key)))
    error_message = "deploy_user_ssh_public_key must look like a valid SSH public key."
  }
}

variable "deploy_user_ssh_public_key_path" {
  description = "Optional path to an SSH public key (.pub) for the deploy user."
  type        = string
  default     = null

  validation {
    condition     = var.deploy_user_ssh_public_key_path == null || fileexists(var.deploy_user_ssh_public_key_path)
    error_message = "deploy_user_ssh_public_key_path must point to an existing public key file or be null."
  }

  validation {
    condition     = !(var.deploy_user_ssh_public_key_path != null && var.deploy_user_ssh_public_key != null)
    error_message = "Set only one of deploy_user_ssh_public_key_path or deploy_user_ssh_public_key."
  }

  validation {
    condition     = var.user_data_file_path == null || var.deploy_user_ssh_public_key_path != null || var.deploy_user_ssh_public_key != null
    error_message = "When user_data_file_path is set, define deploy_user_ssh_public_key_path or deploy_user_ssh_public_key."
  }
}

variable "deploy_user_enable_rootless_docker" {
  description = "Whether bootstrap should configure rootless Docker for the deploy user."
  type        = bool
  default     = true
}

variable "static_ip_enabled" {
  description = "Whether a static public IP is allocated and attached."
  type        = bool
  default     = true
}

variable "public_tcp_ports" {
  description = "TCP ports that will be opened on the Lightsail firewall."
  type        = list(number)
  default     = [22, 80, 443]
}

variable "user_data_file_path" {
  description = "Optional path to a user_data script. If null, no bootstrap script is executed."
  type        = string
  default     = null

  validation {
    condition     = var.user_data_file_path == null || fileexists(var.user_data_file_path)
    error_message = "user_data_file_path must point to an existing file or be null."
  }
}

variable "additional_tags" {
  description = "Extra tags merged with baseline tags."
  type        = map(string)
  default     = {}
}
