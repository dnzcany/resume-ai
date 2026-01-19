# Resume AI - Terraform Variables
# Bu dosya: Tüm değişkenleri tanımlıyoruz (değerler terraform.tfvars'tan gelecek)

# AWS Region - Hangi bölgede deploy edeceğiz?
variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"  # Virginia (en ucuz ve en popüler)
}

# Project name - Kaynaklara isim verirken kullanılacak
variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "resume-ai"
}

# Environment - production, staging, development
variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

# OpenAI API Key - OPTIONAL (users enter in UI)
variable "openai_api_key" {
  description = "OpenAI API key - OPTIONAL: Users can enter their own key in frontend UI"
  type        = string
  sensitive   = true  # Bu değer log'larda gözükmez (güvenlik)
}

# Google Gemini API Key - OPTIONAL (users enter in UI)
variable "gemini_api_key" {
  description = "Gemini API key - OPTIONAL: Users can enter their own key in frontend UI"
  type        = string
  sensitive   = true  # Bu değer log'larda gözükmez
}

# Fargate'i aktif etmek ister misin? (debugging için false yapabilirsin)
variable "enable_fargate" {
  description = "Enable ECS Fargate deployment"
  type        = bool
  default     = true
}
