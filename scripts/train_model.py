#!/usr/bin/env python3
"""Train the experimental season-outlook model from the ETL snapshots.

A ridge regression on the comunidad-year panel (2007 onwards):
  target   log1p(annual MODIS burned area, ha)     [gwis-banf.json]
  features regional seasonal climate               [climate-regions-esp.json]
           log1p(mean burned area, prior 3 years)  [gwis-banf.json]
           region fixed effects (one-hot)

Validated leave-one-year-out (a whole fire season is never in its own
training set — the honest test for this panel). Exports coefficients,
standardization, CV metrics and LOYO residual quantiles to
app/data/model-esp.json for in-browser inference.

Requires numpy (installed by the workflow).
"""
from __future__ import annotations

import json
import math
from datetime import date
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "app" / "data"

CLIMATE_FEATURES = ["spring_precip", "presummer_precip", "summer_tmax", "summer_wind"]
LAMBDA_GRID = [0.3, 1.0, 3.0, 10.0, 30.0]


def load(name: str):
    return json.loads((DATA / name).read_text())


def build_panel():
    banf = load("gwis-banf.json")["series"]
    climate = load("climate-regions-esp.json")["regions"]
    gids = sorted(set(banf) & set(climate) - {"ESP"})
    current_year = date.today().year

    ba = {}  # (gid, year) -> hectares (missing year in the series = 0)
    for gid in gids:
        for row in banf[gid]["years"]:
            ba[(gid, int(row["year"]))] = float(row["ba_area_ha"] or 0.0)

    rows = []
    for gid in gids:
        crows = {r["year"]: r for r in climate[gid]["years"]}
        for year in range(2007, current_year + 1):
            c = crows.get(year)
            if not c or any(
                k not in c or c.get(f"{k}_partial") for k in CLIMATE_FEATURES
            ):
                continue
            prior = [ba.get((gid, y), 0.0) for y in (year - 3, year - 2, year - 1)]
            feats = [c[k] for k in CLIMATE_FEATURES] + [
                math.log1p(sum(prior) / len(prior))
            ]
            rows.append({
                "gid": gid,
                "year": year,
                "x": feats,
                # the running year has no consolidated target yet
                "y": None if year == current_year else math.log1p(ba.get((gid, year), 0.0)),
            })
    return gids, rows


def design(rows, gids, mean, std):
    n_num = len(CLIMATE_FEATURES) + 1
    X = []
    for r in rows:
        num = [(r["x"][i] - mean[i]) / std[i] for i in range(n_num)]
        onehot = [1.0 if r["gid"] == g else 0.0 for g in gids]
        X.append(num + onehot + [1.0])  # intercept last
    return np.array(X)


def fit_ridge(X, y, lam):
    n_feat = X.shape[1]
    penalty = lam * np.eye(n_feat)
    penalty[-1, -1] = 0.0  # never penalise the intercept
    return np.linalg.solve(X.T @ X + penalty, X.T @ y)


def main() -> None:
    gids, rows = build_panel()
    train = [r for r in rows if r["y"] is not None]
    if len(train) < 150:
        raise SystemExit(f"panel too small to train: {len(train)} rows")

    n_num = len(CLIMATE_FEATURES) + 1
    raw = np.array([r["x"] for r in train])
    mean = raw[:, :n_num].mean(axis=0).tolist()
    std = [s if s > 1e-9 else 1.0 for s in raw[:, :n_num].std(axis=0)]
    y = np.array([r["y"] for r in train])
    years = sorted({r["year"] for r in train})

    best = None
    for lam in LAMBDA_GRID:
        preds = np.zeros(len(train))
        for held in years:
            tr = [i for i, r in enumerate(train) if r["year"] != held]
            te = [i for i, r in enumerate(train) if r["year"] == held]
            Xtr = design([train[i] for i in tr], gids, mean, std)
            Xte = design([train[i] for i in te], gids, mean, std)
            w = fit_ridge(Xtr, y[tr], lam)
            preds[te] = Xte @ w
        resid = y - preds
        ss_res = float((resid**2).sum())
        ss_tot = float(((y - y.mean()) ** 2).sum())
        r2 = 1 - ss_res / ss_tot
        mae = float(np.abs(resid).mean())
        print(f"lambda={lam}: LOYO R2(log)={r2:.3f} MAE(log)={mae:.3f}")
        if best is None or r2 > best["cv_r2_log"]:
            best = {
                "lambda": lam,
                "cv_r2_log": round(r2, 3),
                "cv_mae_log": round(mae, 3),
                "cv_mae_factor": round(math.exp(mae), 2),
                "resid_q10": round(float(np.quantile(resid, 0.10)), 3),
                "resid_q90": round(float(np.quantile(resid, 0.90)), 3),
            }

    w = fit_ridge(design(train, gids, mean, std), y, best["lambda"])
    model = {
        "kind": "ridge log1p(ba_ha) ~ regional climate + prior burn + region",
        "numeric_features": CLIMATE_FEATURES + ["log1p_prior3_ba"],
        "mean": [round(v, 4) for v in mean],
        "std": [round(float(v), 4) for v in std],
        "regions": gids,
        "coef": [round(float(v), 5) for v in w[:-1]],
        "intercept": round(float(w[-1]), 5),
        "n_train": len(train),
        "years": [years[0], years[-1]],
        "validation": "leave-one-year-out",
        **best,
    }
    out = DATA / "model-esp.json"
    from datetime import datetime, timezone
    model = {"generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), **model}
    out.write_text(json.dumps(model, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"wrote {out} ({out.stat().st_size} bytes), n={len(train)}, "
          f"R2={best['cv_r2_log']}, factor={best['cv_mae_factor']}")


if __name__ == "__main__":
    main()
