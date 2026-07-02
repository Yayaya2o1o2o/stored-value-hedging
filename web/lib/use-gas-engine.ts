"use client";

import { useEffect, useMemo, useState } from "react";
import { getEngine, type GasEngine } from "./gas-engine";

export const TICK_MS = 800;

export type EngineFeed = {
  engine: GasEngine;
  tick: number;
  paused: boolean;
  setPaused: (p: boolean) => void;
  reducedMotion: boolean;
};

/**
 * Drives the gas engine on an interval and exposes a `tick` counter so the
 * canvas and panel re-read the (mutated) engine each step. The engine itself
 * is built once and shared.
 */
export function useGasEngine(): EngineFeed {
  const engine = useMemo(() => getEngine(), []);
  const [tick, setTick] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setReducedMotion(true);
      engine.tick();
      setTick((t) => t + 1);
      return;
    }
    if (paused) return;
    const id = setInterval(() => {
      engine.tick();
      setTick((t) => t + 1);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [engine, paused]);

  return { engine, tick, paused, setPaused, reducedMotion };
}
