variable "instance_name" {
  description = "Name of the Lightsail instance."
  type        = string

  validation {
    condition     = length(trimspace(var.instance_name)) > 0
    error_message = "instance_name must not be empty."
  }
}

variable "availability_zone" {
  description = "AWS availability zone where the instance will be created (for example: us-east-1a)."
  type        = string

  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-[0-9][a-z]$", var.availability_zone))
    error_message = "availability_zone must follow the AWS availability zone format, for example us-east-1a."
  }
}

variable "blueprint_id" {
  description = "Lightsail blueprint id (for example: debian_12)."
  type        = string
}

variable "bundle_id" {
  description = "Lightsail bundle id (for example: micro_3_0)."
  type        = string
}

variable "ip_address_type" {
  description = "Lightsail networking mode. Allowed values: dualstack, ipv4, ipv6."
  type        = string
  default     = "dualstack"

  validation {
    condition     = contains(["dualstack", "ipv4", "ipv6"], var.ip_address_type)
    error_message = "ip_address_type must be one of: dualstack, ipv4, ipv6."
  }
}

variable "key_pair_name" {
  description = "Existing Lightsail key pair name used for SSH. Set null to skip association."
  type        = string
  default     = null
}

variable "static_ip_enabled" {
  description = "Whether to allocate and attach a static public IP to the instance."
  type        = bool
  default     = true
}

variable "public_tcp_ports" {
  description = "List of TCP ports to expose publicly through Lightsail firewall."
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
  description = "Cloud-init compatible script executed on first boot. Set null to disable bootstrap."
  type        = string
  default     = null
}

variable "tags" {
  description = "Tags applied to Lightsail resources."
  type        = map(string)
  default     = {}
}
