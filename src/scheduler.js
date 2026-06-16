function hasActiveIpos(snapshot) {
  const activeCount = Number(snapshot?.summary?.activeCount);
  if (Number.isFinite(activeCount)) return activeCount > 0;
  return Array.isArray(snapshot?.ipos) && snapshot.ipos.some((ipo) => ipo.status === "active" && Number(ipo.hoursToCutoff) >= 0);
}

function computeNextRefreshMs(snapshot, config, now = new Date()) {
  const intervalMs = hasActiveIpos(snapshot) ? config.activeRefreshMs : config.idleRefreshMs;
  const nowMs = now.getTime();
  const remainder = nowMs % intervalMs;
  return remainder === 0 ? intervalMs : intervalMs - remainder;
}

function createRefreshScheduler({
  refreshOnce,
  config,
  onSnapshot = () => {},
  logger = console,
  getNow = () => new Date(),
  setTimer = setTimeout,
  clearTimer = clearTimeout
}) {
  let stopped = true;
  let running = false;
  let timer = null;
  let lastSnapshot = null;

  function clearCurrentTimer() {
    if (timer) clearTimer(timer);
    timer = null;
  }

  function schedule(delayMs = computeNextRefreshMs(lastSnapshot, config, getNow())) {
    clearCurrentTimer();
    timer = setTimer(run, delayMs);
    if (timer && typeof timer.unref === "function") timer.unref();
  }

  async function run() {
    if (stopped || running) return;
    running = true;
    try {
      lastSnapshot = await refreshOnce();
      onSnapshot(lastSnapshot);
    } catch (error) {
      logger.error(`HK IPO auto refresh failed: ${error.message}`);
    } finally {
      running = false;
      if (!stopped) schedule();
    }
  }

  return {
    start() {
      if (!stopped) return;
      stopped = false;
      schedule(0);
    },
    stop() {
      stopped = true;
      clearCurrentTimer();
    },
    runNow: run
  };
}

module.exports = {
  computeNextRefreshMs,
  createRefreshScheduler
};
