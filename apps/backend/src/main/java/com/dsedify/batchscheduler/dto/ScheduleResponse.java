package com.dsedify.batchscheduler.dto;

import java.time.Instant;

public record ScheduleResponse(
        String scheduleName,
        String batchId,
        Instant createdAt,
        Instant nextRunAt
) {
}
