"""Core contribution: hedge-ratio optimization under uncertain redemption.

Decision problem
----------------
At t=0 the issuer has sold price locks at P_lock per unit and forecasts
total redemption demand over horizon T as D ~ (D_hat, sigma_D) with an
uncertain daily arrival profile. The issuer chooses a hedge ratio
h in [0,1]: it buys h * D_hat units forward at F (locking cost), leaving
the remainder to be procured at spot when customers redeem.

Cost function (per Monte Carlo path)
------------------------------------
Locks were sold at P_lock (the prevailing spot/forward at issuance); the
issuer hedges with forwards at F = P_lock * (1 + delta), where delta is the
hedging premium (transaction costs plus the risk premium paid to the long
side; Keynes-Hicks normal backwardation). The issuer's hedging error is the
NET cost relative to locked-in revenue:

  N(h) = (F - P_lock) * min(D_total, Q_h)          (premium on used cover)
       + sum_t (S_t - P_lock) * U_t                (unhedged spot exposure)
       + (F - S_T) * L                             (close-out of unused cover)
       + lambda_c * m * F * Q_h * (T/252)          (capital cost on margin)
       + pi * max_t(cash shortfall_t)              (liquidity spike penalty)

where Q_h = h * D_hat, U_t = unhedged units redeemed on day t (hedged units
are consumed first), L = hedged units left unused at T, m = initial margin
per $ of notional. Under-hedging costs money when S_t rises above F on
redeemed volume; over-hedging turns leftover cover into a speculative
close-out at S_T (a loss precisely when demand came in low and prices
fell) and ties up margin capital the issuer may need for redemptions.
This is the stored-value analogue of hedging under joint price/quantity
uncertainty (McKinnon, 1967; Rolfo, 1980).

Objective: minimize  J(h) = E[N(h)] + gamma * sd(N(h))

A two-sided dispersion objective in the hedging-effectiveness tradition
(Ederington, 1979): over-covering that produces windfall-or-loss lottery
outcomes is penalized symmetrically, which is what generates the classic
interior optimum under quantity uncertainty (McKinnon, 1967; Rolfo, 1980).
CVaR_95 (Rockafellar & Uryasev, 2000) is computed and reported as a tail
diagnostic alongside the objective.

Benchmarks: h=0 (no hedge), h=0.5 (static half hedge), h=1 (full hedge on
the point forecast), and a trailing-average rule that sizes the hedge from
the last 30 observed days of redemptions (naive practitioner heuristic).
"""

import numpy as np
from price_process import simulate_prices

# ---- economic constants (assumptions, stated in the paper) -----------------
LAMBDA_C = 0.08     # annualized opportunity cost of capital tied to the hedge
MARGIN = 0.10       # initial margin posted per $ of forward notional
FWD_PREMIUM = 0.015  # hedging premium over P_lock (txn cost + risk premium)
PI_LIQ = 0.02       # penalty per $ of peak cash shortfall (forced funding)
GAMMA = 1.0         # risk (sd) weight in the objective
CVAR_ALPHA = 0.95   # tail level for the reported CVaR diagnostic
CASH_BUFFER = 0.10  # issuer holds 10% of expected demand value as free cash


def simulate_demand_paths(n_paths, n_days, daily_mean, forecast_cv, seed=7):
    """Daily redemption paths ($ value / P_lock = units; normalized so
    P_lock = F = S0, i.e., locks were sold at the prevailing forward).

    Demand uncertainty has two parts: (i) day-to-day noise around the
    profile, and (ii) a path-level level shock (aggregate demand higher or
    lower than forecast), both scaled by forecast_cv.
    """
    rng = np.random.default_rng(seed)
    dow = np.tile(np.array([0.90, 0.90, 0.95, 1.00, 1.15, 1.25, 0.85]),
                  n_days // 7 + 1)[:n_days]
    profile = daily_mean * dow / dow.mean()
    level_shock = rng.lognormal(mean=-(forecast_cv * 1.5) ** 2 / 2,
                                sigma=forecast_cv * 1.5, size=(n_paths, 1))
    daily_noise = rng.lognormal(mean=-(forecast_cv) ** 2 / 2,
                                sigma=forecast_cv, size=(n_paths, n_days))
    return profile[None, :] * level_shock * daily_noise


def path_costs(h, demand, prices, p_lock, d_hat_total):
    """Vectorized net cost of hedge ratio h across all MC paths."""
    n_paths, n_days = demand.shape
    f_price = p_lock * (1.0 + FWD_PREMIUM)
    q_hedged = h * d_hat_total                       # units covered forward
    cum_d = np.cumsum(demand, axis=1)
    # hedged units consumed first: coverage remaining after each day
    used_hedge = np.minimum(cum_d, q_hedged)
    unhedged_daily = demand - np.diff(
        np.concatenate([np.zeros((n_paths, 1)), used_hedge], axis=1), axis=1)
    # net exposure on unhedged redemptions: pay S_t, earned P_lock
    spot_exposure = (unhedged_daily * (prices[:, 1:] - p_lock)).sum(axis=1)
    # hedged units cost F against P_lock revenue: certain premium leakage
    used_total = np.minimum(cum_d[:, -1], q_hedged)
    premium_cost = (f_price - p_lock) * used_total
    # leftover cover is closed out at T at (F - S_T) per unit
    leftover = q_hedged - used_total
    closeout = (f_price - prices[:, -1]) * leftover
    # only margin is committed, not the notional
    capital_cost = LAMBDA_C * MARGIN * f_price * q_hedged * (n_days / 252.0)

    # liquidity: margin committed to the hedge is unavailable; shortfall
    # occurs when cumulative redemption outflow exceeds free cash + float
    free_cash = CASH_BUFFER * p_lock * d_hat_total
    committed = MARGIN * f_price * q_hedged
    cum_outflow_value = np.cumsum(demand * p_lock, axis=1)
    inflow = p_lock * d_hat_total  # customer prepayments held (normalized)
    shortfall = np.maximum(
        cum_outflow_value + committed - (inflow + free_cash), 0.0)
    liq_penalty = PI_LIQ * shortfall.max(axis=1)

    return spot_exposure + premium_cost + closeout + capital_cost + liq_penalty


def objective(costs):
    mean = costs.mean()
    sd = costs.std()
    tail = np.sort(costs)[int(len(costs) * CVAR_ALPHA):]
    cvar = tail.mean()
    return mean + GAMMA * sd, mean, sd, cvar


def optimize(demand, prices, p_lock, d_hat_total, h_grid=None):
    if h_grid is None:
        h_grid = np.round(np.arange(0.0, 1.0001, 0.05), 2)
    rows = []
    for h in h_grid:
        c = path_costs(h, demand, prices, p_lock, d_hat_total)
        j, mean, sd, cvar = objective(c)
        rows.append({"h": float(h), "J": float(j), "mean_cost": float(mean),
                     "std": float(sd), "cvar95": float(cvar)})
    best = min(rows, key=lambda r: r["J"])
    return best, rows


def trailing_average_h(recent_daily, d_hat_total, n_days):
    """Naive rule: hedge the volume implied by the trailing 30-day average."""
    implied_total = np.mean(recent_daily[-30:]) * n_days
    return float(np.clip(implied_total / d_hat_total, 0.0, 1.0))
