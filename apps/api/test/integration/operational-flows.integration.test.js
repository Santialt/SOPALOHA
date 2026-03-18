const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createApiHarness,
  createLocalDateTimeString,
} = require("./helpers/apiTestHarness");

test("critical operational CRUD flows work against a temporary SQLite database", async (t) => {
  const harness = createApiHarness({
    prefix: "sopaloha-api-ops-",
    authSessionSecret: "sopaloha-operational-suite-secret",
  });

  const adminUser = {
    name: "Ops Admin",
    email: "ops.admin@example.com",
    password: "OpsAdmin#123",
    role: "admin",
  };
  const techUser = {
    name: "Ops Tech",
    email: "ops.tech@example.com",
    password: "OpsTech#123",
    role: "tech",
  };

  await harness.start();
  const seededAdmin = harness.seedUser(adminUser);
  const seededTech = harness.seedUser(techUser);

  t.after(async () => {
    await harness.stop();
  });

  let locationId;
  let deviceId;
  let incidentId;
  let taskId;
  let shiftId;

  await t.test(
    "locations support create, validation failure, update, list, and delete",
    async () => {
      const invalidCreate = await harness.authedRequest(
        adminUser,
        "POST",
        "/locations",
        {
          body: {},
        },
      );

      assert.equal(invalidCreate.status, 400);
      assert.match(invalidCreate.body.message, /Field 'name' is required/);

      const createResult = await harness.authedRequest(
        adminUser,
        "POST",
        "/locations",
        {
          body: {
            name: "Local Palermo",
            city: "Buenos Aires",
            usa_nbo: true,
            status: "abierto",
            fecha_apertura: "2025-01-15",
          },
        },
      );

      assert.equal(createResult.status, 201);
      assert.equal(createResult.body.name, "Local Palermo");
      assert.equal(createResult.body.status, "abierto");
      assert.equal(createResult.body.usa_nbo, true);
      locationId = createResult.body.id;

      const listResult = await harness.authedRequest(
        adminUser,
        "GET",
        "/locations",
      );
      assert.equal(listResult.status, 200);
      assert.ok(listResult.body.some((location) => location.id === locationId));

      const updateResult = await harness.authedRequest(
        adminUser,
        "PUT",
        `/locations/${locationId}`,
        {
          body: {
            name: "Local Palermo Soho",
            city: "Buenos Aires",
            usa_nbo: false,
            status: "cerrado",
            fecha_apertura: "2025-01-15",
            fecha_cierre: "2026-01-15",
          },
        },
      );

      assert.equal(updateResult.status, 200);
      assert.equal(updateResult.body.name, "Local Palermo Soho");
      assert.equal(updateResult.body.status, "cerrado");
      assert.equal(updateResult.body.usa_nbo, false);
    },
  );

  await t.test(
    "devices support create, validation failure, update, list, and delete",
    async () => {
      const invalidCreate = await harness.authedRequest(
        adminUser,
        "POST",
        "/devices",
        {
          body: {
            location_id: locationId,
            name: "Caja 1",
            ram_gb: "invalid-number",
          },
        },
      );

      assert.equal(invalidCreate.status, 400);
      assert.match(
        invalidCreate.body.message,
        /Field 'ram_gb' must be a number/,
      );

      const createResult = await harness.authedRequest(
        adminUser,
        "POST",
        "/devices",
        {
          body: {
            location_id: locationId,
            name: "Server Principal",
            type: "server",
            ram_gb: 16,
            ip_address: "192.168.1.10",
          },
        },
      );

      assert.equal(createResult.status, 201);
      assert.equal(createResult.body.name, "Server Principal");
      assert.equal(createResult.body.type, "server");
      assert.equal(createResult.body.device_role, "server");
      assert.equal(createResult.body.ram_gb, 16);
      deviceId = createResult.body.id;

      const listResult = await harness.authedRequest(
        adminUser,
        "GET",
        `/locations/${locationId}/devices`,
      );
      assert.equal(listResult.status, 200);
      assert.ok(listResult.body.some((device) => device.id === deviceId));

      const updateResult = await harness.authedRequest(
        adminUser,
        "PUT",
        `/devices/${deviceId}`,
        {
          body: {
            location_id: locationId,
            name: "POS Front",
            type: "pos_terminal",
            device_role: "pos",
            ram_gb: 8,
          },
        },
      );

      assert.equal(updateResult.status, 200);
      assert.equal(updateResult.body.name, "POS Front");
      assert.equal(updateResult.body.device_role, "pos");
      assert.equal(updateResult.body.type, "pos_terminal");
    },
  );

  await t.test(
    "incidents support create, validation failure, update, list, and delete",
    async () => {
      const invalidCreate = await harness.authedRequest(
        adminUser,
        "POST",
        "/incidents",
        {
          body: {
            location_id: locationId,
            device_id: deviceId,
            date: "2026-02-01",
            title: "Corte de red",
            description: "Sin enlace",
          },
        },
      );

      assert.equal(invalidCreate.status, 400);
      assert.match(invalidCreate.body.message, /incident_date/);

      const createResult = await harness.authedRequest(
        adminUser,
        "POST",
        "/incidents",
        {
          body: {
            location_id: locationId,
            device_id: deviceId,
            incident_date: "2026-02-01T10:30",
            title: "Corte de red",
            description: "Sin enlace en el local",
            category: "network",
            status: "open",
            time_spent_minutes: 25,
          },
        },
      );

      assert.equal(createResult.status, 201);
      assert.equal(createResult.body.title, "Corte de red");
      assert.equal(createResult.body.created_by, seededAdmin.id);
      incidentId = createResult.body.id;

      const listResult = await harness.authedRequest(
        adminUser,
        "GET",
        `/locations/${locationId}/incidents`,
      );
      assert.equal(listResult.status, 200);
      assert.ok(listResult.body.some((incident) => incident.id === incidentId));

      const updateResult = await harness.authedRequest(
        adminUser,
        "PUT",
        `/incidents/${incidentId}`,
        {
          body: {
            location_id: locationId,
            device_id: deviceId,
            incident_date: "2026-02-01T11:00",
            title: "Corte de red resuelto",
            description: "Switch reiniciado",
            category: "network",
            status: "closed",
            time_spent_minutes: 40,
          },
        },
      );

      assert.equal(updateResult.status, 200);
      assert.equal(updateResult.body.title, "Corte de red resuelto");
      assert.equal(updateResult.body.status, "closed");
      assert.equal(updateResult.body.updated_by, seededAdmin.id);
    },
  );

  await t.test(
    "tasks support create, assignment validation, update, list, and delete",
    async () => {
      const invalidCreate = await harness.authedRequest(
        adminUser,
        "POST",
        "/tasks",
        {
          body: {
            title: "Asignacion invalida",
            location_id: locationId,
            assigned_user_id: 999999,
          },
        },
      );

      assert.equal(invalidCreate.status, 400);
      assert.equal(
        invalidCreate.body.message,
        "Assigned user is invalid or inactive",
      );

      const createResult = await harness.authedRequest(
        adminUser,
        "POST",
        "/tasks",
        {
          body: {
            title: "Revisar router",
            description: "Verificar latencia",
            location_id: locationId,
            assigned_user_id: seededTech.id,
            status: "pending",
            priority: "high",
            due_date: "2026-02-03",
          },
        },
      );

      assert.equal(createResult.status, 201);
      assert.equal(createResult.body.title, "Revisar router");
      assert.equal(createResult.body.assigned_user_id, seededTech.id);
      assert.equal(createResult.body.assigned_to, seededTech.name);
      assert.equal(createResult.body.incident_id, null);
      assert.equal(createResult.body.task_type, "general");
      assert.equal(createResult.body.created_by, seededAdmin.id);
      taskId = createResult.body.id;

      const listResult = await harness.authedRequest(
        adminUser,
        "GET",
        `/locations/${locationId}/tasks`,
      );
      assert.equal(listResult.status, 200);
      assert.ok(listResult.body.some((task) => task.id === taskId));

      const updateResult = await harness.authedRequest(
        adminUser,
        "PUT",
        `/tasks/${taskId}`,
        {
          body: {
            title: "Revisar router y enlace",
            description: "Verificar latencia y gateway",
            location_id: locationId,
            assigned_user_id: seededTech.id,
            status: "done",
            priority: "critical",
            due_date: "2026-02-04",
          },
        },
      );

      assert.equal(updateResult.status, 200);
      assert.equal(updateResult.body.status, "done");
      assert.equal(updateResult.body.priority, "critical");
      assert.equal(updateResult.body.updated_by, seededAdmin.id);

      const clearAssignmentResult = await harness.authedRequest(
        adminUser,
        "PUT",
        `/tasks/${taskId}`,
        {
          body: {
            title: "Revisar router y enlace",
            location_id: locationId,
            status: "done",
            assigned_user_id: null,
          },
        },
      );

      assert.equal(clearAssignmentResult.status, 200);
      assert.equal(clearAssignmentResult.body.assigned_user_id, null);
      assert.equal(clearAssignmentResult.body.assigned_to, null);
    },
  );

  await t.test(
    "tasks keep legacy fields when newer clients update without sending them",
    async () => {
      const legacyCreateResult = await harness.authedRequest(
        adminUser,
        "POST",
        "/tasks",
        {
          body: {
            title: "Tarea legacy",
            location_id: locationId,
            device_id: deviceId,
            incident_id: incidentId,
            assigned_to: "Tecnico Legacy",
            task_type: "legacy_manual",
          },
        },
      );

      assert.equal(legacyCreateResult.status, 201);
      assert.equal(legacyCreateResult.body.device_id, deviceId);
      assert.equal(legacyCreateResult.body.incident_id, incidentId);
      assert.equal(legacyCreateResult.body.assigned_to, "Tecnico Legacy");
      assert.equal(legacyCreateResult.body.task_type, "legacy_manual");

      const legacyUpdateResult = await harness.authedRequest(
        adminUser,
        "PUT",
        `/tasks/${legacyCreateResult.body.id}`,
        {
          body: {
            title: "Tarea legacy actualizada",
            location_id: locationId,
            status: "in_progress",
          },
        },
      );

      assert.equal(legacyUpdateResult.status, 200);
      assert.equal(legacyUpdateResult.body.device_id, deviceId);
      assert.equal(legacyUpdateResult.body.incident_id, incidentId);
      assert.equal(legacyUpdateResult.body.assigned_to, "Tecnico Legacy");
      assert.equal(legacyUpdateResult.body.task_type, "legacy_manual");
    },
  );

  await t.test(
    "on-call shifts support create, validation failure, current shift logic, update, and delete",
    async () => {
      const now = new Date();
      const activeStart = new Date(now.getTime() - 30 * 60 * 1000);
      const activeEnd = new Date(now.getTime() + 30 * 60 * 1000);

      const invalidCreate = await harness.authedRequest(
        adminUser,
        "POST",
        "/on-call-shifts",
        {
          body: {
            title: "Turno invalido",
            assigned_to: "Tecnico 1",
            start_at: createLocalDateTimeString(activeEnd),
            end_at: createLocalDateTimeString(activeStart),
          },
        },
      );

      assert.equal(invalidCreate.status, 400);
      assert.equal(
        invalidCreate.body.message,
        "start_at must be earlier than end_at",
      );

      const createResult = await harness.authedRequest(
        adminUser,
        "POST",
        "/on-call-shifts",
        {
          body: {
            title: "Turno Guardia Actual",
            assigned_to: "Tecnico 1",
            backup_assigned_to: "Tecnico 2",
            start_at: createLocalDateTimeString(activeStart),
            end_at: createLocalDateTimeString(activeEnd),
            notes: "Cobertura operativa",
          },
        },
      );

      assert.equal(createResult.status, 201);
      assert.equal(createResult.body.title, "Turno Guardia Actual");
      shiftId = createResult.body.id;

      const currentResult = await harness.authedRequest(
        adminUser,
        "GET",
        "/on-call-shifts/current",
      );
      assert.equal(currentResult.status, 200);
      assert.equal(currentResult.body.id, shiftId);
      assert.equal(currentResult.body.assigned_to, "Tecnico 1");

      const updateResult = await harness.authedRequest(
        adminUser,
        "PUT",
        `/on-call-shifts/${shiftId}`,
        {
          body: {
            title: "Turno Guardia Actualizado",
            assigned_to: "Tecnico 2",
            backup_assigned_to: "Tecnico 3",
            start_at: createLocalDateTimeString(activeStart),
            end_at: createLocalDateTimeString(activeEnd),
            notes: "Cobertura ajustada",
          },
        },
      );

      assert.equal(updateResult.status, 200);
      assert.equal(updateResult.body.title, "Turno Guardia Actualizado");
      assert.equal(updateResult.body.assigned_to, "Tecnico 2");
    },
  );

  await t.test(
    "critical resources can be deleted in dependency order",
    async () => {
      const deleteTask = await harness.authedRequest(
        adminUser,
        "DELETE",
        `/tasks/${taskId}`,
      );
      assert.equal(deleteTask.status, 204);

      const deleteIncident = await harness.authedRequest(
        adminUser,
        "DELETE",
        `/incidents/${incidentId}`,
      );
      assert.equal(deleteIncident.status, 204);

      const deleteDevice = await harness.authedRequest(
        adminUser,
        "DELETE",
        `/devices/${deviceId}`,
      );
      assert.equal(deleteDevice.status, 204);

      const deleteShift = await harness.authedRequest(
        adminUser,
        "DELETE",
        `/on-call-shifts/${shiftId}`,
      );
      assert.equal(deleteShift.status, 204);

      const deleteLocation = await harness.authedRequest(
        adminUser,
        "DELETE",
        `/locations/${locationId}`,
      );
      assert.equal(deleteLocation.status, 204);
    },
  );
});
