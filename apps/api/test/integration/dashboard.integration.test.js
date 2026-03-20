const test = require("node:test");
const assert = require("node:assert/strict");
const { createApiHarness } = require("./helpers/apiTestHarness");

test("GET /dashboard/summary returns operational dashboard metrics without inferred case states", async () => {
  const harness = createApiHarness({ prefix: "sopaloha-dashboard-" });

  try {
    await harness.start();

    const adminCredentials = {
      name: "Dashboard Admin",
      email: "dashboard.admin@example.com",
      password: "Secret123!",
      role: "admin",
    };
    const techCredentials = {
      name: "Dashboard Tech",
      email: "dashboard.tech@example.com",
      password: "Secret123!",
      role: "tech",
    };
    const user = harness.seedUser(adminCredentials);
    harness.seedUser(techCredentials);

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
      adminCredentials.email,
      adminCredentials.password,
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
    assert.equal(result.body.tasks, 5);
    assert.deepEqual(result.body.incidentMetrics.totalCases, 4);
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
      incident_count: 2,
    });
    assert.deepEqual(result.body.incidentMetrics.topLocations[1], {
      location_id: locationB,
      location_name: "Local Norte",
      incident_count: 1,
    });
    assert.deepEqual(result.body.incidentMetrics.mostFrequentCategory, {
      category: "aloha",
      incidentCount: 2,
    });
    assert.equal(
      JSON.stringify(result.body).includes("tv-open-1"),
      false,
    );
    assert.equal(
      JSON.stringify(result.body).includes("Local Centro"),
      true,
    );

    harness.db.prepare("DELETE FROM tasks").run();
    const locationC = harness.db
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
        locationC,
        "blocked",
        "high",
        null,
        "general",
        user.id,
        user.id,
      );

    const undatedResult = await harness.requestWithSession(
      "GET",
      "/dashboard/summary",
      loginResult.sessionCookie,
    );

    assert.equal(undatedResult.status, 200);
    assert.equal(undatedResult.body.taskMetrics.totalTasks, 1);
    assert.equal(undatedResult.body.taskMetrics.openTasks, 1);
    assert.equal(undatedResult.body.taskMetrics.closedTasks, 0);
    assert.equal(
      undatedResult.body.taskMetrics.urgentTasksPreviewMode,
      "undated",
    );
    assert.equal(undatedResult.body.taskMetrics.urgentTasksPreview.length, 1);
    assert.equal(
      undatedResult.body.taskMetrics.urgentTasksPreview[0].title,
      "Tarea abierta sin fecha",
    );
    assert.equal(
      undatedResult.body.taskMetrics.urgentTasksPreview[0].due_date,
      null,
    );

    const techLoginResult = await harness.login(
      techCredentials.email,
      techCredentials.password,
    );
    assert.equal(techLoginResult.status, 200);

    const techDashboard = await harness.requestWithSession(
      "GET",
      "/dashboard/summary",
      techLoginResult.sessionCookie,
    );
    assert.equal(techDashboard.status, 200);
    assert.equal(techDashboard.body.incidents, 4);
    assert.equal(
      JSON.stringify(techDashboard.body).includes("tv-open-1"),
      false,
    );
    assert.equal(
      JSON.stringify(techDashboard.body).includes("POS no responde - Soporte"),
      false,
    );
    assert.equal(
      JSON.stringify(techDashboard.body).includes("Local Centro"),
      true,
    );
  } finally {
    await harness.stop();
  }
});
