/**
 * Profitability model for a gas price-lock business (e.g. paylo.shop): a
 * customer prepays a deposit to lock a per-gallon price for a term; the company
 * hedges the locked gallons, invests the float, and keeps the spread. This
 * model turns a customizable set of pricing variables into a per-account P&L
 * and margin ratios, and — the whole point — compares the bottom line WITH vs
 * WITHOUT hedging, using the paper's optimizer for the hedge cost.
 */
import { recommend, BUDGET } from "./model";

export type Params = {
  // product
  deposit: number; // $ prepaid / invested float
  lockedPrice: number; // $/gal locked
  annualGallons: number; // gallons the customer pumps per year (throughput)
  termMonths: number;
  txnsPerYear: number; // pump events (card transactions)
  // revenue
  annualFeePct: number; // % of deposit
  tbillAllocPct: number; // % of deposit invested in T-bills
  tbillYieldPct: number; // T-bill APY
  userApyPct: number; // APY paid to the customer
  interchangePct: number; // card interchange earned, % of throughput
  hedgeSpreadPct: number; // commodity spread captured, % of throughput
  // costs
  processingPct: number; // payment processing, % of throughput
  perTxnFee: number; // fixed $ per transaction
  commissionPct: number; // partner / affiliate commission, % of deposit
  cac: number; // customer acquisition cost, $
  opexPerAccountYr: number; // operating cost per account, $/yr
  cardIssuingYr: number; // card program cost, $/yr
  // hedge scenario (feeds the optimizer)
  sigma: number; // price volatility
  cv: number; // demand forecast error
  // portfolio
  customers: number;
  avgLifeYears: number;
};

export const PARAM_GROUPS: {
  group: string;
  fields: { key: keyof Params; label: string; unit: string; step: number }[];
}[] = [
  {
    group: "Product",
    fields: [
      { key: "deposit", label: "Deposit / float", unit: "$", step: 10 },
      { key: "lockedPrice", label: "Locked price", unit: "$/gal", step: 0.05 },
      { key: "annualGallons", label: "Gallons / yr", unit: "gal", step: 25 },
      { key: "termMonths", label: "Term", unit: "mo", step: 1 },
      { key: "txnsPerYear", label: "Pump txns / yr", unit: "#", step: 1 },
    ],
  },
  {
    group: "Revenue",
    fields: [
      { key: "annualFeePct", label: "Annual fee", unit: "% dep", step: 0.1 },
      { key: "tbillAllocPct", label: "T-bill allocation", unit: "% dep", step: 5 },
      { key: "tbillYieldPct", label: "T-bill yield", unit: "% APY", step: 0.1 },
      { key: "userApyPct", label: "User APY paid", unit: "% APY", step: 0.1 },
      { key: "interchangePct", label: "Interchange earned", unit: "% thru", step: 0.1 },
      { key: "hedgeSpreadPct", label: "Hedge spread", unit: "% thru", step: 0.1 },
    ],
  },
  {
    group: "Costs",
    fields: [
      { key: "processingPct", label: "Processing", unit: "% thru", step: 0.1 },
      { key: "perTxnFee", label: "Per-txn fee", unit: "$", step: 0.01 },
      { key: "commissionPct", label: "Partner commission", unit: "%", step: 0.1 },
      { key: "cac", label: "Acquisition (CAC)", unit: "$", step: 5 },
      { key: "opexPerAccountYr", label: "Opex / account", unit: "$/yr", step: 1 },
      { key: "cardIssuingYr", label: "Card program", unit: "$/yr", step: 1 },
    ],
  },
  {
    group: "Hedge scenario",
    fields: [
      { key: "sigma", label: "Price volatility σ", unit: "", step: 0.005 },
      { key: "cv", label: "Demand forecast error", unit: "cv", step: 0.002 },
    ],
  },
  {
    group: "Portfolio",
    fields: [
      { key: "customers", label: "Customers", unit: "#", step: 100 },
      { key: "avgLifeYears", label: "Avg. customer life", unit: "yr", step: 0.5 },
    ],
  },
];

export type LineItem = { label: string; value: number };

export type Result = {
  hStar: number;
  throughput: number;
  // per account
  revenue: LineItem[];
  fixedCosts: LineItem[];
  totalRevenue: number;
  totalFixed: number;
  // hedge cost, expected vs worst-case (CVaR95), each hedged vs unhedged
  expHedgeCost: number;
  expUnhedgeCost: number;
  worstHedgeCost: number;
  worstUnhedgeCost: number;
  netExpHedged: number;
  netExpUnhedged: number;
  netWorstHedged: number;
  netWorstUnhedged: number;
  // the hedging decision
  premium: number; // expected margin given up to hedge (netExpUnhedged − netExpHedged)
  downsideProtected: number; // worst-case margin saved (netWorstHedged − netWorstUnhedged)
  protectionRatio: number; // downsideProtected / premium
  // ratios
  netMarginPct: number; // expected hedged net / throughput
  returnOnFloatPct: number;
  ltv: number;
  ltvCac: number;
  // portfolio
  portfolioExpHedged: number;
  portfolioDownsideProtected: number;
  portfolioPremium: number;
};

/** Hedge cost fractions of throughput, from the optimizer: expected (mean)
 *  and worst-5% (CVaR95), each at h* (hedged) and at h=0 (unhedged). */
function riskFractions(sigma: number, cv: number) {
  const rec = recommend(sigma, cv);
  const at0 = rec.curve.reduce((a, b) => (Math.abs(b.h) < Math.abs(a.h) ? b : a));
  return {
    hStar: rec.hStar,
    meanH: rec.mean / BUDGET,
    meanU: at0.mean / BUDGET,
    cvarH: rec.cvar / BUDGET,
    cvarU: at0.cvar / BUDGET,
  };
}

export function compute(p: Params): Result {
  const throughput = p.annualGallons * p.lockedPrice; // annual gas value = exposure + interchange base
  const base = throughput; // hedge exposure base (GMV)

  // --- revenue (annualized) ---
  const floatIncome = p.deposit * (p.tbillAllocPct / 100) * (p.tbillYieldPct / 100);
  const feeIncome = p.deposit * (p.annualFeePct / 100);
  const interchangeIncome = throughput * (p.interchangePct / 100);
  const spreadIncome = throughput * (p.hedgeSpreadPct / 100);
  const revenue: LineItem[] = [
    { label: "Float income (T-bills)", value: floatIncome },
    { label: "Annual fee", value: feeIncome },
    { label: "Interchange", value: interchangeIncome },
    { label: "Hedge spread", value: spreadIncome },
  ];
  const totalRevenue = floatIncome + feeIncome + interchangeIncome + spreadIncome;

  // --- fixed operating costs (independent of the hedge decision) ---
  const interestToUser = p.deposit * (p.userApyPct / 100);
  const processing = throughput * (p.processingPct / 100) + p.perTxnFee * p.txnsPerYear;
  const commission = p.deposit * (p.commissionPct / 100);
  const opex = p.opexPerAccountYr + p.cardIssuingYr;
  const cacAmortized = p.cac / Math.max(0.25, p.avgLifeYears);

  const fixedCosts: LineItem[] = [
    { label: "Interest to user", value: interestToUser },
    { label: "Processing", value: processing },
    { label: "Partner commission", value: commission },
    { label: "Opex + card program", value: opex },
    { label: "Acquisition (amortized)", value: cacAmortized },
  ];
  const totalFixed = interestToUser + processing + commission + opex + cacAmortized;

  // --- hedge cost: expected vs worst-case, from the optimizer ---
  const rf = riskFractions(p.sigma, p.cv);
  const expHedgeCost = base * rf.meanH;
  const expUnhedgeCost = base * rf.meanU;
  const worstHedgeCost = base * rf.cvarH;
  const worstUnhedgeCost = base * rf.cvarU;

  const netExpHedged = totalRevenue - totalFixed - expHedgeCost;
  const netExpUnhedged = totalRevenue - totalFixed - expUnhedgeCost;
  const netWorstHedged = totalRevenue - totalFixed - worstHedgeCost;
  const netWorstUnhedged = totalRevenue - totalFixed - worstUnhedgeCost;

  const premium = netExpUnhedged - netExpHedged; // margin given up to hedge
  const downsideProtected = netWorstHedged - netWorstUnhedged; // tail margin saved
  const protectionRatio = premium > 0.01 ? downsideProtected / premium : Infinity;

  // --- ratios ---
  const netMarginPct = base ? (netExpHedged / base) * 100 : 0;
  const returnOnFloatPct = p.deposit ? ((floatIncome - interestToUser) / p.deposit) * 100 : 0;
  const ltv = netExpHedged * p.avgLifeYears;
  const ltvCac = p.cac ? ltv / p.cac : 0;

  return {
    hStar: rf.hStar,
    throughput,
    revenue,
    fixedCosts,
    totalRevenue,
    totalFixed,
    expHedgeCost,
    expUnhedgeCost,
    worstHedgeCost,
    worstUnhedgeCost,
    netExpHedged,
    netExpUnhedged,
    netWorstHedged,
    netWorstUnhedged,
    premium,
    downsideProtected,
    protectionRatio,
    netMarginPct,
    returnOnFloatPct,
    ltv,
    ltvCac,
    portfolioExpHedged: netExpHedged * p.customers,
    portfolioDownsideProtected: downsideProtected * p.customers,
    portfolioPremium: premium * p.customers,
  };
}

export const DEFAULT_PARAMS: Params = {
  deposit: 180,
  lockedPrice: 3.1,
  annualGallons: 400,
  termMonths: 12,
  txnsPerYear: 40,
  annualFeePct: 1.5,
  tbillAllocPct: 90,
  tbillYieldPct: 4.7,
  userApyPct: 4.4,
  interchangePct: 1.2,
  hedgeSpreadPct: 2.0,
  processingPct: 0.3,
  perTxnFee: 0.05,
  commissionPct: 1.0,
  cac: 18,
  opexPerAccountYr: 4,
  cardIssuingYr: 3,
  sigma: 0.25,
  cv: 0.112,
  customers: 2500,
  avgLifeYears: 3,
};
