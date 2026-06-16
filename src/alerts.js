const CUTOFF_ALERT_HOURS = [36, 24, 12, 8, 4];

function formatRate(value) {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(2)}x` : "--";
}

function cutoffBucketForAlert(hoursToCutoff) {
  const hours = Number(hoursToCutoff);
  if (!Number.isFinite(hours) || hours < 0) return null;
  if (hours <= 1) return "final";
  for (const target of CUTOFF_ALERT_HOURS) {
    if (Math.abs(hours - target) <= 0.75) return `${target}h`;
  }
  return null;
}

function buildMessage({ ipo, currentSnapshot, suffix }) {
  return [
    `HK IPO Alert: ${ipo.securityCode} ${ipo.securityName}`,
    `截止: ${ipo.applyEndAt || "--"}`,
    `实时参考倍数: ${formatRate(currentSnapshot.estimatedMarginMultiple)}`,
    `结果日: ${ipo.resultDate || "--"}`,
    suffix
  ].filter(Boolean).join("\n");
}

function buildAlertsForSnapshot({ nowIso, ipo, currentSnapshot, signals, config }) {
  const alerts = [];
  const rate = Number(currentSnapshot.estimatedMarginMultiple);
  const cutoffBucket = cutoffBucketForAlert(currentSnapshot.hoursToCutoff);

  if (cutoffBucket) {
    alerts.push({
      securityCode: ipo.securityCode,
      alertType: "cutoff",
      alertKey: `${ipo.securityCode}:cutoff:${cutoffBucket}`,
      triggeredAt: nowIso,
      message: buildMessage({ ipo, currentSnapshot, suffix: `截止提醒: ${cutoffBucket}` }),
      status: "pending",
      deliveryChannel: "local"
    });
  }

  if (Number.isFinite(rate)) {
    const thresholds = config.alertThresholds;
    const levels = [
      ["extreme", thresholds.extremeHeat],
      ["very_crowded", thresholds.veryCrowdedHeat],
      ["crowded", thresholds.crowdedHeat]
    ];
    const level = levels.find(([, threshold]) => rate >= threshold);
    if (level) {
      alerts.push({
        securityCode: ipo.securityCode,
        alertType: "heat",
        alertKey: `${ipo.securityCode}:heat:${level[0]}`,
        triggeredAt: nowIso,
        message: buildMessage({ ipo, currentSnapshot, suffix: `热度信号: ${level[0]}` }),
        status: "pending",
        deliveryChannel: "local"
      });
    }
  }

  if (signals.momentumSignal === "accelerating") {
    alerts.push({
      securityCode: ipo.securityCode,
      alertType: "momentum",
      alertKey: `${ipo.securityCode}:momentum:accelerating`,
      triggeredAt: nowIso,
      message: buildMessage({ ipo, currentSnapshot, suffix: "热度正在加速" }),
      status: "pending",
      deliveryChannel: "local"
    });
  }

  return alerts;
}

module.exports = {
  buildAlertsForSnapshot,
  cutoffBucketForAlert
};
