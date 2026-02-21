package com.dsedify.batchscheduler.dto;

import jakarta.validation.constraints.NotBlank;

public class BatchRunRequest {

    @NotBlank(message = "batchId is required")
    private String batchId;
    private String scheduleName;

    public String getBatchId() {
        return batchId;
    }

    public void setBatchId(String batchId) {
        this.batchId = batchId;
    }

    public String getScheduleName() {
        return scheduleName;
    }

    public void setScheduleName(String scheduleName) {
        this.scheduleName = scheduleName;
    }
}
