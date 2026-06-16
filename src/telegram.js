async function sendTelegramMessage({ config, text, fetchImpl = fetch }) {
  const telegram = config.telegram || {};
  if (!telegram.enabled) {
    return { status: "disabled" };
  }

  const results = [];
  for (const chatId of telegram.chatIds) {
    const response = await fetchImpl(`${telegram.apiBaseUrl}/bot${telegram.botToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true
      })
    });
    if (!response.ok) {
      throw new Error(`Telegram send failed with HTTP ${response.status}`);
    }
    results.push(await response.json());
  }

  return { status: "sent", results };
}

module.exports = {
  sendTelegramMessage
};
