-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "parentId" TEXT;

-- CreateIndex
CREATE INDEX "Comment_parentId_idx" ON "Comment"("parentId");
