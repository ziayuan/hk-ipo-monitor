function finiteNumber(value) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/,/g, "").replace(/倍$/g, "").trim();
  if (!cleaned || cleaned === "--") return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function parseHongKongDateTime(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4] || 0);
  const minute = Number(match[5] || 0);
  const second = Number(match[6] || 0);
  const utcMs = Date.UTC(year, month - 1, day, hour - 8, minute, second);
  return new Date(utcMs).toISOString();
}

function hoursBetween(startIso, endIso) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Number(((end - start) / 3_600_000).toFixed(4));
}

function normalizeIpoRow(row, options = {}) {
  const securityCode = String(row.securityCode || "").trim();
  const estimatedMarginMultiple = finiteNumber(row.applyRate);
  return {
    securityCode,
    securityName: String(row.securityNameTc || row.securityName || "").trim(),
    securityNameEn: String(row.securityNameEn || "").trim(),
    status: options.status || "active",
    applyStartAt: parseHongKongDateTime(row.applyStartDate),
    applyEndAt: parseHongKongDateTime(row.applyEndTime),
    resultDate: row.applyResultDate || null,
    greyMarketAt: null,
    listedDate: row.listedDate || null,
    issueLowPrice: finiteNumber(row.issueLowPrice),
    issueHighPrice: finiteNumber(row.issueHighPrice),
    lotSize: finiteNumber(row.lotSize),
    lowestFee: finiteNumber(row.lowestFee),
    leverage: finiteNumber(row.leverage),
    enableFinance: Boolean(row.enableFinance),
    prospectusUrl: row.prospectusPath || null,
    sponsors: Array.isArray(row.sponsors) ? row.sponsors : [],
    source: options.source || "wahshing",
    sourceIpoId: row.ipoId == null ? null : String(row.ipoId),
    estimatedMarginMultiple,
    officialPublicSubscriptionMultiple: null,
    raw: row
  };
}

module.exports = {
  finiteNumber,
  parseHongKongDateTime,
  hoursBetween,
  normalizeIpoRow
};
