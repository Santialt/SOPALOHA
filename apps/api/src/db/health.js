const db = require("./connection");
const { getMigrationStatusReadOnly } = require("./migrations");

function runDbCheck() {
  db.prepare("SELECT 1 AS ok").get();
  return {
    status: "ok",
    detail: "SQLite query succeeded",
  };
}

function runDiskCheck() {
  const pageCount = db.pragma("page_count", { simple: true });
  const freelistCount = db.pragma("freelist_count", { simple: true });

  return {
    status: "ok",
    detail: "SQLite storage metadata is readable",
    page_count: Number(pageCount),
    freelist_count: Number(freelistCount),
  };
}

function runMigrationCheck() {
  const status = getMigrationStatusReadOnly();
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
