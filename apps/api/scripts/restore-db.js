const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { resolveConfiguredDbPath } = require("../src/db/paths");

function formatTimestamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function verifySqliteFile(filePath) {
  const database = new Database(filePath, { readonly: false });

  try {
    const integrity = database.pragma("integrity_check", { simple: true });
    if (String(integrity).toLowerCase() !== "ok") {
      throw new Error(`integrity_check failed for ${filePath}: ${integrity}`);
    }

    database.prepare("SELECT 1 AS ok").get();
  } finally {
    database.close();
  }
}

async function run() {
  const sourceArg = String(process.argv[2] || "").trim();
  if (!sourceArg) {
    throw new Error("Usage: node scripts/restore-db.js <backup-file> [target-db]");
  }

  const sourcePath = path.resolve(process.cwd(), sourceArg);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Backup file not found: ${sourcePath}`);
  }

  const targetArg = String(process.argv[3] || process.env.SQLITE_DB_PATH || "").trim();
  const targetPath = resolveConfiguredDbPath(targetArg);
  const targetDir = path.dirname(targetPath);
  const tempRestorePath = path.join(
    targetDir,
    `${path.basename(targetPath)}.restore-${process.pid}.tmp`,
  );

  fs.mkdirSync(targetDir, { recursive: true });
  fs.copyFileSync(sourcePath, tempRestorePath);
  verifySqliteFile(tempRestorePath);

  let preRestoreBackupPath = null;
  if (fs.existsSync(targetPath)) {
    preRestoreBackupPath = `${targetPath}.pre-restore-${formatTimestamp(new Date())}.bak`;
    fs.copyFileSync(targetPath, preRestoreBackupPath);
    fs.rmSync(targetPath, { force: true });
  }

  fs.renameSync(tempRestorePath, targetPath);

  process.env.SQLITE_DB_PATH = targetPath;
  process.env.NODE_ENV = process.env.NODE_ENV || "production";
  const db = require("../src/db/connection");
  const { initDatabase } = require("../src/db/initDb");

  try {
    initDatabase();
    const integrity = db.pragma("integrity_check", { simple: true });
    if (String(integrity).toLowerCase() !== "ok") {
      throw new Error(`integrity_check failed after restore: ${integrity}`);
    }

    db.prepare("SELECT 1 AS ok").get();
  } finally {
    db.close();
  }

  console.log(`SQLite restore completed at ${targetPath}`);
  if (preRestoreBackupPath) {
    console.log(`Previous database backup saved at ${preRestoreBackupPath}`);
  }
}

run().catch((error) => {
  console.error(`SQLite restore failed: ${error.message}`);
  process.exit(1);
});
