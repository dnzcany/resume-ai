# AWS Deployment Guide

Resume AI deployed on AWS using Terraform Infrastructure as Code.

## Architecture

```
                        ┌─────────────┐
                        │   Internet  │
                        └──────┬──────┘
                               │
                    ┌──────────▼──────────┐
                    │  Application Load   │
                    │     Balancer        │
                    │  (Port 80 & 8000)   │
                    └──────────┬──────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
      ┌───────▼────────┐               ┌───────▼────────┐
      │  ECS Fargate   │               │  ECS Fargate   │
      │   Frontend     │               │    Backend     │
      │                │               │                │
      │   Next.js      │               │    FastAPI     │
      │   Port 3000    │               │    Port 8000   │
      │   0.25 vCPU    │               │    0.25 vCPU   │
      │   512 MB RAM   │               │    512 MB RAM  │
      └────────────────┘               └───────┬────────┘
                                               │
                                      ┌────────▼─────────┐
                                      │ Secrets Manager  │
                                      │  • OpenAI Key    │
                                      │  • Gemini Key    │
                                      └──────────────────┘
```

**AWS Services:**
- **ECS Fargate**: Serverless container orchestration
- **ECR**: Docker image registry
- **ALB**: Load balancer (HTTP traffic)
- **VPC**: Virtual network (2 availability zones)
- **Secrets Manager**: Encrypted API key storage
- **CloudWatch**: Logging and monitoring
- **IAM**: Access control and permissions

## Prerequisites

- AWS account with CLI configured
- Terraform >= 1.0
- Docker installed

## Quick Deploy

### 1. Configure

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your API keys (OPTIONAL)
```

**Note:** API keys in `terraform.tfvars` are OPTIONAL. Users can enter their own API keys in the frontend UI. If you don't want to store keys in Secrets Manager, use placeholder values.

### 2. Deploy Infrastructure

```bash
terraform init
terraform plan
terraform apply
```

⏱️ Deployment time: ~10-15 minutes

### 3. Push Docker Images

```bash
# Get repository URLs
export BACKEND_ECR=$(terraform output -raw ecr_backend_repository_url)
export FRONTEND_ECR=$(terraform output -raw ecr_frontend_repository_url)
export AWS_ACCOUNT=$(echo $BACKEND_ECR | cut -d'.' -f1)

# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $AWS_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com

# Build and push backend
docker build -t backend ./backend
docker tag backend:latest $BACKEND_ECR:latest
docker push $BACKEND_ECR:latest

# Build and push frontend
docker build -t frontend ./frontend
docker tag frontend:latest $FRONTEND_ECR:latest
docker push $FRONTEND_ECR:latest
```

### 4. Access Application

```bash
terraform output frontend_url
# Visit this URL in your browser
```

## Screenshots for Portfolio

Take these screenshots from AWS Console:

### 1. ECS Cluster
- Navigate to: **ECS → Clusters → resume-ai-cluster**
- Screenshot: Cluster overview showing 2 running services

### 2. Running Tasks
- Navigate to: **ECS → Clusters → resume-ai-cluster → Tasks**
- Screenshot: Both frontend and backend tasks running

### 3. Load Balancer
- Navigate to: **EC2 → Load Balancers → resume-ai-alb**
- Screenshot: ALB with target groups and health checks

### 4. ECR Repositories
- Navigate to: **ECR → Repositories**
- Screenshot: Both resume-ai-backend and resume-ai-frontend repos with images

### 5. CloudWatch Logs
- Navigate to: **CloudWatch → Log groups → /ecs/resume-ai-backend**
- Screenshot: Live container logs

### 6. Architecture Diagram (Optional)
- Navigate to: **VPC → Your VPCs → resume-ai-vpc**
- Screenshot: VPC resource map showing subnets, ALB, ECS tasks

## Cost Estimate

| Service | Monthly Cost |
|---------|-------------|
| ECS Fargate (2 tasks) | $7-10 |
| Application Load Balancer | $16-20 |
| Secrets Manager | $0.40 |
| CloudWatch | $0.50 |
| **Total** | **~$24-31/month** |

**Free Tier**: First 12 months includes 750 ECS hours/month.

## Monitoring

View logs:
```bash
aws logs tail /ecs/resume-ai-backend --follow
```

Check tasks:
```bash
aws ecs list-tasks --cluster resume-ai-cluster
```

## Cleanup

Delete all resources:
```bash
terraform destroy
```

## Troubleshooting

**Tasks not starting?**
```bash
aws logs tail /ecs/resume-ai-backend --follow
```

**ALB health check failing?**
```bash
curl http://$(terraform output -raw alb_dns_name):8000/ping
```

## Security

- ✅ API keys encrypted in Secrets Manager
- ✅ IAM roles with least-privilege
- ✅ Security groups restrict network access
- ✅ CloudWatch audit logging

## Tech Stack

**Infrastructure**: Terraform, AWS ECS Fargate, ALB, VPC
**Application**: Next.js, FastAPI, Docker

---

For local development: [README.md](README.md)
For Terraform details: [terraform/README.md](terraform/README.md)
