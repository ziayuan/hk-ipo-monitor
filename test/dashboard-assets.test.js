const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("dashboard shell exposes required panels and cutoff buckets", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
  const appJs = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");

  for (const id of ["activeCount", "nextCutoff", "hottestIpo", "sourceStatus", "ipoCards", "rateChart", "currentSeriesOptions", "historySeriesOptions", "capitalWindows", "alerts"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  for (const bucket of ["48h", "36h", "24h", "12h", "8h", "4h", "final"]) {
    assert.match(appJs, new RegExp(`"${bucket}"`));
  }
  assert.doesNotMatch(html, /id="bucketRows"/);
  assert.match(html, /不构成投资建议/);
});

test("dashboard display uses company names and Chinese capital-window wording", () => {
  const appJs = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");

  for (const companyName of ["海清智元", "琻捷电子", "星源材质", "华健未来-B", "麦科医药-B", "仙工智能"]) {
    assert.match(appJs, new RegExp(companyName));
  }
  for (const phrase of ["companyLabel", "资金可再申购", "时间很紧", "translateSignal"]) {
    assert.match(appJs, new RegExp(phrase));
  }
  assert.doesNotMatch(appJs, /已截止，不能错峰/);
  assert.match(appJs, /item\.status !== "blocked"/);
  for (const phrase of ["renderRateChart", "renderSeriesOptions", "历史样本", "当前机会", "xForHours", "seriesPoints", "rateHistory", "actualHours", "compactHistorySnapshots", "renderPointAnnotation", "annotationText"]) {
    assert.match(appJs, new RegExp(phrase));
  }
  const css = fs.readFileSync(path.join(__dirname, "..", "public", "styles.css"), "utf8");
  for (const className of ["chart-callout", "chart-label", "chart-label-bg"]) {
    assert.match(css, new RegExp(className));
  }
  assert.doesNotMatch(appJs, /\$\{row\.fromCode\} -> \$\{row\.toCode\}: \$\{row\.status\}/);
});
