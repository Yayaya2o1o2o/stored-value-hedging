"use client";

import { useMemo, useState } from "react";
import ObjectiveCurve from "@/components/ObjectiveCurve";
import { recommend, VOL_LEVELS, CV_LEVELS, BUDGET } from "@/lib/model";

const fmtPct = (v: number) =>
  `${v >= 0 ? "" : "−"}${Math.abs(v).toFixed(2)}%`;
const fmtUsd = (v: number) =>
  v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${Math.round(v / 1e3)}k`;

export default function ModelPage() {
  const [sigma, setSigma] = useState(0.25);
  const [cv, setCv] = useState(0.168);

  const rec = useMemo(() => recommend(sigma, cv), [sigma, cv]);

  return (
    <main className="mx-auto max-w-4xl px-5">
      <section className="pt-12 pb-8">
        <p className="eyebrow">Interactive · bilinear interpolation over the simulated 3×3 surface</p>
        <h1
          className="mt-3 text-3xl font-semibold sm:text-4xl"
          style={{ fontFamily: "var(--font-newsreader)" }}
        >
          The optimizer, live
        </h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-ink-soft">
          Set the two conditions an issuer actually faces — how volatile the
          underlying price is, and how well its redemption forecast performs —
          and read off the recommended hedge ratio. Values between simulated
          scenarios are interpolated from the 12,000-path Monte Carlo objective
          curves; nothing here is a fit or a stylized illustration.
        </p>
      </section>

      <section className="grid gap-10 border-t border-hairline py-10 lg:grid-cols-[300px_1fr]">
        {/* controls */}
        <div className="space-y-10">
          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="sigma" className="eyebrow !text-ink">
                Price volatility <span className="normal-case">σ</span>
              </label>
              <span className="font-mono text-sm text-terra">
                {(sigma * 100).toFixed(0)}% /yr
              </span>
            </div>
            <input
              id="sigma"
              type="range"
              min={VOL_LEVELS[0]}
              max={VOL_LEVELS[2]}
              step={0.005}
              value={sigma}
              onChange={(e) => setSigma(Number(e.target.value))}
              className="mt-4"
            />
            <div className="mt-2 flex justify-between font-mono text-[10px] text-ink-soft">
              <span>10% · calm</span>
              <span>45% · energy-crisis</span>
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="cv" className="eyebrow !text-ink">
                Demand forecast error
              </label>
              <span className="font-mono text-sm text-terra">
                cv {cv.toFixed(3)}
              </span>
            </div>
            <input
              id="cv"
              type="range"
              min={CV_LEVELS[0]}
              max={CV_LEVELS[2]}
              step={0.002}
              value={cv}
              onChange={(e) => setCv(Number(e.target.value))}
              className="mt-4"
            />
            <div className="mt-2 flex justify-between font-mono text-[10px] text-ink-soft">
              <span>regular customers</span>
              <span>barely forecastable</span>
            </div>
          </div>

          {/* recommendation block */}
          <div className="border border-ink p-5">
            <p className="eyebrow">Recommended hedge ratio</p>
            <p
              className="mt-2 text-5xl font-semibold text-terra"
              style={{ fontFamily: "var(--font-newsreader)" }}
            >
              {rec.hStar.toFixed(2)}
            </p>
            <p className="mt-2 font-mono text-xs leading-relaxed text-ink-soft">
              hedge {(rec.hStar * 100).toFixed(0)}% of forecasted demand
              forward; objective {fmtUsd(rec.J)} on a {fmtUsd(BUDGET)}{" "}
              procurement budget
            </p>
          </div>
        </div>

        {/* live curve + savings */}
        <div>
          <p className="eyebrow">Objective J(h) at these conditions</p>
          <div className="mt-4">
            <ObjectiveCurve curve={rec.curve} hStar={rec.hStar} height={300} />
          </div>
          <table className="mt-6 w-full border-collapse font-mono text-sm">
            <thead>
              <tr className="border-t-2 border-b border-ink text-left">
                <th className="py-2 pr-4 font-semibold">vs. static strategy</th>
                <th className="py-2 text-right font-semibold">
                  objective saved, % of budget
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                ["No hedge (h = 0)", rec.savingsVsNoHedgePct],
                ["Half hedge (h = 0.5)", rec.savingsVsHalfPct],
                ["Full hedge (h = 1)", rec.savingsVsFullPct],
              ].map(([label, v]) => (
                <tr key={label as string} className="border-b border-hairline">
                  <td className="py-2 pr-4">{label}</td>
                  <td
                    className={`py-2 text-right ${
                      (v as number) > 0.005 ? "text-sage" : "text-ink-soft"
                    }`}
                  >
                    {fmtPct(v as number)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-ink-soft">
            Watch the two comparative statics: drag volatility up and the
            trough migrates right (hedge more); drag forecast error up and it
            migrates left — until, at low volatility and high error, the
            optimizer stops hedging altogether.
          </p>
        </div>
      </section>
    </main>
  );
}
