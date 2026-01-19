# Resume AI - ECS (Elastic Container Service)
# ECS = Docker container'ları AWS'de çalıştırır
# Fargate = Serverless (EC2 sunucu yönetmene gerek yok)

# ============================================
# ECS CLUSTER
# ============================================
# Cluster = Container'ların grubu
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"

  # Container Insights = CloudWatch'ta metrikler göster (CPU, RAM vs.)
  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "${var.project_name}-cluster"
  }
}

# ============================================
# TASK DEFINITION - Backend
# ============================================
# Task Definition = "Nasıl bir container çalıştır?"
# (Docker Compose'a benzer)
resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.project_name}-backend"
  network_mode             = "awsvpc"  # Her task kendi IP'sine sahip
  requires_compatibilities = ["FARGATE"]  # Fargate kullan (serverless)
  cpu                      = "256"  # 0.25 vCPU (free tier)
  memory                   = "512"  # 0.5 GB RAM (free tier)
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn  # ECR'den çek, log yaz
  task_role_arn            = aws_iam_role.ecs_task.arn  # Container çalışırken kullanacağı role

  # Container definitions = Docker container'ların tanımı
  container_definitions = jsonencode([{
    name  = "backend"
    image = "${aws_ecr_repository.backend.repository_url}:latest"  # ECR'den latest image'ı çek

    # Port mapping
    portMappings = [{
      containerPort = 8000  # Container içindeki port
      protocol      = "tcp"
      hostPort      = 8000  # Fargate'de containerPort ile aynı olmalı
    }]

    # Environment variables - Normal değişkenler
    environment = []  # Şu an yok, gerekirse ekleriz

    # Secrets - Secrets Manager'dan çekilen değişkenler
    secrets = [
      {
        name      = "OPENAI_API_KEY"
        valueFrom = "${aws_secretsmanager_secret.api_keys.arn}:OPENAI_API_KEY::"
      },
      {
        name      = "GEMINI_API_KEY"
        valueFrom = "${aws_secretsmanager_secret.api_keys.arn}:GEMINI_API_KEY::"
      }
    ]

    # Logging configuration - CloudWatch'a log gönder
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.backend.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }

    # Health check (container seviyesi)
    healthCheck = {
      command     = ["CMD-SHELL", "curl -f http://localhost:8000/ping || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60  # Container başladıktan 60 saniye sonra health check başlasın
    }

    # Essential = Bu container ölürse tüm task ölsün
    essential = true
  }])

  tags = {
    Name    = "${var.project_name}-backend-task"
    Service = "backend"
  }
}

# ============================================
# TASK DEFINITION - Frontend
# ============================================
resource "aws_ecs_task_definition" "frontend" {
  family                   = "${var.project_name}-frontend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name  = "frontend"
    image = "${aws_ecr_repository.frontend.repository_url}:latest"

    portMappings = [{
      containerPort = 3000
      protocol      = "tcp"
      hostPort      = 3000
    }]

    # Environment variable - Frontend'in backend URL'ini bilmesi lazım
    environment = [
      {
        name  = "NEXT_PUBLIC_API_URL"
        value = "http://${aws_lb.main.dns_name}:8000"  # ALB'nin DNS'i
      }
    ]

    secrets = []  # Frontend'de secret yok

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.frontend.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }

    healthCheck = {
      command     = ["CMD-SHELL", "curl -f http://localhost:3000/ || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }

    essential = true
  }])

  tags = {
    Name    = "${var.project_name}-frontend-task"
    Service = "frontend"
  }
}

# ============================================
# ECS SERVICE - Backend
# ============================================
# Service = "Bu task'tan kaç tane çalıştır, nasıl yönet?"
resource "aws_ecs_service" "backend" {
  name            = "${var.project_name}-backend-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 1  # 1 container çalıştır (free tier için)
  launch_type     = "FARGATE"

  # Platform version - Fargate'in versiyonu
  platform_version = "LATEST"

  # Network configuration
  network_configuration {
    subnets          = [aws_subnet.public_1.id, aws_subnet.public_2.id]
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = true  # Public IP ver (internet erişimi için)
  }

  # Load Balancer'a bağla
  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 8000
  }

  # Service'i oluşturmadan önce listener'ı bekle
  depends_on = [aws_lb_listener.backend]

  tags = {
    Name    = "${var.project_name}-backend-service"
    Service = "backend"
  }
}

# ============================================
# ECS SERVICE - Frontend
# ============================================
resource "aws_ecs_service" "frontend" {
  name            = "${var.project_name}-frontend-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.frontend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  platform_version = "LATEST"

  network_configuration {
    subnets          = [aws_subnet.public_1.id, aws_subnet.public_2.id]
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.frontend.arn
    container_name   = "frontend"
    container_port   = 3000
  }

  depends_on = [aws_lb_listener.frontend]

  tags = {
    Name    = "${var.project_name}-frontend-service"
    Service = "frontend"
  }
}
