ALTER TABLE "ProjectMember"
ADD COLUMN "roles" "ProjectRole"[] NOT NULL DEFAULT ARRAY['VIEWER']::"ProjectRole"[];

UPDATE "ProjectMember"
SET "roles" = ARRAY["role"]::"ProjectRole"[];

ALTER TABLE "DocumentPermission"
ADD COLUMN "roles" "ProjectRole"[] NOT NULL DEFAULT ARRAY['VIEWER']::"ProjectRole"[];

UPDATE "DocumentPermission"
SET "roles" = ARRAY["role"]::"ProjectRole"[];
