-- CreateEnum
CREATE TYPE "WorkItemType" AS ENUM ('TASK', 'BUG', 'REVIEW', 'CHANGE_REQUEST', 'QUESTION');

-- CreateEnum
CREATE TYPE "WorkItemStatus" AS ENUM ('BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'BLOCKED', 'DONE');

-- CreateEnum
CREATE TYPE "WorkItemPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "WorkItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "documentId" TEXT,
    "sourceCommentId" TEXT,
    "type" "WorkItemType" NOT NULL DEFAULT 'TASK',
    "status" "WorkItemStatus" NOT NULL DEFAULT 'BACKLOG',
    "priority" "WorkItemPriority" NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigneeId" TEXT,
    "assigneeName" TEXT,
    "dueDate" TIMESTAMP(3),
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkItem_projectId_status_priority_idx" ON "WorkItem"("projectId", "status", "priority");

-- CreateIndex
CREATE INDEX "WorkItem_documentId_idx" ON "WorkItem"("documentId");

-- CreateIndex
CREATE INDEX "WorkItem_sourceCommentId_idx" ON "WorkItem"("sourceCommentId");

-- CreateIndex
CREATE INDEX "WorkItem_assigneeId_idx" ON "WorkItem"("assigneeId");

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_sourceCommentId_fkey" FOREIGN KEY ("sourceCommentId") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
