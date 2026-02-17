locals {
  static_ip_name          = "${var.instance_name}-static-ip"
  sorted_public_tcp_ports = sort(distinct(var.public_tcp_ports))
}

resource "aws_lightsail_instance" "this" {
  name              = var.instance_name
  availability_zone = var.availability_zone
  blueprint_id      = var.blueprint_id
  bundle_id         = var.bundle_id
  ip_address_type   = var.ip_address_type
  key_pair_name     = var.key_pair_name
  user_data         = var.user_data
  tags              = var.tags
}

resource "aws_lightsail_instance_public_ports" "this" {
  instance_name = aws_lightsail_instance.this.name

  lifecycle {
    replace_triggered_by = [aws_lightsail_instance.this.id]
  }

  dynamic "port_info" {
    for_each = local.sorted_public_tcp_ports
    content {
      protocol  = "tcp"
      from_port = port_info.value
      to_port   = port_info.value
    }
  }
}

resource "aws_lightsail_static_ip" "this" {
  count = var.static_ip_enabled ? 1 : 0

  name = local.static_ip_name
}

resource "aws_lightsail_static_ip_attachment" "this" {
  count = var.static_ip_enabled ? 1 : 0

  static_ip_name = aws_lightsail_static_ip.this[0].name
  instance_name  = aws_lightsail_instance.this.name

  lifecycle {
    replace_triggered_by = [aws_lightsail_instance.this.id]
  }
}
