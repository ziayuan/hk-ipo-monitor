const test = require("node:test");
const assert = require("node:assert/strict");

const { createApp } = require("../server");

test("GET /api/snapshot returns dashboard payload", async () => {
  const app = createApp({
    refreshOnce: async () => ({
      summary: { activeCount: 1, prepareListedCount: 0, capturedAt: "2026-06-15T02:00:00.000Z" },
      ipos: [{ securityCode: "01392.HK", securityName: "海清智元" }],
      capitalWindows: [],
      alerts: [],
      sourceStatus: { source: "wahshing", status: "ok" }
    })
  });
  await app.listen(0);
  const port = app.server.address().port;
  const response = await fetch(`http://127.0.0.1:${port}/api/snapshot`);
  const payload = await response.json();
  await app.close();

  assert.equal(response.status, 200);
  assert.equal(payload.summary.activeCount, 1);
  assert.equal(payload.ipos[0].securityCode, "01392.HK");
});
