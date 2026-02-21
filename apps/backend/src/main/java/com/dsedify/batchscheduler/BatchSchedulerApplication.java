package com.dsedify.batchscheduler;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class BatchSchedulerApplication {

    public static void main(String[] args) {
        SpringApplication.run(BatchSchedulerApplication.class, args);
    }
}
