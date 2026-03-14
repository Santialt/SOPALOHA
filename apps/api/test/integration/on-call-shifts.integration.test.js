const test = require("node:test");
const assert = require("node:assert/strict");
const { createApiTestContext } = require("../helpers/apiTestContext");

function toLocalDateTimeString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

test("integracion on-call shifts", async (t) => {
  const ctx = await createApiTestContext("sopaloha-oncall-");
  t.after(async () => {
    await ctx.cleanup();
  });

  const techUser = ctx.seedUser({
    name: "OnCall Tech",
    email: "oncall.tech@example.com",
    role: "tech",
    password: "OnCall#123",
  });
  const auth = await ctx.login({
    email: techUser.email,
    password: techUser.password,
  });
  const cookie = auth.cookie;

  const now = new Date();
  const activeStart = toLocalDateTimeString(
    new Date(now.getTime() - 30 * 60 * 1000),
  );
  const activeEnd = toLocalDateTimeString(
    new Date(now.getTime() + 30 * 60 * 1000),
  );
  const pastStart = toLocalDateTimeString(
    new Date(now.getTime() - 4 * 60 * 60 * 1000),
  );
  const pastEnd = toLocalDateTimeString(
    new Date(now.getTime() - 2 * 60 * 60 * 1000),
  );

  await t.test("CRUD basico y current shift", async () => {
    const pastResponse = await ctx.requestJson("/on-call-shifts", {
      method: "POST",
      headers: {
        Cookie: cookie,
      },
      body: {
        title: "Turno pasado",
        assigned_to: "Tecnico Pasado",
        start_at: pastStart,
        end_at: pastEnd,
      },
    });
    assert.equal(pastResponse.status, 201);

    const createResponse = await ctx.requestJson("/on-call-shifts", {
      method: "POST",
      headers: {
        Cookie: cookie,
      },
      body: {
        title: "Turno actual",
        assigned_to: "Tecnico Actual",
        backup_assigned_to: "Backup Actual",
        start_at: activeStart,
        end_at: activeEnd,
        notes: "Cobertura operativa",
      },
    });

    assert.equal(createResponse.status, 201);
    assert.equal(createResponse.body.assigned_to, "Tecnico Actual");

    const shiftId = createResponse.body.id;

    const currentResponse = await ctx.requestJson("/on-call-shifts/current", {
      headers: {
        Cookie: cookie,
      },
    });
    assert.equal(currentResponse.status, 200);
    assert.equal(currentResponse.body.id, shiftId);
    assert.equal(currentResponse.body.assigned_to, "Tecnico Actual");

    const updateResponse = await ctx.requestJson(`/on-call-shifts/${shiftId}`, {
      method: "PUT",
      headers: {
        Cookie: cookie,
      },
      body: {
        title: "Turno actual extendido",
        assigned_to: "Tecnico Actual",
        backup_assigned_to: "Backup Actual",
        start_at: activeStart,
        end_at: toLocalDateTimeString(new Date(now.getTime() + 90 * 60 * 1000)),
        notes: "Cobertura extendida",
      },
    });

    assert.equal(updateResponse.status, 200);
    assert.equal(updateResponse.body.title, "Turno actual extendido");

    const deleteResponse = await ctx.requestJson(`/on-call-shifts/${shiftId}`, {
      method: "DELETE",
      headers: {
        Cookie: cookie,
      },
    });
    assert.equal(deleteResponse.status, 204);

    const currentAfterDelete = await ctx.requestJson(
      "/on-call-shifts/current",
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    assert.equal(currentAfterDelete.status, 200);
    assert.equal(currentAfterDelete.body, null);
  });

  await t.test("rechaza shifts con rango temporal invalido", async () => {
    const response = await ctx.requestJson("/on-call-shifts", {
      method: "POST",
      headers: {
        Cookie: cookie,
      },
      body: {
        title: "Turno invalido",
        assigned_to: "Tecnico X",
        start_at: "2026-03-14T12:00:00",
        end_at: "2026-03-14T11:00:00",
      },
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.message, "start_at must be earlier than end_at");
  });
});
