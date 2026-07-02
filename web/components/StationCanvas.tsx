"use client";

import { useEffect, useRef } from "react";
import { VIEWBOX, METROS, TX_OUTLINE } from "@/lib/texas-geo";
import type { GasEngine } from "@/lib/gas-engine";

type Props = {
  engine: GasEngine;
  tick: number;
  mode: "price" | "sigma";
  selected: number;
  onSelect: (i: number) => void;
};

const SS = 2; // supersample for crisp points
const PAPER: [number, number, number] = [247, 244, 236];
const TERRA: [number, number, number] = [192, 91, 46];

function mix(t: number): string {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  const r = Math.round(PAPER[0] + (TERRA[0] - PAPER[0]) * c);
  const g = Math.round(PAPER[1] + (TERRA[1] - PAPER[1]) * c);
  const b = Math.round(PAPER[2] + (TERRA[2] - PAPER[2]) * c);
  return `rgb(${r},${g},${b})`;
}

/**
 * Every real Texas station drawn as a live point, colored by its own price (or
 * its cell's volatility). Rendered imperatively to a canvas so ~10.6k points
 * repaint fast on every tick. Click selects the nearest station.
 */
export default function StationCanvas({ engine, tick, mode, selected, onSelect }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(SS, 0, 0, SS, 0, 0);
    ctx.clearRect(0, 0, VIEWBOX.w, VIEWBOX.h);

    // state silhouette
    const outline = new Path2D();
    TX_OUTLINE.forEach(([x, y], i) => (i ? outline.lineTo(x, y) : outline.moveTo(x, y)));
    outline.closePath();
    ctx.fillStyle = "#efe9db";
    ctx.fill(outline);

    // stations
    const usePrice = mode === "price";
    const lo = usePrice ? engine.priceMin : engine.sigmaMin;
    const hi = usePrice ? engine.priceMax : engine.sigmaMax;
    const span = hi - lo || 1;
    const xy = engine.stationXY;
    for (let i = 0; i < engine.N; i++) {
      const v = usePrice ? engine.priceOfStation(i) : engine.cellSigma[engine.stationCell[i]];
      ctx.fillStyle = mix((v - lo) / span);
      ctx.fillRect(xy[i * 2] - 1, xy[i * 2 + 1] - 1, 2.1, 2.1);
    }

    // state boundary
    ctx.strokeStyle = "#211c15";
    ctx.lineWidth = 1.1;
    ctx.lineJoin = "round";
    ctx.stroke(outline);

    // selected station marker
    if (selected >= 0 && selected < engine.N) {
      const sx = xy[selected * 2];
      const sy = xy[selected * 2 + 1];
      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, Math.PI * 2);
      ctx.strokeStyle = "#211c15";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(sx, sy, 2, 0, Math.PI * 2);
      ctx.fillStyle = "#c05b2e";
      ctx.fill();
    }

    // metro labels
    ctx.font = "600 10px ui-monospace, monospace";
    ctx.textBaseline = "middle";
    for (const m of METROS) {
      ctx.fillStyle = "#211c15";
      ctx.beginPath();
      ctx.arc(m.pos[0], m.pos[1], 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = "#f7f4ec";
      ctx.strokeText(m.short, m.pos[0] + 5, m.pos[1]);
      ctx.fillStyle = "#211c15";
      ctx.fillText(m.short, m.pos[0] + 5, m.pos[1]);
    }
  }, [engine, tick, mode, selected]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const cv = ref.current;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * VIEWBOX.w;
    const py = ((e.clientY - rect.top) / rect.height) * VIEWBOX.h;
    onSelect(engine.nearestStation(px, py));
  };

  return (
    <canvas
      ref={ref}
      width={VIEWBOX.w * SS}
      height={VIEWBOX.h * SS}
      onClick={handleClick}
      className="w-full cursor-crosshair"
      style={{ display: "block" }}
      role="img"
      aria-label="Live map of Texas gas stations colored by price"
    />
  );
}
