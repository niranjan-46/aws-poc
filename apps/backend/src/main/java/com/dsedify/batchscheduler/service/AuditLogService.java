package com.dsedify.batchscheduler.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.dsedify.batchscheduler.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.nio.charset.StandardCharsets;

@Service
public class AuditLogService {

    private static final Logger LOGGER = LoggerFactory.getLogger(AuditLogService.class);

    private final S3Client s3Client;
    private final ObjectMapper objectMapper;
    private final AppProperties appProperties;

    public AuditLogService(S3Client s3Client, ObjectMapper objectMapper, AppProperties appProperties) {
        this.s3Client = s3Client;
        this.objectMapper = objectMapper;
        this.appProperties = appProperties;
    }

    public void writeAudit(String prefix, String batchId, String fileName, Object payload) {
        String bucket = appProperties.getAuditBucket();
        if (isBlank(bucket)) {
            LOGGER.warn("AUDIT_BUCKET is empty; skipping audit write");
            return;
        }

        String key = "%s/%s/%s".formatted(prefix, batchId, fileName);

        try {
            String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(payload);
            s3Client.putObject(
                    PutObjectRequest.builder()
                            .bucket(bucket)
                            .key(key)
                            .contentType("application/json")
                            .build(),
                    RequestBody.fromBytes(json.getBytes(StandardCharsets.UTF_8))
            );
        } catch (JsonProcessingException exception) {
            LOGGER.error("Failed to serialize audit payload for key={}", key, exception);
        } catch (Exception exception) {
            LOGGER.error("Failed to write audit log to S3 bucket={} key={}", bucket, key, exception);
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
