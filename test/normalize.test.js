const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeIpoRow, parseHongKongDateTime, hoursBetween } = require("../src/normalize");

test("normalizes active WahShing IPO row", () => {
  const ipo = normalizeIpoRow({
    securityCode: "01392.HK",
    securityName: "海清智元",
    securityNameEn: "HQVT",
    applyStartDate: "2026-06-11",
    applyEndTime: "2026-06-16 10:00:00",
    applyResultDate: "2026-06-17",
    listedDate: "2026-06-22",
    applyRate: "486.71",
    lowestFee: 3636.31,
    lotSize: 500,
    issueLowPrice: 7.2,
    issueHighPrice: 7.2,
    leverage: "10",
    enableFinance: true,
    prospectusPath: "https://example.com/prospectus.pdf",
    sponsors: ["A", "B"],
    ipoId: 3943
  }, { status: "active", source: "wahshing" });

  assert.equal(ipo.securityCode, "01392.HK");
  assert.equal(ipo.securityName, "海清智元");
  assert.equal(ipo.applyEndAt, "2026-06-16T02:00:00.000Z");
  assert.equal(ipo.resultDate, "2026-06-17");
  assert.equal(ipo.estimatedMarginMultiple, 486.71);
  assert.equal(ipo.officialPublicSubscriptionMultiple, null);
  assert.equal(ipo.raw.applyRate, "486.71");
});

test("treats missing applyRate as null", () => {
  const ipo = normalizeIpoRow({
    securityCode: "02335.HK",
    securityName: "麥科醫藥－Ｂ",
    applyEndTime: "2026-06-18 10:00:00",
    applyRate: "--"
  }, { status: "active", source: "wahshing" });

  assert.equal(ipo.estimatedMarginMultiple, null);
});

test("parses Hong Kong time as UTC instant and calculates hour differences", () => {
  assert.equal(parseHongKongDateTime("2026-06-16 10:00:00"), "2026-06-16T02:00:00.000Z");
  assert.equal(hoursBetween("2026-06-15T18:00:00.000Z", "2026-06-16T02:00:00.000Z"), 8);
});
