const test = require("node:test");
const assert = require("node:assert/strict");

const { buildAlertsForSnapshot } = require("../src/alerts");

test("creates cutoff, heat, and final pre-cutoff alert keys", () => {
  const alerts = buildAlertsForSnapshot({
    nowIso: "2026-06-15T14:00:00.000Z",
    ipo: {
      securityCode: "01392.HK",
      securityName: "海清智元",
      applyEndAt: "2026-06-16T02:00:00.000Z",
      resultDate: "2026-06-17"
    },
    currentSnapshot: {
      estimatedMarginMultiple: 1200,
      hoursToCutoff: 12
    },
    signals: {
      heatSignal: "very_crowded",
      momentumSignal: "accelerating"
    },
    config: {
      alertThresholds: {
        crowdedHeat: 500,
        veryCrowdedHeat: 1000,
        extremeHeat: 3000
      }
    }
  });

  assert.equal(alerts.some((alert) => alert.alertKey === "01392.HK:cutoff:12h"), true);
  assert.equal(alerts.some((alert) => alert.alertKey === "01392.HK:heat:very_crowded"), true);
  assert.equal(alerts.some((alert) => alert.alertKey === "01392.HK:momentum:accelerating"), true);
});

test("creates final alert inside final cutoff window", () => {
  const alerts = buildAlertsForSnapshot({
    nowIso: "2026-06-16T01:30:00.000Z",
    ipo: {
      securityCode: "01392.HK",
      securityName: "海清智元",
      applyEndAt: "2026-06-16T02:00:00.000Z",
      resultDate: "2026-06-17"
    },
    currentSnapshot: {
      estimatedMarginMultiple: 486.71,
      hoursToCutoff: 0.5
    },
    signals: {
      heatSignal: "normal_active",
      momentumSignal: "steady"
    },
    config: {
      alertThresholds: {
        crowdedHeat: 500,
        veryCrowdedHeat: 1000,
        extremeHeat: 3000
      }
    }
  });

  assert.equal(alerts.some((alert) => alert.alertKey === "01392.HK:cutoff:final"), true);
});
