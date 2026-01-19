# Resume AI - Application Load Balancer (ALB)
# ALB = Gelen trafiği container'lara dağıtır
# Neden gerekli? Container'ların IP'si sürekli değişir, ALB sabit bir DNS verir

# ============================================
# APPLICATION LOAD BALANCER
# ============================================
resource "aws_lb" "main" {
  name               = "${var.project_name}-alb"
  internal           = false  # false = İnternetten erişilebilir (public)
  load_balancer_type = "application"  # HTTP/HTTPS için
  security_groups    = [aws_security_group.alb.id]
  subnets            = [aws_subnet.public_1.id, aws_subnet.public_2.id]  # En az 2 AZ gerekli

  enable_deletion_protection = false  # true = Yanlışlıkla silinmeyi engelle (production'da true yap)

  tags = {
    Name = "${var.project_name}-alb"
  }
}

# ============================================
# TARGET GROUP - Frontend (Port 3000)
# ============================================
# Target Group = "Bu gruba trafik gönder"
# Frontend container'ları bu grupta
resource "aws_lb_target_group" "frontend" {
  name        = "${var.project_name}-frontend-tg"
  port        = 3000  # Container'ın portu
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"  # Fargate'de IP bazlı routing kullanılır

  # Health Check = "Container sağlıklı mı?" kontrolü
  # ALB her 30 saniyede "/" adresine GET ister
  # 200 dönerse sağlıklı, değilse container'ı trafikten çıkar
  health_check {
    enabled             = true
    healthy_threshold   = 2      # 2 kere başarılı olursa sağlıklı
    interval            = 30      # 30 saniyede bir kontrol
    matcher             = "200"   # HTTP 200 OK bekliyoruz
    path                = "/"     # Ana sayfa
    port                = "traffic-port"  # Container'ın portu (3000)
    protocol            = "HTTP"
    timeout             = 5       # 5 saniye bekle
    unhealthy_threshold = 2       # 2 kere başarısız olursa sağlıksız
  }

  # Deregistration delay = Container silinince trafiği hemen kesme, 30 saniye bekle
  deregistration_delay = 30

  tags = {
    Name    = "${var.project_name}-frontend-tg"
    Service = "frontend"
  }
}

# ============================================
# TARGET GROUP - Backend (Port 8000)
# ============================================
resource "aws_lb_target_group" "backend" {
  name        = "${var.project_name}-backend-tg"
  port        = 8000  # Backend container'ın portu
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  # Health Check
  # Backend'de /ping endpoint'i var (main.py'de tanımlı)
  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/ping"  # Backend'deki health check endpoint'i
    port                = "traffic-port"  # 8000
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }

  deregistration_delay = 30

  tags = {
    Name    = "${var.project_name}-backend-tg"
    Service = "backend"
  }
}

# ============================================
# LISTENER - Port 80 (Frontend)
# ============================================
# Listener = "Bu porta gelen trafiği dinle"
# Port 80 → Frontend Target Group'a yönlendir
resource "aws_lb_listener" "frontend" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  # Default action = Tüm trafiği frontend'e gönder
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }

  tags = {
    Name = "${var.project_name}-frontend-listener"
  }
}

# ============================================
# LISTENER - Port 8000 (Backend)
# ============================================
# Port 8000 → Backend Target Group'a yönlendir
resource "aws_lb_listener" "backend" {
  load_balancer_arn = aws_lb.main.arn
  port              = 8000
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  tags = {
    Name = "${var.project_name}-backend-listener"
  }
}
