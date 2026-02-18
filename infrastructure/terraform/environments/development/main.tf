locals {
  instance_name           = "${var.project_name}-${var.environment_name}-api"
  managed_key_pair_name   = "${var.project_name}-${var.environment_name}-ssh"
  is_aws_lightsail        = var.compute_provider == "aws_lightsail"
  use_managed_ssh_key     = local.is_aws_lightsail && var.ssh_public_key_path != null
  effective_key_pair_name = local.use_managed_ssh_key ? aws_lightsail_key_pair.ssh[0].name : (local.is_aws_lightsail ? var.key_pair_name : null)
  deploy_ssh_public_key = trimspace(
    var.deploy_user_ssh_public_key != null
    ? var.deploy_user_ssh_public_key
    : (var.deploy_user_ssh_public_key_path != null ? file(var.deploy_user_ssh_public_key_path) : "")
  )
  baseline_tags = {
    Project     = var.project_name
    Environment = var.environment_name
    ManagedBy   = "terraform"
    Component   = "compute"
  }
  merged_tags = merge(local.baseline_tags, var.additional_tags)
  user_data = var.user_data_file_path == null ? null : templatefile(var.user_data_file_path, {
    DEPLOY_USER                   = var.deploy_user_name
    DEPLOY_SSH_PUBLIC_KEY_B64     = base64encode(local.deploy_ssh_public_key)
    DEPLOY_ENABLE_ROOTLESS_DOCKER = var.deploy_user_enable_rootless_docker ? "true" : "false"
  })
}

resource "aws_lightsail_key_pair" "ssh" {
  count = local.use_managed_ssh_key ? 1 : 0

  name       = local.managed_key_pair_name
  public_key = file(var.ssh_public_key_path)
  tags       = local.merged_tags
}

module "compute_api_server" {
  source = "../../modules/compute-instance-contract"

  provider_name            = var.compute_provider
  instance_name            = local.instance_name
  zone                     = var.availability_zone
  machine_image            = var.blueprint_id
  machine_size             = var.bundle_id
  network_stack            = var.ip_address_type
  ssh_key_name             = local.effective_key_pair_name
  static_public_ip_enabled = var.static_ip_enabled
  public_tcp_ports         = var.public_tcp_ports
  user_data                = local.user_data
  tags                     = local.merged_tags
}
