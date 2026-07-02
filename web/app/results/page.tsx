"use client";

import Image from "next/image";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  ResponsiveContainer,
} from "recharts";
import { curves, grid, forecasting } from "@/lib/model";

const MONO = "var(--font-plex-mono)";
const VOL_COLOR: Record<string, string> = {
  low: "#9aa98f",
  medium: "#4a6b8a",
  high: "#c05b2e",
};

export default function ResultsPage() {
  // objective curves at medium demand uncertainty
  const curveData = curves["low|medium"].map((p, i) => ({
    h: p.h,
    low: curves["low|medium"][i].J / 1000,
    medium: curves["medium|medium"][i].J / 1000,
    high: curves["high|medium"][i].J / 1000,
  }));

  const savingsData = grid.map((g) => ({
    name: `σ ${g.volatility} / cv ${g.demand_uncertainty}`,
    vol: g.volatility,
    saving: g.savings_vs_benchmarks_pct.no_hedge,
  }));

  const hstar = (v: string, d: string) =>
    grid.find((g) => g.volatility === v && g.demand_uncertainty === d)!
      .optimal.h;

  return (
    <main className="mx-auto max-w-4xl px-5">
      <section className="pt-12 pb-8">
        <p className="eyebrow">Simulation output · 9 scenarios × 12,000 joint paths</p>
        <h1
          className="mt-3 text-3xl font-semibold sm:text-4xl"
          style={{ fontFamily: "var(--font-newsreader)" }}
        >
          Results
        </h1>
      </section>

      {/* forecasting */}
      <section className="border-t border-hairline py-10">
        <p className="eyebrow">Table 1: one-step-ahead forecast accuracy (146-day test window)</p>
        <table className="mt-4 w-full max-w-xl border-collapse font-mono text-sm">
          <thead>
            <tr className="border-t-2 border-b border-ink text-left">
              <th className="py-2 pr-4 font-semibold">Model</th>
              <th className="py-2 pr-4 text-right font-semibold">MAE ($)</th>
              <th className="py-2 text-right font-semibold">RMSE ($)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-hairline">
              <td className="py-2 pr-4">Seasonal ARIMA(2,1,2)×(1,0,1)₇</td>
              <td className="py-2 pr-4 text-right font-semibold text-terra">
                {Math.round(forecasting.ARIMA.MAE).toLocaleString()}
              </td>
              <td className="py-2 text-right font-semibold text-terra">
                {Math.round(forecasting.ARIMA.RMSE).toLocaleString()}
              </td>
            </tr>
            <tr className="border-b border-hairline">
              <td className="py-2 pr-4">LSTM (2 × 48 units)</td>
              <td className="py-2 pr-4 text-right">
                {Math.round(forecasting.LSTM.MAE).toLocaleString()}
              </td>
              <td className="py-2 text-right">
                {Math.round(forecasting.LSTM.RMSE).toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          The seasonal ARIMA wins on both metrics. Weekly seasonality and
          payday structure are exactly what a linear seasonal model captures,
          so its forecast (mean daily redemption ≈ $
          {Math.round(forecasting.mean_daily_redemption).toLocaleString()},
          forecast cv {forecasting.forecast_cv.toFixed(3)}) feeds the
          optimizer.
        </p>
        <div className="mt-6 border border-hairline">
          <Image
            src="/figures/fig_forecast.png"
            alt="Actual vs ARIMA and LSTM one-step-ahead redemption forecasts over the last 100 test days"
            width={1350}
            height={600}
            className="w-full"
          />
        </div>
      </section>

      {/* h* heatmap */}
      <section className="border-t border-hairline py-10">
        <p className="eyebrow">Figure: optimal hedge ratio h* across the 3×3 grid</p>
        <div className="mt-6 grid max-w-2xl grid-cols-[auto_1fr_1fr_1fr] gap-px bg-hairline font-mono text-sm">
          <div className="bg-paper p-3" />
          {["cv low", "cv medium", "cv high"].map((c) => (
            <div key={c} className="bg-paper p-3 text-center text-xs text-ink-soft">
              {c}
            </div>
          ))}
          {(["low", "medium", "high"] as const).map((v) => (
            <div key={v} className="contents">
              <div className="bg-paper p-3 text-xs text-ink-soft">σ {v}</div>
              {(["low", "medium", "high"] as const).map((d) => {
                const h = hstar(v, d);
                return (
                  <div
                    key={d}
                    className="p-4 text-center text-lg font-semibold"
                    style={{
                      background: `color-mix(in srgb, #c05b2e ${h * 55}%, #f7f4ec)`,
                      color: h > 0.6 ? "#f7f4ec" : "#211c15",
                    }}
                  >
                    {h.toFixed(2)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          Monotone in both directions: down each column volatility pulls the
          hedge up; across each row forecast error pulls it down, all the way
          to the no-hedge corner where a poor forecast meets a quiet price.
        </p>
      </section>

      {/* objective curves */}
      <section className="border-t border-hairline py-10">
        <p className="eyebrow">Figure: objective J(h) by volatility (medium demand uncertainty)</p>
        <div className="mt-6 h-[360px] w-full">
          <ResponsiveContainer>
            <LineChart data={curveData} margin={{ top: 10, right: 20, bottom: 10, left: 8 }}>
              <CartesianGrid stroke="#e0d8c8" strokeDasharray="2 4" />
              <XAxis
                dataKey="h"
                tick={{ fontFamily: MONO, fontSize: 11, fill: "#5c5346" }}
                label={{ value: "hedge ratio h", position: "insideBottom", offset: -4, fontFamily: MONO, fontSize: 11, fill: "#5c5346" }}
              />
              <YAxis
                tick={{ fontFamily: MONO, fontSize: 11, fill: "#5c5346" }}
                label={{ value: "J(h), $k", angle: -90, position: "insideLeft", fontFamily: MONO, fontSize: 11, fill: "#5c5346" }}
              />
              <Tooltip
                formatter={(v) => [`$${Math.round(Number(v)).toLocaleString()}k`]}
                labelFormatter={(l) => `h = ${l}`}
                contentStyle={{ background: "#f7f4ec", border: "1px solid #211c15", fontFamily: MONO, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontFamily: MONO, fontSize: 12 }} />
              {(["low", "medium", "high"] as const).map((v) => (
                <Line
                  key={v}
                  dataKey={v}
                  name={`σ ${v}`}
                  stroke={VOL_COLOR[v]}
                  strokeWidth={2.25}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* savings */}
      <section className="border-t border-hairline py-10">
        <p className="eyebrow">Figure: optimizer savings vs. not hedging, % of procurement budget</p>
        <div className="mt-6 h-[340px] w-full">
          <ResponsiveContainer>
            <BarChart data={savingsData} margin={{ top: 10, right: 12, bottom: 48, left: 8 }}>
              <CartesianGrid stroke="#e0d8c8" strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="name"
                angle={-35}
                textAnchor="end"
                interval={0}
                tick={{ fontFamily: MONO, fontSize: 10, fill: "#5c5346" }}
              />
              <YAxis
                tick={{ fontFamily: MONO, fontSize: 11, fill: "#5c5346" }}
                label={{ value: "% of budget", angle: -90, position: "insideLeft", fontFamily: MONO, fontSize: 11, fill: "#5c5346" }}
              />
              <Tooltip
                formatter={(v) => [`${v}%`, "saved vs no hedge"]}
                contentStyle={{ background: "#f7f4ec", border: "1px solid #211c15", fontFamily: MONO, fontSize: 12 }}
              />
              <Bar dataKey="saving" fill="#c05b2e" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          Up to 12% of the procurement budget at high volatility. The
          instructive failure is the other direction: a fixed
          trailing-average rule (h ≈ 0.96 regardless of conditions) happens to
          sit near the optimum in high-volatility cells but pays up to 0.83%
          of budget in the regimes where the optimizer says not to hedge,
          static rules can be accidentally right, but only the optimizer knows
          when.
        </p>
      </section>
    </main>
  );
}
