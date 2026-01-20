resource "aws_secretsmanager_secret" "api_keys" {
  name        = "${var.project_name}-api-keys"
  description = "API keys for Resume AI (OpenAI and Gemini)"

  recovery_window_in_days = 7

  tags = {
    Name = "${var.project_name}-api-keys"
  }
}

resource "aws_secretsmanager_secret_version" "api_keys" {
  secret_id = aws_secretsmanager_secret.api_keys.id

  secret_string = jsonencode({
    OPENAI_API_KEY = var.openai_api_key
    GEMINI_API_KEY = var.gemini_api_key
  })
}
