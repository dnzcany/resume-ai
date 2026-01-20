variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "resume-ai"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "openai_api_key" {
  description = "OpenAI API key - OPTIONAL: Users can enter their own key in frontend UI"
  type        = string
  sensitive   = true
}

variable "gemini_api_key" {
  description = "Gemini API key - OPTIONAL: Users can enter their own key in frontend UI"
  type        = string
  sensitive   = true
}

variable "enable_fargate" {
  description = "Enable ECS Fargate deployment"
  type        = bool
  default     = true
}
