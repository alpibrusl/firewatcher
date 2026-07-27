# Firewatcher

An interactive **wildfire risk dashboard for Spain**, published on GitHub Pages.

**Live site:** https://alpibrusl.github.io/firewatcher/

A static, client-side web app: Leaflet map with live layers from the Copernicus EFFIS WMS (fire-danger forecast with a date picker, VIIRS/MODIS/NOAA active-fire detections, current-season burnt areas), live season statistics for Spain from the EFFIS statistics API, and a chart of annual burned area 2005–2025. The live layers cover the EFFIS domain (Europe, Middle East, North Africa). No backend required.

## Build and deploy

- **Build:** `scripts/build_site.py` copies the app from `app/` into `_site/`
- **Deploy:** `.github/workflows/deploy-pages.yml` builds on every push to `main` and publishes `_site/` to the `gh-pages` branch, which GitHub Pages serves

### Build locally

```bash
python scripts/build_site.py
# open _site/index.html
```

## Repository layout

```
app/                    # the dashboard (static web app; Leaflet vendored)
scripts/build_site.py   # builds into _site/
.github/workflows/      # GitHub Pages deployment
```

## Data sources & attribution

- Fire danger, active-fire detections and burnt areas: © European Union, Copernicus Emergency Management Service — [EFFIS](https://forest-fire.emergency.copernicus.eu/). Contains modified Copernicus Emergency Management Service information 2026.
- Historical fire statistics: [MITECO / EGIF](https://www.miteco.gob.es/en/biodiversidad/temas/incendios-forestales/estadisticas-datos.html) (approximate figures; 2025 provisional per EFFIS mapping).
- Basemap: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, © [CARTO](https://carto.com/attributions).
