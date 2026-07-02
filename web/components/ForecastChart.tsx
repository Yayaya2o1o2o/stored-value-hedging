"use client";

import type { ForecastPoint } from "@/lib/forecast";

type Props = {
  path: ForecastPoint[];
  current: number;
  height?: number;
};

/**
 * Per-region price forecast: an 80% band around the OU conditional-mean path,
 * drawn as a working-paper figure — hairline axes, mono labels, terracotta
 * expected line revealed with the shared draw-curve primitive.
 */
export default function ForecastChart({ path, current, height = 180 }: Props) {
  const W = 640;
  const H = height;
  const pad = { l: 52, r: 16, t: 16, b: 30 };

  const days = path[path.length - 1].day;
  const los = path.map((p) => p.lo);
  const his = path.map((p) => p.hi);
  const lo = Math.min(...los, current);
  const hi = Math.max(...his, current);
  const span = hi - lo || 1;
  const plo = lo - span * 0.12;
  const phi = hi + span * 0.12;

  const x = (d: number) => pad.l + (d / days) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - plo) / (phi - plo)) * (H - pad.t - pad.b);

  const line = path
    .map((p, i) => `${i ? "L" : "M"}${x(p.day).toFixed(1)},${y(p.expected).toFixed(1)}`)
    .join(" ");
  const band =
    path.map((p, i) => `${i ? "L" : "M"}${x(p.day).toFixed(1)},${y(p.hi).toFixed(1)}`).join(" ") +
    " " +
    [...path].reverse().map((p) => `L${x(p.day).toFixed(1)},${y(p.lo).toFixed(1)}`).join(" ") +
    " Z";

  const yTicks = [plo + span * 0.15, (plo + phi) / 2, phi - span * 0.15];
  const fmt = (v: number) => `$${v.toFixed(2)}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Price forecast">
      {yTicks.map((g) => (
        <g key={g}>
          <line
            x1={pad.l}
            y1={y(g)}
            x2={W - pad.r}
            y2={y(g)}
            stroke="var(--hairline)"
            strokeWidth="1"
            strokeDasharray="2 5"
          />
          <text
            x={pad.l - 8}
            y={y(g) + 4}
            textAnchor="end"
            fontSize="10.5"
            fill="var(--ink-soft)"
            fontFamily="var(--font-plex-mono)"
          >
            {fmt(g)}
          </text>
        </g>
      ))}

      {/* axes */}
      <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke="var(--ink)" strokeWidth="1" />
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} stroke="var(--ink)" strokeWidth="1" />
      {[0, days / 2, days].map((t) => (
        <text
          key={t}
          x={x(t)}
          y={H - pad.b + 16}
          textAnchor="middle"
          fontSize="10.5"
          fill="var(--ink-soft)"
          fontFamily="var(--font-plex-mono)"
        >
          {t === 0 ? "today" : `+${t}d`}
        </text>
      ))}

      {/* confidence band */}
      <path d={band} fill="var(--terra)" opacity="0.1" />

      {/* current price reference */}
      <line
        x1={pad.l}
        y1={y(current)}
        x2={W - pad.r}
        y2={y(current)}
        stroke="var(--slate)"
        strokeWidth="1"
        strokeDasharray="3 4"
        opacity="0.6"
      />

      {/* expected path */}
      <path
        d={line}
        fill="none"
        stroke="var(--terra)"
        strokeWidth="2.25"
        strokeLinecap="round"
        className="draw-curve"
        style={{ "--dash": 900 } as React.CSSProperties}
      />
      <circle cx={x(0)} cy={y(current)} r="4" fill="var(--terra)" stroke="var(--paper)" strokeWidth="1.75" />
    </svg>
  );
}
