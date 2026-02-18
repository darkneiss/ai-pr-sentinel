variables {
  provider_name            = "aws_lightsail"
  instance_name            = "ai-pr-sentinel-development"
  zone                     = "us-east-1a"
  machine_image            = "debian_12"
  machine_size             = "small_3_0"
  network_stack            = "ipv4"
  ssh_key_name             = "test-key"
  static_public_ip_enabled = true
  public_tcp_ports         = [22, 80, 443]
  user_data                = null
  tags = {
    Project     = "ai-pr-sentinel"
    Environment = "development"
    ManagedBy   = "terraform"
  }
}

mock_provider "aws" {}

run "apply_with_aws_lightsail_provider" {
  command = apply

  assert {
    condition     = output.provider_name == var.provider_name
    error_message = "Contract module should expose the resolved provider_name."
  }

  assert {
    condition     = output.instance_name == var.instance_name
    error_message = "Contract module should expose the created instance name."
  }

  assert {
    condition     = output.connection_public_ip_address != null
    error_message = "Contract module should expose a connection endpoint."
  }
}

run "plan_with_reserved_but_unimplemented_provider_fails" {
  command = plan

  variables {
    provider_name = "gcp_compute_engine"
  }

  expect_failures = [var.provider_name]
}
