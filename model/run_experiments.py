"""Full pipeline: synthetic data -> forecasting -> 3x3 scenario grid ->
hedge-ratio optimization vs. naive benchmarks. Writes results/ artifacts
consumed by the paper and the web app."""

import json
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from synthetic_data import generate_panel
from forecasting import run_forecasting
from price_process import simulate_prices
from optimizer import (simulate_demand_paths, path_costs, objective,
                       optimize, trailing_average_h)

N_PATHS = 12000
HORIZON = 180          # trading-day hedge horizon
S0 = 100.0             # normalized spot; P_lock = F = S0 (locks sold at fwd)
VOL_SCEN = {"low": 0.10, "medium": 0.25, "high": 0.45}
DEM_SCEN = {"low": 0.5, "medium": 1.5, "high": 3.0}   # multiplier on forecast_cv
OUT = "results"


def main():
    np.random.seed(0)

    # ---- Stage 1: synthetic panel + forecasting ----------------------------
    df = generate_panel()
    fc_summary, fc_detail = run_forecasting(df)
    print("forecasting:", json.dumps(fc_summary, indent=2))
    df.to_csv(f"{OUT}/synthetic_panel.csv", index=False)
    fc_detail.to_csv(f"{OUT}/forecast_test_window.csv", index=False)
    with open(f"{OUT}/forecasting_summary.json", "w") as f:
        json.dump(fc_summary, f, indent=2)

    daily_mean = fc_summary["mean_daily_redemption"]
    base_cv = fc_summary["forecast_cv"]
    # convert $ to units at the locked price (normalization: P_lock = S0)
    daily_mean_units = daily_mean / S0
    d_hat_total = daily_mean_units * HORIZON
    recent_daily_units = df["redeemed"].values[-60:] / S0

    # ---- Stage 2: 3x3 scenario grid ----------------------------------------
    grid_results = []
    curves = {}
    for vol_name, sigma in VOL_SCEN.items():
        for dem_name, mult in DEM_SCEN.items():
            cv = base_cv * mult
            demand = simulate_demand_paths(
                N_PATHS, HORIZON, daily_mean_units, cv,
                seed=hash((vol_name, dem_name)) % 2**31)
            prices = simulate_prices(
                N_PATHS, HORIZON, s0=S0, sigma_annual=sigma,
                seed=hash((dem_name, vol_name, "p")) % 2**31)

            best, rows = optimize(demand, prices, S0, d_hat_total)

            bench = {}
            for name, h in [("no_hedge", 0.0), ("half_hedge", 0.5),
                            ("full_hedge", 1.0),
                            ("trailing_avg", trailing_average_h(
                                recent_daily_units, d_hat_total, HORIZON))]:
                c = path_costs(h, demand, prices, S0, d_hat_total)
                j, mean, sd, cvar = objective(c)
                bench[name] = {"h": round(float(h), 3), "J": float(j),
                               "mean_cost": float(mean), "std": float(sd),
                               "cvar95": float(cvar)}

            budget = S0 * d_hat_total  # expected gross procurement budget
            savings = {k: round(100 * (v["J"] - best["J"]) / budget, 2)
                       for k, v in bench.items()}
            grid_results.append({
                "volatility": vol_name, "sigma_annual": sigma,
                "demand_uncertainty": dem_name, "forecast_cv": round(cv, 4),
                "optimal": best, "benchmarks": bench,
                "savings_vs_benchmarks_pct": savings,
            })
            curves[f"{vol_name}|{dem_name}"] = rows
            print(f"vol={vol_name:6s} dem={dem_name:6s} -> h*={best['h']:.2f} "
                  f"J={best['J']:.0f} | save vs no-hedge {savings['no_hedge']}%"
                  f" vs full {savings['full_hedge']}%")

    with open(f"{OUT}/scenario_grid.json", "w") as f:
        json.dump(grid_results, f, indent=2)
    with open(f"{OUT}/objective_curves.json", "w") as f:
        json.dump(curves, f, indent=2)

    # ---- Figures ------------------------------------------------------------
    # 1. forecast fit
    fig, ax = plt.subplots(figsize=(9, 4))
    d = fc_detail.iloc[-100:]
    ax.plot(pd.to_datetime(d["date"]), d["actual"], label="Actual", lw=1.2)
    ax.plot(pd.to_datetime(d["date"]), d["arima"], label="ARIMA", lw=1, alpha=.8)
    ax.plot(pd.to_datetime(d["date"]), d["lstm"], label="LSTM", lw=1, alpha=.8)
    ax.set_title("One-step-ahead redemption forecasts (last 100 test days)")
    ax.set_ylabel("Daily redemption ($)")
    ax.legend(); fig.tight_layout()
    fig.savefig(f"{OUT}/fig_forecast.png", dpi=150)

    # 2. objective curves, medium demand uncertainty
    fig, ax = plt.subplots(figsize=(7, 4.5))
    for vol_name in VOL_SCEN:
        rows = curves[f"{vol_name}|medium"]
        ax.plot([r["h"] for r in rows], [r["J"] for r in rows],
                marker="o", ms=3, label=f"{vol_name} volatility")
    ax.set_xlabel("Hedge ratio h"); ax.set_ylabel("Objective J(h)")
    ax.set_title("Objective vs. hedge ratio (medium demand uncertainty)")
    ax.legend(); fig.tight_layout()
    fig.savefig(f"{OUT}/fig_objective_curves.png", dpi=150)

    # 3. heatmap of optimal h
    fig, ax = plt.subplots(figsize=(5.5, 4.5))
    vols = list(VOL_SCEN); dems = list(DEM_SCEN)
    H = np.array([[next(g["optimal"]["h"] for g in grid_results
                        if g["volatility"] == v and g["demand_uncertainty"] == dm)
                   for dm in dems] for v in vols])
    im = ax.imshow(H, cmap="YlOrBr", vmin=0, vmax=1)
    ax.set_xticks(range(3), dems); ax.set_yticks(range(3), vols)
    ax.set_xlabel("Demand uncertainty"); ax.set_ylabel("Price volatility")
    for i in range(3):
        for j in range(3):
            ax.text(j, i, f"{H[i, j]:.2f}", ha="center", va="center")
    ax.set_title("Optimal hedge ratio h*")
    fig.colorbar(im); fig.tight_layout()
    fig.savefig(f"{OUT}/fig_hstar_heatmap.png", dpi=150)

    print("done — artifacts in", OUT)


if __name__ == "__main__":
    main()
