/* Firewatcher dashboard: live EFFIS layers + historical context chart. */
"use strict";

const EFFIS_WMS = "https://maps.effis.emergency.copernicus.eu/effis";

/* ---------- map ---------- */

function initMap() {
const map = L.map("map", {
  center: [39.9, -3.6],
  zoom: 6,
  minZoom: 5,
  maxZoom: 12,
  zoomControl: true,
});

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

const fwiLayer = effisLayer("ecmwf007.fwi", {
  opacity: 0.55,
  time: isoDate(today),
});
const hotspotLayer = effisLayer("viirs.hs", { time: isoDate(today) });
const burntLayer = effisLayer("modis.ba", { time: isoDate(today) });

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
  fwiLayer.setParams({ time: dateInput.value });
});
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

function renderChart() {
  const host = document.getElementById("chart");
  const W = 320;
  const H = 170;
  const m = { top: 16, right: 6, bottom: 20, left: 30 };
  const plotW = W - m.left - m.right;
  const plotH = H - m.top - m.bottom;
  const yMax = 400;
  const n = BURNED_KHA.length;
  const step = plotW / n;
  const barW = Math.floor(step) - 2;

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-label",
    "Bar chart of annual burned area in Spain, 2005 to 2025, in thousand hectares"
  );

  const el = (name, attrs, parent) => {
    const node = document.createElementNS(svgNS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    (parent || svg).appendChild(node);
    return node;
  };

  const y = (v) => m.top + plotH * (1 - v / yMax);

  for (const tickVal of [100, 200, 300, 400]) {
    el("line", {
      class: "grid-line",
      x1: m.left, x2: W - m.right, y1: y(tickVal), y2: y(tickVal),
    });
    const label = el("text", {
      class: "tick-y",
      x: m.left - 4, y: y(tickVal) + 3, "text-anchor": "end",
    });
    label.textContent = String(tickVal);
  }

  el("line", {
    class: "baseline",
    x1: m.left, x2: W - m.right, y1: y(0), y2: y(0),
  });

  BURNED_KHA.forEach(([year, kha], i) => {
    const x = m.left + i * step + 1;
    const top = y(kha);
    const h = y(0) - top;
    const r = Math.min(2, h);
    const bar = el("path", {
      class: "bar",
      d: `M${x},${y(0)} v${-(h - r)} q0,${-r} ${r},${-r} h${barW - 2 * r} q${r},0 ${r},${r} v${h - r} z`,
    });

    if (DIRECT_LABELS.has(year)) {
      const label = el("text", {
        class: "direct-label",
        x: x + barW / 2, y: top - 4, "text-anchor": i === n - 1 ? "end" : "middle",
      });
      label.textContent = String(kha);
    }

    if (year.endsWith("0") || year.endsWith("5")) {
      const tick = el("text", {
        x: x + barW / 2, y: H - 6, "text-anchor": "middle",
      });
      tick.textContent = year;
    }

    const note = PROVISIONAL.has(year) ? " · provisional (EFFIS)" : "";
    const hit = el("rect", {
      class: "bar-hit",
      x: m.left + i * step, y: m.top, width: step, height: plotH,
      tabindex: "0",
      "aria-label": `${year}: about ${kha} thousand hectares${note}`,
    });
    const html = `<span class="t-title">${year}</span><br><span class="t-value">≈ ${kha},000 ha burned${note}</span>`;
    hit.addEventListener("mousemove", (e) => {
      bar.classList.add("hover");
      showTooltip(html, e.clientX, e.clientY);
    });
    hit.addEventListener("mouseleave", () => {
      bar.classList.remove("hover");
      hideTooltip();
    });
    hit.addEventListener("focus", () => {
      const r2 = hit.getBoundingClientRect();
      showTooltip(html, r2.left + r2.width / 2, r2.top);
    });
    hit.addEventListener("blur", hideTooltip);
  });

  host.appendChild(svg);

  const tbody = document.querySelector("#chart-table-el tbody");
  for (const [year, kha] of BURNED_KHA) {
    const tr = document.createElement("tr");
    const suffix = PROVISIONAL.has(year) ? " (provisional)" : "";
    tr.innerHTML = `<td>${year}${suffix}</td><td>≈ ${(kha * 1000).toLocaleString("en")}</td>`;
    tbody.appendChild(tr);
  }
}

renderChart();

try {
  initMap();
} catch (err) {
  console.error("map failed to initialise:", err);
}
