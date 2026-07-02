/**
 * Gas-price engine: real Texas fuel stations (OpenStreetMap snapshot) indexed
 * into H3 cells, with a mean-reverting OU price per cell (the paper's process)
 * whose shocks propagate hexagonally to H3 k-ring neighbors. Each station
 * carries a small fixed offset, so ~10.6k stations each show a distinct live
 * price while moving coherently with their cell — synthetic prices spread
 * across a real station database.
 *
 * Framework-agnostic and deterministic: built once, ticked imperatively, read
 * by the canvas each frame. The first frame (all cells at baseline) is the
 * same on server and client.
 */
import { latLngToCell, cellToLatLng, gridDisk } from "h3-js";
import { project, METROS } from "./texas-geo";
import stationData from "./stations.json";

const H3_RES = 6;
const KAPPA = 2.0;
const DT = 1 / 252;
const DRIFT = Math.exp(-KAPPA * DT);
const EWMA_LAMBDA = 0.94;
const SIGMA_MIN = 0.1;
const SIGMA_MAX = 0.48;

// shock blend: metro-wide + hexagonal-neighbor + idiosyncratic
const W_METRO = 0.5;
const W_NEIGHBOR = 0.35;
const W_IDIO = 0.55;
const NORM = 1 / Math.sqrt(W_METRO ** 2 + W_NEIGHBOR ** 2 + W_IDIO ** 2);

const raw = stationData as { brands: string[]; stations: [number, number, number][] };

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(rand: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Inverse-distance-weighted seed from metro baselines, at a projected point. */
function idw(px: number, py: number) {
  let w = 0;
  let price = 0;
  let sig = 0;
  let nearest = 0;
  let nd = Infinity;
  for (let m = 0; m < METROS.length; m++) {
    const dx = px - METROS[m].pos[0];
    const dy = py - METROS[m].pos[1];
    const d2 = dx * dx + dy * dy;
    if (d2 < nd) {
      nd = d2;
      nearest = m;
    }
    const wi = 1 / (d2 + 400);
    w += wi;
    price += wi * METROS[m].price;
    sig += wi * METROS[m].sigma;
  }
  return { price: price / w, sigma: sig / w, metro: nearest };
}

export type GasEngine = ReturnType<typeof buildEngine>;

function buildEngine() {
  const N = raw.stations.length;
  const stationXY = new Float32Array(N * 2);
  const stationCell = new Int32Array(N);
  const stationOffset = new Float32Array(N);
  const stationBrand = new Int32Array(N);
  const stationLngLat = new Float32Array(N * 2);

  // --- assign each real station to an H3 cell ---
  const cellIndex = new Map<string, number>();
  const cellH3: string[] = [];
  const offRand = mulberry32(0xbeef);

  for (let i = 0; i < N; i++) {
    const [lon, lat, brand] = raw.stations[i];
    const [x, y] = project(lon, lat);
    stationXY[i * 2] = x;
    stationXY[i * 2 + 1] = y;
    stationLngLat[i * 2] = lon;
    stationLngLat[i * 2 + 1] = lat;
    stationBrand[i] = brand;
    // small, fixed per-station price offset (brand/site level), ±~1.3%
    stationOffset[i] = gauss(offRand) * 0.013;
    const h = latLngToCell(lat, lon, H3_RES);
    let ci = cellIndex.get(h);
    if (ci === undefined) {
      ci = cellH3.length;
      cellIndex.set(h, ci);
      cellH3.push(h);
    }
    stationCell[i] = ci;
  }

  const C = cellH3.length;
  const cellMu = new Float64Array(C);
  const cellX = new Float64Array(C);
  const cellEwma = new Float64Array(C);
  const cellPrev = new Float64Array(C);
  const cellDay = new Float64Array(C);
  const cellSigmaBase = new Float64Array(C);
  const cellSigma = new Float64Array(C);
  const cellMetro = new Int32Array(C);
  const cellCX = new Float64Array(C);
  const cellCY = new Float64Array(C);
  const cellNeighbors: number[][] = [];

  for (let c = 0; c < C; c++) {
    const [lat, lon] = cellToLatLng(cellH3[c]);
    const [px, py] = project(lon, lat);
    cellCX[c] = px;
    cellCY[c] = py;
    const seed = idw(px, py);
    cellMu[c] = Math.log(seed.price);
    cellX[c] = cellMu[c];
    cellSigmaBase[c] = seed.sigma;
    cellSigma[c] = seed.sigma;
    cellEwma[c] = (seed.sigma * seed.sigma) / 252;
    cellPrev[c] = seed.price;
    cellMetro[c] = seed.metro;
  }
  // hexagonal neighbor lists (H3 k-ring ∩ occupied cells)
  for (let c = 0; c < C; c++) {
    const nbrs: number[] = [];
    for (const h of gridDisk(cellH3[c], 1)) {
      const ni = cellIndex.get(h);
      if (ni !== undefined && ni !== c) nbrs.push(ni);
    }
    cellNeighbors.push(nbrs);
  }

  // nearest cell to each metro (for roll-up + alerts)
  const metroCell = new Int32Array(METROS.length);
  for (let m = 0; m < METROS.length; m++) {
    let best = 0;
    let bd = Infinity;
    for (let c = 0; c < C; c++) {
      const d = (cellCX[c] - METROS[m].pos[0]) ** 2 + (cellCY[c] - METROS[m].pos[1]) ** 2;
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    metroCell[m] = best;
  }

  // stations per cell (for station-weighted state averages)
  const cellCount = new Int32Array(C);
  for (let i = 0; i < N; i++) cellCount[stationCell[i]] += 1;

  const rand = mulberry32(0x51ed23);
  const z = new Float64Array(C);
  const metroShock = new Float64Array(METROS.length);

  let priceMin = Math.exp(Math.min(...cellMu));
  let priceMax = Math.exp(Math.max(...cellMu));
  let avgPrice = Math.exp(cellMu.reduce((s, v) => s + v, 0) / C);
  let avgDay = 0;

  function tick() {
    for (let m = 0; m < METROS.length; m++) metroShock[m] = gauss(rand);
    for (let c = 0; c < C; c++) z[c] = gauss(rand);

    let pmin = Infinity;
    let pmax = -Infinity;
    let wPrice = 0;
    let wDay = 0;
    for (let c = 0; c < C; c++) {
      const nb = cellNeighbors[c];
      let nMean = 0;
      for (let k = 0; k < nb.length; k++) nMean += z[nb[k]];
      nMean = nb.length ? nMean / nb.length : 0;
      const eps =
        NORM * (W_METRO * metroShock[cellMetro[c]] + W_NEIGHBOR * nMean + W_IDIO * z[c]);

      const statSd = cellSigmaBase[c] * Math.sqrt((1 - Math.exp(-2 * KAPPA * DT)) / (2 * KAPPA));
      const prev = Math.exp(cellX[c]);
      cellX[c] = cellMu[c] + (cellX[c] - cellMu[c]) * DRIFT + statSd * eps;
      const price = Math.exp(cellX[c]);

      const r = Math.log(price / prev);
      cellEwma[c] = EWMA_LAMBDA * cellEwma[c] + (1 - EWMA_LAMBDA) * r * r;
      cellSigma[c] = Math.min(SIGMA_MAX, Math.max(SIGMA_MIN, Math.sqrt(cellEwma[c] * 252)));
      cellDay[c] = price / cellPrev[c] - 1;
      cellPrev[c] = price;

      if (price < pmin) pmin = price;
      if (price > pmax) pmax = price;
      wPrice += price * cellCount[c];
      wDay += cellDay[c] * cellCount[c];
    }
    priceMin = pmin;
    priceMax = pmax;
    avgPrice = wPrice / N;
    avgDay = wDay / N;
  }

  const priceOfStation = (i: number) => Math.exp(cellX[stationCell[i]] + stationOffset[i]);
  const baselineOfStation = (i: number) => Math.exp(cellMu[stationCell[i]] + stationOffset[i]);

  /** Nearest station to a projected point (for click selection). */
  function nearestStation(px: number, py: number): number {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < N; i++) {
      const dx = stationXY[i * 2] - px;
      const dy = stationXY[i * 2 + 1] - py;
      const d = dx * dx + dy * dy;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }

  return {
    N,
    C,
    brands: raw.brands,
    stationXY,
    stationCell,
    stationBrand,
    stationLngLat,
    cellSigma,
    cellDay,
    cellMetro,
    metroCell,
    tick,
    priceOfStation,
    baselineOfStation,
    nearestStation,
    get priceMin() {
      return priceMin;
    },
    get priceMax() {
      return priceMax;
    },
    get avgPrice() {
      return avgPrice;
    },
    get avgDay() {
      return avgDay;
    },
    sigmaMin: SIGMA_MIN,
    sigmaMax: SIGMA_MAX,
  };
}

let singleton: GasEngine | null = null;
export function getEngine(): GasEngine {
  if (!singleton) singleton = buildEngine();
  return singleton;
}
