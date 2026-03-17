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

test("TeamViewer backend hardening covers preview, import, degradation, and current route authorization", async (t) => {
  const teamviewerFetch = createTeamviewerFetchMock();
  teamviewerFetch.install();

  const harness = createApiHarness({
    prefix: "sopaloha-teamviewer-",
    authSessionSecret: "sopaloha-teamviewer-suite-secret",
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
  harness.seedUser(techUser);

  t.after(async () => {
    global.fetch = realFetch;
    await harness.stop();
  });

  await t.test(
    "unauthenticated TeamViewer routes are rejected and current authenticated tech access remains allowed",
    async () => {
      teamviewerFetch.reset();

      const unauthenticated = await harness.request(
        "GET",
        "/teamviewer/import-preview",
      );
      assert.equal(unauthenticated.status, 401);
      assert.equal(unauthenticated.body.message, "Authentication required");

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

      const preview = await harness.authedRequest(
        techUser,
        "GET",
        "/teamviewer/import-preview",
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

      const importResult = await harness.authedRequest(
        techUser,
        "POST",
        "/teamviewer/import",
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
    "TeamViewer imported-case flows handle pagination, duplicates, partial payloads, and current tech mutation access",
    async () => {
      teamviewerFetch.reset();

      teamviewerFetch.setHandler(async (url) => {
        const parsedUrl = new URL(url);
        if (parsedUrl.pathname !== "/api/v1/reports/connections") {
          throw new Error(`Unexpected TeamViewer request: ${url}`);
        }

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

      assert.equal(importCasesResult.status, 200);
      assert.deepEqual(importCasesResult.body.summary, {
        total_received: 5,
        total_with_note: 5,
        total_valid_format: 2,
        total_inserted: 2,
        total_duplicated: 1,
        total_discarded_invalid_format: 2,
        total_out_of_range_from_api: 1,
      });
      assert.deepEqual(
        importCasesResult.body.discarded.map((row) => row.reason).sort(),
        ["missing_required_fields", "missing_separator"],
      );

      const listImportedCases = await harness.authedRequest(
        techUser,
        "GET",
        "/teamviewer/imported-cases",
      );
      assert.equal(listImportedCases.status, 200);
      assert.equal(listImportedCases.body.length, 2);

      const resolvedNames = listImportedCases.body
        .map((row) => row.resolved_location_name)
        .sort();
      assert.deepEqual(resolvedNames, ["Local Nuevo", "Local Reused"]);

      const manualCase = await harness.authedRequest(
        techUser,
        "POST",
        "/teamviewer/imported-cases",
        {
          body: {
            started_at: "2026-03-11T09:00:00Z",
            ended_at: "2026-03-11T09:10:00Z",
            teamviewer_group_name: "Local Reused",
            note_raw: "Impresora sin papel - Sofia",
          },
        },
      );
      assert.equal(manualCase.status, 201);
      assert.equal(manualCase.body.teamviewer_group_name, "Local Reused");

      const deleteManualCase = await harness.authedRequest(
        techUser,
        "DELETE",
        `/teamviewer/imported-cases/${manualCase.body.id}`,
      );
      assert.equal(deleteManualCase.status, 204);
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
