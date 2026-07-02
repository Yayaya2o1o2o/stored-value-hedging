# Dynamic Hedge-Ratio Optimization for Stored-Value Products Under Uncertain Redemption Demand

A research artifact: the first model coupling customer-driven redemption uncertainty (stored-value / prepaid instruments) to optimal hedge sizing.

- **Live site:** https://stored-value-hedging.vercel.app (interactive optimizer, results, full paper)
- **`paper/paper.md`** — full working paper (APA 7)
- **`model/`** — Python pipeline: synthetic demand panel → ARIMA/LSTM forecasting → OU price simulation → Monte Carlo hedge-ratio optimizer → 3×3 scenario grid (`results/` holds all output)
- **`web/`** — Next.js presentation site

## Reproduce

```bash
python3 -m venv .venv && .venv/bin/pip install numpy pandas statsmodels matplotlib torch
cd model && ../.venv/bin/python run_experiments.py
```

All data is synthetic, calibrated to patterns documented in the prepaid-instrument literature; the framework is deliberately company- and commodity-agnostic.
