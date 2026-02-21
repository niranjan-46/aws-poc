package com.dsedify.batchscheduler.dto;

import java.time.Instant;

public record ScheduledBatchItem(
        String batchId,
        String scheduleName,
        String status,
        Instant createdAt,
        Instant nextRunAt
) {
}
