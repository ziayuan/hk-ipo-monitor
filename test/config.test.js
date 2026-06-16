const test = require("node:test");
const assert = require("node:assert/strict");

const { buildConfig } = require("../src/config");

test("buildConfig defaults Telegram to disabled and sets cutoff buckets", () => {
  const config = buildConfig({});

  assert.equal(config.sourceUrl, "https://www.vbkr.com/ipo/hk/v2/ipo-hk-index");
  assert.equal(config.timeZone, "Asia/Hong_Kong");
  assert.deepEqual(config.cutoffBucketsHours, [48, 36, 24, 12, 8, 4]);
  assert.equal(config.telegram.enabled, false);
  assert.equal(config.alertThresholds.crowdedHeat, 500);
  assert.equal(config.alertThresholds.veryCrowdedHeat, 1000);
  assert.equal(config.alertThresholds.extremeHeat, 3000);
  assert.equal(config.alertThresholds.heatSpikeAbsolute4h, 100);
  assert.equal(config.alertThresholds.heatSpikePct4h, 50);
});

test("buildConfig enables Telegram only when token and chat id are present", () => {
  const config = buildConfig({
    TELEGRAM_ENABLED: "true",
    TELEGRAM_BOT_TOKEN: "token",
    TELEGRAM_CHAT_IDS: "123,456"
  });

  assert.equal(config.telegram.enabled, true);
  assert.equal(config.telegram.botToken, "token");
  assert.deepEqual(config.telegram.chatIds, ["123", "456"]);
});
