"use client";

type Props = {
  curve: { h: number; J: number }[];
  hStar: number;
  animate?: boolean;
  height?: number;
  detailed?: boolean;
};

/**
 * The signature graphic: the objective J(h) as a hand-plotted working-paper
 * figure: hairline axes, mono labels, terracotta marker at the optimum.
 * `detailed` adds under-/over-hedged region shading, y-gridlines, an area
 * fill, and benchmark markers at h = 0, 0.5, 1.
 */
export default function ObjectiveCurve({
  curve,
  hStar,
  animate = false,
  height = 300,
  detailed = false,
}: Props) {
  const W = 640;
  const H = height;
  const pad = { l: 60, r: 20, t: 26, b: 44 };
  const jVals = curve.map((p) => p.J);
  const jMin = Math.min(...jVals);
  const jMax = Math.max(...jVals);
  const span = jMax - jMin || 1;
  // headroom so the curve never kisses the frame
  const lo = jMin - span * 0.08;
  const hi = jMax + span * 0.08;
  const x = (h: number) => pad.l + h * (W - pad.l - pad.r);
  const y = (j: number) =>
    pad.t + (1 - (j - lo) / (hi - lo)) * (H - pad.t - pad.b);

  const d = curve
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${x(p.h).toFixed(1)},${y(p.J).toFixed(1)}`
    )
    .join(" ");
  const areaD = `${d} L${x(1).toFixed(1)},${H - pad.b} L${x(0).toFixed(1)},${
    H - pad.b
  } Z`;
  const best = curve.reduce((a, b) => (b.J < a.J ? b : a));
  const interior = best.h > 0.02 && best.h < 0.98;
  const leftRegionWidth = x(best.h) - pad.l;
  const rightRegionWidth = W - pad.r - x(best.h);

  const fmt = (v: number) =>
    Math.abs(v) >= 1e6
      ? `$${(v / 1e6).toFixed(1)}M`
      : `$${Math.round(v / 1e3)}k`;

  const gridLevels = [0.25, 0.5, 0.75].map((t) => lo + t * (hi - lo));
  const benchmarks: Array<[number, string]> = [
    [0, "none"],
    [0.5, "half"],
    [1, "full"],
  ];
  const atH = (h: number) =>
    curve.reduce((a, b) => (Math.abs(b.h - h) < Math.abs(a.h - h) ? b : a));
  const bestLabelAnchor =
    best.h > 0.88 ? "end" : best.h < 0.12 ? "start" : "middle";
  const bestLabelX =
    best.h > 0.88 ? W - pad.r : best.h < 0.12 ? pad.l : x(best.h);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label={`Objective curve with minimum at hedge ratio ${hStar.toFixed(
        2
      )}`}
    >
      {/* region shading */}
      {detailed && interior && (
        <>
          <rect
            x={pad.l}
            y={pad.t}
            width={x(best.h) - pad.l}
            height={H - pad.t - pad.b}
            fill="var(--slate)"
            opacity="0.055"
          />
          <rect
            x={x(best.h)}
            y={pad.t}
            width={W - pad.r - x(best.h)}
            height={H - pad.t - pad.b}
            fill="var(--terra)"
            opacity="0.05"
          />
          {leftRegionWidth > 210 && (
            <text
              x={(pad.l + x(best.h)) / 2}
              y={pad.t + 14}
              textAnchor="middle"
              fontSize="9.5"
              letterSpacing="0.08em"
              fill="var(--slate)"
              fontFamily="var(--font-plex-mono)"
            >
              UNDER-HEDGED
            </text>
          )}
          {rightRegionWidth > 210 && (
            <text
              x={(x(best.h) + W - pad.r) / 2}
              y={pad.t + 14}
              textAnchor="middle"
              fontSize="9.5"
              letterSpacing="0.08em"
              fill="var(--terra)"
              fontFamily="var(--font-plex-mono)"
            >
              OVER-HEDGED
            </text>
          )}
        </>
      )}

      {/* y gridlines */}
      {detailed &&
        gridLevels.map((g) => (
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
      <line
        x1={pad.l}
        y1={H - pad.b}
        x2={W - pad.r}
        y2={H - pad.b}
        stroke="var(--ink)"
        strokeWidth="1"
      />
      <line
        x1={pad.l}
        y1={pad.t}
        x2={pad.l}
        y2={H - pad.b}
        stroke="var(--ink)"
        strokeWidth="1"
      />
      {/* x ticks */}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line
            x1={x(t)}
            y1={H - pad.b}
            x2={x(t)}
            y2={H - pad.b + 5}
            stroke="var(--ink)"
            strokeWidth="1"
          />
          <text
            x={x(t)}
            y={H - pad.b + 18}
            textAnchor="middle"
            fontSize="11"
            fill="var(--ink-soft)"
            fontFamily="var(--font-plex-mono)"
          >
            {t}
          </text>
        </g>
      ))}
      <text
        x={(pad.l + W - pad.r) / 2}
        y={H - 6}
        textAnchor="middle"
        fontSize="11"
        fill="var(--ink-soft)"
        fontFamily="var(--font-plex-mono)"
        letterSpacing="0.08em"
      >
        HEDGE RATIO h
      </text>
      {/* y extremes */}
      <text
        x={pad.l - 8}
        y={y(jMin) + 4}
        textAnchor="end"
        fontSize="10.5"
        fill="var(--ink-soft)"
        fontFamily="var(--font-plex-mono)"
      >
        {fmt(jMin)}
      </text>
      <text
        x={pad.l - 8}
        y={y(jMax) + 4}
        textAnchor="end"
        fontSize="10.5"
        fill="var(--ink-soft)"
        fontFamily="var(--font-plex-mono)"
      >
        {fmt(jMax)}
      </text>

      {/* area fill */}
      {detailed && <path d={areaD} fill="var(--slate)" opacity="0.08" />}

      {/* optimum guide */}
      <line
        x1={x(best.h)}
        y1={y(best.J)}
        x2={x(best.h)}
        y2={H - pad.b}
        stroke="var(--terra)"
        strokeWidth="1"
        strokeDasharray="3 4"
      />

      {/* curve */}
      <path
        d={d}
        fill="none"
        stroke="var(--slate)"
        strokeWidth="2.25"
        strokeLinecap="round"
        className={animate ? "draw-curve" : undefined}
        style={
          animate ? ({ "--dash": 1200 } as React.CSSProperties) : undefined
        }
      />

      {/* benchmark markers */}
      {detailed &&
        benchmarks.map(([bh, label]) => {
          const p = atH(bh);
          const showLabel = Math.abs(p.h - best.h) > 0.08;
          return (
            <g key={label}>
              <rect
                x={x(p.h) - 3}
                y={y(p.J) - 3}
                width="6"
                height="6"
                transform={`rotate(45 ${x(p.h)} ${y(p.J)})`}
                fill="var(--paper)"
                stroke="var(--ink-soft)"
                strokeWidth="1.25"
              />
              {showLabel && (
                <text
                  x={x(p.h)}
                  y={y(p.J) - 10}
                  textAnchor={bh === 0 ? "start" : bh === 1 ? "end" : "middle"}
                  fontSize="9.5"
                  fill="var(--ink-soft)"
                  fontFamily="var(--font-plex-mono)"
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}

      {/* optimum marker */}
      <circle
        cx={x(best.h)}
        cy={y(best.J)}
        r="5.5"
        fill="var(--terra)"
        stroke="var(--paper)"
        strokeWidth="2"
      />
      <text
        x={bestLabelX}
        y={y(best.J) - 12}
        textAnchor={bestLabelAnchor}
        fontSize="12"
        fontWeight="600"
        fill="var(--terra)"
        fontFamily="var(--font-plex-mono)"
      >
        h* = {best.h.toFixed(2)}
      </text>
    </svg>
  );
}
