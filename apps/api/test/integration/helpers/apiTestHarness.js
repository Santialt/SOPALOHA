const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

function createLocalDateTimeString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

function createApiHarness(options = {}) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), options.prefix || 'sopaloha-api-test-'));
  const sqliteDbPath = path.join(tempDir, options.dbFileName || 'support-test.db');

  process.env.NODE_ENV = 'test';
  process.env.PORT = '0';
  process.env.SQLITE_DB_PATH = sqliteDbPath;
  process.env.AUTH_SESSION_SECRET = options.authSessionSecret || 'sopaloha-integration-secret';
  process.env.INTERNAL_API_KEY = '';
  process.env.TEAMVIEWER_API_TOKEN = '';
  process.env.TEAMVIEWER_REPORTS_API_TOKEN = '';
  process.env.TEAMVIEWER_TIMEOUT_MS = '15000';
  process.env.TEAMVIEWER_MAX_RETRIES = '0';

  const db = require('../../../src/db/connection');
  const { startServer } = require('../../../src/server');
  const { hashPassword } = require('../../../src/utils/passwords');

  let server = null;
  let baseUrl = '';

  async function start() {
    assert.equal(path.resolve(db.dbFilePath), path.resolve(sqliteDbPath));
    server = await startServer({ port: 0 });
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
    return { baseUrl, db };
  }

  async function stop() {
    if (server) {
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

    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  function seedUser(user) {
    const result = db
      .prepare(
        `
          INSERT INTO users (name, email, password_hash, role, active)
          VALUES (?, ?, ?, ?, ?)
        `
      )
      .run(
        user.name,
        user.email,
        hashPassword(user.password),
        user.role || 'tech',
        user.active === false ? 0 : 1
      );

    return db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  }

  async function request(method, route, options = {}) {
    const headers = { ...(options.headers || {}) };
    let body = options.body;

    if (body !== undefined && body !== null && !(body instanceof Uint8Array) && typeof body !== 'string') {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      body = JSON.stringify(body);
    }

    const response = await fetch(`${baseUrl}${route}`, {
      method,
      headers,
      body
    });

    const text = await response.text();
    let json = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }

    return { response, status: response.status, headers: response.headers, body: json, text };
  }

  async function login(email, password) {
    const result = await request('POST', '/auth/login', {
      body: { email, password }
    });

    const sessionCookie = result.headers.get('set-cookie');
    return { ...result, sessionCookie };
  }

  async function loginAs(user) {
    return login(user.email, user.password);
  }

  async function requestWithSession(method, route, sessionCookie, options = {}) {
    const headers = {
      ...(options.headers || {}),
      Cookie: sessionCookie
    };

    return request(method, route, { ...options, headers });
  }

  async function authedRequest(user, method, route, options = {}) {
    const loginResult = await loginAs(user);
    assert.equal(loginResult.status, 200);
    return requestWithSession(method, route, loginResult.sessionCookie, options);
  }

  return {
    baseUrl: () => baseUrl,
    db,
    request,
    requestWithSession,
    login,
    loginAs,
    seedUser,
    start,
    stop,
    tempDir,
    test,
    createLocalDateTimeString,
    authedRequest
  };
}

module.exports = { createApiHarness, createLocalDateTimeString };
