const fs = require("fs");
const os = require("os");
const path = require("path");

const apiSrcRoot = path.resolve(__dirname, "../../src");

function resetApiModuleCache() {
  for (const cacheKey of Object.keys(require.cache)) {
    if (cacheKey.startsWith(apiSrcRoot)) {
      delete require.cache[cacheKey];
    }
  }
}

async function closeServer(server) {
  if (!server) return;

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function createApiTestContext(prefix = "sopaloha-api-int-") {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const sqliteDbPath = path.join(tempDir, "support-test.db");

  process.env.NODE_ENV = "test";
  process.env.PORT = "0";
  process.env.SQLITE_DB_PATH = sqliteDbPath;
  process.env.AUTH_SESSION_SECRET = `${path.basename(tempDir)}-secret`;

  resetApiModuleCache();

  const { startServer } = require("../../src/server");
  const db = require("../../src/db/connection");
  const { hashPassword } = require("../../src/utils/passwords");

  const server = await startServer({ port: 0 });
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  async function request(routePath, options = {}) {
    const headers = { ...(options.headers || {}) };
    let body = options.body;

    if (
      body &&
      typeof body === "object" &&
      !(body instanceof Buffer) &&
      !headers["Content-Type"]
    ) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(body);
    }

    return fetch(`${baseUrl}${routePath}`, {
      method: options.method || "GET",
      headers,
      body,
    });
  }

  async function requestJson(routePath, options = {}) {
    const response = await request(routePath, options);
    const text = await response.text();

    return {
      status: response.status,
      headers: response.headers,
      body: text ? JSON.parse(text) : null,
    };
  }

  function seedUser(overrides = {}) {
    const password = overrides.password || "Sopaloha#Test123";
    const userPayload = {
      name: overrides.name || "Integration User",
      email:
        overrides.email || `user-${Date.now()}-${Math.random()}@example.com`,
      password_hash: hashPassword(password),
      role: overrides.role || "admin",
      active: overrides.active === undefined ? 1 : overrides.active ? 1 : 0,
    };

    const result = db
      .prepare(
        `
          INSERT INTO users (name, email, password_hash, role, active)
          VALUES (@name, @email, @password_hash, @role, @active)
        `,
      )
      .run(userPayload);

    const user = db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(result.lastInsertRowid);
    return { ...user, password };
  }

  async function login(credentials) {
    const response = await requestJson("/auth/login", {
      method: "POST",
      body: credentials,
    });

    return {
      ...response,
      cookie: response.headers.get("set-cookie"),
    };
  }

  async function cleanup() {
    await closeServer(server);
    db.close();
    resetApiModuleCache();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  return {
    baseUrl,
    db,
    login,
    request,
    requestJson,
    seedUser,
    cleanup,
    sqliteDbPath,
    tempDir,
  };
}

module.exports = {
  createApiTestContext,
  resetApiModuleCache,
};
