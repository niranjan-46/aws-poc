package com.dsedify.batchscheduler.controller;

import com.dsedify.batchscheduler.dto.AdminSummaryResponse;
import com.dsedify.batchscheduler.dto.RunSummaryResponse;
import com.dsedify.batchscheduler.service.BatchExecutionService;
import com.dsedify.batchscheduler.service.BatchSchedulerService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/batch/admin")
public class BatchAdminController {

    private final BatchSchedulerService batchSchedulerService;
    private final BatchExecutionService batchExecutionService;

    public BatchAdminController(BatchSchedulerService batchSchedulerService, BatchExecutionService batchExecutionService) {
        this.batchSchedulerService = batchSchedulerService;
        this.batchExecutionService = batchExecutionService;
    }

    @GetMapping("/summary")
    public ResponseEntity<AdminSummaryResponse> getSummary() {
        RunSummaryResponse runSummary = batchExecutionService.getRunSummary();

        AdminSummaryResponse summary = new AdminSummaryResponse(
                batchSchedulerService.getTotalScheduledCount(),
                batchSchedulerService.getUpcomingScheduledCount(),
                runSummary.totalRuns(),
                runSummary.passedRuns(),
                runSummary.failedRuns(),
                runSummary.averageDurationMs(),
                runSummary.lastRunAt(),
                runSummary.lastRunStatus()
        );

        return ResponseEntity.ok(summary);
    }
}
