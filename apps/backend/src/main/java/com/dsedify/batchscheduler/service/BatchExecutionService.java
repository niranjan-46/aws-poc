package com.dsedify.batchscheduler.service;

import com.dsedify.batchscheduler.dto.BatchRunRequest;
import com.dsedify.batchscheduler.dto.BatchRunResponse;
import com.dsedify.batchscheduler.dto.RunSummaryResponse;
import org.springframework.stereotype.Service;

import java.util.ArrayDeque;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Locale;

@Service
public class BatchExecutionService {

    private static final String PASSED_STATUS = "PASSED";
    private static final String FAILED_STATUS = "FAILED";
    private static final int MAX_HISTORY = 200;

    private final AuditLogService auditLogService;
    private final Deque<BatchRunResponse> runHistory = new ArrayDeque<>();

    public BatchExecutionService(AuditLogService auditLogService) {
        this.auditLogService = auditLogService;
    }

    public BatchRunResponse runBatch(BatchRunRequest request) {
        Instant startedAt = Instant.now();
        String status = PASSED_STATUS;
        String errorMessage = null;

        try {
            // Replace this block with your real batch execution orchestration.
            simulateExecution();
        } catch (Exception exception) {
            status = FAILED_STATUS;
            errorMessage = exception.getMessage();
        }

        Instant finishedAt = Instant.now();
        long durationMs = Duration.between(startedAt, finishedAt).toMillis();

        BatchRunResponse response = new BatchRunResponse(
                request.getBatchId(),
                status,
                durationMs,
                startedAt,
                finishedAt
        );
        addRunToHistory(response);

        Map<String, Object> auditRecord = new LinkedHashMap<>();
        auditRecord.put("batchId", request.getBatchId());
        auditRecord.put("status", status);
        auditRecord.put("durationMs", durationMs);
        auditRecord.put("startedAt", startedAt.toString());
        auditRecord.put("finishedAt", finishedAt.toString());
        if (errorMessage != null) {
            auditRecord.put("error", errorMessage);
        }

        auditLogService.writeAudit(
                "executions",
                request.getBatchId(),
                "%d-backend.json".formatted(System.currentTimeMillis()),
                auditRecord
        );

        if (FAILED_STATUS.equals(status)) {
            throw new IllegalStateException("Batch execution failed for batchId=%s".formatted(request.getBatchId()));
        }

        return response;
    }

    public synchronized List<BatchRunResponse> getRecentRuns(int limit, String status, String batchId) {
        int safeLimit = Math.max(1, Math.min(limit, MAX_HISTORY));
        String normalizedStatus = normalizeFilter(status);
        String normalizedBatchId = normalizeFilter(batchId);

        List<BatchRunResponse> recentRuns = new ArrayList<>(safeLimit);

        for (BatchRunResponse item : runHistory) {
            if (recentRuns.size() >= safeLimit) {
                break;
            }
            if (normalizedStatus != null && !item.status().equalsIgnoreCase(normalizedStatus)) {
                continue;
            }
            if (normalizedBatchId != null && !item.batchId().toLowerCase(Locale.ROOT).contains(normalizedBatchId)) {
                continue;
            }

            recentRuns.add(item);
        }

        return recentRuns;
    }

    public synchronized RunSummaryResponse getRunSummary() {
        int passedRuns = 0;
        int failedRuns = 0;
        long durationTotalMs = 0;

        for (BatchRunResponse item : runHistory) {
            durationTotalMs += item.durationMs();
            if (PASSED_STATUS.equalsIgnoreCase(item.status())) {
                passedRuns++;
            } else if (FAILED_STATUS.equalsIgnoreCase(item.status())) {
                failedRuns++;
            }
        }

        int totalRuns = runHistory.size();
        long averageDurationMs = totalRuns == 0 ? 0 : durationTotalMs / totalRuns;
        BatchRunResponse lastRun = runHistory.peekFirst();

        return new RunSummaryResponse(
                totalRuns,
                passedRuns,
                failedRuns,
                averageDurationMs,
                lastRun == null ? null : lastRun.finishedAt(),
                lastRun == null ? null : lastRun.status()
        );
    }

    private void simulateExecution() {
        // Placeholder for the real Lambda-triggered work.
    }

    private synchronized void addRunToHistory(BatchRunResponse response) {
        runHistory.addFirst(response);
        while (runHistory.size() > MAX_HISTORY) {
            runHistory.removeLast();
        }
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
}
