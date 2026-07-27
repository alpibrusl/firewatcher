# Wildfire Risk & Prevention Analytics Platform — Design Document

**Status:** Draft v0.1
**Scope:** Spain (national, with regional depth) embedded in an EU/Copernicus data frame
**Author:** —
**Last updated:** 2026-07-27

---

## 0. Assumptions (challenge these first)

This document assumes a specific shape for the system. If any assumption is wrong, the design changes materially, so read this section before the rest.

1. **Solo developer, AI-assisted.** Architecture favours few moving parts, declarative pipelines, and local-first compute over distributed infrastructure. No Kubernetes.
2. **Analytical, not operational.** The system produces risk surfaces, retrospective analysis, and prevention-planning outputs. It is *not* an operational dispatch or detection system and carries no real-time SLA.
3. **Spatial unit: 1 km grid (EPSG:3035) for danger/ignition; 25 m for fuel and spread.** Coarser for reporting (municipality, NUTS3).
4. **Temporal unit: daily.** Fire danger and ignition hazard are daily quantities; fuel and exposure are annual/static.
5. **Open data only.** No commercial imagery, no paid weather feeds, no data purchased from CCAA. Everything must be redistributable or at least reproducible from public endpoints.
6. **Deployment target: a single dedicated server** (Hetzner/OVH class, ~64 GB RAM, ~4 TB NVMe/HDD) plus object storage. Not a cloud-native design.

---

## 1. Purpose and success criteria

### 1.1 Problem

Spanish wildfire analysis is bottlenecked not by modelling technique but by **data harmonisation**. The authoritative national record (EGIF) is a 150-field-per-incident database going back to 1968 with a multi-year consolidation lag; the European record (EFFIS) has a hard size-detection floor; fuel data is fragmented across MFE, IFN and PNOA-LiDAR; exposure data lives in Catastro and INE. Nobody publishes a joined, versioned, analysis-ready product.

### 1.2 What this system produces

| Product | Description | Consumers |
|---|---|---|
| **P1 — Harmonised fire record** | Every recorded fire in Spain 1968–present, deduplicated against EFFIS perimeters, with explicit provenance and detection-regime flags | Researchers, journalists, insurers |
| **P2 — Daily danger reanalysis** | FWI family + derived anomalies on a 1 km grid, 1980–present, plus forecast horizon | Modellers |
| **P3 — Fuel and structure layer** | Fuel model, canopy cover, canopy height, CBH/CBD at 25 m from LiDAR + MFE | Spread simulation |
| **P4 — Ignition hazard model** | Calibrated daily probability of ignition per cell, decomposed by cause family | Prevention planning |
| **P5 — Burn probability & exposure** | Monte Carlo burn probability, and expected exposure of structures / population / protected areas | Civil protection, insurers, municipalities |
| **P6 — Treatment optimiser** | Where to place fuel treatments to maximally reduce expected exposure under a budget | Forest managers |

### 1.3 Success criteria

- **S1.** P1 reconciles ≥95% of EFFIS Spanish perimeters ≥100 ha to an EGIF record, with residuals explained.
- **S2.** P4 beats an FWI-only baseline on AUC-PR under leave-region-out spatial CV, with a reliability diagram showing calibration error < 0.05.
- **S3.** Any published figure reproduces byte-identically from a manifest hash, months later, without re-downloading.
- **S4.** Full historical rebuild from cold cache completes in < 24 h on the target hardware.

### 1.4 Non-goals

- Real-time fire detection (FIRMS/EFFIS already do this well).
- Operational suppression resource allocation.
- Any output framed as an individual-property risk score or an insurance pricing recommendation.
- Sub-daily fire behaviour simulation.

---

## 2. Conceptual model

Risk is decomposed multiplicatively and each factor is modelled separately, because they have different data sources, different update cadences, and different failure modes:

```
Expected loss(cell, day)
  = P(ignition | cell, day)                    <- ignition hazard model (P4)
  x E[burned area | ignition, cell, day]       <- spread / size model
  x Vulnerability(exposed assets in burn footprint)   <- exposure model (P5)
```

Conflating these — as a single "risk index" regression on historical burned area does — makes the model unusable for prevention, because prevention interventions act on different terms:

- **Ignition reduction** (patrols, infrastructure hardening, regulation of agricultural burns) acts on term 1.
- **Fuel treatment** (thinning, prescribed burning, grazing, fuel breaks) acts on term 2.
- **Defensible space, WUI regulation, evacuation planning** act on term 3.

The optimiser (P6) needs the terms separable to compare interventions.

---

## 3. Data sources

### 3.1 European / Copernicus

| ID | Source | Content | Access | Format / Res | Cadence | Notes |
|---|---|---|---|---|---|---|
| `EFFIS-BA` | EFFIS (JRC / Copernicus EMS) | Burnt area perimeters | WMS + data request form | Vector | Daily | **Detection floor ~30 ha** — critical bias, see §4.3 |
| `EFFIS-DB` | EFFIS Fire Database | ~2M harmonised fire records, 22 countries | Data request form; DOI 10.2905/JRC.KCNZPQ0 | CSV | Annual | Spain's contribution is EGIF-derived; use for cross-country only |
| `EFFIS-FUEL` | EFFIS | Harmonised European fuel map | WMS | Raster ~1 km | Static | Too coarse for Spain; use as fallback only |
| `CEMS-FIRE-H` | Copernicus EWDS `cems-fire-historical-v1` | FWI/Canadian, NFDRS/US, McArthur/AU indices from ERA5 | `cdsapi` | NetCDF/GRIB, ~0.25° | Historical reanalysis | Primary meteo hazard source |
| `CEMS-FIRE-S` | `cems-fire-seasonal` | Seasonal reforecast of fire danger | `cdsapi` | GRIB | Seasonal | Only >30 days old via CDS; real-time is EFFIS-only |
| `ERA5-LAND` | C3S | T, RH, wind, precip, soil moisture | `cdsapi` | 9 km hourly | Hourly | For drought indices (SPEI/SPI) and downscaling |
| `S2-L2A` | Copernicus Data Space Ecosystem | Sentinel-2 surface reflectance | STAC / openEO | 10–20 m | 5 d | dNBR burn severity, post-fire recovery |
| `S3-SLSTR` | CDSE | Active fire radiative power | STAC | 1 km | Sub-daily | Cross-check on ignition timing |
| `COP-DEM` | Copernicus DEM GLO-30 | Elevation | Direct download | 30 m | Static | Fallback where PNOA MDT unavailable |
| `CLC` | CLMS CORINE Land Cover | Land cover | Direct download | 100 m / 2018, 2012… | 6 y | Change detection: land abandonment as an ignition covariate |
| `CLMS-HRL` | CLMS High Resolution Layers | Tree cover density, forest type, imperviousness | Direct download | 10 m | 3 y | |
| `GHSL` | JRC Global Human Settlement Layer | Built-up surface, population | Direct download | 100 m | Epochal | WUI delineation |
| `GEOSTAT` | Eurostat / GISCO | 1 km population grid, NUTS boundaries | Direct download | 1 km | Census | Reporting geometry |
| `FIRMS` | NASA (non-EU, essential) | VIIRS/MODIS active fire | REST API | 375 m / 1 km | NRT | Ignition timing where EGIF timing is coarse |

### 3.2 Spain — national

| ID | Source | Content | Access | Notes |
|---|---|---|---|---|
| `EGIF` | MITECO / ADCIF / CCINIF | Every fire since 1968; >150 fields per *parte de incendio*; ignition coordinates, cause, timings, area breakdown by fuel type, suppression resources | `servicio.mapa.gob.es/incendios` — Excel summaries or full XML export | **The core asset.** See §4.1 for the traps |
| `EGIF-CIVIO` | Fundación Civio | Cleaned, merged EGIF: XML consolidated, UTM→WGS84 reprojected, timings normalised to minutes | `datos.civio.es` | Use as a cross-check on our own parser, not as the source of truth |
| `IEPNB` | `datos.iepnb.es` | Linked-data code lists (cause taxonomy, `idcausa` 100–600) | RDF/TTL | Needed to decode EGIF categorical fields |
| `AEMET-OD` | AEMET OpenData | REST API (free key): station observations, daily climate series, fire danger indices | JSON | Station data for downscaling and validation of CEMS grids |
| `AEMET-FWI-R` | AEMET | Daily fire danger raster, GeoTIFF, 5 km, EPSG:4326, Canadian system, Península+Baleares and Canarias separately | Direct download | Independent second opinion vs CEMS |
| `AEMET-EIMRI` | AEMET | Annual FWI statistics per province (frequencies by danger class, quantiles) as CSV | ZIP/CSV | Cheap validation target |
| `MFE` | MITECO | Mapa Forestal de España (MFE25 / MFE50): species composition, canopy fraction, structure | SHP/GDB | Basis for fuel model assignment |
| `IFN` | MITECO | Inventario Forestal Nacional (IFN3/IFN4): plot-level tree measurements, biomass | Access DB / tabular | Calibrates allometry for CBD/CBH |
| `PNOA-LiDAR` | CNIG / IGN | 2nd and 3rd coverage point clouds, 1–5 pts/m² | Centro de Descargas | **Highest-value underused layer.** Canopy height, cover, CBH |
| `MDT` | CNIG | MDT02 / MDT05 digital terrain model | Direct download | Slope, aspect, TPI |
| `SIOSE` / `SIOSE-AR` | CNIG | High-resolution land occupation | Direct download | Agricultural/forest interface |
| `CATASTRO` | Dirección General del Catastro | Building footprints, construction year, use | INSPIRE ATOM / WFS | The real WUI exposure layer |
| `SIGPAC` | FEGA / CCAA | Agricultural parcels, land use codes | WMS/download | Stubble-burning ignition proxy |
| `INE` | Instituto Nacional de Estadística | Municipal population, ageing index, depopulation, housing, livestock census | API / CSV | Socioeconomic drivers of ignition |
| `OSM` | OpenStreetMap | Roads, tracks, power lines, settlements | Geofabrik extracts | Distance-to-infrastructure features |

### 3.3 Spain — regional (deeper, heterogeneous)

Regional IDEs frequently hold data richer than the national aggregate — longer perimeter series, prescribed-burn registries, fuel-treatment records. Priority order by data quality:

1. **REDIAM** (Andalucía) — fire perimeters back to the 1970s, extensive environmental layers.
2. **ICGC + Bombers de la Generalitat** (Catalunya) — perimeters, GRAF analyses, fuel models.
3. **IDEG / Xunta** (Galicia) — highest fire *frequency* region in Spain; essential for the ignition model.
4. **IDEAragón**, **IDECyL** (Castilla y León), **ICV** (Valencia).
5. **ICNF** (Portugal) — cross-border continuity for Galicia/Extremadura/Castilla y León.

**Design decision:** regional sources are *plugins*, not core. The core pipeline must produce complete national coverage without them; regional adapters enrich specific `ccaa` partitions and are individually skippable.

---

## 4. Known data traps (the actual hard part)

These are documented as first-class engineering requirements, not footnotes.

### 4.1 EGIF consolidation lag and revision

Definitive consolidated data lags several years behind; intermediate years exist only as provisional *avances* that are revised without notice. Requirements:

- **R4.1.a** Every EGIF snapshot is stored immutably, content-addressed by SHA-256, with the fetch timestamp.
- **R4.1.b** A `record_status` field (`definitive` | `provisional`) propagates into every downstream table.
- **R4.1.c** A diffing job reports, per snapshot pair, records added / removed / mutated, with a mutation report by field. Silent revision of historical years must be visible.
- **R4.1.d** Models trained on provisional data record which snapshot hash they saw.

### 4.2 Coordinate reference systems

EGIF ignition coordinates are supplied in UTM by province, and older vintages may be on ED50 rather than ETRS89. A naive `EPSG:25830` assumption puts Galicia and Catalunya hundreds of metres off, and mixing datums adds a ~200 m systematic shift.

- **R4.2.a** Per-record CRS inference from the province code plus record vintage, with the assumed CRS stored explicitly on the record.
- **R4.2.b** Datum transformation via explicit PROJ pipelines, never a bare `to_crs`.
- **R4.2.c** Validation: reprojected ignition points must fall within the declared municipality polygon. Failures are quarantined, not silently accepted. Target < 2% quarantine rate; investigate if higher.
- **R4.2.d** Canonical analysis CRS: **EPSG:3035** (ETRS89-LAEA) for pan-European grids; **EPSG:25830** for Peninsula metric operations; Canarias handled separately (REGCAN95 / EPSG:4083 family) and never silently merged into a Peninsula grid.

### 4.3 Detection-regime mismatch (EGIF vs EFFIS)

EGIF records *conatos* below 1 ha; EFFIS reliably maps only above ~30 ha. Joining them naively distorts the fire-size distribution — which is the single most important quantity in the whole system, since burned area is heavy-tailed and a handful of events dominate.

- **R4.3.a** Every fire record carries a `size_regime` flag and a `detection_source` set.
- **R4.3.b** Reconciliation is an explicit spatiotemporal matching job: an EGIF ignition point matches an EFFIS perimeter if the point lies within the perimeter (or a 1 km buffer) and the EGIF start date is within [perimeter first date − 2 d, last date + 2 d]. Ambiguous many-to-one matches are resolved by area and logged.
- **R4.3.c** Size-distribution fitting is **truncation-aware**: fit the small-fire regime on EGIF only, the tail on the reconciled set, and never fit a single distribution across the join.
- **R4.3.d** A reconciliation report is a build artifact (S1 above depends on it).

### 4.4 Cause coding

EGIF cause is a *presumed* cause, with large "unknown" and "intentional" buckets whose relative sizes vary by CCAA and over time — partly reflecting investigative capacity, not underlying reality.

- **R4.4.a** Cause is modelled as a categorical with an explicit missing-not-at-random treatment; never imputed to the modal class.
- **R4.4.b** Cause-specific ignition models are fit only on cause families with stable coding (lightning is the reliable one; lightning ignitions are also physically predictable from convective indices).
- **R4.4.c** Any cross-CCAA comparison of cause shares carries a coding-practice caveat in the output metadata.

### 4.5 Post-fire leakage

dNBR, burn severity, and post-fire recovery products are computed *after* the fire. Their appearance in an ignition feature vector is silent, catastrophic leakage.

- **R4.5.a** Every feature carries an `as_of_offset` (days relative to prediction time at which the value is knowable). The feature builder rejects any feature with a positive offset for prospective models. This is enforced in the schema, not by convention.

### 4.6 Licensing

EFFIS data carry a specific licence requiring attribution and constraining redistribution of raw perimeters; Copernicus products require the "Contains modified Copernicus … information [Year]" attribution; AEMET, CNIG, Catastro and INE each have their own reuse terms.

- **R4.6.a** A machine-readable `LICENSES.yaml` maps every dataset ID to licence, attribution string, and redistribution permission.
- **R4.6.b** The publication step refuses to emit any product whose input closure includes a non-redistributable dataset unless the output is a derived aggregate above a documented threshold.

---

## 5. Architecture

### 5.1 Layers

```
  L0  acquire/     immutable, content-addressed raw artifacts + fetch manifests
  L1  normalize/   parsed, typed, CRS-corrected, schema-validated (Parquet / COG)
  L2  harmonize/   entity-resolved: reconciled fire record, unified grids
  L3  features/    as-of-safe feature tables and stacks
  L4  models/      trained artifacts + evaluation reports
  L5  products/    tiles, APIs, reports, optimiser outputs
```

Each layer is written once and never mutated in place. Rebuilds produce a new run directory keyed by a manifest hash.

### 5.2 Stack

| Concern | Choice | Rationale |
|---|---|---|
| Orchestration | **Dagster** | Asset-based model matches the layered data-product design; lineage is first-class; single-process deployment is fine |
| Tabular compute | **DuckDB** (+ `spatial`, `httpfs`) | Handles the entire EGIF corpus and feature tables on one box; spatial joins without PostGIS operational overhead |
| Raster compute | **xarray + rioxarray + dask** | Lazy windowed reads over COGs |
| Point clouds | **PDAL** (+ `lidR` via `rpy2` if needed) | PNOA-LiDAR canopy metrics |
| Vector I/O | **GeoPandas / pyogrio**, **GDAL** | |
| Geospatial catalog | **Static STAC** (`pystac`) served from object storage | No catalog server to operate |
| Storage | Object storage for L0/L5, local NVMe for L1–L4 | L0 is cold and large; L1–L4 are hot |
| Modelling | **LightGBM** baseline; **PyMC / INLA** for calibrated spatial models; **Cell2Fire** for spread | |
| Serving | **FastAPI** + **PMTiles** | Static tiles avoid a tile server |
| Reporting | **Quarto** | Executable, versioned reports |
| Packaging | **uv**, `pyproject.toml`, ruff, mypy | |

**Deliberately rejected:** PostGIS as the primary store (operational burden for a single user; DuckDB + Parquet covers the access patterns), Airflow (heavier than needed), Kubernetes, any streaming layer.

### 5.3 Provenance and reproducibility

Given that the primary sources silently revise history (§4.1), reproducibility must be structural rather than conventional.

- Every L0 artifact is stored under `sha256/<hash>` with a sidecar manifest recording: source URL, request parameters, HTTP response headers, fetch timestamp, declared licence, and the fetcher version.
- Every downstream asset records the manifest hashes of its complete input closure.
- A build is identified by the Merkle root of its input closure plus the code commit. **Two builds with the same root must produce identical outputs**; a nightly job verifies this on a sampled asset and fails loudly otherwise.
- Published figures embed their build root in the metadata, so "which snapshot of EGIF produced this number" is always answerable.

This is the difference between a reproducible pipeline and one that merely claims to be. It also means a reviewer can verify a published result without trusting the pipeline operator.

---

## 6. Canonical schemas

Given here in abbreviated form; the authoritative definitions live as Pydantic models plus Parquet schemas with enforced constraints.

### 6.1 `fire_event`

| Field | Type | Notes |
|---|---|---|
| `event_id` | ULID | Assigned by us, stable across rebuilds via deterministic derivation from source keys |
| `source` | enum | `egif` \| `effis` \| `regional:<code>` |
| `source_id` | str | Native identifier |
| `record_status` | enum | `definitive` \| `provisional` |
| `snapshot_hash` | str | L0 manifest hash |
| `ignition_geom` | Point (3035) | Nullable |
| `ignition_crs_assumed` | str | The CRS we inferred (§4.2) |
| `ignition_geom_quality` | enum | `verified_in_municipality` \| `quarantined` \| `municipality_centroid` |
| `perimeter_id` | ULID | FK, nullable |
| `t_start`, `t_control`, `t_extinguished` | timestamptz | |
| `area_total_ha`, `area_wooded_ha`, `area_scrub_ha`, `area_nonforest_ha` | float | |
| `size_regime` | enum | `conato` (<1 ha) \| `small` \| `mapped` (≥30 ha) |
| `detection_sources` | set | Which systems saw this event |
| `cause_code` | int | Raw EGIF `idcausa` |
| `cause_family` | enum | Decoded via IEPNB code list |
| `cause_certainty` | enum | |
| `ine_muni_code`, `nuts3` | str | |
| `reconciliation_status` | enum | `unmatched` \| `matched_1_1` \| `matched_n_1` \| `ambiguous` |

### 6.2 `fire_perimeter`

Geometry (MultiPolygon, 3035), source, first/last observed date, area, and — where Sentinel-2 coverage permits — dNBR severity statistics (mean, p90, fraction high-severity).

### 6.3 `danger_grid`

Long-form Parquet partitioned by year: `cell_id`, `date`, `fwi`, `ffmc`, `dmc`, `dc`, `isi`, `bui`, `dsr`, plus anomalies against a 1991–2020 climatology, `days_above_p90` run length, `source_model` (`cems` \| `aemet`). Storing both CEMS and AEMET lets model disagreement be quantified rather than assumed away.

### 6.4 `fuel_cell` (25 m)

`fuel_model_code` (Scott & Burgan, with a documented crosswalk from MFE species/structure classes), `canopy_cover`, `canopy_height_p95`, `canopy_base_height`, `canopy_bulk_density`, `surface_load_estimate`, `lidar_vintage`, `derivation_method`, `confidence`.

The LiDAR vintage matters: PNOA coverages are years apart, and fuel accumulates. Cells must record the age of their evidence.

### 6.5 `exposure_cell`

Building count and footprint area (Catastro), population (GHSL/INE), critical infrastructure, protected-area overlap (Natura 2000), and a WUI class following the Radeloff interface/intermix typology adapted to Spanish settlement patterns (dispersed *núcleos* behave differently from US-style suburban WUI — this adaptation needs its own validation).

---

## 7. Feature engineering

Organised by the term of the risk decomposition they serve.

**Meteorological (ignition + spread):** FWI family and components; anomalies vs 1991–2020; consecutive days above the local p90/p95; antecedent precipitation over 7/30/90 d; SPEI-3/6 from ERA5-Land; wind speed and direction at 12 UTC; a *foehn*/synoptic-type indicator for Galicia and the Mediterranean coast; convective indices for lightning ignition.

**Fuel and vegetation:** the `fuel_cell` stack; NDVI/NDMI time series from Sentinel-2 with phenological anomaly; live fuel moisture proxy; time since last fire; cumulative fuel-accumulation proxy since last disturbance.

**Topographic:** slope, aspect (as sin/cos, never degrees), TPI at multiple radii, TRI, elevation, distance to ridgeline.

**Anthropogenic (ignition-dominant):** distance to nearest road, track, settlement, and power line (OSM); building density (Catastro); population density; agricultural-parcel adjacency and stubble-burning season indicator (SIGPAC); recreational pressure proxy; day-of-week and holiday indicators (human-caused ignition has a strong weekly cycle — this is one of the highest-value cheap features).

**Socioeconomic (ignition-dominant, municipal resolution):** depopulation rate, ageing index, livestock density (pastoral burning), unemployment, land abandonment rate from CLC change.

**Historical:** kernel density of past ignitions with leave-current-year-out construction (otherwise this leaks), fire recurrence count, mean return interval.

Every feature is registered with its `as_of_offset`, source dataset IDs, and unit. Feature construction that cannot state its `as_of_offset` does not enter the registry.

---

## 8. Models

### 8.1 M1 — Ignition hazard

**Formulation:** discrete-time hazard on the (1 km cell × day) panel. Spain has ~500k land cells × ~16k days — roughly 8×10⁹ rows if materialised naively, so the panel is constructed by negative subsampling (all positives, stratified negatives with importance weights, ratio tuned as a hyperparameter) with the sampling weights carried into the loss.

**Baseline:** LightGBM with monotonic constraints where physics demands them (hazard non-decreasing in FWI, holding all else equal). Monotonic constraints buy interpretability and extrapolation safety in the tail, which is exactly where the model matters and where training data is thinnest.

**Calibrated variant:** spatial log-Gaussian Cox process (INLA/SPDE) for uncertainty that survives extrapolation. Slower, better-calibrated, and necessary for the optimiser downstream — the optimiser is only as good as the calibration of the probabilities it consumes.

**Cause-decomposed variant:** separate models for lightning vs human-caused, since only the latter responds to the anthropogenic features and only the former to convective indices. Lightning is also the honest validation case, since its cause coding is reliable (§4.4).

### 8.2 M2 — Conditional size

`P(final area > A | ignition, conditions)` as a survival/tail model. Heavy-tailed; fit a lognormal body with a generalised-Pareto tail above a threshold chosen by mean-excess plot, and model the tail parameters as functions of weather and fuel. Truncation-aware per §4.3.c.

### 8.3 M3 — Spread and burn probability

Cell2Fire (open source, scriptable, no licence friction) driven by the 25 m fuel stack, with ignition points sampled from M1's probability surface and weather scenarios sampled from either the historical record or a conditioned extreme-day set. Output: burn probability per cell, plus source-of-fire attribution (which ignition locations contribute the burn probability at a given cell — this is what makes treatment placement tractable).

Validation: simulated burn probability against observed perimeters over a holdout period; the target is calibration of the spatial pattern, not per-event prediction, which is not achievable.

### 8.4 M4 — Exposure and expected impact

Burn probability × exposure layers → expected structures affected, expected population within footprint, expected protected-area hectares. Reported with uncertainty intervals propagated from M1 and M3 by Monte Carlo, not point estimates. Aggregated to municipality for public reporting; cell-level outputs are internal, to avoid the individual-property framing excluded in §1.4.

### 8.5 M5 — Treatment optimiser

Given a budget and a set of candidate treatment units (parcels, fuel-break segments), choose the subset minimising expected exposure. The objective is submodular under reasonable assumptions on the spread model, so a greedy algorithm gives a (1 − 1/e) guarantee and is the right first implementation; a MILP formulation over a discretised candidate set is the second, for comparison and for handling budget/contiguity constraints the greedy cannot.

**Key honesty requirement:** treatment effectiveness decays (fuel regrows), so the objective must be expected exposure reduction integrated over a treatment lifetime with a documented decay model, not a single-year snapshot. A single-year objective systematically over-invests in fast-regrowing fuel types.

---

## 9. Validation

| Concern | Approach |
|---|---|
| Spatial autocorrelation | Leave-region-out CV (by CCAA, and by 50 km spatial blocks). Random k-fold is invalid here and will report inflated skill |
| Temporal drift | Forward-chaining holdout by fire season year; never train on future years |
| Class imbalance | AUC-PR as primary; ROC-AUC reported but not optimised |
| Calibration | Reliability diagrams, Brier decomposition, per-region calibration (a nationally-calibrated model can be badly miscalibrated in Galicia) |
| Baselines | (a) climatology, (b) FWI threshold, (c) persistence, (d) historical ignition density. A model that does not beat (d) has learned nothing beyond where fires happened before |
| Residual structure | Moran's I on residuals; residual maps by region and season are a required build artifact |
| Leakage audit | Automated `as_of_offset` check (§4.5) plus a manual adversarial review per model release |

A model release is blocked unless the evaluation report is generated, the leakage audit passes, and the reliability diagram is inspected.

---

## 10. Outputs and interfaces

**Static products:** COGs and PMTiles in object storage, indexed by a static STAC catalog. GeoParquet for the fire record. Every product carries `LICENSES.yaml`-derived attribution in its metadata.

**API (FastAPI):**

```
GET  /v1/fires                    ?bbox&start&end&min_area&cause_family
GET  /v1/danger/{date}            ?bbox&index=fwi&source=cems|aemet
GET  /v1/ignition-hazard/{date}   ?bbox
GET  /v1/burn-probability         ?scenario_id&bbox
POST /v1/scenario                 { treatments: [...], budget, weather_scenario }
GET  /v1/provenance/{build_root}  full input closure for any published product
```

The `/provenance` endpoint is not decoration: it is what makes an external party able to check a claim.

**Reports:** Quarto, one per fire season and one per model release, executed in CI against a pinned build root.

---

## 11. Repository layout

```
firerisk/
  pyproject.toml
  LICENSES.yaml                 # dataset -> licence, attribution, redistribution
  src/firerisk/
    acquire/                    # one module per source; each returns a manifest
      egif.py  effis.py  cems.py  aemet.py  pnoa_lidar.py  catastro.py  ...
    normalize/
      crs.py                    # per-province/vintage CRS inference (§4.2)
      egif_parser.py            # 150-field XML -> typed
      codelists.py              # IEPNB RDF -> enums
    harmonize/
      reconcile.py              # EGIF <-> EFFIS matching (§4.3)
      grids.py                  # 1 km / 25 m grid definitions
    features/
      registry.py               # feature spec with as_of_offset enforcement
      meteo.py  fuel.py  topo.py  anthro.py  socio.py
    models/
      ignition/  size/  spread/  exposure/  optimize/
    products/
      tiles.py  api/  reports/
    provenance/
      manifest.py  merkle.py  verify.py
  dagster_defs/
  tests/
    unit/  integration/  fixtures/   # small golden fixtures per source
  reports/
  docs/
    adr/                        # architecture decision records
    data-notes/                 # one note per source: quirks, contacts, gotchas
```

The `docs/data-notes/` directory is load-bearing. Most of the real knowledge in a project like this is undocumented source quirks, and if it lives only in the code it is unrecoverable.

---

## 12. Roadmap

| Milestone | Deliverable | Acceptance criteria |
|---|---|---|
| **M0 — Skeleton** (1 wk) | Repo, Dagster, provenance layer, LICENSES.yaml, CI | A trivial asset builds, its manifest verifies, and a rebuild reproduces the hash |
| **M1 — EGIF** (2–3 wk) | Full EGIF parsed, CRS-corrected, code lists decoded | ≥98% of records geolocate inside their declared municipality; parser output cross-checks against the Civio dataset with differences explained |
| **M2 — EFFIS + reconciliation** (2 wk) | P1 harmonised fire record | S1 met (≥95% reconciliation for ≥100 ha); reconciliation report published |
| **M3 — Danger reanalysis** (2 wk) | P2 daily FWI grid 1980–present, CEMS + AEMET | Reproduces AEMET's published per-province EIMRI class frequencies within tolerance |
| **M4 — Fuel stack** (4–6 wk) | P3 25 m fuel layer for two pilot regions (Galicia, Andalucía) | LiDAR canopy metrics validated against IFN4 plots; R² on canopy height > 0.7 |
| **M5 — Ignition model** (3–4 wk) | P4 | S2 met: beats all four baselines under leave-region-out CV, calibration error < 0.05 |
| **M6 — Spread + exposure** (4 wk) | P5 | Simulated burn probability spatially calibrated against holdout perimeters |
| **M7 — Optimiser** (3 wk) | P6 | Greedy and MILP agree within 5% on pilot instances; treatment decay modelled |
| **M8 — Publication** (2 wk) | API, tiles, first seasonal report | S3 and S4 met; external party reproduces a published figure from its build root |

M4 is the largest single risk and the highest-value differentiator. Consider a national coarse fuel layer (MFE + CLMS-HRL, no LiDAR) as a fallback so that M5–M7 are not blocked on it.

---

## 13. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| EGIF bulk export changes format or is withdrawn | Critical | Immutable L0 snapshots mean existing work survives; maintain the Civio dataset as a secondary path; document a manual request route |
| PNOA-LiDAR coverage gaps or vintage spread too wide | High (M4) | Vintage recorded per cell; coarse fallback layer; restrict fuel-dependent conclusions to well-covered regions |
| Cause coding too noisy for cause-decomposed models | Medium | Fall back to lightning-vs-other binary, which is the reliable split |
| Compute for national 25 m spread Monte Carlo exceeds one box | Medium | Region-partitioned simulation; reduce ensemble size with variance-reduction sampling |
| Regional data acquisition becomes a time sink | Medium | Regional adapters are explicitly optional plugins (§3.3) |
| Outputs misread as property-level risk scores | High (reputational) | Cell-level exposure outputs not published; municipal aggregation for public products; explicit disclaimer in output metadata |

---

## 14. Open questions

1. **Fuel model taxonomy** — Scott & Burgan, Prometheus, or the UCO40 Spanish adaptation? Affects the MFE crosswalk and the spread simulator's parameter set. Needs a decision before M4.
2. **Is a national 25 m fuel layer achievable**, or should the design commit to region-by-region rollout from the start?
3. **Canarias** — separate CRS, separate fire regime, separate danger raster. Own pipeline branch, or exclude from v1?
4. **Portugal** — including ICNF makes the Galicia/Extremadura models substantially better but doubles the harmonisation surface. Phase 2?
5. **Prescribed burn and grazing registries** — held regionally, quality unknown. Without them the treatment-effectiveness decay model is uncalibrated. Worth a scoping call to REDIAM and Bombers de la Generalitat before M7.
6. **Publication posture** — open dataset release, or research outputs only? This determines how hard §4.6.b has to bite.

---

## Appendix A — Attribution strings

Required in every product's metadata and in any publication:

- Copernicus products: `Contains modified Copernicus <service> information [YEAR]`
- CEMS fire danger: Copernicus Climate Change Service, Climate Data Store (2019), *Fire danger indices historical data from the Copernicus Emergency Management Service*, DOI 10.24381/cds.0e89c522
- EFFIS: per the EFFIS data licence, plus JRC attribution
- EGIF: MITECO / ADCIF / CCINIF
- AEMET: © AEMET
- CNIG/IGN, Catastro, INE: per their respective reuse notices
- OpenStreetMap: © OpenStreetMap contributors, ODbL
