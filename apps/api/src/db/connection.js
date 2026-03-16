const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DEFAULT_DB_FILE_PATH = path.resolve(
  __dirname,
  "../../../../data/support.db",
);
const configuredDbPath = String(process.env.SQLITE_DB_PATH || "").trim();
const dbFilePath = configuredDbPath
  ? path.resolve(process.cwd(), configuredDbPath)
  : DEFAULT_DB_FILE_PATH;
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
