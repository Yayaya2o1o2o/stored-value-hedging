import json, sys
import numpy as np
import optimizer as opt
from optimizer import simulate_demand_paths, path_costs
from price_process import simulate_prices

with open("results/forecasting_summary.json") as f:
    fc = json.load(f)
S0, HORIZON, N = 100.0, 180, 4000
dmu = fc["mean_daily_redemption"] / S0
d_hat = dmu * HORIZON
base_cv = fc["forecast_cv"]
gamma, prem = float(sys.argv[1]), float(sys.argv[2])
opt.FWD_PREMIUM = prem

for sigma in [0.10, 0.25, 0.45]:
    for mult in [0.5, 1.5, 3.0]:
        cv = base_cv * mult
        dem = simulate_demand_paths(N, HORIZON, dmu, cv, seed=11)
        pr = simulate_prices(N, HORIZON, s0=S0, sigma_annual=sigma, seed=22)
        rows = []
        for h in np.arange(0, 1.0001, 0.1):
            c = path_costs(h, dem, pr, S0, d_hat)
            rows.append((h, c.mean() + gamma * c.std()))
        best = min(rows, key=lambda r: r[1])
        curve = " ".join(f"{j/1000:.0f}" for _, j in rows)
        print(f"vol={sigma:.2f} dem_mult={mult:.1f} h*={best[0]:.1f}  J(h)k: {curve}")
