variables {
  aws_region          = "eu-west-3"
  project_name        = "ai-pr-sentinel"
  compute_provider    = "aws_lightsail"
  environment_name    = "development"
  availability_zone   = "eu-west-3a"
  blueprint_id        = "debian_12"
  bundle_id           = "small_3_0"
  ip_address_type     = "ipv4"
  static_ip_enabled   = true
  public_tcp_ports    = [22, 80, 443]
  user_data_file_path = null
  additional_tags = {
    Owner = "platform-team"
  }
}

mock_provider "aws" {}

run "apply_with_managed_key_pair" {
  command = apply

  variables {
    key_pair_name       = null
    ssh_public_key_path = "./test-fixtures/id_ed25519.pub"
  }

  assert {
    condition     = length(aws_lightsail_key_pair.ssh) == 1
    error_message = "Managed Lightsail key pair should be created when ssh_public_key_path is provided."
  }

  assert {
    condition     = output.lightsail_effective_key_pair_name == aws_lightsail_key_pair.ssh[0].name
    error_message = "Development stack should expose the managed key pair as effective key pair."
  }

  assert {
    condition     = output.lightsail_managed_key_pair_created
    error_message = "Managed key pair flag should be true when ssh_public_key_path is provided."
  }
}

run "plan_with_existing_key_pair" {
  command = plan

  variables {
    key_pair_name       = "existing-lightsail-key"
    ssh_public_key_path = null
  }

  assert {
    condition     = length(aws_lightsail_key_pair.ssh) == 0
    error_message = "Managed key pair should not be created when ssh_public_key_path is null."
  }

  assert {
    condition     = output.lightsail_effective_key_pair_name == var.key_pair_name
    error_message = "Development stack should expose the external key pair as effective key pair."
  }

  assert {
    condition     = !output.lightsail_managed_key_pair_created
    error_message = "Managed key pair flag should be false when ssh_public_key_path is null."
  }
}

run "plan_with_bootstrap_without_deploy_key_fails" {
  command = plan

  variables {
    key_pair_name                   = "existing-lightsail-key"
    ssh_public_key_path             = null
    user_data_file_path             = "./user-data/bootstrap.sh"
    deploy_user_ssh_public_key      = null
    deploy_user_ssh_public_key_path = null
  }

  expect_failures = [var.deploy_user_ssh_public_key_path]
}

run "plan_with_reserved_provider_fails" {
  command = plan

  variables {
    compute_provider = "gcp_compute_engine"
  }

  expect_failures = [var.compute_provider]
}
