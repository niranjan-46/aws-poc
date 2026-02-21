variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "ap-southeast-1"
}

variable "project_name" {
  description = "Project prefix for resource names"
  type        = string
  default     = "llm"
}

variable "stage" {
  description = "Deployment stage (example: dev, qa, prod)"
  type        = string
  default     = "prod"
}

variable "audit_bucket_name" {
  description = "Optional S3 bucket name override for schedule/execution audit logs"
  type        = string
  default     = null
}

variable "lambda_function_name" {
  description = "Optional Lambda function name override"
  type        = string
  default     = null
}

variable "lambda_zip_path" {
  description = "Optional path to pre-built Lambda zip. If null, Terraform packages lambda_source_path automatically."
  type        = string
  default     = null
}

variable "lambda_source_path" {
  description = "Path to Lambda source file used when lambda_zip_path is null"
  type        = string
  default     = "../../services/lambda/batch_executor.py"
}

variable "lambda_handler" {
  description = "Lambda handler"
  type        = string
  default     = "batch_executor.lambda_handler"
}

variable "lambda_runtime" {
  description = "Lambda runtime"
  type        = string
  default     = "python3.12"
}

variable "lambda_memory_size" {
  description = "Lambda memory size in MB"
  type        = number
  default     = 512
}

variable "lambda_timeout" {
  description = "Lambda timeout in seconds"
  type        = number
  default     = 900
}

variable "backend_api_host" {
  description = "App Runner backend host without protocol"
  type        = string
}

variable "scheduler_secret" {
  description = "Shared secret between Lambda and backend"
  type        = string
  sensitive   = true
}

variable "scheduler_group_name" {
  description = "Optional EventBridge Scheduler group name override"
  type        = string
  default     = null
}

variable "apprunner_frontend_name" {
  description = "Base App Runner frontend service name (stage suffix is added automatically)"
  type        = string
  default     = "llm-frontend"
}

variable "apprunner_backend_name" {
  description = "Base App Runner backend service name (stage suffix is added automatically)"
  type        = string
  default     = "llm-backend"
}

variable "ecr_frontend_repository_name" {
  description = "Optional ECR frontend repository name override"
  type        = string
  default     = null
}

variable "ecr_backend_repository_name" {
  description = "Optional ECR backend repository name override"
  type        = string
  default     = null
}

variable "alarm_duration_threshold_ms" {
  description = "Alarm threshold for Lambda duration"
  type        = number
  default     = 15000
}

variable "alarm_sns_topic_arn" {
  description = "Optional SNS topic ARN for CloudWatch alarms"
  type        = string
  default     = null
}
