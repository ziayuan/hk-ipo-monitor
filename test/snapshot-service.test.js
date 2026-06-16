const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { createDatabase } = require("../src/db");
const { createRepository } = require("../src/repository");
const { refreshWithHtml } = require("../src/snapshot-service");

test("refreshWithHtml stores IPOs, snapshots, source status, and local alerts", async () => {
  const html = fs.readFileSync(path.join(__dirname, "fixtures", "wahshing-ipo.html"), "utf8");
  const db = createDatabase(":memory:");
  const repo = createRepository(db);
  const result = await refreshWithHtml({
    html,
    repo,
    nowIso: "2026-06-15T02:00:00.000Z",
    config: {
      defaultResultTime: "09:30",
      alertThresholds: {
        crowdedHeat: 500,
        veryCrowdedHeat: 1000,
        extremeHeat: 3000,
        heatSpikeAbsolute4h: 100,
        heatSpikePct4h: 50
      }
    }
  });

  assert.equal(result.summary.activeCount, 2);
  assert.equal(repo.listIpos().length, 3);
  assert.equal(repo.listRateSnapshots("01392.HK").length, 1);
  assert.equal(repo.getSourceStatus("wahshing").status, "ok");
  assert.equal(repo.listAlerts().some((alert) => alert.securityCode === "01392.HK"), true);
  assert.equal(
    result.ipos.find((ipo) => ipo.securityCode === "06675.HK").cutoffBuckets.final.estimatedMarginMultiple,
    3967.68
  );
});
