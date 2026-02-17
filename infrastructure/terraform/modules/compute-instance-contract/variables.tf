variable "provider_name" {
  description = "Target compute provider implementation. Reserved values enable future providers under the same contract."
  type        = string
  default     = "aws_lightsail"

  validation {
    condition     = contains(["aws_lightsail", "gcp_compute_engine"], var.provider_name)
    error_message = "provider_name must be one of: aws_lightsail, gcp_compute_engine."
  }

  validation {
    condition     = contains(["aws_lightsail"], var.provider_name)
    error_message = "The selected provider_name is not implemented yet in this repository. Currently implemented: aws_lightsail."
  }
}

variable "instance_name" {
  description = "Provider-agnostic compute instance name."
  type        = string

  validation {
    condition     = length(trimspace(var.instance_name)) > 0
    error_message = "instance_name must not be empty."
  }
}

variable "zone" {
  description = "Provider-specific zone where the compute instance is created."
  type        = string

  validation {
    condition     = length(trimspace(var.zone)) > 0
    error_message = "zone must not be empty."
  }
}

variable "machine_image" {
  description = "Provider-specific machine image id (for AWS Lightsail this maps to blueprint_id)."
  type        = string

  validation {
    condition     = length(trimspace(var.machine_image)) > 0
    error_message = "machine_image must not be empty."
  }
}

variable "machine_size" {
  description = "Provider-specific machine size id (for AWS Lightsail this maps to bundle_id)."
  type        = string

  validation {
    condition     = length(trimspace(var.machine_size)) > 0
    error_message = "machine_size must not be empty."
  }
}

variable "network_stack" {
  description = "IP stack mode. Allowed values: dualstack, ipv4, ipv6."
  type        = string
  default     = "ipv4"

  validation {
    condition     = contains(["dualstack", "ipv4", "ipv6"], var.network_stack)
    error_message = "network_stack must be one of: dualstack, ipv4, ipv6."
  }
}

variable "ssh_key_name" {
  description = "Provider-specific SSH key identifier associated to the compute instance."
  type        = string
  default     = null
}

variable "static_public_ip_enabled" {
  description = "Whether to allocate and attach a static public IP."
  type        = bool
  default     = true
}

variable "public_tcp_ports" {
  description = "Public TCP ports exposed on the compute firewall."
  type        = list(number)
  default     = [22, 80, 443]

  validation {
    condition = alltrue([
      for port in var.public_tcp_ports : port >= 1 && port <= 65535
    ])
    error_message = "Every public_tcp_ports value must be between 1 and 65535."
  }

  validation {
    condition     = length(var.public_tcp_ports) == length(distinct(var.public_tcp_ports))
    error_message = "public_tcp_ports must not contain duplicate values."
  }
}

variable "user_data" {
  description = "Cloud-init compatible script executed on first boot."
  type        = string
  default     = null
}

variable "tags" {
  description = "Tags applied to compute resources."
  type        = map(string)
  default     = {}
}
