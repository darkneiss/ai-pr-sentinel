locals {
  is_aws_lightsail = var.provider_name == "aws_lightsail"
}

module "aws_lightsail" {
  count  = local.is_aws_lightsail ? 1 : 0
  source = "../lightsail-instance"

  instance_name     = var.instance_name
  availability_zone = var.zone
  blueprint_id      = var.machine_image
  bundle_id         = var.machine_size
  ip_address_type   = var.network_stack
  key_pair_name     = var.ssh_key_name
  static_ip_enabled = var.static_public_ip_enabled
  public_tcp_ports  = var.public_tcp_ports
  user_data         = var.user_data
  tags              = var.tags
}
