const test = require("node:test");
const assert = require("node:assert/strict");

const { createDatabase } = require("../src/db");
const { createRepository } = require("../src/repository");

test("upserts IPOs and appends rate snapshots without overwriting history", () => {
  const db = createDatabase(":memory:");
  const repo = createRepository(db);

  repo.upsertIpo({
    securityCode: "01392.HK",
    securityName: "海清智元",
    securityNameEn: "HQVT",
    status: "active",
    applyStartAt: "2026-06-11T00:00:00.000Z",
    applyEndAt: "2026-06-16T02:00:00.000Z",
    resultDate: "2026-06-17",
    greyMarketAt: null,
    listedDate: "2026-06-22",
    issueLowPrice: 7.2,
    issueHighPrice: 7.2,
    lotSize: 500,
    lowestFee: 3636.31,
    leverage: 10,
    enableFinance: true,
    prospectusUrl: "https://example.com/prospectus.pdf",
    sponsors: ["A"],
    source: "wahshing",
    sourceIpoId: "3943"
  });

  repo.insertRateSnapshot({
    securityCode: "01392.HK",
    capturedAt: "2026-06-15T02:00:00.000Z",
    hoursToCutoff: 24,
    estimatedMarginMultiple: 100,
    source: "wahshing",
    rawSourcePayload: { applyRate: "100" }
  });
  repo.insertRateSnapshot({
    securityCode: "01392.HK",
    capturedAt: "2026-06-15T06:00:00.000Z",
    hoursToCutoff: 20,
    estimatedMarginMultiple: 180,
    source: "wahshing",
    rawSourcePayload: { applyRate: "180" }
  });

  const ipo = repo.listIpos()[0];
  const history = repo.listRateSnapshots("01392.HK");

  assert.equal(ipo.securityCode, "01392.HK");
  assert.equal(ipo.officialPublicSubscriptionMultiple, null);
  assert.equal(history.length, 2);
  assert.equal(history[0].estimatedMarginMultiple, 100);
  assert.equal(history[1].estimatedMarginMultiple, 180);
});

test("stores local alerts with duplicate alert key ignored", () => {
  const db = createDatabase(":memory:");
  const repo = createRepository(db);

  assert.equal(repo.insertAlert({
    securityCode: "01392.HK",
    alertType: "cutoff",
    alertKey: "01392.HK:cutoff:4h",
    triggeredAt: "2026-06-15T22:00:00.000Z",
    message: "cutoff soon",
    status: "pending",
    deliveryChannel: "local"
  }), true);
  assert.equal(repo.insertAlert({
    securityCode: "01392.HK",
    alertType: "cutoff",
    alertKey: "01392.HK:cutoff:4h",
    triggeredAt: "2026-06-15T22:00:00.000Z",
    message: "cutoff soon",
    status: "pending",
    deliveryChannel: "local"
  }), false);

  assert.equal(repo.listAlerts().length, 1);
});
