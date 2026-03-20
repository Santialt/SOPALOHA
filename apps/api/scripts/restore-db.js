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

function clearModule(modulePath) {
  const resolved = require.resolve(modulePath);
  delete require.cache[resolved];
}

function clearAppDbModules() {
  [
    "../src/db/connection",
    "../src/db/initDb",
    "../src/db/migrations",
    "../src/db/migrations/003_schema_convergence",
  ].forEach(clearModule);
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

function validateRestoredDatabase(targetPath) {
  process.env.SQLITE_DB_PATH = targetPath;
  process.env.NODE_ENV = process.env.NODE_ENV || "production";
  clearAppDbModules();

  const db = require("../src/db/connection");
  const { initDatabase } = require("../src/db/initDb");

  try {
    initDatabase();

    const integrity = db.pragma("integrity_check", { simple: true });
    if (String(integrity).toLowerCase() !== "ok") {
      throw new Error(`integrity_check failed after restore: ${integrity}`);
    }

    const foreignKeyViolations = db.prepare("PRAGMA foreign_key_check").all();
    if (foreignKeyViolations.length > 0) {
      throw new Error(
        `foreign_key_check failed after restore: ${JSON.stringify(foreignKeyViolations[0])}`,
      );
    }

    db.prepare("SELECT COUNT(*) AS total FROM schema_migrations").get();
    db.prepare("SELECT COUNT(*) AS total FROM locations").get();
    db.prepare("SELECT COUNT(*) AS total FROM users").get();
  } finally {
    db.close();
    clearAppDbModules();
  }
}

function rollbackRestore({ targetPath, preRestoreBackupPath, provisionalFailurePath }) {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { force: true });
  }

  if (preRestoreBackupPath && fs.existsSync(preRestoreBackupPath)) {
    fs.copyFileSync(preRestoreBackupPath, targetPath);
  } else if (provisionalFailurePath && fs.existsSync(provisionalFailurePath)) {
    fs.rmSync(provisionalFailurePath, { force: true });
  }
}

function restoreDatabase({ sourcePath, targetPath, validate = validateRestoredDatabase }) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Backup file not found: ${sourcePath}`);
  }

  const targetDir = path.dirname(targetPath);
  const tempRestorePath = path.join(
    targetDir,
    `${path.basename(targetPath)}.restore-${process.pid}.tmp`,
  );
  const provisionalFailurePath = `${targetPath}.failed-restore-${formatTimestamp(new Date())}.db`;

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

  try {
    validate(targetPath);
  } catch (error) {
    if (fs.existsSync(targetPath)) {
      fs.copyFileSync(targetPath, provisionalFailurePath);
    }

    rollbackRestore({ targetPath, preRestoreBackupPath, provisionalFailurePath });
    error.message = `${error.message}. Previous database restored automatically.`;
    throw error;
  }

  return {
    targetPath,
    preRestoreBackupPath,
  };
}

async function run() {
  const sourceArg = String(process.argv[2] || "").trim();
  if (!sourceArg) {
    throw new Error("Usage: node scripts/restore-db.js <backup-file> [target-db]");
  }

  const sourcePath = path.resolve(process.cwd(), sourceArg);
  const targetArg = String(process.argv[3] || process.env.SQLITE_DB_PATH || "").trim();
  const targetPath = resolveConfiguredDbPath(targetArg);
  const result = restoreDatabase({ sourcePath, targetPath });

  console.log(`SQLite restore completed at ${result.targetPath}`);
  if (result.preRestoreBackupPath) {
    console.log(`Previous database backup saved at ${result.preRestoreBackupPath}`);
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error(`SQLite restore failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  restoreDatabase,
  validateRestoredDatabase,
  verifySqliteFile,
};
