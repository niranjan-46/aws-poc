import axios from "axios"

const DEFAULT_BACKEND_API_URL = "http://localhost:8080/api"

const API_BASE =
  (process.env.NEXT_PUBLIC_BACKEND_API_URL || DEFAULT_BACKEND_API_URL)
    .replace(/\/$/, "")

export async function createSchedule(payload) {
  const response = await axios.post(
    `${API_BASE}/batch/schedule`,
    payload,
    {
      timeout: 15000,
    }
  )

  return response.data
}

export async function checkScheduleApi() {
  const response = await axios.options(`${API_BASE}/batch/schedule`, {
    timeout: 5000,
    validateStatus: () => true,
  })

  return response.status >= 200 && response.status < 500
}

export async function getRecentBatchRuns({ limit = 5, status = "", batchId = "" } = {}) {
  const response = await axios.get(`${API_BASE}/batch/runs`, {
    params: {
      limit,
      status: status || undefined,
      batchId: batchId || undefined,
    },
    timeout: 10000,
  })

  return response.data
}

export async function getScheduleMetrics({ limit = 10, upcomingOnly = false, batchId = "" } = {}) {
  const response = await axios.get(`${API_BASE}/batch/schedules/recent`, {
    params: {
      limit,
      upcomingOnly: upcomingOnly || undefined,
      batchId: batchId || undefined,
    },
    timeout: 10000,
  })

  return response.data
}

export async function getAdminSummary() {
  const response = await axios.get(`${API_BASE}/batch/admin/summary`, {
    timeout: 10000,
  })

  return response.data
}
