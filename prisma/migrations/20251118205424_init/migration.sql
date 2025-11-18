-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

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
CREATE TYPE "InsightType" AS ENUM ('FEATURE_REQUEST', 'BUG_OR_COMPLAINT', 'PRAISE', 'USABILITY_ISSUE', 'PERFORMANCE_ISSUE', 'OTHER');

-- CreateEnum
CREATE TYPE "InsightPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "InsightCategory" AS ENUM ('FEATURES', 'PRICING', 'UI_UX', 'SYNC_DATA', 'SEARCH_DISCOVERY', 'CRASHES_BUGS', 'PERFORMANCE', 'SOCIAL');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "stripe_price_id" TEXT,
    "stripe_current_period_end" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" "WorkspacePlan" NOT NULL DEFAULT 'STARTER',
    "appLimit" INTEGER NOT NULL,
    "analysisLimitPerMonth" INTEGER NOT NULL,
    "reviewLimitPerRun" INTEGER NOT NULL,
    "ownerId" TEXT NOT NULL,
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "stripe_price_id" TEXT,
    "stripe_current_period_end" TIMESTAMP(3),
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
    "role" "WorkspaceRole" NOT NULL,
    "invitedBy" TEXT,
    "invitedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apps" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "platform" "AppPlatform" NOT NULL,
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
    "content" TEXT NOT NULL,
    "author" TEXT,
    "country" TEXT,
    "language" TEXT,
    "version" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vote_sum" INTEGER NOT NULL DEFAULT 0,
    "vote_count" INTEGER NOT NULL DEFAULT 0,
    "source" "ReviewSource" NOT NULL DEFAULT 'UNKNOWN',
    "is_translated" BOOLEAN NOT NULL DEFAULT false,
    "translation_language" TEXT,
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
    "status" "SnapshotStatus" NOT NULL,
    "analysis_date" TIMESTAMP(3) NOT NULL,
    "analysis_range_start" TIMESTAMP(3),
    "analysis_range_end" TIMESTAMP(3),
    "total_reviews_analyzed" INTEGER NOT NULL,
    "positive_count" INTEGER NOT NULL DEFAULT 0,
    "neutral_count" INTEGER NOT NULL DEFAULT 0,
    "negative_count" INTEGER NOT NULL DEFAULT 0,
    "average_rating" DECIMAL(3,2),
    "median_rating" INTEGER,
    "low_ratings_count" INTEGER,
    "high_ratings_count" INTEGER,
    "recent_trend" TEXT,
    "recent_avg_rating" DECIMAL(3,2),
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "cost_in_cents" INTEGER,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rating_distributions" (
    "id" TEXT NOT NULL,
    "reviewSnapshotId" TEXT NOT NULL,
    "one_star" INTEGER NOT NULL DEFAULT 0,
    "two_star" INTEGER NOT NULL DEFAULT 0,
    "three_star" INTEGER NOT NULL DEFAULT 0,
    "four_star" INTEGER NOT NULL DEFAULT 0,
    "five_star" INTEGER NOT NULL DEFAULT 0,
    "total_reviews" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rating_distributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_trends" (
    "id" TEXT NOT NULL,
    "reviewSnapshotId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "review_count" INTEGER NOT NULL,
    "average_rating" DECIMAL(3,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_trends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_snapshot_insights" (
    "id" TEXT NOT NULL,
    "reviewSnapshotId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" "InsightType" NOT NULL,
    "category" "InsightCategory",
    "priority" "InsightPriority" NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT,
    "description" TEXT,
    "mention_count" INTEGER NOT NULL DEFAULT 0,
    "theme_key" TEXT,
    "raw_excerpt" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_snapshot_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_insight_links" (
    "id" TEXT NOT NULL,
    "insightId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "relevance_score" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_insight_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positive_aspects" (
    "id" TEXT NOT NULL,
    "reviewSnapshotId" TEXT NOT NULL,
    "aspect" TEXT NOT NULL,
    "mention_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "positive_aspects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_insights" (
    "id" TEXT NOT NULL,
    "reviewSnapshotId" TEXT NOT NULL,
    "complaints" JSONB,
    "feature_requests" JSONB,
    "main_opportunity" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_insights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripe_customer_id_key" ON "users"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripe_subscription_id_key" ON "users"("stripe_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

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
CREATE INDEX "apps_platform_appStoreId_idx" ON "apps"("platform", "appStoreId");

-- CreateIndex
CREATE UNIQUE INDEX "apps_workspaceId_appStoreId_key" ON "apps"("workspaceId", "appStoreId");

-- CreateIndex
CREATE INDEX "reviews_workspaceId_published_at_idx" ON "reviews"("workspaceId", "published_at");

-- CreateIndex
CREATE INDEX "reviews_appId_rating_idx" ON "reviews"("appId", "rating");

-- CreateIndex
CREATE INDEX "reviews_rating_idx" ON "reviews"("rating");

-- CreateIndex
CREATE INDEX "reviews_published_at_idx" ON "reviews"("published_at");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_appId_externalReviewId_key" ON "reviews"("appId", "externalReviewId");

-- CreateIndex
CREATE INDEX "review_snapshots_workspaceId_appId_analysis_date_idx" ON "review_snapshots"("workspaceId", "appId", "analysis_date");

-- CreateIndex
CREATE INDEX "review_snapshots_status_idx" ON "review_snapshots"("status");

-- CreateIndex
CREATE INDEX "review_snapshots_analysis_date_idx" ON "review_snapshots"("analysis_date");

-- CreateIndex
CREATE UNIQUE INDEX "rating_distributions_reviewSnapshotId_key" ON "rating_distributions"("reviewSnapshotId");

-- CreateIndex
CREATE INDEX "monthly_trends_month_idx" ON "monthly_trends"("month");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_trends_reviewSnapshotId_month_key" ON "monthly_trends"("reviewSnapshotId", "month");

-- CreateIndex
CREATE INDEX "review_snapshot_insights_reviewSnapshotId_type_category_idx" ON "review_snapshot_insights"("reviewSnapshotId", "type", "category");

-- CreateIndex
CREATE INDEX "review_snapshot_insights_workspaceId_category_idx" ON "review_snapshot_insights"("workspaceId", "category");

-- CreateIndex
CREATE INDEX "review_snapshot_insights_type_idx" ON "review_snapshot_insights"("type");

-- CreateIndex
CREATE INDEX "review_insight_links_reviewId_idx" ON "review_insight_links"("reviewId");

-- CreateIndex
CREATE INDEX "review_insight_links_insightId_idx" ON "review_insight_links"("insightId");

-- CreateIndex
CREATE UNIQUE INDEX "review_insight_links_insightId_reviewId_key" ON "review_insight_links"("insightId", "reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "positive_aspects_reviewSnapshotId_aspect_key" ON "positive_aspects"("reviewSnapshotId", "aspect");

-- CreateIndex
CREATE UNIQUE INDEX "llm_insights_reviewSnapshotId_key" ON "llm_insights"("reviewSnapshotId");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "rating_distributions" ADD CONSTRAINT "rating_distributions_reviewSnapshotId_fkey" FOREIGN KEY ("reviewSnapshotId") REFERENCES "review_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_trends" ADD CONSTRAINT "monthly_trends_reviewSnapshotId_fkey" FOREIGN KEY ("reviewSnapshotId") REFERENCES "review_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_snapshot_insights" ADD CONSTRAINT "review_snapshot_insights_reviewSnapshotId_fkey" FOREIGN KEY ("reviewSnapshotId") REFERENCES "review_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_snapshot_insights" ADD CONSTRAINT "review_snapshot_insights_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_insight_links" ADD CONSTRAINT "review_insight_links_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "review_snapshot_insights"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_insight_links" ADD CONSTRAINT "review_insight_links_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positive_aspects" ADD CONSTRAINT "positive_aspects_reviewSnapshotId_fkey" FOREIGN KEY ("reviewSnapshotId") REFERENCES "review_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_insights" ADD CONSTRAINT "llm_insights_reviewSnapshotId_fkey" FOREIGN KEY ("reviewSnapshotId") REFERENCES "review_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
