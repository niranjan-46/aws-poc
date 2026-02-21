# Terraform Infrastructure

This Terraform stack creates AWS resources with stage-aware naming for the LLM architecture.

## Default Profile

- Region: Singapore (`ap-southeast-1`)
- Project: `llm`
- Stage: `prod`
- App Runner base service names:
  - Frontend: `llm-frontend`
  - Backend: `llm-backend`

Resource names include stage automatically (example: `llm-prod-scheduler-execution-role`, `llm-frontend-prod`, `llm-backend-prod`).

## Resources

- S3 bucket for audit logs (`schedules/` and `executions/`)
- Lambda function for batch execution
- IAM roles and policies:
  - Lambda execution
  - EventBridge Scheduler execution
  - App Runner instance role + scheduler/audit policy
- EventBridge Scheduler group
- CloudWatch alarms (Lambda errors and duration) with stage in alert names
- ECR repositories for frontend and backend images
- App Runner backend autoscaling configuration

## Prerequisites

- Terraform >= 1.6
- AWS credentials configured
- Lambda source file present (`../../services/lambda/batch_executor.py`) or provide `lambda_zip_path` override

## Usage

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

After apply:

1. Assign `app_runner_instance_role_arn` output to your App Runner service instance role.
2. Use stage-aware outputs for App Runner and ECR:
   - `app_runner_frontend_service_name`
   - `app_runner_backend_service_name`
   - `ecr_frontend_repository_url`
   - `ecr_backend_repository_url`
3. Set backend env vars from outputs:
   - `LAMBDA_ARN`
   - `SCHEDULER_ROLE_ARN`
   - `AUDIT_BUCKET`
   - `SCHEDULER_GROUP_NAME`
   - `SCHEDULER_SECRET`

## Notes

- The backend creates schedules dynamically at runtime.
- The Terraform stack creates the scheduler **group**, not static schedules.
- Add DLQ/KMS as needed for stricter compliance requirements.
