# Resume AI - CloudWatch Log Groups
# CloudWatch = AWS'nin logging servisi
# Container'ların console.log(), print() çıktıları buraya gider

# ============================================
# LOG GROUP - Backend
# ============================================
# Backend container'ının logları burada
# Örnek: FastAPI'nin print() çıktıları, uvicorn logları
resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${var.project_name}-backend"
  retention_in_days = 7  # 7 gün sakla, sonra sil (maliyet için)

  tags = {
    Name    = "${var.project_name}-backend-logs"
    Service = "backend"
  }
}

# ============================================
# LOG GROUP - Frontend
# ============================================
# Frontend container'ının logları burada
# Örnek: Next.js build logları, request logları
resource "aws_cloudwatch_log_group" "frontend" {
  name              = "/ecs/${var.project_name}-frontend"
  retention_in_days = 7  # 7 gün sakla

  tags = {
    Name    = "${var.project_name}-frontend-logs"
    Service = "frontend"
  }
}

# Logları görmek için:
# AWS Console → CloudWatch → Log groups → /ecs/resume-ai-backend
# Veya CLI: aws logs tail /ecs/resume-ai-backend --follow
