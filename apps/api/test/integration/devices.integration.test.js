const test = require("node:test");
const assert = require("node:assert/strict");
const { createApiTestContext } = require("../helpers/apiTestContext");

test("integracion devices", async (t) => {
  const ctx = await createApiTestContext("sopaloha-devices-");
  t.after(async () => {
    await ctx.cleanup();
  });

  const techUser = ctx.seedUser({
    name: "Devices Tech",
    email: "devices.tech@example.com",
    role: "tech",
    password: "Devices#123",
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
      name: "Local Devices",
    },
  });
  const locationId = locationResponse.body.id;

  await t.test("CRUD basico de devices", async () => {
    const createResponse = await ctx.requestJson("/devices", {
      method: "POST",
      headers: {
        Cookie: cookie,
      },
      body: {
        location_id: locationId,
        name: "POS Caja 1",
        type: "pos_terminal",
        ram_gb: 8,
        teamviewer_id: "123456789",
      },
    });

    assert.equal(createResponse.status, 201);
    assert.equal(createResponse.body.location_id, locationId);
    assert.equal(createResponse.body.device_role, "pos");
    assert.equal(createResponse.body.type, "pos_terminal");
    assert.equal(createResponse.body.password, undefined);

    const deviceId = createResponse.body.id;

    const listResponse = await ctx.requestJson(
      `/devices?location_id=${locationId}`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    assert.equal(listResponse.status, 200);
    assert.ok(listResponse.body.some((device) => device.id === deviceId));

    const getResponse = await ctx.requestJson(`/devices/${deviceId}`, {
      headers: {
        Cookie: cookie,
      },
    });
    assert.equal(getResponse.status, 200);
    assert.equal(getResponse.body.id, deviceId);

    const updateResponse = await ctx.requestJson(`/devices/${deviceId}`, {
      method: "PUT",
      headers: {
        Cookie: cookie,
      },
      body: {
        location_id: locationId,
        name: "Router Principal",
        device_role: "router",
        type: "router",
        ram_gb: 2,
      },
    });

    assert.equal(updateResponse.status, 200);
    assert.equal(updateResponse.body.name, "Router Principal");
    assert.equal(updateResponse.body.device_role, "router");
    assert.equal(updateResponse.body.type, "router");

    const deleteResponse = await ctx.requestJson(`/devices/${deviceId}`, {
      method: "DELETE",
      headers: {
        Cookie: cookie,
      },
    });
    assert.equal(deleteResponse.status, 204);

    const missingResponse = await ctx.requestJson(`/devices/${deviceId}`, {
      headers: {
        Cookie: cookie,
      },
    });
    assert.equal(missingResponse.status, 404);
    assert.equal(missingResponse.body.message, "Device not found");
  });

  await t.test("valida role permitido para devices", async () => {
    const response = await ctx.requestJson("/devices", {
      method: "POST",
      headers: {
        Cookie: cookie,
      },
      body: {
        location_id: locationId,
        name: "Device Invalido",
        device_role: "cashier",
      },
    });

    assert.equal(response.status, 400);
    assert.match(response.body.message, /Field 'device_role' must be one of/);
  });
});
