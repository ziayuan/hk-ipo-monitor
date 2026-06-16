function extractBalancedCall(html, marker) {
  const start = html.indexOf(marker);
  if (start < 0) return null;
  const openParen = html.indexOf("(", start);
  if (openParen < 0) return null;

  let depth = 0;
  let inString = false;
  let stringQuote = "";
  let escaped = false;

  for (let index = openParen; index < html.length; index += 1) {
    const char = html[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === stringQuote) {
        inString = false;
        stringQuote = "";
      }
      continue;
    }

    if (char === "\"" || char === "'" || char === "`") {
      inString = true;
      stringQuote = char;
      continue;
    }

    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth === 0) return html.slice(start, index + 1);
    }
  }

  return null;
}

function parseWahShingIpoHtml(html) {
  const call = extractBalancedCall(String(html || ""), "window.__NUXT__=");
  if (!call) {
    throw new Error("WahShing Nuxt payload not found");
  }

  const expression = call.replace(/^window\.__NUXT__=/, "");
  let payload;
  try {
    payload = Function(`"use strict"; return (${expression});`)();
  } catch (error) {
    throw new Error(`WahShing Nuxt payload parse failed: ${error.message}`);
  }

  const firstData = payload && Array.isArray(payload.data) ? payload.data[0] : null;
  if (!firstData || !Array.isArray(firstData.enableApplyList)) {
    throw new Error("WahShing IPO lists missing from Nuxt payload");
  }

  return {
    parseMode: "nuxt_payload",
    active: firstData.enableApplyList,
    prepareListed: Array.isArray(firstData.prepareListed) ? firstData.prepareListed : [],
    raw: firstData
  };
}

async function fetchWahShingIpoPage(sourceUrl, fetchImpl = fetch) {
  const response = await fetchImpl(sourceUrl, {
    headers: {
      "user-agent": "Mozilla/5.0 hk-ipo-monitor/0.1"
    }
  });
  if (!response.ok) {
    throw new Error(`WahShing fetch failed with HTTP ${response.status}`);
  }
  return response.text();
}

module.exports = {
  parseWahShingIpoHtml,
  fetchWahShingIpoPage
};
