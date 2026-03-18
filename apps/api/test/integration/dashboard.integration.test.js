const test = require("node:test");
const assert = require("node:assert/strict");
const { createApiHarness } = require("./helpers/apiTestHarness");

test("GET /dashboard/summary returns operational dashboard metrics without inferred case states", async () => {
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
    harness.db
      .prepare(
        `
          INSERT INTO teamviewer_imported_cases (
            external_connection_id,
            started_at,
            ended_at,
            duration_seconds,
            technician_username,
            technician_display_name,
            teamviewer_group_name,
            note_raw,
            problem_description,
            requested_by,
            location_id,
            linked_incident_id,
            raw_payload_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        "tv-open-1",
        withinWindow.toISOString(),
        withinWindow.toISOString(),
        300,
        "tech1",
        "Dashboard Tech",
        "Local Centro",
        "POS no responde - Soporte",
        "POS no responde",
        "Soporte",
        locationA,
        null,
        "{}",
      );
    harness.db
      .prepare(
        `
          INSERT INTO teamviewer_imported_cases (
            external_connection_id,
            started_at,
            ended_at,
            duration_seconds,
            technician_username,
            technician_display_name,
            teamviewer_group_name,
            note_raw,
            problem_description,
            requested_by,
            location_id,
            linked_incident_id,
            raw_payload_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        "tv-linked-1",
        withinWindow.toISOString(),
        withinWindow.toISOString(),
        180,
        "tech1",
        "Dashboard Tech",
        "Local Norte",
        "Caja congelada - Operacion",
        "Caja congelada",
        "Operacion",
        locationB,
        1,
        "{}",
      );
    harness.db
      .prepare(
        `
          INSERT INTO tasks (
            title, description, location_id, status, priority, due_date, task_type, created_by, updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        "Resolver fiscal vencida",
        "Detalle",
        locationA,
        "pending",
        "critical",
        formatDateOnly(new Date(now.getTime() - 86400000)),
        "general",
        user.id,
        user.id,
      );
    harness.db
      .prepare(
        `
          INSERT INTO tasks (
            title, description, location_id, status, priority, due_date, task_type, created_by, updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        "Validar router",
        "Detalle",
        locationB,
        "in_progress",
        "high",
        formatDateOnly(new Date(now.getTime() + 86400000)),
        "general",
        user.id,
        user.id,
      );
    harness.db
      .prepare(
        `
          INSERT INTO tasks (
            title, description, location_id, status, priority, due_date, task_type, created_by, updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        "Revisar stock sin fecha",
        "Detalle",
        locationA,
        "blocked",
        "medium",
        null,
        "general",
        user.id,
        user.id,
      );
    harness.db
      .prepare(
        `
          INSERT INTO tasks (
            title, description, location_id, status, priority, due_date, task_type, created_by, updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        "Cerrar incidente historico",
        "Detalle",
        locationB,
        "done",
        "low",
        formatDateOnly(new Date(now.getTime() - 172800000)),
        "general",
        user.id,
        user.id,
      );
    harness.db
      .prepare(
        `
          INSERT INTO tasks (
            title, description, location_id, status, priority, due_date, task_type, created_by, updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        "Cancelar visita",
        "Detalle",
        locationB,
        "cancelled",
        "low",
        null,
        "general",
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
    assert.equal(result.body.incidents, 5);
    assert.equal(result.body.tasks, 5);
    assert.deepEqual(result.body.incidentMetrics.totalCases, 5);
    assert.equal(result.body.incidentMetrics.resolvedCases, undefined);
    assert.equal(result.body.incidentMetrics.inProgressCases, undefined);
    assert.equal(result.body.incidentMetrics.activeStatusKey, undefined);
    assert.equal(result.body.incidentMetrics.resolvedStatusKey, undefined);
    assert.equal(result.body.taskMetrics.totalTasks, 5);
    assert.equal(result.body.taskMetrics.openTasks, 3);
    assert.equal(result.body.taskMetrics.closedTasks, 2);
    assert.equal(result.body.taskMetrics.urgentTasksPreviewMode, "due_date");
    assert.equal(result.body.taskMetrics.urgentTasksPreview.length, 2);
    assert.equal(
      result.body.taskMetrics.urgentTasksPreview[0].title,
      "Resolver fiscal vencida",
    );
    assert.equal(
      result.body.taskMetrics.urgentTasksPreview[0].status,
      "pending",
    );
    assert.equal(
      result.body.taskMetrics.urgentTasksPreview[0].priority,
      "critical",
    );
    assert.equal(
      result.body.taskMetrics.urgentTasksPreview[0].due_date,
      formatDateOnly(new Date(now.getTime() - 86400000)),
    );
    assert.equal(
      result.body.taskMetrics.urgentTasksPreview[0].location_id,
      locationA,
    );
    assert.equal(
      result.body.taskMetrics.urgentTasksPreview[0].location_name,
      "Local Centro",
    );
    assert.equal(
      result.body.taskMetrics.urgentTasksPreview[1].title,
      "Validar router",
    );
    assert.equal(
      result.body.taskMetrics.urgentTasksPreview[1].status,
      "in_progress",
    );
    assert.equal(
      result.body.taskMetrics.urgentTasksPreview[1].priority,
      "high",
    );
    assert.equal(
      result.body.taskMetrics.urgentTasksPreview[1].due_date,
      formatDateOnly(new Date(now.getTime() + 86400000)),
    );
    assert.equal(
      result.body.taskMetrics.urgentTasksPreview[1].location_id,
      locationB,
    );
    assert.equal(
      result.body.taskMetrics.urgentTasksPreview[1].location_name,
      "Local Norte",
    );
    assert.equal(result.body.incidentMetrics.lastMonthWindow.days, 30);
    assert.equal(result.body.incidentMetrics.topLocations.length, 2);
    assert.deepEqual(result.body.incidentMetrics.topLocations[0], {
      location_id: locationA,
      location_name: "Local Centro",
      incident_count: 3,
    });
    assert.deepEqual(result.body.incidentMetrics.mostFrequentCategory, {
      category: "aloha",
      incidentCount: 2,
    });
  } finally {
    await harness.stop();
  }
});

test("GET /dashboard/summary falls back to undated open tasks when no open task has due_date", async () => {
  const harness = createApiHarness({ prefix: "sopaloha-dashboard-undated-" });

  try {
    await harness.start();

    const credentials = {
      name: "Dashboard Tech",
      email: "dashboard-undated@example.com",
      password: "Secret123!",
      role: "admin",
    };
    const user = harness.seedUser(credentials);

    const locationId = harness.db
      .prepare(
        `INSERT INTO locations (name, status) VALUES ('Local Sur', 'active')`,
      )
      .run().lastInsertRowid;

    harness.db
      .prepare(
        `
          INSERT INTO tasks (
            title, description, location_id, status, priority, due_date, task_type, created_by, updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        "Tarea abierta sin fecha",
        "Detalle",
        locationId,
        "blocked",
        "high",
        null,
        "general",
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
    assert.equal(result.body.taskMetrics.totalTasks, 1);
    assert.equal(result.body.taskMetrics.openTasks, 1);
    assert.equal(result.body.taskMetrics.closedTasks, 0);
    assert.equal(result.body.taskMetrics.urgentTasksPreviewMode, "undated");
    assert.equal(result.body.taskMetrics.urgentTasksPreview.length, 1);
    assert.equal(
      result.body.taskMetrics.urgentTasksPreview[0].title,
      "Tarea abierta sin fecha",
    );
    assert.equal(result.body.taskMetrics.urgentTasksPreview[0].due_date, null);
  } finally {
    await harness.stop();
  }
});
