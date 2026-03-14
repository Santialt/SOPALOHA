const test = require("node:test");
const assert = require("node:assert/strict");
const { createApiTestContext } = require("../helpers/apiTestContext");

test("integracion auth, proteccion y roles", async (t) => {
  const ctx = await createApiTestContext("sopaloha-auth-");
  t.after(async () => {
    await ctx.cleanup();
  });

  const adminUser = ctx.seedUser({
    name: "Admin Integration",
    email: "admin.integration@example.com",
    role: "admin",
    password: "Admin#12345",
  });
  const techUser = ctx.seedUser({
    name: "Tech Integration",
    email: "tech.integration@example.com",
    role: "tech",
    password: "Tech#12345",
  });

  await t.test("login exitoso devuelve cookie y permite /auth/me", async () => {
    const loginResponse = await ctx.login({
      email: adminUser.email,
      password: adminUser.password,
    });

    assert.equal(loginResponse.status, 200);
    assert.equal(loginResponse.body.email, adminUser.email);
    assert.equal(loginResponse.body.role, "admin");
    assert.match(loginResponse.cookie || "", /sopaloha_session=/);

    const meResponse = await ctx.requestJson("/auth/me", {
      headers: {
        Cookie: loginResponse.cookie,
      },
    });

    assert.equal(meResponse.status, 200);
    assert.equal(meResponse.body.id, adminUser.id);
    assert.equal(meResponse.body.email, adminUser.email);
  });

  await t.test("login rechaza credenciales invalidas", async () => {
    const response = await ctx.login({
      email: adminUser.email,
      password: "incorrecta",
    });

    assert.equal(response.status, 401);
    assert.equal(response.body.message, "Invalid credentials");
  });

  await t.test("login valida payload requerido", async () => {
    const response = await ctx.requestJson("/auth/login", {
      method: "POST",
      body: {
        email: adminUser.email,
      },
    });

    assert.equal(response.status, 400);
    assert.match(response.body.message, /Field 'password' is required/);
  });

  await t.test(
    "rutas protegidas rechazan usuarios no autenticados",
    async () => {
      const response = await ctx.requestJson("/locations");

      assert.equal(response.status, 401);
      assert.equal(response.body.message, "Authentication required");
    },
  );

  await t.test("rutas solo admin rechazan usuarios tech", async () => {
    const loginResponse = await ctx.login({
      email: techUser.email,
      password: techUser.password,
    });

    const usersResponse = await ctx.requestJson("/users", {
      headers: {
        Cookie: loginResponse.cookie,
      },
    });

    assert.equal(usersResponse.status, 403);
    assert.equal(usersResponse.body.message, "Forbidden");
  });

  await t.test(
    "usuarios admin pueden acceder a rutas administrativas",
    async () => {
      const loginResponse = await ctx.login({
        email: adminUser.email,
        password: adminUser.password,
      });

      const usersResponse = await ctx.requestJson("/users", {
        headers: {
          Cookie: loginResponse.cookie,
        },
      });

      assert.equal(usersResponse.status, 200);
      assert.ok(
        usersResponse.body.some((user) => user.email === adminUser.email),
      );
      assert.ok(
        usersResponse.body.some((user) => user.email === techUser.email),
      );
    },
  );
});
