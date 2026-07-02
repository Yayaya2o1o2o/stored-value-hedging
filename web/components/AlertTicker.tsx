"use client";

export type Alert = {
  id: number;
  metro: string;
  from: string;
  to: string;
  hStar: number;
  rising: boolean;
};

type Props = { alerts: Alert[] };

/**
 * Volatility alerts: a running feed of metros whose live volatility just moved
 * the recommended hedge across a regime boundary. Sage = cover eased, terra =
 * cover tightened.
 */
export default function AlertTicker({ alerts }: Props) {
  return (
    <div className="border border-hairline">
      <div className="flex items-center justify-between border-b border-hairline px-4 py-2">
        <p className="eyebrow">Volatility alerts</p>
        <p className="font-mono text-[10px] text-ink-soft">
          regime crossings, newest first
        </p>
      </div>
      <div className="divide-y divide-hairline">
        {alerts.length === 0 ? (
          <p className="px-4 py-4 font-mono text-[12px] text-ink-soft">
            Watching 12 metros. No regime crossings yet — the feed flags a metro
            here when its volatility shifts the recommended hedge.
          </p>
        ) : (
          alerts.slice(0, 6).map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 font-mono text-[12px]">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: a.rising ? "var(--terra)" : "var(--sage)" }}
                aria-hidden
              />
              <span className="font-medium text-ink">{a.metro}</span>
              <span className="text-ink-soft">
                {a.rising ? "tightened into" : "eased into"} {a.to}
              </span>
              <span className="ml-auto tabular-nums text-ink-soft">
                {a.from} → {a.to} · h* {a.hStar.toFixed(2)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
