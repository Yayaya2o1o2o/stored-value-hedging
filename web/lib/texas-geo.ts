/**
 * Texas geometry: a flat-top hexagonal tessellation clipped to an
 * approximate Texas boundary, plus metro anchors. All values are derived
 * deterministically at module load (pure functions of the constants below),
 * so the server and client compute identical geometry — no hydration drift.
 *
 * Projection: equirectangular with a cos(lat) correction on longitude so the
 * state reads at its true proportions. Latitude is flipped (north is up).
 */

// --- geographic extent (degrees) ---
const LON_MIN = -106.65;
const LON_MAX = -93.51;
const LAT_MIN = 25.84;
const LAT_MAX = 36.5;
const COS = Math.cos((31 * Math.PI) / 180); // mid-state latitude correction

const PAD = 28;
const SCALE = 62; // px per corrected degree

export function project(lon: number, lat: number): [number, number] {
  const x = PAD + (lon - LON_MIN) * COS * SCALE;
  const y = PAD + (LAT_MAX - lat) * SCALE;
  return [x, y];
}

const spanX = (LON_MAX - LON_MIN) * COS * SCALE;
const spanY = (LAT_MAX - LAT_MIN) * SCALE;

export const VIEWBOX = {
  w: Math.round(spanX + 2 * PAD),
  h: Math.round(spanY + 2 * PAD),
};

// --- Texas boundary, traced clockwise from the panhandle's northwest ---
const OUTLINE_LONLAT: Array<[number, number]> = [
  [-103.04, 36.5], // panhandle NW
  [-100.0, 36.5], // panhandle NE
  [-100.0, 34.56],
  [-99.2, 34.22],
  [-97.46, 33.82],
  [-96.0, 33.82],
  [-94.43, 33.64], // NE corner (Texarkana)
  [-94.04, 33.02],
  [-94.04, 31.0],
  [-93.84, 30.3],
  [-93.51, 29.77], // Sabine mouth
  [-94.79, 29.3], // Gulf coast begins
  [-95.3, 28.8],
  [-96.4, 28.4],
  [-97.1, 27.8], // Corpus
  [-97.35, 27.0],
  [-97.15, 26.2],
  [-97.35, 25.9], // Rio Grande mouth (Brownsville)
  [-98.24, 26.06], // Rio Grande begins
  [-99.1, 26.4],
  [-99.45, 27.04],
  [-99.52, 27.5],
  [-100.0, 28.05],
  [-100.67, 29.1],
  [-101.41, 29.77],
  [-102.3, 29.88],
  [-102.68, 29.75],
  [-103.28, 29.0], // Big Bend low point
  [-104.2, 29.55],
  [-104.68, 30.18],
  [-105.4, 30.85],
  [-106.2, 31.47],
  [-106.65, 31.9], // El Paso, far west tip
  [-106.62, 32.0],
  [-103.06, 32.0], // NM border jog
  [-103.06, 36.5], // up the panhandle west side
];

export const TX_OUTLINE: Array<[number, number]> = OUTLINE_LONLAT.map(([lo, la]) =>
  project(lo, la)
);

/** Ray-casting point-in-polygon test. */
function inside(x: number, y: number, poly: Array<[number, number]>): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const crosses =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) hit = !hit;
  }
  return hit;
}

// --- metro anchors: name, lon/lat, baseline $/gal, base annualized vol,
//     illustrative annual gasoline procurement budget ($M) ---
type MetroSeed = {
  name: string;
  short: string;
  lon: number;
  lat: number;
  price: number;
  sigma: number;
  budgetM: number;
};

const METRO_SEEDS: MetroSeed[] = [
  { name: "Houston", short: "HOU", lon: -95.37, lat: 29.76, price: 2.74, sigma: 0.22, budgetM: 90 },
  { name: "Dallas–Fort Worth", short: "DFW", lon: -96.8, lat: 32.78, price: 2.86, sigma: 0.2, budgetM: 85 },
  { name: "San Antonio", short: "SAT", lon: -98.49, lat: 29.42, price: 2.79, sigma: 0.19, budgetM: 40 },
  { name: "Austin", short: "AUS", lon: -97.74, lat: 30.27, price: 2.92, sigma: 0.24, budgetM: 45 },
  { name: "El Paso", short: "ELP", lon: -106.49, lat: 31.76, price: 3.18, sigma: 0.3, budgetM: 18 },
  { name: "Corpus Christi", short: "CRP", lon: -97.4, lat: 27.8, price: 2.76, sigma: 0.26, budgetM: 14 },
  { name: "Lubbock", short: "LBB", lon: -101.86, lat: 33.58, price: 2.98, sigma: 0.28, budgetM: 12 },
  { name: "Amarillo", short: "AMA", lon: -101.83, lat: 35.22, price: 3.02, sigma: 0.29, budgetM: 10 },
  { name: "McAllen", short: "MFE", lon: -98.23, lat: 26.2, price: 2.71, sigma: 0.23, budgetM: 16 },
  { name: "Midland–Odessa", short: "MAF", lon: -102.2, lat: 31.92, price: 3.06, sigma: 0.34, budgetM: 15 },
  { name: "Beaumont", short: "BPT", lon: -94.1, lat: 30.08, price: 2.77, sigma: 0.27, budgetM: 10 },
  { name: "Waco", short: "ACT", lon: -97.15, lat: 31.55, price: 2.83, sigma: 0.18, budgetM: 9 },
];

export type Metro = {
  name: string;
  short: string;
  pos: [number, number];
  price: number;
  sigma: number;
  budgetM: number;
};

export const METROS: Metro[] = METRO_SEEDS.map((m) => ({
  name: m.name,
  short: m.short,
  pos: project(m.lon, m.lat),
  price: m.price,
  sigma: m.sigma,
  budgetM: m.budgetM,
}));

// --- hex tessellation (flat-top) ---
const HEX_SIZE = 23; // circumradius
const HEX_W = 2 * HEX_SIZE;
const HEX_H = Math.sqrt(3) * HEX_SIZE;
const COL_STEP = 1.5 * HEX_SIZE;
const ROW_STEP = HEX_H;

function hexPolygon(cx: number, cy: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i); // flat-top: first vertex at angle 0
    pts.push(`${(cx + HEX_SIZE * Math.cos(a)).toFixed(1)},${(cy + HEX_SIZE * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

export type Hex = {
  id: number;
  cx: number;
  cy: number;
  points: string;
  baseline: number; // baseline $/gal
  sigma: number; // base annualized vol inherited from nearest metro
  metroIdx: number; // nearest metro index (drives correlated shocks)
};

function buildHexes(): Hex[] {
  const out: Hex[] = [];
  let id = 0;
  const cols = Math.ceil((VIEWBOX.w + HEX_W) / COL_STEP);
  const rows = Math.ceil((VIEWBOX.h + HEX_H) / ROW_STEP);
  for (let c = 0; c <= cols; c++) {
    const cx = c * COL_STEP;
    for (let r = 0; r <= rows; r++) {
      const cy = r * ROW_STEP + (c % 2 ? ROW_STEP / 2 : 0);
      if (!inside(cx, cy, TX_OUTLINE)) continue;

      // inverse-distance weighting from metros for baseline + sigma
      let wSum = 0;
      let priceSum = 0;
      let sigmaSum = 0;
      let nearest = 0;
      let nearestD = Infinity;
      for (let m = 0; m < METROS.length; m++) {
        const dx = cx - METROS[m].pos[0];
        const dy = cy - METROS[m].pos[1];
        const d2 = dx * dx + dy * dy;
        if (d2 < nearestD) {
          nearestD = d2;
          nearest = m;
        }
        const w = 1 / (d2 + 400); // +400 softens singularity at metro centers
        wSum += w;
        priceSum += w * METRO_SEEDS[m].price;
        sigmaSum += w * METRO_SEEDS[m].sigma;
      }
      out.push({
        id: id++,
        cx,
        cy,
        points: hexPolygon(cx, cy),
        baseline: priceSum / wSum,
        sigma: sigmaSum / wSum,
        metroIdx: nearest,
      });
    }
  }
  return out;
}

export const HEXES: Hex[] = buildHexes();

/** Index of the hex whose center is closest to a metro. */
export function hexForMetro(metroIdx: number): number {
  const [mx, my] = METROS[metroIdx].pos;
  let best = 0;
  let bestD = Infinity;
  for (const h of HEXES) {
    const d = (h.cx - mx) ** 2 + (h.cy - my) ** 2;
    if (d < bestD) {
      bestD = d;
      best = h.id;
    }
  }
  return best;
}

/** Label a hex by its nearest metro (used in the region panel). */
export function metroOf(hex: Hex): Metro {
  return METROS[hex.metroIdx];
}
