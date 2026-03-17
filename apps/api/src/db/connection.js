const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const API_ROOT = path.resolve(__dirname, "../..");
const DEFAULT_DB_FILE_PATH = path.resolve(
  __dirname,
  "../../../../data/support.db",
);
const configuredDbPath = String(process.env.SQLITE_DB_PATH || "").trim();

function resolveConfiguredDbPath(value) {
  if (!value) {
    return DEFAULT_DB_FILE_PATH;
  }

  if (path.isAbsolute(value)) {
    return path.resolve(value);
  }

  // Keep legacy ../../data/support.db semantics from apps/api/.env while
  // making plain data/support.db resolve to the repo root consistently.
  if (value.startsWith("..")) {
    return path.resolve(API_ROOT, value);
  }

  return path.resolve(REPO_ROOT, value);
}

const dbFilePath = resolveConfiguredDbPath(configuredDbPath);
const normalizedDbFilePath = path.normalize(dbFilePath).toLowerCase();
const normalizedDefaultDbFilePath = path
  .normalize(DEFAULT_DB_FILE_PATH)
  .toLowerCase();

function isDataSupportDbPath(value) {
  const normalized = path.normalize(value).toLowerCase();
  const pathParts = normalized.split(path.sep).filter(Boolean);
  const lastPart = pathParts[pathParts.length - 1];
  const parentPart = pathParts[pathParts.length - 2];

  return lastPart === "support.db" && parentPart === "data";
}

if (
  process.env.NODE_ENV === "test" &&
  (normalizedDbFilePath === normalizedDefaultDbFilePath ||
    isDataSupportDbPath(normalizedDbFilePath))
) {
  throw new Error(
    `Refusing to open production SQLite path during tests: ${dbFilePath}`,
  );
}

fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });

const db = new Database(dbFilePath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

module.exports = db;
module.exports.dbFilePath = dbFilePath;
module.exports.resolveConfiguredDbPath = resolveConfiguredDbPath;
