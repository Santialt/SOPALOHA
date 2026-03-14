const test = require("node:test");
const assert = require("node:assert/strict");
const { createApiTestContext } = require("../helpers/apiTestContext");

test("integracion locations", async (t) => {
  const ctx = await createApiTestContext("sopaloha-locations-");
  t.after(async () => {
    await ctx.cleanup();
  });

  const techUser = ctx.seedUser({
    name: "Locations Tech",
    email: "locations.tech@example.com",
    role: "tech",
    password: "Locations#123",
  });
  const auth = await ctx.login({
    email: techUser.email,
    password: techUser.password,
  });
  const cookie = auth.cookie;

  await t.test("CRUD basico de locations y search", async () => {
    const createResponse = await ctx.requestJson("/locations", {
      method: "POST",
      headers: {
        Cookie: cookie,
      },
      body: {
        name: "Local Centro",
        razon_social: "Centro SA",
        cuit: "30-12345678-9",
        llave_aloha: "ALOHA-CENTRO",
        usa_nbo: true,
        tiene_kitchen: "1",
        usa_insight_pulse: false,
        cantidad_licencias_aloha: 4,
        fecha_apertura: "2025-01-10",
        status: "abierto",
      },
    });

    assert.equal(createResponse.status, 201);
    assert.equal(createResponse.body.name, "Local Centro");
    assert.equal(createResponse.body.status, "abierto");
    assert.equal(createResponse.body.usa_nbo, true);
    assert.equal(createResponse.body.tiene_kitchen, true);

    const locationId = createResponse.body.id;

    const listResponse = await ctx.requestJson("/locations", {
      headers: {
        Cookie: cookie,
      },
    });
    assert.equal(listResponse.status, 200);
    assert.ok(listResponse.body.some((location) => location.id === locationId));

    const getResponse = await ctx.requestJson(`/locations/${locationId}`, {
      headers: {
        Cookie: cookie,
      },
    });
    assert.equal(getResponse.status, 200);
    assert.equal(getResponse.body.llave_aloha, "ALOHA-CENTRO");

    const searchResponse = await ctx.requestJson("/locations/search?q=centro", {
      headers: {
        Cookie: cookie,
      },
    });
    assert.equal(searchResponse.status, 200);
    assert.ok(
      searchResponse.body.some((location) => location.id === locationId),
    );

    const updateResponse = await ctx.requestJson(`/locations/${locationId}`, {
      method: "PUT",
      headers: {
        Cookie: cookie,
      },
      body: {
        name: "Local Centro Cerrado",
        razon_social: "Centro SA",
        cuit: "30-12345678-9",
        llave_aloha: "ALOHA-CENTRO",
        usa_nbo: false,
        tiene_kitchen: false,
        usa_insight_pulse: true,
        cantidad_licencias_aloha: 6,
        fecha_apertura: "2025-01-10",
        fecha_cierre: "2025-12-31",
        status: "cerrado",
      },
    });

    assert.equal(updateResponse.status, 200);
    assert.equal(updateResponse.body.status, "cerrado");
    assert.equal(updateResponse.body.fecha_cierre, "2025-12-31");
    assert.equal(updateResponse.body.usa_insight_pulse, true);

    const integrationsResponse = await ctx.requestJson(
      `/locations/${locationId}/integrations`,
      {
        method: "PUT",
        headers: {
          Cookie: cookie,
        },
        body: {
          integrations: ["teamviewer", "nbo", "teamviewer"],
        },
      },
    );

    assert.equal(integrationsResponse.status, 200);
    assert.deepEqual(
      integrationsResponse.body.map((item) => item.integration_name),
      ["nbo", "teamviewer"],
    );

    const deleteResponse = await ctx.requestJson(`/locations/${locationId}`, {
      method: "DELETE",
      headers: {
        Cookie: cookie,
      },
    });
    assert.equal(deleteResponse.status, 204);

    const missingResponse = await ctx.requestJson(`/locations/${locationId}`, {
      headers: {
        Cookie: cookie,
      },
    });
    assert.equal(missingResponse.status, 404);
    assert.equal(missingResponse.body.message, "Location not found");
  });

  await t.test("valida formatos importantes de locations", async () => {
    const response = await ctx.requestJson("/locations", {
      method: "POST",
      headers: {
        Cookie: cookie,
      },
      body: {
        name: "Local Invalido",
        fecha_apertura: "10/01/2025",
      },
    });

    assert.equal(response.status, 400);
    assert.match(
      response.body.message,
      /Field 'fecha_apertura' has invalid format/,
    );
  });
});
