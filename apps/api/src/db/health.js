const fs = require("fs");
const path = require("path");
const db = require("./connection");
const { getMigrationStatus } = require("./migrations");

function getDbDirectory() {
  return path.dirname(db.dbFilePath);
}

function runDbCheck() {
  db.prepare("SELECT 1 AS ok").get();
  return {
    status: "ok",
    detail: "SQLite query succeeded",
  };
}

function runDiskCheck() {
  const dbPath = db.dbFilePath;
  fs.accessSync(dbPath, fs.constants.R_OK | fs.constants.W_OK);

  const probePath = path.join(
    getDbDirectory(),
    `.healthcheck-${process.pid}-${Date.now()}.tmp`,
  );
  fs.writeFileSync(probePath, "ok");
  fs.unlinkSync(probePath);

  return {
    status: "ok",
    detail: "DB file and directory are writable",
  };
}

function runMigrationCheck() {
  const status = getMigrationStatus();
  if (status.pending.length > 0) {
    return {
      status: "error",
      detail: "Pending migrations detected",
      pending: status.pending.map((migration) => migration.id),
      current: status.current,
    };
  }

  return {
    status: "ok",
    detail: "Schema is up to date",
    current: status.current,
  };
}

function getHealthSnapshot() {
  const checks = {};
  const failures = [];

  for (const [name, runner] of Object.entries({
    db: runDbCheck,
    disk: runDiskCheck,
    migrations: runMigrationCheck,
  })) {
    try {
      checks[name] = runner();
    } catch (error) {
      checks[name] = {
        status: "error",
        detail: error.message,
      };
      failures.push(name);
    }
  }

  const status =
    failures.length > 0 ||
    Object.values(checks).some((check) => check.status === "error")
      ? "error"
      : Object.values(checks).some((check) => check.status === "degraded")
        ? "degraded"
        : "ok";

  return {
    status,
    checks: {
      db: checks.db?.status || "error",
      disk: checks.disk?.status || "error",
      migrations: checks.migrations?.status || "error",
    },
    details: checks,
  };
}

module.exports = {
  getHealthSnapshot,
};
