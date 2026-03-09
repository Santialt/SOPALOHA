const fs = require('fs');
const path = require('path');
const db = require('../src/db/connection');

function formatTimestamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

async function run() {
  const backupDir = path.resolve(__dirname, '../../../data/backups');
  fs.mkdirSync(backupDir, { recursive: true });

  const outputPath =
    process.argv[2] && String(process.argv[2]).trim()
      ? path.resolve(process.cwd(), process.argv[2])
      : path.join(backupDir, `support-${formatTimestamp(new Date())}.db`);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  db.pragma('wal_checkpoint(TRUNCATE)');
  await db.backup(outputPath);

  console.log(`SQLite backup created at ${outputPath}`);
}

run().catch((error) => {
  console.error(`SQLite backup failed: ${error.message}`);
  process.exit(1);
});
