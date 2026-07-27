# Firewatcher

An interactive **wildfire risk dashboard for Spain**, published on GitHub Pages, plus the design document for the full open-data analytics platform behind it (EGIF, EFFIS, Copernicus, AEMET, PNOA-LiDAR, Catastro, INE).

**Live site:** https://alpibrusl.github.io/firewatcher/

## What's on the site

- **`/` — the dashboard.** A static, client-side web app: Leaflet map of Spain with live layers from the Copernicus EFFIS WMS (fire-danger forecast with a date picker, VIIRS/MODIS active-fire detections, current-season burnt areas), headline statistics, and a chart of annual burned area 2005–2025.
- **`/design/` — the design document.** The full platform design ([`docs/design.md`](docs/design.md)) rendered as a styled page.

The dashboard needs no backend: map layers are drawn live by the public EFFIS WMS in the visitor's browser, and everything else is static.

## Build and deploy

- **Build:** `scripts/build_site.py` copies the app from `app/` into `_site/` and renders `docs/design.md` into `_site/design/` using the shell in `web/`
- **Deploy:** `.github/workflows/deploy-pages.yml` builds on every push to the default branch and publishes `_site/` to the `gh-pages` branch, which GitHub Pages serves

### Build locally

```bash
pip install markdown
python scripts/build_site.py
# open _site/index.html
```

## Repository layout

```
app/                    # the dashboard (static web app; Leaflet vendored)
docs/design.md          # the platform design document (source of truth)
web/                    # HTML template and stylesheet for the rendered doc
scripts/build_site.py   # builds everything into _site/
.github/workflows/      # GitHub Pages deployment
```

## Data sources & attribution

- Fire danger, active-fire detections and burnt areas: © European Union, Copernicus Emergency Management Service — [EFFIS](https://forest-fire.emergency.copernicus.eu/). Contains modified Copernicus Emergency Management Service information 2026.
- Historical fire statistics: [MITECO / EGIF](https://www.miteco.gob.es/en/biodiversidad/temas/incendios-forestales/estadisticas-datos.html) (approximate figures; 2025 provisional per EFFIS mapping).
- Basemap: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, © [CARTO](https://carto.com/attributions).

## What the platform is (short version)

Spanish wildfire analysis is bottlenecked by data harmonisation, not modelling technique. The platform produces six analysis-ready products:

| | Product |
|---|---|
| P1 | Harmonised fire record, 1968–present, EGIF ⇄ EFFIS reconciled |
| P2 | Daily fire-danger reanalysis (FWI family, 1 km, 1980–present) |
| P3 | Fuel and structure layer at 25 m from PNOA-LiDAR + MFE |
| P4 | Calibrated daily ignition-hazard model |
| P5 | Monte Carlo burn probability and exposure |
| P6 | Fuel-treatment placement optimiser |

See the full document for data sources, known data traps, architecture, schemas, models, validation strategy, and roadmap.
