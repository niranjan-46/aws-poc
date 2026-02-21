package com.dsedify.batchscheduler.controller;

import com.dsedify.batchscheduler.dto.ScheduleMetricsResponse;
import com.dsedify.batchscheduler.dto.ScheduleRequest;
import com.dsedify.batchscheduler.dto.ScheduleResponse;
import com.dsedify.batchscheduler.service.BatchSchedulerService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/batch")
public class BatchSchedulerController {

    private final BatchSchedulerService batchSchedulerService;

    public BatchSchedulerController(BatchSchedulerService batchSchedulerService) {
        this.batchSchedulerService = batchSchedulerService;
    }

    @PostMapping("/schedule")
    public ResponseEntity<ScheduleResponse> schedule(@Valid @RequestBody ScheduleRequest request) {
        ScheduleResponse response = batchSchedulerService.scheduleBatch(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/schedules/recent")
    public ResponseEntity<ScheduleMetricsResponse> recentSchedules(
            @RequestParam(name = "limit", defaultValue = "10") int limit,
            @RequestParam(name = "upcomingOnly", required = false) Boolean upcomingOnly,
            @RequestParam(name = "batchId", required = false) String batchId
    ) {
        int safeLimit = Math.max(1, Math.min(limit, 50));
        return ResponseEntity.ok(batchSchedulerService.getScheduleMetrics(safeLimit, upcomingOnly, batchId));
    }
}
