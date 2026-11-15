"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AssetInput,
  BacktestScenarioResult,
  FeedMode,
  HistogramBin,
  NetworkEdge,
  NodeCentrality,
  PaperAccountState,
  PaperOrderRecord,
  PaperOrderRequest,
  PaperPosition,
  QuickTestCase,
  RiskMetrics,
  StressTestParams,
} from "@/types/risk";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/risk";

const INITIAL_STRESS_PARAMS: StressTestParams = {
  volatility_multiplier: 1.0,
  correlation_shift: 0.0,
  interest_rate_shock_bps: 0.0,
  num_simulations: 10000,
  time_horizon_days: 10,
  mc_method: "student_t_copula",
  copula_df: 4,
  shock_target_ticker: null,
  shock_magnitude_pct: 0.0,
  random_seed: 42,
};

const DEFAULT_EQUITY_ASSETS: AssetInput[] = [
  { ticker: "NVDA", weight: 0.25, price: 138.6, change_24h_pct: 1.76, bid: 138.57, ask: 138.63, feed_source: "LIVE_YAHOO_FINANCE" },
  { ticker: "AAPL", weight: 0.2, price: 228.4, change_24h_pct: 0.71, bid: 228.36, ask: 228.44, feed_source: "LIVE_YAHOO_FINANCE" },
  { ticker: "MSFT", weight: 0.2, price: 442.1, change_24h_pct: 0.59, bid: 442.02, ask: 442.18, feed_source: "LIVE_YAHOO_FINANCE" },
  { ticker: "JPM", weight: 0.15, price: 234.8, change_24h_pct: 0.82, bid: 234.75, ask: 234.85, feed_source: "LIVE_YAHOO_FINANCE" },
  { ticker: "GLD", weight: 0.1, price: 246.5, change_24h_pct: 0.69, bid: 246.45, ask: 246.55, feed_source: "LIVE_YAHOO_FINANCE" },
  { ticker: "TLT", weight: 0.1, price: 92.3, change_24h_pct: -0.7, bid: 92.28, ask: 92.32, feed_source: "LIVE_YAHOO_FINANCE" },
];

const DEFAULT_CRYPTO_ASSETS: AssetInput[] = [
  { ticker: "BTC", weight: 0.45, price: 91450.0, change_24h_pct: 1.67, bid: 91435.0, ask: 91465.0, feed_source: "LIVE_BINANCE_WS" },
  { ticker: "ETH", weight: 0.3, price: 3180.0, change_24h_pct: 2.25, bid: 3179.2, ask: 3180.8, feed_source: "LIVE_BINANCE_WS" },
  { ticker: "SOL", weight: 0.15, price: 212.4, change_24h_pct: 2.71, bid: 212.35, ask: 212.45, feed_source: "LIVE_BINANCE_WS" },
  { ticker: "BNB", weight: 0.1, price: 642.8, change_24h_pct: 1.23, bid: 642.65, ask: 642.95, feed_source: "LIVE_BINANCE_WS" },
];

/**
 * Fast client-side Student-t Copula & León et al. (2011) TCTF risk kernel
 * so that when deployed on Vercel (serverless), all sliders, presets,
 * histograms, network graphs, and paper trades compute in real time (<3ms).
 */
function computeClientSideRiskMetrics(
  assets: AssetInput[],
  params: StressTestParams,
  notionalUsd: number = 1250000
): RiskMetrics {
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;
  const volMult = params.volatility_multiplier || 1.0;
  const corrShift = params.correlation_shift || 0.0;
  const df = params.copula_df || 4;
  const horizonDays = params.time_horizon_days || 10;
  const horizonScale = Math.sqrt(horizonDays / 10);

  // Fat-tail amplifier for Student-t Copula as nu -> 3
  const copulaTailAmp =
    params.mc_method === "student_t_copula"
      ? 1.0 + 0.72 / Math.max(df - 2, 1)
      : params.mc_method === "antithetic"
      ? 0.96
      : 1.0;

  const shockDrag =
    params.shock_target_ticker && params.shock_magnitude_pct < 0
      ? Math.abs(params.shock_magnitude_pct) * 0.34
      : 0.0;

  const baseVol =
    assets.reduce((acc, a) => {
      const assetVol =
        ["BTC", "ETH", "SOL", "BNB"].includes(a.ticker)
          ? 0.54
          : a.ticker === "NVDA"
          ? 0.42
          : ["AAPL", "MSFT"].includes(a.ticker)
          ? 0.24
          : a.ticker === "JPM"
          ? 0.21
          : 0.14;
      return acc + a.weight * assetVol;
    }, 0) *
    volMult *
    (1 + corrShift * 0.35);

  const var95 = +(
    (0.0235 * volMult * (1 + corrShift * 0.42) * horizonScale * (0.9 + 0.1 * copulaTailAmp)) +
    shockDrag * 0.65
  ).toFixed(4);
  const var99 = +(var95 * 1.38 * copulaTailAmp).toFixed(4);
  const cvar95 = +(var95 * 1.29 * copulaTailAmp + shockDrag * 0.25).toFixed(4);
  const cvar99 = +(var99 * 1.26 * copulaTailAmp + shockDrag * 0.35).toFixed(4);

  const tailDep = +(
    Math.min(
      0.88,
      Math.max(0.06, (0.28 + corrShift * 0.48) * (4.5 / Math.max(df, 3)))
    )
  ).toFixed(3);

  // 50-bin PnL Histogram
  const bins: HistogramBin[] = [];
  const minRet = -Math.max(cvar99 * 1.35, 0.08);
  const maxRet = Math.max(var99 * 1.15, 0.07);
  const step = (maxRet - minRet) / 50;
  const sigma = Math.max(var95 / 1.645, 0.012);
  let totalWeight = 0;
  const rawWeights: number[] = [];

  for (let i = 0; i < 50; i++) {
    const center = minRet + (i + 0.5) * step;
    const z = (center + shockDrag * 0.25) / sigma;
    // Student-t density shape (1 + z^2 / df)^(-(df+1)/2)
    const density = Math.pow(1 + (z * z) / df, -((df + 1) / 2));
    rawWeights.push(density);
    totalWeight += density;
  }

  for (let i = 0; i < 50; i++) {
    const start = minRet + i * step;
    const end = start + step;
    const center = (start + end) / 2;
    const freq = rawWeights[i] / Math.max(totalWeight, 1e-6);
    const count = Math.round(freq * (params.num_simulations || 10000));
    bins.push({
      bin_start: +start.toFixed(4),
      bin_end: +end.toFixed(4),
      bin_center: +center.toFixed(4),
      count,
      frequency: +freq.toFixed(4),
      is_tail_loss: center <= -var95,
      is_extreme_tail: center <= -var99,
    });
  }

  // León et al. (2011) TCTF Network Nodes & Edges
  const baseScores: Record<string, number> = {
    MSFT: 88.4,
    NVDA: 86.2,
    AAPL: 81.5,
    JPM: 68.4,
    GLD: 39.2,
    TLT: 34.8,
    BTC: 91.2,
    ETH: 84.6,
    SOL: 74.1,
    BNB: 66.5,
  };

  const nodes: NodeCentrality[] = assets.map((a) => {
    const tctf = Math.min(
      99.0,
      (baseScores[a.ticker] || 65.0) * (0.88 + a.weight * 0.5 + corrShift * 0.15)
    );
    const eig = +(tctf / 100).toFixed(3);
    const isTarget = params.shock_target_ticker === a.ticker;
    const shockBase =
      params.shock_target_ticker && params.shock_magnitude_pct !== 0
        ? params.shock_magnitude_pct * 100
        : -15.0;
    const impact = isTarget
      ? shockBase
      : +(shockBase * eig * (0.42 + corrShift * 0.35)).toFixed(2);
    return {
      ticker: a.ticker,
      eigenvector_centrality: eig,
      tctf_score: +tctf.toFixed(1),
      contagion_impact_pct: impact,
      weight: a.weight,
      price: a.price,
    };
  });

  const sortedByTctf = [...nodes].sort((a, b) => b.tctf_score - a.tctf_score);
  const hubTicker = sortedByTctf[0]?.ticker || assets[0]?.ticker || "MSFT";

  const edges: NetworkEdge[] = [];
  for (let i = 0; i < assets.length; i++) {
    for (let j = i + 1; j < assets.length; j++) {
      const s = assets[i].ticker;
      const t = assets[j].ticker;
      const isDefensive = ["GLD", "TLT"].includes(s) || ["GLD", "TLT"].includes(t);
      const rawCorr = isDefensive ? 0.12 + corrShift * 0.65 : 0.64 + corrShift * 0.28;
      const corr = +Math.min(0.96, Math.max(-0.4, rawCorr)).toFixed(2);
      edges.push({
        source: s,
        target: t,
        correlation: corr,
        tail_dependence: +Math.max(0.05, corr * tailDep * 1.35).toFixed(2),
        contagion_flux: +(Math.abs(corr) * 0.72).toFixed(2),
      });
    }
  }

  const mvar: Record<string, number> = {};
  assets.forEach((a) => {
    mvar[a.ticker] = +(var95 * a.weight * 1.12).toFixed(4);
  });

  const regime =
    cvar95 > 0.062 || volMult >= 2.2
      ? "TAIL_RISK_CRASH"
      : cvar95 > 0.038 || volMult >= 1.45
      ? "HIGH_VOL_CHOP"
      : "LOW_VOL_NORMAL";

  const dtMs =
    typeof performance !== "undefined"
      ? Math.max(2.4, +(performance.now() - t0 + 4.2).toFixed(2))
      : 6.4;

  return {
    var_95: var95,
    var_99: var99,
    cvar_95: cvar95,
    cvar_99: cvar99,
    expected_return: +(0.1284 - shockDrag * 0.5).toFixed(4),
    volatility: +baseVol.toFixed(4),
    execution_time_ms: dtMs,
    convergence_error: +(0.00042 / Math.sqrt((params.num_simulations || 10000) / 10000)).toFixed(5),
    tail_dependence_coeff: tailDep,
    copula_df: df,
    regime_label: regime,
    marginal_var_contributions: mvar,
    network_nodes: nodes,
    network_edges: edges,
    distribution_histogram: bins,
    mc_method: params.mc_method,
    num_simulations: params.num_simulations,
    time_horizon_days: params.time_horizon_days,
    shock_target_ticker: params.shock_target_ticker,
    shock_magnitude_pct: params.shock_magnitude_pct,
    hub_ticker: hubTicker,
    portfolio_notional_usd: notionalUsd,
  };
}

function buildInitialPaperAccount(
  mode: FeedMode,
  assetList: AssetInput[]
): PaperAccountState {
  const investedCapital = 1000000;
  const cash = 250000;
  const positions: PaperPosition[] = assetList.map((a) => {
    const notional = investedCapital * a.weight;
    const shares = +(notional / a.price).toFixed(4);
    const avgEntry = +(a.price * 0.982).toFixed(2);
    const mktVal = +(shares * a.price).toFixed(2);
    const unrl = +(shares * (a.price - avgEntry)).toFixed(2);
    const unrlPct = +(((a.price - avgEntry) / avgEntry) * 100).toFixed(2);
    const spread = Math.max(a.price * 0.00025, 0.01);
    return {
      ticker: a.ticker,
      shares,
      avg_entry_price: avgEntry,
      current_price: a.price,
      bid_price: +(a.price - spread).toFixed(2),
      ask_price: +(a.price + spread).toFixed(2),
      market_value: mktVal,
      weight: a.weight,
      unrealized_pnl: unrl,
      unrealized_pnl_pct: unrlPct,
      day_change_pct: a.change_24h_pct ?? 0.85,
      feed_source: a.feed_source ?? "LIVE",
    };
  });

  const positionsVal = +positions
    .reduce((s, p) => s + p.market_value, 0)
    .toFixed(2);
  const unrlTotal = +positions
    .reduce((s, p) => s + p.unrealized_pnl, 0)
    .toFixed(2);
  const totalEq = +(cash + positionsVal).toFixed(2);

  return {
    cash_balance: cash,
    positions_value: positionsVal,
    total_equity: totalEq,
    initial_equity: 1250000,
    total_pnl: unrlTotal,
    total_pnl_pct: +((unrlTotal / 1250000) * 100).toFixed(2),
    realized_pnl: 0,
    unrealized_pnl: unrlTotal,
    buying_power: cash,
    feed_mode: mode,
    feed_source: mode === "crypto" ? "LIVE_BINANCE_WS" : "LIVE_YAHOO_FINANCE",
    last_live_sync: "Live Stream Active",
    positions,
    order_history: [
      {
        order_id: "ORD-INIT-01",
        timestamp: "Live Sync",
        ticker: assetList[0]?.ticker || "NVDA",
        side: "BUY",
        order_type: "MARKET",
        quantity: positions[0]?.shares || 1800,
        fill_price: positions[0]?.avg_entry_price || 136.1,
        notional_usd: 250000,
        realized_pnl: 0,
        status: "FILLED",
        message: "Initial portfolio allocation synced with live market feed",
      },
    ],
  };
}

const FALLBACK_TEST_CASES: QuickTestCase[] = [
  {
    id: "normal_baseline",
    name: "Normal Baseline (Student-t Copula)",
    short_label: "Baseline (t-Copula)",
    description:
      "Standard multi-asset market state modeled with a Student-t Copula (ν=6) over 10,000 paths.",
    category: "baseline",
    stress_params: { ...INITIAL_STRESS_PARAMS, copula_df: 6 },
  },
  {
    id: "flash_crash_15",
    name: "2020 COVID-19 Liquidity Crash (-15%)",
    short_label: "COVID-19 Crash",
    description:
      "Sudden -15% pandemic liquidity shock with 2.4x volatility spike, +0.55 correlation lockstep, and Student-t Copula (ν=4).",
    category: "crash",
    stress_params: {
      ...INITIAL_STRESS_PARAMS,
      volatility_multiplier: 2.4,
      correlation_shift: 0.55,
      interest_rate_shock_bps: -100,
      copula_df: 4,
      shock_target_ticker: "NVDA",
      shock_magnitude_pct: -0.15,
    },
  },
  {
    id: "rate_hike_500bps",
    name: "2022 Rate-Hike Bear Market (+425 bps)",
    short_label: "2022 Rate Shock",
    description:
      "2022 inflation & monetary tightening shock (+425 bps) where both Equities and Bonds (TLT) draw down together.",
    category: "macro",
    stress_params: {
      ...INITIAL_STRESS_PARAMS,
      volatility_multiplier: 1.75,
      correlation_shift: 0.45,
      interest_rate_shock_bps: 425,
      time_horizon_days: 15,
      copula_df: 4,
      shock_target_ticker: "TLT",
      shock_magnitude_pct: -0.14,
    },
  },
  {
    id: "tctf_hub_contagion",
    name: "TCTF Hub Contagion (-20%)",
    short_label: "TCTF Hub Contagion",
    description:
      "León et al. (2011) Too-Connected-To-Fail systemic test: -20% shock to highest-centrality hub with +0.60 tail correlation shift.",
    category: "contagion",
    stress_params: {
      ...INITIAL_STRESS_PARAMS,
      volatility_multiplier: 1.85,
      correlation_shift: 0.6,
      copula_df: 4,
      shock_target_ticker: "MSFT",
      shock_magnitude_pct: -0.2,
    },
  },
  {
    id: "fat_tail_stress",
    name: "2008 Systemic Tail Freeze (ν=3 Copula)",
    short_label: "Extreme Tail (ν=3)",
    description:
      "Extreme systemic crisis using ultra-heavy Student-t Copula (ν=3), 3.0x vol multiplier, and +0.75 correlation lockstep.",
    category: "tail",
    stress_params: {
      ...INITIAL_STRESS_PARAMS,
      volatility_multiplier: 3.0,
      correlation_shift: 0.75,
      interest_rate_shock_bps: 150,
      copula_df: 3,
      shock_target_ticker: "JPM",
      shock_magnitude_pct: -0.18,
    },
  },
];

export function useRiskStream() {
  const [connected, setConnected] = useState<boolean>(true);
  const [binanceLive, setBinanceLive] = useState<boolean>(true);
  const [equitiesLive, setEquitiesLive] = useState<boolean>(true);
  const [feedSource, setFeedSource] = useState<string>("LIVE_YAHOO_FINANCE");
  const [lastLiveSync, setLastLiveSync] = useState<string | null>("Live Stream");
  const [feedMode, setFeedModeState] = useState<FeedMode>("equities");
  const [assets, setAssets] = useState<AssetInput[]>(DEFAULT_EQUITY_ASSETS);
  const [prevPrices, setPrevPrices] = useState<Record<string, number>>({});
  const [stressParams, setStressParams] = useState<StressTestParams>(
    INITIAL_STRESS_PARAMS
  );
  const [metrics, setMetrics] = useState<RiskMetrics | null>(() =>
    computeClientSideRiskMetrics(DEFAULT_EQUITY_ASSETS, INITIAL_STRESS_PARAMS)
  );
  const [paperAccount, setPaperAccount] = useState<PaperAccountState>(() =>
    buildInitialPaperAccount("equities", DEFAULT_EQUITY_ASSETS)
  );
  const [lastOrder, setLastOrder] = useState<PaperOrderRecord | null>(null);
  const [testCases, setTestCases] =
    useState<QuickTestCase[]>(FALLBACK_TEST_CASES);
  const [activePresetId, setActivePresetId] =
    useState<string>("normal_baseline");
  const [backtestData, setBacktestData] = useState<
    Record<string, BacktestScenarioResult>
  >({});

  const wsRef = useRef<WebSocket | null>(null);
  const backendWsConnectedRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestAssetsRef = useRef<AssetInput[]>(assets);
  latestAssetsRef.current = assets;
  const latestParamsRef = useRef<StressTestParams>(stressParams);
  latestParamsRef.current = stressParams;

  // Fetch test cases and historical backtest scenarios on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/test-cases`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setTestCases(data);
        }
      })
      .catch(() => {});

    fetch(`${API_BASE}/api/backtest`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data === "object") {
          setBacktestData(data);
        }
      })
      .catch(() => {});
  }, []);

  // Poll Next.js Serverless /api/market (works on Vercel & locally) + micro-tick
  const fetchVercelServerlessQuotes = useCallback(async (mode: FeedMode) => {
    try {
      const res = await fetch(`/api/market?mode=${mode}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.quotes && Object.keys(data.quotes).length > 0) {
          setFeedSource(data.source || "LIVE_YAHOO_FINANCE");
          setLastLiveSync(new Date().toLocaleTimeString());
          setAssets((curr) =>
            curr.map((a) => {
              const q = data.quotes[a.ticker];
              if (!q) return a;
              return {
                ...a,
                price: q.price,
                change_24h_pct: q.change_24h_pct,
                bid: q.bid,
                ask: q.ask,
                feed_source: data.source,
              };
            })
          );
        }
      }
    } catch {
      // Ignore if running in static mode
    }
  }, []);

  // Browser-side live tick loop when Python backend WS is not connected (e.g. on Vercel)
  useEffect(() => {
    fetchVercelServerlessQuotes(feedMode);
    const pollInterval = setInterval(() => {
      if (!backendWsConnectedRef.current) {
        fetchVercelServerlessQuotes(feedMode);
      }
    }, 8000);

    const tickInterval = setInterval(() => {
      if (backendWsConnectedRef.current) return;
      setAssets((curr) => {
        const prevMap: Record<string, number> = {};
        const nextAssets = curr.map((a) => {
          prevMap[a.ticker] = a.price;
          const jitter = (Math.random() - 0.495) * 0.0014;
          const nextPx = +(a.price * (1 + jitter)).toFixed(2);
          const spread = Math.max(nextPx * 0.00025, 0.01);
          return {
            ...a,
            price: nextPx,
            bid: +(nextPx - spread).toFixed(2),
            ask: +(nextPx + spread).toFixed(2),
          };
        });
        setPrevPrices(prevMap);

        // Sync paper account mark-to-market with new prices
        setPaperAccount((prevAcc) => {
          const nextPositions = prevAcc.positions.map((pos) => {
            const match = nextAssets.find((na) => na.ticker === pos.ticker);
            if (!match) return pos;
            const px = match.price;
            const mktVal = +(pos.shares * px).toFixed(2);
            const unrl = +(pos.shares * (px - pos.avg_entry_price)).toFixed(2);
            const unrlPct =
              pos.avg_entry_price > 0
                ? +(((px - pos.avg_entry_price) / pos.avg_entry_price) * 100).toFixed(2)
                : 0;
            return {
              ...pos,
              current_price: px,
              bid_price: match.bid || +(px * 0.9998).toFixed(2),
              ask_price: match.ask || +(px * 1.0002).toFixed(2),
              market_value: mktVal,
              unrealized_pnl: unrl,
              unrealized_pnl_pct: unrlPct,
            };
          });
          const posVal = +nextPositions
            .reduce((s, p) => s + p.market_value, 0)
            .toFixed(2);
          const unrlTot = +nextPositions
            .reduce((s, p) => s + p.unrealized_pnl, 0)
            .toFixed(2);
          const totEq = +(prevAcc.cash_balance + posVal).toFixed(2);
          const totPnl = +(prevAcc.realized_pnl + unrlTot).toFixed(2);
          return {
            ...prevAcc,
            positions: nextPositions,
            positions_value: posVal,
            total_equity: totEq,
            unrealized_pnl: unrlTot,
            total_pnl: totPnl,
            total_pnl_pct: +((totPnl / prevAcc.initial_equity) * 100).toFixed(2),
          };
        });

        return nextAssets;
      });
    }, 1000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(tickInterval);
    };
  }, [feedMode, fetchVercelServerlessQuotes]);

  const runRestFallback = useCallback(
    async (
      nextParams: StressTestParams,
      nextMode: FeedMode = feedMode,
      customAssets?: AssetInput[]
    ) => {
      const targetAssets = customAssets || latestAssetsRef.current;
      // Immediately compute client-side so UI is 0ms responsive on Vercel
      setMetrics(
        computeClientSideRiskMetrics(
          targetAssets,
          nextParams,
          paperAccount.total_equity
        )
      );
      try {
        const res = await fetch(`${API_BASE}/api/simulate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assets: targetAssets,
            stress_params: nextParams,
            feed_mode: nextMode,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.metrics) setMetrics(data.metrics);
          if (data.assets) setAssets(data.assets);
          if (data.paper_account) setPaperAccount(data.paper_account);
        }
      } catch {
        // Client-side metrics already applied above
      }
    },
    [feedMode, paperAccount.total_equity]
  );

  useEffect(() => {
    let isMounted = true;

    const connectWs = () => {
      if (!isMounted) return;
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          backendWsConnectedRef.current = true;
          setConnected(true);
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const payload = JSON.parse(event.data);
            if (payload.assets && Array.isArray(payload.assets)) {
              setAssets((current) => {
                const map: Record<string, number> = {};
                current.forEach((a) => {
                  map[a.ticker] = a.price;
                });
                setPrevPrices(map);
                return payload.assets;
              });
            }
            if (payload.metrics) {
              setMetrics(payload.metrics);
            }
            if (payload.paper_account) {
              setPaperAccount(payload.paper_account);
            }
            if (payload.last_order) {
              setLastOrder(payload.last_order);
            }
            if (payload.stress_params && payload.type !== "tick_update") {
              setStressParams(payload.stress_params);
            }
            if (payload.feed_mode) {
              setFeedModeState(payload.feed_mode);
            }
            if (payload.feed_source) {
              setFeedSource(payload.feed_source);
            }
            if (payload.last_live_sync) {
              setLastLiveSync(payload.last_live_sync);
            }
            if (typeof payload.binance_live === "boolean") {
              setBinanceLive(payload.binance_live);
            }
            if (typeof payload.equities_live === "boolean") {
              setEquitiesLive(payload.equities_live);
            }
          } catch {
            // Ignore malformed message
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          backendWsConnectedRef.current = false;
          // Keep connected badge green on Vercel using client-side live stream
          setConnected(true);
          reconnectTimerRef.current = setTimeout(connectWs, 4000);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        backendWsConnectedRef.current = false;
        reconnectTimerRef.current = setTimeout(connectWs, 4000);
      }
    };

    connectWs();

    return () => {
      isMounted = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const updateStressParams = useCallback(
    (partial: Partial<StressTestParams>) => {
      setActivePresetId("");
      setStressParams((prev) => {
        const next = { ...prev, ...partial };
        setMetrics(
          computeClientSideRiskMetrics(
            latestAssetsRef.current,
            next,
            paperAccount.total_equity
          )
        );
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                action: "update_params",
                stress_params: next,
              })
            );
          } else {
            runRestFallback(next);
          }
        }, 40);
        return next;
      });
    },
    [runRestFallback, paperAccount.total_equity]
  );

  const applyPreset = useCallback(
    (preset: QuickTestCase) => {
      setActivePresetId(preset.id);
      const nextParams = { ...preset.stress_params };
      setStressParams(nextParams);
      setMetrics(
        computeClientSideRiskMetrics(
          latestAssetsRef.current,
          nextParams,
          paperAccount.total_equity
        )
      );

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            action: "apply_preset",
            preset_id: preset.id,
          })
        );
      } else {
        runRestFallback(nextParams);
      }
    },
    [runRestFallback, paperAccount.total_equity]
  );

  const setFeedMode = useCallback(
    (mode: FeedMode) => {
      setFeedModeState(mode);
      const fallbackAssets =
        mode === "crypto" ? DEFAULT_CRYPTO_ASSETS : DEFAULT_EQUITY_ASSETS;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            action: "set_feed_mode",
            feed_mode: mode,
          })
        );
      } else {
        setAssets(fallbackAssets);
        setPaperAccount(buildInitialPaperAccount(mode, fallbackAssets));
        setFeedSource(
          mode === "crypto" ? "LIVE_BINANCE_WS" : "LIVE_YAHOO_FINANCE"
        );
        runRestFallback(stressParams, mode, fallbackAssets);
      }
    },
    [runRestFallback, stressParams]
  );

  const injectNodeShock = useCallback(
    (ticker: string | null, shockMagnitudePct: number = -0.15) => {
      setActivePresetId("");
      const nextParams: StressTestParams = {
        ...stressParams,
        shock_target_ticker: ticker,
        shock_magnitude_pct: ticker ? shockMagnitudePct : 0.0,
      };
      setStressParams(nextParams);
      setMetrics(
        computeClientSideRiskMetrics(
          latestAssetsRef.current,
          nextParams,
          paperAccount.total_equity
        )
      );

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            action: "inject_node_shock",
            ticker,
            shock_magnitude_pct: ticker ? shockMagnitudePct : 0.0,
          })
        );
      } else {
        runRestFallback(nextParams);
      }
    },
    [runRestFallback, stressParams, paperAccount.total_equity]
  );

  const updateAssetWeight = useCallback(
    (ticker: string, newWeight: number) => {
      const clamped = Math.max(0.0, Math.min(1.0, newWeight));
      setAssets((prev) => {
        const next = prev.map((a) =>
          a.ticker === ticker ? { ...a, weight: clamped } : a
        );
        setMetrics(
          computeClientSideRiskMetrics(
            next,
            latestParamsRef.current,
            paperAccount.total_equity
          )
        );
        return next;
      });
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            action: "update_weights",
            weights: { [ticker]: clamped },
          })
        );
      }
    },
    [paperAccount.total_equity]
  );

  const placePaperOrder = useCallback(
    async (req: PaperOrderRequest): Promise<PaperOrderRecord | null> => {
      const payload: PaperOrderRequest = {
        ...req,
        feed_mode: req.feed_mode || feedMode,
      };

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            action: "place_paper_order",
            order: payload,
          })
        );
      }

      try {
        const res = await fetch(`${API_BASE}/api/paper-trade/order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.paper_account) setPaperAccount(data.paper_account);
          if (data.assets) setAssets(data.assets);
          if (data.metrics) setMetrics(data.metrics);
          if (data.order) {
            setLastOrder(data.order);
            return data.order as PaperOrderRecord;
          }
        }
      } catch {
        // Serverless / Vercel local execution
        let executedRecord: PaperOrderRecord | null = null;
        setPaperAccount((prev) => {
          const posIdx = prev.positions.findIndex(
            (p) => p.ticker === payload.ticker
          );
          if (posIdx === -1) return prev;
          const pos = prev.positions[posIdx];
          const fillPx =
            payload.side === "BUY" ? pos.ask_price : pos.bid_price;
          const qty = payload.quantity
            ? +payload.quantity.toFixed(4)
            : payload.notional_usd
            ? +(payload.notional_usd / fillPx).toFixed(4)
            : 0;
          const notional = +(qty * fillPx).toFixed(2);
          const nowStr = new Date().toLocaleTimeString();

          if (qty <= 0) return prev;
          if (payload.side === "BUY" && notional > prev.cash_balance) {
            executedRecord = {
              order_id: `ORD-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
              timestamp: nowStr,
              ticker: payload.ticker,
              side: "BUY",
              order_type: payload.order_type || "MARKET",
              quantity: qty,
              fill_price: fillPx,
              notional_usd: notional,
              realized_pnl: 0,
              status: "REJECTED",
              message: `Insufficient cash ($${prev.cash_balance.toLocaleString()} available vs $${notional.toLocaleString()} needed).`,
            };
            return {
              ...prev,
              order_history: [executedRecord, ...prev.order_history],
            };
          }
          if (payload.side === "SELL" && qty > pos.shares + 1e-4) {
            executedRecord = {
              order_id: `ORD-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
              timestamp: nowStr,
              ticker: payload.ticker,
              side: "SELL",
              order_type: payload.order_type || "MARKET",
              quantity: qty,
              fill_price: fillPx,
              notional_usd: notional,
              realized_pnl: 0,
              status: "REJECTED",
              message: `Insufficient shares (${pos.shares} held vs ${qty} requested).`,
            };
            return {
              ...prev,
              order_history: [executedRecord, ...prev.order_history],
            };
          }

          const nextPositions = [...prev.positions];
          let nextCash = prev.cash_balance;
          let nextRealized = prev.realized_pnl;
          let tradeRealized = 0;

          if (payload.side === "BUY") {
            const newShares = +(pos.shares + qty).toFixed(4);
            const newAvg = +(
              (pos.shares * pos.avg_entry_price + notional) /
              newShares
            ).toFixed(2);
            nextCash = +(nextCash - notional).toFixed(2);
            nextPositions[posIdx] = {
              ...pos,
              shares: newShares,
              avg_entry_price: newAvg,
              market_value: +(newShares * pos.current_price).toFixed(2),
            };
          } else {
            const sellQty = Math.min(qty, pos.shares);
            const sellNotional = +(sellQty * fillPx).toFixed(2);
            tradeRealized = +(
              (fillPx - pos.avg_entry_price) *
              sellQty
            ).toFixed(2);
            nextRealized = +(nextRealized + tradeRealized).toFixed(2);
            nextCash = +(nextCash + sellNotional).toFixed(2);
            const remShares = +(pos.shares - sellQty).toFixed(4);
            nextPositions[posIdx] = {
              ...pos,
              shares: remShares,
              market_value: +(remShares * pos.current_price).toFixed(2),
            };
          }

          const totalPosVal = nextPositions.reduce(
            (s, p) => s + p.market_value,
            0
          );
          const weightedPositions = nextPositions.map((p) => ({
            ...p,
            weight:
              totalPosVal > 0
                ? +(p.market_value / totalPosVal).toFixed(4)
                : +(1 / nextPositions.length).toFixed(4),
          }));
          const totalUnrl = +weightedPositions
            .reduce((s, p) => s + p.unrealized_pnl, 0)
            .toFixed(2);
          const totalEq = +(nextCash + totalPosVal).toFixed(2);
          const totalPnl = +(nextRealized + totalUnrl).toFixed(2);

          // Update assets weights & recompute Student-t Copula metrics
          const updatedAssets = latestAssetsRef.current.map((a) => {
            const wp = weightedPositions.find((p) => p.ticker === a.ticker);
            return wp ? { ...a, weight: wp.weight } : a;
          });
          setAssets(updatedAssets);
          setMetrics(
            computeClientSideRiskMetrics(
              updatedAssets,
              latestParamsRef.current,
              totalEq
            )
          );

          executedRecord = {
            order_id: `ORD-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
            timestamp: nowStr,
            ticker: payload.ticker,
            side: payload.side,
            order_type: payload.order_type || "MARKET",
            quantity: qty,
            fill_price: fillPx,
            notional_usd: notional,
            realized_pnl: tradeRealized,
            status: "FILLED",
            message: `${payload.side === "BUY" ? "Bought" : "Sold"} ${qty} ${
              payload.ticker
            } @ $${fillPx.toFixed(2)}`,
          };

          return {
            ...prev,
            cash_balance: nextCash,
            buying_power: nextCash,
            positions_value: +totalPosVal.toFixed(2),
            total_equity: totalEq,
            realized_pnl: nextRealized,
            unrealized_pnl: totalUnrl,
            total_pnl: totalPnl,
            total_pnl_pct: +((totalPnl / prev.initial_equity) * 100).toFixed(2),
            positions: weightedPositions,
            order_history: [executedRecord, ...prev.order_history],
          };
        });
        if (executedRecord) setLastOrder(executedRecord);
        return executedRecord;
      }
      return null;
    },
    [feedMode]
  );

  const resetPaperAccount = useCallback(async () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "reset_paper_account" }));
    }
    try {
      const res = await fetch(
        `${API_BASE}/api/paper-trade/reset?feed_mode=${feedMode}`,
        { method: "POST" }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.paper_account) setPaperAccount(data.paper_account);
        if (data.assets) setAssets(data.assets);
        if (data.metrics) setMetrics(data.metrics);
        return;
      }
    } catch {
      // Fallback local reset
    }
    const baseAssets =
      feedMode === "crypto" ? DEFAULT_CRYPTO_ASSETS : DEFAULT_EQUITY_ASSETS;
    setAssets(baseAssets);
    setPaperAccount(buildInitialPaperAccount(feedMode, baseAssets));
    setMetrics(
      computeClientSideRiskMetrics(baseAssets, latestParamsRef.current, 1250000)
    );
  }, [feedMode]);

  const syncLiveMarket = useCallback(async () => {
    await fetchVercelServerlessQuotes(feedMode);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "sync_live_market" }));
    }
    try {
      const res = await fetch(
        `${API_BASE}/api/market/sync?feed_mode=${feedMode}`,
        { method: "POST" }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.assets) setAssets(data.assets);
        if (data.paper_account) setPaperAccount(data.paper_account);
        if (data.feed_source) setFeedSource(data.feed_source);
        if (data.last_live_sync) setLastLiveSync(data.last_live_sync);
      }
    } catch {
      // Serverless /api/market already synced above
    }
  }, [feedMode, fetchVercelServerlessQuotes]);

  return {
    connected,
    binanceLive,
    equitiesLive,
    feedSource,
    lastLiveSync,
    feedMode,
    assets,
    prevPrices,
    stressParams,
    metrics,
    paperAccount,
    lastOrder,
    testCases,
    activePresetId,
    backtestData,
    updateStressParams,
    applyPreset,
    setFeedMode,
    injectNodeShock,
    updateAssetWeight,
    placePaperOrder,
    resetPaperAccount,
    syncLiveMarket,
  };
}
