-- AlterTable
ALTER TABLE "Project" ADD COLUMN "externalCompanyId" TEXT,
ADD COLUMN "externalDepartmentId" TEXT;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN "externalCompanyId" TEXT,
ADD COLUMN "externalDepartmentId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "externalUserId" TEXT,
ADD COLUMN "externalRole" TEXT,
ADD COLUMN "externalCompanyId" TEXT,
ADD COLUMN "externalDepartmentId" TEXT;

-- CreateIndex
CREATE INDEX "Project_externalCompanyId_externalDepartmentId_idx" ON "Project"("externalCompanyId", "externalDepartmentId");

-- CreateIndex
CREATE INDEX "Document_externalCompanyId_externalDepartmentId_idx" ON "Document"("externalCompanyId", "externalDepartmentId");

-- CreateIndex
CREATE UNIQUE INDEX "User_externalUserId_key" ON "User"("externalUserId");

-- CreateIndex
CREATE INDEX "User_externalCompanyId_externalDepartmentId_idx" ON "User"("externalCompanyId", "externalDepartmentId");
