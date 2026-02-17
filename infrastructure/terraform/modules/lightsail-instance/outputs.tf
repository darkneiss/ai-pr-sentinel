output "instance_name" {
  description = "Lightsail instance name."
  value       = aws_lightsail_instance.this.name
}

output "instance_arn" {
  description = "Lightsail instance ARN."
  value       = aws_lightsail_instance.this.arn
}

output "instance_public_ip_address" {
  description = "Ephemeral public IP assigned by Lightsail to the instance."
  value       = aws_lightsail_instance.this.public_ip_address
}

output "static_ip_name" {
  description = "Name of the allocated static IP when enabled."
  value       = var.static_ip_enabled ? aws_lightsail_static_ip.this[0].name : null
}

output "static_ip_address" {
  description = "Static public IP address when enabled."
  value       = var.static_ip_enabled ? aws_lightsail_static_ip.this[0].ip_address : null
}
