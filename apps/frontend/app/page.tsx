"use client"

import { motion } from "framer-motion"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import ScheduleForm from "../components/ScheduleForm"
import { checkScheduleApi, getAdminSummary, getRecentBatchRuns, getScheduleMetrics } from "../lib/api"
import { REPOSITORY_URL } from "../lib/projectMeta"

const LOGO_URL =
  "https://www.dsedify.com/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fds-edify-navbar.c0e8c6be.png&w=1920&q=75"
const LOGO_FALLBACK_URL = "/dsedify-logo.svg"

type RequestSummary = {
  batchId: string
  jobType: string
  cronExpression: string
  timezone: string
  scheduleName: string
  createdAt: string
  nextRunAt: string | null
}

type BatchRunItem = {
  batchId: string
  status: string
  durationMs: number
  startedAt: string
  finishedAt: string
}

type ScheduledBatchItem = {
  batchId: string
  scheduleName: string
  status: string
  createdAt: string
  nextRunAt: string | null
}

type AdminSummary = {
  totalScheduled: number
  upcomingScheduled: number
  totalRuns: number
  passedRuns: number
  failedRuns: number
  averageDurationMs: number
  lastRunAt: string | null
  lastRunStatus: string | null
}

const REQUEST_HISTORY_KEY = "scheduler-request-history-v1"
const WELCOME_POPUP_KEY = "scheduler-welcome-popup-dismissed-v1"
const MAX_HISTORY_ITEMS = 10
const MAX_RUN_ITEMS = 8
const MAX_SCHEDULE_ITEMS = 12
const AUTO_REFRESH_SECONDS = 30

const panelClass = "ui-panel ui-panel-soft ui-panel-interactive"
const inputClass = "ui-control"
const ghostButtonClass = "ui-ghost-button px-3 py-2 text-sm"
const primaryButtonClass = "ui-primary-button px-4 py-2 text-sm"
const emptyStateClass = "ui-alert ui-alert-info"

function readInitialTheme() {
  if (typeof window === "undefined") {
    return false
  }

  const savedTheme = localStorage.getItem("theme")
  if (savedTheme) {
    return savedTheme === "dark"
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "n/a"
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString()
}

function formatDuration(durationMs: number) {
  if (!Number.isFinite(durationMs)) {
    return "n/a"
  }

  if (durationMs < 1000) {
    return `${durationMs} ms`
  }

  return `${(durationMs / 1000).toFixed(2)} s`
}

function formatCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`
}

function runStatusClass(status: string) {
  return status === "PASSED"
    ? "ui-status-pill ui-status-pill-pass"
    : "ui-status-pill ui-status-pill-fail"
}

function buildRunKey(item: BatchRunItem) {
  return `${item.batchId}-${item.startedAt}-${item.finishedAt}`
}

function readStoredHistory(): RequestSummary[] {
  if (typeof window === "undefined") {
    return []
  }

  const storedHistory = localStorage.getItem(REQUEST_HISTORY_KEY)
  if (!storedHistory) {
    return []
  }

  try {
    const parsed = JSON.parse(storedHistory)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    localStorage.removeItem(REQUEST_HISTORY_KEY)
    return []
  }
}

function normalizeFilter(value: string) {
  return value.trim()
}

function isWelcomePopupDismissed() {
  if (typeof window === "undefined") {
    return true
  }

  return localStorage.getItem(WELCOME_POPUP_KEY) === "true"
}

export default function Home() {
  const [dark, setDark] = useState(readInitialTheme)
  const [logoSrc, setLogoSrc] = useState(LOGO_URL)
  const [showWelcomePopup, setShowWelcomePopup] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)
  const [clientTimezone, setClientTimezone] = useState("Local")
  const [requestHistory, setRequestHistory] = useState<RequestSummary[]>(readStoredHistory)
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null)
  const [backendStatusMessage, setBackendStatusMessage] = useState("Checking backend connection...")

  const [scheduledCount, setScheduledCount] = useState(0)
  const [scheduledItems, setScheduledItems] = useState<ScheduledBatchItem[]>([])
  const [scheduleLoading, setScheduleLoading] = useState(true)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [scheduleBatchFilter, setScheduleBatchFilter] = useState("")
  const [upcomingOnly, setUpcomingOnly] = useState(false)

  const [recentRuns, setRecentRuns] = useState<BatchRunItem[]>([])
  const [runsLoading, setRunsLoading] = useState(true)
  const [runsError, setRunsError] = useState<string | null>(null)
  const [runsBatchFilter, setRunsBatchFilter] = useState("")
  const [runStatusFilter, setRunStatusFilter] = useState("ALL")
  const [selectedRunKey, setSelectedRunKey] = useState<string | null>(null)

  const [adminSummary, setAdminSummary] = useState<AdminSummary | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [clockMs, setClockMs] = useState(0)
  const [refreshToken, setRefreshToken] = useState(0)

  const latestRequest = requestHistory[0] ?? null
  const selectedRun = recentRuns.find((item) => buildRunKey(item) === selectedRunKey) ?? null

  const scheduleRows = scheduledItems
    .map((item) => {
      const nextRunMs = item.nextRunAt ? new Date(item.nextRunAt).getTime() : null
      return { item, nextRunMs }
    })
    .sort((left, right) => {
      if (left.nextRunMs === null && right.nextRunMs === null) {
        return 0
      }
      if (left.nextRunMs === null) {
        return 1
      }
      if (right.nextRunMs === null) {
        return -1
      }
      return left.nextRunMs - right.nextRunMs
    })

  const upcomingRunsCount = scheduleRows.filter((row) => row.nextRunMs !== null && row.nextRunMs > clockMs).length
  const nextScheduledItem = scheduleRows.find((row) => row.nextRunMs !== null && row.nextRunMs > clockMs)?.item ?? null
  const nextRunCountdown = nextScheduledItem?.nextRunAt
    ? formatCountdown(new Date(nextScheduledItem.nextRunAt).getTime() - clockMs)
    : "No upcoming run"

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
    localStorage.setItem("theme", dark ? "dark" : "light")
  }, [dark])

  useEffect(() => {
    if (!isWelcomePopupDismissed()) {
      setShowWelcomePopup(true)
    }
  }, [])

  useEffect(() => {
    setClientTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "Local")
  }, [])

  useEffect(() => {
    if (!actionMessage) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setActionMessage(null)
    }, 2200)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [actionMessage])

  useEffect(() => {
    setClockMs(Date.now())
    const intervalId = window.setInterval(() => {
      setClockMs(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    let active = true

    const refreshBackendStatus = async () => {
      try {
        const reachable = await checkScheduleApi()
        if (!active) {
          return
        }

        setBackendOnline(reachable)
        setBackendStatusMessage(reachable ? "Connected to scheduler API" : "Scheduler API returned an unexpected response")
        setLastUpdatedAt(new Date().toISOString())
      } catch {
        if (!active) {
          return
        }

        setBackendOnline(false)
        setBackendStatusMessage("Scheduler API is unreachable")
      }
    }

    refreshBackendStatus()
    const intervalId = window.setInterval(refreshBackendStatus, 30000)

    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [refreshToken])

  useEffect(() => {
    let active = true

    const refreshSummary = async () => {
      try {
        const response = await getAdminSummary()
        if (!active) {
          return
        }

        setAdminSummary(response)
        setSummaryError(null)
        setLastUpdatedAt(new Date().toISOString())
      } catch {
        if (!active) {
          return
        }

        setSummaryError("Failed to load admin summary")
      }
    }

    refreshSummary()
    const intervalId = window.setInterval(refreshSummary, 30000)

    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [refreshToken])

  useEffect(() => {
    let active = true

    const refreshScheduleMetrics = async () => {
      try {
        setScheduleLoading(true)

        const response = await getScheduleMetrics({
          limit: MAX_SCHEDULE_ITEMS,
          upcomingOnly,
          batchId: normalizeFilter(scheduleBatchFilter),
        })

        if (!active) {
          return
        }

        setScheduledCount(Number.isFinite(response?.totalScheduled) ? response.totalScheduled : 0)
        setScheduledItems(Array.isArray(response?.recentSchedules) ? response.recentSchedules : [])
        setScheduleError(null)
        setLastUpdatedAt(new Date().toISOString())
      } catch {
        if (!active) {
          return
        }

        setScheduleError("Failed to load scheduled batch metrics")
      } finally {
        if (active) {
          setScheduleLoading(false)
        }
      }
    }

    refreshScheduleMetrics()
    const intervalId = window.setInterval(refreshScheduleMetrics, 30000)

    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [refreshToken, upcomingOnly, scheduleBatchFilter])

  useEffect(() => {
    let active = true

    const refreshRecentRuns = async () => {
      try {
        setRunsLoading(true)

        const response = await getRecentBatchRuns({
          limit: MAX_RUN_ITEMS,
          status: runStatusFilter === "ALL" ? "" : runStatusFilter,
          batchId: normalizeFilter(runsBatchFilter),
        })

        if (!active) {
          return
        }

        const runs = Array.isArray(response) ? response : []
        setRecentRuns(runs)
        setRunsError(null)
        setLastUpdatedAt(new Date().toISOString())
        setSelectedRunKey((current) => {
          if (current && runs.some((item) => buildRunKey(item) === current)) {
            return current
          }

          return runs[0] ? buildRunKey(runs[0]) : null
        })
      } catch {
        if (!active) {
          return
        }

        setRunsError("Failed to load Lambda run history")
      } finally {
        if (active) {
          setRunsLoading(false)
        }
      }
    }

    refreshRecentRuns()
    const intervalId = window.setInterval(refreshRecentRuns, 30000)

    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [refreshToken, runStatusFilter, runsBatchFilter])

  const handleScheduled = (request: RequestSummary) => {
    setRequestHistory((prev) => {
      const next = [request, ...prev].slice(0, MAX_HISTORY_ITEMS)
      localStorage.setItem(REQUEST_HISTORY_KEY, JSON.stringify(next))
      return next
    })

    setScheduledCount((prev) => prev + 1)
    setScheduledItems((prev) => {
      const nextItem: ScheduledBatchItem = {
        batchId: request.batchId,
        scheduleName: request.scheduleName,
        status: "SCHEDULED",
        createdAt: request.createdAt,
        nextRunAt: request.nextRunAt,
      }

      const shouldInclude =
        (upcomingOnly ? !!request.nextRunAt && new Date(request.nextRunAt).getTime() > Date.now() : true) &&
        (normalizeFilter(scheduleBatchFilter)
          ? request.batchId.toLowerCase().includes(normalizeFilter(scheduleBatchFilter).toLowerCase())
          : true)

      if (!shouldInclude) {
        return prev
      }

      return [nextItem, ...prev].slice(0, MAX_SCHEDULE_ITEMS)
    })

    setAdminSummary((prev) => {
      if (!prev) {
        return prev
      }

      const upcomingIncrement = request.nextRunAt && new Date(request.nextRunAt).getTime() > Date.now() ? 1 : 0
      return {
        ...prev,
        totalScheduled: prev.totalScheduled + 1,
        upcomingScheduled: prev.upcomingScheduled + upcomingIncrement,
      }
    })
  }

  const handleManualRefresh = () => {
    setRefreshToken((prev) => prev + 1)
  }

  const downloadJson = (filename: string, payload: unknown) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = filename
    anchor.click()
    window.URL.revokeObjectURL(url)
  }

  const handleExportSnapshot = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      adminSummary,
      backendOnline,
      backendStatusMessage,
      scheduledItems,
      recentRuns,
    }

    downloadJson(`admin-snapshot-${Date.now()}.json`, payload)
  }

  const handleCloseWelcomePopup = () => {
    setShowWelcomePopup(false)
    localStorage.setItem(WELCOME_POPUP_KEY, "true")
  }

  const handleOpenWelcomePopup = () => {
    setShowWelcomePopup(true)
  }

  const handleResetScheduleFilters = () => {
    setScheduleBatchFilter("")
    setUpcomingOnly(false)
  }

  const handleResetRunFilters = () => {
    setRunsBatchFilter("")
    setRunStatusFilter("ALL")
  }

  const handleCopySelectedBatchId = async () => {
    if (!selectedRun) {
      return
    }

    try {
      await navigator.clipboard.writeText(selectedRun.batchId)
      setActionMessage("Batch ID copied")
    } catch {
      setActionMessage("Copy failed")
    }
  }

  const handleExportSelectedRun = () => {
    if (!selectedRun) {
      return
    }

    const safeBatchId = selectedRun.batchId.replace(/[^a-zA-Z0-9_-]/g, "-")
    downloadJson(`run-${safeBatchId}-${Date.now()}.json`, selectedRun)
    setActionMessage("Run JSON exported")
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="dashboard-grid pointer-events-none absolute inset-0 opacity-25 dark:opacity-15" />

      {showWelcomePopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-[2px]">
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="ui-panel ui-panel-soft w-full max-w-lg p-5 md:p-6"
          >
            <h2 className="ui-section-title text-xl text-slate-900 dark:text-slate-100">Welcome</h2>
            <p className="mt-1 text-sm ui-muted">
              This dashboard helps you run and monitor batch schedules from one place.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="ui-chip ui-chip-brand">Schedule</span>
              <span className="ui-chip ui-chip-neutral">Batch ID</span>
              <span className="ui-chip ui-chip-neutral">Next Run</span>
              <span className="ui-chip ui-chip-neutral">Run Status</span>
              <span className="ui-chip ui-chip-neutral">History</span>
              <span className="ui-chip ui-chip-neutral">Export</span>
            </div>

            <div className="mt-5 flex justify-end">
              <button type="button" onClick={handleCloseWelcomePopup} className={primaryButtonClass}>
                Start
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1320px] flex-col px-3 py-4 sm:px-5 sm:py-6 lg:px-10">
        <header className={`${panelClass} mb-6 overflow-hidden p-0`}>
          <div className="bg-slate-900 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-200 dark:bg-slate-950">
            AWS Batch Scheduler Console
          </div>
          <div className="flex flex-col gap-5 p-4 sm:p-5 md:p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="relative h-10 w-36 overflow-hidden rounded-xl border border-slate-200/80 bg-white/90 p-1.5 shadow-sm sm:h-11 sm:w-44 dark:border-slate-600/50 dark:bg-slate-950/60">
                <Image
                  src={logoSrc}
                  alt="DSEdify"
                  fill
                  className="object-contain"
                  priority
                  unoptimized
                  onError={() => setLogoSrc(LOGO_FALLBACK_URL)}
                />
              </div>

              <div>
                <h1 className="ui-heading-tight text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
                  Enterprise Batch Scheduler
                </h1>
                <p className="text-sm ui-muted">
                  Operational console for scheduling, execution tracking, and audit visibility.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="ui-chip ui-chip-brand">ADMIN WORKSPACE</span>
                  <span className="ui-chip ui-chip-neutral">
                    {backendOnline === null ? "API CHECKING" : backendOnline ? "API ONLINE" : "API OFFLINE"}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid w-full gap-2 sm:w-auto sm:grid-flow-col sm:auto-cols-max">
              <button onClick={handleManualRefresh} className={`${ghostButtonClass} w-full sm:w-auto`}>
                Refresh
              </button>
              <button onClick={handleExportSnapshot} className={`${ghostButtonClass} w-full sm:w-auto`}>
                Export JSON
              </button>
              <Link href="/guides/architecture" className={`${ghostButtonClass} w-full text-center sm:w-auto`}>
                Architecture
              </Link>
              <button onClick={handleOpenWelcomePopup} className={`${ghostButtonClass} w-full sm:w-auto`}>
                Help
              </button>
              <button
                onClick={() => setDark((prev) => !prev)}
                className={`${primaryButtonClass} w-full sm:w-auto`}
              >
                {dark ? "Light Mode" : "Dark Mode"}
              </button>
            </div>
          </div>
        </header>

        <section className={`${panelClass} mb-4 p-4`}>
          <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide ui-muted">Last Updated</p>
              <p className="mt-1 text-slate-900 dark:text-slate-100">{formatDateTime(lastUpdatedAt)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide ui-muted">Auto Refresh</p>
              <p className="mt-1 text-slate-900 dark:text-slate-100">Every {AUTO_REFRESH_SECONDS}s</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide ui-muted">Client Timezone</p>
              <p className="mt-1 break-all text-slate-900 dark:text-slate-100">{clientTimezone}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide ui-muted">Quick Tip</p>
              <p className="mt-1 text-slate-900 dark:text-slate-100">Use filter + export for audits.</p>
            </div>
          </div>
        </section>

        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className={`${panelClass} p-4`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Backend</p>
            <p
              className={`ui-kpi-value mt-2 font-bold ${
                backendOnline === null
                  ? "text-amber-600 dark:text-amber-300"
                  : backendOnline
                    ? "ui-status-good"
                    : "ui-status-bad"
              }`}
            >
              {backendOnline === null ? "Checking..." : backendOnline ? "Online" : "Offline"}
            </p>
            <p className="mt-1 text-xs ui-muted">{backendStatusMessage}</p>
          </div>

          <div className={`${panelClass} p-4`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Schedules</p>
            <p className="ui-kpi-value mt-2 font-bold text-slate-900 dark:text-slate-100">
              {adminSummary?.totalScheduled ?? scheduledCount}
            </p>
            <p className="mt-1 text-xs ui-muted">
              Upcoming: {adminSummary?.upcomingScheduled ?? upcomingRunsCount}
            </p>
          </div>

          <div className={`${panelClass} p-4`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Run Health</p>
            <p className="ui-kpi-value mt-2 font-bold text-slate-900 dark:text-slate-100">
              {adminSummary?.passedRuns ?? 0} / {adminSummary?.failedRuns ?? 0}
            </p>
            <p className="mt-1 text-xs ui-muted">
              Avg duration: {formatDuration(adminSummary?.averageDurationMs ?? 0)}
            </p>
          </div>

          <div className={`${panelClass} p-4`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Next Run Timer</p>
            <p className="ui-kpi-value mt-2 font-bold text-slate-900 dark:text-slate-100">{nextRunCountdown}</p>
            <p className="mt-1 truncate text-xs ui-muted">
              {nextScheduledItem ? nextScheduledItem.batchId : "No upcoming date/time run"}
            </p>
          </div>
        </section>

        {summaryError && (
          <div className="ui-alert ui-alert-error mb-6">
            {summaryError}
          </div>
        )}

        {actionMessage && (
          <div className="ui-alert ui-alert-info mb-6">
            {actionMessage}
          </div>
        )}

        <main className="grid flex-1 items-start gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className={`${panelClass} p-6 md:p-7`}
          >
            <div className="mb-6 border-b border-slate-200/80 pb-4 dark:border-slate-600/40">
              <h2 className="ui-section-title text-xl text-slate-900 dark:text-slate-100">Create Schedule</h2>
              <p className="mt-1 text-sm ui-muted">
                Generate a unique batch ID and create a production schedule.
              </p>
            </div>

            <ScheduleForm onScheduled={handleScheduled} />
          </motion.section>

          <div className="space-y-5">
            <motion.aside
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04, duration: 0.35 }}
              className={`${panelClass} p-5`}
            >
              <h3 className="ui-section-title text-lg text-slate-900 dark:text-slate-100">Latest Request</h3>
              <p className="mt-1 text-sm ui-muted">
                Most recent submission details.
              </p>

              {latestRequest ? (
                <dl className="ui-list-item mt-4 space-y-3 p-4">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Batch ID</dt>
                    <dd className="mt-1 break-all font-mono text-xs text-slate-800 dark:text-slate-200">{latestRequest.batchId}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Schedule Name</dt>
                    <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">{latestRequest.scheduleName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Next Run</dt>
                    <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">{formatDateTime(latestRequest.nextRunAt)}</dd>
                  </div>
                </dl>
              ) : (
                <div className={`mt-4 ${emptyStateClass}`}>
                  No requests submitted yet.
                </div>
              )}
            </motion.aside>

            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.35 }}
              className={`${panelClass} p-5`}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="ui-section-title text-lg text-slate-900 dark:text-slate-100">Scheduled Runs</h3>
                <div className="flex items-center gap-2">
                  <span className="ui-chip ui-chip-brand">
                    Last {MAX_SCHEDULE_ITEMS}
                  </span>
                  <button
                    type="button"
                    onClick={handleResetScheduleFilters}
                    className="ui-ghost-button px-2.5 py-1 text-xs"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <input
                  type="text"
                  value={scheduleBatchFilter}
                  onChange={(e) => setScheduleBatchFilter(e.target.value)}
                  placeholder="Search by batch ID"
                  className={inputClass}
                />
                <label className="ui-list-item inline-flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={upcomingOnly}
                    onChange={(e) => setUpcomingOnly(e.target.checked)}
                    className="h-4 w-4 accent-sky-600"
                  />
                  Upcoming only
                </label>
              </div>

              {scheduleLoading ? (
                <div className={emptyStateClass}>
                  Loading scheduled runs...
                </div>
              ) : scheduleError ? (
                <div className="ui-alert ui-alert-error">
                  {scheduleError}
                </div>
              ) : scheduleRows.length === 0 ? (
                <div className={emptyStateClass}>
                  No schedules match the current filter.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {scheduleRows.map(({ item, nextRunMs }) => (
                    <div
                      key={item.scheduleName}
                      className="ui-list-item p-3"
                    >
                      <p className="break-all font-mono text-xs text-slate-800 dark:text-slate-200">Run ID: {item.batchId}</p>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Run at: {formatDateTime(item.nextRunAt)}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Gap: {nextRunMs && nextRunMs > clockMs ? formatCountdown(nextRunMs - clockMs) : item.nextRunAt ? "0m 00s" : "Not available"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.35 }}
              className={`${panelClass} p-5`}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="ui-section-title text-lg text-slate-900 dark:text-slate-100">Lambda Run History</h3>
                <div className="flex items-center gap-2">
                  <span className="ui-chip ui-chip-brand">
                    Last {MAX_RUN_ITEMS}
                  </span>
                  <button
                    type="button"
                    onClick={handleResetRunFilters}
                    className="ui-ghost-button px-2.5 py-1 text-xs"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px]">
                <input
                  type="text"
                  value={runsBatchFilter}
                  onChange={(e) => setRunsBatchFilter(e.target.value)}
                  placeholder="Search by batch ID"
                  className={inputClass}
                />
                <select
                  value={runStatusFilter}
                  onChange={(e) => setRunStatusFilter(e.target.value)}
                  className={inputClass}
                >
                  <option value="ALL">ALL</option>
                  <option value="PASSED">PASSED</option>
                  <option value="FAILED">FAILED</option>
                </select>
              </div>

              {runsLoading ? (
                <div className={emptyStateClass}>
                  Loading run history...
                </div>
              ) : runsError ? (
                <div className="ui-alert ui-alert-error">
                  {runsError}
                </div>
              ) : recentRuns.length === 0 ? (
                <div className={emptyStateClass}>
                  No run history for this filter.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    {recentRuns.map((item) => {
                      const itemKey = buildRunKey(item)

                      return (
                        <button
                          key={itemKey}
                          type="button"
                          onClick={() => setSelectedRunKey(itemKey)}
                          className={`w-full rounded-xl border p-3 text-left transition ${
                            selectedRunKey === itemKey
                              ? "ui-list-item-active"
                              : "ui-list-item"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate font-mono text-xs text-slate-800 dark:text-slate-200">{item.batchId}</p>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${runStatusClass(item.status)}`}>
                              {item.status}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatDateTime(item.finishedAt)}</p>
                        </button>
                      )
                    })}
                  </div>

                  {selectedRun && (
                    <dl className="ui-list-item space-y-2 p-4">
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Batch ID</dt>
                        <dd className="mt-1 break-all font-mono text-xs text-slate-800 dark:text-slate-200">{selectedRun.batchId}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</dt>
                        <dd className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200">{selectedRun.status}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Started At</dt>
                        <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">{formatDateTime(selectedRun.startedAt)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Finished At</dt>
                        <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">{formatDateTime(selectedRun.finishedAt)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Duration</dt>
                        <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">{formatDuration(selectedRun.durationMs)}</dd>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleCopySelectedBatchId}
                          className="ui-ghost-button px-2.5 py-1 text-xs"
                        >
                          Copy Batch ID
                        </button>
                        <button
                          type="button"
                          onClick={handleExportSelectedRun}
                          className="ui-ghost-button px-2.5 py-1 text-xs"
                        >
                          Export Run
                        </button>
                      </div>
                    </dl>
                  )}
                </div>
              )}
            </motion.section>
          </div>
        </main>

        <section className={`${panelClass} mt-6 p-4 sm:p-5`}>
          <h3 className="ui-section-title text-lg text-slate-900 dark:text-slate-100">Architecture and File Flow</h3>
          <p className="mt-1 text-sm ui-muted">
            Open the dedicated architecture page for one consolidated frontend + backend artifact view with indented flows, file structure, validations, cron standards, and deployment details.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/guides/architecture" className="ui-primary-button px-3 py-2 text-sm">
              Open Architecture View
            </Link>
            <a
              href={REPOSITORY_URL}
              target="_blank"
              rel="noreferrer"
              className="ui-ghost-button px-3 py-2 text-sm"
            >
              GitHub Repository
            </a>
          </div>
        </section>

        <footer className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
          © 2026 DSEdify Scheduler Workspace
        </footer>
      </div>
    </div>
  )
}
