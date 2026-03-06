const fs = require('fs');
const path = require('path');
const db = require('./connection');

function initDatabase() {
  const schemaPath = path.resolve(__dirname, '../../../../docs/sqlite-mvp-schema.sql');

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found at: ${schemaPath}`);
  }

  const sql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(sql);
  console.log('Database initialized successfully at data/support.db');
}

try {
  initDatabase();
} catch (error) {
  console.error('Database initialization failed:', error.message);
  process.exit(1);
}
