import curvesJson from "./objective_curves.json";
import gridJson from "./scenario_grid.json";
import forecastJson from "./forecasting_summary.json";

export type CurvePoint = {
  h: number;
  J: number;
  mean_cost: number;
  std: number;
  cvar95: number;
};

type CurveMap = Record<string, CurvePoint[]>;

export const curves = curvesJson as CurveMap;
export const grid = gridJson as Array<{
  volatility: string;
  sigma_annual: number;
  demand_uncertainty: string;
  forecast_cv: number;
  optimal: CurvePoint;
  benchmarks: Record<string, CurvePoint & { h: number }>;
  savings_vs_benchmarks_pct: Record<string, number>;
}>;
export const forecasting = forecastJson as {
  train_days: number;
  test_days: number;
  ARIMA: { MAE: number; RMSE: number };
  LSTM: { MAE: number; RMSE: number };
  winner: string;
  residual_sigma: number;
  mean_daily_redemption: number;
  forecast_cv: number;
};

export const HORIZON_DAYS = 180;
export const S0 = 100;
export const BUDGET =
  (forecasting.mean_daily_redemption / S0) * HORIZON_DAYS * S0;

export const VOL_LEVELS = [0.1, 0.25, 0.45];
export const VOL_NAMES = ["low", "medium", "high"];
export const CV_LEVELS = [
  grid.find((g) => g.demand_uncertainty === "low")!.forecast_cv,
  grid.find((g) => g.demand_uncertainty === "medium")!.forecast_cv,
  grid.find((g) => g.demand_uncertainty === "high")!.forecast_cv,
];
export const CV_NAMES = ["low", "medium", "high"];

function cellCurve(volIdx: number, cvIdx: number): CurvePoint[] {
  return curves[`${VOL_NAMES[volIdx]}|${CV_NAMES[cvIdx]}`];
}

/** Locate x within sorted levels; returns [lowerIdx, weight toward upper]. */
function bracket(x: number, levels: number[]): [number, number] {
  if (x <= levels[0]) return [0, 0];
  if (x >= levels[levels.length - 1]) return [levels.length - 2, 1];
  for (let i = 0; i < levels.length - 1; i++) {
    if (x <= levels[i + 1]) {
      return [i, (x - levels[i]) / (levels[i + 1] - levels[i])];
    }
  }
  return [levels.length - 2, 1];
}

/**
 * Bilinear interpolation of the simulated objective curves J(h) over
 * (volatility, forecast CV). Returns the interpolated 21-point curve.
 * Interpolating the curves (rather than h*) keeps the recommendation
 * consistent with the underlying Monte Carlo surface.
 */
export function interpolateCurve(
  sigma: number,
  cv: number
): { h: number; J: number }[] {
  const [vi, vw] = bracket(sigma, VOL_LEVELS);
  const [ci, cw] = bracket(cv, CV_LEVELS);
  const c00 = cellCurve(vi, ci);
  const c01 = cellCurve(vi, ci + 1);
  const c10 = cellCurve(vi + 1, ci);
  const c11 = cellCurve(vi + 1, ci + 1);
  return c00.map((p, k) => ({
    h: p.h,
    J:
      (1 - vw) * (1 - cw) * c00[k].J +
      (1 - vw) * cw * c01[k].J +
      vw * (1 - cw) * c10[k].J +
      vw * cw * c11[k].J,
  }));
}

export type Recommendation = {
  hStar: number;
  J: number;
  curve: { h: number; J: number }[];
  savingsVsNoHedgePct: number;
  savingsVsHalfPct: number;
  savingsVsFullPct: number;
};

export function recommend(sigma: number, cv: number): Recommendation {
  const curve = interpolateCurve(sigma, cv);
  const best = curve.reduce((a, b) => (b.J < a.J ? b : a));
  const at = (h: number) =>
    curve.reduce((a, b) => (Math.abs(b.h - h) < Math.abs(a.h - h) ? b : a)).J;
  const pct = (bench: number) => (100 * (bench - best.J)) / BUDGET;
  return {
    hStar: best.h,
    J: best.J,
    curve,
    savingsVsNoHedgePct: pct(at(0)),
    savingsVsHalfPct: pct(at(0.5)),
    savingsVsFullPct: pct(at(1)),
  };
}
