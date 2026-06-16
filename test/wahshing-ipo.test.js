const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { parseWahShingIpoHtml } = require("../src/scrapers/wahshing-ipo");

test("parses WahShing Nuxt payload into source rows", () => {
  const html = fs.readFileSync(path.join(__dirname, "fixtures", "wahshing-ipo.html"), "utf8");
  const result = parseWahShingIpoHtml(html);

  assert.equal(result.parseMode, "nuxt_payload");
  assert.equal(result.active.length, 2);
  assert.equal(result.prepareListed.length, 1);
  assert.equal(result.active[0].securityCode, "01392.HK");
  assert.equal(result.active[0].securityName, "海清智元");
  assert.equal(result.active[0].applyRate, "486.71");
  assert.equal(result.active[0].prospectusPath.includes("hkexnews.hk"), true);
});

test("throws a useful error when Nuxt data is missing", () => {
  assert.throws(
    () => parseWahShingIpoHtml("<html></html>"),
    /WahShing Nuxt payload not found/
  );
});
