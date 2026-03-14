const test = require("node:test");
const assert = require("node:assert/strict");
const { createApiTestContext } = require("../helpers/apiTestContext");

test("integracion tasks", async (t) => {
  const ctx = await createApiTestContext("sopaloha-tasks-");
  t.after(async () => {
    await ctx.cleanup();
  });

  const adminUser = ctx.seedUser({
    name: "Tasks Admin",
    email: "tasks.admin@example.com",
    role: "admin",
    password: "Tasks#Admin123",
  });
  const techUser = ctx.seedUser({
    name: "Tasks Tech",
    email: "tasks.tech@example.com",
    role: "tech",
    password: "Tasks#Tech123",
  });
  const inactiveTechUser = ctx.seedUser({
    name: "Tasks Inactive",
    email: "tasks.inactive@example.com",
    role: "tech",
    password: "Tasks#Inactive123",
    active: false,
  });

  const auth = await ctx.login({
    email: adminUser.email,
    password: adminUser.password,
  });
  const cookie = auth.cookie;

  const locationResponse = await ctx.requestJson("/locations", {
    method: "POST",
    headers: {
      Cookie: cookie,
    },
    body: {
      name: "Local Tasks",
    },
  });
  const locationId = locationResponse.body.id;

  const deviceResponse = await ctx.requestJson("/devices", {
    method: "POST",
    headers: {
      Cookie: cookie,
    },
    body: {
      location_id: locationId,
      name: "POS Tasks",
      type: "pos_terminal",
    },
  });
  const deviceId = deviceResponse.body.id;

  const incidentResponse = await ctx.requestJson("/incidents", {
    method: "POST",
    headers: {
      Cookie: cookie,
    },
    body: {
      location_id: locationId,
      device_id: deviceId,
      incident_date: "2026-03-12",
      title: "Incident para task",
      description: "Base de referencia",
    },
  });
  const incidentId = incidentResponse.body.id;

  await t.test("CRUD basico de tasks y asignacion por usuario", async () => {
    const createResponse = await ctx.requestJson("/tasks", {
      method: "POST",
      headers: {
        Cookie: cookie,
      },
      body: {
        title: "Revisar backups",
        description: "Validar restauracion",
        location_id: locationId,
        device_id: deviceId,
        incident_id: incidentId,
        assigned_user_id: techUser.id,
        due_date: "2026-03-20",
        scheduled_for: "2026-03-15T09:00",
        status: "pending",
        priority: "high",
      },
    });

    assert.equal(createResponse.status, 201);
    assert.equal(createResponse.body.assigned_user_id, techUser.id);
    assert.equal(createResponse.body.assigned_to, techUser.name);
    assert.equal(createResponse.body.created_by, adminUser.id);
    assert.equal(createResponse.body.priority, "high");

    const taskId = createResponse.body.id;

    const listResponse = await ctx.requestJson(
      `/tasks?location_id=${locationId}&status=pending`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    assert.equal(listResponse.status, 200);
    assert.ok(listResponse.body.some((task) => task.id === taskId));

    const getResponse = await ctx.requestJson(`/tasks/${taskId}`, {
      headers: {
        Cookie: cookie,
      },
    });
    assert.equal(getResponse.status, 200);
    assert.equal(getResponse.body.id, taskId);

    const updateResponse = await ctx.requestJson(`/tasks/${taskId}`, {
      method: "PUT",
      headers: {
        Cookie: cookie,
      },
      body: {
        title: "Revisar backups urgente",
        description: "Se detecto riesgo operativo",
        location_id: locationId,
        device_id: deviceId,
        incident_id: incidentId,
        assigned_user_id: techUser.id,
        due_date: "2026-03-21",
        scheduled_for: "2026-03-15 10:00",
        status: "in_progress",
        priority: "critical",
      },
    });

    assert.equal(updateResponse.status, 200);
    assert.equal(updateResponse.body.status, "in_progress");
    assert.equal(updateResponse.body.priority, "critical");
    assert.equal(updateResponse.body.updated_by, adminUser.id);

    const deleteResponse = await ctx.requestJson(`/tasks/${taskId}`, {
      method: "DELETE",
      headers: {
        Cookie: cookie,
      },
    });
    assert.equal(deleteResponse.status, 204);

    const missingResponse = await ctx.requestJson(`/tasks/${taskId}`, {
      headers: {
        Cookie: cookie,
      },
    });
    assert.equal(missingResponse.status, 404);
    assert.equal(missingResponse.body.message, "Task not found");
  });

  await t.test("rechaza assigned_user_id inactivo", async () => {
    const response = await ctx.requestJson("/tasks", {
      method: "POST",
      headers: {
        Cookie: cookie,
      },
      body: {
        title: "Task invalida",
        assigned_user_id: inactiveTechUser.id,
      },
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.message, "Assigned user is invalid or inactive");
  });
});
