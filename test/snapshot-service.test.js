const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { createDatabase } = require("../src/db");
const { createRepository } = require("../src/repository");
const { refreshOnce, refreshWithHtml } = require("../src/snapshot-service");

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
  assert.equal(result.ipos.find((ipo) => ipo.securityCode === "01392.HK").rateHistory.length, 1);
  assert.equal(
    result.ipos.find((ipo) => ipo.securityCode === "06675.HK").cutoffBuckets.final.estimatedMarginMultiple,
    3967.68
  );
});

test("refreshOnce returns decorated cached IPOs when source fetch fails", async () => {
  const html = fs.readFileSync(path.join(__dirname, "fixtures", "wahshing-ipo.html"), "utf8");
  const db = createDatabase(":memory:");
  const repo = createRepository(db);
  const config = {
    sourceUrl: "http://127.0.0.1:1/unreachable",
    defaultResultTime: "09:30",
    alertThresholds: {
      crowdedHeat: 500,
      veryCrowdedHeat: 1000,
      extremeHeat: 3000,
      heatSpikeAbsolute4h: 100,
      heatSpikePct4h: 50
    }
  };

  await refreshWithHtml({
    html,
    repo,
    nowIso: "2026-06-15T02:00:00.000Z",
    config
  });
  const result = await refreshOnce({
    db,
    repo,
    config,
    nowIso: "2026-06-15T03:00:00.000Z"
  });
  const cached = result.ipos.find((ipo) => ipo.securityCode === "01392.HK");

  assert.equal(result.summary.error.includes("fetch"), true);
  assert.equal(result.summary.activeCount, 2);
  assert.equal(cached.currentSnapshot.estimatedMarginMultiple, 486.71);
  assert.equal(cached.heatSignal, "normal_active");
  assert.equal(typeof cached.hoursToCutoff, "number");
  assert.equal(cached.rateHistory.length, 1);
  assert.equal(Object.hasOwn(cached.cutoffBuckets, "12h"), true);
});
