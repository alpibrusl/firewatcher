# Firewatcher

Design document and site for a **wildfire risk & prevention analytics platform for Spain**, built entirely on open data (EGIF, EFFIS, Copernicus, AEMET, PNOA-LiDAR, Catastro, INE).

The design document is the source of truth: [`docs/design.md`](docs/design.md). It is published as a GitHub Pages site, rendered by a small build script.

## Site

- **Source:** `docs/design.md`
- **Build:** `scripts/build_site.py` renders the markdown into `_site/` using the shell in `web/` (template + styles)
- **Deploy:** `.github/workflows/deploy-pages.yml` builds and publishes to GitHub Pages on every push to the default branch

### Build locally

```bash
pip install markdown
python scripts/build_site.py
# open _site/index.html
```

## Repository layout

```
docs/design.md          # the design document (source of truth)
web/                    # HTML template and stylesheet for the site
scripts/build_site.py   # markdown -> _site/ renderer
.github/workflows/      # GitHub Pages deployment
```

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
