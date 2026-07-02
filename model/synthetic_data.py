"""Synthetic stored-value load/redemption data generator.

Generates daily aggregate cardholder behavior for a generic stored-value
product with a locked-in price on a volatile underlying. Calibration targets
are drawn from the prepaid/gift-card literature rather than any single firm:

- Redemption is concentrated early in card life and decays with age
  (breakage literature; Horne, 2007; FASB ASC 606 breakage guidance).
- Aggregate breakage (never-redeemed value) is set to ~8% of loaded value,
  within the 5-10% range commonly cited for open- and closed-loop prepaid
  products (Horne, 2007; CFPB, 2016).
- Loads exhibit payday-cycle spikes (1st and 15th), day-of-week structure
  (weekend peaks for consumer redemption), and mild annual seasonality.

All parameters are ASSUMPTIONS, stated here and in the paper; the framework
is deliberately not calibrated to any specific commodity or company.
"""

import numpy as np
import pandas as pd

RNG_SEED = 42


def generate_panel(n_days: int = 730, seed: int = RNG_SEED,
                   demand_dispersion: float = 1.0) -> pd.DataFrame:
    """Simulate daily aggregate loads and redemptions (in $).

    demand_dispersion scales the idiosyncratic noise on both series and is
    the lever used to construct low/medium/high demand-uncertainty scenarios.
    """
    rng = np.random.default_rng(seed)
    dates = pd.date_range("2024-01-01", periods=n_days, freq="D")
    t = np.arange(n_days)

    # ---- Loads -------------------------------------------------------------
    base_load = 50_000.0                       # mean daily $ loaded (scale-free)
    dow = dates.dayofweek.values
    dow_mult = np.array([0.95, 0.92, 0.94, 1.00, 1.18, 1.12, 0.89])[dow]
    payday = np.where(np.isin(dates.day, [1, 15]), 1.35, 1.0)
    annual = 1.0 + 0.10 * np.sin(2 * np.pi * (t - 30) / 365.25)
    growth = 1.0 + 0.15 * t / n_days           # modest adoption growth
    load_noise = rng.lognormal(mean=0.0, sigma=0.12 * demand_dispersion, size=n_days)
    loads = base_load * dow_mult * payday * annual * growth * load_noise

    # ---- Redemptions via age-dependent redemption hazard -------------------
    # Each day's loaded cohort redeems over subsequent days following a
    # discretized Gamma(k=1.6, theta=14) lag distribution (mode ~1-2 weeks,
    # long right tail), truncated at 180 days; 8% of value never redeems.
    breakage = 0.08
    max_lag = 180
    lag = np.arange(1, max_lag + 1)
    k, theta = 1.6, 14.0
    pdf = lag ** (k - 1) * np.exp(-lag / theta)
    pdf = pdf / pdf.sum() * (1.0 - breakage)

    redemptions = np.zeros(n_days)
    for d in range(n_days):
        horizon = min(max_lag, n_days - d - 1)
        if horizon > 0:
            redemptions[d + 1:d + 1 + horizon] += loads[d] * pdf[:horizon]

    # Redemption-side modulation: weekend-heavy usage + noise
    red_dow_mult = np.array([0.90, 0.90, 0.95, 1.00, 1.15, 1.25, 0.85])[dow]
    red_noise = rng.lognormal(mean=0.0, sigma=0.10 * demand_dispersion, size=n_days)
    redemptions = redemptions * red_dow_mult * red_noise
    # renormalize so aggregate breakage target still holds approximately
    redemptions *= (1 - breakage) * loads[:n_days - max_lag].sum() / max(
        redemptions[:n_days - max_lag].sum(), 1e-9)

    df = pd.DataFrame({"date": dates, "loaded": loads, "redeemed": redemptions})
    df["outstanding"] = (df["loaded"] - df["redeemed"]).cumsum()
    return df


if __name__ == "__main__":
    df = generate_panel()
    print(df.describe().round(0))
    print("implied breakage-ish ratio:",
          round(1 - df.redeemed.sum() / df.loaded.sum(), 3))
