/* Firewatcher dashboard: live EFFIS layers + historical context chart. */
"use strict";

const EFFIS_WMS = "https://maps.effis.emergency.copernicus.eu/effis";

/* ---------- map ---------- */

function initMap() {
const map = L.map("map", {
  center: [39.9, -3.6],
  zoom: 6,
  minZoom: 4,
  maxZoom: 12,
  zoomControl: false,
});
L.control.zoom({ position: "bottomleft" }).addTo(map);

const darkMode = window.matchMedia("(prefers-color-scheme: dark)");

function basemapUrl(dark) {
  return `https://{s}.basemaps.cartocdn.com/${dark ? "dark_all" : "light_all"}/{z}/{x}/{y}{r}.png`;
}

const basemap = L.tileLayer(basemapUrl(darkMode.matches), {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: "abcd",
  maxZoom: 19,
}).addTo(map);

darkMode.addEventListener("change", (e) => basemap.setUrl(basemapUrl(e.matches)));

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

const today = new Date();

function effisLayer(layerName, extra = {}) {
  return L.tileLayer.wms(EFFIS_WMS, {
    layers: layerName,
    format: "image/png",
    transparent: true,
    version: "1.1.1",
    attribution: "&copy; European Union, Copernicus EMS &mdash; EFFIS",
    ...extra,
  });
}

// Layer names verified against the EFFIS WMS GetCapabilities (July 2026):
// fire danger is served as mf010.*, hotspots as all.hs/viirs.hs/modis.hs/
// noaa.hs, burnt areas as modis.ba.* aggregates. The hotspot and burnt-area
// layers render EMPTY tiles when a TIME parameter is sent — they must be
// requested without TIME and then show the current detections / season.
const fwiLayer = effisLayer("mf010.fwi", { opacity: 0.55 });
const hotspotLayer = effisLayer("all.hs");
const burntLayer = effisLayer("modis.ba.season");

fwiLayer.addTo(map);
hotspotLayer.addTo(map);
burntLayer.addTo(map);

/* ---------- layer controls ---------- */

function bindToggle(id, layer) {
  const box = document.getElementById(id);
  box.addEventListener("change", () => {
    if (box.checked) layer.addTo(map);
    else map.removeLayer(layer);
  });
}

bindToggle("lyr-fwi", fwiLayer);
bindToggle("lyr-hs", hotspotLayer);
bindToggle("lyr-ba", burntLayer);

const opacityInput = document.getElementById("fwi-opacity");
opacityInput.addEventListener("input", () => {
  fwiLayer.setOpacity(Number(opacityInput.value) / 100);
});

const dateInput = document.getElementById("fwi-date");
{
  const min = new Date(today);
  min.setDate(min.getDate() - 7);
  const max = new Date(today);
  max.setDate(max.getDate() + 7);
  dateInput.min = isoDate(min);
  dateInput.max = isoDate(max);
  dateInput.value = isoDate(today);
}
dateInput.addEventListener("change", () => {
  if (!dateInput.value) return;
  setFwiDate(fwiLayer, dateInput.value);
});

return { map, fwiLayer, hotspotLayer, burntLayer, dateInput };
}

// The mf010.fwi layer defaults to the current forecast when TIME is absent;
// send TIME only for an explicitly chosen non-today date.
function setFwiDate(layer, dateStr) {
  if (dateStr === isoDate(new Date())) {
    delete layer.wmsParams.time;
    layer.setParams({});
  } else {
    layer.setParams({ time: dateStr });
  }
}

/* ---------- today at a glance ---------- */

function initToday(ctx) {
  const now = new Date();
  document.getElementById("today-date").textContent = now.toLocaleDateString(
    "en-GB",
    { weekday: "long", day: "numeric", month: "long", year: "numeric" }
  );
  for (const el of document.querySelectorAll(".ts-year")) {
    el.textContent = String(now.getFullYear());
  }

  const panel = document.getElementById("panel");
  const toggle = document.getElementById("panel-toggle");
  toggle.addEventListener("click", () => {
    const hidden = panel.classList.toggle("hidden");
    toggle.classList.toggle("panel-hidden-state", hidden);
    toggle.setAttribute("aria-expanded", String(!hidden));
    toggle.textContent = hidden ? "☰" : "✕";
    toggle.title = hidden ? "Show panel" : "Hide panel";
  });

  for (const chip of document.querySelectorAll(".chip[data-view]")) {
    chip.addEventListener("click", () => {
      if (!ctx) return;
      const [lat, lon, zoom] = chip.dataset.view.split(",").map(Number);
      ctx.map.setView([lat, lon], zoom);
    });
  }

  document.getElementById("btn-today").addEventListener("click", () => {
    if (!ctx) return;
    for (const [id, layer] of [
      ["lyr-fwi", ctx.fwiLayer],
      ["lyr-hs", ctx.hotspotLayer],
      ["lyr-ba", ctx.burntLayer],
    ]) {
      document.getElementById(id).checked = true;
      layer.addTo(ctx.map);
    }
    ctx.dateInput.value = isoDate(new Date());
    setFwiDate(ctx.fwiLayer, ctx.dateInput.value);
    ctx.map.setView([39.9, -3.6], 6);
  });

  fetchSeasonStats();
}

// Live season totals from the EFFIS weekly statistics API (the service behind
// forest-fire.emergency.copernicus.eu/apps/effis.statistics). The response is
// {banfweekly: [{week, mddate: "YYYYMMDD", events, events_avg, area_ha,
// area_ha_avg, ...} x 52]} where area_ha/events are that week's mapped totals
// for the current year and *_avg is the 2006-onward climatology for the same
// week. Year-to-date figures are the sums over weeks that have already ended;
// entries with a future mddate are placeholders and must be ignored.
async function fetchSeasonStats() {
  const url =
    "https://api2.effis.emergency.copernicus.eu/statistics/v2/effis/weekly?country=ESP";
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const stats = sumWeeklyStats(await resp.json());
    if (stats) {
      renderSeasonStats(stats);
      return;
    }
  } catch (err) {
    console.error("EFFIS weekly stats unavailable:", err);
  }
  document.getElementById("today-fallback").hidden = false;
}

function sumWeeklyStats(data) {
  const weeks = data && data.banfweekly;
  if (!Array.isArray(weeks) || !weeks.length) return null;
  const todayKey = isoDate(new Date()).replaceAll("-", "");
  let ba = 0;
  let avg = 0;
  let nf = 0;
  let counted = 0;
  for (const w of weeks) {
    if (typeof w.mddate !== "string" || w.mddate > todayKey) continue;
    ba += Number(w.area_ha) || 0;
    avg += Number(w.area_ha_avg) || 0;
    nf += Number(w.events) || 0;
    counted++;
  }
  // Plausibility: some completed weeks, and totals within physical bounds.
  if (!counted || ba < 0 || ba > 1e7 || avg <= 0 || avg > 1e7) return null;
  return { ba, avg, nf };
}

function renderSeasonStats({ ba, avg, nf }) {
  const fmt = (n) => Math.round(n).toLocaleString("en");
  document.getElementById("ts-ba").textContent = fmt(ba);
  document.getElementById("ts-avg").textContent = avg === null ? "n/a" : fmt(avg);
  document.getElementById("ts-nf").textContent = nf === null ? "n/a" : fmt(nf);
  document.getElementById("today-stats").hidden = false;
}

/* ---------- historical chart ---------- */

// Annual burned area in Spain, thousand hectares (approximate).
// Source: EGIF / MITECO annual statistics; 2025 provisional (EFFIS mapping).
const BURNED_KHA = [
  ["2005", 188], ["2006", 155], ["2007", 86], ["2008", 50], ["2009", 120],
  ["2010", 55], ["2011", 102], ["2012", 218], ["2013", 61], ["2014", 47],
  ["2015", 110], ["2016", 66], ["2017", 178], ["2018", 25], ["2019", 83],
  ["2020", 66], ["2021", 85], ["2022", 306], ["2023", 91], ["2024", 71],
  ["2025", 380],
];
const PROVISIONAL = new Set(["2025"]);
const DIRECT_LABELS = new Set(["2022", "2025"]);

const tooltip = document.getElementById("tooltip");

function showTooltip(html, x, y) {
  tooltip.innerHTML = html;
  tooltip.hidden = false;
  const pad = 12;
  const r = tooltip.getBoundingClientRect();
  let left = x + pad;
  if (left + r.width > window.innerWidth - 8) left = x - r.width - pad;
  let top = y - r.height - pad;
  if (top < 8) top = y + pad;
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function hideTooltip() {
  tooltip.hidden = true;
}

function niceCeil(v) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const mult = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 4 ? 4 : n <= 5 ? 5 : n <= 8 ? 8 : 10;
  return mult * p;
}

// Renders a bar chart into host. points: {label, value, html, aria}[];
// opts: {direct: Set of labels to annotate, fmtTick, aria}.
function barChart(host, points, opts) {
  const { direct = new Set(), fmtTick = String, aria = "Bar chart" } = opts || {};
  host.innerHTML = "";
  if (!points.length) return;

  const W = 320;
  const H = 170;
  const m = { top: 16, right: 6, bottom: 20, left: 34 };
  const plotW = W - m.left - m.right;
  const plotH = H - m.top - m.bottom;
  const yMax = niceCeil(Math.max(...points.map((p) => p.value), 1));
  const n = points.length;
  const step = plotW / n;
  const barW = Math.max(2, Math.floor(step) - 2);

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", aria);

  const el = (name, attrs, parent) => {
    const node = document.createElementNS(svgNS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    (parent || svg).appendChild(node);
    return node;
  };

  const y = (v) => m.top + plotH * (1 - v / yMax);

  for (let i = 1; i <= 4; i++) {
    const v = (yMax / 4) * i;
    el("line", {
      class: "grid-line",
      x1: m.left, x2: W - m.right, y1: y(v), y2: y(v),
    });
    const label = el("text", {
      class: "tick-y",
      x: m.left - 4, y: y(v) + 3, "text-anchor": "end",
    });
    label.textContent = fmtTick(v);
  }

  el("line", {
    class: "baseline",
    x1: m.left, x2: W - m.right, y1: y(0), y2: y(0),
  });

  points.forEach((p, i) => {
    const x = m.left + i * step + 1;
    const top = y(p.value);
    const h = y(0) - top;
    const r = Math.min(2, h);
    const bar = el("path", {
      class: "bar",
      d: `M${x},${y(0)} v${-(h - r)} q0,${-r} ${r},${-r} h${barW - 2 * r} q${r},0 ${r},${r} v${h - r} z`,
    });

    if (direct.has(p.label)) {
      const label = el("text", {
        class: "direct-label",
        x: x + barW / 2, y: top - 4,
        "text-anchor": i === n - 1 ? "end" : i === 0 ? "start" : "middle",
      });
      label.textContent = fmtTick(p.value);
    }

    if (Number(p.label) % 5 === 0) {
      const tick = el("text", {
        x: x + barW / 2, y: H - 6, "text-anchor": "middle",
      });
      tick.textContent = p.label;
    }

    const hit = el("rect", {
      class: "bar-hit",
      x: m.left + i * step, y: m.top, width: step, height: plotH,
      tabindex: "0",
      "aria-label": p.aria,
    });
    hit.addEventListener("mousemove", (e) => {
      bar.classList.add("hover");
      showTooltip(p.html, e.clientX, e.clientY);
    });
    hit.addEventListener("mouseleave", () => {
      bar.classList.remove("hover");
      hideTooltip();
    });
    hit.addEventListener("focus", () => {
      const r2 = hit.getBoundingClientRect();
      showTooltip(p.html, r2.left + r2.width / 2, r2.top);
    });
    hit.addEventListener("blur", hideTooltip);
  });

  host.appendChild(svg);
}

function renderNationalChart() {
  const points = BURNED_KHA.map(([year, kha]) => {
    const note = PROVISIONAL.has(year) ? " · provisional (EFFIS)" : "";
    return {
      label: year,
      value: kha,
      html: `<span class="t-title">${year}</span><br><span class="t-value">≈ ${kha},000 ha burned${note}</span>`,
      aria: `${year}: about ${kha} thousand hectares${note}`,
    };
  });
  barChart(document.getElementById("chart"), points, {
    direct: DIRECT_LABELS,
    fmtTick: (v) => String(Math.round(v)),
    aria: "Bar chart of annual burned area in Spain, 2005 to 2025, in thousand hectares",
  });

  const tbody = document.querySelector("#chart-table-el tbody");
  for (const [year, kha] of BURNED_KHA) {
    const tr = document.createElement("tr");
    const suffix = PROVISIONAL.has(year) ? " (provisional)" : "";
    tr.innerHTML = `<td>${year}${suffix}</td><td>≈ ${(kha * 1000).toLocaleString("en")}</td>`;
    tbody.appendChild(tr);
  }
}

/* ---------- regional analytics (GWIS country-profile API) ---------- */

const CPROF_API = "https://cprof.effis.emergency.copernicus.eu/api/v3";

// GADM admin-1 regions for Spain as served by the GWIS country-profile API
// (subcountries?admin0=ESP), with approximate map bounds [S, W, N, E].
const REGIONS = [
  ["ESP.1_1", "Andalucía", [36.0, -7.6, 38.8, -1.6]],
  ["ESP.2_1", "Aragón", [39.8, -2.2, 42.9, 0.8]],
  ["ESP.3_1", "Cantabria", [42.7, -4.9, 43.6, -3.1]],
  ["ESP.4_1", "Castilla-La Mancha", [38.0, -5.4, 41.4, -0.9]],
  ["ESP.5_1", "Castilla y León", [40.1, -7.2, 43.3, -1.8]],
  ["ESP.6_1", "Cataluña", [40.5, 0.1, 42.9, 3.4]],
  ["ESP.7_1", "Ceuta y Melilla", [35.1, -5.5, 35.6, -2.9]],
  ["ESP.8_1", "Comunidad de Madrid", [39.9, -4.6, 41.2, -3.0]],
  ["ESP.9_1", "Comunidad Foral de Navarra", [41.9, -2.5, 43.3, -0.7]],
  ["ESP.10_1", "Comunidad Valenciana", [37.8, -1.6, 40.8, 0.7]],
  ["ESP.11_1", "Extremadura", [37.9, -7.5, 40.5, -4.6]],
  ["ESP.12_1", "Galicia", [41.8, -9.4, 43.8, -6.7]],
  ["ESP.13_1", "Islas Baleares", [38.6, 1.1, 40.1, 4.4]],
  ["ESP.14_1", "Islas Canarias", [27.5, -18.3, 29.5, -13.3]],
  ["ESP.15_1", "La Rioja", [41.9, -3.2, 42.7, -1.6]],
  ["ESP.16_1", "País Vasco", [42.4, -3.5, 43.5, -1.7]],
  ["ESP.17_1", "Principado de Asturias", [42.9, -7.2, 43.7, -4.5]],
  ["ESP.18_1", "Región de Murcia", [37.3, -2.4, 38.8, -0.6]],
];

function initRegions(ctx) {
  const sel = document.getElementById("region-select");
  for (const [gid, name] of REGIONS) {
    const opt = document.createElement("option");
    opt.value = gid;
    opt.textContent = name;
    sel.appendChild(opt);
  }
  for (const el of document.querySelectorAll(".rs-year")) {
    el.textContent = String(today.getFullYear());
  }
  document.getElementById("rs-prev").textContent = String(today.getFullYear() - 1);
  sel.addEventListener("change", () => selectRegion(ctx, sel.value));
  selectRegion(null, "ESP");
}

async function selectRegion(ctx, gid) {
  const region = REGIONS.find((r) => r[0] === gid);
  if (ctx && region) {
    const [s, w, n, e] = region[2];
    ctx.map.fitBounds([[s, w], [n, e]], { padding: [20, 20] });
  } else if (ctx && gid === "ESP") {
    ctx.map.setView([39.9, -3.6], 6);
  }

  const stats = document.getElementById("region-stats");
  const fallback = document.getElementById("region-fallback");
  const year = today.getFullYear();
  const level = gid === "ESP" ? "ADM0" : "ADM1";
  const url = `${CPROF_API}/banf?level=${level}&value=${gid}&year=${year}&yearFrom=2006&yearTo=${year}&env=PROD`;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const years = (data.banfyear || []).filter(
      (d) => Number.isFinite(d.year) && Number.isFinite(d.ba_area_ha)
    );
    if (!years.length) throw new Error("empty banfyear");
    renderRegionStats(years, year);
    renderRegionChart(years, region ? region[1] : "Spain");
    stats.hidden = false;
    fallback.hidden = true;
  } catch (err) {
    console.error("regional stats unavailable:", err);
    stats.hidden = true;
    document.getElementById("region-chart").innerHTML = "";
    fallback.hidden = false;
  }
}

function renderRegionStats(years, currentYear) {
  const fmt = (v) => Math.round(v).toLocaleString("en");
  const current = years.find((d) => d.year === currentYear);
  const past = years.filter((d) => d.year < currentYear);
  const avgBa = past.length
    ? past.reduce((a, d) => a + d.ba_area_ha, 0) / past.length
    : null;
  document.getElementById("rs-ba").textContent = current ? fmt(current.ba_area_ha) : "0";
  document.getElementById("rs-avg").textContent = avgBa === null ? "n/a" : fmt(avgBa);
  document.getElementById("rs-nf").textContent = current ? fmt(current.ba_count || 0) : "0";
  document.getElementById("rs-size").textContent =
    current && current.firesize ? fmt(current.firesize) : "–";
}

function renderRegionChart(years, name) {
  const maxVal = Math.max(...years.map((d) => d.ba_area_ha));
  const peak = years.find((d) => d.ba_area_ha === maxVal);
  const fmtTick = (v) =>
    v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v));
  const points = years.map((d) => ({
    label: String(d.year),
    value: d.ba_area_ha,
    html: `<span class="t-title">${d.year}</span><br><span class="t-value">${Math.round(d.ba_area_ha).toLocaleString("en")} ha burned · ${d.ba_count || 0} fires</span>`,
    aria: `${d.year}: ${Math.round(d.ba_area_ha).toLocaleString("en")} hectares, ${d.ba_count || 0} fires`,
  }));
  barChart(document.getElementById("region-chart"), points, {
    direct: peak ? new Set([String(peak.year)]) : new Set(),
    fmtTick,
    aria: `Bar chart of annual satellite-mapped burned area in ${name}, 2006 to ${years[years.length - 1].year}, in hectares`,
  });
}

renderNationalChart();

let mapCtx = null;
try {
  mapCtx = initMap();
} catch (err) {
  console.error("map failed to initialise:", err);
}
initToday(mapCtx);
initRegions(mapCtx);
