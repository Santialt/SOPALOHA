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

fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });

const db = new Database(dbFilePath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

module.exports = db;
module.exports.dbFilePath = dbFilePath;
