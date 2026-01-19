# Resume AI - IAM Roles and Policies
# IAM = Identity and Access Management
# "Bu container hangi AWS servislerine erişebilir?" kuralları

# ============================================
# ECS TASK EXECUTION ROLE
# ============================================
# Bu role: ECS'nin container'ı başlatmak için kullandığı role
# Yaptığı işler:
# - ECR'den Docker image çek
# - CloudWatch'a log yaz
# - Secrets Manager'dan secret oku

# Role oluştur
resource "aws_iam_role" "ecs_task_execution" {
  name = "${var.project_name}-ecs-task-execution-role"

  # Assume role policy = "Bu role'ü kim kullanabilir?"
  # Cevap: ECS servisi (ecs-tasks.amazonaws.com)
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
    }]
  })

  tags = {
    Name = "${var.project_name}-ecs-task-execution-role"
  }
}

# AWS'nin hazır policy'sini attach et
# Bu policy şunları yapabilir:
# - ECR'den image çek
# - CloudWatch'a log yaz
resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Ek policy: Secrets Manager'dan secret okuma yetkisi
resource "aws_iam_role_policy" "ecs_secrets" {
  name = "${var.project_name}-ecs-secrets-policy"
  role = aws_iam_role.ecs_task_execution.id

  # Policy document = "Bu role ne yapabilir?"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue"  # Secret'ı oku
      ]
      Resource = [
        aws_secretsmanager_secret.api_keys.arn  # Sadece bizim secret'ı
      ]
    }]
  })
}

# ============================================
# ECS TASK ROLE
# ============================================
# Bu role: Container'ın ÇALIŞIRKEN kullandığı role
# Örnek: Container içinden S3'e dosya yüklemek istersen bu role'e izin eklersin
# Şu an boş (gerekirse ekleriz)

resource "aws_iam_role" "ecs_task" {
  name = "${var.project_name}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
    }]
  })

  tags = {
    Name = "${var.project_name}-ecs-task-role"
  }
}

# Şu an bu role'e özel policy yok
# Gerekirse buraya ekleyebiliriz (S3, DynamoDB vs.)
