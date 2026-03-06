const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbFilePath = path.resolve(__dirname, '../../../../data/support.db');
fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });

const db = new Database(dbFilePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

module.exports = db;
