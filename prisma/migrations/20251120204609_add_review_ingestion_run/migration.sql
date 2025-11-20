-- CreateEnum
CREATE TYPE "IngestionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "review_ingestion_runs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "triggered_by_id" TEXT,
    "status" "IngestionStatus" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "reviews_fetched" INTEGER NOT NULL DEFAULT 0,
    "reviews_new" INTEGER NOT NULL DEFAULT 0,
    "reviews_duplicate" INTEGER NOT NULL DEFAULT 0,
    "pages_processed" INTEGER NOT NULL DEFAULT 0,
    "sources_processed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "error_code" TEXT,
    "error_message" TEXT,
    "snapshot_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_ingestion_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "review_ingestion_runs_snapshot_id_key" ON "review_ingestion_runs"("snapshot_id");

-- CreateIndex
CREATE INDEX "review_ingestion_runs_workspaceId_idx" ON "review_ingestion_runs"("workspaceId");

-- CreateIndex
CREATE INDEX "review_ingestion_runs_appId_idx" ON "review_ingestion_runs"("appId");

-- CreateIndex
CREATE INDEX "review_ingestion_runs_status_idx" ON "review_ingestion_runs"("status");

-- CreateIndex
CREATE INDEX "review_ingestion_runs_started_at_idx" ON "review_ingestion_runs"("started_at");

-- CreateIndex
CREATE INDEX "review_ingestion_runs_workspaceId_started_at_idx" ON "review_ingestion_runs"("workspaceId", "started_at");

-- AddForeignKey
ALTER TABLE "review_ingestion_runs" ADD CONSTRAINT "review_ingestion_runs_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "review_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_ingestion_runs" ADD CONSTRAINT "review_ingestion_runs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_ingestion_runs" ADD CONSTRAINT "review_ingestion_runs_appId_fkey" FOREIGN KEY ("appId") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_ingestion_runs" ADD CONSTRAINT "review_ingestion_runs_triggered_by_id_fkey" FOREIGN KEY ("triggered_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
