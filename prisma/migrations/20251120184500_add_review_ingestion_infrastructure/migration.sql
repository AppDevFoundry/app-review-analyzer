-- CreateEnum
CREATE TYPE "IngestionReason" AS ENUM ('MANUAL', 'SCHEDULED', 'AUTOMATIC');

-- CreateEnum
CREATE TYPE "IngestionStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "MetricType" AS ENUM ('INGESTION_SUCCESS_RATE', 'INGESTION_FAILURE_RATE', 'AVG_INGESTION_DURATION', 'TOTAL_REVIEWS_FETCHED', 'TOTAL_REVIEWS_INSERTED', 'DUPLICATE_RATE', 'API_ERROR_RATE', 'RATE_LIMIT_HITS', 'PLAN_LIMIT_HITS');

-- AlterTable
ALTER TABLE "apps" ADD COLUMN     "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_failure_reason" TEXT,
ADD COLUMN     "next_retry_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "review_ingestion_runs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "reason" "IngestionReason" NOT NULL,
    "triggeredByUserId" TEXT,
    "status" "IngestionStatus" NOT NULL DEFAULT 'PENDING',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "reviews_fetched" INTEGER NOT NULL DEFAULT 0,
    "reviews_inserted" INTEGER NOT NULL DEFAULT 0,
    "duplicate_count" INTEGER NOT NULL DEFAULT 0,
    "reviews_skipped" INTEGER NOT NULL DEFAULT 0,
    "sources_processed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "error_message" TEXT,
    "error_code" TEXT,
    "metadata" JSONB,
    "snapshot_id" TEXT,

    CONSTRAINT "review_ingestion_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_health_metrics" (
    "id" TEXT NOT NULL,
    "metric_type" "MetricType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB,
    "workspaceId" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_health_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "review_ingestion_runs_workspaceId_status_idx" ON "review_ingestion_runs"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "review_ingestion_runs_appId_status_idx" ON "review_ingestion_runs"("appId", "status");

-- CreateIndex
CREATE INDEX "review_ingestion_runs_requested_at_idx" ON "review_ingestion_runs"("requested_at");

-- CreateIndex
CREATE INDEX "review_ingestion_runs_status_idx" ON "review_ingestion_runs"("status");

-- CreateIndex
CREATE INDEX "system_health_metrics_metric_type_recorded_at_idx" ON "system_health_metrics"("metric_type", "recorded_at");

-- CreateIndex
CREATE INDEX "system_health_metrics_workspaceId_metric_type_idx" ON "system_health_metrics"("workspaceId", "metric_type");

-- CreateIndex
CREATE INDEX "system_health_metrics_recorded_at_idx" ON "system_health_metrics"("recorded_at");

-- AddForeignKey
ALTER TABLE "review_ingestion_runs" ADD CONSTRAINT "review_ingestion_runs_triggeredByUserId_fkey" FOREIGN KEY ("triggeredByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_ingestion_runs" ADD CONSTRAINT "review_ingestion_runs_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "review_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_ingestion_runs" ADD CONSTRAINT "review_ingestion_runs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_ingestion_runs" ADD CONSTRAINT "review_ingestion_runs_appId_fkey" FOREIGN KEY ("appId") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_health_metrics" ADD CONSTRAINT "system_health_metrics_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
