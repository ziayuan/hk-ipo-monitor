const DEFAULT_SOURCE_URL = "https://www.vbkr.com/ipo/hk/v2/ipo-hk-index";

function truthy(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function splitList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function numberFromEnv(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function buildConfig(env = process.env) {
  const chatIds = splitList(env.TELEGRAM_CHAT_IDS || env.TELEGRAM_CHAT_ID);
  const botToken = String(env.TELEGRAM_BOT_TOKEN || "").trim();
  const telegramExplicitlyEnabled = truthy(env.TELEGRAM_ENABLED);

  return {
    sourceUrl: String(env.HK_IPO_SOURCE_URL || DEFAULT_SOURCE_URL).trim(),
    dbPath: String(env.HK_IPO_DB_PATH || "data/hk-ipo-monitor.sqlite").trim(),
    timeZone: String(env.HK_IPO_TIMEZONE || "Asia/Hong_Kong").trim(),
    defaultResultTime: String(env.HK_IPO_DEFAULT_RESULT_TIME || "09:30").trim(),
    activeRefreshMs: numberFromEnv(env.HK_IPO_ACTIVE_REFRESH_MS, 60 * 60 * 1000),
    idleRefreshMs: numberFromEnv(env.HK_IPO_IDLE_REFRESH_MS, 4 * 60 * 60 * 1000),
    cutoffBucketsHours: [48, 36, 24, 12, 8, 4],
    alertThresholds: {
      crowdedHeat: numberFromEnv(env.HK_IPO_CROWDED_HEAT, 500),
      veryCrowdedHeat: numberFromEnv(env.HK_IPO_VERY_CROWDED_HEAT, 1000),
      extremeHeat: numberFromEnv(env.HK_IPO_EXTREME_HEAT, 3000),
      heatSpikeAbsolute4h: numberFromEnv(env.HK_IPO_HEAT_SPIKE_ABSOLUTE_4H, 100),
      heatSpikePct4h: numberFromEnv(env.HK_IPO_HEAT_SPIKE_PCT_4H, 50)
    },
    telegram: {
      enabled: telegramExplicitlyEnabled && Boolean(botToken) && chatIds.length > 0,
      botToken,
      chatIds,
      apiBaseUrl: String(env.TELEGRAM_API_BASE_URL || "https://api.telegram.org").replace(/\/+$/, "")
    }
  };
}

module.exports = {
  buildConfig
};
