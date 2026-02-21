output "audit_bucket_name" {
  description = "Audit S3 bucket name"
  value       = aws_s3_bucket.audit.bucket
}

output "stage" {
  description = "Deployment stage in use for resource naming"
  value       = local.stage_slug
}

output "aws_region" {
  description = "AWS region used by this stack"
  value       = var.aws_region
}

output "lambda_function_arn" {
  description = "Lambda function ARN"
  value       = aws_lambda_function.batch_executor.arn
}

output "scheduler_execution_role_arn" {
  description = "IAM role ARN used by EventBridge Scheduler to invoke Lambda"
  value       = aws_iam_role.scheduler_execution.arn
}

output "app_runner_instance_role_arn" {
  description = "IAM role ARN to assign to the App Runner backend"
  value       = aws_iam_role.apprunner_instance.arn
}

output "scheduler_group_name" {
  description = "EventBridge Scheduler group for schedules created by backend"
  value       = aws_scheduler_schedule_group.batch.name
}

output "apprunner_autoscaling_configuration_arn" {
  description = "Attach this autoscaling config to your App Runner service"
  value       = aws_apprunner_auto_scaling_configuration_version.backend.arn
}

output "app_runner_frontend_service_name" {
  description = "Stage-aware App Runner frontend service name"
  value       = local.app_runner_frontend_service_name
}

output "app_runner_backend_service_name" {
  description = "Stage-aware App Runner backend service name"
  value       = local.app_runner_backend_service_name
}

output "ecr_frontend_repository_name" {
  description = "ECR frontend repository name"
  value       = aws_ecr_repository.frontend.name
}

output "ecr_frontend_repository_url" {
  description = "ECR frontend repository URL"
  value       = aws_ecr_repository.frontend.repository_url
}

output "ecr_backend_repository_name" {
  description = "ECR backend repository name"
  value       = aws_ecr_repository.backend.name
}

output "ecr_backend_repository_url" {
  description = "ECR backend repository URL"
  value       = aws_ecr_repository.backend.repository_url
}
