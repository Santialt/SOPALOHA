const test = require("node:test");
const assert = require("node:assert/strict");
const { createApiTestContext } = require("../helpers/apiTestContext");

test("integracion incidents", async (t) => {
  const ctx = await createApiTestContext("sopaloha-incidents-");
  t.after(async () => {
    await ctx.cleanup();
  });

  const techUser = ctx.seedUser({
    name: "Incidents Tech",
    email: "incidents.tech@example.com",
    role: "tech",
    password: "Incidents#123",
  });
  const auth = await ctx.login({
    email: techUser.email,
    password: techUser.password,
  });
  const cookie = auth.cookie;

  const locationResponse = await ctx.requestJson("/locations", {
    method: "POST",
    headers: {
      Cookie: cookie,
    },
    body: {
      name: "Local Incidents",
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
      name: "Server Local",
      type: "server",
    },
  });
  const deviceId = deviceResponse.body.id;

  await t.test("CRUD basico de incidents con actor autenticado", async () => {
    const createResponse = await ctx.requestJson("/incidents", {
      method: "POST",
      headers: {
        Cookie: cookie,
      },
      body: {
        location_id: locationId,
        device_id: deviceId,
        incident_date: "2026-03-10",
        title: "Falla SQL",
        description: "No inicia el motor",
        category: "sql",
        time_spent_minutes: 45,
      },
    });

    assert.equal(createResponse.status, 201);
    assert.equal(createResponse.body.location_id, locationId);
    assert.equal(createResponse.body.device_id, deviceId);
    assert.equal(createResponse.body.created_by, techUser.id);
    assert.equal(createResponse.body.created_by_name, techUser.name);
    assert.equal(createResponse.body.status, "open");

    const incidentId = createResponse.body.id;

    const listResponse = await ctx.requestJson(
      `/incidents?location_id=${locationId}`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    assert.equal(listResponse.status, 200);
    assert.ok(listResponse.body.some((incident) => incident.id === incidentId));

    const getResponse = await ctx.requestJson(`/incidents/${incidentId}`, {
      headers: {
        Cookie: cookie,
      },
    });
    assert.equal(getResponse.status, 200);
    assert.equal(getResponse.body.id, incidentId);

    const updateResponse = await ctx.requestJson(`/incidents/${incidentId}`, {
      method: "PUT",
      headers: {
        Cookie: cookie,
      },
      body: {
        location_id: locationId,
        device_id: deviceId,
        incident_date: "2026-03-11T09:30",
        title: "Falla SQL resuelta",
        description: "Se restauraron archivos",
        solution: "Reinicio de servicio",
        category: "sql",
        status: "closed",
        time_spent_minutes: 60,
      },
    });

    assert.equal(updateResponse.status, 200);
    assert.equal(updateResponse.body.title, "Falla SQL resuelta");
    assert.equal(updateResponse.body.status, "closed");
    assert.equal(updateResponse.body.updated_by, techUser.id);
    assert.equal(updateResponse.body.updated_by_name, techUser.name);

    const deleteResponse = await ctx.requestJson(`/incidents/${incidentId}`, {
      method: "DELETE",
      headers: {
        Cookie: cookie,
      },
    });
    assert.equal(deleteResponse.status, 204);

    const missingResponse = await ctx.requestJson(`/incidents/${incidentId}`, {
      headers: {
        Cookie: cookie,
      },
    });
    assert.equal(missingResponse.status, 404);
    assert.equal(missingResponse.body.message, "Incident not found");
  });

  await t.test(
    "rechaza payloads importantes invalidos en incidents",
    async () => {
      const wrongFieldResponse = await ctx.requestJson("/incidents", {
        method: "POST",
        headers: {
          Cookie: cookie,
        },
        body: {
          location_id: locationId,
          date: "2026-03-10",
          title: "Payload invalido",
          description: "Campo incorrecto",
        },
      });

      assert.equal(wrongFieldResponse.status, 400);
      assert.match(
        wrongFieldResponse.body.message,
        /Use 'incident_date' \(YYYY-MM-DD\) instead of 'date'/,
      );
    },
  );
});
