ALTER TABLE "Document"
  ADD COLUMN "ownerId" TEXT;

CREATE INDEX "Document_ownerId_idx" ON "Document"("ownerId");

CREATE TABLE "DocumentEditingSession" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "userName" TEXT NOT NULL,
  "userEmail" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "heartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DocumentEditingSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentEditingSession_documentId_key" ON "DocumentEditingSession"("documentId");
CREATE INDEX "DocumentEditingSession_userId_idx" ON "DocumentEditingSession"("userId");
CREATE INDEX "DocumentEditingSession_expiresAt_idx" ON "DocumentEditingSession"("expiresAt");

ALTER TABLE "DocumentEditingSession"
  ADD CONSTRAINT "DocumentEditingSession_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

WITH owner_from_email AS (
  SELECT d."id" AS "documentId", u."id" AS "userId"
  FROM "Document" d
  JOIN "User" u ON lower(u."email") = lower(d."createdByEmail")
  WHERE d."createdByEmail" IS NOT NULL
)
UPDATE "Document" d
SET "ownerId" = owner_from_email."userId"
FROM owner_from_email
WHERE d."id" = owner_from_email."documentId"
  AND d."ownerId" IS NULL;

WITH first_document_actor AS (
  SELECT DISTINCT ON (a."entityId")
    a."entityId",
    a."actorId"
  FROM "AuditLog" a
  WHERE a."entityId" IS NOT NULL
    AND a."action" IN ('DOCUMENT_IMPORTED', 'DOCUMENT_CREATED', 'DOCUMENT_CREATED_FROM_TEMPLATE')
  ORDER BY a."entityId", a."createdAt" ASC
)
UPDATE "Document" d
SET "ownerId" = first_document_actor."actorId"
FROM first_document_actor
WHERE d."id" = first_document_actor."entityId"
  AND d."ownerId" IS NULL;
