package com.dsedify.batchscheduler.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import java.time.Instant;

public class ScheduleRequest {

    @NotBlank(message = "batchId is required")
    @Pattern(regexp = "^[A-Za-z0-9_-]{3,64}$", message = "batchId must be 3-64 chars and only letters/numbers/_/-")
    private String batchId;

    @NotBlank(message = "cronExpression is required")
    private String cronExpression;

    @NotBlank(message = "timezone is required")
    private String timezone;

    private Instant nextRunAt;

    public String getBatchId() {
        return batchId;
    }

    public void setBatchId(String batchId) {
        this.batchId = batchId;
    }

    public String getCronExpression() {
        return cronExpression;
    }

    public void setCronExpression(String cronExpression) {
        this.cronExpression = cronExpression;
    }

    public String getTimezone() {
        return timezone;
    }

    public void setTimezone(String timezone) {
        this.timezone = timezone;
    }

    public Instant getNextRunAt() {
        return nextRunAt;
    }

    public void setNextRunAt(Instant nextRunAt) {
        this.nextRunAt = nextRunAt;
    }
}
