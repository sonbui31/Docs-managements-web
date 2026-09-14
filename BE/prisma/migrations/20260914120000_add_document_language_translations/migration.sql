-- Add document language metadata.
ALTER TABLE "Document"
ADD COLUMN "language" TEXT NOT NULL DEFAULT 'vi';

ALTER TABLE "DocumentVersion"
ADD COLUMN "language" TEXT NOT NULL DEFAULT 'vi';

-- Store translated document variants without overwriting the original document.
CREATE TABLE "DocumentTranslation" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTranslation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentTranslation_documentId_language_key" ON "DocumentTranslation"("documentId", "language");
CREATE INDEX "DocumentTranslation_documentId_idx" ON "DocumentTranslation"("documentId");
CREATE INDEX "DocumentTranslation_language_idx" ON "DocumentTranslation"("language");

ALTER TABLE "DocumentTranslation"
ADD CONSTRAINT "DocumentTranslation_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
