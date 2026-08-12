WITH first_document_actor AS (
  SELECT DISTINCT ON (a."entityId")
    a."entityId",
    a."actorId"
  FROM "AuditLog" a
  WHERE a."entityId" IS NOT NULL
    AND a."action" IN ('DOCUMENT_IMPORTED', 'DOCUMENT_REIMPORTED', 'DOCUMENT_CREATED', 'DOCUMENT_CREATED_FROM_TEMPLATE')
  ORDER BY
    a."entityId",
    CASE
      WHEN a."action" = 'DOCUMENT_IMPORTED' THEN 0
      WHEN a."action" = 'DOCUMENT_CREATED' THEN 1
      WHEN a."action" = 'DOCUMENT_CREATED_FROM_TEMPLATE' THEN 2
      ELSE 3
    END,
    a."createdAt" ASC
)
UPDATE "Document" d
SET
  "createdBy" = COALESCE(u."name", u."email"),
  "createdByEmail" = u."email"
FROM first_document_actor fda
JOIN "User" u ON u."id" = fda."actorId"
WHERE d."id" = fda."entityId"
  AND d."createdBy" IS NULL;
