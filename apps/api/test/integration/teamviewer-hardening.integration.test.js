const test = require("node:test");
const assert = require("node:assert/strict");

const { createApiHarness } = require("./helpers/apiTestHarness");

const TEAMVIEWER_BASE_URL = "https://webapi.teamviewer.com/api/v1";
const realFetch = global.fetch;

function jsonResponse(payload, options = {}) {
  return new Response(JSON.stringify(payload), {
    status: options.status || 200,
    headers: options.headers || {},
  });
}

function createTeamviewerFetchMock() {
  const state = {
    calls: [],
    handler: async (url) => {
      throw new Error(`Unexpected TeamViewer request: ${url}`);
    },
  };

  return {
    install() {
      global.fetch = async (input, init) => {
        const url = String(input);
        if (!url.startsWith(TEAMVIEWER_BASE_URL)) {
          return realFetch(input, init);
        }

        state.calls.push({ url, init });
        return state.handler(url, init, state.calls.length);
      };
    },
    reset() {
      state.calls.length = 0;
      state.handler = async (url) => {
        throw new Error(`Unexpected TeamViewer request: ${url}`);
      };
    },
    setHandler(handler) {
      state.handler = handler;
    },
    calls() {
      return [...state.calls];
    },
  };
}

test("TeamViewer backend hardening covers preview, import, degradation, and route authorization", async (t) => {
  const teamviewerFetch = createTeamviewerFetchMock();
  teamviewerFetch.install();

  const harness = createApiHarness({
    prefix: "sopaloha-teamviewer-",
    authSessionSecret: "sopaloha-teamviewer-suite-secret",
    internalApiKey: "teamviewer-suite-api-key",
    teamviewerApiToken: "teamviewer-test-token",
    teamviewerReportsApiToken: "teamviewer-reports-test-token",
    teamviewerMaxRetries: 1,
  });

  const adminUser = {
    name: "TeamViewer Admin",
    email: "teamviewer.admin@example.com",
    password: "TeamviewerAdmin#123",
    role: "admin",
  };
  const techUser = {
    name: "TeamViewer Tech",
    email: "teamviewer.tech@example.com",
    password: "TeamviewerTech#123",
    role: "tech",
  };

  await harness.start();
  harness.seedUser(adminUser);
  const techUserRecord = harness.seedUser(techUser);

  t.after(async () => {
    global.fetch = realFetch;
    await harness.stop();
  });

  await t.test(
    "TeamViewer routes require admin plus API key before exposing upstream data",
    async () => {
      teamviewerFetch.reset();

      const unauthenticated = await harness.request(
        "GET",
        "/teamviewer/import-preview",
      );
      assert.equal(unauthenticated.status, 401);
      assert.equal(unauthenticated.body.message, "Authentication required");

      const techPreview = await harness.authedRequest(
        techUser,
        "GET",
        "/teamviewer/import-preview",
        {
          headers: harness.withApiKey(),
        },
      );
      assert.equal(techPreview.status, 403);

      const existingLocationId = harness.db
        .prepare(
          `INSERT INTO locations (name, status) VALUES ('Local Reused', 'active')`,
        )
        .run().lastInsertRowid;

      harness.db
        .prepare(
          `
          INSERT INTO devices (location_id, name, type, device_role, teamviewer_id)
          VALUES (?, 'Server Principal', 'server', 'server', '123456789')
        `,
        )
        .run(existingLocationId);

      harness.db
        .prepare(
          `
          INSERT INTO devices (location_id, name, type, device_role, teamviewer_id)
          VALUES (?, 'Caja 1', 'pos_terminal', 'pos', NULL)
        `,
        )
        .run(existingLocationId);

      teamviewerFetch.setHandler(async (url) => {
        const parsedUrl = new URL(url);
        if (parsedUrl.pathname === "/api/v1/device-groups") {
          return jsonResponse({
            groups: [
              { id: "g-existing", name: "Local Reused" },
              { id: "g-new", name: "Local Nuevo" },
            ],
          });
        }

        if (parsedUrl.pathname === "/api/v1/devices") {
          return jsonResponse({
            devices: [
              {
                groupid: "g-existing",
                alias: "Server Principal",
                remotecontrol_id: "123 456 789",
              },
              {
                groupid: "g-existing",
                alias: "Caja 1",
                device_id: "device-pos-1",
              },
              { groupid: "g-new", device_id: "device-no-alias" },
              {
                groupid: "missing-group",
                alias: "Sin Grupo",
                remotecontrol_id: "999",
              },
            ],
          });
        }

        throw new Error(`Unexpected TeamViewer request: ${url}`);
      });

      const previewWithoutApiKey = await harness.authedRequest(
        adminUser,
        "GET",
        "/teamviewer/import-preview",
      );
      assert.equal(previewWithoutApiKey.status, 401);

      const preview = await harness.authedRequest(
        adminUser,
        "GET",
        "/teamviewer/import-preview",
        {
          headers: harness.withApiKey(),
        },
      );
      assert.equal(preview.status, 200);
      assert.equal(preview.body.summary.locations_to_create, 1);
      assert.equal(preview.body.summary.locations_to_reuse, 1);
      assert.equal(preview.body.summary.devices_to_create, 1);
      assert.equal(preview.body.summary.devices_duplicates, 2);
      assert.equal(preview.body.summary.warnings, 1);

      const createdCandidate = preview.body.devices.find(
        (row) => row.alias === "Device device-no-alias",
      );
      assert.deepEqual(
        {
          alias: createdCandidate.alias,
          teamviewer_id: createdCandidate.teamviewer_id,
          teamviewer_id_source: createdCandidate.teamviewer_id_source,
          location_name: createdCandidate.location_name,
          status: createdCandidate.status,
        },
        {
          alias: "Device device-no-alias",
          teamviewer_id: "device-no-alias",
          teamviewer_id_source: "device_id_fallback",
          location_name: "Local Nuevo",
          status: "new",
        },
      );

      const adminImportWithoutApiKey = await harness.authedRequest(
        adminUser,
        "POST",
        "/teamviewer/import",
      );
      assert.equal(adminImportWithoutApiKey.status, 401);
      assert.equal(
        adminImportWithoutApiKey.body.message,
        "Valid internal API key required",
      );

      const importResult = await harness.authedRequest(
        adminUser,
        "POST",
        "/teamviewer/import",
        {
          headers: harness.withApiKey(),
        },
      );
      assert.equal(importResult.status, 200);
      assert.equal(importResult.body.summary.locations_created, 1);
      assert.equal(importResult.body.summary.locations_reused, 1);
      assert.equal(importResult.body.summary.devices_created, 1);
      assert.equal(importResult.body.summary.devices_skipped_duplicate, 2);
      assert.equal(importResult.body.summary.warnings, 1);

      const importedLocation = harness.db
        .prepare(`SELECT * FROM locations WHERE name = 'Local Nuevo'`)
        .get();
      assert.ok(importedLocation);

      const importedDevice = harness.db
        .prepare(
          `SELECT * FROM devices WHERE location_id = ? AND name = 'Device device-no-alias'`,
        )
        .get(importedLocation.id);
      assert.equal(importedDevice.teamviewer_id, "device-no-alias");
      assert.equal(importedDevice.device_role, "other");
    },
  );

  await t.test(
    "TeamViewer imported-case reads and writes both require admin plus API key",
    async () => {
      teamviewerFetch.reset();
      const reportQueries = [];

      teamviewerFetch.setHandler(async (url) => {
        const parsedUrl = new URL(url);
        if (parsedUrl.pathname !== "/api/v1/reports/connections") {
          throw new Error(`Unexpected TeamViewer request: ${url}`);
        }

        reportQueries.push({
          from_date: parsedUrl.searchParams.get("from_date"),
          to_date: parsedUrl.searchParams.get("to_date"),
          start_date: parsedUrl.searchParams.get("start_date"),
          end_date: parsedUrl.searchParams.get("end_date"),
        });

        const offset = Number(parsedUrl.searchParams.get("offset"));
        if (offset === 0) {
          return jsonResponse({
            records: [
              {
                id: "case-1",
                start_time: "2026-03-10T10:00:00Z",
                end_time: "2026-03-10T10:15:00Z",
                group_name: "Local Reused",
                note: "POS caido - Maria",
                user_name: "tech-one",
              },
              {
                id: "case-2",
                startedAt: "2026-03-10T11:00:00Z",
                endedAt: "2026-03-10T11:25:00Z",
                groupName: "Local Nuevo",
                note: "Server lento - Juan",
                technicianDisplayName: "Tech Two",
              },
              {
                id: "case-3",
                start_time: "2026-03-10T12:00:00Z",
                group_name: "Local Reused",
                note: "Nota invalida",
              },
            ],
            pagination: { next_offset: 2 },
          });
        }

        if (offset === 2) {
          return jsonResponse({
            records: [
              {
                id: "case-2",
                start_time: "2026-03-10T11:00:00Z",
                group_name: "Local Nuevo",
                note: "Server lento - Juan",
              },
              {
                id: "case-4",
                start_time: "2026-02-25T12:00:00Z",
                group_name: "Local Reused",
                note: "Fuera de rango - Ana",
              },
              {
                id: "case-5",
                start_time: "2026-03-10T13:00:00Z",
                note: "Sin grupo - Ana",
              },
            ],
          });
        }

        return jsonResponse({ records: [] });
      });

      const importCasesResult = await harness.authedRequest(
        techUser,
        "POST",
        "/teamviewer/import-cases",
        {
          body: {
            from_date: "2026-03-01",
            to_date: "2026-03-31",
          },
        },
      );
      assert.equal(importCasesResult.status, 403);
      assert.equal(importCasesResult.body.message, "Forbidden");

      const importedCasesWithoutApiKey = await harness.authedRequest(
        adminUser,
        "GET",
        "/teamviewer/imported-cases",
      );
      assert.equal(importedCasesWithoutApiKey.status, 401);

      const adminImportCasesResult = await harness.authedRequest(
        adminUser,
        "POST",
        "/teamviewer/import-cases",
        {
          headers: harness.withApiKey(),
          body: {
            from_date: "2026-03-01",
            to_date: "2026-03-31",
          },
        },
      );

      assert.equal(adminImportCasesResult.status, 200);
      assert.deepEqual(adminImportCasesResult.body.summary, {
        total_received: 3,
        total_with_note: 3,
        total_valid_format: 2,
        total_inserted: 2,
        total_duplicated: 0,
        total_discarded_invalid_format: 1,
        total_out_of_range_from_api: 0,
      });
      assert.deepEqual(
        adminImportCasesResult.body.discarded.map((row) => row.reason).sort(),
        ["missing_separator"],
      );
      assert.deepEqual(reportQueries[0], {
        from_date: "2026-03-01",
        to_date: "2026-03-31",
        start_date: null,
        end_date: null,
      });

      const listImportedCases = await harness.authedRequest(
        adminUser,
        "GET",
        "/teamviewer/imported-cases",
        {
          headers: harness.withApiKey(),
        },
      );
      assert.equal(listImportedCases.status, 200);
      assert.equal(listImportedCases.body.length, 2);

      const resolvedNames = listImportedCases.body
        .map((row) => row.resolved_location_name)
        .sort();
      assert.deepEqual(resolvedNames, ["Local Nuevo", "Local Reused"]);

      const importedSyntheticUsers = harness.db
        .prepare(
          "SELECT email, active, password_hash FROM users WHERE lower(email) LIKE '%@teamviewer.local' ORDER BY email ASC",
        )
        .all();
      assert.equal(importedSyntheticUsers.length, 2);
      for (const importedUser of importedSyntheticUsers) {
        assert.equal(importedUser.active, 0);
        assert.doesNotMatch(importedUser.password_hash, /tv-import-/);
      }

      const catalogs = await harness.authedRequest(
        adminUser,
        "GET",
        "/teamviewer/imported-cases/catalogs",
        {
          headers: harness.withApiKey(),
        },
      );
      assert.equal(catalogs.status, 200);
      assert.ok(
        catalogs.body.technicians.some(
          (row) => row.email === techUser.email && row.role === "tech",
        ),
      );
      assert.ok(
        catalogs.body.teamviewer_groups.some(
          (row) => row.group_name === "Local Reused",
        ),
      );

      const manualCase = await harness.authedRequest(
        techUser,
        "POST",
        "/teamviewer/imported-cases",
        {
          body: {
            started_at: "2026-03-11T09:00:00Z",
            ended_at: "2026-03-11T09:10:00Z",
            technician_user_id: techUserRecord.id,
            teamviewer_group_name: "Local Reused",
            note_raw: "Impresora sin papel - Sofia",
          },
        },
      );
      assert.equal(manualCase.status, 403);

      const adminManualCase = await harness.authedRequest(
        adminUser,
        "POST",
        "/teamviewer/imported-cases",
        {
          headers: harness.withApiKey(),
          body: {
            started_at: "2026-03-11T09:00:00Z",
            ended_at: "2026-03-11T09:10:00Z",
            technician_user_id: techUserRecord.id,
            teamviewer_group_name: "Local Reused",
            note_raw: "Impresora sin papel - Sofia",
          },
        },
      );
      assert.equal(adminManualCase.status, 201);
      assert.equal(adminManualCase.body.teamviewer_group_name, "Local Reused");
      assert.equal(adminManualCase.body.technician_user_id, techUserRecord.id);
      assert.equal(adminManualCase.body.technician_user_name, techUser.name);
      assert.equal(adminManualCase.body.technician_display_name, techUser.name);
      assert.equal(adminManualCase.body.technician_username, techUser.email);

      const filteredByTechnician = await harness.authedRequest(
        adminUser,
        "GET",
        `/teamviewer/imported-cases?from_date=2026-03-01&to_date=2026-03-31&technician_user_id=${techUserRecord.id}`,
        {
          headers: harness.withApiKey(),
        },
      );
      assert.equal(filteredByTechnician.status, 200);
      assert.equal(filteredByTechnician.body.length, 1);
      assert.equal(filteredByTechnician.body[0].id, adminManualCase.body.id);

      const deleteManualCase = await harness.authedRequest(
        techUser,
        "DELETE",
        `/teamviewer/imported-cases/${adminManualCase.body.id}`,
      );
      assert.equal(deleteManualCase.status, 403);

      const adminDeleteManualCase = await harness.authedRequest(
        adminUser,
        "DELETE",
        `/teamviewer/imported-cases/${adminManualCase.body.id}`,
        {
          headers: harness.withApiKey(),
        },
      );
      assert.equal(adminDeleteManualCase.status, 204);
    },
  );

  await t.test(
    "TeamViewer location device statuses stay behind admin plus API key",
    async () => {
      teamviewerFetch.reset();

      const locationId = harness.db
        .prepare(
          `INSERT INTO locations (name, status) VALUES ('Estado TV Local', 'active')`,
        )
        .run().lastInsertRowid;

      harness.db
        .prepare(
          `
          INSERT INTO devices (location_id, name, type, device_role, teamviewer_id)
          VALUES
            (?, 'Server Estado', 'server', 'server', '111111111'),
            (?, 'POS Estado', 'pos_terminal', 'pos', '222222222'),
            (?, 'Equipo Sin Match', 'other', 'other', '333333333'),
            (?, 'Equipo Sin TV', 'other', 'other', NULL)
        `,
        )
        .run(locationId, locationId, locationId, locationId);

      teamviewerFetch.setHandler(async (url) => {
        const parsedUrl = new URL(url);
        if (parsedUrl.pathname !== "/api/v1/devices") {
          throw new Error(`Unexpected TeamViewer request: ${url}`);
        }

        return jsonResponse({
          devices: [
            {
              alias: "Server Estado",
              remotecontrol_id: "111 111 111",
              online_state: "online",
            },
            {
              alias: "POS Estado",
              remotecontrol_id: "222222222",
              status: "offline",
            },
            {
              alias: "Equipo Estado Raro",
              remotecontrol_id: "444444444",
              state: "busy",
            },
          ],
        });
      });

      const result = await harness.authedRequest(
        adminUser,
        "GET",
        `/teamviewer/locations/${locationId}/device-statuses`,
        {
          headers: harness.withApiKey(),
        },
      );

      assert.equal(result.status, 200);
      assert.equal(result.body.location_id, locationId);
      assert.equal(result.body.devices.length, 4);

      const byName = new Map(
        result.body.devices.map((row) => [row.device_name, row]),
      );

      assert.deepEqual(
        {
          presence: byName.get("Server Estado").presence,
          raw_state: byName.get("Server Estado").raw_state,
          status_available: byName.get("Server Estado").status_available,
        },
        {
          presence: "online",
          raw_state: "online",
          status_available: true,
        },
      );

      assert.deepEqual(
        {
          presence: byName.get("POS Estado").presence,
          raw_state: byName.get("POS Estado").raw_state,
          status_available: byName.get("POS Estado").status_available,
        },
        {
          presence: "offline",
          raw_state: "offline",
          status_available: true,
        },
      );

      assert.deepEqual(
        {
          presence: byName.get("Equipo Sin Match").presence,
          raw_state: byName.get("Equipo Sin Match").raw_state,
          status_available: byName.get("Equipo Sin Match").status_available,
        },
        {
          presence: "unknown",
          raw_state: null,
          status_available: false,
        },
      );

      assert.deepEqual(
        {
          presence: byName.get("Equipo Sin TV").presence,
          raw_state: byName.get("Equipo Sin TV").raw_state,
          status_available: byName.get("Equipo Sin TV").status_available,
        },
        {
          presence: "unknown",
          raw_state: null,
          status_available: false,
        },
      );
    },
  );

  await t.test(
    "TeamViewer upstream failures degrade to stable 502 API responses instead of generic crashes",
    async () => {
      teamviewerFetch.reset();
      teamviewerFetch.setHandler(async () =>
        jsonResponse({ error: "service unavailable" }, { status: 503 }),
      );

      const result = await harness.authedRequest(
        adminUser,
        "GET",
        "/teamviewer/import-preview",
        {
          headers: harness.withApiKey(),
        },
      );

      assert.equal(result.status, 502);
      assert.equal(result.body.code, "TEAMVIEWER_UPSTREAM_ERROR");
      assert.equal(
        result.body.message,
        "TeamViewer service is temporarily unavailable",
      );
    },
  );

  await t.test(
    "TeamViewer auth failures degrade to stable 502 API responses with TeamViewer-specific messaging",
    async () => {
      teamviewerFetch.reset();
      teamviewerFetch.setHandler(async () =>
        jsonResponse({ error: "unauthorized" }, { status: 401 }),
      );

      const result = await harness.authedRequest(
        adminUser,
        "POST",
        "/teamviewer/import-cases",
        {
          headers: harness.withApiKey(),
          body: {
            from_date: "2026-03-01",
            to_date: "2026-03-31",
          },
        },
      );

      assert.equal(result.status, 502);
      assert.equal(result.body.code, "TEAMVIEWER_AUTH_ERROR");
      assert.equal(result.body.message, "TeamViewer authentication failed");
    },
  );
});
