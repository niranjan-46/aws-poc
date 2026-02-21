package com.dsedify.batchscheduler.dto;

import java.time.Instant;

public record RunSummaryResponse(
        int totalRuns,
        int passedRuns,
        int failedRuns,
        long averageDurationMs,
        Instant lastRunAt,
        String lastRunStatus
) {
}
