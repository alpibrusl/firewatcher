/* Firewatcher dashboard: live EFFIS layers + historical context chart. */
"use strict";

const EFFIS_WMS = "https://maps.effis.emergency.copernicus.eu/effis";

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

const today = new Date();

/* ---------- i18n ---------- */

const I18N = {
  en: {
    title: "Firewatcher — Spain Wildfire Risk Dashboard",
    mapAria: "Map with live wildfire layers",
    brandSub: "Spain wildfire dashboard",
    hidePanel: "Hide panel",
    showPanel: "Show panel",
    todayTitle: "Today at a glance",
    tsBaLabel: "ha burnt in {year} (EFFIS-mapped)",
    tsAvgLabel: "avg. at this point of year, 2006–25",
    tsNfLabel: "fires ≥ ~30 ha mapped in {year}",
    todayFallback:
      'Live season totals unavailable — see the <a href="https://forest-fire.emergency.copernicus.eu/apps/effis.statistics/seasonaltrend">EFFIS statistics portal</a> or <a href="https://forest-fire.emergency.copernicus.eu/apps/effis.csv/">situation viewer</a>.',
    chipSpain: "Spain",
    chipIberia: "Iberia &amp; Maghreb",
    btnToday: "↺ Reset to today",
    layersTitle: "Live layers",
    fwiName: "Fire danger forecast <small>FWI</small>",
    fwiOpacityAria: "Fire danger layer opacity",
    dateLabel: "Date",
    legendNote: "Very low → extreme · FWI classes per EFFIS",
    hsName: "Active fire detections <small>VIIRS · MODIS · NOAA</small>",
    hsLegTitle:
      "Colour = detection age · shape = satellite (&#9660;&#9650; MODIS, &#9632;&#9670; VIIRS)",
    hsLeg1: "&le; 6 h (MODIS)",
    hsLeg2: "6&ndash;12 h (MODIS) &middot; &le; 7 days (VIIRS)",
    hsLeg3: "&le; 24 h",
    hsLeg4: "7&ndash;30 days ago",
    hsLeg5: "earlier this season",
    baName: "Burnt areas <small>current season</small>",
    baLegTitle: "Perimeter colour = when the area was mapped",
    baLeg1: "last day",
    baLeg2: "last 7 days",
    baLeg3: "last 30 days",
    baLeg4: "whole season",
    layersNote:
      "Layers cover the EFFIS domain — Europe, Middle East and North Africa; pan freely. Detections/perimeters have a ~30 ha mapping floor and can lag. Analytical view, not an emergency service.",
    regionTitle: "Regional analytics",
    regionMuted: "GWIS · MODIS burned area",
    regionSelectAria: "Choose a region",
    regionNational: "España — national",
    rsBaLabel: "ha burnt so far in {year}",
    rsAvgLabel: "ha burnt in an average year (2006–{prev})",
    rsNfLabel: 'fires mapped in {year} · avg size <span id="rs-size">–</span> ha',
    regionChartAria: "Burned area per year for the selected region",
    regionFallback: "Regional statistics are unavailable right now — try again later.",
    rsPending:
      "The {year} annual figure isn't consolidated in GWIS yet — see \u201cToday at a glance\u201d for near-real-time season totals.",
    regionNote:
      "Satellite-mapped burned area (MODIS, ≳30 ha) from the GWIS country profiles, aggregated to GADM regions. Figures differ from the national EGIF statistic; this dataset publishes comunidades, not provincias. Selecting a region also zooms the map.",
    olTitle: "Season outlook (experimental model)",
    olRangeLabel: "ha predicted for {year} (80 % range)",
    olPointLabel: "central estimate, ha",
    olInputsPartial: "Inputs: {year} climate with the summer observed to date — the range narrows as the season closes.",
    olInputsFull: "Inputs: complete {year} seasonal climate.",
    olQuality: "Quality: leave-one-year-out R² = {r2} on the log scale; typical error ×{factor}.",
    olMonthLabel: "ha predicted for {month} (80 % range; monthly model with lags, summer R² = {r2})",
    olNote:
      'Ridge regression on comunidad-year data (2007 onwards): regional seasonal climate, recent burn history and region effects, validated leave-one-year-out. <span id="ol-quality"></span> Experimental — wide ranges are honest for fire data; this is context, not an operational forecast.',
    lsTitle: "Sheep &amp; goat herd",
    lsDelta: "{pct} % since {from} (to {to})",
    lsTooltip: "≈ {n} head",
    lsChartAria: "Sheep and goat herd per year for the selected region, thousand head",
    lsNote:
      "Extensive sheep and goat grazing removes fine fuel from the landscape; the herd's decline is one hypothesis behind worsening fire seasons. Source: Eurostat (tgs00045 regional from 2014; apro_mt_ls* national from 2005), thousand head.",
    climateTitle: "Climate &amp; fire",
    climateChipsAria: "Choose a climate variable",
    cmSpring: "Spring rain",
    cmPre: "Oct–May rain",
    cmTmax: "Summer max temp",
    cmWind: "Summer wind",
    climateChartAria:
      "Scatter plot of the chosen climate variable against annual burned area in Spain",
    climateNote:
      "Each dot is a year (2005 onwards): the chosen seasonal climate signal against that year's burned area. Climate: ERA5 reanalysis averaged over 15 peninsular points (Open-Meteo). Correlation is not causation — use as context, not prediction.",
    rLine: "{metric} vs. burned area over {n} years: r = {r} — {desc}.",
    rNone: "no clear linear relationship",
    rWeak: "weak",
    rModerate: "moderate",
    rStrong: "strong",
    rDesc: "{strength} tendency — {dir}",
    rPos: "years with higher values burned more",
    rNeg: "years with higher values burned less",
    chartTitle: "Burned area per year",
    chartMuted: "Spain · kha",
    chartNote: "Approx. totals per EGIF/MITECO; 2025 provisional (EFFIS).",
    viewTable: "View as table",
    thYear: "Year",
    thBa: "Burned area (ha, approx.)",
    aboutTitle: "About Firewatcher",
    aboutBody:
      "An open-data wildfire dashboard for Spain: live fire danger, satellite fire detections and burnt areas from the Copernicus EFFIS services, with historical context from the national fire statistics.",
    attribution:
      'Fire danger, detections and burnt areas: © European Union, Copernicus Emergency Management Service — EFFIS. Contains modified Copernicus EMS information 2026. Historical statistics: MITECO / EGIF (approximate). Basemap: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, © <a href="https://carto.com/attributions">CARTO</a>.',
    provisionalNote: " · provisional (EFFIS)",
    natTooltip: "≈ {n} ha burned{note}",
    natBarAria: "{year}: about {n} thousand hectares{note}",
    natChartAria:
      "Bar chart of annual burned area in Spain, 2005 to 2025, in thousand hectares",
    provisionalRow: " (provisional)",
    regTooltip: "{n} ha burned · {k} fires",
    regBarAria: "{year}: {n} hectares, {k} fires",
    regChartAria:
      "Bar chart of annual satellite-mapped burned area in {name}, 2006 to {last}, in hectares",
    langButton: "ES",
    langButtonTitle: "Cambiar a español",
    dateLocale: "en-GB",
    numLocale: "en",
  },
  es: {
    title: "Firewatcher — Panel de riesgo de incendios de España",
    mapAria: "Mapa con capas de incendios en directo",
    brandSub: "Panel de incendios forestales de España",
    hidePanel: "Ocultar panel",
    showPanel: "Mostrar panel",
    todayTitle: "Hoy de un vistazo",
    tsBaLabel: "ha quemadas en {year} (cartografía EFFIS)",
    tsAvgLabel: "media a estas alturas del año, 2006–25",
    tsNfLabel: "incendios ≥ ~30 ha cartografiados en {year}",
    todayFallback:
      'Totales de la temporada no disponibles — consulta el <a href="https://forest-fire.emergency.copernicus.eu/apps/effis.statistics/seasonaltrend">portal de estadísticas EFFIS</a> o el <a href="https://forest-fire.emergency.copernicus.eu/apps/effis.csv/">visor de situación</a>.',
    chipSpain: "España",
    chipIberia: "Iberia y Magreb",
    btnToday: "↺ Volver a hoy",
    layersTitle: "Capas en directo",
    fwiName: "Previsión de peligro de incendio <small>FWI</small>",
    fwiOpacityAria: "Opacidad de la capa de peligro",
    dateLabel: "Fecha",
    legendNote: "Muy bajo → extremo · clases FWI según EFFIS",
    hsName: "Detecciones de fuego activo <small>VIIRS · MODIS · NOAA</small>",
    hsLegTitle:
      "Color = antigüedad de la detección · forma = satélite (&#9660;&#9650; MODIS, &#9632;&#9670; VIIRS)",
    hsLeg1: "&le; 6 h (MODIS)",
    hsLeg2: "6&ndash;12 h (MODIS) &middot; &le; 7 días (VIIRS)",
    hsLeg3: "&le; 24 h",
    hsLeg4: "hace 7&ndash;30 días",
    hsLeg5: "antes en la temporada",
    baName: "Áreas quemadas <small>temporada actual</small>",
    baLegTitle: "Color del perímetro = cuándo se cartografió",
    baLeg1: "último día",
    baLeg2: "últimos 7 días",
    baLeg3: "últimos 30 días",
    baLeg4: "toda la temporada",
    layersNote:
      "Las capas cubren el dominio EFFIS — Europa, Oriente Medio y norte de África; muévete libremente. Las detecciones y perímetros tienen un umbral de cartografiado de ~30 ha y pueden ir con retraso. Vista analítica, no un servicio de emergencias.",
    regionTitle: "Analítica regional",
    regionMuted: "GWIS · área quemada MODIS",
    regionSelectAria: "Elige una región",
    regionNational: "España — nacional",
    rsBaLabel: "ha quemadas en lo que va de {year}",
    rsAvgLabel: "ha quemadas en un año medio (2006–{prev})",
    rsNfLabel:
      'incendios cartografiados en {year} · tamaño medio <span id="rs-size">–</span> ha',
    regionChartAria: "Superficie quemada por año en la región seleccionada",
    regionFallback:
      "Las estadísticas regionales no están disponibles ahora mismo; inténtalo de nuevo más tarde.",
    rsPending:
      "El dato anual de {year} aún no está consolidado en GWIS — consulta «Hoy de un vistazo» para los totales casi en tiempo real de la temporada.",
    regionNote:
      "Superficie quemada cartografiada por satélite (MODIS, ≳30 ha) de los perfiles de país de GWIS, agregada a regiones GADM. Las cifras difieren de la estadística nacional EGIF; esta fuente publica comunidades, no provincias. Al elegir una región, el mapa también hace zoom.",
    olTitle: "Previsión de temporada (modelo experimental)",
    olRangeLabel: "ha previstas para {year} (rango del 80 %)",
    olPointLabel: "estimación central, ha",
    olInputsPartial: "Entradas: clima de {year} con el verano observado hasta la fecha — el rango se estrecha al cerrar la temporada.",
    olInputsFull: "Entradas: clima estacional completo de {year}.",
    olQuality: "Calidad: R² = {r2} en escala logarítmica con validación dejando fuera cada año; error típico ×{factor}.",
    olMonthLabel: "ha previstas para {month} (rango 80 %; modelo mensual con lags, R² de verano = {r2})",
    olNote:
      'Regresión ridge sobre datos comunidad-año (desde 2007): clima estacional regional, historial reciente de incendios y efectos regionales, validada dejando fuera un año cada vez. <span id="ol-quality"></span> Experimental — los rangos anchos son lo honesto con datos de incendios; es contexto, no una predicción operativa.',
    lsTitle: "Cabaña ovina y caprina",
    lsDelta: "{pct} % desde {from} (hasta {to})",
    lsTooltip: "≈ {n} cabezas",
    lsChartAria: "Cabaña ovina y caprina por año en la región seleccionada, en miles de cabezas",
    lsNote:
      "El pastoreo extensivo de ovino y caprino retira combustible fino del monte; el declive de la cabaña es una de las hipótesis del empeoramiento de los incendios. Fuente: Eurostat (tgs00045 regional desde 2014; apro_mt_ls* nacional desde 2005), miles de cabezas.",
    climateTitle: "Clima y fuego",
    climateChipsAria: "Elige una variable climática",
    cmSpring: "Lluvia de primavera",
    cmPre: "Lluvia oct–may",
    cmTmax: "Temp. máx. verano",
    cmWind: "Viento de verano",
    climateChartAria:
      "Diagrama de dispersión de la variable climática elegida frente a la superficie anual quemada en España",
    climateNote:
      "Cada punto es un año (desde 2005): la señal climática estacional elegida frente a la superficie quemada de ese año. Clima: reanálisis ERA5 promediado en 15 puntos peninsulares (Open-Meteo). Correlación no es causalidad — es contexto, no predicción.",
    rLine: "{metric} frente a superficie quemada en {n} años: r = {r} — {desc}.",
    rNone: "sin relación lineal clara",
    rWeak: "débil",
    rModerate: "moderada",
    rStrong: "fuerte",
    rDesc: "tendencia {strength} — {dir}",
    rPos: "los años con valores más altos quemaron más",
    rNeg: "los años con valores más altos quemaron menos",
    chartTitle: "Superficie quemada por año",
    chartMuted: "España · kha",
    chartNote: "Totales aproximados según EGIF/MITECO; 2025 provisional (EFFIS).",
    viewTable: "Ver como tabla",
    thYear: "Año",
    thBa: "Superficie quemada (ha, aprox.)",
    aboutTitle: "Acerca de Firewatcher",
    aboutBody:
      "Un panel de datos abiertos sobre incendios forestales en España: peligro de incendio en directo, detecciones por satélite y áreas quemadas de los servicios Copernicus EFFIS, con contexto histórico de la estadística nacional de incendios.",
    attribution:
      'Peligro de incendio, detecciones y áreas quemadas: © Unión Europea, Servicio de Gestión de Emergencias de Copernicus — EFFIS. Contiene información modificada de Copernicus EMS 2026. Estadísticas históricas: MITECO / EGIF (aproximadas). Mapa base: © colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, © <a href="https://carto.com/attributions">CARTO</a>.',
    provisionalNote: " · provisional (EFFIS)",
    natTooltip: "≈ {n} ha quemadas{note}",
    natBarAria: "{year}: unas {n} mil hectáreas{note}",
    natChartAria:
      "Gráfico de barras de la superficie anual quemada en España, 2005 a 2025, en miles de hectáreas",
    provisionalRow: " (provisional)",
    regTooltip: "{n} ha quemadas · {k} incendios",
    regBarAria: "{year}: {n} hectáreas, {k} incendios",
    regChartAria:
      "Gráfico de barras de la superficie anual quemada cartografiada por satélite en {name}, 2006 a {last}, en hectáreas",
    langButton: "EN",
    langButtonTitle: "Switch to English",
    dateLocale: "es-ES",
    numLocale: "es-ES",
  },
};

let lang = (() => {
  const saved = localStorage.getItem("fw-lang");
  if (saved === "en" || saved === "es") return saved;
  return String(navigator.language || "").toLowerCase().startsWith("es") ? "es" : "en";
})();

function t(key, vars) {
  let s = (I18N[lang] && I18N[lang][key]) ?? I18N.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  }
  return s;
}

function fmtNum(n) {
  return Math.round(n).toLocaleString(t("numLocale"));
}

// Re-applies every translatable string, then re-renders everything built from
// cached data (charts, tables, stats) so tooltips and number formats follow.
function applyLang() {
  document.documentElement.lang = lang;
  document.title = t("title");
  const vars = { year: today.getFullYear(), prev: today.getFullYear() - 1 };
  for (const el of document.querySelectorAll("[data-i18n]")) {
    el.innerHTML = t(el.dataset.i18n, vars);
  }
  for (const el of document.querySelectorAll("[data-i18n-aria]")) {
    el.setAttribute("aria-label", t(el.dataset.i18nAria, vars));
  }
  const langBtn = document.getElementById("lang-toggle");
  langBtn.textContent = t("langButton");
  langBtn.title = t("langButtonTitle");

  const panelHidden = document.getElementById("panel").classList.contains("hidden");
  document.getElementById("panel-toggle").title = panelHidden ? t("showPanel") : t("hidePanel");

  document.getElementById("today-date").textContent = today.toLocaleDateString(
    t("dateLocale"),
    { weekday: "long", day: "numeric", month: "long", year: "numeric" }
  );
  document.querySelector('#region-select option[value="ESP"]').textContent =
    t("regionNational");

  renderNationalChart();
  if (seasonCache) renderSeasonStats(seasonCache);
  if (regionCache) {
    renderRegionStats(regionCache.years, today.getFullYear());
    renderRegionChart(regionCache.years, regionCache.name);
  }
  if (climateData) renderClimate();
  if (livestockGid) renderLivestock(livestockGid);
  if (outlookGid) renderOutlook(outlookGid);
}

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

// The EFFIS WMS renders every tile on demand (no CDN cache), so each request
// costs real server time. Wait for the zoom/pan to settle before requesting
// (updateWhenIdle / updateWhenZooming) and keep a generous buffer of stale
// tiles on screen so the map never blanks out while replacements render.
// Tile size is per layer: measured render times differ wildly (the FWI
// raster takes 10-30s at 512px vs under 3s at 256px, while the vector-drawn
// detection layers are cheap at 512px).
function effisLayer(layerName, extra = {}) {
  return L.tileLayer.wms(EFFIS_WMS, {
    layers: layerName,
    format: "image/png",
    transparent: true,
    version: "1.1.1",
    attribution: "&copy; European Union, Copernicus EMS &mdash; EFFIS",
    updateWhenIdle: true,
    updateWhenZooming: false,
    keepBuffer: 6,
    ...extra,
  });
}

// Layer names verified against the EFFIS WMS GetCapabilities (July 2026):
// fire danger is served as mf010.*, hotspots as all.hs/viirs.hs/modis.hs/
// noaa.hs, burnt areas as modis.ba.* aggregates. The hotspot and burnt-area
// layers render EMPTY tiles when a TIME parameter is sent — they must be
// requested without TIME and then show the current detections / season.
// Fire danger keeps its own layer (it has independent opacity and TIME), but
// the FWI raster is ~10 km resolution, so past zoom 8 Leaflet upscales the
// cached tiles instead of re-requesting — deep zooms cost zero FWI requests.
const fwiLayer = effisLayer("mf010.fwi", { opacity: 0.55, maxNativeZoom: 8 });

// Hotspots and burnt areas share one combined WMS request per tile (WMS
// composites comma-separated layers server-side, burnt areas drawn under
// hotspots) at 512px — a quarter of the tiles, halved again by combining.
const DETECTION_LAYERS = { ba: "modis.ba.season", hs: "all.hs" };
const detectionState = { ba: true, hs: true };
const detectionLayer = effisLayer(`${DETECTION_LAYERS.ba},${DETECTION_LAYERS.hs}`, {
  tileSize: 512,
});

function syncDetectionLayer() {
  const layers = ["ba", "hs"]
    .filter((k) => detectionState[k])
    .map((k) => DETECTION_LAYERS[k])
    .join(",");
  if (!layers) {
    map.removeLayer(detectionLayer);
    return;
  }
  if (detectionLayer.wmsParams.layers !== layers) {
    detectionLayer.setParams({ layers });
  }
  if (!map.hasLayer(detectionLayer)) detectionLayer.addTo(map);
}

fwiLayer.addTo(map);
detectionLayer.addTo(map);

/* ---------- layer controls ---------- */

document.getElementById("lyr-fwi").addEventListener("change", (e) => {
  if (e.target.checked) fwiLayer.addTo(map);
  else map.removeLayer(fwiLayer);
});
for (const [id, key] of [["lyr-hs", "hs"], ["lyr-ba", "ba"]]) {
  document.getElementById(id).addEventListener("change", (e) => {
    detectionState[key] = e.target.checked;
    syncDetectionLayer();
  });
}

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

function showAllLayers() {
  for (const id of ["lyr-fwi", "lyr-hs", "lyr-ba"]) {
    document.getElementById(id).checked = true;
  }
  fwiLayer.addTo(map);
  detectionState.ba = true;
  detectionState.hs = true;
  syncDetectionLayer();
}

return { map, fwiLayer, dateInput, showAllLayers };
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
  const panel = document.getElementById("panel");
  const toggle = document.getElementById("panel-toggle");
  toggle.addEventListener("click", () => {
    const hidden = panel.classList.toggle("hidden");
    toggle.classList.toggle("panel-hidden-state", hidden);
    toggle.setAttribute("aria-expanded", String(!hidden));
    toggle.textContent = hidden ? "☰" : "✕";
    toggle.title = hidden ? t("showPanel") : t("hidePanel");
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
    ctx.showAllLayers();
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
let seasonCache = null;

async function fetchJSON(url, timeout = 10000) {
  const resp = await fetch(url, { signal: AbortSignal.timeout(timeout) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

// Data flow: a scheduled ETL (scripts/etl.py) commits same-origin snapshots
// under data/, which load fast and survive Copernicus API outages. Each
// fetcher falls back to the live API when the snapshot is missing or stale.
async function fetchSeasonStats() {
  const sources = [
    () => fetchJSON("data/effis-weekly-esp.json", 8000),
    () =>
      fetchJSON(
        "https://api2.effis.emergency.copernicus.eu/statistics/v2/effis/weekly?country=ESP"
      ),
  ];
  for (const source of sources) {
    try {
      const stats = sumWeeklyStats(await source());
      if (stats) {
        seasonCache = stats;
        renderSeasonStats(stats);
        return;
      }
    } catch (err) {
      console.error("EFFIS weekly stats source failed:", err);
    }
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
  document.getElementById("ts-ba").textContent = fmtNum(ba);
  document.getElementById("ts-avg").textContent = avg === null ? "n/a" : fmtNum(avg);
  document.getElementById("ts-nf").textContent = nf === null ? "n/a" : fmtNum(nf);
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
    const note = PROVISIONAL.has(year) ? t("provisionalNote") : "";
    const nhtml = t("natTooltip", { n: fmtNum(kha * 1000), note });
    return {
      label: year,
      value: kha,
      html: `<span class="t-title">${year}</span><br><span class="t-value">${nhtml}</span>`,
      aria: t("natBarAria", { year, n: kha, note }),
    };
  });
  barChart(document.getElementById("chart"), points, {
    direct: DIRECT_LABELS,
    fmtTick: (v) => String(Math.round(v)),
    aria: t("natChartAria"),
  });

  const tbody = document.querySelector("#chart-table-el tbody");
  tbody.innerHTML = "";
  for (const [year, kha] of BURNED_KHA) {
    const tr = document.createElement("tr");
    const suffix = PROVISIONAL.has(year) ? t("provisionalRow") : "";
    tr.innerHTML = `<td>${year}${suffix}</td><td>≈ ${fmtNum(kha * 1000)}</td>`;
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

let regionCache = null;

function initRegions(ctx) {
  const sel = document.getElementById("region-select");
  for (const [gid, name] of REGIONS) {
    const opt = document.createElement("option");
    opt.value = gid;
    opt.textContent = name;
    sel.appendChild(opt);
  }
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

  renderLivestock(gid);
  renderOutlook(gid);

  const stats = document.getElementById("region-stats");
  const fallback = document.getElementById("region-fallback");
  const year = today.getFullYear();
  const sources = [
    async () => {
      if (banfSnapshot === undefined) {
        banfSnapshot = await fetchJSON("data/gwis-banf.json", 8000).catch(() => null);
      }
      const entry = banfSnapshot && banfSnapshot.series && banfSnapshot.series[gid];
      if (!entry) throw new Error("gid not in snapshot");
      return entry.years;
    },
    async () => {
      const level = gid === "ESP" ? "ADM0" : "ADM1";
      const url = `${CPROF_API}/banf?level=${level}&value=${gid}&year=${year}&yearFrom=2006&yearTo=${year}&env=PROD`;
      const data = await fetchJSON(url, 15000);
      return data.banfyear || [];
    },
  ];
  for (const source of sources) {
    try {
      const years = (await source()).filter(
        (d) => Number.isFinite(d.year) && Number.isFinite(d.ba_area_ha)
      );
      // GWIS consolidates with a lag: trailing all-zero years are pending,
      // not fire-free — drop them so charts and averages stay truthful.
      while (years.length > 5 && !(years[years.length - 1].ba_area_ha > 0)) {
        years.pop();
      }
      if (!years.length) throw new Error("empty banfyear");
      regionCache = { years, name: region ? region[1] : "España" };
      renderRegionStats(years, year);
      renderRegionChart(years, regionCache.name);
      stats.hidden = false;
      fallback.hidden = true;
      return;
    } catch (err) {
      console.error("regional stats source failed:", err);
    }
  }
  regionCache = null;
  stats.hidden = true;
  document.getElementById("region-chart").innerHTML = "";
  fallback.hidden = false;
}

let banfSnapshot;

/* ---------- livestock (Eurostat sheep + goats) ---------- */

let livestockSnapshot;
let livestockGid = null;

async function renderLivestock(gid) {
  livestockGid = gid;
  const block = document.getElementById("livestock-block");
  if (livestockSnapshot === undefined) {
    livestockSnapshot = await fetchJSON("data/livestock-esp.json", 8000).catch(() => null);
  }
  const entry =
    livestockSnapshot && livestockSnapshot.series && livestockSnapshot.series[gid];
  if (!entry || entry.years.length < 2 || livestockGid !== gid) {
    if (livestockGid === gid) block.hidden = true;
    return;
  }
  block.hidden = false;

  const years = entry.years;
  const first = years[0];
  const last = years[years.length - 1];
  const pct = Math.round(((last.ths_head - first.ths_head) / first.ths_head) * 100);
  document.getElementById("ls-delta").textContent = t("lsDelta", {
    pct: (pct > 0 ? "+" : "") + pct.toLocaleString(t("numLocale")),
    from: first.year,
    to: last.year,
  });

  const fmtTick = (v) =>
    v >= 1000 ? `${(Math.round(v / 100) / 10).toLocaleString(t("numLocale"))}M` : `${Math.round(v)}k`;
  const points = years.map((d) => ({
    label: String(d.year),
    value: d.ths_head,
    html: `<span class="t-title">${d.year}</span><br><span class="t-value">${t("lsTooltip", { n: fmtNum(d.ths_head * 1000) })}</span>`,
    aria: `${d.year}: ${fmtNum(d.ths_head * 1000)}`,
  }));
  barChart(document.getElementById("livestock-chart"), points, {
    direct: new Set([String(last.year)]),
    fmtTick,
    aria: t("lsChartAria"),
  });
}

// The GWIS annual series consolidates months after the fact, so the running
// year is often absent or zero long after fires have burnt (the weekly
// EFFIS stats in the today card are near-real-time). Render that state as
// "not published yet", never as a false 0.
function regionYearPending(years) {
  const current = years.find((d) => d.year === today.getFullYear());
  return !current || !(current.ba_area_ha > 0);
}

function renderRegionStats(years, currentYear) {
  const current = years.find((d) => d.year === currentYear);
  const past = years.filter((d) => d.year < currentYear);
  const avgBa = past.length
    ? past.reduce((a, d) => a + d.ba_area_ha, 0) / past.length
    : null;
  const pending = regionYearPending(years);
  document.getElementById("rs-ba").textContent = pending ? "–" : fmtNum(current.ba_area_ha);
  document.getElementById("rs-avg").textContent = avgBa === null ? "n/a" : fmtNum(avgBa);
  document.getElementById("rs-nf").textContent = pending ? "–" : fmtNum(current.ba_count || 0);
  document.getElementById("rs-size").textContent =
    !pending && current.firesize ? fmtNum(current.firesize) : "–";
  document.getElementById("rs-pending").hidden = !pending;
}

function renderRegionChart(allYears, name) {
  // Hide the running year's empty bar while its annual figure is unpublished.
  const years = regionYearPending(allYears)
    ? allYears.filter((d) => d.year < today.getFullYear())
    : allYears;
  if (!years.length) return;
  const maxVal = Math.max(...years.map((d) => d.ba_area_ha));
  const peak = years.find((d) => d.ba_area_ha === maxVal);
  const fmtTick = (v) =>
    v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v));
  const points = years.map((d) => ({
    label: String(d.year),
    value: d.ba_area_ha,
    html: `<span class="t-title">${d.year}</span><br><span class="t-value">${t("regTooltip", { n: fmtNum(d.ba_area_ha), k: d.ba_count || 0 })}</span>`,
    aria: t("regBarAria", { year: d.year, n: fmtNum(d.ba_area_ha), k: d.ba_count || 0 }),
  }));
  barChart(document.getElementById("region-chart"), points, {
    direct: peak ? new Set([String(peak.year)]) : new Set(),
    fmtTick,
    aria: t("regChartAria", { name, last: years[years.length - 1].year }),
  });
}

/* ---------- season outlook (experimental in-browser inference) ---------- */

let modelSnapshot;
let regClimateSnapshot;
let outlookGid = null;

function priorBurnFeature(gid, year) {
  const entry = banfSnapshot && banfSnapshot.series && banfSnapshot.series[gid];
  const byYear = new Map((entry ? entry.years : []).map((r) => [r.year, r.ba_area_ha || 0]));
  const prior = [year - 3, year - 2, year - 1].map((y) => byYear.get(y) || 0);
  return Math.log1p(prior.reduce((a, b) => a + b, 0) / prior.length);
}

async function renderOutlook(gid) {
  outlookGid = gid;
  const block = document.getElementById("outlook-block");
  if (modelSnapshot === undefined) {
    [modelSnapshot, regClimateSnapshot] = await Promise.all([
      fetchJSON("data/model-esp.json", 8000).catch(() => null),
      fetchJSON("data/climate-regions-esp.json", 8000).catch(() => null),
    ]);
  }
  if (banfSnapshot === undefined) {
    banfSnapshot = await fetchJSON("data/gwis-banf.json", 8000).catch(() => null);
  }
  if (outlookGid !== gid) return;
  const m = modelSnapshot;
  const rc = regClimateSnapshot && regClimateSnapshot.regions;
  const year = today.getFullYear();
  const climKeys = m ? m.numeric_features.slice(0, -1) : [];
  // Per-comunidad model only: aggregating log-scale regional medians into a
  // national figure understates skewed totals and would mislead.
  const targets = gid === "ESP" ? [] : [gid];

  const usable =
    m && rc && banfSnapshot && targets.length &&
    targets.every((g) => m.regions.includes(g) && rc[g]);
  if (!usable) {
    block.hidden = true;
    return;
  }

  let point = 0;
  let lo = 0;
  let hi = 0;
  let partial = false;
  for (const g of targets) {
    const crow = (rc[g].years || []).find((r) => r.year === year);
    if (!crow || climKeys.some((k) => !(k in crow))) {
      block.hidden = true;
      return;
    }
    if (climKeys.some((k) => crow[`${k}_partial`])) partial = true;
    const feats = climKeys.map((k) => crow[k]);
    feats.push(priorBurnFeature(g, year));
    let z = m.intercept;
    m.numeric_features.forEach((k, i) => {
      z += m.coef[i] * ((feats[i] - m.mean[i]) / m.std[i]);
    });
    z += m.coef[m.numeric_features.length + m.regions.indexOf(g)];
    point += Math.expm1(z);
    lo += Math.expm1(z + m.resid_q10);
    hi += Math.expm1(z + m.resid_q90);
  }

  block.hidden = false;
  document.getElementById("ol-range").textContent = `${fmtNum(lo)} – ${fmtNum(hi)}`;
  document.getElementById("ol-point").textContent = fmtNum(point);
  document.getElementById("ol-inputs").textContent = t(
    partial ? "olInputsPartial" : "olInputsFull",
    { year }
  );
  const q = document.getElementById("ol-quality");
  if (q) {
    q.textContent = t("olQuality", {
      r2: m.cv_r2_log.toLocaleString(t("numLocale")),
      factor: m.cv_mae_factor.toLocaleString(t("numLocale")),
    });
  }

  renderOutlookMonth(gid);
}

let monthlyModel;
let monthlyClimate;
let monthlyBa;

function backMonth(y, m, k) {
  let mm = m - k;
  let yy = y;
  while (mm < 1) {
    mm += 12;
    yy -= 1;
  }
  return [yy, mm];
}

// Nowcast of the current month for the selected comunidad: the month's own
// (partial) climate plus lagged climate and burned-area history.
async function renderOutlookMonth(gid) {
  const stat = document.getElementById("ol-month-stat");
  if (monthlyModel === undefined) {
    [monthlyModel, monthlyClimate, monthlyBa] = await Promise.all([
      fetchJSON("data/model-monthly-esp.json", 8000).catch(() => null),
      fetchJSON("data/climate-monthly-esp.json", 8000).catch(() => null),
      fetchJSON("data/gwis-monthly-esp.json", 8000).catch(() => null),
    ]);
  }
  if (outlookGid !== gid) return;
  const mm = monthlyModel;
  const rc = monthlyClimate && monthlyClimate.regions && monthlyClimate.regions[gid];
  const rb = monthlyBa && monthlyBa.series && monthlyBa.series[gid];
  const y = today.getFullYear();
  const mo = today.getMonth() + 1;
  if (!mm || !rc || !rb || !mm.regions.includes(gid)) {
    stat.hidden = true;
    return;
  }
  const climAt = new Map(rc.months.map((r) => [`${r.year}-${r.month}`, r]));
  const baAt = new Map(rb.months.map((r) => [`${r.year}-${r.month}`, r.ba_area_ha || 0]));
  const c = climAt.get(`${y}-${mo}`);
  const lag = (k) => climAt.get(backMonth(y, mo, k).join("-"));
  const lags = [lag(1), lag(2), lag(3), lag(4)];
  if (!c || lags.some((v) => !v || v.partial)) {
    stat.hidden = true;
    return;
  }
  const ba12 = Array.from({ length: 12 }, (_, i) =>
    baAt.get(backMonth(y, mo, i + 1).join("-")) || 0
  ).reduce((a, b) => a + b, 0);
  const feats = [
    c.precip, c.tmax, c.wind,
    lags[0].precip, lags[0].tmax,
    lags[1].precip + lags[2].precip + lags[3].precip,
    Math.log1p(baAt.get(backMonth(y, mo, 1).join("-")) || 0),
    Math.log1p(baAt.get(backMonth(y, mo, 12).join("-")) || 0),
    Math.log1p(ba12),
  ];
  let z = mm.intercept + mm.coef_month[mo - 1] + mm.coef_region[mm.regions.indexOf(gid)];
  mm.numeric_features.forEach((k, i) => {
    z += mm.coef_numeric[i] * ((feats[i] - mm.mean[i]) / mm.std[i]);
  });
  const monthName = new Date(y, mo - 1, 15).toLocaleDateString(t("dateLocale"), {
    month: "long",
  });
  stat.hidden = false;
  document.getElementById("ol-mrange").textContent =
    `${fmtNum(Math.max(0, Math.expm1(z + mm.resid_q10)))} – ${fmtNum(Math.expm1(z + mm.resid_q90))}`;
  document.getElementById("ol-mlabel").textContent = t("olMonthLabel", {
    month: monthName,
    r2: mm.cv_r2_log_summer.toLocaleString(t("numLocale")),
  });
}

/* ---------- climate & fire correlation ---------- */

const CLIMATE_METRICS = {
  spring_precip: { unit: "mm", labelKey: "cmSpring" },
  presummer_precip: { unit: "mm", labelKey: "cmPre" },
  summer_tmax: { unit: "°C", labelKey: "cmTmax" },
  summer_wind: { unit: "km/h", labelKey: "cmWind" },
};

let climateData = null;
let climateMetric = "spring_precip";

async function initClimate() {
  try {
    const snap = await fetchJSON("data/climate-esp.json", 8000);
    if (!Array.isArray(snap.years) || !snap.years.length) throw new Error("empty");
    climateData = snap;
  } catch (err) {
    console.error("climate snapshot unavailable:", err);
    return; // card stays hidden — the feature needs the ETL snapshot
  }
  document.getElementById("climate-card").hidden = false;
  for (const chip of document.querySelectorAll(".climate-chips .chip")) {
    chip.addEventListener("click", () => {
      climateMetric = chip.dataset.metric;
      renderClimate();
    });
  }
  renderClimate();
}

// Years usable for correlation: climate value present and complete, and a
// burned-area figure exists for that year in the EGIF/EFFIS record.
function climatePoints() {
  const ba = new Map(BURNED_KHA.map(([y, kha]) => [Number(y), kha]));
  return climateData.years
    .filter(
      (row) =>
        Number.isFinite(row[climateMetric]) &&
        !row[`${climateMetric}_partial`] &&
        ba.has(row.year)
    )
    .map((row) => ({ year: row.year, x: row[climateMetric], y: ba.get(row.year) }));
}

function pearson(pts) {
  const n = pts.length;
  if (n < 5) return null;
  const mx = pts.reduce((a, p) => a + p.x, 0) / n;
  const my = pts.reduce((a, p) => a + p.y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const p of pts) {
    sxy += (p.x - mx) * (p.y - my);
    sxx += (p.x - mx) ** 2;
    syy += (p.y - my) ** 2;
  }
  if (!sxx || !syy) return null;
  return sxy / Math.sqrt(sxx * syy);
}

function renderClimate() {
  for (const chip of document.querySelectorAll(".climate-chips .chip")) {
    chip.classList.toggle("chip-accent", chip.dataset.metric === climateMetric);
  }
  const pts = climatePoints();
  const host = document.getElementById("climate-chart");
  const verdict = document.getElementById("climate-verdict");
  scatterChart(host, pts, CLIMATE_METRICS[climateMetric]);

  const r = pearson(pts);
  if (r === null) {
    verdict.textContent = "";
    return;
  }
  const abs = Math.abs(r);
  let desc;
  if (abs < 0.25) desc = t("rNone");
  else {
    const strength = abs < 0.5 ? t("rWeak") : abs < 0.75 ? t("rModerate") : t("rStrong");
    desc = t("rDesc", { strength, dir: t(r > 0 ? "rPos" : "rNeg") });
  }
  verdict.textContent = t("rLine", {
    metric: t(CLIMATE_METRICS[climateMetric].labelKey),
    n: pts.length,
    r: r.toLocaleString(t("numLocale"), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
    desc,
  });
}

// SVG scatter in the same visual family as barChart: y = burned kha, x = the
// climate metric; dots get tooltips and keyboard focus.
function scatterChart(host, pts, metric) {
  host.innerHTML = "";
  if (!pts.length) return;
  const W = 320;
  const H = 190;
  const m = { top: 12, right: 10, bottom: 26, left: 34 };
  const plotW = W - m.left - m.right;
  const plotH = H - m.top - m.bottom;
  const xMin = Math.min(...pts.map((p) => p.x));
  const xMax = Math.max(...pts.map((p) => p.x));
  const xPad = (xMax - xMin) * 0.07 || 1;
  const x0 = xMin - xPad;
  const x1 = xMax + xPad;
  const yMax = niceCeil(Math.max(...pts.map((p) => p.y)));
  const x = (v) => m.left + ((v - x0) / (x1 - x0)) * plotW;
  const y = (v) => m.top + plotH * (1 - v / yMax);

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", t("climateChartAria"));
  const el = (name, attrs, parent) => {
    const node = document.createElementNS(svgNS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    (parent || svg).appendChild(node);
    return node;
  };

  for (let i = 1; i <= 4; i++) {
    const v = (yMax / 4) * i;
    el("line", { class: "grid-line", x1: m.left, x2: W - m.right, y1: y(v), y2: y(v) });
    const lbl = el("text", { class: "tick-y", x: m.left - 4, y: y(v) + 3, "text-anchor": "end" });
    lbl.textContent = String(Math.round(v));
  }
  el("line", { class: "baseline", x1: m.left, x2: W - m.right, y1: y(0), y2: y(0) });
  for (let i = 0; i <= 3; i++) {
    const v = x0 + ((x1 - x0) / 3) * i;
    const lbl = el("text", {
      x: x(v), y: H - 12, "text-anchor": i === 0 ? "start" : i === 3 ? "end" : "middle",
    });
    lbl.textContent = String(Math.round(v));
  }
  const unitLbl = el("text", { class: "tick-y", x: W - m.right, y: H - 2, "text-anchor": "end" });
  unitLbl.textContent = `${metric.unit} → · kha ↑`;

  const maxY = Math.max(...pts.map((p) => p.y));
  for (const p of pts) {
    const dot = el("circle", {
      class: "dot" + (p.y === maxY ? " dot-peak" : ""),
      cx: x(p.x), cy: y(p.y), r: 4,
      tabindex: "0",
      "aria-label": `${p.year}: ${p.x} ${metric.unit}, ${p.y} kha`,
    });
    const html = `<span class="t-title">${p.year}</span><br><span class="t-value">${p.x.toLocaleString(t("numLocale"))} ${metric.unit} · ${p.y.toLocaleString(t("numLocale"))} kha</span>`;
    dot.addEventListener("mousemove", (e) => showTooltip(html, e.clientX, e.clientY));
    dot.addEventListener("mouseleave", hideTooltip);
    dot.addEventListener("focus", () => {
      const r2 = dot.getBoundingClientRect();
      showTooltip(html, r2.left + r2.width / 2, r2.top);
    });
    dot.addEventListener("blur", hideTooltip);
    if (p.y === maxY || DIRECT_LABELS.has(String(p.year))) {
      const lbl = el("text", {
        class: "direct-label",
        x: x(p.x), y: y(p.y) - 7, "text-anchor": "middle",
      });
      lbl.textContent = String(p.year);
    }
  }
  host.appendChild(svg);
}

/* ---------- boot ---------- */

let mapCtx = null;
try {
  mapCtx = initMap();
} catch (err) {
  console.error("map failed to initialise:", err);
}
initToday(mapCtx);
initRegions(mapCtx);
initClimate();
applyLang();

document.getElementById("lang-toggle").addEventListener("click", () => {
  lang = lang === "es" ? "en" : "es";
  localStorage.setItem("fw-lang", lang);
  applyLang();
});
