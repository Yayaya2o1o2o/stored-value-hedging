import Link from "next/link";
import ObjectiveCurve from "@/components/ObjectiveCurve";
import { curves, grid } from "@/lib/model";

export default function Home() {
  // hero figure: the medium-volatility, medium-uncertainty objective —
  // the paper's thesis (an interior optimum) in one picture
  const heroCurve = curves["medium|medium"].map((p) => ({ h: p.h, J: p.J }));
  const heroCell = grid.find(
    (g) => g.volatility === "medium" && g.demand_uncertainty === "medium"
  )!;

  return (
    <main className="mx-auto max-w-4xl px-5">
      {/* title block, set like a working-paper cover */}
      <section className="pt-14 pb-10">
        <p className="eyebrow fade-up">Working paper · July 2026</p>
        <h1
          className="fade-up-1 fade-up mt-4 max-w-3xl text-4xl leading-[1.12] font-semibold sm:text-5xl"
          style={{ fontFamily: "var(--font-newsreader)" }}
        >
          Dynamic Hedge-Ratio Optimization for Stored-Value Products Under
          Uncertain Redemption Demand
        </h1>
        <p className="fade-up-2 fade-up mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
          When a company sells customers a locked-in price on a volatile good,
          it must hedge an exposure whose size and timing its own customers
          control. This paper builds the first model that sizes that hedge
          directly from a redemption forecast.
        </p>
        <div className="fade-up-3 fade-up mt-8 flex flex-wrap gap-4">
          <Link
            href="/model"
            className="border border-ink bg-ink px-5 py-2.5 font-mono text-sm text-paper transition-colors hover:bg-terra hover:border-terra"
          >
            Run the optimizer
          </Link>
          <Link
            href="/paper"
            className="border border-ink px-5 py-2.5 font-mono text-sm text-ink transition-colors hover:border-terra hover:text-terra"
          >
            Read the paper
          </Link>
        </div>
      </section>

      {/* signature: the real objective curve */}
      <section className="border-y border-hairline py-10">
        <p className="eyebrow">
          Figure — objective J(h), medium volatility × medium demand
          uncertainty (12,000 Monte Carlo paths)
        </p>
        <div className="mt-6">
          <ObjectiveCurve
            curve={heroCurve}
            hStar={heroCell.optimal.h}
            animate
            height={320}
          />
        </div>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          The whole argument in one curve: hedge too little and spot exposure
          dominates; hedge too much and premium leakage plus the close-out
          lottery on unused cover dominate. The optimum is interior — and it
          moves with both price volatility and forecast quality.
        </p>
      </section>

      {/* the gap */}
      <section className="grid gap-10 py-12 sm:grid-cols-2">
        <div>
          <h2
            className="text-2xl font-semibold"
            style={{ fontFamily: "var(--font-newsreader)" }}
          >
            The gap this closes
          </h2>
          <p className="mt-4 leading-relaxed">
            Institutional hedging research — airlines, utilities, fleets —
            assumes the hedger controls when and how much it consumes.
            Stored-value research forecasts how customers redeem prepaid
            balances, but stops at revenue recognition. A product that locks
            consumer prices on a volatile underlying sits exactly between the
            two: its hedge must be sized <em>from</em> a redemption forecast.
            No published model performs that coupling.
          </p>
        </div>
        <div>
          <h2
            className="text-2xl font-semibold"
            style={{ fontFamily: "var(--font-newsreader)" }}
          >
            What the model does
          </h2>
          <p className="mt-4 leading-relaxed">
            A forecasting stage (seasonal ARIMA vs. LSTM) turns a two-year
            synthetic redemption panel into the two statistics a treasurer
            would actually hold — expected demand and forecast error. A Monte
            Carlo optimizer then chooses the hedge ratio minimizing a
            mean–dispersion objective over spot exposure, hedging premium,
            close-out of unused cover, margin capital, and redemption
            liquidity risk.
          </p>
        </div>
      </section>

      {/* headline findings, as a paper-style table */}
      <section className="border-t border-hairline py-12">
        <h2
          className="text-2xl font-semibold"
          style={{ fontFamily: "var(--font-newsreader)" }}
        >
          Headline findings
        </h2>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse font-mono text-sm">
            <thead>
              <tr className="border-t-2 border-b border-ink text-left">
                <th className="py-2 pr-4 font-semibold">Finding</th>
                <th className="py-2 font-semibold">Evidence</th>
              </tr>
            </thead>
            <tbody className="font-body" style={{ fontFamily: "var(--font-source-serif)" }}>
              <tr className="border-b border-hairline align-top">
                <td className="py-3 pr-4 font-medium">
                  h* rises with price volatility
                </td>
                <td className="py-3 text-ink-soft">
                  0.80 → 0.90 down the high-uncertainty column as σ goes 0.10 →
                  0.45; monotone in every column
                </td>
              </tr>
              <tr className="border-b border-hairline align-top">
                <td className="py-3 pr-4 font-medium">
                  h* falls as demand gets harder to forecast
                </td>
                <td className="py-3 text-ink-soft">
                  1.00 → 0.80 across the medium-volatility row; hedging is
                  abandoned entirely (h* = 0) when a poor forecast meets a
                  quiet price
                </td>
              </tr>
              <tr className="border-b border-hairline align-top">
                <td className="py-3 pr-4 font-medium">
                  No static rule survives the grid
                </td>
                <td className="py-3 text-ink-soft">
                  Not hedging forfeits up to 12.0% of the procurement budget at
                  high volatility; full hedging bleeds up to 0.94% when demand
                  is noisy
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-8 flex flex-wrap gap-6">
          <Link href="/results" className="font-mono text-sm text-terra hover:underline">
            → Full results &amp; figures
          </Link>
          <Link href="/model" className="font-mono text-sm text-terra hover:underline">
            → Explore the trade-off yourself
          </Link>
        </div>
      </section>
    </main>
  );
}
