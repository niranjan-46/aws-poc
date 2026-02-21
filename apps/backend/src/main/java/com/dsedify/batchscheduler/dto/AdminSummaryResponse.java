package com.dsedify.batchscheduler.dto;

import java.time.Instant;

public record AdminSummaryResponse(
        int totalScheduled,
        int upcomingScheduled,
        int totalRuns,
        int passedRuns,
        int failedRuns,
        long averageDurationMs,
        Instant lastRunAt,
        String lastRunStatus
) {
}
