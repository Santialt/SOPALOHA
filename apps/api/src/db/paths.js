const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const API_ROOT = path.resolve(__dirname, "../..");
const DEFAULT_DB_FILE_PATH = path.resolve(
  __dirname,
  "../../../../data/support.db",
);

function resolveConfiguredDbPath(value) {
  if (!value) {
    return DEFAULT_DB_FILE_PATH;
  }

  if (path.isAbsolute(value)) {
    return path.resolve(value);
  }

  if (value.startsWith("..")) {
    return path.resolve(API_ROOT, value);
  }

  return path.resolve(REPO_ROOT, value);
}

module.exports = {
  API_ROOT,
  DEFAULT_DB_FILE_PATH,
  REPO_ROOT,
  resolveConfiguredDbPath,
};
