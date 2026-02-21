package com.dsedify.batchscheduler.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private String lambdaArn;
    private String schedulerRoleArn;
    private String schedulerGroupName = "llm-prod-schedules";
    private String auditBucket = "llm-prod-audit-180294187402-ap-southeast-1";
    private String schedulerSecret = "replace-with-strong-secret";
    private String corsAllowedOrigins = "http://localhost:3000,http://127.0.0.1:3000,https://*.ap-southeast-1.awsapprunner.com";

    public String getLambdaArn() {
        return lambdaArn;
    }

    public void setLambdaArn(String lambdaArn) {
        this.lambdaArn = lambdaArn;
    }

    public String getSchedulerRoleArn() {
        return schedulerRoleArn;
    }

    public void setSchedulerRoleArn(String schedulerRoleArn) {
        this.schedulerRoleArn = schedulerRoleArn;
    }

    public String getSchedulerGroupName() {
        return schedulerGroupName;
    }

    public void setSchedulerGroupName(String schedulerGroupName) {
        this.schedulerGroupName = schedulerGroupName;
    }

    public String getAuditBucket() {
        return auditBucket;
    }

    public void setAuditBucket(String auditBucket) {
        this.auditBucket = auditBucket;
    }

    public String getSchedulerSecret() {
        return schedulerSecret;
    }

    public void setSchedulerSecret(String schedulerSecret) {
        this.schedulerSecret = schedulerSecret;
    }

    public String getCorsAllowedOrigins() {
        return corsAllowedOrigins;
    }

    public void setCorsAllowedOrigins(String corsAllowedOrigins) {
        this.corsAllowedOrigins = corsAllowedOrigins;
    }
}
