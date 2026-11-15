"use client";

import React from "react";
import { Network, Sliders, Zap } from "lucide-react";
import { AssetInput, RiskMetrics } from "@/types/risk";

interface LiveTickerStripProps {
  assets: AssetInput[];
  prevPrices: Record<string, number>;
  metrics: RiskMetrics | null;
  onUpdateWeight: (ticker: string, newWeight: number) => void;
  onInjectShock: (ticker: string) => void;
  variant?: "compact" | "table";
}

export const LiveTickerStrip: React.FC<LiveTickerStripProps> = ({
  assets,
  prevPrices,
  metrics,
  onUpdateWeight,
  onInjectShock,
  variant = "compact",
}) => {
  const nodeMap = React.useMemo(() => {
    const map: Record<
      string,
      { tctf: number; eig: number; impact: number }
    > = {};
    metrics?.network_nodes.forEach((n) => {
      map[n.ticker] = {
        tctf: n.tctf_score,
        eig: n.eigenvector_centrality,
        impact: n.contagion_impact_pct,
      };
    });
    return map;
  }, [metrics]);

  if (variant === "table") {
    return (
      <div className="rl-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
          <div>
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              Portfolio Holdings &amp; León et al. (2011) TCTF Centrality
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Adjust asset weights in real time or click any asset&apos;s shock
              button to simulate a -15% single-node contagion event.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 text-slate-400">
                <th className="py-2.5 px-3 font-medium">Asset</th>
                <th className="py-2.5 px-3 font-medium">Live Price</th>
                <th className="py-2.5 px-3 font-medium">Portfolio Weight</th>
                <th className="py-2.5 px-3 font-medium">Marginal VaR</th>
                <th className="py-2.5 px-3 font-medium">
                  TCTF Centrality Badge
                </th>
                <th className="py-2.5 px-3 font-medium text-right">
                  Contagion Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {assets.map((asset) => {
                const prev = prevPrices[asset.ticker] ?? asset.price;
                const delta = asset.price - prev;
                const node = nodeMap[asset.ticker];
                const tctf = node?.tctf ?? 50.0;
                const mvar =
                  metrics?.marginal_var_contributions?.[asset.ticker] ?? 0.0;
                const isHub = metrics?.hub_ticker === asset.ticker;
                const isShocked =
                  metrics?.shock_target_ticker === asset.ticker;

                return (
                  <tr
                    key={asset.ticker}
                    className={`transition-colors ${
                      isShocked ? "bg-rose-500/10" : "hover:bg-slate-800/30"
                    }`}
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-100">
                          {asset.ticker}
                        </span>
                        {isHub && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                            Systemic Hub
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-3 tabular-nums">
                      <div className="font-semibold text-slate-100">
                        $
                        {asset.price.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                      <div
                        className={`text-[11px] ${
                          delta > 0
                            ? "text-[#34D399]"
                            : delta < 0
                            ? "text-[#FB7185]"
                            : "text-slate-500"
                        }`}
                      >
                        {delta >= 0 ? "+" : ""}
                        {delta.toFixed(2)}
                      </div>
                    </td>

                    <td className="py-3 px-3 w-48">
                      <div className="flex items-center justify-between text-xs mb-1 tabular-nums">
                        <span className="text-slate-300 font-medium">
                          {(asset.weight * 100).toFixed(0)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.02}
                        max={0.6}
                        step={0.01}
                        value={asset.weight}
                        onChange={(e) =>
                          onUpdateWeight(
                            asset.ticker,
                            parseFloat(e.target.value)
                          )
                        }
                        className="w-full h-1.5 bg-[#0D101C] rounded-lg appearance-none cursor-pointer accent-indigo-400"
                      />
                    </td>

                    <td className="py-3 px-3 tabular-nums text-slate-300">
                      {mvar.toFixed(2)}% pts
                    </td>

                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#0D101C] border border-slate-800 text-slate-200 tabular-nums">
                        <Network className="w-3 h-3 text-indigo-400" />
                        TCTF {tctf.toFixed(1)}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => onInjectShock(asset.ticker)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#0D101C] hover:bg-rose-500/20 text-slate-300 hover:text-rose-200 border border-slate-800 hover:border-rose-400/40 transition-colors"
                      >
                        <Zap className="w-3 h-3 text-[#FB7185]" />
                        Shock -15%
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Compact Top Strip
  return (
    <section className="px-6 pt-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {assets.map((asset) => {
          const prev = prevPrices[asset.ticker] ?? asset.price;
          const delta = asset.price - prev;
          const isHub = metrics?.hub_ticker === asset.ticker;
          const isShocked = metrics?.shock_target_ticker === asset.ticker;
          const tctfScore = nodeMap[asset.ticker]?.tctf ?? 50.0;

          return (
            <div
              key={asset.ticker}
              className={`rl-card p-3 transition-all ${
                isShocked
                  ? "border-rose-400/50 bg-rose-500/10"
                  : "hover:border-indigo-400/30"
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-xs text-slate-100">
                    {asset.ticker}
                  </span>
                  {isHub && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                      Hub
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onInjectShock(asset.ticker)}
                  title="Click to simulate a -15% shock on this asset"
                  className="text-[10px] text-slate-400 hover:text-indigo-200 px-1.5 py-0.5 rounded-lg bg-[#0D101C] border border-slate-800 transition-colors tabular-nums"
                >
                  TCTF {tctfScore.toFixed(0)}
                </button>
              </div>

              <div className="flex items-baseline justify-between mt-1.5">
                <span className="text-sm font-semibold tabular-nums text-slate-100">
                  $
                  {asset.price.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span
                  className={`text-[11px] tabular-nums ${
                    delta > 0
                      ? "text-[#34D399]"
                      : delta < 0
                      ? "text-[#FB7185]"
                      : "text-slate-400"
                  }`}
                >
                  {delta >= 0 ? "+" : ""}
                  {delta.toFixed(2)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
