"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ObjectiveCurve from "@/components/ObjectiveCurve";
import {
  recommend,
  grid,
  VOL_LEVELS,
  CV_LEVELS,
  BUDGET,
  HORIZON_DAYS,
} from "@/lib/model";

const fmtPct = (v: number) => `${v >= 0 ? "" : "−"}${Math.abs(v).toFixed(2)}%`;
const fmtUsd = (v: number) =>
  Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${Math.round(v / 1e3)}k`;

/** Smoothly morph the plotted curve toward its target on slider moves. */
function useAnimatedCurve(target: { h: number; J: number }[]) {
  const [curve, setCurve] = useState(target);
  const currentRef = useRef(target);
  const rafRef = useRef(0);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      currentRef.current = target;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => setCurve(target));
      return () => cancelAnimationFrame(rafRef.current);
    }
    const from = currentRef.current;
    const start = performance.now();
    const dur = 450;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const e = ease(t);
      const next = target.map((p, i) => ({
        h: p.h,
        J: from[i] ? from[i].J + (p.J - from[i].J) * e : p.J,
      }));
      currentRef.current = next;
      setCurve(next);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target]);

  return curve;
}

const PRESETS: Array<{
  label: string;
  note: string;
  sigma: number;
  cv: number;
}> = [
  {
    label: "Calm market, loyal base",
    note: "utility-like prices, regular customers",
    sigma: 0.1,
    cv: CV_LEVELS[0],
  },
  {
    label: "Typical conditions",
    note: "the paper's central scenario",
    sigma: 0.25,
    cv: 0.168,
  },
  {
    label: "Price shock, loyal base",
    note: "energy-crisis volatility, good forecast",
    sigma: 0.45,
    cv: CV_LEVELS[0],
  },
  {
    label: "Quiet price, unknown demand",
    note: "new product, barely forecastable",
    sigma: 0.12,
    cv: CV_LEVELS[2],
  },
];

const COST_TERMS: Array<[string, string, string]> = [
  [
    "(F − P_lock) · min(D, Q_h)",
    "Premium on used cover",
    "The certain price of insurance: forwards cost 1.5% over the locked price, paid on every hedged unit customers actually redeem.",
  ],
  [
    "Σ (S_t − P_lock) · U_t",
    "Unhedged spot exposure",
    "Redemptions beyond the hedge are bought at spot and delivered at the stale locked price. This is the term that explodes when prices rise.",
  ],
  [
    "(F − S_T) · L",
    "Close-out of unused cover",
    "Cover the customers never claimed becomes a speculative position, unwound at whatever the price happens to be. Loses exactly when demand came in low and prices fell.",
  ],
  [
    "λ·m·F·Q_h · T/252",
    "Capital cost of margin",
    "10% initial margin financed at an 8% annual opportunity cost for the life of the hedge.",
  ],
  [
    "π · max_t Φ_t",
    "Liquidity spike penalty",
    "Cash committed to the hedge is cash unavailable when a redemption spike hits: peak shortfall is penalized at the cost of forced short-term funding.",
  ],
];

export default function ModelPage() {
  const [sigma, setSigma] = useState(0.25);
  const [cv, setCv] = useState(0.168);

  const rec = useMemo(() => recommend(sigma, cv), [sigma, cv]);
  const targetCurve = useMemo(
    () => rec.curve.map((p) => ({ h: p.h, J: p.J })),
    [rec]
  );
  const animatedCurve = useAnimatedCurve(targetCurve);

  const hstarOf = (v: string, d: string) =>
    grid.find((g) => g.volatility === v && g.demand_uncertainty === d)!
      .optimal.h;

  // crosshair position inside the regime map (0..1 within each axis)
  const mapX = (cv - CV_LEVELS[0]) / (CV_LEVELS[2] - CV_LEVELS[0]);
  const mapY = (sigma - VOL_LEVELS[0]) / (VOL_LEVELS[2] - VOL_LEVELS[0]);
  const mapLeft = Math.min(1, Math.max(0, mapX));
  const mapTop = 1 - Math.min(1, Math.max(0, mapY));

  const regimeName =
    rec.hStar === 0
      ? "No-hedge corner"
      : rec.hStar >= 0.98
        ? "Full-cover regime"
        : rec.hStar >= 0.85
          ? "High-cover interior"
          : "Partial-cover interior";
  const recommendation =
    rec.hStar === 0
      ? "The model would leave the forecast unhedged because premium and mismatch risk dominate the price risk they remove."
      : `Buy forward cover for ${(rec.hStar * 100).toFixed(
          0
        )}% of forecasted ${HORIZON_DAYS}-day demand.`;

  const summaryStats = [
    ["h*", rec.hStar.toFixed(2), regimeName],
    ["J(h*)", fmtUsd(rec.J), `${((rec.J / BUDGET) * 100).toFixed(2)}% of budget`],
    ["E[N]", fmtUsd(rec.mean), "expected net cost"],
    ["CVaR95", fmtUsd(rec.cvar), "worst 5% mean"],
  ] as const;

  const benchmarkRows = [
    ["No hedge", "h = 0", rec.savingsVsNoHedgePct],
    ["Half hedge", "h = 0.5", rec.savingsVsHalfPct],
    ["Full hedge", "h = 1", rec.savingsVsFullPct],
  ] as const;
  const maxBenchmark = Math.max(
    0.01,
    ...benchmarkRows.map(([, , value]) => Math.max(0, value))
  );

  return (
    <main className="mx-auto max-w-6xl px-5">
      <section className="pt-10 pb-6">
        <div className="grid gap-6 border-y border-ink py-6 lg:grid-cols-[1fr_360px]">
          <div>
            <p className="eyebrow">
              Interactive · bilinear interpolation over the simulated 3×3
              surface
            </p>
            <h1
              className="mt-3 max-w-3xl text-3xl leading-tight font-semibold sm:text-5xl"
              style={{ fontFamily: "var(--font-newsreader)" }}
            >
              Hedge sizing console
            </h1>
            <p className="mt-4 max-w-2xl leading-relaxed text-ink-soft">
              Set price volatility and forecast error, then read the hedge
              ratio, objective curve, risk statistics, and benchmark savings
              from the Monte Carlo surface.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-px self-end border border-hairline bg-hairline font-mono text-xs">
            <div className="bg-paper p-3">
              <p className="text-[10px] tracking-wider text-ink-soft uppercase">
                Horizon
              </p>
              <p className="mt-1 text-base font-semibold tabular-nums">
                {HORIZON_DAYS}d
              </p>
            </div>
            <div className="bg-paper p-3">
              <p className="text-[10px] tracking-wider text-ink-soft uppercase">
                Paths
              </p>
              <p className="mt-1 text-base font-semibold tabular-nums">
                12k
              </p>
            </div>
            <div className="bg-paper p-3">
              <p className="text-[10px] tracking-wider text-ink-soft uppercase">
                Budget
              </p>
              <p className="mt-1 text-base font-semibold tabular-nums">
                {fmtUsd(BUDGET)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-6">
        <div className="mb-3 flex items-center justify-between gap-4">
          <p className="eyebrow">Scenario presets</p>
          <p className="hidden font-mono text-[11px] text-ink-soft sm:block">
            quick jumps, sliders stay authoritative
          </p>
        </div>
        <div className="grid gap-px border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-4">
          {PRESETS.map((p) => {
            const active =
              Math.abs(p.sigma - sigma) < 0.005 && Math.abs(p.cv - cv) < 0.004;
            return (
              <button
                key={p.label}
                onClick={() => {
                  setSigma(p.sigma);
                  setCv(p.cv);
                }}
                className={`min-h-20 bg-paper px-4 py-3 text-left transition-colors ${
                  active
                    ? "text-paper [background:var(--ink)]"
                    : "hover:bg-paper-deep"
                }`}
              >
                <span
                  className={`block font-mono text-[13px] font-medium ${
                    active ? "text-paper" : "text-ink"
                  }`}
                >
                  {p.label}
                </span>
                <span
                  className={`mt-1 block font-mono text-[11px] ${
                    active ? "text-paper/75" : "text-ink-soft"
                  }`}
                >
                  {p.note}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-8 border-y border-hairline py-8 xl:grid-cols-[360px_1fr]">
        <aside className="space-y-7">
          <div className="border border-ink p-5">
            <p className="eyebrow">Recommendation</p>
            <div className="mt-4 flex items-end justify-between gap-4 border-y border-hairline py-4">
              <div>
                <p className="font-mono text-[11px] text-ink-soft">
                  hedge ratio
                </p>
                <p
                  className="text-6xl leading-none font-semibold text-terra tabular-nums"
                  style={{ fontFamily: "var(--font-newsreader)" }}
                >
                  {rec.hStar.toFixed(2)}
                </p>
              </div>
              <p className="max-w-28 text-right font-mono text-[11px] leading-relaxed text-ink-soft">
                {regimeName}
              </p>
            </div>
            <p className="mt-4 font-mono text-xs leading-relaxed text-ink-soft">
              {recommendation}
            </p>
          </div>

          <div className="space-y-7">
            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="sigma" className="eyebrow !text-ink">
                  Price volatility <span className="normal-case">σ</span>
                </label>
                <span className="font-mono text-sm text-terra tabular-nums">
                  {(sigma * 100).toFixed(1)}% /yr
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
                style={{ caretColor: "transparent" }}
              />
              <div className="mt-2 flex justify-between font-mono text-[10px] text-ink-soft">
                <span>10% calm</span>
                <span>45% stressed</span>
              </div>
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="cv" className="eyebrow !text-ink">
                  Demand forecast error
                </label>
                <span className="font-mono text-sm text-terra tabular-nums">
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
                style={{ caretColor: "transparent" }}
              />
              <div className="mt-2 flex justify-between font-mono text-[10px] text-ink-soft">
                <span>regular customers</span>
                <span>barely forecastable</span>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-baseline justify-between">
              <p className="eyebrow">Surface map</p>
              <p className="font-mono text-[10px] text-ink-soft">h* by cell</p>
            </div>
            <div className="relative border border-hairline">
              <div className="grid grid-cols-3 gap-px bg-hairline p-px">
                {(["high", "medium", "low"] as const).map((v) =>
                  (["low", "medium", "high"] as const).map((d) => {
                    const h = hstarOf(v, d);
                    return (
                      <div
                        key={`${v}${d}`}
                        className="flex aspect-[4/3] items-center justify-center font-mono text-xs font-semibold"
                        style={{
                          background: `color-mix(in srgb, #c05b2e ${
                            h * 50
                          }%, #f7f4ec)`,
                          color: h > 0.6 ? "#f7f4ec" : "#211c15",
                        }}
                      >
                        {h.toFixed(2)}
                      </div>
                    );
                  })
                )}
              </div>
              {/* crosshair */}
              <div
                className="pointer-events-none absolute h-4 w-4 rounded-full border-2 border-ink bg-paper transition-all duration-300"
                style={{
                  left: `calc(${(mapLeft * 100).toFixed(1)}% - 8px)`,
                  top: `calc(${(mapTop * 100).toFixed(1)}% - 8px)`,
                }}
                aria-hidden
              />
            </div>
            <div className="mt-2 flex justify-between font-mono text-[10px] text-ink-soft">
              <span>forecast error increases</span>
              <span>volatility increases upward</span>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="border border-ink p-3 sm:p-5">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="eyebrow">Objective curve</p>
                <h2
                  className="mt-1 text-2xl font-semibold"
                  style={{ fontFamily: "var(--font-newsreader)" }}
                >
                  J(h) at current conditions
                </h2>
              </div>
              <p className="font-mono text-xs text-ink-soft tabular-nums">
                σ {(sigma * 100).toFixed(1)}% · cv {cv.toFixed(3)}
              </p>
            </div>
            <ObjectiveCurve
              curve={animatedCurve}
              hStar={rec.hStar}
              height={360}
              detailed
            />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-px border border-hairline bg-hairline lg:grid-cols-4">
            {summaryStats.map(([k, v, note]) => (
              <div key={k} className="bg-paper p-4">
                <p className="font-mono text-[10px] tracking-wider text-ink-soft uppercase">
                  {k}
                </p>
                <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                  {v}
                </p>
                <p className="mt-1 font-mono text-[11px] leading-snug text-ink-soft">
                  {note}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-7">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3 border-b border-ink pb-2">
              <p className="eyebrow !text-ink">Benchmark delta</p>
              <p className="font-mono text-[11px] text-ink-soft">
                objective saved, % of {fmtUsd(BUDGET)} budget
              </p>
            </div>
            <div className="space-y-3">
              {benchmarkRows.map(([label, hLabel, value]) => (
                <div
                  key={label}
                  className="grid gap-2 border-b border-hairline pb-3 font-mono text-sm sm:grid-cols-[150px_1fr_70px]"
                >
                  <div>
                    <p className="font-medium">{label}</p>
                    <p className="text-[11px] text-ink-soft">{hLabel}</p>
                  </div>
                  <div className="flex items-center">
                    <div className="h-2 w-full bg-paper-deep">
                      <div
                        className={`h-2 ${
                          value > 0.005 ? "bg-sage" : "bg-ink-soft"
                        }`}
                        style={{
                          width: `${Math.max(
                            1,
                            (Math.max(0, value) / maxBenchmark) * 100
                          ).toFixed(1)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <p
                    className={`text-right tabular-nums ${
                      value > 0.005 ? "text-sage" : "text-ink-soft"
                    }`}
                  >
                    {fmtPct(value)}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-ink-soft">
              Drag volatility up and the trough moves right. Drag forecast
              error up and it moves left. The optimizer is doing both at once,
              which is the part a static rule cannot see.
            </p>
          </div>
        </div>
      </section>

      <section className="py-10">
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div>
            <p className="eyebrow">Inside the objective</p>
            <h2
              className="mt-2 text-2xl font-semibold"
              style={{ fontFamily: "var(--font-newsreader)" }}
            >
              Five costs, one hedge ratio
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
              Each Monte Carlo path prices the same terms, then minimizes
              E[N] + σ[N] over h.
            </p>
          </div>
          <div className="border-t border-ink">
          {COST_TERMS.map(([formula, name, desc]) => (
            <div
              key={name}
                className="grid gap-2 border-b border-hairline py-4 sm:grid-cols-[210px_170px_1fr] sm:gap-5"
            >
              <code className="font-mono text-[13px] text-terra">
                {formula}
              </code>
              <p className="font-mono text-[13px] font-medium">{name}</p>
              <p className="text-[15px] leading-relaxed text-ink-soft">
                {desc}
              </p>
            </div>
          ))}
          </div>
        </div>
        <p className="mt-6 border-t border-hairline pt-4 font-mono text-[11px] leading-relaxed text-ink-soft">
          Parameters: forward premium 1.5% · initial margin 10% · capital cost
          8%/yr · liquidity penalty 2% of peak shortfall · cash buffer 10% of
          expected demand value · horizon 180 trading days. Full derivation in
          §4 of the paper.
        </p>
      </section>
    </main>
  );
}
