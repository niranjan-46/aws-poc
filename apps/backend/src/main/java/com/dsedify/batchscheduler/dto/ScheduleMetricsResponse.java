package com.dsedify.batchscheduler.dto;

import java.util.List;

public record ScheduleMetricsResponse(
        int totalScheduled,
        int upcomingScheduled,
        List<ScheduledBatchItem> recentSchedules
) {
}
