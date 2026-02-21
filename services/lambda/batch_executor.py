import json
import os
import time
from datetime import datetime, timezone
import urllib.error
import urllib.parse
import urllib.request

import boto3

s3_client = boto3.client("s3")

AUDIT_BUCKET = os.environ["AUDIT_BUCKET"]
API_HOST = os.environ["API_HOST"]
SCHEDULER_SECRET = os.environ.get("SCHEDULER_SECRET", "")
REQUEST_TIMEOUT_SECONDS = int(os.environ.get("REQUEST_TIMEOUT_SECONDS", "30"))
BACKEND_MAX_RETRIES = int(os.environ.get("BACKEND_MAX_RETRIES", "3"))
BACKEND_RETRY_SLEEP_SECONDS = float(os.environ.get("BACKEND_RETRY_SLEEP_SECONDS", "1.0"))


def lambda_handler(event, _context):
    batch_id = extract_event_value(event, "batchId")
    schedule_name = extract_event_value(event, "scheduleName")
    if not batch_id:
        event_keys = list(event.keys()) if isinstance(event, dict) else []
        raise ValueError(
            "Event payload must include batchId. "
            f"Top-level keys received: {event_keys}"
        )

    started_at_epoch = time.time()
    started_at = datetime.now(timezone.utc).isoformat()

    backend_result = call_backend(batch_id, schedule_name)

    finished_at = datetime.now(timezone.utc).isoformat()
    duration_ms = int((time.time() - started_at_epoch) * 1000)

    record = {
        "batchId": batch_id,
        "scheduleName": schedule_name,
        "triggeredAt": started_at,
        "finishedAt": finished_at,
        "status": "SUCCESS" if backend_result["ok"] else "FAILED",
        "durationMs": duration_ms,
        "backend": {
            "url": backend_result.get("url"),
            "httpStatus": backend_result.get("status_code"),
            "body": backend_result.get("body"),
            "error": backend_result.get("error"),
        },
    }

    put_execution_audit(batch_id, record)

    if not backend_result["ok"]:
        raise RuntimeError(json.dumps(record))

    return record


def call_backend(batch_id, schedule_name=None):
    url = build_backend_run_url(API_HOST)
    request_body = {"batchId": batch_id}
    if schedule_name:
        request_body["scheduleName"] = schedule_name

    payload = json.dumps(request_body).encode("utf-8")

    headers = {
        "Content-Type": "application/json",
    }

    if SCHEDULER_SECRET:
        headers["X-Scheduler-Secret"] = SCHEDULER_SECRET

    last_error = None
    for attempt in range(1, max(BACKEND_MAX_RETRIES, 1) + 1):
        request = urllib.request.Request(url=url, data=payload, headers=headers, method="POST")

        try:
            with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                body = response.read().decode("utf-8")
                return {
                    "ok": 200 <= response.status < 300,
                    "url": url,
                    "status_code": response.status,
                    "body": safe_json(body),
                    "error": None,
                }
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8") if exc.fp else ""
            last_error = {
                "ok": False,
                "url": url,
                "status_code": exc.code,
                "body": safe_json(body),
                "error": f"HTTPError: {exc.reason}",
            }
            # Retry only backend-side transient failures.
            if 500 <= exc.code < 600 and attempt < BACKEND_MAX_RETRIES:
                time.sleep(BACKEND_RETRY_SLEEP_SECONDS * attempt)
                continue
            return last_error
        except urllib.error.URLError as exc:
            last_error = {
                "ok": False,
                "url": url,
                "status_code": None,
                "body": None,
                "error": f"URLError: {exc.reason}",
            }
            if attempt < BACKEND_MAX_RETRIES:
                time.sleep(BACKEND_RETRY_SLEEP_SECONDS * attempt)
                continue
            return last_error
        except Exception as exc:
            last_error = {
                "ok": False,
                "url": url,
                "status_code": None,
                "body": None,
                "error": f"{type(exc).__name__}: {exc}",
            }
            if attempt < BACKEND_MAX_RETRIES:
                time.sleep(BACKEND_RETRY_SLEEP_SECONDS * attempt)
                continue
            return last_error

    return last_error or {
        "ok": False,
        "url": url,
        "status_code": None,
        "body": None,
        "error": "Unknown backend call failure",
    }


def build_backend_run_url(api_host):
    host = (api_host or "").strip()
    if not host:
        raise ValueError("API_HOST is empty")

    if host.startswith("http://") or host.startswith("https://"):
        base = host.rstrip("/")
    else:
        base = f"https://{host.rstrip('/')}"

    parsed = urllib.parse.urlparse(base)
    if not parsed.scheme or not parsed.netloc:
        raise ValueError(f"API_HOST is invalid: {api_host}")

    if parsed.path.endswith("/api"):
        return f"{base}/batch/run"

    return f"{base}/api/batch/run"


def put_execution_audit(batch_id, record):
    key = f"executions/{batch_id}/{int(time.time())}.json"

    s3_client.put_object(
        Bucket=AUDIT_BUCKET,
        Key=key,
        Body=json.dumps(record, separators=(",", ":")).encode("utf-8"),
        ContentType="application/json",
    )


def safe_json(value):
    if value is None or value == "":
        return None

    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return value


def extract_event_value(event, field_name):
    if not isinstance(event, dict):
        return None

    value = event.get(field_name)
    if value:
        return value

    detail = event.get("detail")
    if isinstance(detail, dict):
        value = detail.get(field_name)
        if value:
            return value

    body = event.get("body")
    if isinstance(body, str) and body:
        parsed_body = safe_json(body)
        if isinstance(parsed_body, dict):
            value = parsed_body.get(field_name)
            if value:
                return value

    return None
