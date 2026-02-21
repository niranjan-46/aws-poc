export type FlowNode = {
  title: string
  detail: string
  children?: FlowNode[]
}

export const architectureFlow = [
  "Frontend UI creates a schedule request with a unique batch ID.",
  "Backend validates batchId, cron/rate expression, timezone, then creates EventBridge Scheduler target to Lambda.",
  "Backend stores schedule audit in S3 at schedules/<batchId>/<scheduleName>.json.",
  "EventBridge Scheduler invokes Lambda with batchId + scheduleName input.",
  "Lambda posts to backend /api/batch/run with X-Scheduler-Secret and retry/backoff behavior.",
  "Backend executes run, stores execution audit in S3, and returns run metrics APIs.",
  "Schedule is auto-cleaned after execution (actionAfterCompletion=DELETE + backend cleanup fallback).",
]

export const frontendFlowTree: FlowNode[] = [
  {
    title: "UI Layer (Next.js)",
    detail: "Dashboard renders schedule form, KPIs, run history, and architecture guide page.",
    children: [
      {
        title: "ScheduleForm.jsx",
        detail: "Supports Date/Time and Cron modes, then sends scheduler payload.",
        children: [
          {
            title: "Validation",
            detail: "Ensures cron is EventBridge format cron(...) or rate(...).",
          },
          {
            title: "Batch ID",
            detail: "Generates unique ID and sends it end-to-end.",
          },
        ],
      },
      {
        title: "lib/api.js",
        detail: "Centralized API client for /schedule, /runs, /schedules/recent, and /admin/summary.",
      },
      {
        title: "Environment",
        detail: ".env.production points frontend API to App Runner backend endpoint.",
      },
    ],
  },
]

export const backendFlowTree: FlowNode[] = [
  {
    title: "API Layer (Spring Boot)",
    detail: "Controllers expose /api/batch/schedule, /api/batch/run, /api/batch/runs, and /api/batch/admin/summary.",
    children: [
      {
        title: "Schedule Validation",
        detail: "DTO + service validation for batchId, timezone, and schedule expression.",
      },
      {
        title: "EventBridge Creation",
        detail: "BatchSchedulerService creates scheduler entry with Lambda target, IAM role, and actionAfterCompletion=DELETE.",
      },
      {
        title: "Execution Path",
        detail: "BatchRunController verifies X-Scheduler-Secret before executing batch run.",
        children: [
          {
            title: "Scheduler Cleanup",
            detail: "Backend finalizer deletes schedule by scheduleName and releases in-memory schedule state.",
          },
          {
            title: "Audit",
            detail: "AuditLogService writes schedules and executions to S3.",
          },
          {
            title: "History",
            detail: "Run and schedule history are served to frontend filters and KPI cards.",
          },
          {
            title: "CORS",
            detail: "API allows localhost and App Runner domain patterns for browser calls.",
          },
        ],
      },
    ],
  },
]

export const frontendStructure = `apps/frontend/
  app/
    page.tsx
    guides/architecture/page.tsx
  components/
    ScheduleForm.jsx
    guides/
      GuidePanel.tsx
      IndentedFlowTree.tsx
  lib/
    api.js
    projectMeta.ts
    architectureGuideContent.ts
  .env.production
  next.config.mjs`

export const backendStructure = `apps/backend/
  src/main/java/com/dsedify/batchscheduler/
    controller/
      BatchSchedulerController.java
      BatchRunController.java
      BatchAdminController.java
    service/
      BatchSchedulerService.java
      BatchExecutionService.java
      AuditLogService.java
    support/
      GlobalExceptionHandler.java
    dto/
      ScheduleRequest.java
      BatchRunRequest.java
  src/main/resources/
    application-prod.properties`

export const validationStandards = [
  "batchId pattern: letters/numbers/_/- and length 3-64.",
  "cronExpression must be EventBridge-compatible cron(...) or rate(...).",
  "timezone is required and validated before scheduling.",
  "X-Scheduler-Secret is required for Lambda-triggered /api/batch/run.",
  "Lambda event must include batchId; scheduleName is passed for cleanup.",
]

export const deploymentStack = [
  "Region: Singapore (ap-southeast-1).",
  "Frontend: AWS App Runner service llm-frontend-prod.",
  "Backend: AWS App Runner service llm-backend-prod.",
  "Container Registry: ECR repos llm-frontend-prod and llm-backend-prod.",
  "Scheduler: EventBridge Scheduler group llm-prod-schedules.",
  "Execution: Lambda function llm-prod-batch-executor (services/lambda/batch_executor.py).",
  "Audit: S3 bucket llm-prod-audit-180294187402-ap-southeast-1.",
  "Infrastructure: Terraform in infra/terraform.",
]

export const codeChanges = [
  "Architecture guide refreshed for Singapore App Runner + ECR naming.",
  "Backend schedule lifecycle updated with auto-delete cleanup after execution.",
  "Lambda callback payload now includes scheduleName and hardened backend URL handling.",
  "CORS behavior updated for App Runner domain patterns.",
  "Terraform naming/stage updates plus Lambda packaging fallback and ECR resources.",
]
