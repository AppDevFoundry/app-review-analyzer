/*
  Warnings:

  - You are about to drop the column `primaryCategory` on the `apps` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "WorkspaceRole" ADD VALUE 'VIEWER';

-- AlterTable
ALTER TABLE "apps" DROP COLUMN "primaryCategory",
ADD COLUMN     "category" TEXT,
ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'us',
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "nickname" TEXT;

-- CreateIndex
CREATE INDEX "apps_workspaceId_deleted_at_idx" ON "apps"("workspaceId", "deleted_at");
