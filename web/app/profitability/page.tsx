"use client";

import { useEffect, useMemo, useState } from "react";
import {
  compute,
  PARAM_GROUPS,
  DEFAULT_PARAMS,
  type Params,
} from "@/lib/profitability";
import {
  listScenarios,
  saveScenario,
  updateScenario,
  deleteScenario,
  type Scenario,
} from "@/lib/scenarios";
import { hasSupabase } from "@/lib/supabase";

const money = (v: number) =>
  Math.abs(v) >= 1e6
    ? `${v < 0 ? "−" : ""}$${(Math.abs(v) / 1e6).toFixed(2)}M`
    : Math.abs(v) >= 1e3
      ? `${v < 0 ? "−" : ""}$${(Math.abs(v) / 1e3).toFixed(1)}k`
      : `${v < 0 ? "−" : ""}$${Math.abs(v).toFixed(2)}`;
const pct = (v: number) => `${v >= 0 ? "" : "−"}${Math.abs(v).toFixed(1)}%`;

// local fallback presets so the page works even if the DB is unreachable
const LOCAL_PRESETS: Scenario[] = [
  { id: "local-cruise", name: "Paylo · Cruise", is_preset: true, created_at: "", params: DEFAULT_PARAMS },
];

export default function ProfitabilityPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>(LOCAL_PRESETS);
  const [selectedId, setSelectedId] = useState<string>("local-cruise");
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
  const [name, setName] = useState("Paylo · Cruise");
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!hasSupabase) {
      setStatus("Local mode — database not configured");
      return;
    }
    listScenarios()
      .then((rows) => {
        if (!rows.length) return;
        setScenarios(rows);
        const start = rows.find((r) => r.name.includes("Cruise")) ?? rows[0];
        setSelectedId(start.id);
        setParams(start.params);
        setName(start.name);
      })
      .catch(() => setStatus("Could not reach database — using local presets"));
  }, []);

  const selected = scenarios.find((s) => s.id === selectedId);
  const r = useMemo(() => compute(params), [params]);

  function pick(id: string) {
    const s = scenarios.find((x) => x.id === id);
    if (!s) return;
    setSelectedId(id);
    setParams(s.params);
    setName(s.name);
    setStatus("");
  }

  function setField(key: keyof Params, value: number) {
    setParams((p) => ({ ...p, [key]: value }));
  }

  async function onSaveNew() {
    if (!hasSupabase) return setStatus("Database not configured");
    setBusy(true);
    try {
      const s = await saveScenario(name.trim() || "Untitled scenario", params);
      const rows = await listScenarios();
      setScenarios(rows);
      setSelectedId(s.id);
      setStatus("Saved");
    } catch {
      setStatus("Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function onUpdate() {
    if (!selected || selected.is_preset) return;
    setBusy(true);
    try {
      await updateScenario(selected.id, name.trim() || selected.name, params);
      setScenarios((xs) =>
        xs.map((x) => (x.id === selected.id ? { ...x, name, params } : x))
      );
      setStatus("Updated");
    } catch {
      setStatus("Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!selected || selected.is_preset) return;
    setBusy(true);
    try {
      await deleteScenario(selected.id);
      const rows = await listScenarios();
      setScenarios(rows);
      pick(rows[0]?.id ?? "");
      setStatus("Deleted");
    } catch {
      setStatus("Delete failed");
    } finally {
      setBusy(false);
    }
  }

  const matrix = [
    ["Expected", r.netExpHedged, r.netExpUnhedged],
    ["Worst 5% (CVaR)", r.netWorstHedged, r.netWorstUnhedged],
  ] as const;
  const maxNet = Math.max(
    Math.abs(r.netExpHedged),
    Math.abs(r.netExpUnhedged),
    Math.abs(r.netWorstHedged),
    Math.abs(r.netWorstUnhedged),
    0.01
  );

  return (
    <main className="mx-auto max-w-6xl px-5">
      {/* header */}
      <section className="pt-10 pb-6">
        <div className="grid gap-6 border-y border-ink py-6 lg:grid-cols-[1fr_320px]">
          <div className="fade-up">
            <p className="eyebrow">Profitability · gas price-lock economics</p>
            <h1
              className="mt-3 max-w-3xl text-3xl leading-tight font-semibold sm:text-5xl"
              style={{ fontFamily: "var(--font-newsreader)" }}
            >
              Does hedging pay?
            </h1>
            <p className="mt-4 max-w-2xl leading-relaxed text-ink-soft">
              A customizable P&amp;L for a gas price-lock business like
              paylo.shop. Edit every pricing variable and cost margin below; the
              model prices the hedge from the paper&apos;s optimizer and shows the
              bottom line with and without it.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-px self-end border border-hairline bg-hairline font-mono text-xs">
            <div className="bg-paper p-3">
              <p className="text-[10px] tracking-wider text-ink-soft uppercase">Downside protected</p>
              <p className="mt-1 text-base font-semibold tabular-nums text-sage">
                {money(r.downsideProtected)}/acct
              </p>
            </div>
            <div className="bg-paper p-3">
              <p className="text-[10px] tracking-wider text-ink-soft uppercase">h*</p>
              <p className="mt-1 text-base font-semibold text-terra tabular-nums">
                {r.hStar.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* scenario bar */}
      <section className="pb-6">
        <div className="flex flex-wrap items-center gap-2 border border-hairline p-3">
          <p className="eyebrow mr-1">Scenario</p>
          <div className="flex flex-wrap gap-px bg-hairline">
            {scenarios.map((s) => (
              <button
                key={s.id}
                onClick={() => pick(s.id)}
                className={`bg-paper px-3 py-1.5 font-mono text-[12px] transition-colors ${
                  s.id === selectedId ? "!bg-ink text-paper" : "text-ink hover:bg-paper-deep"
                }`}
              >
                {s.is_preset ? s.name : `◆ ${s.name}`}
              </button>
            ))}
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="ml-auto min-w-40 border border-hairline bg-paper px-2 py-1.5 font-mono text-[12px] outline-none focus:border-terra"
            placeholder="scenario name"
          />
          <button
            onClick={onSaveNew}
            disabled={busy || !hasSupabase}
            className="border border-ink bg-ink px-3 py-1.5 font-mono text-[12px] text-paper transition-opacity hover:opacity-85 disabled:opacity-40"
          >
            save as new
          </button>
          <button
            onClick={onUpdate}
            disabled={busy || !selected || selected.is_preset}
            className="border border-hairline bg-paper px-3 py-1.5 font-mono text-[12px] transition-colors hover:bg-paper-deep disabled:opacity-40"
          >
            update
          </button>
          <button
            onClick={onDelete}
            disabled={busy || !selected || selected.is_preset}
            className="border border-hairline bg-paper px-3 py-1.5 font-mono text-[12px] text-terra transition-colors hover:bg-paper-deep disabled:opacity-40"
          >
            delete
          </button>
          {status && <span className="font-mono text-[11px] text-ink-soft">· {status}</span>}
        </div>
      </section>

      {/* editor + results */}
      <section className="grid gap-8 border-t border-hairline py-8 xl:grid-cols-[380px_1fr]">
        {/* variable database */}
        <aside className="space-y-6">
          <p className="eyebrow">Pricing &amp; cost variables</p>
          {PARAM_GROUPS.map((g) => (
            <div key={g.group} className="border border-hairline">
              <p className="border-b border-hairline bg-paper-deep px-3 py-2 font-mono text-[11px] font-medium tracking-wide uppercase">
                {g.group}
              </p>
              <div className="divide-y divide-hairline">
                {g.fields.map((f) => (
                  <label
                    key={f.key}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <span className="font-mono text-[12px] text-ink">{f.label}</span>
                    <span className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step={f.step}
                        value={params[f.key]}
                        onChange={(e) => setField(f.key, Number(e.target.value))}
                        className="w-24 border border-hairline bg-paper px-2 py-1 text-right font-mono text-[12px] tabular-nums outline-none focus:border-terra"
                      />
                      <span className="w-10 font-mono text-[10px] text-ink-soft">{f.unit}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </aside>

        {/* results */}
        <div className="min-w-0 space-y-7">
          {/* verdict: expected vs worst-case, hedged vs unhedged */}
          <div className="border border-ink p-5">
            <p className="eyebrow">Net margin / account / yr · hedge = insurance</p>
            <div className="mt-4 space-y-4">
              {matrix.map(([label, hed, unh]) => (
                <div key={label} className="grid gap-2 sm:grid-cols-[130px_1fr]">
                  <p className="font-mono text-[12px] text-ink-soft">{label}</p>
                  <div className="space-y-1.5">
                    {[
                      ["hedged", hed, "var(--sage)"],
                      ["unhedged", unh, "var(--terra)"],
                    ].map(([sub, val, color]) => (
                      <div key={sub as string} className="flex items-center gap-2 font-mono text-[11px]">
                        <span className="w-16 text-ink-soft">{sub as string}</span>
                        <div className="h-2 flex-1 bg-paper-deep">
                          <div
                            className="h-2"
                            style={{
                              width: `${(Math.abs(val as number) / maxNet) * 100}%`,
                              background: color as string,
                            }}
                          />
                        </div>
                        <span className="w-16 text-right font-semibold tabular-nums" style={{ color: color as string }}>
                          {money(val as number)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-5 border-t border-hairline pt-4 text-[15px] leading-relaxed">
              At <span className="font-mono">σ = {(params.sigma * 100).toFixed(0)}%</span>, hedging to{" "}
              <span className="font-mono text-terra">h* = {r.hStar.toFixed(2)}</span> gives up{" "}
              <span className="font-semibold text-terra">{money(r.premium)}</span> of expected margin to
              protect{" "}
              <span className="font-semibold text-sage">{money(r.downsideProtected)}</span> in the worst 5% —
              a{" "}
              <span className="font-semibold">
                {Number.isFinite(r.protectionRatio) ? `${r.protectionRatio.toFixed(1)}×` : "∞"}
              </span>{" "}
              protection ratio. Raise volatility and the trade gets more favorable.
            </p>
          </div>

          {/* P&L breakdown */}
          <div className="grid gap-px border border-hairline bg-hairline sm:grid-cols-2">
            <div className="bg-paper p-4">
              <p className="eyebrow mb-3">Revenue / acct</p>
              <div className="space-y-2">
                {r.revenue.map((li) => (
                  <Row key={li.label} label={li.label} value={li.value} total={r.totalRevenue} tone="var(--sage)" />
                ))}
                <div className="flex justify-between border-t border-ink pt-2 font-mono text-[12px] font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">{money(r.totalRevenue)}</span>
                </div>
              </div>
            </div>
            <div className="bg-paper p-4">
              <p className="eyebrow mb-3">Cost / acct</p>
              <div className="space-y-2">
                {r.fixedCosts.map((li) => (
                  <Row key={li.label} label={li.label} value={li.value} total={r.totalFixed + r.expHedgeCost} tone="var(--terra)" />
                ))}
                <Row label="Hedge cost (expected)" value={r.expHedgeCost} total={r.totalFixed + r.expHedgeCost} tone="var(--slate)" />
                <div className="flex justify-between border-t border-ink pt-2 font-mono text-[12px] font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">{money(r.totalFixed + r.expHedgeCost)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ratios */}
          <div className="grid grid-cols-2 gap-px border border-hairline bg-hairline font-mono lg:grid-cols-3">
            {[
              ["net margin", pct(r.netMarginPct), "hedged / throughput"],
              ["hedge premium", money(r.premium), "expected cost to hedge"],
              ["downside protected", money(r.downsideProtected), "worst-5% saved"],
              [
                "protection ratio",
                Number.isFinite(r.protectionRatio) ? `${r.protectionRatio.toFixed(1)}×` : "∞",
                "protected / premium",
              ],
              ["return on float", pct(r.returnOnFloatPct), "T-bill − user APY"],
              ["LTV : CAC", `${r.ltvCac.toFixed(1)}×`, `LTV ${money(r.ltv)}`],
            ].map(([k, v, note]) => (
              <div key={k} className="bg-paper p-4">
                <p className="text-[10px] tracking-wider text-ink-soft uppercase">{k}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{v}</p>
                <p className="mt-1 text-[11px] text-ink-soft">{note}</p>
              </div>
            ))}
          </div>

          {/* portfolio */}
          <div className="border border-ink p-5">
            <div className="flex items-baseline justify-between">
              <p className="eyebrow">Portfolio roll-up</p>
              <p className="font-mono text-[11px] text-ink-soft tabular-nums">
                × {params.customers.toLocaleString()} customers
              </p>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-px border border-hairline bg-hairline font-mono sm:grid-cols-3">
              {[
                ["expected net (hedged)", money(r.portfolioExpHedged), "var(--ink)"],
                ["tail risk removed", money(r.portfolioDownsideProtected), "var(--sage)"],
                ["cost to hedge", money(r.portfolioPremium), "var(--terra)"],
              ].map(([k, v, color]) => (
                <div key={k} className="bg-paper p-4">
                  <p className="text-[10px] tracking-wider text-ink-soft uppercase">{k}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums" style={{ color }}>
                    {v}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <p className="font-mono text-[11px] leading-relaxed text-ink-soft">
            Scenarios persist to a Supabase Postgres database
            (hedging_profitability_scenarios). Presets are read-only; saved
            scenarios can be updated or deleted. Hedge costs come from the
            optimizer: the expected case uses mean cost E[N], the worst case uses
            CVaR95, at h* (hedged) vs h=0 (unhedged), scaled by annual throughput.
            Hedging trades a little expected margin for large tail protection.
            Illustrative — calibrated to the paylo.shop model, not audited figures.
          </p>
        </div>
      </section>
    </main>
  );
}

function Row({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: string;
}) {
  const w = total ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between font-mono text-[12px]">
        <span className="text-ink-soft">{label}</span>
        <span className="tabular-nums">{money(value)}</span>
      </div>
      <div className="mt-1 h-1 w-full bg-paper-deep">
        <div className="h-1" style={{ width: `${w}%`, background: tone }} />
      </div>
    </div>
  );
}
