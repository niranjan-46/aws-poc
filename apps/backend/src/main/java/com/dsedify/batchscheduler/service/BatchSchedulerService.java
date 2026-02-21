package com.dsedify.batchscheduler.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.dsedify.batchscheduler.config.AppProperties;
import com.dsedify.batchscheduler.dto.ScheduleMetricsResponse;
import com.dsedify.batchscheduler.dto.ScheduleRequest;
import com.dsedify.batchscheduler.dto.ScheduleResponse;
import com.dsedify.batchscheduler.dto.ScheduledBatchItem;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.scheduler.model.ActionAfterCompletion;
import software.amazon.awssdk.services.scheduler.SchedulerClient;
import software.amazon.awssdk.services.scheduler.model.CreateScheduleRequest;
import software.amazon.awssdk.services.scheduler.model.DeleteScheduleRequest;
import software.amazon.awssdk.services.scheduler.model.FlexibleTimeWindow;
import software.amazon.awssdk.services.scheduler.model.FlexibleTimeWindowMode;
import software.amazon.awssdk.services.scheduler.model.ResourceNotFoundException;
import software.amazon.awssdk.services.scheduler.model.RetryPolicy;
import software.amazon.awssdk.services.scheduler.model.Target;

import java.time.Instant;
import java.time.ZoneId;
import java.time.zone.ZoneRulesException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

@Service
public class BatchSchedulerService {

    private static final Logger LOGGER = LoggerFactory.getLogger(BatchSchedulerService.class);
    private static final Pattern SCHEDULE_EXPRESSION_PATTERN = Pattern.compile("^(cron|rate)\\(.+\\)$");
    private static final String SCHEDULED_STATUS = "SCHEDULED";
    private static final int MAX_SCHEDULE_HISTORY = 200;

    private final SchedulerClient schedulerClient;
    private final ObjectMapper objectMapper;
    private final AppProperties appProperties;
    private final AuditLogService auditLogService;
    private final Deque<ScheduledBatchItem> scheduleHistory = new ArrayDeque<>();
    private final Set<String> scheduledBatchIds = new HashSet<>();

    public BatchSchedulerService(
            SchedulerClient schedulerClient,
            ObjectMapper objectMapper,
            AppProperties appProperties,
            AuditLogService auditLogService
    ) {
        this.schedulerClient = schedulerClient;
        this.objectMapper = objectMapper;
        this.appProperties = appProperties;
        this.auditLogService = auditLogService;
    }

    public ScheduleResponse scheduleBatch(ScheduleRequest request) {
        validateRequest(request);
        validateRequiredConfig();
        reserveBatchId(request.getBatchId());

        String scheduleName = buildScheduleName(request.getBatchId());
        String targetInput = createTargetPayload(request.getBatchId(), scheduleName);

        CreateScheduleRequest createScheduleRequest = CreateScheduleRequest.builder()
                .name(scheduleName)
                .groupName(appProperties.getSchedulerGroupName())
                .scheduleExpression(request.getCronExpression())
                .scheduleExpressionTimezone(request.getTimezone())
                .actionAfterCompletion(ActionAfterCompletion.DELETE)
                .flexibleTimeWindow(FlexibleTimeWindow.builder()
                        .mode(FlexibleTimeWindowMode.OFF)
                        .build())
                .target(Target.builder()
                        .arn(appProperties.getLambdaArn())
                        .roleArn(appProperties.getSchedulerRoleArn())
                        .input(targetInput)
                        .retryPolicy(RetryPolicy.builder()
                                .maximumRetryAttempts(2)
                                .build())
                        .build())
                .build();

        try {
            schedulerClient.createSchedule(createScheduleRequest);
        } catch (Exception exception) {
            releaseBatchId(request.getBatchId());
            throw exception;
        }

        Instant createdAt = Instant.now();
        ScheduledBatchItem scheduledBatchItem = new ScheduledBatchItem(
                request.getBatchId(),
                scheduleName,
                SCHEDULED_STATUS,
                createdAt,
                request.getNextRunAt()
        );
        addScheduleHistory(scheduledBatchItem);

        Map<String, Object> auditRecord = new LinkedHashMap<>();
        auditRecord.put("batchId", request.getBatchId());
        auditRecord.put("scheduleName", scheduleName);
        auditRecord.put("cronExpression", request.getCronExpression());
        auditRecord.put("timezone", request.getTimezone());
        auditRecord.put("createdAt", createdAt.toString());
        auditRecord.put("status", SCHEDULED_STATUS);
        if (request.getNextRunAt() != null) {
            auditRecord.put("nextRunAt", request.getNextRunAt().toString());
        }

        auditLogService.writeAudit("schedules", request.getBatchId(), "%s.json".formatted(scheduleName), auditRecord);

        return new ScheduleResponse(scheduleName, request.getBatchId(), createdAt, request.getNextRunAt());
    }

    public void completeSchedule(String scheduleName, String batchId) {
        if (!isBlank(scheduleName)) {
            try {
                schedulerClient.deleteSchedule(DeleteScheduleRequest.builder()
                        .name(scheduleName)
                        .groupName(appProperties.getSchedulerGroupName())
                        .build());
            } catch (ResourceNotFoundException ignored) {
                // Schedule already removed by EventBridge actionAfterCompletion or prior cleanup.
            } catch (Exception exception) {
                LOGGER.warn("Failed to delete schedule '{}' in group '{}': {}",
                        scheduleName,
                        appProperties.getSchedulerGroupName(),
                        exception.getMessage());
            }
        }

        if (!isBlank(batchId)) {
            releaseBatchId(batchId);
        }
        if (!isBlank(scheduleName)) {
            removeScheduleFromHistory(scheduleName);
        }
    }

    public synchronized ScheduleMetricsResponse getScheduleMetrics(int limit, Boolean upcomingOnly, String batchId) {
        int safeLimit = Math.max(1, Math.min(limit, MAX_SCHEDULE_HISTORY));
        String normalizedBatchId = normalizeFilter(batchId);
        boolean upcomingFilter = Boolean.TRUE.equals(upcomingOnly);
        Instant now = Instant.now();

        List<ScheduledBatchItem> recentSchedules = new ArrayList<>(safeLimit);
        int upcomingScheduled = 0;

        for (ScheduledBatchItem item : scheduleHistory) {
            boolean isUpcoming = item.nextRunAt() != null && item.nextRunAt().isAfter(now);
            if (isUpcoming) {
                upcomingScheduled++;
            }
            if (upcomingFilter && !isUpcoming) {
                continue;
            }
            if (normalizedBatchId != null && !item.batchId().toLowerCase(Locale.ROOT).contains(normalizedBatchId)) {
                continue;
            }
            if (recentSchedules.size() >= safeLimit) {
                continue;
            }

            recentSchedules.add(item);
        }

        return new ScheduleMetricsResponse(scheduledBatchIds.size(), upcomingScheduled, recentSchedules);
    }

    public synchronized int getTotalScheduledCount() {
        return scheduledBatchIds.size();
    }

    public synchronized int getUpcomingScheduledCount() {
        Instant now = Instant.now();
        int upcomingCount = 0;

        for (ScheduledBatchItem item : scheduleHistory) {
            if (item.nextRunAt() != null && item.nextRunAt().isAfter(now)) {
                upcomingCount++;
            }
        }

        return upcomingCount;
    }

    private void validateRequest(ScheduleRequest request) {
        if (!SCHEDULE_EXPRESSION_PATTERN.matcher(request.getCronExpression().trim()).matches()) {
            throw new IllegalArgumentException("cronExpression must be a valid EventBridge cron(...) or rate(...) expression");
        }

        try {
            ZoneId.of(request.getTimezone());
        } catch (ZoneRulesException exception) {
            throw new IllegalArgumentException("timezone is invalid: " + request.getTimezone());
        }
    }

    private void validateRequiredConfig() {
        if (isBlank(appProperties.getLambdaArn())) {
            throw new IllegalStateException("LAMBDA_ARN is not configured");
        }
        if (isBlank(appProperties.getSchedulerRoleArn())) {
            throw new IllegalStateException("SCHEDULER_ROLE_ARN is not configured");
        }
    }

    private String createTargetPayload(String batchId, String scheduleName) {
        Map<String, String> payload = Map.of(
                "batchId", batchId,
                "scheduleName", scheduleName,
                "requestedAt", Instant.now().toString()
        );

        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to serialize scheduler input payload", exception);
        }
    }

    private String buildScheduleName(String batchId) {
        String normalized = batchId.toLowerCase().replaceAll("[^a-z0-9-]", "-");
        String prefix = normalized.length() > 35 ? normalized.substring(0, 35) : normalized;
        return "batch-%s-%d".formatted(prefix, System.currentTimeMillis());
    }

    private synchronized void reserveBatchId(String batchId) {
        if (scheduledBatchIds.contains(batchId)) {
            throw new IllegalArgumentException("batchId already exists. Use a unique batchId");
        }
        scheduledBatchIds.add(batchId);
    }

    private synchronized void releaseBatchId(String batchId) {
        scheduledBatchIds.remove(batchId);
    }

    private synchronized void addScheduleHistory(ScheduledBatchItem item) {
        scheduleHistory.addFirst(item);
        while (scheduleHistory.size() > MAX_SCHEDULE_HISTORY) {
            scheduleHistory.removeLast();
        }
    }

    private synchronized void removeScheduleFromHistory(String scheduleName) {
        scheduleHistory.removeIf(item -> scheduleName.equals(item.scheduleName()));
    }

    private String normalizeFilter(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return null;
        }

        return trimmed.toLowerCase(Locale.ROOT);
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
