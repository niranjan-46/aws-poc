package com.dsedify.batchscheduler.dto;

import java.time.Instant;

public record ErrorResponse(
        String message,
        Instant timestamp
) {
}
