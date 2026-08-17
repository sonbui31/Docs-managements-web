DO $$
BEGIN
  IF to_regtype('"WorkboardColumnType"') IS NULL THEN
    CREATE TYPE "WorkboardColumnType" AS ENUM ('OPEN', 'IN_PROGRESS', 'REVIEW', 'BLOCKED', 'DONE');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "WorkboardColumn" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#6366f1',
  "type" "WorkboardColumnType" NOT NULL DEFAULT 'OPEN',
  "position" INTEGER NOT NULL DEFAULT 0,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isDone" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkboardColumn_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkboardColumn_projectId_key_key" ON "WorkboardColumn"("projectId", "key");
CREATE INDEX IF NOT EXISTS "WorkboardColumn_projectId_position_idx" ON "WorkboardColumn"("projectId", "position");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkboardColumn_projectId_fkey') THEN
    ALTER TABLE "WorkboardColumn"
      ADD CONSTRAINT "WorkboardColumn_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "WorkItem" ADD COLUMN IF NOT EXISTS "columnId" TEXT;
CREATE INDEX IF NOT EXISTS "WorkItem_columnId_idx" ON "WorkItem"("columnId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkItem_columnId_fkey') THEN
    ALTER TABLE "WorkItem"
      ADD CONSTRAINT "WorkItem_columnId_fkey"
      FOREIGN KEY ("columnId") REFERENCES "WorkboardColumn"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "WorkboardColumn" ("id", "projectId", "key", "name", "color", "type", "position", "isDefault", "isDone")
SELECT 'wbc_' || md5(p."id" || ':BACKLOG'), p."id", 'BACKLOG', 'Backlog', '#64748b', 'OPEN'::"WorkboardColumnType", 0, true, false FROM "Project" p
UNION ALL
SELECT 'wbc_' || md5(p."id" || ':TODO'), p."id", 'TODO', 'To Do', '#3b82f6', 'OPEN'::"WorkboardColumnType", 1, false, false FROM "Project" p
UNION ALL
SELECT 'wbc_' || md5(p."id" || ':IN_PROGRESS'), p."id", 'IN_PROGRESS', 'In Progress', '#f59e0b', 'IN_PROGRESS'::"WorkboardColumnType", 2, false, false FROM "Project" p
UNION ALL
SELECT 'wbc_' || md5(p."id" || ':REVIEW'), p."id", 'REVIEW', 'Review / QA', '#8b5cf6', 'REVIEW'::"WorkboardColumnType", 3, false, false FROM "Project" p
UNION ALL
SELECT 'wbc_' || md5(p."id" || ':BLOCKED'), p."id", 'BLOCKED', 'Blocked', '#ef4444', 'BLOCKED'::"WorkboardColumnType", 4, false, false FROM "Project" p
UNION ALL
SELECT 'wbc_' || md5(p."id" || ':DONE'), p."id", 'DONE', 'Done', '#10b981', 'DONE'::"WorkboardColumnType", 5, false, true FROM "Project" p
ON CONFLICT ("projectId", "key") DO NOTHING;

UPDATE "WorkItem" wi
SET "columnId" = wc."id"
FROM "WorkboardColumn" wc
WHERE wi."columnId" IS NULL AND wc."projectId" = wi."projectId" AND wc."key" = wi."status"::text;
