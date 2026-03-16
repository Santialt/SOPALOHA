const test = require("node:test");
const assert = require("node:assert/strict");
const { createApiHarness } = require("./helpers/apiTestHarness");

test("GET /dashboard/summary returns operational incident metrics", async () => {
  const harness = createApiHarness({ prefix: "sopaloha-dashboard-" });

  try {
    await harness.start();

    const credentials = {
      name: "Dashboard Tech",
      email: "dashboard@example.com",
      password: "Secret123!",
      role: "admin",
    };
    const user = harness.seedUser(credentials);

    const now = new Date();
    const withinWindow = new Date(now);
    withinWindow.setDate(withinWindow.getDate() - 10);
    const outsideWindow = new Date(now);
    outsideWindow.setDate(outsideWindow.getDate() - 45);

    const formatDateOnly = (date) => date.toISOString().slice(0, 10);

    const locationA = harness.db
      .prepare(
        `INSERT INTO locations (name, status) VALUES ('Local Centro', 'active')`,
      )
      .run().lastInsertRowid;
    const locationB = harness.db
      .prepare(
        `INSERT INTO locations (name, status) VALUES ('Local Norte', 'active')`,
      )
      .run().lastInsertRowid;

    harness.db
      .prepare(
        `
          INSERT INTO incidents (
            location_id, incident_date, title, description, category, status, created_by, updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        locationA,
        formatDateOnly(withinWindow),
        "Aloha no abre",
        "Detalle",
        "aloha",
        "open",
        user.id,
        user.id,
      );
    harness.db
      .prepare(
        `
          INSERT INTO incidents (
            location_id, incident_date, title, description, category, status, created_by, updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        locationA,
        formatDateOnly(withinWindow),
        "Error fiscal",
        "Detalle",
        "fiscal",
        "closed",
        user.id,
        user.id,
      );
    harness.db
      .prepare(
        `
          INSERT INTO incidents (
            location_id, incident_date, title, description, category, status, created_by, updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        locationB,
        formatDateOnly(withinWindow),
        "Aloha lento",
        "Detalle",
        "aloha",
        "closed",
        user.id,
        user.id,
      );
    harness.db
      .prepare(
        `
          INSERT INTO incidents (
            location_id, incident_date, title, description, category, status, created_by, updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        locationB,
        formatDateOnly(outsideWindow),
        "Incidente viejo",
        "Detalle",
        "printer",
        "open",
        user.id,
        user.id,
      );

    const loginResult = await harness.login(
      credentials.email,
      credentials.password,
    );
    assert.equal(loginResult.status, 200);

    const result = await harness.requestWithSession(
      "GET",
      "/dashboard/summary",
      loginResult.sessionCookie,
    );

    assert.equal(result.status, 200);
    assert.equal(result.body.locations, 2);
    assert.equal(result.body.incidents, 4);
    assert.deepEqual(result.body.incidentMetrics.totalCases, 4);
    assert.deepEqual(result.body.incidentMetrics.resolvedCases, 2);
    assert.deepEqual(result.body.incidentMetrics.inProgressCases, 2);
    assert.equal(result.body.incidentMetrics.activeStatusKey, "open");
    assert.equal(result.body.incidentMetrics.resolvedStatusKey, "closed");
    assert.equal(result.body.incidentMetrics.lastMonthWindow.days, 30);
    assert.equal(result.body.incidentMetrics.topLocations.length, 2);
    assert.deepEqual(result.body.incidentMetrics.topLocations[0], {
      location_id: locationA,
      location_name: "Local Centro",
      incident_count: 2,
    });
    assert.deepEqual(result.body.incidentMetrics.mostFrequentCategory, {
      category: "aloha",
      incidentCount: 2,
    });
  } finally {
    await harness.stop();
  }
});
