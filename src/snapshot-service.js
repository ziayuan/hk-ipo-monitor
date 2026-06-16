const { buildConfig } = require("./config");
const { createDatabase } = require("./db");
const { createRepository } = require("./repository");
const { fetchWahShingIpoPage, parseWahShingIpoHtml } = require("./scrapers/wahshing-ipo");
const { normalizeIpoRow, hoursBetween } = require("./normalize");
const { classifyHeat, classifyMomentum, classifyTiming, nearestCutoffBuckets, buildCapitalWindows } = require("./signals");
const { buildAlertsForSnapshot } = require("./alerts");

function groupSnapshotsByCode(snapshots) {
  const groups = new Map();
  for (const snapshot of snapshots) {
    if (!groups.has(snapshot.securityCode)) groups.set(snapshot.securityCode, []);
    groups.get(snapshot.securityCode).push(snapshot);
  }
  return groups;
}

function nearestPriorSnapshot(snapshots, capturedAt, targetHoursAgo, toleranceHours = 2) {
  const targetMs = new Date(capturedAt).getTime() - targetHoursAgo * 3_600_000;
  let best = null;
  let bestDistance = Infinity;
  for (const snapshot of snapshots) {
    const ms = new Date(snapshot.capturedAt).getTime();
    const distanceHours = Math.abs(ms - targetMs) / 3_600_000;
    if (distanceHours <= toleranceHours && distanceHours < bestDistance) {
      best = snapshot;
      bestDistance = distanceHours;
    }
  }
  return best;
}

function publicRateSnapshot(snapshot) {
  return {
    id: snapshot.id,
    securityCode: snapshot.securityCode,
    capturedAt: snapshot.capturedAt,
    hoursToCutoff: snapshot.hoursToCutoff,
    estimatedMarginMultiple: snapshot.estimatedMarginMultiple,
    source: snapshot.source
  };
}

function decorateIpo(ipo, history, nowIso, config) {
  const latest = history[history.length - 1] || null;
  const previous4h = latest ? nearestPriorSnapshot(history.slice(0, -1), latest.capturedAt, 4) : null;
  const heatSignal = classifyHeat(latest ? latest.estimatedMarginMultiple : null);
  const momentumSignal = latest ? classifyMomentum({
    current: latest.estimatedMarginMultiple,
    previous4h: previous4h ? previous4h.estimatedMarginMultiple : null
  }) : "insufficient_history";
  const hoursToCutoff = ipo.applyEndAt ? hoursBetween(nowIso, ipo.applyEndAt) : null;
  return {
    ...ipo,
    currentSnapshot: latest,
    heatSignal,
    momentumSignal,
    timingSignal: classifyTiming(hoursToCutoff),
    hoursToCutoff,
    cutoffBuckets: nearestCutoffBuckets(history),
    rateHistory: history.map(publicRateSnapshot),
    sourceFreshness: latest ? latest.capturedAt : null
  };
}

function listDecoratedIpos(repo, nowIso, config) {
  const historyByCode = groupSnapshotsByCode(repo.listAllRateSnapshots());
  return repo.listIpos().map((ipo) => decorateIpo(ipo, historyByCode.get(ipo.securityCode) || [], nowIso, config));
}

async function refreshWithHtml({ html, repo, nowIso = new Date().toISOString(), config = buildConfig() }) {
  const parsed = parseWahShingIpoHtml(html);
  const active = parsed.active.map((row) => normalizeIpoRow(row, { status: "active", source: "wahshing" }));
  const prepareListed = parsed.prepareListed.map((row) => normalizeIpoRow(row, { status: "prepare_listed", source: "wahshing" }));
  const all = [...active, ...prepareListed];

  for (const ipo of all) {
    repo.upsertIpo(ipo, nowIso);
    const hoursToCutoff = ipo.applyEndAt ? hoursBetween(nowIso, ipo.applyEndAt) : null;
    repo.insertRateSnapshot({
      securityCode: ipo.securityCode,
      capturedAt: nowIso,
      hoursToCutoff,
      estimatedMarginMultiple: ipo.estimatedMarginMultiple,
      source: ipo.source,
      rawSourcePayload: ipo.raw
    });
  }

  const decorated = listDecoratedIpos(repo, nowIso, config);
  for (const ipo of decorated.filter((row) => row.status === "active")) {
    const currentSnapshot = ipo.currentSnapshot || { estimatedMarginMultiple: null, hoursToCutoff: ipo.hoursToCutoff };
    for (const alert of buildAlertsForSnapshot({
      nowIso,
      ipo,
      currentSnapshot,
      signals: ipo,
      config
    })) {
      repo.insertAlert(alert);
    }
  }

  repo.setSourceStatus("wahshing", "ok", `Parsed ${all.length} IPO rows`, nowIso);

  return {
    summary: {
      activeCount: active.length,
      prepareListedCount: prepareListed.length,
      capturedAt: nowIso
    },
    ipos: decorated,
    capitalWindows: buildCapitalWindows(decorated, { defaultResultTime: config.defaultResultTime }),
    alerts: repo.listAlerts(),
    sourceStatus: repo.getSourceStatus("wahshing")
  };
}

async function refreshOnce(options = {}) {
  const config = options.config || buildConfig();
  const db = options.db || createDatabase(config.dbPath);
  const repo = options.repo || createRepository(db);
  const nowIso = options.nowIso || new Date().toISOString();
  try {
    const html = await fetchWahShingIpoPage(config.sourceUrl);
    return refreshWithHtml({ html, repo, nowIso, config });
  } catch (error) {
    repo.setSourceStatus("wahshing", "error", error.message, nowIso);
    const decorated = listDecoratedIpos(repo, nowIso, config);
    return {
      summary: {
        activeCount: decorated.filter((ipo) => ipo.status === "active").length,
        prepareListedCount: decorated.filter((ipo) => ipo.status === "prepare_listed").length,
        capturedAt: nowIso,
        error: error.message
      },
      ipos: decorated,
      capitalWindows: buildCapitalWindows(decorated, { defaultResultTime: config.defaultResultTime }),
      alerts: repo.listAlerts(),
      sourceStatus: repo.getSourceStatus("wahshing")
    };
  }
}

module.exports = {
  refreshWithHtml,
  refreshOnce,
  decorateIpo,
  listDecoratedIpos
};
