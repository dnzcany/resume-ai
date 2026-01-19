# Resume AI - AWS Secrets Manager
# API key'leri güvenli saklamak için (OPTIONAL - fallback keys)
#
# NOT: Bu key'ler OPSIYONEL! Kullanıcılar frontend UI'dan kendi key'lerini girebilir.
# Buradaki key'ler sadece fallback olarak kullanılır.
# Placeholder değerler de kullanabilirsin.

# ============================================
# SECRET - API Keys Container
# ============================================
# Bu bir "secret" oluşturur (şifreli depo)
resource "aws_secretsmanager_secret" "api_keys" {
  name        = "${var.project_name}-api-keys"
  description = "API keys for Resume AI (OpenAI and Gemini)"

  # Recovery window = Silersen 30 gün bekle, sonra gerçekten sil
  # (Yanlışlıkla silmeyi önler)
  recovery_window_in_days = 7

  tags = {
    Name = "${var.project_name}-api-keys"
  }
}

# ============================================
# SECRET VERSION - Actual Values
# ============================================
# Secret'ın içine değerleri koy
# JSON formatında saklanır
resource "aws_secretsmanager_secret_version" "api_keys" {
  secret_id = aws_secretsmanager_secret.api_keys.id

  # Secret string = JSON objesi
  # ECS task definition buradan çekecek
  secret_string = jsonencode({
    OPENAI_API_KEY = var.openai_api_key  # terraform.tfvars'tan geliyor
    GEMINI_API_KEY = var.gemini_api_key  # terraform.tfvars'tan geliyor
  })
}
