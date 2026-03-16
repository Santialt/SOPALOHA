const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createApiHarness,
  createLocalDateTimeString,
} = require("./helpers/apiTestHarness");
const { createSessionToken } = require("../../src/utils/authSession");

test("Phase 2.1 hardening covers session edges, current authorization policy, and failure paths", async (t) => {
  const harness = createApiHarness({
    prefix: "sopaloha-api-hardening-",
    authSessionSecret: "sopaloha-hardening-suite-secret",
  });

  const adminUser = {
    name: "Hardening Admin",
    email: "hardening.admin@example.com",
    password: "HardeningAdmin#123",
    role: "admin",
  };
  const techUser = {
    name: "Hardening Tech",
    email: "hardening.tech@example.com",
    password: "HardeningTech#123",
    role: "tech",
  };
  const inactiveUser = {
    name: "Hardening Inactive",
    email: "hardening.inactive@example.com",
    password: "HardeningInactive#123",
    role: "tech",
    active: false,
  };

  await harness.start();
  const seededAdmin = harness.seedUser(adminUser);
  const seededTech = harness.seedUser(techUser);
  const seededInactive = harness.seedUser(inactiveUser);

  t.after(async () => {
    await harness.stop();
  });

  await t.test(
    "logout clears the cookie and the session cannot be reused",
    async () => {
      const loginResult = await harness.loginAs(adminUser);
      assert.equal(loginResult.status, 200);

      const logoutResult = await harness.requestWithSession(
        "POST",
        "/auth/logout",
        loginResult.sessionCookie,
      );
      assert.equal(logoutResult.status, 204);

      const clearedCookie = logoutResult.headers.get("set-cookie");
      assert.match(clearedCookie || "", /Max-Age=0/);

      const meResult = await harness.requestWithSession(
        "GET",
        "/auth/me",
        clearedCookie,
      );
      assert.equal(meResult.status, 401);
      assert.equal(meResult.body.message, "Authentication required");
    },
  );

  await t.test("inactive users cannot log in", async () => {
    const loginResult = await harness.loginAs(inactiveUser);

    assert.equal(loginResult.status, 401);
    assert.equal(loginResult.body.message, "Invalid credentials");
  });

  await t.test(
    "a stale session is rejected after the user is deactivated",
    async () => {
      const loginResult = await harness.loginAs(techUser);
      assert.equal(loginResult.status, 200);

      harness.db
        .prepare("UPDATE users SET active = 0 WHERE id = ?")
        .run(seededTech.id);

      const meResult = await harness.requestWithSession(
        "GET",
        "/auth/me",
        loginResult.sessionCookie,
      );
      assert.equal(meResult.status, 401);
      assert.equal(meResult.body.message, "Authentication required");

      harness.db
        .prepare("UPDATE users SET active = 1 WHERE id = ?")
        .run(seededTech.id);
    },
  );

  await t.test(
    "malformed, tampered, and expired session cookies are rejected",
    async () => {
      const malformedResult = await harness.request("GET", "/auth/me", {
        headers: {
          Cookie: "sopaloha_session=definitely-not-a-valid-token",
        },
      });
      assert.equal(malformedResult.status, 401);

      const loginResult = await harness.loginAs(adminUser);
      assert.equal(loginResult.status, 200);

      const tokenValue = loginResult.sessionCookie.split(";")[0].split("=")[1];
      const tamperedToken =
        tokenValue.slice(0, -1) + (tokenValue.endsWith("a") ? "b" : "a");
      const tamperedResult = await harness.request("GET", "/auth/me", {
        headers: {
          Cookie: `sopaloha_session=${tamperedToken}`,
        },
      });
      assert.equal(tamperedResult.status, 401);

      const expiredToken = createSessionToken({ id: seededAdmin.id }, -60);
      const expiredResult = await harness.request("GET", "/auth/me", {
        headers: {
          Cookie: `sopaloha_session=${expiredToken}`,
        },
      });
      assert.equal(expiredResult.status, 401);
      assert.equal(expiredResult.body.message, "Authentication required");
    },
  );

  await t.test(
    "tech users can still create and update day-to-day records",
    async () => {
      const adminCreateLocation = await harness.authedRequest(
        adminUser,
        "POST",
        "/locations",
        {
          body: {
            name: "Admin Managed Location",
          },
        },
      );
      assert.equal(adminCreateLocation.status, 201);

      const techCreateLocation = await harness.authedRequest(
        techUser,
        "POST",
        "/locations",
        {
          body: {
            name: "Tech Managed Location",
          },
        },
      );
      assert.equal(techCreateLocation.status, 201);

      const techLocationId = techCreateLocation.body.id;

      const techCreateDevice = await harness.authedRequest(
        techUser,
        "POST",
        "/devices",
        {
          body: {
            location_id: techLocationId,
            name: "Tech Device",
            type: "server",
          },
        },
      );
      assert.equal(techCreateDevice.status, 201);

      const techCreateIncident = await harness.authedRequest(
        techUser,
        "POST",
        "/incidents",
        {
          body: {
            location_id: techLocationId,
            device_id: techCreateDevice.body.id,
            incident_date: "2026-03-14T09:00",
            title: "Tech Incident",
            description: "Created by tech user",
          },
        },
      );
      assert.equal(techCreateIncident.status, 201);

      const techCreateTask = await harness.authedRequest(
        techUser,
        "POST",
        "/tasks",
        {
          body: {
            title: "Tech Task",
            location_id: techLocationId,
            device_id: techCreateDevice.body.id,
          },
        },
      );
      assert.equal(techCreateTask.status, 201);

      const techCreateShift = await harness.authedRequest(
        techUser,
        "POST",
        "/on-call-shifts",
        {
          body: {
            title: "Tech Shift",
            assigned_to: "Tecnico 1",
            start_at: "2026-03-14T08:00",
            end_at: "2026-03-14T16:00",
          },
        },
      );
      assert.equal(techCreateShift.status, 403);

      const techCreateTemplate = await harness.authedRequest(
        techUser,
        "POST",
        "/on-call-templates",
        {
          body: {
            title: "Tech Template",
            start_time: "08:00",
            end_time: "16:00",
            crosses_to_next_day: false,
          },
        },
      );
      assert.equal(techCreateTemplate.status, 403);

      const techCreateTechnician = await harness.authedRequest(
        techUser,
        "POST",
        "/on-call-technicians",
        {
          body: {
            name: "Tech Created Technician",
            is_active: true,
          },
        },
      );
      assert.equal(techCreateTechnician.status, 403);

      const techUpdateTask = await harness.authedRequest(
        techUser,
        "PUT",
        `/tasks/${techCreateTask.body.id}`,
        {
          body: {
            title: "Tech Task Updated",
            location_id: techLocationId,
            device_id: techCreateDevice.body.id,
            status: "in_progress",
          },
        },
      );
      assert.equal(techUpdateTask.status, 200);

      const techUpdateIncident = await harness.authedRequest(
        techUser,
        "PUT",
        `/incidents/${techCreateIncident.body.id}`,
        {
          body: {
            location_id: techLocationId,
            device_id: techCreateDevice.body.id,
            incident_date: "2026-03-14T09:30",
            title: "Tech Incident Updated",
            description: "Updated by tech user",
          },
        },
      );
      assert.equal(techUpdateIncident.status, 200);

      const techUpdateDevice = await harness.authedRequest(
        techUser,
        "PUT",
        `/devices/${techCreateDevice.body.id}`,
        {
          body: {
            location_id: techLocationId,
            name: "Tech Device Updated",
            type: "server",
          },
        },
      );
      assert.equal(techUpdateDevice.status, 200);

      const techUpdateLocation = await harness.authedRequest(
        techUser,
        "PUT",
        `/locations/${techLocationId}`,
        {
          body: {
            name: "Tech Managed Location Updated",
          },
        },
      );
      assert.equal(techUpdateLocation.status, 200);
    },
  );

  await t.test(
    "admin-only routes reject tech users and remain available to admins",
    async () => {
      const locationResult = await harness.authedRequest(
        adminUser,
        "POST",
        "/locations",
        {
          body: { name: "Restricted Delete Location" },
        },
      );
      const locationId = locationResult.body.id;

      const deviceResult = await harness.authedRequest(
        adminUser,
        "POST",
        "/devices",
        {
          body: {
            location_id: locationId,
            name: "Restricted Delete Device",
            type: "server",
          },
        },
      );

      const incidentResult = await harness.authedRequest(
        adminUser,
        "POST",
        "/incidents",
        {
          body: {
            location_id: locationId,
            device_id: deviceResult.body.id,
            incident_date: "2026-03-14T09:15",
            title: "Restricted Delete Incident",
            description: "Admin-created incident",
          },
        },
      );

      const taskResult = await harness.authedRequest(
        adminUser,
        "POST",
        "/tasks",
        {
          body: {
            title: "Restricted Delete Task",
            location_id: locationId,
          },
        },
      );

      const techDeleteLocation = await harness.authedRequest(
        techUser,
        "DELETE",
        `/locations/${locationId}`,
      );
      assert.equal(techDeleteLocation.status, 403);

      const techDeleteDevice = await harness.authedRequest(
        techUser,
        "DELETE",
        `/devices/${deviceResult.body.id}`,
      );
      assert.equal(techDeleteDevice.status, 403);

      const techDeleteIncident = await harness.authedRequest(
        techUser,
        "DELETE",
        `/incidents/${incidentResult.body.id}`,
      );
      assert.equal(techDeleteIncident.status, 403);

      const techDeleteTask = await harness.authedRequest(
        techUser,
        "DELETE",
        `/tasks/${taskResult.body.id}`,
      );
      assert.equal(techDeleteTask.status, 403);

      const techPutIntegrations = await harness.authedRequest(
        techUser,
        "PUT",
        `/locations/${locationId}/integrations`,
        {
          body: {
            integrations: ["aloha"],
          },
        },
      );
      assert.equal(techPutIntegrations.status, 403);

      const techCreateShift = await harness.authedRequest(
        techUser,
        "POST",
        "/on-call-shifts",
        {
          body: {
            title: "Blocked Tech Shift",
            assigned_to: "Tecnico 1",
            start_at: "2026-03-14T08:00",
            end_at: "2026-03-14T16:00",
          },
        },
      );
      assert.equal(techCreateShift.status, 403);

      const techCreateTemplate = await harness.authedRequest(
        techUser,
        "POST",
        "/on-call-templates",
        {
          body: {
            title: "Blocked Tech Template",
            start_time: "08:00",
            end_time: "16:00",
          },
        },
      );
      assert.equal(techCreateTemplate.status, 403);

      const techCreateTechnician = await harness.authedRequest(
        techUser,
        "POST",
        "/on-call-technicians",
        {
          body: {
            name: "Blocked Tech Technician",
          },
        },
      );
      assert.equal(techCreateTechnician.status, 403);

      const adminCreateShift = await harness.authedRequest(
        adminUser,
        "POST",
        "/on-call-shifts",
        {
          body: {
            title: "Admin Shift",
            assigned_to: "Tecnico 1",
            start_at: "2026-03-15T08:00",
            end_at: "2026-03-15T16:00",
          },
        },
      );
      assert.equal(adminCreateShift.status, 201);

      const adminCreateTemplate = await harness.authedRequest(
        adminUser,
        "POST",
        "/on-call-templates",
        {
          body: {
            title: "Admin Template",
            start_time: "08:00",
            end_time: "16:00",
          },
        },
      );
      assert.equal(adminCreateTemplate.status, 201);

      const adminCreateTechnician = await harness.authedRequest(
        adminUser,
        "POST",
        "/on-call-technicians",
        {
          body: {
            name: "Admin Created Technician",
          },
        },
      );
      assert.equal(adminCreateTechnician.status, 201);

      const adminPutIntegrations = await harness.authedRequest(
        adminUser,
        "PUT",
        `/locations/${locationId}/integrations`,
        {
          body: {
            integrations: ["aloha", "nbo"],
          },
        },
      );
      assert.equal(adminPutIntegrations.status, 200);

      const adminDeleteTask = await harness.authedRequest(
        adminUser,
        "DELETE",
        `/tasks/${taskResult.body.id}`,
      );
      assert.equal(adminDeleteTask.status, 204);

      const adminDeleteIncident = await harness.authedRequest(
        adminUser,
        "DELETE",
        `/incidents/${incidentResult.body.id}`,
      );
      assert.equal(adminDeleteIncident.status, 204);

      const adminDeleteDevice = await harness.authedRequest(
        adminUser,
        "DELETE",
        `/devices/${deviceResult.body.id}`,
      );
      assert.equal(adminDeleteDevice.status, 204);

      const adminDeleteLocation = await harness.authedRequest(
        adminUser,
        "DELETE",
        `/locations/${locationId}`,
      );
      assert.equal(adminDeleteLocation.status, 204);
    },
  );

  await t.test(
    "deleting a location with dependent incident records returns a stable conflict response",
    async () => {
      const locationResult = await harness.authedRequest(
        adminUser,
        "POST",
        "/locations",
        {
          body: { name: "Delete Failure Location" },
        },
      );
      const locationId = locationResult.body.id;

      const deviceResult = await harness.authedRequest(
        adminUser,
        "POST",
        "/devices",
        {
          body: {
            location_id: locationId,
            name: "Delete Failure Device",
            type: "server",
          },
        },
      );

      const incidentResult = await harness.authedRequest(
        adminUser,
        "POST",
        "/incidents",
        {
          body: {
            location_id: locationId,
            device_id: deviceResult.body.id,
            incident_date: "2026-03-14T10:00",
            title: "Delete Failure Incident",
            description: "Blocks location delete",
          },
        },
      );
      assert.equal(incidentResult.status, 201);

      const taskResult = await harness.authedRequest(
        adminUser,
        "POST",
        "/tasks",
        {
          body: {
            title: "Delete Failure Task",
            location_id: locationId,
            incident_id: incidentResult.body.id,
          },
        },
      );
      assert.equal(taskResult.status, 201);

      const deleteLocationResult = await harness.authedRequest(
        adminUser,
        "DELETE",
        `/locations/${locationId}`,
      );
      assert.equal(deleteLocationResult.status, 409);
      assert.equal(
        deleteLocationResult.body.message,
        "Resource cannot be deleted because dependent records exist",
      );
      assert.equal(deleteLocationResult.body.code, "foreign_key_conflict");

      const existingLocation = await harness.authedRequest(
        adminUser,
        "GET",
        `/locations/${locationId}`,
      );
      assert.equal(existingLocation.status, 200);
    },
  );

  await t.test(
    "invalid foreign-key references return stable client-facing 4xx responses",
    async () => {
      const invalidDeviceLocation = await harness.authedRequest(
        adminUser,
        "POST",
        "/devices",
        {
          body: {
            location_id: 999999,
            name: "Broken FK Device",
            type: "server",
          },
        },
      );
      assert.equal(invalidDeviceLocation.status, 400);
      assert.equal(
        invalidDeviceLocation.body.message,
        "One or more referenced records do not exist",
      );
      assert.equal(invalidDeviceLocation.body.code, "foreign_key_invalid");

      const invalidIncidentLocation = await harness.authedRequest(
        adminUser,
        "POST",
        "/incidents",
        {
          body: {
            location_id: 999999,
            incident_date: "2026-03-14T11:00",
            title: "Broken FK Incident",
            description: "Invalid location",
          },
        },
      );
      assert.equal(invalidIncidentLocation.status, 400);
      assert.equal(
        invalidIncidentLocation.body.message,
        "One or more referenced records do not exist",
      );
      assert.equal(invalidIncidentLocation.body.code, "foreign_key_invalid");
    },
  );

  await t.test("locations reject invalid enum and date formats", async () => {
    const invalidStatus = await harness.authedRequest(
      adminUser,
      "POST",
      "/locations",
      {
        body: {
          name: "Invalid Status Location",
          status: "paused",
        },
      },
    );
    assert.equal(invalidStatus.status, 400);
    assert.match(invalidStatus.body.message, /Field 'status' must be one of/);

    const invalidDate = await harness.authedRequest(
      adminUser,
      "POST",
      "/locations",
      {
        body: {
          name: "Invalid Date Location",
          fecha_apertura: "14-03-2026",
        },
      },
    );
    assert.equal(invalidDate.status, 400);
    assert.match(
      invalidDate.body.message,
      /Field 'fecha_apertura' has invalid format/,
    );
  });

  await t.test(
    "devices reject invalid enums before repository writes",
    async () => {
      const locationResult = await harness.authedRequest(
        adminUser,
        "POST",
        "/locations",
        {
          body: { name: "Device Validation Location" },
        },
      );

      const invalidRole = await harness.authedRequest(
        adminUser,
        "POST",
        "/devices",
        {
          body: {
            location_id: locationResult.body.id,
            name: "Invalid Role Device",
            type: "server",
            device_role: "cashier",
          },
        },
      );
      assert.equal(invalidRole.status, 400);
      assert.match(
        invalidRole.body.message,
        /Field 'device_role' must be one of/,
      );
    },
  );

  await t.test(
    "incidents reject invalid enums and blank required values",
    async () => {
      const locationResult = await harness.authedRequest(
        adminUser,
        "POST",
        "/locations",
        {
          body: { name: "Incident Validation Location" },
        },
      );

      const invalidStatus = await harness.authedRequest(
        adminUser,
        "POST",
        "/incidents",
        {
          body: {
            location_id: locationResult.body.id,
            incident_date: "2026-03-14T12:00",
            title: "Incident Validation",
            description: "Has invalid status",
            status: "pending",
          },
        },
      );
      assert.equal(invalidStatus.status, 400);
      assert.match(invalidStatus.body.message, /Field 'status' must be one of/);

      const blankTitle = await harness.authedRequest(
        adminUser,
        "POST",
        "/incidents",
        {
          body: {
            location_id: locationResult.body.id,
            incident_date: "2026-03-14T12:00",
            title: "   ",
            description: "Blank title should fail",
          },
        },
      );
      assert.equal(blankTitle.status, 400);
      assert.match(blankTitle.body.message, /Field 'title' is required/);
    },
  );

  await t.test(
    "tasks reject invalid date format and inactive assignee",
    async () => {
      const inactiveAssignee = await harness.authedRequest(
        adminUser,
        "POST",
        "/tasks",
        {
          body: {
            title: "Inactive assignee task",
            assigned_user_id: seededInactive.id,
          },
        },
      );
      assert.equal(inactiveAssignee.status, 400);
      assert.equal(
        inactiveAssignee.body.message,
        "Assigned user is invalid or inactive",
      );

      const invalidDate = await harness.authedRequest(
        adminUser,
        "POST",
        "/tasks",
        {
          body: {
            title: "Invalid due date task",
            due_date: "03/14/2026",
          },
        },
      );
      assert.equal(invalidDate.status, 400);
      assert.match(
        invalidDate.body.message,
        /Field 'due_date' has invalid format/,
      );
    },
  );

  await t.test(
    "on-call shifts reject invalid datetime format and blank required values",
    async () => {
      const invalidDate = await harness.authedRequest(
        adminUser,
        "POST",
        "/on-call-shifts",
        {
          body: {
            title: "Invalid shift date",
            assigned_to: "Tecnico 1",
            start_at: "14-03-2026 09:00",
            end_at: "2026-03-14T17:00",
          },
        },
      );
      assert.equal(invalidDate.status, 400);
      assert.match(
        invalidDate.body.message,
        /Field 'start_at' has invalid format/,
      );

      const blankAssignedTo = await harness.authedRequest(
        adminUser,
        "POST",
        "/on-call-shifts",
        {
          body: {
            title: "Blank assigned to",
            assigned_to: "   ",
            start_at: createLocalDateTimeString(
              new Date("2026-03-14T09:00:00"),
            ),
            end_at: createLocalDateTimeString(new Date("2026-03-14T17:00:00")),
          },
        },
      );
      assert.equal(blankAssignedTo.status, 400);
      assert.match(
        blankAssignedTo.body.message,
        /Field 'assigned_to' is required/,
      );
    },
  );
});
