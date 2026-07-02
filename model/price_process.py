"""Underlying asset price simulation.

The underlying is modeled as a mean-reverting Ornstein-Uhlenbeck process on
log price (one-factor Schwartz, 1997). Mean reversion is chosen over pure
GBM because the illustrative asset class for stored-value price locks —
commodities and energy — empirically exhibits reversion toward long-run
marginal cost (Schwartz, 1997). This component is deliberately standard;
it is an input to the optimizer, not a contribution of the paper.

  d ln S_t = kappa * (mu - ln S_t) dt + sigma dW_t
"""

import numpy as np


def simulate_prices(n_paths: int, n_days: int, s0: float = 100.0,
                    kappa: float = 2.0, sigma_annual: float = 0.25,
                    seed: int = 123) -> np.ndarray:
    """Return (n_paths, n_days+1) array of daily spot prices.

    kappa: mean-reversion speed per year (Schwartz-type one-factor value).
    sigma_annual: annualized log-price volatility (scenario lever).
    """
    rng = np.random.default_rng(seed)
    dt = 1.0 / 252.0
    mu = np.log(s0)
    x = np.full(n_paths, mu)
    out = np.empty((n_paths, n_days + 1))
    out[:, 0] = s0
    drift_coef = np.exp(-kappa * dt)
    # exact discretization of OU
    stat_sd = sigma_annual * np.sqrt((1 - np.exp(-2 * kappa * dt)) / (2 * kappa))
    for t in range(1, n_days + 1):
        x = mu + (x - mu) * drift_coef + stat_sd * rng.standard_normal(n_paths)
        out[:, t] = np.exp(x)
    return out
