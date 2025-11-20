-- AlterEnum
ALTER TYPE "WorkspaceRole" ADD VALUE IF NOT EXISTS 'VIEWER';

-- AlterTable
ALTER TABLE "apps"
ADD COLUMN IF NOT EXISTS "country" TEXT,
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "nickname" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "apps_workspaceId_deleted_at_idx" ON "apps"("workspaceId", "deleted_at");
