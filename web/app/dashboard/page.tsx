"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import StationCanvas from "@/components/StationCanvas";
import ForecastChart from "@/components/ForecastChart";
import AlertTicker, { type Alert } from "@/components/AlertTicker";
import ObjectiveCurve from "@/components/ObjectiveCurve";
import { useGasEngine } from "@/lib/use-gas-engine";
import { getEngine } from "@/lib/gas-engine";
import { METROS } from "@/lib/texas-geo";
import { forecastPath, FORECAST_WINNER } from "@/lib/forecast";
import { recommend, BUDGET } from "@/lib/model";

const CV_MIN = 0.056;
const CV_MAX = 0.336;

const fmtPct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}%`;
const fmtUsd = (v: number) =>
  Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${Math.round(v / 1e3)}k`;

function regimeOf(h: number): string {
  if (h <= 0.001) return "no-hedge";
  if (h >= 0.98) return "full-cover";
  if (h >= 0.85) return "high-cover";
  return "partial-cover";
}
const REGIME_RANK: Record<string, number> = {
  "no-hedge": 0,
  "partial-cover": 1,
  "high-cover": 2,
  "full-cover": 3,
};

export default function DashboardPage() {
  const { engine, tick, paused, setPaused, reducedMotion } = useGasEngine();
  const [selected, setSelected] = useState(() =>
    getEngine().nearestStation(METROS[0].pos[0], METROS[0].pos[1])
  );
  const [cv, setCv] = useState(0.112);
  const [mode, setMode] = useState<"price" | "sigma">("price");
  const [testMode, setTestMode] = useState(false);
  const [sigmaTest, setSigmaTest] = useState(0.22);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const prevRegime = useRef<string[] | null>(null);
  const alertId = useRef(0);

  // selected-station snapshot (re-read each tick via the dependency)
  const sel = useMemo(() => {
    const cell = engine.stationCell[selected];
    return {
      cell,
      price: engine.priceOfStation(selected),
      baseline: engine.baselineOfStation(selected),
      sigma: engine.cellSigma[cell],
      dayChange: engine.cellDay[cell],
      metro: METROS[engine.cellMetro[cell]],
      brand: engine.brands[engine.stationBrand[selected]],
      lon: engine.stationLngLat[selected * 2],
      lat: engine.stationLngLat[selected * 2 + 1],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, selected, tick]);

  const effSigma = testMode ? sigmaTest : sel.sigma;
  const rec = useMemo(() => recommend(effSigma, cv), [effSigma, cv]);
  const curve = useMemo(() => rec.curve.map((p) => ({ h: p.h, J: p.J })), [rec]);
  const forecast = useMemo(
    () => forecastPath(sel.price, sel.baseline, effSigma, 30),
    [sel.price, sel.baseline, effSigma]
  );

  // per-metro recommendation (nearest cell) for roll-up + alerts
  const metroRecs = useMemo(
    () =>
      METROS.map((m, i) => {
        const s = engine.cellSigma[engine.metroCell[i]];
        const r = recommend(s, cv);
        return { metro: m, hStar: r.hStar, savings: r.savingsVsNoHedgePct, regime: regimeOf(r.hStar) };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine, cv, tick]
  );

  const rollup = useMemo(() => {
    let budgetM = 0;
    let atRiskM = 0;
    let blended = 0;
    let highCount = 0;
    for (const mr of metroRecs) {
      const b = mr.metro.budgetM;
      budgetM += b;
      atRiskM += b * (mr.savings / 100);
      blended += mr.hStar * b;
      if (REGIME_RANK[mr.regime] >= 2) highCount += 1;
    }
    return {
      avg: engine.avgPrice,
      avgChange: engine.avgDay * 100,
      atRiskM,
      blended: blended / budgetM,
      highCount,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, metroRecs, tick]);

  useEffect(() => {
    const now = metroRecs.map((mr) => mr.regime);
    if (prevRegime.current === null) {
      prevRegime.current = now;
      return;
    }
    const fresh: Alert[] = [];
    now.forEach((reg, i) => {
      const was = prevRegime.current![i];
      if (reg !== was) {
        fresh.push({
          id: alertId.current++,
          metro: METROS[i].name,
          from: was,
          to: reg,
          hStar: metroRecs[i].hStar,
          rising: REGIME_RANK[reg] > REGIME_RANK[was],
        });
      }
    });
    prevRegime.current = now;
    if (fresh.length) setAlerts((a) => [...fresh, ...a].slice(0, 12));
  }, [metroRecs]);

  const regimeName = regimeOf(rec.hStar);
  const stats = [
    ["h*", rec.hStar.toFixed(2), regimeName],
    ["J(h*)", fmtUsd(rec.J), `${((rec.J / BUDGET) * 100).toFixed(2)}% of budget`],
    ["CVaR95", fmtUsd(rec.cvar), "worst 5% mean"],
    ["vs no hedge", fmtPct(rec.savingsVsNoHedgePct), "budget saved"],
  ] as const;

  return (
    <main className="mx-auto max-w-6xl px-5">
      {/* header */}
      <section className="pt-10 pb-6">
        <div className="grid gap-6 border-y border-ink py-6 lg:grid-cols-[1fr_320px]">
          <div className="fade-up">
            <p className="eyebrow">Live · simulated feed · Texas retail gasoline</p>
            <h1
              className="mt-3 max-w-3xl text-3xl leading-tight font-semibold sm:text-5xl"
              style={{ fontFamily: "var(--font-newsreader)" }}
            >
              Texas gas-price hedging console
            </h1>
            <p className="mt-4 max-w-2xl leading-relaxed text-ink-soft">
              Every real fueling station in Texas, priced live. Prices follow the
              paper&apos;s mean-reverting process on an H3 hex grid — shocks spread
              across neighboring cells — and each station moves with its cell.
              Click any station to read its forecast and the model&apos;s hedge.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-px self-end border border-hairline bg-hairline font-mono text-xs">
            <div className="bg-paper p-3">
              <p className="text-[10px] tracking-wider text-ink-soft uppercase">Network</p>
              <p className="mt-1 flex items-center gap-1.5 text-base font-semibold tabular-nums">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{
                    background: paused || reducedMotion ? "var(--ink-soft)" : "var(--terra)",
                  }}
                />
                {engine.N.toLocaleString()}
              </p>
              <p className="mt-0.5 text-[10px] text-ink-soft">
                stations · {reducedMotion ? "static" : paused ? "paused" : "live"}
              </p>
            </div>
            <button
              onClick={() => setPaused(!paused)}
              disabled={reducedMotion}
              className="bg-paper p-3 text-left transition-colors hover:bg-paper-deep disabled:cursor-not-allowed disabled:opacity-50"
            >
              <p className="text-[10px] tracking-wider text-ink-soft uppercase">Control</p>
              <p className="mt-1 text-base font-semibold">{paused ? "resume ▸" : "pause ❚❚"}</p>
              <p className="mt-0.5 text-[10px] text-ink-soft">{engine.C} H3 cells</p>
            </button>
          </div>
        </div>
      </section>

      {/* roll-up strip */}
      <section className="pb-6">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <p className="eyebrow">Statewide roll-up</p>
          <p className="hidden font-mono text-[11px] text-ink-soft sm:block">
            illustrative $364M annual gasoline procurement across 12 metros
          </p>
        </div>
        <div className="grid grid-cols-2 gap-px border border-hairline bg-hairline font-mono lg:grid-cols-5">
          {[
            ["avg price", `$${rollup.avg.toFixed(2)}`, "/gal, all stations"],
            ["Δ 24h", fmtPct(rollup.avgChange), "statewide mean"],
            ["budget at risk", `$${rollup.atRiskM.toFixed(1)}M`, "unhedged exposure"],
            ["blended h*", rollup.blended.toFixed(2), "budget-weighted"],
            ["high-cover metros", `${rollup.highCount}`, "of 12"],
          ].map(([k, v, note]) => (
            <div key={k} className="bg-paper p-4">
              <p className="text-[10px] tracking-wider text-ink-soft uppercase">{k}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{v}</p>
              <p className="mt-1 text-[11px] text-ink-soft">{note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* map + region panel */}
      <section className="grid gap-8 border-t border-hairline py-8 xl:grid-cols-[1fr_420px]">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="eyebrow">
              {engine.N.toLocaleString()} stations · {mode === "price" ? "price $/gal" : "volatility σ"}
            </p>
            <div className="flex border border-hairline font-mono text-[11px]">
              {(["price", "sigma"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-3 py-1.5 transition-colors ${
                    mode === m ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-deep"
                  }`}
                >
                  {m === "price" ? "price" : "volatility"}
                </button>
              ))}
            </div>
          </div>
          <div className="border border-ink p-3 sm:p-4">
            <StationCanvas
              engine={engine}
              tick={tick}
              mode={mode}
              selected={selected}
              onSelect={setSelected}
            />
            <div className="mt-3 flex items-center gap-3 border-t border-hairline pt-3 font-mono text-[10px] text-ink-soft">
              <span>{mode === "price" ? "lower" : "calmer"}</span>
              <div
                className="h-2 flex-1"
                style={{
                  background:
                    "linear-gradient(to right, var(--paper), color-mix(in srgb, var(--terra) 100%, var(--paper)))",
                }}
              />
              <span>{mode === "price" ? "higher" : "more volatile"}</span>
              <span className="ml-2 tabular-nums">click a station · OSM data</span>
            </div>
          </div>
        </div>

        {/* selected station panel */}
        <aside className="space-y-6">
          <div className="border border-ink p-5">
            <div className="flex items-baseline justify-between">
              <p className="eyebrow">Selected station</p>
              <p className="font-mono text-[11px] text-ink-soft">{sel.metro.short}</p>
            </div>
            <h2
              className="mt-2 text-2xl font-semibold"
              style={{ fontFamily: "var(--font-newsreader)" }}
            >
              {sel.brand}
            </h2>
            <p className="mt-1 font-mono text-[11px] text-ink-soft">
              near {sel.metro.name} · {sel.lat.toFixed(3)}, {sel.lon.toFixed(3)}
            </p>
            <div className="mt-4 flex items-end justify-between gap-4 border-y border-hairline py-4">
              <div>
                <p className="font-mono text-[11px] text-ink-soft">live price</p>
                <p
                  className="text-4xl leading-none font-semibold tabular-nums"
                  style={{ fontFamily: "var(--font-newsreader)" }}
                >
                  ${sel.price.toFixed(2)}
                </p>
                <p
                  className="mt-1 font-mono text-xs tabular-nums"
                  style={{ color: sel.dayChange >= 0 ? "var(--terra)" : "var(--sage)" }}
                >
                  {fmtPct(sel.dayChange * 100)} · 24h
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[11px] text-ink-soft">hedge ratio</p>
                <p
                  className="text-5xl leading-none font-semibold text-terra tabular-nums"
                  style={{ fontFamily: "var(--font-newsreader)" }}
                >
                  {rec.hStar.toFixed(2)}
                </p>
                <p className="mt-1 font-mono text-[11px] text-ink-soft">{regimeName}</p>
              </div>
            </div>

            {/* Monte Carlo test bench */}
            <div className="mt-5 border-t border-hairline pt-4">
              <div className="mb-4 flex items-center justify-between">
                <p className="eyebrow">Monte Carlo test bench</p>
                <div className="flex border border-hairline font-mono text-[10px]">
                  <button
                    onClick={() => setTestMode(false)}
                    className={`px-2 py-1 transition-colors ${
                      !testMode ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-deep"
                    }`}
                  >
                    live σ
                  </button>
                  <button
                    onClick={() => {
                      setSigmaTest(Number(sel.sigma.toFixed(3)));
                      setTestMode(true);
                    }}
                    className={`px-2 py-1 transition-colors ${
                      testMode ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-deep"
                    }`}
                  >
                    test σ
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between">
                  <label htmlFor="sigma" className="eyebrow !text-ink">
                    Price volatility <span className="normal-case">σ</span>
                  </label>
                  <span className="font-mono text-sm text-terra tabular-nums">
                    {(effSigma * 100).toFixed(1)}% /yr
                    {!testMode && <span className="ml-1 text-ink-soft">· live</span>}
                  </span>
                </div>
                <input
                  id="sigma"
                  type="range"
                  min={0.1}
                  max={0.45}
                  step={0.005}
                  value={effSigma}
                  onChange={(e) => {
                    setSigmaTest(Number(e.target.value));
                    setTestMode(true);
                  }}
                  className="mt-3"
                  style={{ caretColor: "transparent" }}
                />
                <div className="mt-2 flex justify-between font-mono text-[10px] text-ink-soft">
                  <span>10% calm</span>
                  <span>45% stressed</span>
                </div>
              </div>

              <div className="mt-5">
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
                  min={CV_MIN}
                  max={CV_MAX}
                  step={0.002}
                  value={cv}
                  onChange={(e) => setCv(Number(e.target.value))}
                  className="mt-3"
                  style={{ caretColor: "transparent" }}
                />
                <div className="mt-2 flex justify-between font-mono text-[10px] text-ink-soft">
                  <span>regular customers</span>
                  <span>barely forecastable</span>
                </div>
              </div>

              <p className="mt-4 font-mono text-[10px] leading-relaxed text-ink-soft">
                {testMode
                  ? "Testing a manual scenario against the 12,000-path surface. Switch to live σ to track the station."
                  : "σ tracks this station's H3 cell volatility. Drag it, or hit test σ, to stress-test the 12,000-path surface."}
              </p>
            </div>
          </div>

          <div className="border border-hairline p-3">
            <p className="eyebrow mb-1">
              Objective J(h) · {testMode ? "test" : "live"} σ {(effSigma * 100).toFixed(0)}%
            </p>
            <ObjectiveCurve curve={curve} hStar={rec.hStar} height={220} detailed />
          </div>

          <div className="grid grid-cols-2 gap-px border border-hairline bg-hairline font-mono">
            {stats.map(([k, v, note]) => (
              <div key={k} className="bg-paper p-3">
                <p className="text-[10px] tracking-wider text-ink-soft uppercase">{k}</p>
                <p className="mt-1 text-base font-semibold tabular-nums">{v}</p>
                <p className="mt-0.5 text-[10px] leading-snug text-ink-soft">{note}</p>
              </div>
            ))}
          </div>

          <div className="border border-hairline p-3">
            <div className="mb-1 flex items-baseline justify-between">
              <p className="eyebrow">Price forecast · 30d</p>
              <p className="font-mono text-[10px] text-ink-soft">{FORECAST_WINNER} · 80% band</p>
            </div>
            <ForecastChart path={forecast} current={sel.price} height={170} />
          </div>
        </aside>
      </section>

      {/* alerts */}
      <section className="pb-14">
        <AlertTicker alerts={alerts} />
        <p className="mt-4 font-mono text-[11px] leading-relaxed text-ink-soft">
          {engine.N.toLocaleString()} real Texas fueling stations (OpenStreetMap
          snapshot) indexed into {engine.C} H3 resolution-6 cells. Each cell runs a
          mean-reverting Ornstein–Uhlenbeck price (κ=2.0) seeded to metro
          baselines, with shocks spread to hexagonal neighbors; each station adds
          a fixed offset. Volatility is an EWMA of daily log-returns; hedges
          interpolate the paper&apos;s Monte Carlo surface. Prices are synthetic —
          no live market data.
        </p>
      </section>
    </main>
  );
}
