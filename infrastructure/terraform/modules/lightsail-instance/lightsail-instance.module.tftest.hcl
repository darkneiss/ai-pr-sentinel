variables {
  instance_name     = "ai-pr-sentinel-development"
  availability_zone = "us-east-1a"
  blueprint_id      = "debian_12"
  bundle_id         = "small_3_0"
  ip_address_type   = "dualstack"
  static_ip_enabled = true
  public_tcp_ports  = [22, 80, 443]
  user_data         = null
  tags = {
    Project     = "ai-pr-sentinel"
    Environment = "development"
    ManagedBy   = "terraform"
  }
}

mock_provider "aws" {}

run "apply_with_default_static_ip" {
  command = apply

  assert {
    condition     = aws_lightsail_instance.this.name == var.instance_name
    error_message = "Lightsail instance name must match input variable."
  }

  assert {
    condition     = aws_lightsail_instance.this.ip_address_type == var.ip_address_type
    error_message = "Lightsail instance IP address type must match input variable."
  }

  assert {
    condition     = length(aws_lightsail_static_ip.this) == 1
    error_message = "Static IP should be created by default."
  }

  assert {
    condition     = aws_lightsail_instance_public_ports.this.instance_name == var.instance_name
    error_message = "Public ports resource should target the created instance."
  }

  assert {
    condition     = length(aws_lightsail_instance_public_ports.this.port_info) == length(var.public_tcp_ports)
    error_message = "Public ports resource should include one firewall rule per input port."
  }
}

run "plan_without_static_ip" {
  command = plan

  variables {
    static_ip_enabled = false
  }

  assert {
    condition     = length(aws_lightsail_static_ip.this) == 0
    error_message = "Static IP should not be created when disabled."
  }

  assert {
    condition     = length(aws_lightsail_static_ip_attachment.this) == 0
    error_message = "Static IP attachment should not be created when static IP is disabled."
  }
}
