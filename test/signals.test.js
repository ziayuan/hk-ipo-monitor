const test = require("node:test");
const assert = require("node:assert/strict");

const {
  classifyHeat,
  classifyMomentum,
  classifyTiming,
  nearestCutoffBuckets,
  buildCapitalWindows
} = require("../src/signals");

test("classifies heat as demand crowding, not quality", () => {
  assert.equal(classifyHeat(null), "unknown");
  assert.equal(classifyHeat(99.99), "thin");
  assert.equal(classifyHeat(130), "normal_active");
  assert.equal(classifyHeat(600), "crowded");
  assert.equal(classifyHeat(1200), "very_crowded");
  assert.equal(classifyHeat(6000), "extreme");
});

test("classifies momentum with 100x or 50 percent 4h threshold", () => {
  assert.equal(classifyMomentum({ current: 600, previous4h: null }), "insufficient_history");
  assert.equal(classifyMomentum({ current: 620, previous4h: 580 }), "steady");
  assert.equal(classifyMomentum({ current: 700, previous4h: 590 }), "accelerating");
  assert.equal(classifyMomentum({ current: 151, previous4h: 100 }), "accelerating");
});

test("classifies timing pressure", () => {
  assert.equal(classifyTiming(-1), "closed");
  assert.equal(classifyTiming(3.99), "closing_soon");
  assert.equal(classifyTiming(8), "decision_window");
  assert.equal(classifyTiming(36), "early");
});

test("calculates nearest cutoff bucket values", () => {
  const snapshots = [
    { hoursToCutoff: 47.5, estimatedMarginMultiple: 90 },
    { hoursToCutoff: 35.5, estimatedMarginMultiple: 120 },
    { hoursToCutoff: 23.5, estimatedMarginMultiple: 180 },
    { hoursToCutoff: 11.5, estimatedMarginMultiple: 260 },
    { hoursToCutoff: 7.8, estimatedMarginMultiple: 320 },
    { hoursToCutoff: 3.8, estimatedMarginMultiple: 500 },
    { hoursToCutoff: 0.2, estimatedMarginMultiple: 620 }
  ];
  const buckets = nearestCutoffBuckets(snapshots);

  assert.equal(buckets["48h"].estimatedMarginMultiple, 90);
  assert.equal(buckets["36h"].estimatedMarginMultiple, 120);
  assert.equal(buckets["24h"].estimatedMarginMultiple, 180);
  assert.equal(buckets["12h"].estimatedMarginMultiple, 260);
  assert.equal(buckets["8h"].estimatedMarginMultiple, 320);
  assert.equal(buckets["4h"].estimatedMarginMultiple, 500);
  assert.equal(buckets.final.estimatedMarginMultiple, 620);
});

test("assigns each snapshot to only its cutoff bucket interval", () => {
  const buckets = nearestCutoffBuckets([
    { id: 1, hoursToCutoff: 24, estimatedMarginMultiple: 180 },
    { id: 2, hoursToCutoff: 8, estimatedMarginMultiple: 320 }
  ]);

  assert.equal(buckets["36h"], null);
  assert.equal(buckets["24h"].id, 1);
  assert.equal(buckets["12h"], null);
  assert.equal(buckets["8h"].id, 2);
});

test("uses the first available snapshot after crossing a missed bucket boundary", () => {
  const buckets = nearestCutoffBuckets([
    { id: 1, hoursToCutoff: 18, estimatedMarginMultiple: 180 },
    { id: 2, hoursToCutoff: 9, estimatedMarginMultiple: 320 }
  ]);

  assert.equal(buckets["24h"].id, 1);
  assert.equal(buckets["24h"].hoursToCutoff, 18);
  assert.equal(buckets["12h"].id, 2);
  assert.equal(buckets["12h"].hoursToCutoff, 9);
});

test("does not fill future cutoff buckets before they are reached", () => {
  const buckets = nearestCutoffBuckets([
    { hoursToCutoff: 18.6, estimatedMarginMultiple: 506.3 },
    { hoursToCutoff: 13.5, estimatedMarginMultiple: 1816.41 },
    { hoursToCutoff: 12.5, estimatedMarginMultiple: 2195.84 },
    { hoursToCutoff: 11.5, estimatedMarginMultiple: 2195.84 },
    { hoursToCutoff: 10.6, estimatedMarginMultiple: 2195.84 }
  ]);

  assert.equal(buckets["12h"].estimatedMarginMultiple, 2195.84);
  assert.equal(buckets["8h"], null);
  assert.equal(buckets["4h"], null);
});

test("uses the latest post-cutoff snapshot as final when subscription is closed", () => {
  const buckets = nearestCutoffBuckets([
    { capturedAt: "2026-06-15T07:00:00.000Z", hoursToCutoff: -77, estimatedMarginMultiple: 3967.68 }
  ]);

  assert.equal(buckets.final.estimatedMarginMultiple, 3967.68);
  assert.equal(buckets.final.hoursToCutoff, -77);
});

test("builds only actionable capital reuse windows", () => {
  const windows = buildCapitalWindows([
    { securityCode: "01392.HK", resultDate: "2026-06-17", applyEndAt: "2026-06-16T02:00:00.000Z" },
    { securityCode: "06067.HK", resultDate: "2026-06-18", applyEndAt: "2026-06-17T02:00:00.000Z" },
    { securityCode: "06106.HK", resultDate: "2026-06-22", applyEndAt: "2026-06-18T02:00:00.000Z" }
  ], { defaultResultTime: "09:30" });

  assert.equal(windows.some((row) => row.fromCode === "01392.HK" && row.toCode === "06106.HK" && row.status === "reusable"), true);
  assert.equal(windows.some((row) => row.fromCode === "06106.HK" && row.toCode === "06067.HK"), false);
  assert.equal(windows.every((row) => row.status === "reusable" || row.status === "tight"), true);
});
