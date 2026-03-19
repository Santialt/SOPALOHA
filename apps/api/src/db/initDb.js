const db = require("./connection");
const { applyPendingMigrations, getMigrationStatus } = require("./migrations");

function initDatabase() {
  const migrationStatus = applyPendingMigrations();
  console.log(`Database initialized successfully at ${db.dbFilePath}`);
  return migrationStatus;
}

if (require.main === module) {
  try {
    initDatabase();
  } catch (error) {
    console.error("Database initialization failed:", error.message);
    process.exit(1);
  }
}

module.exports = {
  getMigrationStatus,
  initDatabase,
};
