# Resume AI - AWS Terraform Deployment

Infrastructure as Code for deploying Resume AI to AWS.

## 📋 Prerequisites

- AWS account with CLI configured
- Terraform >= 1.0 installed
- Docker installed
- OpenAI and/or Gemini API keys

## 🏗️ Infrastructure Components

**Fully Deployed** - Production Ready ✅

### Networking
- **VPC**: Custom VPC (10.0.0.0/16) with DNS enabled
- **Subnets**: 2 public subnets across different AZs (us-east-1a, us-east-1b)
- **Internet Gateway**: Public internet access
- **Security Groups**: Firewall rules for ALB and ECS tasks

### Container Infrastructure
- **ECR Repositories**: Backend and Frontend Docker image storage
- **ECS Cluster**: Fargate-based serverless container orchestration
- **ECS Services**: Auto-healing, auto-scaling container services
- **Task Definitions**: 0.25 vCPU, 512MB RAM per task (Free tier eligible)

### Load Balancing
- **Application Load Balancer**: Multi-port HTTP load balancer
- **Target Groups**: Health-checked routing to containers
- **Listeners**: Port 80 (frontend) and 8000 (backend)

### Security & Secrets
- **Secrets Manager**: Encrypted API key storage (optional fallback)
- **IAM Roles**: Least-privilege access for ECS tasks
- **Security Groups**: Network-level access control

### Monitoring
- **CloudWatch Logs**: Centralized container logging (7-day retention)
- **Container Insights**: CPU, memory, and performance metrics
- **Health Checks**: Automated container health monitoring

## 🚀 Quick Start

### 1. Configure AWS CLI

```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Region: us-east-1
```

### 2. Create terraform.tfvars

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your values:

```hcl
aws_region     = "us-east-1"
project_name   = "resume-ai"
openai_api_key = "PLACEHOLDER_OPENAI_KEY"  # Optional - users can enter in UI
gemini_api_key = "PLACEHOLDER_GEMINI_KEY"  # Optional - users can enter in UI
```

⚠️ **IMPORTANT**:
- `terraform.tfvars` is in `.gitignore` - never commit this file!
- **API keys are OPTIONAL**: Users can enter their own keys in the frontend UI. Placeholder values work fine for deployment.

### 3. Initialize Terraform

```bash
terraform init
```

This downloads the AWS provider plugin.

### 4. Review the Plan

```bash
terraform plan
```

This shows what Terraform will create (DRY RUN).

### 5. Apply (Create Resources)

```bash
terraform apply
```

Type `yes` to confirm.

### 6. View Outputs

```bash
terraform output
```

You'll see your infrastructure URLs and details.

## 📦 What Gets Created

When you run `terraform apply`, **27 AWS resources** are created:

```
AWS Account (us-east-1)
├── VPC & Networking
│   ├── VPC (10.0.0.0/16)
│   ├── 2 Public Subnets (us-east-1a, us-east-1b)
│   ├── Internet Gateway
│   ├── Route Tables
│   └── 2 Security Groups (ALB, ECS Tasks)
│
├── Container Infrastructure
│   ├── ECR Repositories
│   │   ├── resume-ai-backend (lifecycle: 3 images)
│   │   └── resume-ai-frontend (lifecycle: 3 images)
│   ├── ECS Cluster (resume-ai-cluster)
│   ├── 2 Task Definitions (backend, frontend)
│   └── 2 ECS Services (Fargate)
│
├── Load Balancer
│   ├── Application Load Balancer
│   ├── 2 Target Groups (port 3000, 8000)
│   └── 2 Listeners (HTTP 80, 8000)
│
├── Security
│   ├── Secrets Manager (API keys)
│   └── 2 IAM Roles (task execution, task runtime)
│
└── Monitoring
    └── 2 CloudWatch Log Groups (7-day retention)
```

**Estimated Monthly Cost**: ~$25-30
- ALB: $16-20
- ECS Fargate (2 tasks): $7-10
- Secrets Manager: $0.40
- CloudWatch: $0.50

**Free Tier**: First 12 months includes 750 ECS hours/month

## 🧹 Cleanup

To delete all resources:

```bash
terraform destroy
```

Type `yes` to confirm deletion.

## 📚 Learning Terraform

### Key Files

- `main.tf` - Provider configuration (AWS)
- `variables.tf` - Variable definitions
- `ecr.tf` - ECR repositories
- `outputs.tf` - Output values (URLs, IDs)
- `terraform.tfvars` - Your secret values (NOT in git)

### Key Commands

```bash
terraform init      # Initialize (download plugins)
terraform plan      # Show what will change
terraform apply     # Apply changes (create/update)
terraform destroy   # Delete everything
terraform output    # Show output values
```

### How It Works

1. You write `.tf` files (HCL syntax)
2. Terraform reads them
3. Terraform calls AWS APIs
4. AWS creates resources
5. Terraform saves state in `.tfstate` file

## 🆘 Troubleshooting

### "No AWS credentials found"
```bash
aws configure
```

### "Region not set"
Check `aws_region` in `terraform.tfvars`

### "Permission denied"
Quick fix (for learning/testing):
```bash
# Give your IAM user AdministratorAccess policy in AWS Console
# IAM → Users → Your User → Add permissions → AdministratorAccess
```

**Note**: I used AdministratorAccess for simplicity-.

### "ECS tasks not starting"
Check logs:
```bash
aws logs tail /ecs/resume-ai-backend --follow
```

Common issues:
- Forgot to push Docker images to ECR
- Health check failing (test `/ping` endpoint)
- Not enough time passed (tasks take 2-3 min to start)

## 🎓 Learning Notes

This this section of the project helped me learn:
- Infrastructure as Code with Terraform
- AWS ECS Fargate (serverless containers)
- Load balancing and networking in AWS
- Container security and secrets management
- CI/CD concepts and Docker best practices

**Total deployment time**: ~15 minutes
**Resources created**: 27 AWS resources
**Monthly cost**: ~$25-30 (free tier eligible for 12 months)

---

**Status**: Fully Deployed and Working ✅
