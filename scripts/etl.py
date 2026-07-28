#!/usr/bin/env python3
"""ETL: snapshot the dashboard's upstream data into app/data/*.json.

Fetches, so the site serves same-origin snapshots instead of hitting the
Copernicus APIs from every visitor's browser:
  - EFFIS weekly fire statistics for Spain  -> effis-weekly-esp.json
  - GWIS annual burned-area series (national + comunidades) -> gwis-banf.json
  - ERA5 seasonal climate aggregates (Open-Meteo archive)   -> climate-esp.json

Run by .github/workflows/etl.yml on a schedule; safe to run manually.
Stdlib only, no dependencies.
"""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "app" / "data"

EFFIS_WEEKLY = "https://api2.effis.emergency.copernicus.eu/statistics/v2/effis/weekly?country=ESP"
CPROF = "https://cprof.effis.emergency.copernicus.eu/api/v3"
OPEN_METEO = "https://archive-api.open-meteo.com/v1/archive"

# Must match REGIONS in app/app.js (GADM admin-1 as served by the GWIS API).
REGIONS = {
    "ESP": "España",
    "ESP.1_1": "Andalucía",
    "ESP.2_1": "Aragón",
    "ESP.3_1": "Cantabria",
    "ESP.4_1": "Castilla-La Mancha",
    "ESP.5_1": "Castilla y León",
    "ESP.6_1": "Cataluña",
    "ESP.7_1": "Ceuta y Melilla",
    "ESP.8_1": "Comunidad de Madrid",
    "ESP.9_1": "Comunidad Foral de Navarra",
    "ESP.10_1": "Comunidad Valenciana",
    "ESP.11_1": "Extremadura",
    "ESP.12_1": "Galicia",
    "ESP.13_1": "Islas Baleares",
    "ESP.14_1": "Islas Canarias",
    "ESP.15_1": "La Rioja",
    "ESP.16_1": "País Vasco",
    "ESP.17_1": "Principado de Asturias",
    "ESP.18_1": "Región de Murcia",
}

EUROSTAT = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/agr_r_animal"

# GADM admin-1 -> Eurostat NUTS2 (Ceuta y Melilla are two NUTS2 codes).
GID_TO_NUTS2 = {
    "ESP.1_1": ["ES61"], "ESP.2_1": ["ES24"], "ESP.3_1": ["ES13"],
    "ESP.4_1": ["ES42"], "ESP.5_1": ["ES41"], "ESP.6_1": ["ES51"],
    "ESP.7_1": ["ES63", "ES64"], "ESP.8_1": ["ES30"], "ESP.9_1": ["ES22"],
    "ESP.10_1": ["ES52"], "ESP.11_1": ["ES43"], "ESP.12_1": ["ES11"],
    "ESP.13_1": ["ES53"], "ESP.14_1": ["ES70"], "ESP.15_1": ["ES23"],
    "ESP.16_1": ["ES21"], "ESP.17_1": ["ES12"], "ESP.18_1": ["ES62"],
}

# Sample points spread over peninsular Spain for the national climate signal
# (ERA5 point extraction via Open-Meteo; fires are overwhelmingly peninsular).
CLIMATE_POINTS = [
    (43.37, -8.40), (43.36, -5.85), (42.60, -5.57), (42.34, -7.86),
    (41.65, -4.72), (41.65, -0.88), (41.39, 2.17), (40.42, -3.70),
    (39.47, -6.37), (39.86, -4.02), (39.47, -0.38), (37.89, -4.78),
    (37.39, -5.99), (37.18, -3.60), (37.99, -1.13),
]
CLIMATE_START_YEAR = 2005


def get_json(url: str, tries: int = 3, timeout: int = 60):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "firewatcher-etl"})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as exc:  # noqa: BLE001 - retry any transport error
            last = exc
            time.sleep(2 * (i + 1))
    raise RuntimeError(f"failed after {tries} tries: {url}") from last


def write(name: str, payload: dict) -> None:
    payload = {"generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), **payload}
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / name
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"wrote {path} ({path.stat().st_size} bytes)")


def etl_effis_weekly() -> None:
    data = get_json(EFFIS_WEEKLY)
    weeks = data.get("banfweekly")
    if not isinstance(weeks, list) or len(weeks) < 10:
        raise RuntimeError("effis weekly: unexpected shape")
    write("effis-weekly-esp.json", {"banfweekly": weeks})


def etl_gwis_banf() -> None:
    year = date.today().year
    series = {}
    for gid, name in REGIONS.items():
        level = "ADM0" if gid == "ESP" else "ADM1"
        url = f"{CPROF}/banf?level={level}&value={gid}&year={year}&yearFrom=2006&yearTo={year}&env=PROD"
        data = get_json(url)
        years = [
            {
                "year": d.get("year"),
                "ba_area_ha": d.get("ba_area_ha"),
                "ba_count": d.get("ba_count"),
                "firesize": d.get("firesize"),
            }
            for d in data.get("banfyear", [])
            if isinstance(d.get("year"), (int, float))
        ]
        if not years:
            raise RuntimeError(f"gwis banf: empty series for {gid}")
        series[gid] = {"name": name, "years": years}
        time.sleep(0.3)
    write("gwis-banf.json", {"series": series})


def season_slices(year: int):
    return {
        "spring_precip": (date(year, 3, 1), date(year, 5, 31), "precipitation_sum", "sum"),
        "presummer_precip": (date(year - 1, 10, 1), date(year, 5, 31), "precipitation_sum", "sum"),
        "summer_tmax": (date(year, 6, 1), date(year, 8, 31), "temperature_2m_max", "mean"),
        "summer_wind": (date(year, 6, 1), date(year, 8, 31), "wind_speed_10m_max", "mean"),
    }


def etl_climate() -> None:
    # ERA5 publishes with ~5 days delay.
    end = date.today() - timedelta(days=7)
    start = date(CLIMATE_START_YEAR - 1, 10, 1)  # need Oct of the prior year
    daily_vars = "precipitation_sum,temperature_2m_max,wind_speed_10m_max"

    # date -> [per-var running aggregates across points]
    frames: dict[str, dict[str, float]] = {}
    counts: dict[str, dict[str, int]] = {}
    for lat, lon in CLIMATE_POINTS:
        q = urllib.parse.urlencode({
            "latitude": lat,
            "longitude": lon,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "daily": daily_vars,
            "timezone": "UTC",
        })
        data = get_json(f"{OPEN_METEO}?{q}", timeout=120)
        daily = data["daily"]
        for i, day in enumerate(daily["time"]):
            f = frames.setdefault(day, {})
            c = counts.setdefault(day, {})
            for var in daily_vars.split(","):
                v = daily[var][i]
                if v is None:
                    continue
                f[var] = f.get(var, 0.0) + v
                c[var] = c.get(var, 0) + 1
        time.sleep(0.5)

    # point-mean per day
    per_day = {
        day: {var: f[var] / counts[day][var] for var in f}
        for day, f in frames.items()
    }

    years = []
    for year in range(CLIMATE_START_YEAR, end.year + 1):
        row = {"year": year}
        for key, (d0, d1, var, how) in season_slices(year).items():
            vals = [
                per_day[d][var]
                for d in (
                    (d0 + timedelta(days=n)).isoformat()
                    for n in range((min(d1, end) - d0).days + 1)
                )
                if d in per_day and var in per_day[d]
            ]
            if not vals:
                continue
            agg = sum(vals) if how == "sum" else sum(vals) / len(vals)
            row[key] = round(agg, 1)
            if d1 > end:
                row[key + "_partial"] = True
        years.append(row)

    write("climate-esp.json", {
        "points": len(CLIMATE_POINTS),
        "source": "ERA5 via Open-Meteo archive API",
        "years": years,
    })


def jsonstat_cells(data):
    """Yield (coords: dict dim->code, value) for a JSON-stat 2.0 response."""
    dims = data["id"]
    sizes = data["size"]
    codes = []
    for d in dims:
        index = data["dimension"][d]["category"]["index"]
        if isinstance(index, dict):
            by_pos = sorted(index.items(), key=lambda kv: kv[1])
            codes.append([code for code, _ in by_pos])
        else:  # plain list
            codes.append(list(index))
    for key, value in data["value"].items():
        if value is None:
            continue
        idx = int(key)
        coords = {}
        for d, size, cs in zip(reversed(dims), reversed(sizes), reversed(codes)):
            idx, pos = divmod(idx, size)
            coords[d] = cs[pos]
        yield coords, value


def etl_livestock() -> None:
    geos = sorted({g for pair in GID_TO_NUTS2.values() for g in pair} | {"ES"})
    geo_q = "&".join(f"geo={g}" for g in geos)
    url = f"{EUROSTAT}?format=JSON&lang=EN&unit=THS_HD&{geo_q}"
    data = get_json(url, timeout=120)

    labels = data["dimension"]["animals"]["category"]["label"]
    print("eurostat animals codes:", json.dumps(labels, ensure_ascii=False))
    wanted = {
        code
        for code, label in labels.items()
        if "sheep" in label.lower() or "goat" in label.lower()
    }
    if not wanted:
        raise RuntimeError("no sheep/goat codes found in agr_r_animal")

    # (geo, year) -> thousand head, summed over sheep + goats
    totals: dict[tuple[str, int], float] = {}
    for coords, value in jsonstat_cells(data):
        if coords.get("animals") not in wanted:
            continue
        year = int(coords["time"])
        if year < 2005:
            continue
        key = (coords["geo"], year)
        totals[key] = totals.get(key, 0.0) + value

    def series_for(nuts_list):
        by_year: dict[int, float] = {}
        for (geo, year), v in totals.items():
            if geo in nuts_list:
                by_year[year] = by_year.get(year, 0.0) + v
        return [
            {"year": y, "ths_head": round(v, 1)} for y, v in sorted(by_year.items())
        ]

    series = {}
    for gid, nuts in GID_TO_NUTS2.items():
        s = series_for(nuts)
        if s:
            series[gid] = {"name": REGIONS[gid], "years": s}
    national = series_for(["ES"])
    if not national or len(series) < 15:
        raise RuntimeError(
            f"livestock series incomplete: national={len(national)} regions={len(series)}"
        )
    series["ESP"] = {"name": "España", "years": national}
    write("livestock-esp.json", {
        "unit": "thousand head, sheep + goats",
        "source": "Eurostat agr_r_animal (NUTS2)",
        "series": series,
    })


def main() -> None:
    failures = []
    for step in (etl_effis_weekly, etl_gwis_banf, etl_climate, etl_livestock):
        try:
            step()
        except Exception as exc:  # noqa: BLE001 - a partial refresh beats none
            failures.append(f"{step.__name__}: {exc}")
            print(f"WARN {step.__name__} failed: {exc}")
    if len(failures) == 3:
        raise SystemExit("all ETL steps failed:\n" + "\n".join(failures))


if __name__ == "__main__":
    main()
