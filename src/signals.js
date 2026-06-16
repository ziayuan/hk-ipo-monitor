const { parseHongKongDateTime, hoursBetween } = require("./normalize");

const CUTOFF_BUCKETS = [
  ["48h", 48],
  ["36h", 36],
  ["24h", 24],
  ["12h", 12],
  ["8h", 8],
  ["4h", 4]
];

function classifyHeat(value) {
  if (value === null || value === undefined || value === "") return "unknown";
  if (!Number.isFinite(Number(value))) return "unknown";
  const number = Number(value);
  if (number < 100) return "thin";
  if (number < 500) return "normal_active";
  if (number < 1000) return "crowded";
  if (number < 3000) return "very_crowded";
  return "extreme";
}

function classifyMomentum({ current, previous4h }) {
  const currentNumber = Number(current);
  const previousNumber = Number(previous4h);
  if (!Number.isFinite(currentNumber) || !Number.isFinite(previousNumber) || previousNumber <= 0) {
    return "insufficient_history";
  }
  const absoluteChange = currentNumber - previousNumber;
  const pctChange = (absoluteChange / previousNumber) * 100;
  if (absoluteChange >= 100 || pctChange >= 50) return "accelerating";
  return "steady";
}

function classifyTiming(hoursToCutoff) {
  const hours = Number(hoursToCutoff);
  if (!Number.isFinite(hours)) return "unknown";
  if (hours < 0) return "closed";
  if (hours < 4) return "closing_soon";
  if (hours <= 24) return "decision_window";
  return "early";
}

function nearestSnapshot(snapshots, target, toleranceHours = 4) {
  let best = null;
  let bestDistance = Infinity;
  for (const snapshot of snapshots) {
    const hours = Number(snapshot.hoursToCutoff);
    if (!Number.isFinite(hours)) continue;
    const distance = Math.abs(hours - target);
    if (distance <= toleranceHours && distance < bestDistance) {
      best = snapshot;
      bestDistance = distance;
    }
  }
  return best;
}

function hasReachedBucket(snapshots, target) {
  return snapshots.some((snapshot) => {
    const hours = Number(snapshot.hoursToCutoff);
    return Number.isFinite(hours) && hours <= target;
  });
}

function nearestCutoffBuckets(snapshots, toleranceHours = 4) {
  const result = {};
  for (const [label, target] of CUTOFF_BUCKETS) {
    result[label] = hasReachedBucket(snapshots, target) ? nearestSnapshot(snapshots, target, toleranceHours) : null;
  }
  const positiveSnapshots = snapshots
    .filter((snapshot) => Number(snapshot.hoursToCutoff) >= 0)
    .sort((a, b) => Number(a.hoursToCutoff) - Number(b.hoursToCutoff));
  const postCutoffSnapshots = snapshots
    .filter((snapshot) => Number(snapshot.hoursToCutoff) < 0 && Number.isFinite(Number(snapshot.estimatedMarginMultiple)))
    .sort((a, b) => new Date(b.capturedAt || 0).getTime() - new Date(a.capturedAt || 0).getTime());
  result.final = positiveSnapshots.find((snapshot) => Number(snapshot.hoursToCutoff) <= 1) || postCutoffSnapshots[0] || null;
  return result;
}

function resultDateToIso(resultDate, defaultResultTime = "09:30") {
  if (!resultDate) return null;
  return parseHongKongDateTime(`${resultDate} ${defaultResultTime}:00`);
}

function buildCapitalWindows(ipos, options = {}) {
  const defaultResultTime = options.defaultResultTime || "09:30";
  const windows = [];
  for (const from of ipos) {
    const resultAt = resultDateToIso(from.resultDate, defaultResultTime);
    for (const to of ipos) {
      if (from.securityCode === to.securityCode) continue;
      const targetCutoff = to.applyEndAt;
      let hours = null;
      let status = "unknown";
      if (resultAt && targetCutoff) {
        hours = hoursBetween(resultAt, targetCutoff);
        if (hours >= 8) status = "reusable";
        else if (hours >= 0) status = "tight";
        else status = "blocked";
      }
      if (status === "reusable" || status === "tight") {
        windows.push({
          fromCode: from.securityCode,
          toCode: to.securityCode,
          resultAt,
          targetCutoff,
          availableHours: hours,
          status
        });
      }
    }
  }
  return windows;
}

module.exports = {
  CUTOFF_BUCKETS,
  classifyHeat,
  classifyMomentum,
  classifyTiming,
  nearestCutoffBuckets,
  buildCapitalWindows
};
