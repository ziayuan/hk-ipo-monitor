const test = require("node:test");
const assert = require("node:assert/strict");

const { sendTelegramMessage } = require("../src/telegram");

test("sendTelegramMessage is a no-op when Telegram is disabled", async () => {
  const calls = [];
  const result = await sendTelegramMessage({
    config: { telegram: { enabled: false } },
    text: "hello",
    fetchImpl: async (...args) => {
      calls.push(args);
      return { ok: true, json: async () => ({ ok: true }) };
    }
  });

  assert.equal(result.status, "disabled");
  assert.equal(calls.length, 0);
});

test("sendTelegramMessage posts to every configured chat id", async () => {
  const calls = [];
  const result = await sendTelegramMessage({
    config: {
      telegram: {
        enabled: true,
        botToken: "token",
        chatIds: ["1", "2"],
        apiBaseUrl: "https://api.telegram.org"
      }
    },
    text: "hello",
    fetchImpl: async (...args) => {
      calls.push(args);
      return { ok: true, json: async () => ({ ok: true }) };
    }
  });

  assert.equal(result.status, "sent");
  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], "https://api.telegram.org/bottoken/sendMessage");
});
