# Resume AI - Amazon ECR (Elastic Container Registry)
# ECR = Docker Hub'ın AWS versiyonu
# Burada Docker image'larımızı saklıyoruz

# Backend için ECR repository
resource "aws_ecr_repository" "backend" {
  name                 = "${var.project_name}-backend"  # İsim: resume-ai-backend
  image_tag_mutability = "MUTABLE"                       # Tag'leri değiştirebiliriz (latest update olabilir)

  # Her push'ta otomatik güvenlik taraması yap
  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Service = "backend"
  }
}

# Frontend için ECR repository
resource "aws_ecr_repository" "frontend" {
  name                 = "${var.project_name}-frontend"  # İsim: resume-ai-frontend
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Service = "frontend"
  }
}

# Backend için lifecycle policy
# Amaç: Eski image'ları sil, storage maliyetini azalt
resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 3 images only"  # Sadece son 3 image'ı tut

      selection = {
        tagStatus   = "any"                      # Her tag
        countType   = "imageCountMoreThan"       # Sayı 3'ten fazlaysa
        countNumber = 3
      }

      action = {
        type = "expire"  # Eskileri sil
      }
    }]
  })
}

# Frontend için lifecycle policy
resource "aws_ecr_lifecycle_policy" "frontend" {
  repository = aws_ecr_repository.frontend.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 3 images only"

      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 3
      }

      action = {
        type = "expire"
      }
    }]
  })
}
