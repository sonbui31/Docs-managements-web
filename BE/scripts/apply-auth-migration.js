const fs = require("fs");
const path = require("path");
const { neon } = require("@neondatabase/serverless");

function readEnv(filePath) {
  return Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        const key = line.slice(0, index);
        const value = line.slice(index + 1).replace(/^"|"$/g, "");
        return [key, value];
      })
  );
}

async function main() {
  const root = path.resolve(__dirname, "..");
  const env = readEnv(path.join(root, ".env"));
  const sql = neon(env.DATABASE_URL);
  const migrationName = "20260804141000_add_auth";
  const migration = fs.readFileSync(
    path.join(root, "prisma", "migrations", migrationName, "migration.sql"),
    "utf8"
  );

  const statements = migration
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await sql.query(statement);
  }

  const existing = await sql.query(
    `SELECT "id" FROM "_prisma_migrations" WHERE "migration_name" = $1 LIMIT 1`,
    [migrationName]
  );
  if (existing.rows?.length || existing.length) {
    console.log(`${migrationName} was already recorded`);
    return;
  }

  const checksum = require("crypto").createHash("sha256").update(migration).digest("hex");
  const id = require("crypto").randomUUID();
  await sql.query(
    `INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
     VALUES ($1, $2, now(), $3, null, null, now(), 1)`,
    [id, checksum, migrationName]
  );

  console.log(`Applied ${migrationName}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
