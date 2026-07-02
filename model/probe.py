"""Quick parameter probe: sweep objective curves without re-running forecasting."""
import json
import numpy as np
import optimizer as opt
from optimizer import simulate_demand_paths, path_costs, objective
from price_process import simulate_prices

with open("results/forecasting_summary.json") as f:
    fc = json.load(f)

S0 = 100.0
HORIZON = 180
N = 4000
daily_mean_units = fc["mean_daily_redemption"] / S0
d_hat = daily_mean_units * HORIZON
base_cv = fc["forecast_cv"]

import sys
gamma, prem = float(sys.argv[1]), float(sys.argv[2])
vols = json.loads(sys.argv[3])
dems = json.loads(sys.argv[4])
opt.GAMMA = gamma
opt.FWD_PREMIUM = prem

for sigma in vols:
    for mult in dems:
        cv = base_cv * mult
        dem = simulate_demand_paths(N, HORIZON, daily_mean_units, cv, seed=11)
        pr = simulate_prices(N, HORIZON, s0=S0, sigma_annual=sigma, seed=22)
        rows = []
        for h in np.arange(0, 1.0001, 0.1):
            c = path_costs(h, dem, pr, S0, d_hat)
            j, m, cv95 = objective(c)
            rows.append((h, j))
        best = min(rows, key=lambda r: r[1])
        curve = " ".join(f"{j/1000:.0f}" for _, j in rows)
        print(f"vol={sigma:.2f} dem_mult={mult:.1f} h*={best[0]:.1f}  J(h)k: {curve}")
