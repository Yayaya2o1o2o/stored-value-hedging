# Texas Gas-Price Hedging Console — Design Spec

**Date:** 2026-07-02
**Status:** Approved, ready for implementation
**Route:** `/dashboard` in the existing Next.js app (`web/`)

## Purpose

A live, self-contained console for a company analyzing and predicting Texas
retail gasoline prices. It watches per-metro prices move in real time on a
hexagonal map of Texas, and for any selected region computes a hedge
recommendation from the existing hedge-ratio optimizer plus a short-horizon
price forecast. It is a native extension of the existing site brand — no new
design language.

## Scope

- New page only. No changes to the model, paper, or existing pages except
  adding one nav entry (`Dashboard`) in `web/app/layout.tsx`.
- Retail gasoline ($/gal), Texas metros.
- Live feed is **simulated** on the client using a port of the model's OU
  price process. No external APIs, no keys, no server routes.

## Brand constraints (must match existing site exactly)

- Colors: only the existing CSS variables in `globals.css`
  (`--paper #f7f4ec`, `--paper-deep #efe9db`, `--ink #211c15`,
  `--ink-soft #5c5346`, `--terra #c05b2e`, `--slate #4a6b8a`,
  `--sage #5a7d5a`, `--hairline #e0d8c8`). No new colors.
- Type: Newsreader (display), Source Serif (body), IBM Plex Mono (labels).
- Motifs: hairline borders, `eyebrow` mono labels, `grid gap-px bg-hairline`
  cell blocks, `color-mix(in srgb, #c05b2e X%, #f7f4ec)` value coloring
  (same technique as the `/model` surface map), `fade-up` / `draw-curve`
  animation primitives, `prefers-reduced-motion` respected.
- Client component pattern mirrors `app/model/page.tsx` exactly
  (`"use client"`, `useState`/`useEffect`/`useMemo`/`useRef`).

## New modules

### `lib/texas-geo.ts` — hex tessellation + metros
- Approximate Texas boundary as an SVG polygon (array of [x,y] in a fixed
  viewBox, e.g. 0..1000 × 0..1000, projected from lon/lat).
- Generate a flat-top hexagonal grid over the bounding box; keep hexes whose
  center is inside the boundary polygon (ray-casting point-in-polygon).
- ~12 metro anchors with projected positions and baseline $/gal:
  Houston, Dallas–Fort Worth, San Antonio, Austin, El Paso, Corpus Christi,
  Lubbock, Amarillo, McAllen, Midland–Odessa, Beaumont, Waco.
  Baselines seeded in a realistic ~$2.70–$3.30 spread.
- Each hex baseline = inverse-distance-weighted blend of nearest metro
  baselines, so the field is smooth and metros are local extrema.
- Exports: `HEXES` (id, center, polygon points, baseline, nearestMetro),
  `METROS` (name, position, baseline), `TX_OUTLINE` (path/points),
  `VIEWBOX`.

### `lib/gas-feed.ts` — live simulator (OU port)
- Port `model/price_process.py` exact OU discretization to TS:
  `dt = 1/252`, `mu = ln(baseline)`, `kappa = 2.0`,
  `driftCoef = exp(-kappa·dt)`,
  `statSd = sigmaAnnual · sqrt((1 - exp(-2·kappa·dt)) / (2·kappa))`,
  `x ← mu + (x - mu)·driftCoef + statSd·N(0,1)`, `price = exp(x)`.
- One state per hex. Each metro has a base `sigmaAnnual` in the model's
  range (0.10–0.45); hexes inherit their nearest metro's sigma with small
  jitter.
- Per tick (~2s, several model-days advanced per tick so motion is visible):
  apply a **metro-correlated shock** — draw one shock per metro, each hex's
  innovation = ρ·metroShock + sqrt(1−ρ²)·idiosyncratic — so neighbors move
  together.
- Track a rolling window of recent log-returns per hex → realized annualized
  volatility σ (this is what feeds the hedge model). Keep a short price
  history (for sparkline + 24h delta).
- Deterministic seed (no `Math.random` reliance for reproducibility across
  SSR/hydration — use a small seeded PRNG, e.g. mulberry32). Pausable.
  Halts ticking under `prefers-reduced-motion` (shows a static snapshot).
- Exports a `useGasFeed()` hook returning `{ hexes: LiveHex[], metros,
  tick, paused, setPaused }` where `LiveHex = { id, price, sigma, dayChange,
  history }`.

### `lib/forecast.ts` — short-horizon price projection
- From a hex's current price, its `mu` (ln baseline), `kappa`, and realized
  σ, project the OU **expected path** forward N days:
  `E[ln S_{t+n}] = mu + (ln S_t − mu)·exp(−kappa·n·dt)`.
- Confidence band width from OU transient variance scaled by realized σ and
  informed by `residual_sigma` framing from `forecasting_summary.json`
  (label the projection ARIMA-style, matching the paper's winner = ARIMA).
- Exports `forecastPath(hex, days)` → `{ day, expected, lo, hi }[]`.

### Reused unchanged
- `lib/model.ts` `recommend(σ, cv)` for h*, J, CVaR95, savings.
- `components/ObjectiveCurve.tsx` for the objective curve in the region panel.

## Page structure (`app/dashboard/page.tsx`)

Single client page, `max-w-6xl`, mirroring `/model` composition:

1. **Header block** — eyebrow `LIVE · SIMULATED FEED · TEXAS RETAIL
   GASOLINE`, H1 "Texas Gas-Price Hedging Console", subhead, and a small
   mono stat cluster (feed status / tick / pause toggle) like the
   Horizon·Paths·Budget cluster on `/model`.
2. **Statewide roll-up strip** — `grid gap-px bg-hairline` cells:
   avg $/gal, Δ24h, budget-at-risk ($), blended h*, # metros in high-hedge
   regime. Aggregates across all metros live.
3. **Main two-column** (`xl:grid-cols-[1fr_420px]`):
   - **Left — HexMap** (`components/HexMap.tsx`): SVG hex tessellation,
     each hex filled via `color-mix` on price (or σ when toggled), metro
     labels, click-to-select (selected hex gets ink outline), legend scale,
     price↔volatility toggle. Smooth color transition per tick.
   - **Right — Region panel**: metro name + live price + Δ + live σ; a
     `cv` demand-forecast-error slider (same control as `/model`); big
     terracotta h*; `ObjectiveCurve`; J / CVaR95 / savings-vs-no-hedge
     stat cells; forecast chart (`components/ForecastChart.tsx`, next-30d
     expected line + band, drawn with the `draw-curve` primitive).
4. **Volatility alerts ticker** (`components/AlertTicker.tsx`) — bottom
   strip; emits an entry when a metro's live σ moves h* across a regime
   threshold (no-hedge / partial / high-cover / full-cover). Keeps last N.

## New components
- `components/HexMap.tsx`
- `components/ForecastChart.tsx`
- `components/AlertTicker.tsx`
(Kept small and single-purpose; each takes plain props, no data fetching.)

## Data flow
`useGasFeed()` (owns the OU sim + timer) → page state holds `selectedHexId`
→ derived: selected `LiveHex` → `recommend(sigma, cv)` (cv from slider) →
region panel + `forecastPath()` → forecast chart. Roll-up and alerts derive
from the full `hexes` array each tick. All computation client-side and cheap
(interpolation over precomputed curves + closed-form OU projection).

## Error / edge handling
- SSR/hydration: seed the sim deterministically; render the same first frame
  on server and client to avoid hydration mismatch; start the timer in
  `useEffect`.
- `prefers-reduced-motion`: no timer, static snapshot, no color animation.
- Empty/degenerate selection: default-select Houston on load.
- Performance: hex count kept moderate (~150–250 cells) so per-tick recolor
  stays smooth; no per-hex React components with heavy work — render hexes as
  SVG `<polygon>` in one component.

## Testing / verification
- `npm run build` in `web/` must pass (typecheck + lint clean).
- Headless screenshot of `/dashboard` (verify skill) to confirm it renders,
  the map draws inside the Texas outline, the region panel populates, and the
  brand matches (cream/terracotta, correct fonts).
- Deploy to Vercel (project already linked in `web/.vercel`).

## Addendum (2026-07-02) — station-level H3 upgrade

The region-hex prototype was upgraded to real station granularity:

- **Real station database:** 10,584 Texas fueling stations pulled from the
  OpenStreetMap Overpass API (real brands + coordinates: Valero, Shell, Exxon,
  Chevron, QuikTrip, Buc-ee's, …) and snapshotted to `lib/stations.json`
  (250 KB, no runtime dependency).
- **H3 indexing:** every station is indexed into an H3 resolution-6 cell
  (`h3-js`), yielding 1,874 occupied cells. Each cell runs the OU price; shocks
  spread to H3 k-ring neighbors (`gridDisk`) — the hexagonal spread.
- **Per-station prices:** each station carries a fixed ±~1.3% offset, so all
  10,584 stations show distinct live prices while moving with their cell.
- **Rendering:** `components/StationCanvas.tsx` draws all stations as points on
  a `<canvas>`, repainted every 800 ms tick; click selects the nearest station.
  The old `HexMap.tsx` / `gas-feed.ts` were removed.
- **Engine:** `lib/gas-engine.ts` (framework-agnostic, built once via
  `getEngine()`), driven by `lib/use-gas-engine.ts`. The region panel now binds
  to a selected station and its H3 cell; roll-up/alerts use each metro's
  nearest cell.

## Addendum (2026-07-02) — profitability model (`/profitability`)

A customizable P&L for a gas price-lock business (paylo.shop: prepay to lock a
per-gallon price for a year; hedge the locked gallons; keep the spread).

- **Customizable database:** Supabase Postgres table
  `hedging_profitability_scenarios` (project `stored-value-hedging`,
  `qaoziayjxzemiagqovts`). Public RLS (demo); presets read-only, user scenarios
  insert/update/delete. Seeded with Paylo Sip/Cruise/Fleet. Client via
  `@supabase/supabase-js` (`lib/supabase.ts`, `lib/scenarios.ts`); env
  `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Model (`lib/profitability.ts`):** deposit is the invested float; annual gas
  **throughput** (gallons × locked price) is the hedge-exposure and interchange
  base. Revenue = float income + fee + interchange + hedge spread. Fixed costs =
  interest to user + processing + commission + opex + CAC. Hedge cost comes from
  the optimizer: **expected** = mean cost E[N], **worst-case** = CVaR95, at h*
  (hedged) vs h=0 (unhedged), scaled by throughput.
- **Framing:** hedging is insurance — it costs expected margin (premium) to buy
  tail protection (CVaR). Outputs: expected/worst × hedged/unhedged net,
  premium, downside protected, protection ratio, margins, LTV:CAC, portfolio
  roll-up. Pause note: creating this project required pausing the `versify`
  Supabase project to free a free-tier slot.

## Out of scope
- Real external price data, auth, persistence, mobile-first redesign
  (responsive but desktop-primary like the rest of the site).
