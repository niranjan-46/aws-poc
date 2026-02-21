data "aws_caller_identity" "current" {}

locals {
  project_slug = lower(replace(var.project_name, "_", "-"))
  stage_slug   = lower(replace(var.stage, "_", "-"))
  name_prefix  = "${local.project_slug}-${local.stage_slug}"

  audit_bucket_name = coalesce(
    var.audit_bucket_name,
    "${local.name_prefix}-audit-${data.aws_caller_identity.current.account_id}-${var.aws_region}"
  )

  lambda_function_name = coalesce(
    var.lambda_function_name,
    "${local.name_prefix}-batch-executor"
  )

  scheduler_group_name = coalesce(
    var.scheduler_group_name,
    "${local.name_prefix}-schedules"
  )

  lambda_filename = var.lambda_zip_path == null ? data.archive_file.batch_executor.output_path : var.lambda_zip_path
  lambda_source_code_hash = var.lambda_zip_path == null ? data.archive_file.batch_executor.output_base64sha256 : filebase64sha256(var.lambda_zip_path)

  app_runner_frontend_service_name = "${lower(replace(var.apprunner_frontend_name, "_", "-"))}-${local.stage_slug}"
  app_runner_backend_service_name  = "${lower(replace(var.apprunner_backend_name, "_", "-"))}-${local.stage_slug}"

  ecr_frontend_repository_name = coalesce(
    var.ecr_frontend_repository_name,
    local.app_runner_frontend_service_name
  )

  ecr_backend_repository_name = coalesce(
    var.ecr_backend_repository_name,
    local.app_runner_backend_service_name
  )

  common_tags = {
    Project     = var.project_name
    ManagedBy   = "terraform"
    Environment = local.stage_slug
    Stage       = local.stage_slug
    Region      = var.aws_region
  }

  alarm_actions = var.alarm_sns_topic_arn == null ? [] : [var.alarm_sns_topic_arn]
}

data "archive_file" "batch_executor" {
  type        = "zip"
  source_file = var.lambda_source_path
  output_path = "${path.module}/.terraform/batch_executor.zip"
}

resource "aws_s3_bucket" "audit" {
  bucket = local.audit_bucket_name
  tags   = local.common_tags
}

resource "aws_s3_bucket_public_access_block" "audit" {
  bucket                  = aws_s3_bucket.audit.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "audit" {
  bucket = aws_s3_bucket.audit.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "audit" {
  bucket = aws_s3_bucket.audit.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "audit" {
  bucket = aws_s3_bucket.audit.id

  rule {
    id     = "archive-execution-audits"
    status = "Enabled"

    filter {
      prefix = "executions/"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }
  }
}

resource "aws_iam_role" "lambda_execution" {
  name = "${local.name_prefix}-lambda-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = "sts:AssumeRole",
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_s3_put" {
  name = "${local.name_prefix}-lambda-s3-put"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = ["s3:PutObject"],
        Resource = "${aws_s3_bucket.audit.arn}/*"
      }
    ]
  })
}

resource "aws_iam_role" "scheduler_execution" {
  name = "${local.name_prefix}-scheduler-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = "sts:AssumeRole",
        Principal = {
          Service = "scheduler.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "scheduler_invoke_lambda" {
  name = "${local.name_prefix}-scheduler-invoke-lambda"
  role = aws_iam_role.scheduler_execution.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = ["lambda:InvokeFunction"],
        Resource = aws_lambda_function.batch_executor.arn
      }
    ]
  })
}

resource "aws_iam_role" "apprunner_instance" {
  name = "${local.name_prefix}-apprunner-instance-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = "sts:AssumeRole",
        Principal = {
          Service = "tasks.apprunner.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "apprunner_scheduler_and_audit" {
  name = "${local.name_prefix}-apprunner-scheduler-policy"
  role = aws_iam_role.apprunner_instance.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "scheduler:CreateSchedule",
          "scheduler:DeleteSchedule",
          "scheduler:GetSchedule",
          "scheduler:ListSchedules"
        ],
        Resource = "*"
      },
      {
        Effect = "Allow",
        Action = ["iam:PassRole"],
        Resource = aws_iam_role.scheduler_execution.arn
      },
      {
        Effect = "Allow",
        Action = ["s3:PutObject"],
        Resource = "${aws_s3_bucket.audit.arn}/*"
      }
    ]
  })
}

resource "aws_scheduler_schedule_group" "batch" {
  name = local.scheduler_group_name
  tags = local.common_tags
}

resource "aws_lambda_function" "batch_executor" {
  function_name = local.lambda_function_name
  role          = aws_iam_role.lambda_execution.arn
  filename      = local.lambda_filename
  handler       = var.lambda_handler
  runtime       = var.lambda_runtime
  memory_size   = var.lambda_memory_size
  timeout       = var.lambda_timeout

  source_code_hash = local.lambda_source_code_hash

  environment {
    variables = {
      API_HOST         = var.backend_api_host
      AUDIT_BUCKET     = aws_s3_bucket.audit.bucket
      SCHEDULER_SECRET = var.scheduler_secret
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic_execution,
    aws_iam_role_policy.lambda_s3_put
  ]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "${local.name_prefix}-lambda-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions

  dimensions = {
    FunctionName = aws_lambda_function.batch_executor.function_name
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "lambda_duration" {
  alarm_name          = "${local.name_prefix}-lambda-duration"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Average"
  threshold           = var.alarm_duration_threshold_ms
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions

  dimensions = {
    FunctionName = aws_lambda_function.batch_executor.function_name
  }

  tags = local.common_tags
}

resource "aws_ecr_repository" "frontend" {
  name                 = local.ecr_frontend_repository_name
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = merge(
    local.common_tags,
    {
      Service = local.app_runner_frontend_service_name
    }
  )
}

resource "aws_ecr_repository" "backend" {
  name                 = local.ecr_backend_repository_name
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = merge(
    local.common_tags,
    {
      Service = local.app_runner_backend_service_name
    }
  )
}

resource "aws_apprunner_auto_scaling_configuration_version" "backend" {
  auto_scaling_configuration_name = "${local.name_prefix}-apprunner-autoscaling"
  max_concurrency                 = 100
  max_size                        = 10
  min_size                        = 1

  tags = local.common_tags
}
