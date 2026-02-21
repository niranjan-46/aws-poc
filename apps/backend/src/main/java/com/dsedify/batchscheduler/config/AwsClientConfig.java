package com.dsedify.batchscheduler.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.scheduler.SchedulerClient;

@Configuration
public class AwsClientConfig {

    @Bean
    SchedulerClient schedulerClient() {
        return SchedulerClient.builder().build();
    }

    @Bean
    S3Client s3Client() {
        return S3Client.builder().build();
    }
}
