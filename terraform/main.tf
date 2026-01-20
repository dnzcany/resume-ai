# Main Terraform configuration file

# Terraform version and required providers
terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"  # AWS provider version 5.x
    }
  }
}

# AWS Provider configuration
provider "aws" {
  region = var.aws_region  # AWS region (us-east-1, eu-west-1, etc.)

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}
