output "aws_region" {
  description = "AWS region used by this environment."
  value       = var.aws_region
}

output "lightsail_instance_name" {
  description = "Name of the deployed Lightsail instance."
  value       = module.compute_api_server.instance_name
}

output "lightsail_instance_public_ip_address" {
  description = "Ephemeral public IP reported by the instance resource."
  value       = module.compute_api_server.instance_public_ip_address
}

output "lightsail_static_ip_address" {
  description = "Static public IP attached to the instance when enabled."
  value       = module.compute_api_server.static_public_ip_address
}

output "lightsail_effective_key_pair_name" {
  description = "Key pair name used by the Lightsail instance."
  value       = local.effective_key_pair_name
}

output "lightsail_managed_key_pair_created" {
  description = "Whether Terraform created and manages the Lightsail key pair in this stack."
  value       = local.use_managed_ssh_key
}

output "compute_provider" {
  description = "Provider selected via compute contract."
  value       = var.compute_provider
}
