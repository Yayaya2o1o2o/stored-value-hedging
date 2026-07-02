/**
 * Live gas-price feed: a client-side simulation using the same mean-reverting
 * Ornstein-Uhlenbeck process the paper uses for the underlying
 * (model/price_process.py), one process per hex, advanced one model-day per
 * tick. Shocks are correlated within a metro so neighboring hexes move
 * together. Realized volatility is tracked with an EWMA of squared daily
 * log-returns (RiskMetrics-style) and is what feeds the hedge optimizer.
 *
 * The initial frame is deterministic, so server and client render the same
 * first paint; the timer only runs on the client, inside useEffect.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { HEXES, METROS, type Hex } from "./texas-geo";

const KAPPA = 2.0;
const DT = 1 / 252;
const DRIFT = Math.exp(-KAPPA * DT);
const RHO = 0.6; // hex↔metro shock correlation
const EWMA_LAMBDA = 0.94;
const SIGMA_MIN = 0.1;
const SIGMA_MAX = 0.48;
const HISTORY = 40;

export const TICK_MS = 1500;

export type LiveHex = {
  id: number;
  price: number;
  sigma: number; // live realized annualized volatility
  dayChange: number; // fractional change over the last model-day
  history: number[]; // recent prices, oldest → newest
};

/** Deterministic PRNG (mulberry32) so the feed is reproducible. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type SimState = {
  rand: () => number;
  x: Float64Array; // log price per hex
  ewmaVar: Float64Array; // EWMA of squared daily returns per hex
  prevPrice: Float64Array; // price one model-day ago
  mu: Float64Array; // ln baseline per hex
  history: number[][];
};

function stdNormal(rand: () => number): number {
  // Box–Muller
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function initState(): SimState {
  const n = HEXES.length;
  const x = new Float64Array(n);
  const ewmaVar = new Float64Array(n);
  const prevPrice = new Float64Array(n);
  const mu = new Float64Array(n);
  const history: number[][] = [];
  HEXES.forEach((h: Hex, i) => {
    mu[i] = Math.log(h.baseline);
    x[i] = mu[i];
    ewmaVar[i] = (h.sigma * h.sigma) / 252; // seed daily variance from base sigma
    prevPrice[i] = h.baseline;
    history.push([h.baseline]);
  });
  return { rand: mulberry32(0x51ed), x, ewmaVar, prevPrice, mu, history };
}

/** Snapshot the deterministic first frame (all hexes at baseline). */
function initialFrame(): LiveHex[] {
  return HEXES.map((h) => ({
    id: h.id,
    price: h.baseline,
    sigma: h.sigma,
    dayChange: 0,
    history: [h.baseline],
  }));
}

function step(s: SimState): LiveHex[] {
  // one correlated shock per metro this model-day
  const metroShock = new Float64Array(METROS.length);
  for (let m = 0; m < METROS.length; m++) metroShock[m] = stdNormal(s.rand);

  return HEXES.map((h, i) => {
    const prev = Math.exp(s.x[i]);
    const statSd = h.sigma * Math.sqrt((1 - Math.exp(-2 * KAPPA * DT)) / (2 * KAPPA));
    const shock = RHO * metroShock[h.metroIdx] + Math.sqrt(1 - RHO * RHO) * stdNormal(s.rand);
    s.x[i] = s.mu[i] + (s.x[i] - s.mu[i]) * DRIFT + statSd * shock;
    const price = Math.exp(s.x[i]);

    const r = Math.log(price / prev);
    s.ewmaVar[i] = EWMA_LAMBDA * s.ewmaVar[i] + (1 - EWMA_LAMBDA) * r * r;
    const sigma = Math.min(SIGMA_MAX, Math.max(SIGMA_MIN, Math.sqrt(s.ewmaVar[i] * 252)));

    const dayChange = price / s.prevPrice[i] - 1;
    s.prevPrice[i] = price;

    const hist = s.history[i];
    hist.push(price);
    if (hist.length > HISTORY) hist.shift();

    return { id: h.id, price, sigma, dayChange, history: hist.slice() };
  });
}

export type Feed = {
  hexes: LiveHex[];
  paused: boolean;
  setPaused: (p: boolean) => void;
  reducedMotion: boolean;
  tick: number;
};

export function useGasFeed(): Feed {
  const [hexes, setHexes] = useState<LiveHex[]>(initialFrame);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [tick, setTick] = useState(0);
  const sim = useRef<SimState | null>(null);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      // one gentle step so the map isn't perfectly flat, then hold
      setReducedMotion(true);
      sim.current = initState();
      setHexes(step(sim.current));
      return;
    }
    if (!sim.current) sim.current = initState();
    if (paused) return;
    const id = setInterval(() => {
      if (!sim.current) return;
      setHexes(step(sim.current));
      setTick((t) => t + 1);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [paused]);

  return { hexes, paused, setPaused, reducedMotion, tick };
}
