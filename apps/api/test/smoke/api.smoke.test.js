const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sopaloha-api-smoke-"));
const sqliteDbPath = path.join(tempDir, "support-smoke.db");

process.env.NODE_ENV = "test";
process.env.PORT = "0";
process.env.SQLITE_DB_PATH = sqliteDbPath;
process.env.AUTH_SESSION_SECRET = "sopaloha-smoke-secret";

const db = require("../../src/db/connection");
const { startServer } = require("../../src/server");
const { hashPassword } = require("../../src/utils/passwords");

test("el API responde health y permite login basico con DB temporal", async (t) => {
  const seededEmail = "smoke@example.com";
  const seededPassword = "Sopaloha#Smoke123";

  const server = await startServer({ port: 0 });

  db.prepare(
    `
      INSERT INTO users (name, email, password_hash, role, active)
      VALUES (?, ?, ?, 'admin', 1)
    `,
  ).run("Smoke User", seededEmail, hashPassword(seededPassword));

  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const healthResponse = await fetch(`${baseUrl}/health`);
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), { status: "ok" });

  const loginResponse = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: seededEmail,
      password: seededPassword,
    }),
  });

  assert.equal(loginResponse.status, 200);
  const loginBody = await loginResponse.json();
  assert.equal(loginBody.email, seededEmail);
  assert.equal(loginBody.role, "admin");

  const sessionCookie = loginResponse.headers.get("set-cookie");
  assert.ok(sessionCookie);
  assert.match(sessionCookie, /sopaloha_session=/);

  const meResponse = await fetch(`${baseUrl}/auth/me`, {
    headers: {
      Cookie: sessionCookie,
    },
  });

  assert.equal(meResponse.status, 200);
  const meBody = await meResponse.json();
  assert.equal(meBody.email, seededEmail);
});
