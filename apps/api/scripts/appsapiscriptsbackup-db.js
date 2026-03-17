const fs = require("fs");
const path = require("path");

const dbFile = path.join(__dirname, "../../data/support.db");
const backupDir = path.join(__dirname, "../../backups/db");

fs.mkdirSync(backupDir, { recursive: true });

const date = new Date().toISOString().replace(/[:.]/g, "-");
const backupFile = path.join(backupDir, `support-${date}.db`);

fs.copyFileSync(dbFile, backupFile);

console.log("DB backup created:", backupFile);