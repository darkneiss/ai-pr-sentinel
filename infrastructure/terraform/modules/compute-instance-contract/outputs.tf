output "provider_name" {
  description = "Resolved compute provider implementation."
  value       = var.provider_name
}

output "instance_name" {
  description = "Deployed compute instance name."
  value       = local.is_aws_lightsail ? module.aws_lightsail[0].instance_name : null
}

output "instance_public_ip_address" {
  description = "Ephemeral public IP assigned by the compute provider."
  value       = local.is_aws_lightsail ? module.aws_lightsail[0].instance_public_ip_address : null
}

output "static_public_ip_name" {
  description = "Static public IP name when static_public_ip_enabled=true."
  value       = local.is_aws_lightsail ? module.aws_lightsail[0].static_ip_name : null
}

output "static_public_ip_address" {
  description = "Static public IP address when static_public_ip_enabled=true."
  value       = local.is_aws_lightsail ? module.aws_lightsail[0].static_ip_address : null
}

output "connection_public_ip_address" {
  description = "Best public endpoint for SSH/HTTP. Prefers static IP when available."
  value = local.is_aws_lightsail ? coalesce(
    module.aws_lightsail[0].static_ip_address,
    module.aws_lightsail[0].instance_public_ip_address
  ) : null
}
