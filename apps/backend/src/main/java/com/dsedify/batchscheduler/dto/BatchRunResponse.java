package com.dsedify.batchscheduler.dto;

import java.time.Instant;

public record BatchRunResponse(
        String batchId,
        String status,
        long durationMs,
        Instant startedAt,
        Instant finishedAt
) {
}
