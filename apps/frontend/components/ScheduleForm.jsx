"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { createSchedule } from "../lib/api"

const JOB_TYPES = ["coding", "mca", "subject", "algorithm", "qa"]
const TIMEZONES = ["Asia/Kolkata", "UTC", "America/New_York"]

const EXPRESSION_MODES = {
  DATETIME: "datetime",
  CRON: "cron",
}

function generateBatchId(type) {
  const timestamp = Date.now()
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)

  return `${type.toUpperCase()}-${timestamp}-${randomPart}`
}

function convertToCron(dateTime) {
  if (!dateTime) {
    return ""
  }

  const date = new Date(dateTime)
  if (Number.isNaN(date.getTime())) {
    return ""
  }

  const minutes = date.getMinutes()
  const hours = date.getHours()
  const day = date.getDate()
  const month = date.getMonth() + 1
  const year = date.getFullYear()

  return `cron(${minutes} ${hours} ${day} ${month} ? ${year})`
}

function isScheduleExpressionValid(expression) {
  return /^((cron|rate)\(.+\))$/.test(expression.trim())
}

function toDateTimeLocalValue(date) {
  const pad = (value) => value.toString().padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function ScheduleForm({ onScheduled }) {
  const [jobType, setJobType] = useState("coding")

  const [expressionMode, setExpressionMode] = useState(EXPRESSION_MODES.DATETIME)
  const [scheduleDateTime, setScheduleDateTime] = useState("")
  const [cronExpression, setCronExpression] = useState("")
  const [timezone, setTimezone] = useState("Asia/Kolkata")

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  const resolvedCronExpression = useMemo(() => {
    if (expressionMode === EXPRESSION_MODES.CRON) {
      return cronExpression.trim()
    }

    return convertToCron(scheduleDateTime)
  }, [expressionMode, cronExpression, scheduleDateTime])

  const setAlarmAfterMinutes = (minutes) => {
    const target = new Date(Date.now() + minutes * 60000)
    setExpressionMode(EXPRESSION_MODES.DATETIME)
    setScheduleDateTime(toDateTimeLocalValue(target))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    setError(null)

    if (!resolvedCronExpression) {
      setError("Please provide a valid date/time or cron expression")
      setLoading(false)
      return
    }

    if (
      expressionMode === EXPRESSION_MODES.CRON &&
      !isScheduleExpressionValid(resolvedCronExpression)
    ) {
      setError("Cron expression must be in EventBridge format: cron(...) or rate(...)")
      setLoading(false)
      return
    }

    const uniqueBatchId = generateBatchId(jobType)
    const parsedNextRunAt = new Date(scheduleDateTime)
    const nextRunAt =
      expressionMode === EXPRESSION_MODES.DATETIME &&
      scheduleDateTime &&
      !Number.isNaN(parsedNextRunAt.getTime())
        ? parsedNextRunAt.toISOString()
        : null

    try {
      const response = await createSchedule({
        batchId: uniqueBatchId,
        cronExpression: resolvedCronExpression,
        timezone,
        nextRunAt,
      })

      const scheduleName = response?.scheduleName ?? "Not returned by API"
      setMessage(`Schedule created for ${uniqueBatchId} (${scheduleName})`)

      if (typeof onScheduled === "function") {
        onScheduled({
          batchId: uniqueBatchId,
          jobType: jobType.toUpperCase(),
          cronExpression: resolvedCronExpression,
          timezone,
          scheduleName,
          createdAt: new Date().toISOString(),
          nextRunAt,
        })
      }

      setScheduleDateTime("")
      setCronExpression("")
    } catch (err) {
      const backendMessage = err?.response?.data?.message
      setError(backendMessage || "Failed to schedule batch")
    }

    setLoading(false)
  }

  const fieldClass =
    "ui-control mt-1"
  const labelClass = "block text-sm font-semibold text-slate-700 dark:text-slate-200"
  const quickButtonClass = "ui-ghost-button px-2.5 py-1 text-xs"

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className={labelClass}>Job Type</label>
          <select
            value={jobType}
            onChange={(e) => setJobType(e.target.value)}
            className={fieldClass}
          >
            {JOB_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Timezone</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className={fieldClass}
          >
            {TIMEZONES.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="ui-alert ui-alert-info text-xs">
        Unique batch code is auto-generated per request and propagated to backend, EventBridge, and audit logs.
      </div>

      <div>
        <label className={labelClass}>Schedule Mode</label>
        <div className="mt-2 flex w-full rounded-xl border border-slate-300/80 bg-slate-100/90 p-1 dark:border-slate-600/45 dark:bg-slate-950/50 sm:w-fit">
          <button
            type="button"
            onClick={() => setExpressionMode(EXPRESSION_MODES.DATETIME)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition sm:flex-none ${
              expressionMode === EXPRESSION_MODES.DATETIME
                ? "ui-primary-button border-0 px-4 py-2 text-sm"
                : "text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
            }`}
          >
            Date/Time
          </button>

          <button
            type="button"
            onClick={() => setExpressionMode(EXPRESSION_MODES.CRON)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition sm:flex-none ${
              expressionMode === EXPRESSION_MODES.CRON
                ? "ui-primary-button border-0 px-4 py-2 text-sm"
                : "text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
            }`}
          >
            Cron
          </button>
        </div>
      </div>

      {expressionMode === EXPRESSION_MODES.DATETIME ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className={labelClass}>Schedule Date & Time</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAlarmAfterMinutes(5)}
                className={quickButtonClass}
              >
                +5 min
              </button>
              <button
                type="button"
                onClick={() => setAlarmAfterMinutes(15)}
                className={quickButtonClass}
              >
                +15 min
              </button>
              <button
                type="button"
                onClick={() => setAlarmAfterMinutes(30)}
                className={quickButtonClass}
              >
                +30 min
              </button>
            </div>
          </div>

          <input
            type="datetime-local"
            required
            value={scheduleDateTime}
            onChange={(e) => setScheduleDateTime(e.target.value)}
            className={fieldClass}
          />

          {resolvedCronExpression && (
            <p className="ui-alert ui-alert-info text-xs">
              Generated expression: <span className="font-mono">{resolvedCronExpression}</span>
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <label className={labelClass}>Cron Expression</label>
          <input
            type="text"
            required
            value={cronExpression}
            onChange={(e) => setCronExpression(e.target.value)}
            placeholder="cron(0 10 * * ? *)"
            className={`${fieldClass} font-mono`}
          />
          <p className="ui-alert ui-alert-info text-xs">
            Use EventBridge format: <span className="font-mono">cron(...)</span> or <span className="font-mono">rate(...)</span>.
          </p>
        </div>
      )}

      <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        type="submit"
        disabled={loading}
        className="ui-primary-button ui-heading w-full py-3 text-sm font-bold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? "Scheduling..." : "Create Schedule Request"}
      </motion.button>

      {message && (
        <div className="ui-alert ui-alert-success text-sm font-semibold">
          {message}
        </div>
      )}

      {error && (
        <div className="ui-alert ui-alert-error text-sm font-semibold">
          {error}
        </div>
      )}
    </motion.form>
  )
}
