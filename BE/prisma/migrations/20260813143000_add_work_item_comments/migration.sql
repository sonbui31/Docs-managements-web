-- CreateTable
CREATE TABLE "WorkItemComment" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "parentId" TEXT,
    "content" TEXT NOT NULL,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkItemComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkItemComment_workItemId_createdAt_idx" ON "WorkItemComment"("workItemId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkItemComment_parentId_idx" ON "WorkItemComment"("parentId");

-- AddForeignKey
ALTER TABLE "WorkItemComment" ADD CONSTRAINT "WorkItemComment_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemComment" ADD CONSTRAINT "WorkItemComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "WorkItemComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemComment" ADD CONSTRAINT "WorkItemComment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
