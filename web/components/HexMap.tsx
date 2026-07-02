"use client";

import { HEXES, METROS, TX_OUTLINE, VIEWBOX } from "@/lib/texas-geo";
import type { LiveHex } from "@/lib/gas-feed";

type Props = {
  hexes: LiveHex[];
  selectedId: number;
  onSelect: (id: number) => void;
  mode: "price" | "sigma";
};

/**
 * The signature graphic: a flat-top hexagonal tessellation of Texas, each cell
 * shaded by live price (or volatility) using the same color-mix technique as
 * the paper's surface map. Click a cell to bind the region panel to it.
 */
export default function HexMap({ hexes, selectedId, onSelect, mode }: Props) {
  const vals = hexes.map((h) => (mode === "price" ? h.price : h.sigma));
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;

  const fill = (v: number) => {
    const t = (v - min) / span; // 0..1
    return `color-mix(in srgb, var(--terra) ${(t * 72).toFixed(1)}%, var(--paper))`;
  };

  const outlinePath =
    TX_OUTLINE.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ") +
    " Z";

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
      className="w-full"
      role="img"
      aria-label="Live gas-price map of Texas by metro region"
    >
      {/* soft state silhouette under the hexes */}
      <path d={outlinePath} fill="var(--paper-deep)" stroke="none" />

      {HEXES.map((geo) => {
        const live = hexes[geo.id];
        const selected = geo.id === selectedId;
        return (
          <polygon
            key={geo.id}
            points={geo.points}
            fill={fill(mode === "price" ? live.price : live.sigma)}
            stroke={selected ? "var(--ink)" : "var(--paper)"}
            strokeWidth={selected ? 2.25 : 0.6}
            style={{ transition: "fill 0.9s linear", cursor: "pointer" }}
            onClick={() => onSelect(geo.id)}
          >
            <title>
              {METROS[geo.metroIdx].name} · ${live.price.toFixed(2)}/gal · σ{" "}
              {(live.sigma * 100).toFixed(0)}%
            </title>
          </polygon>
        );
      })}

      {/* crisp state boundary on top */}
      <path
        d={outlinePath}
        fill="none"
        stroke="var(--ink)"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />

      {/* metro anchors */}
      {METROS.map((m) => (
        <g key={m.short} style={{ pointerEvents: "none" }}>
          <circle cx={m.pos[0]} cy={m.pos[1]} r="2.6" fill="var(--ink)" />
          <text
            x={m.pos[0] + 5}
            y={m.pos[1] + 3.5}
            fontSize="10"
            fill="var(--ink)"
            fontFamily="var(--font-plex-mono)"
            style={{ paintOrder: "stroke", stroke: "var(--paper)", strokeWidth: 2.5 }}
          >
            {m.short}
          </text>
        </g>
      ))}
    </svg>
  );
}
