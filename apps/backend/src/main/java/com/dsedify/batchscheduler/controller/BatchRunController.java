package com.dsedify.batchscheduler.controller;

import com.dsedify.batchscheduler.config.AppProperties;
import com.dsedify.batchscheduler.dto.BatchRunRequest;
import com.dsedify.batchscheduler.dto.BatchRunResponse;
import com.dsedify.batchscheduler.service.BatchExecutionService;
import com.dsedify.batchscheduler.service.BatchSchedulerService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Objects;

@RestController
@RequestMapping("/api/batch")
public class BatchRunController {

    private static final String SECRET_HEADER = "X-Scheduler-Secret";

    private final BatchExecutionService batchExecutionService;
    private final BatchSchedulerService batchSchedulerService;
    private final AppProperties appProperties;

    public BatchRunController(
            BatchExecutionService batchExecutionService,
            BatchSchedulerService batchSchedulerService,
            AppProperties appProperties
    ) {
        this.batchExecutionService = batchExecutionService;
        this.batchSchedulerService = batchSchedulerService;
        this.appProperties = appProperties;
    }

    @PostMapping("/run")
    public ResponseEntity<BatchRunResponse> runBatch(
            @RequestHeader(name = SECRET_HEADER, required = false) String providedSecret,
            @Valid @RequestBody BatchRunRequest request
    ) {
        if (!Objects.equals(appProperties.getSchedulerSecret(), providedSecret)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid scheduler secret");
        }

        try {
            BatchRunResponse response = batchExecutionService.runBatch(request);
            return ResponseEntity.ok(response);
        } finally {
            batchSchedulerService.completeSchedule(request.getScheduleName(), request.getBatchId());
        }
    }

    @GetMapping("/runs")
    public ResponseEntity<List<BatchRunResponse>> getRecentRuns(
            @RequestParam(name = "limit", defaultValue = "5") int limit,
            @RequestParam(name = "status", required = false) String status,
            @RequestParam(name = "batchId", required = false) String batchId
    ) {
        int safeLimit = Math.max(1, Math.min(limit, 50));
        return ResponseEntity.ok(batchExecutionService.getRecentRuns(safeLimit, status, batchId));
    }
}
