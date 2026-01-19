# Resume AI - VPC and Networking
# VPC = Virtual Private Cloud (AWS'de özel network alanımız)

# ============================================
# VPC (Virtual Private Cloud)
# ============================================
# Bu bizim özel network alanımız
# IP aralığı: 10.0.0.0/16 (10.0.0.0 - 10.0.255.255 arası 65,536 IP)
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true  # EC2'lere DNS hostname ver (örn: ec2-xx-xx.compute.amazonaws.com)
  enable_dns_support   = true  # DNS resolution aktif

  tags = {
    Name = "${var.project_name}-vpc"
  }
}

# ============================================
# PUBLIC SUBNETS (2 adet - farklı availability zones'larda)
# ============================================
# ALB (Load Balancer) için en az 2 AZ'de subnet gerekli
# Public = İnternet erişimi var

# Subnet 1 - us-east-1a (Virginia'nın ilk availability zone'u)
resource "aws_subnet" "public_1" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"  # 10.0.1.0 - 10.0.1.255 (256 IP)
  availability_zone       = data.aws_availability_zones.available.names[0]  # us-east-1a
  map_public_ip_on_launch = true  # Bu subnet'teki EC2'lere otomatik public IP ver

  tags = {
    Name = "${var.project_name}-public-subnet-1"
  }
}

# Subnet 2 - us-east-1b (Virginia'nın ikinci availability zone'u)
resource "aws_subnet" "public_2" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.2.0/24"  # 10.0.2.0 - 10.0.2.255 (256 IP)
  availability_zone       = data.aws_availability_zones.available.names[1]  # us-east-1b
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-public-subnet-2"
  }
}

# ============================================
# INTERNET GATEWAY
# ============================================
# VPC'nin internete çıkış kapısı
# Bu olmadan dışarıyla iletişim kuramayız
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-igw"
  }
}

# ============================================
# ROUTE TABLE (Trafik Yönlendirme Tablosu)
# ============================================
# "10.0.0.0/16 dışına giden her şey Internet Gateway'den çıksın"
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  # Route = Yönlendirme kuralı
  route {
    cidr_block = "0.0.0.0/0"                       # Tüm internet trafiği
    gateway_id = aws_internet_gateway.main.id      # Internet Gateway'den çık
  }

  tags = {
    Name = "${var.project_name}-public-route-table"
  }
}

# Route Table'ı subnet'lere bağla
resource "aws_route_table_association" "public_1" {
  subnet_id      = aws_subnet.public_1.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_2" {
  subnet_id      = aws_subnet.public_2.id
  route_table_id = aws_route_table.public.id
}

# ============================================
# SECURITY GROUP - ALB (Load Balancer için)
# ============================================
# Security Group = Firewall kuralları
# ALB'nin hangi portlardan trafik alabileceğini belirler
resource "aws_security_group" "alb" {
  name        = "${var.project_name}-alb-sg"
  description = "Security group for Application Load Balancer"
  vpc_id      = aws_vpc.main.id

  # INGRESS = Gelen trafik kuralları
  # Port 80 (HTTP) - Frontend için
  ingress {
    description = "HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # Her yerden kabul et
  }

  # Port 8000 (HTTP) - Backend API için
  ingress {
    description = "Backend API from internet"
    from_port   = 8000
    to_port     = 8000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # Her yerden kabul et
  }

  # EGRESS = Giden trafik kuralları
  # Her yere her şeyi gönderebilir
  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"           # -1 = Tüm protokoller
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-alb-sg"
  }
}

# ============================================
# SECURITY GROUP - ECS Tasks (Container'lar için)
# ============================================
# Container'ların hangi portlardan trafik alabileceğini belirler
resource "aws_security_group" "ecs_tasks" {
  name        = "${var.project_name}-ecs-tasks-sg"
  description = "Security group for ECS tasks"
  vpc_id      = aws_vpc.main.id

  # Port 3000 - Frontend container
  # Sadece ALB'den gelen trafiği kabul et (güvenlik için)
  ingress {
    description     = "Frontend port from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]  # Sadece ALB'den
  }

  # Port 8000 - Backend container
  # Sadece ALB'den gelen trafiği kabul et
  ingress {
    description     = "Backend port from ALB"
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]  # Sadece ALB'den
  }

  # Giden trafik - Her yere izin ver (API çağrıları, database vs. için)
  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-ecs-tasks-sg"
  }
}
