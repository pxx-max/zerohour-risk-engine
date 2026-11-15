"use client";

import React from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  Zap,
} from "lucide-react";
import { useRisk } from "@/context/RiskContext";
import { ContagionNetworkPanel } from "@/components/ContagionNetworkPanel";
import PaperTradingTerminal from "@/components/PaperTradingTerminal";

export default function PortfolioContagionPage() {
  const {
    assets,
    prevPrices,
    metrics,
    feedMode,
    setFeedMode,
    injectNodeShock,
    updateAssetWeight,
  } = useRisk();

  const nodeMap = React.useMemo(() => {
    const map: Record<
      string,
      {
        tctf_score: number;
        eigenvector_centrality: number;
        contagion_impact_pct: number;
      }
    > = {};
    (metrics?.network_nodes || []).forEach((n) => {
      map[n.ticker] = n;
    });
    return map;
  }, [metrics?.network_nodes]);

  const activeShock = metrics?.shock_target_ticker ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Portfolio, Live Paper Trading &amp; TCTF Contagion
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Open-source live market quotes (Yahoo Finance &amp; Binance), manual
            BUY / SELL paper trading, and León et al. (2011) TCTF contagion
          </p>
        </div>

        <div className="inline-flex items-center p-1 rounded-xl bg-[#13182B] border border-violet-500/20">
          <button
            type="button"
            onClick={() => setFeedMode("equities")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              feedMode === "equities"
                ? "bg-violet-600 text-white shadow-[0_0_14px_rgba(139,92,246,0.4)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Equities &amp; Macro
          </button>
          <button
            type="button"
            onClick={() => setFeedMode("crypto")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              feedMode === "crypto"
                ? "bg-violet-600 text-white shadow-[0_0_14px_rgba(139,92,246,0.4)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Crypto Spot
          </button>
        </div>
      </div>

      {/* Live Paper Trading Terminal (BUY / SELL Market & Limit Orders + Live Positions + Order Blotter) */}
      <PaperTradingTerminal />

      {/* León et al. (2011) TCTF Network Topology Graph */}
      <ContagionNetworkPanel metrics={metrics} onInjectShock={injectNodeShock} />

      {/* Live-Ticking Asset Cards with Direct Weight Sliders & Single-Node Shock Buttons */}
      <div className="rl-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <Briefcase className="w-4 h-4 text-violet-400" />
            <h2 className="text-base font-bold text-white">
              Direct Weight Overrides &amp; Single-Node Shock Controls
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            Systemic Hub:{" "}
            <strong className="text-violet-300">
              {metrics?.hub_ticker ?? "MSFT"}
            </strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map((asset) => {
            const prev = prevPrices[asset.ticker] ?? asset.price;
            const isUp = asset.price >= prev;
            const node = nodeMap[asset.ticker];
            const mvar =
              (metrics?.marginal_var_contributions?.[asset.ticker] ?? 0.004) *
              100;
            const isShocked = activeShock === asset.ticker;
            const isHub = metrics?.hub_ticker === asset.ticker;

            return (
              <div
                key={asset.ticker}
                className={`p-4 rounded-2xl border transition-all ${
                  isShocked
                    ? "bg-rose-500/10 border-rose-400/40"
                    : "bg-[#0E1324] border-violet-500/15 hover:border-violet-400/35"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-white">
                      {asset.ticker}
                    </span>
                    {isHub && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-500/20 text-violet-300 border border-violet-400/30">
                        TCTF Hub
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-sm font-bold tabular-nums">
                    <span className={isUp ? "text-emerald-400" : "text-rose-400"}>
                      ${asset.price.toFixed(2)}
                    </span>
                    {isUp ? (
                      <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
                    )}
                  </div>
                </div>

                {/* TCTF Centrality & Marginal VaR Row */}
                <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                  <span>
                    TCTF Score:{" "}
                    <strong className="text-cyan-300 tabular-nums">
                      {(node?.tctf_score ?? 64.2).toFixed(1)}
                    </strong>
                  </span>
                  <span>
                    Marginal VaR:{" "}
                    <strong className="text-slate-200 tabular-nums">
                      {mvar.toFixed(2)}%
                    </strong>
                  </span>
                </div>

                {/* Weight Slider */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-400">Portfolio Weight</span>
                    <span className="text-white font-bold tabular-nums">
                      {(asset.weight * 100).toFixed(1)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.05}
                    max={0.6}
                    step={0.05}
                    value={asset.weight}
                    onChange={(e) =>
                      updateAssetWeight(asset.ticker, Number(e.target.value))
                    }
                    className="w-full accent-violet-500 cursor-pointer"
                  />
                </div>

                {/* Single-Node -15% Shock Trigger */}
                <button
                  type="button"
                  onClick={() =>
                    injectNodeShock(
                      isShocked ? null : asset.ticker,
                      isShocked ? 0.0 : -0.15
                    )
                  }
                  className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    isShocked
                      ? "bg-rose-500/25 text-rose-200 border border-rose-400/40"
                      : "bg-[#151C33] hover:bg-violet-600/20 text-slate-200 border border-violet-500/20"
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    {isShocked
                      ? `Clear -15% Shock on ${asset.ticker}`
                      : `Inject -15% Node Shock (${asset.ticker})`}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
