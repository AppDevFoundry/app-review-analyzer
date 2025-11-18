-- CreateEnum
CREATE TYPE "WorkspacePlan" AS ENUM ('STARTER', 'PRO', 'BUSINESS');

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "AppPlatform" AS ENUM ('IOS');

-- CreateEnum
CREATE TYPE "AppStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ReviewSource" AS ENUM ('MOST_RECENT', 'MOST_HELPFUL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SnapshotStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "InsightType" AS ENUM ('FEATURE_REQUEST', 'BUG_OR_COMPLAINT', 'PRAISE', 'USABILITY_ISSUE', 'OTHER');

-- CreateEnum
CREATE TYPE "InsightPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" "WorkspacePlan" NOT NULL DEFAULT 'STARTER',
    "appLimit" INTEGER NOT NULL DEFAULT 1,
    "analysisLimitPerMonth" INTEGER NOT NULL DEFAULT 4,
    "reviewLimitPerRun" INTEGER NOT NULL DEFAULT 100,
    "ownerId" TEXT NOT NULL,
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "invitedByUserId" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apps" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "platform" "AppPlatform" NOT NULL DEFAULT 'IOS',
    "appStoreId" TEXT NOT NULL,
    "bundleId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "developerName" TEXT,
    "primaryCategory" TEXT,
    "iconUrl" TEXT,
    "storeUrl" TEXT,
    "averageRating" DECIMAL(3,2),
    "ratingCount" INTEGER,
    "status" "AppStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "apps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "externalReviewId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "author" TEXT,
    "country" TEXT,
    "version" TEXT,
    "language" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "ReviewSource" NOT NULL DEFAULT 'UNKNOWN',
    "isTranslated" BOOLEAN NOT NULL DEFAULT false,
    "translationLanguage" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_snapshots" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "status" "SnapshotStatus" NOT NULL DEFAULT 'PENDING',
    "analysis_range_start" TIMESTAMP(3),
    "analysis_range_end" TIMESTAMP(3),
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "positiveCount" INTEGER NOT NULL DEFAULT 0,
    "neutralCount" INTEGER NOT NULL DEFAULT 0,
    "negativeCount" INTEGER NOT NULL DEFAULT 0,
    "sourceReviewIds" JSONB,
    "ratingsDistribution" JSONB,
    "trends" JSONB,
    "aiSummary" TEXT,
    "rawInsights" JSONB,
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "cost_in_cents" INTEGER,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_snapshot_insights" (
    "id" TEXT NOT NULL,
    "reviewSnapshotId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" "InsightType" NOT NULL,
    "priority" "InsightPriority" NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "supportingReviewIds" JSONB,
    "supportingReviewCount" INTEGER NOT NULL DEFAULT 0,
    "themeKey" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_snapshot_insights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_stripe_customer_id_key" ON "workspaces"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_stripe_subscription_id_key" ON "workspaces"("stripe_subscription_id");

-- CreateIndex
CREATE INDEX "workspaces_ownerId_idx" ON "workspaces"("ownerId");

-- CreateIndex
CREATE INDEX "workspaces_deleted_at_idx" ON "workspaces"("deleted_at");

-- CreateIndex
CREATE INDEX "workspace_members_userId_idx" ON "workspace_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspaceId_userId_key" ON "workspace_members"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "apps_workspaceId_status_idx" ON "apps"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "apps_appStoreId_idx" ON "apps"("appStoreId");

-- CreateIndex
CREATE UNIQUE INDEX "apps_workspaceId_appStoreId_key" ON "apps"("workspaceId", "appStoreId");

-- CreateIndex
CREATE INDEX "reviews_workspaceId_publishedAt_idx" ON "reviews"("workspaceId", "publishedAt");

-- CreateIndex
CREATE INDEX "reviews_appId_rating_idx" ON "reviews"("appId", "rating");

-- CreateIndex
CREATE INDEX "reviews_appId_publishedAt_idx" ON "reviews"("appId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_appId_externalReviewId_key" ON "reviews"("appId", "externalReviewId");

-- CreateIndex
CREATE INDEX "review_snapshots_workspaceId_appId_created_at_idx" ON "review_snapshots"("workspaceId", "appId", "created_at");

-- CreateIndex
CREATE INDEX "review_snapshots_status_idx" ON "review_snapshots"("status");

-- CreateIndex
CREATE INDEX "review_snapshots_appId_created_at_idx" ON "review_snapshots"("appId", "created_at");

-- CreateIndex
CREATE INDEX "review_snapshot_insights_reviewSnapshotId_type_idx" ON "review_snapshot_insights"("reviewSnapshotId", "type");

-- CreateIndex
CREATE INDEX "review_snapshot_insights_workspaceId_themeKey_idx" ON "review_snapshot_insights"("workspaceId", "themeKey");

-- CreateIndex
CREATE INDEX "review_snapshot_insights_workspaceId_type_idx" ON "review_snapshot_insights"("workspaceId", "type");

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apps" ADD CONSTRAINT "apps_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_appId_fkey" FOREIGN KEY ("appId") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_snapshots" ADD CONSTRAINT "review_snapshots_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_snapshots" ADD CONSTRAINT "review_snapshots_appId_fkey" FOREIGN KEY ("appId") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_snapshot_insights" ADD CONSTRAINT "review_snapshot_insights_reviewSnapshotId_fkey" FOREIGN KEY ("reviewSnapshotId") REFERENCES "review_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_snapshot_insights" ADD CONSTRAINT "review_snapshot_insights_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
