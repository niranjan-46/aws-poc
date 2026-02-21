# Lambda Batch Executor

This Lambda is invoked by EventBridge Scheduler and calls the backend `/api/batch/run` endpoint.

## Environment Variables

- `API_HOST` (example: `your-backend-url.awsapprunner.com`)
- `SCHEDULER_SECRET`
- `AUDIT_BUCKET`
- `REQUEST_TIMEOUT_SECONDS` (optional, default `30`)

## Package

```bash
cd services/lambda
Compress-Archive -Path .\batch_executor.py -DestinationPath .\batch_executor.zip -Force
```

Upload `batch_executor.zip` when creating/updating the Lambda function.
