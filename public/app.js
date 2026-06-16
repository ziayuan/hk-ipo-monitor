let state = {
  payload: null,
  selectedCode: null,
  selectedCurrentCodes: null,
  selectedHistoryCodes: null
};

const $ = (id) => document.getElementById(id);

const CHART_BUCKETS = ["48h", "36h", "24h", "12h", "8h", "4h", "final"];
const BUCKET_HOURS = {
  "48h": 48,
  "36h": 36,
  "24h": 24,
  "12h": 12,
  "8h": 8,
  "4h": 4,
  final: 0
};
const SERIES_COLORS = ["#087f7a", "#b45309", "#5b4b8a", "#2563eb", "#b42318", "#0f766e", "#64748b", "#9333ea"];

const COMPANY_NAME_OVERRIDES = {
  "01392.HK": "海清智元",
  "06675.HK": "琻捷电子",
  "06067.HK": "星源材质",
  "06132.HK": "华健未来-B",
  "02335.HK": "麦科医药-B",
  "06106.HK": "仙工智能",
  SENASIC: "琻捷电子",
  "星源材質": "星源材质",
  "華健未來－Ｂ": "华健未来-B",
  "麥科醫藥－Ｂ": "麦科医药-B"
};

const SIGNAL_LABELS = {
  unknown: "未知",
  thin: "热度低",
  normal_active: "活跃",
  crowded: "拥挤",
  very_crowded: "很拥挤",
  extreme: "极端拥挤",
  insufficient_history: "历史不足",
  steady: "平稳",
  accelerating: "加速",
  closed: "已截止",
  closing_soon: "临近截止",
  decision_window: "决策窗口",
  early: "还早"
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmt(value) {
  return value === null || value === undefined || value === "" ? "--" : String(value);
}

function fmtHours(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(1)}h` : "--";
}

function fmtRate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(2)}x` : "--";
}

function companyLabel(ipoOrCode, lookup = new Map()) {
  const ipo = typeof ipoOrCode === "string" ? lookup.get(ipoOrCode) : ipoOrCode;
  const code = typeof ipoOrCode === "string" ? ipoOrCode : ipoOrCode?.securityCode;
  const rawName = String(ipo?.securityName || ipo?.securityNameEn || code || "").trim();
  return COMPANY_NAME_OVERRIDES[code] || COMPANY_NAME_OVERRIDES[rawName] || rawName || "--";
}

function buildIpoLookup(payload) {
  return new Map((payload.ipos || []).map((ipo) => [ipo.securityCode, ipo]));
}

function translateSignal(value) {
  return SIGNAL_LABELS[value] || value || "--";
}

function sourceStatusLabel(value) {
  if (value === "ok") return "正常";
  if (value === "error") return "异常";
  return value || "--";
}

function formatSignedHours(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return `${Math.abs(number).toFixed(1)}小时`;
}

function setEmpty(container, text) {
  container.innerHTML = "";
  const div = document.createElement("div");
  div.className = "empty";
  div.textContent = text;
  container.appendChild(div);
}

function bucketValue(ipo, bucket) {
  const value = ipo.cutoffBuckets?.[bucket]?.estimatedMarginMultiple;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function seriesPoints(ipo) {
  const points = [];
  for (const bucket of CHART_BUCKETS) {
    const value = bucketValue(ipo, bucket);
    if (value !== null) {
      points.push({ label: bucket, hours: BUCKET_HOURS[bucket], value });
    }
  }

  const currentValue = Number(ipo.currentSnapshot?.estimatedMarginMultiple);
  const currentHours = Number(ipo.hoursToCutoff ?? ipo.currentSnapshot?.hoursToCutoff);
  if (ipo.status === "active" && Number.isFinite(currentValue) && Number.isFinite(currentHours) && currentHours >= 0) {
    const duplicatesBucket = points.some((point) => Math.abs(point.hours - currentHours) < 0.25);
    if (!duplicatesBucket) {
      points.push({ label: `距截止${currentHours.toFixed(1)}h`, hours: currentHours, value: currentValue, current: true });
    }
  }

  return points.sort((a, b) => b.hours - a.hours);
}

function isHistoricalIpo(ipo) {
  return ipo.status !== "active" || Number(ipo.hoursToCutoff) < 0;
}

function ensureSeriesSelection(payload) {
  const activeCodes = (payload.ipos || []).filter((ipo) => ipo.status === "active").map((ipo) => ipo.securityCode);
  const historyCodes = (payload.ipos || []).filter(isHistoricalIpo).map((ipo) => ipo.securityCode);
  if (!state.selectedCurrentCodes) state.selectedCurrentCodes = new Set(activeCodes);
  if (!state.selectedHistoryCodes) state.selectedHistoryCodes = new Set(historyCodes);
  state.selectedCurrentCodes = new Set([...state.selectedCurrentCodes].filter((code) => activeCodes.includes(code)));
  state.selectedHistoryCodes = new Set([...state.selectedHistoryCodes].filter((code) => historyCodes.includes(code)));
  for (const code of historyCodes) {
    if (!state.selectedHistoryCodes.size) state.selectedHistoryCodes.add(code);
  }
}

function selectedSeries(payload) {
  const rows = [];
  let colorIndex = 0;
  for (const ipo of payload.ipos || []) {
    const isCurrentSelected = ipo.status === "active" && state.selectedCurrentCodes?.has(ipo.securityCode);
    const isHistorySelected = isHistoricalIpo(ipo) && state.selectedHistoryCodes?.has(ipo.securityCode);
    if (!isCurrentSelected && !isHistorySelected) continue;
    rows.push({
      code: ipo.securityCode,
      name: companyLabel(ipo),
      group: isCurrentSelected ? "当前机会" : "历史样本",
      color: SERIES_COLORS[colorIndex % SERIES_COLORS.length],
      points: seriesPoints(ipo)
    });
    colorIndex += 1;
  }
  return rows;
}

function renderSeriesOptions(containerId, rows, selectedSet, group) {
  const container = $(containerId);
  container.innerHTML = "";
  if (!rows.length) {
    container.textContent = group === "当前机会" ? "暂无可认购标的" : "暂无历史样本";
    return;
  }
  for (const ipo of rows) {
    const label = document.createElement("label");
    label.className = "series-choice";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = selectedSet.has(ipo.securityCode);
    input.addEventListener("change", () => {
      if (input.checked) selectedSet.add(ipo.securityCode);
      else selectedSet.delete(ipo.securityCode);
      renderRateChart(state.payload);
    });
    label.append(input, document.createTextNode(companyLabel(ipo)));
    container.appendChild(label);
  }
}

function renderSeriesSelectors(payload) {
  ensureSeriesSelection(payload);
  renderSeriesOptions(
    "currentSeriesOptions",
    (payload.ipos || []).filter((ipo) => ipo.status === "active"),
    state.selectedCurrentCodes,
    "当前机会"
  );
  renderSeriesOptions(
    "historySeriesOptions",
    (payload.ipos || []).filter(isHistoricalIpo),
    state.selectedHistoryCodes,
    "历史样本"
  );
}

function chartY(value, maxValue, top, height) {
  return top + height - (value / maxValue) * height;
}

function xForHours(hours, left, width) {
  const clampedHours = Math.max(0, Math.min(48, Number(hours)));
  return left + ((48 - clampedHours) / 48) * width;
}

function formatAxisRate(value) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(value));
}

function buildLinePath(points) {
  let path = "";
  let open = false;
  for (const point of points) {
    if (point.value === null) {
      open = false;
      continue;
    }
    path += `${open ? " L" : "M"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    open = true;
  }
  return path;
}

function renderRateChart(payload) {
  const svg = $("rateChart");
  const legend = $("chartLegend");
  svg.innerHTML = "";
  legend.innerHTML = "";
  const series = selectedSeries(payload);
  const values = series.flatMap((row) => row.points.map((point) => point.value)).filter((value) => Number.isFinite(value));
  if (!values.length) {
    svg.innerHTML = `<text x="460" y="160" text-anchor="middle" class="chart-empty">暂无可绘制的认购倍数</text>`;
    return;
  }

  const width = 920;
  const height = 320;
  const left = 58;
  const right = 24;
  const top = 22;
  const bottom = 46;
  const innerWidth = width - left - right;
  const innerHeight = height - top - bottom;
  const maxValue = Math.max(10, Math.ceil(Math.max(...values) * 1.12));
  const gridTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round(maxValue * ratio));

  for (const tick of gridTicks) {
    const y = chartY(tick, maxValue, top, innerHeight);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", left);
    line.setAttribute("x2", width - right);
    line.setAttribute("y1", y);
    line.setAttribute("y2", y);
    line.setAttribute("class", "chart-grid");
    svg.appendChild(line);

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", left - 10);
    text.setAttribute("y", y + 4);
    text.setAttribute("text-anchor", "end");
    text.setAttribute("class", "chart-axis");
    text.textContent = formatAxisRate(tick);
    svg.appendChild(text);
  }

  for (let index = 0; index < CHART_BUCKETS.length; index += 1) {
    const x = xForHours(BUCKET_HOURS[CHART_BUCKETS[index]], left, innerWidth);
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", x);
    text.setAttribute("y", height - 18);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("class", "chart-axis");
    text.textContent = CHART_BUCKETS[index];
    svg.appendChild(text);
  }

  for (const row of series) {
    const points = row.points.map((point) => ({
      ...point,
      x: xForHours(point.hours, left, innerWidth),
      y: chartY(point.value, maxValue, top, innerHeight)
    }));
    const pathData = buildLinePath(points);
    if (!pathData) continue;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    path.setAttribute("stroke", row.color);
    path.setAttribute("class", "chart-line");
    svg.appendChild(path);

    for (const point of points.filter((item) => item.value !== null)) {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", point.x);
      circle.setAttribute("cy", point.y);
      circle.setAttribute("r", 4);
      circle.setAttribute("fill", row.color);
      const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.textContent = `${row.name} ${point.label} ${fmtRate(point.value)}`;
      circle.appendChild(title);
      svg.appendChild(circle);
    }

    const item = document.createElement("span");
    item.className = "legend-item";
    item.innerHTML = `<i style="background:${row.color}"></i>${escapeHtml(row.name)}<em>${escapeHtml(row.group)}</em>`;
    legend.appendChild(item);
  }
}

function renderMetrics(payload) {
  const lookup = buildIpoLookup(payload);
  $("activeCount").textContent = payload.summary?.activeCount ?? "--";
  $("sourceStatus").textContent = sourceStatusLabel(payload.sourceStatus?.status);
  $("captureLine").textContent = payload.summary?.capturedAt ? `采集 ${payload.summary.capturedAt} · 非官方实时参考` : "本地数据 · 非官方实时参考 · Asia/Hong_Kong";
  const active = (payload.ipos || []).filter((ipo) => ipo.status === "active");
  const sortedByCutoff = [...active].sort((a, b) => Number(a.hoursToCutoff ?? Infinity) - Number(b.hoursToCutoff ?? Infinity));
  const sortedByRate = [...active].sort((a, b) => Number(b.currentSnapshot?.estimatedMarginMultiple ?? -1) - Number(a.currentSnapshot?.estimatedMarginMultiple ?? -1));
  $("nextCutoff").textContent = sortedByCutoff[0] ? `${companyLabel(sortedByCutoff[0], lookup)} ${fmtHours(sortedByCutoff[0].hoursToCutoff)}` : "--";
  $("hottestIpo").textContent = sortedByRate[0] ? `${companyLabel(sortedByRate[0], lookup)} ${fmtRate(sortedByRate[0].currentSnapshot?.estimatedMarginMultiple)}` : "--";
  $("activeHint").textContent = `${active.length} 只可认购`;
}

function renderCards(payload) {
  const cards = $("ipoCards");
  cards.innerHTML = "";
  const active = (payload.ipos || []).filter((ipo) => ipo.status === "active");
  if (!active.length) {
    setEmpty(cards, "暂无可认购 IPO");
    return;
  }
  for (const ipo of active) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `card ${state.selectedCode === ipo.securityCode ? "active" : ""}`;
    button.title = `${companyLabel(ipo)} ${ipo.securityCode || ""}`.trim();
    button.innerHTML = `
      <strong>${escapeHtml(companyLabel(ipo))}</strong>
      <div class="meta">
        实时参考倍数 ${escapeHtml(fmtRate(ipo.currentSnapshot?.estimatedMarginMultiple))}<br>
        距截止 ${escapeHtml(fmtHours(ipo.hoursToCutoff))}<br>
        <span class="tag ${escapeHtml(ipo.heatSignal)}">${escapeHtml(translateSignal(ipo.heatSignal))}</span>
        <span class="tag ${escapeHtml(ipo.momentumSignal)}">${escapeHtml(translateSignal(ipo.momentumSignal))}</span>
        <span class="tag ${escapeHtml(ipo.timingSignal)}">${escapeHtml(translateSignal(ipo.timingSignal))}</span>
      </div>
    `;
    button.addEventListener("click", () => {
      state.selectedCode = ipo.securityCode;
      render();
    });
    cards.appendChild(button);
  }
}

function formatCapitalWindow(row, lookup) {
  const fromName = companyLabel(row.fromCode, lookup);
  const toName = companyLabel(row.toCode, lookup);
  if (row.status === "reusable") {
    return `${fromName} 出结果后，资金可再申购 ${toName}，中间约有${formatSignedHours(row.availableHours)}缓冲。`;
  }
  if (row.status === "tight") {
    return `${fromName} 出结果后还能赶上 ${toName}，但只剩约${formatSignedHours(row.availableHours)}，时间很紧。`;
  }
  return `${fromName} 和 ${toName} 的错峰关系暂时无法判断。`;
}

function renderCapitalWindows(payload, selected) {
  const windows = $("capitalWindows");
  windows.innerHTML = "";
  const lookup = buildIpoLookup(payload);
  const related = (payload.capitalWindows || [])
    .filter((item) => item.status !== "blocked")
    .filter((item) => item.fromCode === selected.securityCode || item.toCode === selected.securityCode)
    .slice(0, 8);
  if (!related.length) {
    setEmpty(windows, "暂无错峰窗口");
    return;
  }
  for (const row of related) {
    const div = document.createElement("div");
    div.className = `window ${row.status}`;
    div.textContent = formatCapitalWindow(row, lookup);
    windows.appendChild(div);
  }
}

function formatAlert(alert, lookup) {
  const name = companyLabel(alert.securityCode, lookup);
  if (alert.alertType === "cutoff") {
    const bucket = String(alert.alertKey || "").split(":").pop();
    return `${alert.triggeredAt} ${name}：截止提醒（${bucket || "--"}）`;
  }
  if (alert.alertType === "heat") {
    const level = String(alert.alertKey || "").split(":").pop();
    return `${alert.triggeredAt} ${name}：热度达到${translateSignal(level)}`;
  }
  if (alert.alertType === "momentum") {
    return `${alert.triggeredAt} ${name}：热度正在加速`;
  }
  return `${alert.triggeredAt} ${name}：${alert.message || alert.alertType || "提醒"}`;
}

function renderAlerts(payload) {
  const alerts = $("alerts");
  alerts.innerHTML = "";
  const lookup = buildIpoLookup(payload);
  const rows = (payload.alerts || []).slice(0, 12);
  if (!rows.length) {
    setEmpty(alerts, "暂无本地提醒");
    return;
  }
  for (const alert of rows) {
    const div = document.createElement("div");
    div.className = "alert";
    div.textContent = formatAlert(alert, lookup);
    alerts.appendChild(div);
  }
}

function renderDetail(payload) {
  const selected = (payload.ipos || []).find((ipo) => ipo.securityCode === state.selectedCode) || (payload.ipos || [])[0];
  if (!selected) {
    $("detailTitle").textContent = "暂无 IPO 数据";
    $("detailSignal").textContent = "--";
    $("detailMeta").textContent = "";
    renderSeriesSelectors(payload);
    renderRateChart(payload);
    setEmpty($("capitalWindows"), "暂无错峰窗口");
    renderAlerts(payload);
    return;
  }
  state.selectedCode = selected.securityCode;
  $("detailTitle").textContent = companyLabel(selected);
  $("detailSignal").textContent = `${translateSignal(selected.heatSignal)} / ${translateSignal(selected.momentumSignal)}`;
  $("detailMeta").innerHTML = `
    <div>截止：${escapeHtml(fmt(selected.applyEndAt))}；结果日：${escapeHtml(fmt(selected.resultDate))}；上市：${escapeHtml(fmt(selected.listedDate))}</div>
    <div>入场费：${escapeHtml(fmt(selected.lowestFee))}；每手：${escapeHtml(fmt(selected.lotSize))}；招股书：${selected.prospectusUrl ? `<a href="${escapeHtml(selected.prospectusUrl)}" target="_blank" rel="noreferrer">打开</a>` : "--"}</div>
    <div>实时倍数为非官方参考值，数据源新鲜度：${escapeHtml(fmt(selected.sourceFreshness))}</div>
  `;

  renderSeriesSelectors(payload);
  renderRateChart(payload);
  renderCapitalWindows(payload, selected);
  renderAlerts(payload);
}

function render() {
  if (!state.payload) return;
  renderMetrics(state.payload);
  renderCards(state.payload);
  renderDetail(state.payload);
}

async function loadSnapshot(refresh = false) {
  $("refreshBtn").disabled = true;
  try {
    const response = await fetch(refresh ? "/api/refresh" : "/api/snapshot", { method: refresh ? "POST" : "GET" });
    state.payload = await response.json();
    if (!response.ok) throw new Error(state.payload.error || `HTTP ${response.status}`);
    if (!state.selectedCode && state.payload.ipos?.[0]) state.selectedCode = state.payload.ipos[0].securityCode;
    render();
  } catch (error) {
    state.payload = {
      summary: { activeCount: "--" },
      ipos: [],
      capitalWindows: [],
      alerts: [],
      sourceStatus: { status: "error" }
    };
    render();
    $("captureLine").textContent = error.message;
  } finally {
    $("refreshBtn").disabled = false;
  }
}

$("refreshBtn").addEventListener("click", () => loadSnapshot(true));
loadSnapshot(false);
