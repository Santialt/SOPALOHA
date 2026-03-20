const readline = require('readline');
const db = require('../src/db/connection');
const { initDatabase } = require('../src/db/initDb');
const { requireSessionSecret } = require('../src/utils/authSession');
const { hashPassword } = require('../src/utils/passwords');

function askQuestion(rl, prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function promptForPassword() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    const password = await askQuestion(rl, 'Admin password: ');
    const confirmPassword = await askQuestion(rl, 'Confirm password: ');
    return { password, confirmPassword };
  } finally {
    rl.close();
  }
}

async function run() {
  requireSessionSecret();
  initDatabase();

  const email = String(process.argv[2] || '').trim().toLowerCase();
  const name = String(process.argv[3] || 'Administrador SOPALOHA').trim();

  if (!email) {
    throw new Error('Usage: node scripts/create-admin.js <email> [name]');
  }

  const existing = db
    .prepare('SELECT id, email, role FROM users WHERE lower(email) = lower(?)')
    .get(email);

  if (existing) {
    if (existing.role === 'admin') {
      console.log(`Admin user already exists for ${existing.email}`);
      return;
    }

    throw new Error(`A non-admin user already exists for ${existing.email}`);
  }

  const { password, confirmPassword } = await promptForPassword();
  if (!String(password || '').trim()) {
    throw new Error('Password is required');
  }

  if (password !== confirmPassword) {
    throw new Error('Passwords do not match');
  }

  db.prepare(
    `
      INSERT INTO users (name, email, password_hash, role, active, login_enabled)
      VALUES (?, ?, ?, 'admin', 1, 1)
    `
  ).run(name, email, hashPassword(password));

  console.log(`Admin user created for ${email}`);
}

run().catch((error) => {
  console.error(`Admin provisioning failed: ${error.message}`);
  process.exit(1);
});
