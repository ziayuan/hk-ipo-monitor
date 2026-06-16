const test = require("node:test");
const assert = require("node:assert/strict");

const { computeNextRefreshMs, createRefreshScheduler } = require("../src/scheduler");

test("computeNextRefreshMs uses active cadence when active IPOs exist", () => {
  const config = { activeRefreshMs: 60, idleRefreshMs: 240 };

  assert.equal(computeNextRefreshMs({ summary: { activeCount: 1 } }, config, new Date(0)), 60);
  assert.equal(computeNextRefreshMs({ summary: { activeCount: 0 } }, config, new Date(0)), 240);
  assert.equal(computeNextRefreshMs(null, config, new Date(0)), 240);
});

test("computeNextRefreshMs aligns active refresh to the next wall-clock hour", () => {
  const config = { activeRefreshMs: 60 * 60 * 1000, idleRefreshMs: 4 * 60 * 60 * 1000 };
  const now = new Date("2026-06-16T10:13:20.000Z");

  assert.equal(computeNextRefreshMs({ summary: { activeCount: 1 } }, config, now), 46 * 60 * 1000 + 40 * 1000);
});

test("createRefreshScheduler runs immediately and reschedules from snapshot state", async () => {
  const timers = [];
  const snapshots = [];
  const scheduler = createRefreshScheduler({
    config: { activeRefreshMs: 60, idleRefreshMs: 240 },
    refreshOnce: async () => ({ summary: { activeCount: 2 } }),
    onSnapshot: (snapshot) => snapshots.push(snapshot),
    logger: { error() {} },
    getNow: () => new Date(0),
    setTimer: (fn, ms) => {
      timers.push({ fn, ms });
      return { id: timers.length };
    },
    clearTimer: () => {}
  });

  scheduler.start();
  assert.equal(timers[0].ms, 0);

  await timers[0].fn();

  assert.equal(snapshots.length, 1);
  assert.equal(timers[1].ms, 60);
  scheduler.stop();
});
