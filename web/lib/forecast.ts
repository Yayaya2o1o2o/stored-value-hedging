/**
 * Short-horizon price forecast for a selected hex. Uses the closed-form
 * conditional mean and variance of the same OU process that drives the live
 * feed, so the projection is consistent with the map. The band is framed in
 * the paper's forecasting terms (ARIMA won the model comparison), scaled by
 * the residual dispersion reported in forecasting_summary.json.
 */
import forecast from "./forecasting_summary.json";

const KAPPA = 2.0;
const DT = 1 / 252;

// relative residual scale from the paper's forecast evaluation, used to
// widen the band beyond the pure-OU transient variance (model risk).
const RESIDUAL_REL =
  forecast.residual_sigma / forecast.mean_daily_redemption; // ~0.112

export type ForecastPoint = { day: number; expected: number; lo: number; hi: number };

/**
 * Project `days` model-days forward from the current price.
 * @param price current spot ($/gal)
 * @param baseline long-run mean ($/gal) — the hex baseline
 * @param sigma live annualized volatility
 */
export function forecastPath(
  price: number,
  baseline: number,
  sigma: number,
  days = 30
): ForecastPoint[] {
  const mu = Math.log(baseline);
  const lnS = Math.log(price);
  const out: ForecastPoint[] = [];
  for (let n = 0; n <= days; n++) {
    const t = n * DT;
    const decay = Math.exp(-KAPPA * t);
    const meanLn = mu + (lnS - mu) * decay;
    // OU transient variance of ln S over horizon t
    const ouVar = (sigma * sigma) * (1 - Math.exp(-2 * KAPPA * t)) / (2 * KAPPA);
    // add model/forecast risk that grows with horizon
    const modelSd = RESIDUAL_REL * Math.sqrt(t) * 0.5;
    const sd = Math.sqrt(ouVar) + modelSd;
    const expected = Math.exp(meanLn);
    out.push({
      day: n,
      expected,
      lo: Math.exp(meanLn - 1.28 * sd), // ~80% band
      hi: Math.exp(meanLn + 1.28 * sd),
    });
  }
  return out;
}

export const FORECAST_WINNER = forecast.winner; // "ARIMA"
