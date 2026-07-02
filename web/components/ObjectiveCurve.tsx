"use client";

type Props = {
  curve: { h: number; J: number }[];
  hStar: number;
  animate?: boolean;
  height?: number;
};

/**
 * The signature graphic: the objective J(h) as a hand-plotted working-paper
 * figure — hairline axes, mono labels, terracotta marker at the optimum.
 */
export default function ObjectiveCurve({
  curve,
  hStar,
  animate = false,
  height = 300,
}: Props) {
  const W = 640;
  const H = height;
  const pad = { l: 56, r: 20, t: 18, b: 40 };
  const jVals = curve.map((p) => p.J);
  const jMin = Math.min(...jVals);
  const jMax = Math.max(...jVals);
  const span = jMax - jMin || 1;
  const x = (h: number) => pad.l + (h / 1) * (W - pad.l - pad.r);
  const y = (j: number) =>
    pad.t + (1 - (j - jMin) / span) * (H - pad.t - pad.b);

  const d = curve
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.h).toFixed(1)},${y(p.J).toFixed(1)}`)
    .join(" ");
  const best = curve.reduce((a, b) => (b.J < a.J ? b : a));

  const fmt = (v: number) =>
    v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1e3)}k`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label={`Objective curve with minimum at hedge ratio ${hStar.toFixed(2)}`}
    >
      {/* axes */}
      <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke="var(--ink)" strokeWidth="1" />
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} stroke="var(--ink)" strokeWidth="1" />
      {/* x ticks */}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line x1={x(t)} y1={H - pad.b} x2={x(t)} y2={H - pad.b + 5} stroke="var(--ink)" strokeWidth="1" />
          <text x={x(t)} y={H - pad.b + 18} textAnchor="middle" fontSize="11" fill="var(--ink-soft)" fontFamily="var(--font-plex-mono)">
            {t}
          </text>
        </g>
      ))}
      <text x={(pad.l + W - pad.r) / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--ink-soft)" fontFamily="var(--font-plex-mono)" letterSpacing="0.08em">
        HEDGE RATIO h
      </text>
      {/* y labels */}
      <text x={pad.l - 8} y={y(jMin) + 4} textAnchor="end" fontSize="11" fill="var(--ink-soft)" fontFamily="var(--font-plex-mono)">
        {fmt(jMin)}
      </text>
      <text x={pad.l - 8} y={y(jMax) + 4} textAnchor="end" fontSize="11" fill="var(--ink-soft)" fontFamily="var(--font-plex-mono)">
        {fmt(jMax)}
      </text>
      {/* optimum guides */}
      <line x1={x(best.h)} y1={y(best.J)} x2={x(best.h)} y2={H - pad.b} stroke="var(--terra)" strokeWidth="1" strokeDasharray="3 4" />
      {/* curve */}
      <path
        d={d}
        fill="none"
        stroke="var(--slate)"
        strokeWidth="2.25"
        strokeLinecap="round"
        className={animate ? "draw-curve" : undefined}
        style={animate ? ({ "--dash": 1200 } as React.CSSProperties) : undefined}
      />
      {/* optimum marker */}
      <circle cx={x(best.h)} cy={y(best.J)} r="5.5" fill="var(--terra)" stroke="var(--paper)" strokeWidth="2" />
      <text x={x(best.h)} y={y(best.J) - 12} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--terra)" fontFamily="var(--font-plex-mono)">
        h* = {best.h.toFixed(2)}
      </text>
    </svg>
  );
}
