-- Workboard foundation: multiple assignees, checklist, labels, dependencies.

CREATE TABLE "WorkItemAssignee" (
  "id" TEXT NOT NULL,
  "workItemId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "assignedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WorkItemAssignee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkItemChecklistItem" (
  "id" TEXT NOT NULL,
  "workItemId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "done" BOOLEAN NOT NULL DEFAULT false,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkItemChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkItemLabel" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkItemLabel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkItemLabelLink" (
  "id" TEXT NOT NULL,
  "workItemId" TEXT NOT NULL,
  "labelId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WorkItemLabelLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkItemDependency" (
  "id" TEXT NOT NULL,
  "blockedItemId" TEXT NOT NULL,
  "blockerItemId" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WorkItemDependency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkItemAssignee_workItemId_userId_key" ON "WorkItemAssignee"("workItemId", "userId");
CREATE INDEX "WorkItemAssignee_userId_idx" ON "WorkItemAssignee"("userId");

CREATE INDEX "WorkItemChecklistItem_workItemId_position_idx" ON "WorkItemChecklistItem"("workItemId", "position");

CREATE UNIQUE INDEX "WorkItemLabel_projectId_name_key" ON "WorkItemLabel"("projectId", "name");
CREATE INDEX "WorkItemLabel_projectId_idx" ON "WorkItemLabel"("projectId");

CREATE UNIQUE INDEX "WorkItemLabelLink_workItemId_labelId_key" ON "WorkItemLabelLink"("workItemId", "labelId");
CREATE INDEX "WorkItemLabelLink_labelId_idx" ON "WorkItemLabelLink"("labelId");

CREATE UNIQUE INDEX "WorkItemDependency_blockedItemId_blockerItemId_key" ON "WorkItemDependency"("blockedItemId", "blockerItemId");
CREATE INDEX "WorkItemDependency_blockerItemId_idx" ON "WorkItemDependency"("blockerItemId");

ALTER TABLE "WorkItemAssignee"
  ADD CONSTRAINT "WorkItemAssignee_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkItemAssignee"
  ADD CONSTRAINT "WorkItemAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkItemChecklistItem"
  ADD CONSTRAINT "WorkItemChecklistItem_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkItemLabel"
  ADD CONSTRAINT "WorkItemLabel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkItemLabelLink"
  ADD CONSTRAINT "WorkItemLabelLink_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkItemLabelLink"
  ADD CONSTRAINT "WorkItemLabelLink_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "WorkItemLabel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkItemDependency"
  ADD CONSTRAINT "WorkItemDependency_blockedItemId_fkey" FOREIGN KEY ("blockedItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkItemDependency"
  ADD CONSTRAINT "WorkItemDependency_blockerItemId_fkey" FOREIGN KEY ("blockerItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
