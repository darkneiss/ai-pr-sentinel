terraform {
  required_version = ">= 1.6.0"

  cloud {
    organization = "darkneiss"

    workspaces {
      name = "aisentinel"
    }
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
