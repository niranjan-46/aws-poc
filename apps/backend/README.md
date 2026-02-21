# Backend (Spring Boot 3, Java 21)

Spring Boot API for:

- creating EventBridge Scheduler jobs
- receiving Lambda execution callbacks
- writing audit logs to S3
- serving admin metrics for the frontend dashboard

This README is aligned to the current code and your AWS Singapore setup (`ap-southeast-1`).

## How Backend Works End-to-End

1. Frontend calls `POST /api/batch/schedule`.
2. Backend validates payload (`batchId`, cron/rate expression, timezone).
3. Backend creates EventBridge schedule in `SCHEDULER_GROUP_NAME`.
4. Backend stores schedule audit JSON to S3:
   - `schedules/<batchId>/<scheduleName>.json`
5. EventBridge triggers Lambda at runtime.
6. Lambda calls backend `POST /api/batch/run` with `X-Scheduler-Secret`.
7. Backend executes batch flow, stores execution audit JSON:
   - `executions/<batchId>/<timestamp>-backend.json`
8. Backend auto-cleans schedule:
   - EventBridge `actionAfterCompletion=DELETE`
   - backend also attempts `DeleteSchedule` in `finally` block
9. Frontend reads metrics from:
   - `/api/batch/schedules/recent`
   - `/api/batch/runs`
   - `/api/batch/admin/summary`

## API Endpoints

### Scheduling

`POST /api/batch/schedule`

Request body:

```json
{
  "batchId": "CODING-12345-abcde",
  "cronExpression": "cron(30 10 21 2 ? 2026)",
  "timezone": "Asia/Kolkata",
  "nextRunAt": "2026-02-21T05:00:00Z"
}
```

Notes:

- `batchId` must be unique (3-64 chars, `[A-Za-z0-9_-]`).
- `cronExpression` must be EventBridge format: `cron(...)` or `rate(...)`.
- timezone must be valid IANA timezone.

Response:

```json
{
  "scheduleName": "batch-coding-12345-abcde-1700000000000",
  "batchId": "CODING-12345-abcde",
  "createdAt": "2026-02-21T09:00:00Z",
  "nextRunAt": "2026-02-21T10:30:00Z"
}
```

`GET /api/batch/schedules/recent?limit=10&upcomingOnly=true&batchId=CODING`

### Execution

`POST /api/batch/run`

Headers:

- `X-Scheduler-Secret: <SCHEDULER_SECRET>`

Request body:

```json
{
  "batchId": "CODING-12345-abcde",
  "scheduleName": "batch-coding-12345-abcde-1700000000000"
}
```

Behavior:

- rejects invalid secret with `401`
- writes execution audit to S3
- always executes cleanup in `finally`:
  - delete schedule
  - release in-memory batch lock
  - remove schedule from in-memory schedule history

`GET /api/batch/runs?limit=10&status=PASSED&batchId=CODING`

### Admin

`GET /api/batch/admin/summary`

`GET /actuator/health`

## Auto-Delete Scheduler Behavior

Schedules are automatically removed after execution.

- EventBridge side: schedule is created with `actionAfterCompletion=DELETE`
- Backend side: callback path also tries `DeleteSchedule` as a safety cleanup

This means the same schedule does not remain active after it fires.

## Data Model and Storage

- S3 is used for audit artifacts (`schedules/`, `executions/`).
- Recent schedules/runs shown in API responses are held in-memory.

Important:

- In-memory metrics/history reset on backend restart or redeploy.
- S3 audit logs remain durable.

## Environment Variables

### Required for production

- `AWS_REGION=ap-southeast-1`
- `LAMBDA_ARN=arn:aws:lambda:ap-southeast-1:180294187402:function:llm-prod-batch-executor`
- `SCHEDULER_ROLE_ARN=arn:aws:iam::180294187402:role/llm-prod-scheduler-execution-role`
- `AUDIT_BUCKET=llm-prod-audit-180294187402-ap-southeast-1`
- `SCHEDULER_SECRET=<strong-shared-secret>`

### Optional

- `SCHEDULER_GROUP_NAME=llm-prod-schedules`
- `APP_CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://*.ap-southeast-1.awsapprunner.com`
- `PORT=8080`

## CORS

Current default allows:

- localhost frontend
- App Runner domains in Singapore (`https://*.ap-southeast-1.awsapprunner.com`)

If you set `APP_CORS_ALLOWED_ORIGINS`, it overrides defaults.

## App Runner Deployment (Backend)

Container:

- Image: `180294187402.dkr.ecr.ap-southeast-1.amazonaws.com/llm-backend-prod:<tag>`
- Port: `8080`
- Instance role: `arn:aws:iam::180294187402:role/llm-prod-apprunner-instance-role`
- Autoscaling: `llm-prod-apprunner-autoscaling` (from Terraform output ARN)

Set env vars in App Runner:

- `AWS_REGION`
- `LAMBDA_ARN`
- `SCHEDULER_ROLE_ARN`
- `AUDIT_BUCKET`
- `SCHEDULER_GROUP_NAME`
- `SCHEDULER_SECRET`
- `APP_CORS_ALLOWED_ORIGINS` (optional override)

Health check recommendation:

- Protocol: `HTTP`
- Path: `/actuator/health`

## Local Run

```bash
mvn spring-boot:run -Dspring-boot.run.profiles=prod
```

or:

```bash
SPRING_PROFILES_ACTIVE=prod
mvn spring-boot:run
```

## Build

```bash
mvn clean package
```

## Docker

Build:

```bash
docker build -t llm-backend-prod .
```

Run:

```bash
docker run --rm -p 8080:8080 \
  -e SPRING_PROFILES_ACTIVE=prod \
  -e AWS_REGION=ap-southeast-1 \
  -e LAMBDA_ARN=arn:aws:lambda:ap-southeast-1:180294187402:function:llm-prod-batch-executor \
  -e SCHEDULER_ROLE_ARN=arn:aws:iam::180294187402:role/llm-prod-scheduler-execution-role \
  -e AUDIT_BUCKET=llm-prod-audit-180294187402-ap-southeast-1 \
  -e SCHEDULER_GROUP_NAME=llm-prod-schedules \
  -e SCHEDULER_SECRET=replace-with-strong-secret \
  llm-backend-prod
```

PowerShell:

```powershell
docker run --rm -p 8080:8080 `
  -e SPRING_PROFILES_ACTIVE=prod `
  -e AWS_REGION=ap-southeast-1 `
  -e LAMBDA_ARN=arn:aws:lambda:ap-southeast-1:180294187402:function:llm-prod-batch-executor `
  -e SCHEDULER_ROLE_ARN=arn:aws:iam::180294187402:role/llm-prod-scheduler-execution-role `
  -e AUDIT_BUCKET=llm-prod-audit-180294187402-ap-southeast-1 `
  -e SCHEDULER_GROUP_NAME=llm-prod-schedules `
  -e SCHEDULER_SECRET=replace-with-strong-secret `
  llm-backend-prod
```

## Troubleshooting

### Frontend shows "Backend Offline"

- check backend health endpoint: `/actuator/health`
- check CORS origin allowlist
- verify frontend uses:
  - `NEXT_PUBLIC_BACKEND_API_URL=https://smeiv3p6jn.ap-southeast-1.awsapprunner.com/api`

### Scheduler not created

- validate `LAMBDA_ARN` and `SCHEDULER_ROLE_ARN`
- validate cron expression format
- check IAM permissions in App Runner instance role

### Scheduler not deleted after run

- ensure latest backend and Lambda images/code are deployed
- verify Lambda callback includes `scheduleName`
- check backend logs for `DeleteSchedule` errors

### `/api/batch/run` returns 401

- `SCHEDULER_SECRET` mismatch between backend and Lambda

